// preload.cjs

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // ... (Существующие функции API)
    fetchUserInfo: (token) => ipcRenderer.invoke('yandex-api:fetchUserInfo', token),
    executeScenario: (token, scenarioId) => ipcRenderer.invoke('yandex-api:executeScenario', token, scenarioId),
    toggleDevice: (token, deviceId, newState) => ipcRenderer.invoke('yandex-api:toggleDevice', token, deviceId, newState),
    toggleGroup: (token, groupId, newState) => ipcRenderer.invoke('yandex-api:toggleGroup', token, groupId, newState),
    setDeviceMode: (token, deviceId, modeActions, turnOn) => ipcRenderer.invoke('yandex-api:setDeviceMode', token, deviceId, modeActions, turnOn),
    fetchDevice: (token, deviceId) => ipcRenderer.invoke('yandex-api:fetchDevice', token, deviceId),
    
    // Запрашивает токен из Keytar
    getSecureToken: () => ipcRenderer.invoke('secure:getToken'), 
    // Сохраняет токен в Keytar
    setSecureToken: (token) => ipcRenderer.invoke('secure:setToken', token),
    // Удаляет токен из Keytar
    deleteSecureToken: () => ipcRenderer.invoke('secure:deleteToken'),
    
    // Auto-launch methods
    isAutostartEnabled: () => ipcRenderer.invoke('autostart:isEnabled'),
    setAutostartEnabled: (enabled) => ipcRenderer.invoke('autostart:setEnabled', enabled), 
	
	 // --- НОВЫЙ IPC ДЛЯ ТРЕЯ ---
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
    }
});