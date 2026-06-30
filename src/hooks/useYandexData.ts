import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchUserInfo } from '../services/yandexIoT';
import { YandexUserInfoResponse, AppState } from '../types/index';
import { hasDeviceStateChanges, stableSortData } from '../utils/dataUtils';

const yandexApi = window.api;

interface UseYandexDataReturn {
    userData: YandexUserInfoResponse | null;
    isRefreshing: boolean;
    refreshDashboardData: (apiToken: string, silent?: boolean) => Promise<void>;
    userDataRef: React.MutableRefObject<YandexUserInfoResponse | null>;
    setUserData: React.Dispatch<React.SetStateAction<YandexUserInfoResponse | null>>;
}

export function useYandexData(
    showNotification: (message: string, type?: 'error' | 'success') => void,
    token: string | null,
    appState: AppState,
    setAppState: React.Dispatch<React.SetStateAction<AppState>>,
    setToken: React.Dispatch<React.SetStateAction<string | null>>,
    promptXTokenIfNeeded: (data: YandexUserInfoResponse) => Promise<void>
): UseYandexDataReturn {
    const [userData, setUserData] = useState<YandexUserInfoResponse | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const userDataRef = useRef(userData);
    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

    const refreshDashboardData = useCallback(async (apiToken: string, silent: boolean = false) => {
        if (!silent) {
            setIsRefreshing(true);
        }
        try {
            const data = await fetchUserInfo(apiToken);
            const sortedData = stableSortData(data);
            const hasChanges = hasDeviceStateChanges(userDataRef.current, sortedData);
            setUserData(sortedData);

            if (!silent) {
                showNotification('Данные успешно обновлены.', 'success');
            } else if (hasChanges) {
                console.log('Device states synchronized from external changes');
            }
        } catch (err: unknown) {
            if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
                await yandexApi.deleteSecureToken();
                setToken(null);
                setUserData(null);
                setAppState(AppState.AUTH);
                showNotification('Сессия истекла. Пожалуйста, введите токен заново.', 'error');
            } else if (!silent) {
                showNotification('Ошибка обновления данных.', 'error');
            } else {
                console.error('Silent sync error:', err);
            }
        } finally {
            if (!silent) {
                setIsRefreshing(false);
            }
        }
    }, [showNotification, setToken, setAppState]);

    return { userData, isRefreshing, refreshDashboardData, userDataRef, setUserData };
}
