import { useState, useCallback, useRef, useEffect } from 'react';

const yandexApi = window.api;

interface UseAutostartReturn {
    isAutostartEnabled: boolean;
    handleToggleAutostart: () => void;
}

export function useAutostart(
    showNotification: (message: string, type?: 'error' | 'success') => void
): UseAutostartReturn {
    const [isAutostartEnabled, setIsAutostartEnabled] = useState<boolean>(false);
    const autostartStateRef = useRef(isAutostartEnabled);

    // Load initial autostart state from OS
    useEffect(() => {
        yandexApi.isAutostartEnabled().then(setIsAutostartEnabled).catch(console.error);
    }, []);

    useEffect(() => {
        autostartStateRef.current = isAutostartEnabled;
    }, [isAutostartEnabled]);

    const handleToggleAutostart = useCallback(async () => {
        try {
            const newState = !autostartStateRef.current;
            await yandexApi.setAutostartEnabled(newState);
            setIsAutostartEnabled(newState);
            showNotification(
                newState
                    ? 'Автозапуск включен. Приложение будет запускаться вместе с системой.'
                    : 'Автозапуск выключен. Приложение будет запускаться только вручную.',
                'success'
            );
        } catch (error) {
            console.error('Ошибка при изменении автозапуска:', error);
            showNotification('Не удалось изменить настройки автозапуска', 'error');
        }
    }, [showNotification]);

    return { isAutostartEnabled, handleToggleAutostart };
}
