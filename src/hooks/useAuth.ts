import { useState, useCallback, useEffect } from 'react';
import { fetchUserInfo } from '../services/yandexIoT';
import { AppState, YandexUserInfoResponse } from '../types/index';
import { stableSortData } from '../utils/dataUtils';

const yandexApi = window.api;

interface RetryInfo {
    attempt: number;
    maxAttempts: number;
    message: string;
}

interface UseAuthReturn {
    token: string | null;
    setToken: React.Dispatch<React.SetStateAction<string | null>>;
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    errorMsg: string | undefined;
    retryInfo: RetryInfo | null;
    loadData: (apiToken: string) => Promise<void>;
    handleLogout: () => Promise<void>;
    handleCancelRetry: () => Promise<void>;
    handleTokenSubmit: (newToken: string) => Promise<void>;
    setUserData: React.Dispatch<React.SetStateAction<YandexUserInfoResponse | null>>;
    setErrorMsg: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export function useAuth(): UseAuthReturn {
    const [token, setToken] = useState<string | null>(null);
    const [appState, setAppState] = useState<AppState>(AppState.LOADING);
    const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
    const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null);
    const [userData, setUserData] = useState<YandexUserInfoResponse | null>(null);

    const loadData = useCallback(async (apiToken: string) => {
        setAppState(AppState.LOADING);
        setErrorMsg(undefined);
        try {
            const data = await fetchUserInfo(apiToken);
            const sortedData = stableSortData(data);
            setUserData(sortedData);
            setAppState(AppState.DASHBOARD);
            // promptXTokenIfNeeded будет вызываться из useYandexData
        } catch (err: unknown) {
            if (err instanceof Error) {
                setErrorMsg(err.message);
            } else {
                setErrorMsg('Неизвестная ошибка');
            }
            setAppState(AppState.AUTH);
            if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
                await yandexApi.deleteSecureToken();
                setToken(null);
            }
        }
    }, []);

    const handleLogout = useCallback(async () => {
        await yandexApi.deleteSecureToken();
        setToken(null);
        setUserData(null);
        setAppState(AppState.AUTH);
        setErrorMsg(undefined);
    }, []);

    const handleCancelRetry = useCallback(async () => {
        await yandexApi.deleteSecureToken();
        setToken(null);
        setUserData(null);
        setRetryInfo(null);
        setAppState(AppState.AUTH);
        setErrorMsg('Подключение отменено. Пожалуйста, авторизуйтесь снова.');
    }, []);

    const handleTokenSubmit = useCallback(async (newToken: string) => {
        setToken(newToken);
        await yandexApi.setSecureToken(newToken);
        await loadData(newToken);
    }, [loadData]);

    // Effect: listen for retry attempts
    useEffect(() => {
        if (!window.api?.onRetryAttempt) return;
        const unsubscribe = window.api.onRetryAttempt((data: RetryInfo) => {
            setRetryInfo(data);
        });
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    return {
        token, setToken, appState, setAppState, errorMsg, retryInfo,
        loadData, handleLogout, handleCancelRetry, handleTokenSubmit,
        setUserData, setErrorMsg,
    };
}
