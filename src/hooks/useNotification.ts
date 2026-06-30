import { useState, useCallback } from 'react';

interface UseNotificationReturn {
    notification: { message: string; type: 'error' | 'success' } | null;
    showNotification: (message: string, type?: 'error' | 'success') => void;
    clearNotification: () => void;
}

export function useNotification(): UseNotificationReturn {
    const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    const showNotification = useCallback((message: string, type: 'error' | 'success' = 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    }, []);

    const clearNotification = useCallback(() => {
        setNotification(null);
    }, []);

    return { notification, showNotification, clearNotification };
}
