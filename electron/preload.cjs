// preload.cjs

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    fetchUserInfo: (token, options) => ipcRenderer.invoke('yandex-api:fetchUserInfo', token, options),
    executeScenario: (token, scenarioId) => ipcRenderer.invoke('yandex-api:executeScenario', token, scenarioId),
    toggleDevice: (token, deviceId, newState) => ipcRenderer.invoke('yandex-api:toggleDevice', token, deviceId, newState),
    toggleGroup: (token, groupId, deviceIds, newState) => ipcRenderer.invoke('yandex-api:toggleGroup', token, groupId, deviceIds, newState),
    setDeviceMode: (token, deviceId, modeActions, turnOn) => ipcRenderer.invoke('yandex-api:setDeviceMode', token, deviceId, modeActions, turnOn),
    fetchDevice: (token, deviceId) => ipcRenderer.invoke('yandex-api:fetchDevice', token, deviceId),
    getCameraStream: (deviceId) => ipcRenderer.invoke('yandex-api:getCameraStream', deviceId),
    setCameraPrivacyMode: (deviceId, privacyEnabled, toggleInstance) =>
        ipcRenderer.invoke('yandex-api:setCameraPrivacyMode', deviceId, privacyEnabled, toggleInstance),
    getQuasarCameraDevice: (deviceId, options) => ipcRenderer.invoke('yandex-api:getQuasarCameraDevice', deviceId, options),

    hasXToken: () => ipcRenderer.invoke('yandex-auth:hasXToken'),
    startQrAuth: () => ipcRenderer.invoke('yandex-auth:startQr'),
    pollQrAuth: () => ipcRenderer.invoke('yandex-auth:pollQr'),
    cancelQrAuth: () => ipcRenderer.invoke('yandex-auth:cancelQr'),
    
    // Запрашивает токен из Keytar
    getSecureToken: () => ipcRenderer.invoke('secure:getToken'), 
    // Сохраняет токен в Keytar
    setSecureToken: (token) => ipcRenderer.invoke('secure:setToken', token),
    // Удаляет токен из Keytar
    deleteSecureToken: () => ipcRenderer.invoke('secure:deleteToken'),
    
    // Auto-launch methods
    isAutostartEnabled: () => ipcRenderer.invoke('autostart:isEnabled'),
    setAutostartEnabled: (enabled) => ipcRenderer.invoke('autostart:setEnabled', enabled), 

    registerGlobalShortcuts: (shortcuts) => ipcRenderer.invoke('shortcuts:register-global', shortcuts),
    downloadLatestUpdate: (version, requestId) => ipcRenderer.invoke('updates:download-latest', version, requestId),
    onUpdateDownloadProgress: (requestId, callback) => {
        const handler = (_event, progress) => {
            if (progress.requestId === requestId) {
                callback(progress);
            }
        };
        ipcRenderer.on('updates:download-progress', handler);
        return () => ipcRenderer.removeListener('updates:download-progress', handler);
    },
    showDownloadedUpdate: (updateId) => ipcRenderer.invoke('updates:show-downloaded', updateId),
    installDownloadedUpdate: (updateId) => ipcRenderer.invoke('updates:install-downloaded', updateId),
    onGlobalShortcut: (callback) => {
        const handler = (_event, shortcutId) => callback(shortcutId);
        ipcRenderer.on('shortcuts:trigger', handler);
        return () => ipcRenderer.removeListener('shortcuts:trigger', handler);
    },
	
    // Отправка данных избранного из рендерера в главный процесс
    sendFavoritesToTray: (favorites) => ipcRenderer.send('tray:update-favorites', favorites),
    
    // Прослушивание команд из трея (главный процесс -> рендерер)
    onTrayCommand: (callback) => {
        ipcRenderer.on('tray:execute-command', (event, command, id, currentState) => {
            callback(command, id, currentState);
        });
    },
    removeTrayCommandListener: () => {
        // Очистка слушателей при размонтировании компонента App
        ipcRenderer.removeAllListeners('tray:execute-command');
    },
    
    // Прослушивание событий повторных попыток подключения (retry)
    onRetryAttempt: (callback) => {
        const handler = (event, data) => {
            callback(data);
        };
        ipcRenderer.on('yandex-api:retry-attempt', handler);
        // Возвращаем функцию для отписки
        return () => ipcRenderer.removeListener('yandex-api:retry-attempt', handler);
    },

    showCameraStreamErrorNotification: (payload) =>
        ipcRenderer.invoke('notification:camera-stream-error', payload),
    onCameraStreamRetry: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('camera-stream:retry', handler);
        return () => ipcRenderer.removeListener('camera-stream:retry', handler);
    },
});