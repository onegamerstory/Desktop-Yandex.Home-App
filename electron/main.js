// main.js

import { app, BrowserWindow, ipcMain, Menu, Tray, Notification, globalShortcut, shell } from 'electron';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, rename, unlink } from 'node:fs/promises';
import fs from 'fs';
import path from 'path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'url';
// Импорт yandex-api.js
import * as yandexApi from './yandex-api.js';
import {
    startQrAuth,
    pollQrAuth,
    cancelQrAuth,
    validateStoredXToken,
} from './yandex-x-token-auth.js';
import { clearQuasarSessionCache } from './yandex-quasar.js';
import keytar from 'keytar';

// Установка __dirname и __filename для ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_NAME = 'SmartHomeControlApp';
const ACCOUNT_NAME = 'YandexToken';
const ACCOUNT_NAME_X_TOKEN = 'YandexXToken';

const getStoredXToken = () => keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME_X_TOKEN);
const setStoredXToken = (xToken) => keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME_X_TOKEN, xToken);
const deleteStoredXToken = () => keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME_X_TOKEN);

/** Coalesce concurrent identical API calls so retry counters are not reset. */
const inflightRequests = new Map();

const runSingleFlight = (key, fn) => {
    if (inflightRequests.has(key)) {
        return inflightRequests.get(key);
    }
    const promise = fn().finally(() => {
        inflightRequests.delete(key);
    });
    inflightRequests.set(key, promise);
    return promise;
};

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_VITE_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Parent terminal / electron-wait can close stdout/stderr while the app keeps running.
// Without this, console.* throws EPIPE and Electron shows "A JavaScript error occurred in the main process".
const isBrokenPipeError = (err) =>
    err?.code === 'EPIPE' || err?.code === 'ERR_STREAM_DESTROYED' || err?.code === 'EIO';

for (const stream of [process.stdout, process.stderr]) {
    stream?.on?.('error', (err) => {
        if (isBrokenPipeError(err)) return;
        throw err;
    });
}

for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
        try {
            original(...args);
        } catch (err) {
            if (isBrokenPipeError(err)) return;
            throw err;
        }
    };
}

if (isDev) {
    // Отделяем dev-экземпляр от установленного приложения (single-instance, userData, трей)
    app.setName('Yandex Smart Home Control DEV');
    app.setPath('userData', path.join(app.getPath('appData'), 'yandex-smart-home-control-dev'));
}

let mainWindow = null;
let appTray = null; // Переменная для хранения экземпляра Tray
let favoritesData = []; // Данные избранных устройств/сценариев
let isQuitting = false;
const WINDOW_BOUNDS_FILE = 'window-bounds.json';
let windowBoundsSaveTimer = null;
const registeredShortcuts = new Map();

const loadWindowSize = () => {
    try {
        const saved = JSON.parse(
            fs.readFileSync(path.join(app.getPath('userData'), WINDOW_BOUNDS_FILE), 'utf8'),
        );
        if (
            Number.isFinite(saved.width) &&
            Number.isFinite(saved.height) &&
            saved.width >= 400 &&
            saved.height >= 300 &&
            saved.width <= 10000 &&
            saved.height <= 10000
        ) {
            return { width: saved.width, height: saved.height };
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Не удалось загрузить размер окна', error);
        }
    }
    return { width: 1024, height: 768 };
};

const saveWindowSize = (window) => {
    if (!window || window.isDestroyed() || window.isMaximized() || window.isMinimized() || window.isFullScreen()) {
        return;
    }
    const { width, height } = window.getBounds();
    try {
        fs.writeFileSync(
            path.join(app.getPath('userData'), WINDOW_BOUNDS_FILE),
            JSON.stringify({ width, height }),
            'utf8',
        );
    } catch (error) {
        console.error('Не удалось сохранить размер окна', error);
    }
};

const toElectronAccelerator = (shortcut) => {
    const parts = shortcut.split('+');
    const key = parts.pop();
    if (!key) return null;

    const modifiers = parts.map((modifier) => {
        if (modifier === 'Ctrl') return 'Control';
        if (modifier === 'Meta') return process.platform === 'darwin' ? 'Command' : 'Super';
        return modifier;
    });
    const keyAliases = {
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right',
        Escape: 'Esc',
        ' ': 'Space',
    };
    const acceleratorKey = keyAliases[key] || key;

    if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Up|Down|Left|Right|Esc|Space|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown)$/.test(acceleratorKey)) {
        return null;
    }
    return [...modifiers, acceleratorKey].join('+');
};

const clearGlobalShortcuts = () => {
    for (const accelerator of registeredShortcuts.keys()) {
        globalShortcut.unregister(accelerator);
    }
    registeredShortcuts.clear();
};

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/onegamerstory/Desktop-Yandex.Home-App/releases/latest';
const normalizeVersion = (version) => version.replace(/^v/i, '');

const isMainWindowRequest = (event) =>
    mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;

const getLinuxPackageExtension = () => {
    if (process.env.APPIMAGE) return '.AppImage';

    try {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        const osInfo = Object.fromEntries(osRelease.split(/\r?\n/).map((line) => {
            const separator = line.indexOf('=');
            if (separator < 0) return [];
            return [line.slice(0, separator), line.slice(separator + 1).replace(/^["']|["']$/g, '')];
        }).filter((entry) => entry.length === 2));
        const distroIds = `${osInfo.ID || ''} ${osInfo.ID_LIKE || ''}`.toLowerCase();
        if (/\b(debian|ubuntu|linuxmint|pop|raspbian)\b/.test(distroIds)) return '.deb';
        if (/\b(fedora|rhel|centos|rocky|almalinux|suse|opensuse)\b/.test(distroIds)) return '.rpm';
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Не удалось определить формат пакета Linux', error);
    }
    return '.AppImage';
};

const matchesReleaseVersion = (name, version) => {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])v?${escapedVersion}(?=$|[^0-9])`, 'i').test(name);
};

const getUpdateAsset = (assets, version) => {
    const platform = process.platform;
    const arch = process.arch;
    const files = assets.filter((asset) => typeof asset.name === 'string' && typeof asset.browser_download_url === 'string');
    let matches = [];

    if (platform === 'win32') {
        if (arch !== 'x64') {
            throw new Error(`Автоматическая загрузка обновлений Windows для архитектуры ${arch} не поддерживается.`);
        }
        matches = files.filter(({ name }) =>
            name.toLowerCase().endsWith(`-${arch}.exe`) &&
            matchesReleaseVersion(name, version),
        );
    } else if (platform === 'darwin') {
        matches = files.filter(({ name }) =>
            name.toLowerCase().endsWith(`-${arch}.dmg`) &&
            matchesReleaseVersion(name, version),
        );
    } else if (platform === 'linux') {
        const extension = getLinuxPackageExtension();
        matches = files.filter(({ name }) =>
            name.toLowerCase().endsWith(`-${arch}${extension}`.toLowerCase()) &&
            matchesReleaseVersion(name, version),
        );
    } else {
        throw new Error(`Загрузка обновлений для ОС ${platform} не поддерживается.`);
    }

    if (matches.length !== 1) {
        throw new Error(`В последнем релизе не найден однозначный установщик для ${platform} (${arch}).`);
    }
    return matches[0];
};

const createUniqueDownloadPath = async (directory, fileName) => {
    const safeFileName = path.basename(fileName);
    const extension = path.extname(safeFileName);
    const baseName = path.basename(safeFileName, extension);
    let candidate = path.join(directory, safeFileName);
    let suffix = 1;
    while (true) {
        try {
            await access(candidate);
            candidate = path.join(directory, `${baseName} (${suffix++})${extension}`);
        } catch (error) {
            if (error.code === 'ENOENT') return candidate;
            throw error;
        }
    }
};

const downloadLatestUpdate = async (expectedVersion, reportProgress) => {
    if (!app.isPackaged) {
        throw new Error('Скачивание обновлений доступно только в установленной версии приложения.');
    }
    if (typeof expectedVersion !== 'string' || !/^[v\d][\w.+-]*$/i.test(expectedVersion)) {
        throw new TypeError('Некорректная версия обновления.');
    }

    const releaseResponse = await fetch(GITHUB_RELEASES_URL, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Yandex-Smart-Home-Control',
        },
    });
    if (!releaseResponse.ok) {
        throw new Error(`Не удалось получить список файлов обновления (HTTP ${releaseResponse.status}).`);
    }

    const release = await releaseResponse.json();
    if (
        typeof release.tag_name !== 'string' ||
        normalizeVersion(release.tag_name) !== normalizeVersion(expectedVersion) ||
        !Array.isArray(release.assets)
    ) {
        throw new Error('Релиз обновления изменился. Проверьте наличие обновлений и повторите попытку.');
    }

    const asset = getUpdateAsset(release.assets, normalizeVersion(release.tag_name));
    const assetUrl = new URL(asset.browser_download_url);
    if (assetUrl.protocol !== 'https:' || assetUrl.hostname !== 'github.com') {
        throw new Error('Получена некорректная ссылка на файл обновления.');
    }
    const downloadResponse = await fetch(asset.browser_download_url);
    if (!downloadResponse.ok || !downloadResponse.body) {
        throw new Error(`Не удалось скачать установщик (HTTP ${downloadResponse.status}).`);
    }
    const contentLength = Number(downloadResponse.headers.get('content-length'));
    const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;
    let downloadedBytes = 0;
    let lastReportedPercent = -1;
    let lastReportedAt = 0;
    reportProgress({ downloadedBytes, totalBytes, percent: totalBytes ? 0 : null });

    const downloadsDirectory = app.getPath('downloads');
    await mkdir(downloadsDirectory, { recursive: true });
    const filePath = await createUniqueDownloadPath(downloadsDirectory, asset.name);
    const temporaryPath = `${filePath}.${randomUUID()}.download`;
    let downloadedFileCreated = false;
    try {
        const progressTransform = new Transform({
            transform(chunk, _encoding, callback) {
                downloadedBytes += chunk.length;
                const percent = totalBytes
                    ? Math.min(99, Math.floor((downloadedBytes / totalBytes) * 100))
                    : null;
                const now = Date.now();
                if (percent !== lastReportedPercent || now - lastReportedAt >= 250) {
                    reportProgress({ downloadedBytes, totalBytes, percent });
                    lastReportedPercent = percent;
                    lastReportedAt = now;
                }
                callback(null, chunk);
            },
        });
        await pipeline(
            Readable.fromWeb(downloadResponse.body),
            progressTransform,
            createWriteStream(temporaryPath, { flags: 'wx' }),
        );
        await rename(temporaryPath, filePath);
        downloadedFileCreated = true;
        if (asset.name.toLowerCase().endsWith('.appimage')) {
            await fs.promises.chmod(filePath, 0o755);
        }
    } catch (error) {
        await unlink(temporaryPath).catch((cleanupError) => {
            if (cleanupError.code !== 'ENOENT') console.error('Не удалось удалить временный файл обновления', cleanupError);
        });
        if (downloadedFileCreated) {
            await unlink(filePath).catch((cleanupError) => {
                if (cleanupError.code !== 'ENOENT') console.error('Не удалось удалить неполный файл обновления', cleanupError);
            });
        }
        throw error;
    }
    reportProgress({ downloadedBytes, totalBytes, percent: 100 });

    return {
        platform: process.platform,
        arch: process.arch,
        fileName: asset.name,
        filePath,
        canAutoInstall: app.isPackaged && (process.platform === 'win32' || (process.platform === 'linux' && Boolean(process.env.APPIMAGE))),
        isAppImage: process.platform === 'linux' && Boolean(process.env.APPIMAGE),
    };
};

const waitForProcessStart = (childProcess) => new Promise((resolve, reject) => {
    childProcess.once('spawn', resolve);
    childProcess.once('error', reject);
});

let downloadedUpdate = null;
const installDownloadedUpdate = async (updateId) => {
    if (!app.isPackaged) {
        throw new Error('Установка обновлений доступна только в установленной версии приложения.');
    }
    if (!downloadedUpdate || typeof updateId !== 'string' || updateId !== downloadedUpdate.id) {
        throw new Error('Файл обновления не найден. Скачайте его заново.');
    }
    await access(downloadedUpdate.filePath);

    if (process.platform === 'win32') {
        const installer = spawn(downloadedUpdate.filePath, [], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
        });
        await waitForProcessStart(installer);
        installer.unref();
        app.quit();
        return;
    }

    if (process.platform === 'linux' && downloadedUpdate.isAppImage && process.env.APPIMAGE) {
        const currentAppImage = path.resolve(process.env.APPIMAGE);
        const directory = path.dirname(currentAppImage);
        await access(directory, fs.constants.W_OK);
        const replacementPath = `${currentAppImage}.update-${process.pid}`;
        const quote = (value) => `'${value.replace(/'/g, "'\\''")}'`;
        const script = [
            'set -e',
            'sleep 1',
            `cp -- ${quote(downloadedUpdate.filePath)} ${quote(replacementPath)}`,
            `chmod 755 ${quote(replacementPath)}`,
            `mv -f -- ${quote(replacementPath)} ${quote(currentAppImage)}`,
            `exec ${quote(currentAppImage)}`,
        ].join('; ');
        const updater = spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'ignore' });
        await waitForProcessStart(updater);
        updater.unref();
        app.quit();
        return;
    }

    throw new Error('Автоматическая установка обновления для этого варианта Linux не поддерживается.');
};

// --- 1. Обработка закрытия окна (свернуть в трей) ---
const minimizeToTray = (event) => {
	// Если пользователь нажимает крестик, сворачиваем в трей (на macOS окно может скрыться/закрыться само)
	if (appTray && mainWindow && !mainWindow.isDestroyed() && process.platform !== 'darwin') {
		event.preventDefault(); // Предотвращаем закрытие
		mainWindow.hide();      // Скрываем окно
	}
};

// Функция для создания Tray
function createTray() {
    let iconPath;
    
    // Определяем путь к иконке в зависимости от платформы
    if (process.platform === 'darwin') {
        // Для macOS используем trayTemplate.png (специальный формат для трея)
        // Важно: trayTemplate.png должен быть шаблоном с прозрачностью
        // macOS автоматически применяет темную/светлую тему к этому шаблону
        // Файл должен быть монохромным (черно-белым) с альфа-каналом
        // 
        // Для поддержки Retina дисплеев: Electron автоматически использует
        // trayTemplate@2x.png, если он находится в той же директории.
        // Размеры: trayTemplate.png - 16x16px, trayTemplate@2x.png - 32x32px
        iconPath = path.join(__dirname, '..', 'resources', 'trayTemplate.png');
    } else if (process.platform === 'win32') {
        // Для Windows используем .ico файл
        iconPath = path.join(__dirname, '..', 'resources', 'icon.ico');
    } else {
        // Для Linux используем PNG
        iconPath = path.join(__dirname, '..', 'resources', 'icon.png');
    }
    
    // Fallback для режима разработки или если файл не найден
    const fallbackIconPath = path.join(__dirname, '..', 'resources', 'icon.png');
    
    // Создаем Tray с обработкой ошибок
    try {
        appTray = new Tray(iconPath);
    } catch (e) {
        console.warn(`Tray icon not found at ${iconPath}. Falling back to ${fallbackIconPath}.`, e);
        try {
            appTray = new Tray(fallbackIconPath);
        } catch (fallbackError) {
            console.error('Failed to load fallback tray icon:', fallbackError);
            // В крайнем случае используем системную иконку (если доступна)
            return;
        }
    }
    
    appTray.setToolTip(isDev ? '[DEV] Управление Умным Домом Яндекс' : 'Управление Умным Домом Яндекс');
    
    // На macOS: левый клик — только показать/скрыть окно, правый клик — контекстное меню
    // На других платформах: левый клик — показать/скрыть окно + контекстное меню через setContextMenu
    appTray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        } else {
            createWindow();
        }
    });

    if (process.platform === 'darwin') {
        appTray.on('right-click', () => {
            appTray.popUpContextMenu(buildTrayMenu());
        });
    }

    // Обновляем контекстное меню сразу после создания (для Windows/Linux)
    updateTrayMenu();
}

// Функция для построения меню трея
function buildTrayMenu() {
    // --- Динамическая секция избранных элементов ---
    const favoriteMenuItems = favoritesData.map(item => {
        const isDevice = item.type === 'device';
        const isToggleableDevice = isDevice && item.isToggleable;
        const isGroup = item.type === 'group';
        const isToggleableGroup = isGroup && item.isToggleable;
        
        let deviceStatus = '';
        if (isDevice) {
            if (item.sensorValue) {
                deviceStatus = ` ${item.sensorValue}`;
            } else if (isToggleableDevice) {
                deviceStatus = item.isOn
                    ? ' 🟢'
                    : ' 🔴';
            }
        } else if (isGroup) {
            if (isToggleableGroup) {
                deviceStatus = item.isOn
                    ? ' 🟢'
                    : ' 🔴';
            }
        }
        const label = `${item.name}${deviceStatus}`;
        
        let clickAction = null;

        if (isToggleableDevice) {
            clickAction = () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('tray:execute-command', 'TOGGLE_DEVICE', item.id, item.isOn);
                }
            };
        } else if (isToggleableGroup) {
            clickAction = () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('tray:execute-command', 'TOGGLE_GROUP', item.id, item.isOn);
                }
            };
        } else if (item.type === 'scenario') {
             clickAction = () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('tray:execute-command', 'EXECUTE_SCENARIO', item.id);
                }
            };
        }
        
        return {
            label: label,
            type: 'normal',
            enabled: !!clickAction,
            click: clickAction,
        };
    });

    return Menu.buildFromTemplate([
        { 
            label: 'Открыть приложение', 
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        ...(favoriteMenuItems.length > 0 ? [{ type: 'separator' }] : []), 
        ...favoriteMenuItems,
        { type: 'separator' },
        { 
            label: 'Выход', 
            click: () => {
                app.quit();
            }
        },
    ]);
}

// Функция для обновления контекстного меню Tray (только Windows/Linux)
function updateTrayMenu() {
    if (!appTray) return;
    if (process.platform !== 'darwin') {
        appTray.setContextMenu(buildTrayMenu());
    }
}


function createWindow () {
    mainWindow = new BrowserWindow({
        ...loadWindowSize(),
        webPreferences: {
            nodeIntegration: false, 
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });
    
    mainWindow.on('resize', () => {
        if (windowBoundsSaveTimer) clearTimeout(windowBoundsSaveTimer);
        windowBoundsSaveTimer = setTimeout(() => {
            windowBoundsSaveTimer = null;
            saveWindowSize(mainWindow);
        }, 300);
    });

    mainWindow.on('close', (event) => {
        if (windowBoundsSaveTimer) {
            clearTimeout(windowBoundsSaveTimer);
            windowBoundsSaveTimer = null;
        }
        saveWindowSize(mainWindow);
        if (!isQuitting) minimizeToTray(event);
    });
    
    // Очищаем ссылку на окно при его закрытии
    mainWindow.on('closed', () => {
        if (windowBoundsSaveTimer) {
            clearTimeout(windowBoundsSaveTimer);
            windowBoundsSaveTimer = null;
        }
        mainWindow = null;
    });
    
    // Обработка восстановления из трея
    mainWindow.on('restore', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
        }
    });


     if (isDev) {
        mainWindow.setTitle('[DEV] Yandex Smart Home Control');
        mainWindow.loadURL(DEV_VITE_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        mainWindow.webContents.on('console-message', (_event, level, message) => {
            const interesting =
                message.includes('[Goloom]')
                || message.includes('[Camera]')
                || message.includes('[Debug:')
                || message.includes('InvalidStateError')
                || message.includes('MediaElementSource')
                || message.includes('createMediaElementSource');
            if (interesting) {
                const prefix = level === 3 ? '[Renderer:ERR]' : '[Renderer]';
                console.log(prefix, message);
            }
        });
        mainWindow.webContents.on('render-process-gone', (_event, details) => {
            console.error('[Electron] render-process-gone', details);
        });
        mainWindow.webContents.on('unresponsive', () => {
            console.error('[Electron] webContents unresponsive');
        });
        mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
            console.error('[Electron] did-fail-load', { code, desc, url });
        });
        mainWindow.webContents.on('did-finish-load', () => {
            console.log('[Electron] did-finish-load');
        });
     } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
     }
}

// --- Single Instance Lock: предотвращаем запуск нескольких экземпляров (кроме dev) ---
const gotTheLock = isDev ? true : app.requestSingleInstanceLock();

if (!gotTheLock) {
    // Если другой экземпляр уже запущен, закрываем этот
    app.quit();
} else {
    if (!isDev) {
        // Обработчик для случая, когда пользователь пытается запустить второй экземпляр
        app.on('second-instance', () => {
            // Если окно существует и не уничтожено, показываем и фокусируем его
            if (mainWindow && !mainWindow.isDestroyed()) {
                if (mainWindow.isMinimized()) {
                    mainWindow.restore();
                }
                mainWindow.show();
                mainWindow.focus();
            } else {
                // Если окна нет (например, оно было закрыто), создаем новое
                createWindow();
            }
        });
    }

    // Когда Electron готов
    app.whenReady().then(() => {
        if (process.platform === 'win32') {
            app.setAppUserModelId('com.onegamerstory.smarthomecontrol');
        }

        Menu.setApplicationMenu(null);

        createWindow();
        createTray(); // Создаем Tray

        ipcMain.handle('updates:download-latest', async (event, expectedVersion, requestId) => {
            if (!isMainWindowRequest(event)) {
                throw new Error('Запрос на обновление должен исходить из главного окна приложения.');
            }
            if (typeof requestId !== 'string' || requestId.length > 100) {
                throw new TypeError('Некорректный идентификатор загрузки обновления.');
            }
            downloadedUpdate = {
                ...await downloadLatestUpdate(expectedVersion, (progress) => {
                    if (isMainWindowRequest(event)) {
                        event.sender.send('updates:download-progress', { requestId, ...progress });
                    }
                }),
                id: randomUUID(),
            };
            return downloadedUpdate;
        });

        ipcMain.handle('updates:show-downloaded', async (event, updateId) => {
            if (!isMainWindowRequest(event)) {
                throw new Error('Папку с обновлением можно открыть только из главного окна приложения.');
            }
            if (!downloadedUpdate || typeof updateId !== 'string' || updateId !== downloadedUpdate.id) {
                throw new Error('Файл обновления не найден. Скачайте его заново.');
            }
            await access(downloadedUpdate.filePath);
            shell.showItemInFolder(downloadedUpdate.filePath);
        });

        ipcMain.handle('updates:install-downloaded', async (event, updateId) => {
            if (!isMainWindowRequest(event)) {
                throw new Error('Установку обновления можно запустить только из главного окна приложения.');
            }
            await installDownloadedUpdate(updateId);
        });

        ipcMain.handle('shortcuts:register-global', (event, shortcuts) => {
            if (!mainWindow || event.sender !== mainWindow.webContents) {
                throw new Error('Global shortcuts can only be registered by the main application window');
            }
            if (!Array.isArray(shortcuts)) {
                throw new TypeError('Global shortcuts must be an array');
            }

            clearGlobalShortcuts();
            const failedIds = [];
            const seenAccelerators = new Set();

            for (const shortcut of shortcuts) {
                if (
                    !shortcut ||
                    typeof shortcut.id !== 'string' ||
                    typeof shortcut.keys !== 'string' ||
                    !shortcut.id ||
                    !shortcut.keys
                ) {
                    continue;
                }

                const accelerator = toElectronAccelerator(shortcut.keys);
                if (!accelerator || seenAccelerators.has(accelerator)) {
                    failedIds.push(shortcut.id);
                    continue;
                }
                seenAccelerators.add(accelerator);

                try {
                    const registered = globalShortcut.register(accelerator, () => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('shortcuts:trigger', shortcut.id);
                        }
                    });
                    if (registered) registeredShortcuts.set(accelerator, shortcut.id);
                    else failedIds.push(shortcut.id);
                } catch (error) {
                    console.error(`Failed to register global shortcut ${shortcut.keys}`, error);
                    failedIds.push(shortcut.id);
                }
            }

            return failedIds;
        });

        const makeRetryCallback = (action) => {
            return (attempt, maxAttempts) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('yandex-api:retry-attempt', {
                        action,
                        attempt,
                        maxAttempts,
                        message: `Попытка повторного подключения ${attempt} из ${maxAttempts}...`,
                    });
                }
                console.log(`${action}: повторная попытка ${attempt}/${maxAttempts}...`);
            };
        };

        ipcMain.handle('yandex-api:fetchUserInfo', async (event, token, options = {}) => {
            const retry = options.retry !== false;
            const key = `fetchUserInfo:${token}:${retry}`;
            try {
                return await runSingleFlight(key, () =>
                    yandexApi.fetchUserInfo(
                        token,
                        retry ? makeRetryCallback('fetchUserInfo') : null,
                        { retry },
                    ),
                );
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:executeScenario', async (event, token, scenarioId) => {
            try {
                return await yandexApi.executeScenario(token, scenarioId, makeRetryCallback('executeScenario'));
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:toggleDevice', async (event, token, deviceId, newState) => {
            try {
                return await yandexApi.toggleDevice(token, deviceId, newState, makeRetryCallback('toggleDevice'));
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:setDeviceMode', async (event, token, deviceId, modeActions, turnOn) => {
            try {
                return await yandexApi.setDeviceMode(token, deviceId, modeActions, turnOn, makeRetryCallback('setDeviceMode'));
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:toggleGroup', async (event, token, groupId, deviceIds, newState) => {
            try {
                return await yandexApi.toggleGroup(token, groupId, deviceIds, newState, makeRetryCallback('toggleGroup'));
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:fetchDevice', async (event, token, deviceId) => {
            try {
                return await yandexApi.fetchDevice(token, deviceId, makeRetryCallback('fetchDevice'));
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:getCameraStream', async (event, deviceId) => {
            try {
                const xToken = await getStoredXToken();
                if (!xToken) {
                    throw new Error('X_TOKEN_REQUIRED');
                }
                return await yandexApi.getCameraStream(xToken, deviceId, makeRetryCallback('getCameraStream'));
            } catch (error) {
                if (error.message?.includes('Quasar auth') || error.message?.includes('x-token')) {
                    await deleteStoredXToken();
                    clearQuasarSessionCache();
                    throw new Error('X_TOKEN_REQUIRED', { cause: error });
                }
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:setCameraPrivacyMode', async (event, deviceId, privacyEnabled, toggleInstance = 'privacy') => {
            try {
                const iotToken = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
                if (!iotToken) {
                    throw new Error('Токен не найден');
                }
                const xToken = await getStoredXToken();
                return await yandexApi.setCameraPrivacyMode(
                    iotToken,
                    xToken,
                    deviceId,
                    privacyEnabled,
                    toggleInstance,
                    makeRetryCallback('setCameraPrivacyMode'),
                );
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-api:getQuasarCameraDevice', async (event, deviceId, options = {}) => {
            const retry = options.retry !== false;
            try {
                const xToken = await getStoredXToken();
                if (!xToken) {
                    throw new Error('X_TOKEN_REQUIRED');
                }
                const key = `getQuasarCameraDevice:${deviceId}:${retry}`;
                return await runSingleFlight(key, () =>
                    yandexApi.getQuasarCameraDevice(
                        xToken,
                        deviceId,
                        retry ? makeRetryCallback('getQuasarCameraDevice') : null,
                        { retry },
                    ),
                );
            } catch (error) {
                if (error.message?.includes('Quasar auth') || error.message?.includes('x-token')) {
                    await deleteStoredXToken();
                    clearQuasarSessionCache();
                    throw new Error('X_TOKEN_REQUIRED', { cause: error });
                }
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-auth:hasXToken', async () => {
            const xToken = await getStoredXToken();
            if (!xToken) {
                return false;
            }
            const validation = await validateStoredXToken(xToken);
            if (!validation.valid) {
                await deleteStoredXToken();
                clearQuasarSessionCache();
                return false;
            }
            return true;
        });

        ipcMain.handle('yandex-auth:startQr', async () => {
            try {
                return await startQrAuth();
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        ipcMain.handle('yandex-auth:pollQr', async () => {
            const result = await pollQrAuth();
            if (result.status === 'ok' && result.xToken) {
                await setStoredXToken(result.xToken);
                clearQuasarSessionCache();
            }
            return result;
        });

        ipcMain.handle('yandex-auth:cancelQr', async () => {
            cancelQrAuth();
        });

        ipcMain.handle('secure:getToken', async () => {
            // Читает токен из системного хранилища
            return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        });

        ipcMain.handle('secure:setToken', async (event, token) => {
            // Сохраняет токен в системное хранилище
            await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
        });

        ipcMain.handle('secure:deleteToken', async () => {
            await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
            await deleteStoredXToken();
            clearQuasarSessionCache();
            cancelQrAuth();
        });
        
        // --- Auto-launch handlers ---
        ipcMain.handle('autostart:isEnabled', async () => {
            const loginItemSettings = app.getLoginItemSettings();
            return loginItemSettings.openAtLogin;
        });

        ipcMain.handle('autostart:setEnabled', async (event, enabled) => {
            app.setLoginItemSettings({
                openAtLogin: enabled,
                openAsHidden: false, // Можно изменить на true, если нужно запускать скрыто
            });
            return enabled;
        });

        ipcMain.handle('notification:camera-stream-error', async (_event, { deviceId, deviceName, message }) => {
            if (!Notification.isSupported()) {
                return false;
            }

            const notification = new Notification({
                title: `${deviceName} — нет видео`,
                body: message,
                actions: [{ type: 'button', text: 'Повторить' }],
                closeButtonText: 'Закрыть',
            });

            notification.on('action', () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.webContents.send('camera-stream:retry', { deviceId });
                }
            });

            notification.on('click', () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            });

            notification.show();
            return true;
        });
        
        // --- 2. НОВЫЙ IPC-ОБРАБОТЧИК ДЛЯ ПОЛУЧЕНИЯ ИЗБРАННЫХ ЭЛЕМЕНТОВ ---
        ipcMain.on('tray:update-favorites', (event, favorites) => {
            favoritesData = favorites;
            updateTrayMenu(); // Обновляем меню при получении новых данных
        });

    });

    // Закрыть приложение, когда закрыты все окна (кроме macOS)
    app.on('window-all-closed', () => {
        // На macOS приложение обычно продолжает работать, даже если все окна закрыты
        if (process.platform !== 'darwin') {
            // В Windows и Linux выходим только если нет трея (иначе трей держит приложение)
            if (!appTray) {
                app.quit();
            }
        }
    });

    app.on('before-quit', () => {
        isQuitting = true;
        if (windowBoundsSaveTimer) {
            clearTimeout(windowBoundsSaveTimer);
            windowBoundsSaveTimer = null;
        }
        saveWindowSize(mainWindow);
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    app.on('will-quit', () => {
        clearGlobalShortcuts();
    });
}