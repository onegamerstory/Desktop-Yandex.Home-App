// main.js

import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron'; // <-- Добавлен Menu, Tray
import path from 'path';
import { fileURLToPath } from 'url';
// Импорт yandex-api.js
import * as yandexApi from './yandex-api.js'; 
import keytar from 'keytar';

// Установка __dirname и __filename для ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_NAME = 'SmartHomeControlApp'; 
const ACCOUNT_NAME = 'YandexToken';

let mainWindow = null;
let appTray = null; // Переменная для хранения экземпляра Tray
let favoritesData = []; // Данные избранных устройств/сценариев

// --- 1. Обработка закрытия окна (свернуть в трей) ---
const minimizeToTray = (event) => {
	// Если пользователь нажимает крестик, сворачиваем в трей (на macOS окно может скрыться/закрыться само)
	if (appTray && mainWindow && process.platform !== 'darwin') {
		event.preventDefault(); // Предотвращаем закрытие
		mainWindow.hide();      // Скрываем окно
	}
};

// Функция для создания Tray
function createTray() {
    // В режиме разработки используем заглушку
    const iconPath = path.join(__dirname, process.env.NODE_ENV === 'development' ? 'resources/icon.png' : 'resources/icon.png');
    // Используем системную иконку или заглушку (для кроссплатформенности)
    const fallbackIconPath = path.join(__dirname, 'electron.png'); // Предполагаем наличие electron.png в корне dist/
    
    // Используем fallback, если иконка не найдена, или просто строку, которая работает
    try {
        appTray = new Tray(iconPath);
    } catch (e) {
        console.warn(`Tray icon not found at ${iconPath}. Falling back.`);
        // На Windows можно использовать иконки из DLL, но для кроссплатформенности проще использовать заглушку
        appTray = new Tray(fallbackIconPath);
    }
    
    appTray.setToolTip('Управление Умным Домом Яндекс');
    
    // Устанавливаем обработчик клика для открытия окна
    appTray.on('click', () => {
        if (mainWindow) {
            mainWindow.show();
        } else {
            createWindow();
        }
    });

    // Обновляем контекстное меню сразу после создания
    updateTrayMenu();
}

// Функция для создания контекстного меню Tray
function updateTrayMenu() {
    if (!appTray) return;

    // --- Динамическая секция избранных элементов ---
    const favoriteMenuItems = favoritesData.map(item => {
        const isDevice = item.type === 'device';
        const isToggleableDevice = isDevice && item.isToggleable;
        
        // Для устройств отображаем статус или значение сенсора
        let deviceStatus = '';
        if (isDevice) {
            // Если есть sensorValue (для сенсоров и счётчиков), показываем его вместо цветового индикатора
            if (item.sensorValue) {
                deviceStatus = ` ${item.sensorValue}`;
            } else if (isToggleableDevice) {
                // Для переключаемых устройств показываем цветовой индикатор
                deviceStatus = item.isOn
                    ? ' 🟢' // Зеленый кружок для "Вкл" (включено)
                    : ' 🔴'; // Красный кружок для "Выкл" (выключено)
            }
        }
        const label = `${item.name}${deviceStatus}`;
        
        // Определяем действие при клике
        let clickAction = null;

        if (isToggleableDevice) {
            // Отправляем команду TOGGLE_DEVICE в React-приложение
            clickAction = () => {
                if (mainWindow) {
                    mainWindow.webContents.send('tray:execute-command', 'TOGGLE_DEVICE', item.id, item.isOn);
                }
            };
        } else if (item.type === 'scenario') {
            // Отправляем команду EXECUTE_SCENARIO в React-приложение
             clickAction = () => {
                if (mainWindow) {
                    mainWindow.webContents.send('tray:execute-command', 'EXECUTE_SCENARIO', item.id);
                }
            };
        }
        
        return {
            label: label,
            type: 'normal',
            enabled: !!clickAction, // Отключаем, если нет действия
            click: clickAction,
        };
    });

    // --- Основное меню ---
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Открыть приложение', 
            click: () => mainWindow ? mainWindow.show() : createWindow()
        },
        // Разделитель перед динамической секцией, если она не пуста
        ...(favoriteMenuItems.length > 0 ? [{ type: 'separator' }] : []), 
        
        // Динамическая секция
        ...favoriteMenuItems,
        
        // Разделитель перед "Выход"
        { type: 'separator' },
        { 
            label: 'Выход', 
            click: () => {
                // Удаляем слушатель 'close', чтобы гарантированно закрыть приложение
                if (mainWindow) {
                    mainWindow.removeListener('close', minimizeToTray);
                }
                app.quit();
            }
        },
    ]);

    appTray.setContextMenu(contextMenu);
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
    
    // Обработка восстановления из трея
    mainWindow.on('restore', () => {
        mainWindow.show();
    });


     // В режиме разработки загружаем URL-адрес сервера Vite
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173'); 
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
}

// --- Single Instance Lock: предотвращаем запуск нескольких экземпляров ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // Если другой экземпляр уже запущен, закрываем этот
    app.quit();
} else {
    // Обработчик для случая, когда пользователь пытается запустить второй экземпляр
    app.on('second-instance', () => {
        // Если окно существует, показываем и фокусируем его
        if (mainWindow) {
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

    // Когда Electron готов
    app.whenReady().then(() => {
        Menu.setApplicationMenu(null);

        createWindow();
        createTray(); // Создаем Tray
        
        ipcMain.handle('yandex-api:fetchUserInfo', async (event, token) => {
            try {
                return await yandexApi.fetchUserInfo(token);
            } catch (error) {
                throw new Error(error.message); 
            }
        });

        ipcMain.handle('yandex-api:executeScenario', async (event, token, scenarioId) => {
            try {
                return await yandexApi.executeScenario(token, scenarioId);
            } catch (error) {
                throw new Error(error.message);
            }
        });

        ipcMain.handle('yandex-api:toggleDevice', async (event, token, deviceId, newState) => {
            try {
                return await yandexApi.toggleDevice(token, deviceId, newState);
            } catch (error) {
                throw new Error(error.message);
            }
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
            // Удаляет токен из системного хранилища
            await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
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