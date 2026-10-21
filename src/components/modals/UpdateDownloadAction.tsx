import React, { useState } from 'react';
import { Download, FolderOpen, X } from 'lucide-react';
import type { DownloadedUpdate, UpdateDownloadProgress } from '../../types/electron-api';

interface UpdateDownloadActionProps {
  version: string;
  className: string;
}

const getUpdateInstructions = (update: DownloadedUpdate) => {
  if (update.platform === 'win32' && update.canAutoInstall) {
    return {
      title: 'Обновление готово к установке',
      message: 'После подтверждения приложение закроется и запустится установщик. Следуйте его инструкциям, чтобы завершить обновление.',
      action: 'Установить обновление',
    };
  }

  if (update.platform === 'darwin') {
    return {
      title: 'Обновление скачано',
      message: String.raw`Автоматическая установка на macOS не поддерживается для неподписанного приложения. Откройте скачанный DMG, замените приложение в папке «Программы» и выполните в Терминале: xattr -d com.apple.quarantine /Applications/Yandex\ Smart\ Home\ Control.app`,
      action: null,
    };
  }

  if (update.platform === 'linux' && update.isAppImage && update.canAutoInstall) {
    return {
      title: 'Обновление готово к установке',
      message: 'После подтверждения приложение закроется, новый AppImage заменит текущий файл, а приложение запустится снова. Для этого папка с приложением должна быть доступна для записи.',
      action: 'Установить обновление',
    };
  }

  if (update.platform === 'win32') {
    return {
      title: 'Обновление скачано',
      message: 'Автоматическая установка недоступна для этой сборки приложения. Запустите скачанный установщик вручную.',
      action: null,
    };
  }

  return {
    title: 'Обновление скачано',
    message: update.fileName.toLowerCase().endsWith('.appimage')
      ? 'Автоматическая установка поддерживается только для AppImage. Если приложение установлено из deb или rpm, скачанный AppImage не заменит системный пакет — обновите его вручную подходящим пакетом.'
      : 'Системный пакет скачан. Для установки откройте файл и подтвердите запрос прав администратора. Затем закройте приложение и дождитесь завершения установки.',
    action: null,
  };
};

export const UpdateDownloadAction: React.FC<UpdateDownloadActionProps> = ({ version, className }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<UpdateDownloadProgress | null>(null);
  const [downloadedUpdate, setDownloadedUpdate] = useState<DownloadedUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isShowingDownloadedUpdate, setIsShowingDownloadedUpdate] = useState(false);

  const downloadUpdate = async () => {
    setError(null);
    setDownloadProgress(null);
    setIsDownloading(true);
    const requestId = window.crypto.randomUUID();
    const unsubscribe = window.api.onUpdateDownloadProgress(requestId, setDownloadProgress);
    try {
      setDownloadedUpdate(await window.api.downloadLatestUpdate(version, requestId));
    } catch (downloadError) {
      console.error('Не удалось скачать обновление', downloadError);
      setError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать обновление.');
    } finally {
      unsubscribe();
      setIsDownloading(false);
    }
  };

  const downloadLabel = !isDownloading
    ? 'Скачать'
    : downloadProgress && downloadProgress.percent !== null
      ? `Скачивание… ${downloadProgress.percent}%`
      : downloadProgress
        ? `Скачивание… ${(downloadProgress.downloadedBytes / (1024 * 1024)).toFixed(1)} МБ`
        : 'Подготовка скачивания…';

  const installUpdate = async () => {
    setError(null);
    setIsInstalling(true);
    try {
      if (!downloadedUpdate) throw new Error('Сначала скачайте файл обновления.');
      await window.api.installDownloadedUpdate(downloadedUpdate.id);
    } catch (installError) {
      console.error('Не удалось установить обновление', installError);
      setError(installError instanceof Error ? installError.message : 'Не удалось установить обновление.');
    } finally {
      setIsInstalling(false);
    }
  };

  const showDownloadedUpdate = async () => {
    setError(null);
    setIsShowingDownloadedUpdate(true);
    try {
      if (!downloadedUpdate) throw new Error('Сначала скачайте файл обновления.');
      await window.api.showDownloadedUpdate(downloadedUpdate.id);
    } catch (showError) {
      console.error('Не удалось открыть папку с обновлением', showError);
      setError(showError instanceof Error ? showError.message : 'Не удалось открыть папку с обновлением.');
    } finally {
      setIsShowingDownloadedUpdate(false);
    }
  };

  const instructions = downloadedUpdate ? getUpdateInstructions(downloadedUpdate) : null;

  return (
    <>
      <button
        type="button"
        onClick={downloadUpdate}
        disabled={isDownloading}
        aria-live="polite"
        className={className}
      >
        <Download className="h-4 w-4" />
        {downloadLabel}
      </button>

      {(downloadedUpdate || error) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="update-download-title">
          <div className="mx-4 flex max-h-[90vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl dark:bg-surface">
            <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-border-soft">
              <h2 id="update-download-title" className="text-xl font-bold text-slate-900 dark:text-card-fg">
                {instructions?.title || 'Не удалось скачать обновление'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDownloadedUpdate(null);
                  setError(null);
                }}
                className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
                title="Закрыть"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5 text-slate-600 dark:text-muted" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              {downloadedUpdate && instructions && (
                <>
                  <p className="text-sm text-slate-700 dark:text-card-fg">{instructions.message}</p>
                  <p className="break-all rounded-lg bg-gray-100 p-3 text-xs text-slate-600 dark:bg-surface-warm dark:text-muted">
                    Файл: {downloadedUpdate.fileName}
                  </p>
                  <button
                    type="button"
                    onClick={showDownloadedUpdate}
                    disabled={isShowingDownloadedUpdate}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60 dark:border-border-soft dark:text-card-fg dark:hover:bg-white/10"
                  >
                    <FolderOpen className="h-4 w-4" />
                    {isShowingDownloadedUpdate ? 'Открытие папки…' : 'Показать файл в папке'}
                  </button>
                </>
              )}
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-200 p-6 dark:border-border-soft">
              {instructions?.action && (
                <button
                  type="button"
                  onClick={installUpdate}
                  disabled={isInstalling}
                  className="flex-1 rounded-lg bg-[#176f91] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#145a72] disabled:cursor-wait disabled:opacity-60 dark:bg-primary dark:hover:bg-primary-hover"
                >
                  {isInstalling ? 'Подготовка…' : instructions.action}
                </button>
              )}
              {error && !downloadedUpdate && (
                <button
                  type="button"
                  onClick={downloadUpdate}
                  disabled={isDownloading}
                  className="flex-1 rounded-lg bg-[#176f91] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#145a72] disabled:opacity-60 dark:bg-primary dark:hover:bg-primary-hover"
                >
                  Повторить
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDownloadedUpdate(null);
                  setError(null);
                }}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-gray-300 dark:bg-white/10 dark:text-card-fg dark:hover:bg-white/15"
              >
                {instructions?.action ? 'Позже' : 'Понятно'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
