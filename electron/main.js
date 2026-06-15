// main.js

import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron'; // <-- Добавлен Menu, Tray
import path from 'path';
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

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_VITE_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

if (isDev) {
    // Отделяем dev-экземпляр от установленного приложения (single-instance, userData, трей)
    app.setName('Yandex Smart Home Control DEV');
    app.setPath('userData', path.join(app.getPath('appData'), 'yandex-smart-home-control-dev'));
}

let mainWindow = null;
let appTray = null; // Переменная для хранения экземпляра Tray
let favoritesData = []; // Данные избранных устройств/сценариев

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
        
        let deviceStatus = '';
        if (isDevice) {
            if (item.sensorValue) {
                deviceStatus = ` ${item.sensorValue}`;
            } else if (isToggleableDevice) {
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
                if (mainWindow) {
                    mainWindow.removeListener('close', minimizeToTray);
                }
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
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: false, 
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });
    
    mainWindow.on('close', minimizeToTray);
    
    // Очищаем ссылку на окно при его закрытии
    mainWindow.on('closed', () => {
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
        mainWindow.webContents.on('console-message', (_event, level, message) => {
            if (message.includes('[Goloom]') || message.includes('[Camera]')) {
                const prefix = level === 3 ? '[Renderer:ERR]' : '[Renderer]';
                console.log(prefix, message);
            }
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
        Menu.setApplicationMenu(null);

        createWindow();
        createTray(); // Создаем Tray
        
        ipcMain.handle('yandex-api:fetchUserInfo', async (event, token) => {
            try {
                return await yandexApi.fetchUserInfo(token, makeRetryCallback('fetchUserInfo'));
            } catch (error) {
                throw new Error(error.message, { cause: error });
            }
        });

        const makeRetryCallback = (action) => {
            return (attempt, maxAttempts) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('yandex-api:retry-attempt', {
                        attempt,
                        maxAttempts,
                        message: `Попытка повторного подключения ${attempt} из ${maxAttempts}...`
                    });
                }
                console.log(`${action}: повторная попытка ${attempt}/${maxAttempts}...`);
            };
        };

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

        ipcMain.handle('yandex-api:getQuasarCameraDevice', async (event, deviceId) => {
            try {
                const xToken = await getStoredXToken();
                if (!xToken) {
                    throw new Error('X_TOKEN_REQUIRED');
                }
                return await yandexApi.getQuasarCameraDevice(xToken, deviceId, makeRetryCallback('getQuasarCameraDevice'));
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

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}