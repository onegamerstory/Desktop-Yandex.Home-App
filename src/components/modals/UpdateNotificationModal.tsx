import React from 'react';
import { X, Download } from 'lucide-react';

interface UpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseDate: string;
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  latestVersion,
  releaseUrl,
  releaseDate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Обновление доступно</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Version */}
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Текущая версия</p>
            <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">v{currentVersion}</p>
            </div>
          </div>

          {/* New Version Available */}
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Новая версия</p>
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-400 mb-2">
                {latestVersion}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Выпущено: {releaseDate}
              </p>
            </div>
          </div>

          {/* Update Description */}
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm text-yellow-900 dark:text-yellow-400">
              Доступна новая версия приложения. Рекомендуется обновиться для получения последних функций и исправлений ошибок.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-white/10 p-6 flex gap-3">
          <a
            href={releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#176f91] dark:bg-primary hover:bg-[#145a72] dark:hover:bg-primary/90 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <Download className="w-4 h-4" />
            Скачать
          </a>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-lg transition-colors font-medium text-sm"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
};
