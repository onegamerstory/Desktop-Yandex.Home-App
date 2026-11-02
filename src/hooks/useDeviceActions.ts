import { useCallback } from 'react';
import { toggleDevice, toggleGroup, executeScenario, setDeviceMode, getCameraStream, setCameraPrivacyMode } from '../services/yandexIoT';
import { YandexUserInfoResponse, YandexModeAction, CameraStreamResult } from '../types/index';
import { cleanErrorMessage } from '../utils/errors';
import { LightActionRequest } from '../utils/deviceActions';

interface UseDeviceActionsReturn {
    handleToggleDevice: (deviceId: string, currentState: boolean) => Promise<void>;
    handleToggleGroup: (groupId: string, currentState: boolean) => Promise<void>;
    handleExecuteScenario: (scenarioId: string) => Promise<void>;
    handleSetDeviceMode: (deviceId: string, actions: YandexModeAction[], turnOn?: boolean) => Promise<void>;
    handleSetLightSettings: (requests: LightActionRequest[], turnOn?: boolean) => Promise<void>;
    handleGetCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    handleSetCameraPrivacy: (deviceId: string, enabled: boolean, instance?: string) => Promise<void>;
}

export function useDeviceActions(
    token: string | null,
    userData: YandexUserInfoResponse | null,
    showNotification: (message: string, type?: 'error' | 'success') => void,
    refreshDashboardData: (apiToken: string, silent?: boolean) => Promise<void>,
    requestXTokenAuth: () => Promise<boolean>
): UseDeviceActionsReturn {
    const handleToggleDevice = useCallback(async (deviceId: string, currentState: boolean) => {
        if (!token || !userData) return;
        const newState = !currentState;
        try {
            await toggleDevice(token, deviceId, newState);
            // Оптимистичное обновление делает setUserData, но у нас нет доступа к setUserData здесь
            // Пока оставим refreshDashboardData
            refreshDashboardData(token);
        } catch (err) {
            showNotification(`Ошибка: ${cleanErrorMessage(err)}`, 'error');
            throw err;
        }
    }, [token, userData, refreshDashboardData, showNotification]);

    const handleToggleGroup = useCallback(async (groupId: string, currentState: boolean) => {
        if (!token || !userData) return;
        const newState = !currentState;
        const group = userData.groups.find(g => g.id === groupId);
        const deviceIds = group?.devices || [];
        try {
            await toggleGroup(token, groupId, deviceIds, newState);
            refreshDashboardData(token);
            showNotification('Группа успешно переключена', 'success');
        } catch (err) {
            showNotification(`Ошибка: ${cleanErrorMessage(err)}`, 'error');
            throw err;
        }
    }, [token, userData, refreshDashboardData, showNotification]);

    const handleExecuteScenario = useCallback(async (scenarioId: string) => {
        if (!token) return;
        try {
            await executeScenario(token, scenarioId);
            showNotification('Сценарий успешно запущен', 'success');
            refreshDashboardData(token);
        } catch (err) {
            showNotification(`Ошибка: ${cleanErrorMessage(err)}`, 'error');
            throw err;
        }
    }, [token, refreshDashboardData, showNotification]);

    const handleSetDeviceMode = useCallback(async (deviceId: string, modeActions: YandexModeAction[], turnOn: boolean = false) => {
        if (!token) return;
        try {
            await setDeviceMode(token, deviceId, modeActions, turnOn);
            showNotification('Настройки успешно применены', 'success');
            refreshDashboardData(token);
        } catch (err) {
            showNotification(`Ошибка: ${cleanErrorMessage(err)}`, 'error');
            throw err;
        }
    }, [token, refreshDashboardData, showNotification]);

    const handleSetLightSettings = useCallback(async (requests: LightActionRequest[], turnOn: boolean = false) => {
        if (!token) return;

        const validRequests = requests
            .map(request => ({
                ...request,
                actionGroups: request.actionGroups.filter(actions => actions.length > 0),
            }))
            .filter(request => request.actionGroups.length > 0);

        if (validRequests.length === 0) return;

        const results = await Promise.allSettled(validRequests.map(async ({ deviceId, actionGroups }) => {
            for (const [index, actions] of actionGroups.entries()) {
                await setDeviceMode(token, deviceId, actions, turnOn && index === 0);
            }
        }));

        const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failure) {
            showNotification(`Ошибка: ${cleanErrorMessage(failure.reason)}`, 'error');
            void refreshDashboardData(token, true);
            throw failure.reason;
        }

        showNotification('Настройки успешно применены', 'success');
        void refreshDashboardData(token, true);
    }, [token, refreshDashboardData, showNotification]);

    const handleGetCameraStream = useCallback(async (deviceId: string) => {
        const isXTokenError = (message: string) =>
            message.includes('X_TOKEN_REQUIRED')
            || message.includes('Quasar auth')
            || message.includes('x-token');
        try {
            return await getCameraStream(deviceId);
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            if (isXTokenError(message)) {
                const authenticated = await requestXTokenAuth();
                if (authenticated) {
                    return getCameraStream(deviceId);
                }
                throw new Error('Требуется вход по QR для просмотра камер');
            }
            throw err;
        }
    }, [requestXTokenAuth]);

    const handleSetCameraPrivacy = useCallback(async (deviceId: string, privacyEnabled: boolean, toggleInstance?: string) => {
        await setCameraPrivacyMode(deviceId, privacyEnabled, toggleInstance);
    }, []);

    return {
        handleToggleDevice, handleToggleGroup, handleExecuteScenario,
        handleSetDeviceMode, handleSetLightSettings, handleGetCameraStream, handleSetCameraPrivacy,
    };
}
