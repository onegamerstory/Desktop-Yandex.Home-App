import React, { useEffect, useCallback } from 'react';
import { TokenInput } from './components/TokenInput';
import { Dashboard } from './components/Dashboard';
import { UpdateNotificationModal } from './components/modals/UpdateNotificationModal';
import { QrAuthModal } from './components/modals/QrAuthModal';
import { fetchUserInfo } from './services/yandexIoT';
import { AppState, YandexUserInfoResponse, YandexDevice, YandexScenario, TrayMenuItem, TrayItemType, YandexHousehold } from './types/index';
import { formatSensorValueForTray, TraySensorDisplayConfig } from './constants';
import { stableSortData } from './utils/dataUtils';
import { cleanErrorMessage } from './utils/errors';
import { NotificationToast } from './components/NotificationToast';
import { ThemeProvider } from './contexts/ThemeContext';
import DashboardContext from './contexts/DashboardContext';
import { useNotification, useAuth, useFavorites, useNavigation, useUpdateNotification,
         useCameraAuth, useYandexData, useDeviceActions, useHousehold, useAutostart } from './hooks';
import packageJson from '../package.json';

const yandexApi = window.api;

function App() {
    // --- Хуки (порядок важен для зависимостей) ---
    // 1. Нет зависимостей
    const { notification, showNotification, clearNotification } = useNotification();
    const { token, setToken, appState, setAppState, errorMsg, retryInfo, setErrorMsg } = useAuth();
    const { favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds, toggleFavorite, isFavorite } = useFavorites();
    const { activeSidebarView, activeRoomId, activeGroupId, onSelectHome, onSelectRoom, onSelectGroup } = useNavigation();
    const { showUpdateNotification, setShowUpdateNotification, updateInfo } = useUpdateNotification();

    // 2. Зависит от showNotification
    const cameraAuth = useCameraAuth(showNotification);
    const { showQrAuth, promptXTokenIfNeeded, requestXTokenAuth, handleQrAuthSuccess, handleQrAuthClose } = cameraAuth;

    // 3. Зависит от (showNotification, token, appState, setAppState, setToken, promptXTokenIfNeeded)
    const yandexData = useYandexData(showNotification, token, appState, setAppState, setToken, promptXTokenIfNeeded);
    const { userData, isRefreshing, refreshDashboardData, setUserData } = yandexData;

    // 4. Зависит от userData, token, refreshDashboardData, requestXTokenAuth
    const actions = useDeviceActions(token, userData, showNotification, refreshDashboardData, requestXTokenAuth);
    const { handleToggleDevice, handleToggleGroup, handleExecuteScenario,
            handleSetDeviceMode, handleGetCameraStream, handleSetCameraPrivacy } = actions;
    const household = useHousehold(userData, token, refreshDashboardData);
    const { activeHouseholdId, handleSwitchHousehold } = household;

    // 5. Зависит от showNotification
    const { isAutostartEnabled, handleToggleAutostart } = useAutostart(showNotification);

    // --- Колбэки для связывания хуков ---

    const handleLoadData = useCallback(async (apiToken: string) => {
        setAppState(AppState.LOADING);
        setErrorMsg(undefined);
        try {
            const data = await fetchUserInfo(apiToken);
            const sortedData = stableSortData(data);
            setUserData(sortedData);
            setAppState(AppState.DASHBOARD);
            await promptXTokenIfNeeded(sortedData);
        } catch (err) {
            setErrorMsg(cleanErrorMessage(err));
            setAppState(AppState.AUTH);
            if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
                await yandexApi.deleteSecureToken();
                setToken(null);
            }
        }
    }, [setUserData, setAppState, setErrorMsg, setToken, promptXTokenIfNeeded]);

    const handleTokenSubmit = useCallback(async (newToken: string) => {
        setToken(newToken);
        await yandexApi.setSecureToken(newToken);
        await handleLoadData(newToken);
    }, [setToken, handleLoadData]);

    const handleLogout = useCallback(async () => {
        await yandexApi.deleteSecureToken();
        setToken(null);
        setUserData(null);
        setErrorMsg(undefined);
        setAppState(AppState.AUTH);
    }, [setToken, setUserData, setErrorMsg, setAppState]);

    const handleCancelRetry = useCallback(async () => {
        await yandexApi.deleteSecureToken();
        setToken(null);
        setUserData(null);
        setErrorMsg(undefined);
        setAppState(AppState.AUTH);
    }, [setToken, setUserData, setErrorMsg, setAppState]);

    // --- 1. Init-эффект (проверка токена при запуске) ---
    useEffect(() => {
        const checkToken = async () => {
            setAppState(AppState.LOADING);
            const storedToken = await yandexApi.getSecureToken();
            if (storedToken) {
                setToken(storedToken);
                await handleLoadData(storedToken);
            } else {
                setErrorMsg(undefined);
                setAppState(AppState.AUTH);
            }
        };
        checkToken();
    }, [handleLoadData]);

    // --- 2. Вспомогательная функция для подготовки данных для трея ---
    const getTrayMenuItems = useCallback((
        data: YandexUserInfoResponse | null,
        favDevices: string[],
        favScenarios: string[],
        householdId: string | null
    ): TrayMenuItem[] => {
        if (!data) return [];

        // Load user's sensor display config from localStorage (same key pattern as useDashboardState)
        let sensorDisplayConfig: Record<string, TraySensorDisplayConfig> = {};
        try {
            const storageKey = householdId
                ? `dashboard:sensorDisplayConfig:household:${householdId}`
                : 'dashboard:sensorDisplayConfig';
            const stored = localStorage.getItem(storageKey);
            if (stored) sensorDisplayConfig = JSON.parse(stored);
        } catch { /* ignore */ }

        const deviceMap = new Map(data.devices.map(d => [d.id, d]));
        const scenarioMap = new Map(data.scenarios.map(s => [s.id, s]));

        // 1. Избранные устройства
        const favDeviceItems: TrayMenuItem[] = favDevices
            .map(id => deviceMap.get(id))
            .filter((d): d is YandexDevice => !!d)
            .map(device => {
                const onOffCapability = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
                const isToggleable = !!onOffCapability;

                // Check if this is a sensor, smart meter, air conditioner, or kettle device
                // These devices have temperature/humidity properties to display
                const deviceType = device.type.toLowerCase();
                const isSensorOrMeter = deviceType.includes('sensor') || deviceType.includes('smart_meter');
                const isClimateDevice = deviceType.includes('thermostat') || deviceType.includes('kettle');

                // Calculate sensor value for devices that have temperature/humidity properties
                let sensorValue: string | null = null;
                if ((isSensorOrMeter && !isToggleable) || isClimateDevice) {
                    const deviceConfig = sensorDisplayConfig[device.id] ?? null;
                    sensorValue = formatSensorValueForTray(device, deviceConfig);
                }

                return {
                    id: device.id,
                    name: device.name,
                    type: 'device' as TrayItemType,
                    isToggleable: isToggleable,
                    isOn: onOffCapability?.state?.value === true,
                    sensorValue: sensorValue,
                };
            });

        // 2. Избранные сценарии
        const favScenarioItems: TrayMenuItem[] = favScenarios
            .map(id => scenarioMap.get(id))
            .filter((s): s is YandexScenario => !!s)
            .map(scenario => ({
                id: scenario.id,
                name: scenario.name,
                type: 'scenario' as TrayItemType,
            }));

        return [...favDeviceItems, ...favScenarioItems];
    }, []);

    // --- 3. Tray-эффект (отправка избранного в трей) ---
    useEffect(() => {
        if (appState === AppState.DASHBOARD && userData) {
            const trayItems = getTrayMenuItems(userData, favoriteDeviceIds, favoriteScenarioIds, activeHouseholdId);
            yandexApi.sendFavoritesToTray(trayItems);
        }
    }, [appState, userData, favoriteDeviceIds, favoriteScenarioIds, activeHouseholdId, getTrayMenuItems]);

    // --- 4. Tray-эффект (обработка команд из трея) ---
    useEffect(() => {
        yandexApi.onTrayCommand((command: string, id: string, currentState: boolean | undefined) => {
            if (command === 'TOGGLE_DEVICE' && typeof currentState === 'boolean') {
                handleToggleDevice(id, currentState).catch(() => {});
            } else if (command === 'EXECUTE_SCENARIO') {
                handleExecuteScenario(id).catch(() => {});
            }
        });
        return () => { yandexApi.removeTrayCommandListener(); };
    }, [handleToggleDevice, handleExecuteScenario, token]);

    // --- 5. Polling-эффект (автосинхронизация) ---
    useEffect(() => {
        if (appState !== AppState.DASHBOARD || !token) return;
        const POLLING_INTERVAL = 120000;
        const pollingInterval = setInterval(() => {
            refreshDashboardData(token, true).catch(err => {
                console.error('Polling sync error:', err);
            });
        }, POLLING_INTERVAL);
        return () => { clearInterval(pollingInterval); };
    }, [appState, token, refreshDashboardData]);

    // --- Рендеринг ---

    // Экран загрузки
    if (appState === AppState.LOADING) {
        return (
            <ThemeProvider>
                <div className="min-h-screen flex items-center justify-center bg-transparent">
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-white/70 animate-pulse">
                            {retryInfo ? retryInfo.message : 'Загрузка данных...'}
                        </p>
                        {retryInfo && (
                            <>
                                <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                                    Нет соединения. Приложение пытается подключиться...<br/>
                                    Попытка {retryInfo.attempt} из {retryInfo.maxAttempts}
                                </p>
                                <button
                                    onClick={handleCancelRetry}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg transition-colors font-medium text-sm"
                                >
                                    Отменить
                                </button>
                            </>
                        )}
                    </div>
                    <NotificationToast notification={notification} onClose={clearNotification} />
                </div>
            </ThemeProvider>
        );
    }

    // Основная панель
    if (appState === AppState.DASHBOARD && userData) {
        return (
            <ThemeProvider>
                <DashboardContext.Provider value={{
                    data: userData,
                    households: userData.households as YandexHousehold[],
                    activeHouseholdId,
                    favoriteDeviceIds,
                    favoriteScenarioIds,
                    favoriteGroupIds,
                    onToggleDeviceFavorite: (id: string) => toggleFavorite('device', id),
                    onToggleScenarioFavorite: (id: string) => toggleFavorite('scenario', id),
                    onToggleGroupFavorite: (id: string) => toggleFavorite('group', id),
                    onToggleDevice: handleToggleDevice,
                    onToggleGroup: handleToggleGroup,
                    onExecuteScenario: handleExecuteScenario,
                    onSetDeviceMode: handleSetDeviceMode,
                    onGetCameraStream: handleGetCameraStream,
                    onSetCameraPrivacy: handleSetCameraPrivacy,
                    onRefresh: () => token && refreshDashboardData(token),
                    activeSidebarView,
                    activeRoomId,
                    activeGroupId,
                    onSelectHome,
                    onSelectRoom,
                    onSelectGroup,
                    isRefreshing,
                    isAutostartEnabled,
                    onToggleAutostart: handleToggleAutostart,
                    onSwitchHousehold: handleSwitchHousehold,
                    onLogout: handleLogout,
                }}>
                    <Dashboard />
                </DashboardContext.Provider>
                {updateInfo && (
                    <UpdateNotificationModal
                        isOpen={showUpdateNotification}
                        onClose={() => setShowUpdateNotification(false)}
                        currentVersion={packageJson.version}
                        latestVersion={updateInfo.latestVersion}
                        releaseUrl={updateInfo.releaseUrl}
                        releaseDate={updateInfo.releaseDate}
                    />
                )}
                <QrAuthModal
                    isOpen={showQrAuth}
                    onClose={handleQrAuthClose}
                    onSuccess={handleQrAuthSuccess}
                />
                <NotificationToast notification={notification} onClose={clearNotification} />
            </ThemeProvider>
        );
    }

    // Экран авторизации (по умолчанию)
    return (
        <ThemeProvider>
            <TokenInput
                onTokenSubmit={handleTokenSubmit}
                isLoading={false}
                error={errorMsg}
            />
            <NotificationToast notification={notification} onClose={clearNotification} />
        </ThemeProvider>
    );
}

export default App;
