import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, QrCode, X, Smartphone } from 'lucide-react';

interface QrAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

const POLL_INTERVAL_MS = 2000;

export const QrAuthModal: React.FC<QrAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Вход для камер',
  description = 'Отсканируйте QR-код приложением Яндекс или Яндекс.Ключ — это нужно один раз для доступа к видеопотоку.',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const handleClose = useCallback(() => {
    stopPolling();
    window.api?.cancelQrAuth();
    onClose();
  }, [onClose, stopPolling]);

  const pollOnce = useCallback(async () => {
    try {
      const result = await window.api.pollQrAuth();
      if (result.status === 'ok') {
        stopPolling();
        onSuccess();
        return;
      }
      if (result.status === 'error') {
        stopPolling();
        setError(result.message);
      }
    } catch (err) {
      stopPolling();
      setError(err instanceof Error ? err.message : 'Ошибка проверки QR-входа');
    }
  }, [onSuccess, stopPolling]);

  const startAuth = useCallback(async () => {
    stopPolling();
    setIsStarting(true);
    setError(null);
    setQrDataUrl(null);
    setQrUrl(null);

    try {
      await window.api.cancelQrAuth();
      const { qrDataUrl: dataUrl, qrUrl: url } = await window.api.startQrAuth();
      setQrDataUrl(dataUrl);
      setQrUrl(url);
      setIsPolling(true);
      pollTimerRef.current = setInterval(() => {
        pollOnce();
      }, POLL_INTERVAL_MS);
      pollOnce();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось начать QR-авторизацию');
    } finally {
      setIsStarting(false);
    }
  }, [pollOnce, stopPolling]);

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      return;
    }

    startAuth();

    return () => {
      stopPolling();
      window.api?.cancelQrAuth();
    };
  }, [isOpen, startAuth, stopPolling]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-50 dark:bg-primary/20 text-purple-600 dark:text-primary">
              <QrCode className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">{description}</p>

          <div className="flex flex-col items-center gap-3">
            {isStarting && (
              <div className="w-64 h-64 flex items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-xl">
                <Loader2 className="w-10 h-10 animate-spin text-purple-600 dark:text-primary" />
              </div>
            )}

            {!isStarting && qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR-код для входа в Яндекс"
                className="w-64 h-64 rounded-xl border border-gray-200 dark:border-white/10"
              />
            )}

            {isPolling && !error && (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Smartphone className="w-4 h-4" />
                <span>Ожидание подтверждения входа...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-xs text-center">{error}</p>
              <button
                onClick={startAuth}
                className="mt-2 w-full text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Попробовать снова
              </button>
            </div>
          )}

          {qrUrl && (
            <p className="text-[10px] text-center text-gray-400 dark:text-slate-500 break-all">
              Если QR не сканируется, откройте ссылку на телефоне: {qrUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
