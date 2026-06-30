import React from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface NotificationToastProps {
    notification: { message: string; type: 'error' | 'success' } | null;
    onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = React.memo(({ notification, onClose }) => {
    if (!notification) return null;
    return (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white dark:bg-surface/90 dark:backdrop-blur-xl border-gray-200/80 dark:border-border-soft ${notification.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {notification.type === 'error'
                ? <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                : <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            }
            <span className="text-sm font-medium">{notification.message}</span>
            <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 dark:text-muted dark:hover:text-card-fg transition-colors">
                <X className="w-4 h-4"/>
            </button>
        </div>
    );
});
