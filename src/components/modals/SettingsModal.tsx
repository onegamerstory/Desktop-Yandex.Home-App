import React, { useState, useEffect } from 'react';
import { X, Download, Plus, Trash2, Keyboard } from 'lucide-react';
import { ToggleSwitch } from '../ToggleSwitch';
import { getCheckUpdatesOnStartup, setCheckUpdatesOnStartup } from '../../utils/updateSettings';
import { compareVersions } from '../../utils/dataUtils';
import { formatKeyboardShortcut, getDeviceShortcuts, saveDeviceShortcuts } from '../../utils/deviceShortcuts';
import type { DeviceShortcut, ShortcutTargetType } from '../../utils/deviceShortcuts';
import type { YandexDevice, YandexScenario } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  devices: YandexDevice[];
  scenarios: YandexScenario[];
  onUpdateAvailabilityChange: (available: boolean) => void;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  body?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  devices,
  scenarios,
  onUpdateAvailabilityChange,
}) => {
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [checkOnStartup, setCheckOnStartup] = useState(getCheckUpdatesOnStartup);
  const [activeTab, setActiveTab] = useState<'updates' | 'shortcuts'>('updates');
  const [shortcuts, setShortcuts] = useState<DeviceShortcut[]>([]);
  const [recordingShortcutId, setRecordingShortcutId] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  const availableDevices = devices.filter(device =>
    device.capabilities.some(capability => capability.type === 'devices.capabilities.on_off')
  );
  const availableScenarios = scenarios.filter(scenario => scenario.is_active);

  const checkForUpdates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        'https://api.github.com/repos/onegamerstory/Desktop-Yandex.Home-App/releases/latest'
      );
      if (!response.ok) {
        throw new Error('Не удалось получить информацию о последней версии');
      }
      const data: GitHubRelease = await response.json();
      setLatestRelease(data);
      onUpdateAvailabilityChange(
        typeof data.tag_name === 'string' &&
        compareVersions(data.tag_name, currentVersion) > 0
      );
      setHasChecked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при проверке обновлений');
      setHasChecked(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !hasChecked) {
      checkForUpdates();
    }
  }, [isOpen, hasChecked]);

  useEffect(() => {
    if (isOpen) {
      setCheckOnStartup(getCheckUpdatesOnStartup());
      setShortcuts(getDeviceShortcuts());
      setRecordingShortcutId(null);
      setShortcutError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const shortcutsToRegister = recordingShortcutId
      ? []
      : shortcuts.filter(shortcut => shortcut.keys).map(({ id, keys }) => ({ id, keys }));
    window.api.registerGlobalShortcuts(shortcutsToRegister).then(failedIds => {
      if (failedIds.length > 0) {
        const failed = shortcuts.filter(shortcut => failedIds.includes(shortcut.id));
        setShortcutError(`Не удалось зарегистрировать сочетания: ${failed.map(item => item.keys).join(', ')}. Возможно, они заняты системой или другим приложением.`);
      }
    }).catch(error => {
      console.error('Не удалось обновить глобальные сочетания клавиш', error);
      setShortcutError('Не удалось включить глобальные горячие клавиши.');
    });
  }, [isOpen, recordingShortcutId, shortcuts]);

  if (!isOpen) return null;

  const latestVersion = latestRelease?.tag_name || null;
  const isUpdateAvailable = latestVersion && compareVersions(latestVersion, currentVersion) > 0;
  const downloadUrl = latestRelease?.html_url || '#';

  const updateShortcuts = (nextShortcuts: DeviceShortcut[]) => {
    try {
      saveDeviceShortcuts(nextShortcuts);
      setShortcuts(nextShortcuts);
      setShortcutError(null);
    } catch (err) {
      console.error('Не удалось сохранить настройки горячих клавиш', err);
      setShortcutError('Не удалось сохранить настройки горячих клавиш.');
    }
  };

  const addShortcut = () => {
    const firstDevice = availableDevices[0];
    const firstScenario = availableScenarios[0];
    const targetType: ShortcutTargetType = firstDevice ? 'device' : 'scenario';
    const targetId = firstDevice?.id || firstScenario?.id || '';
    const newShortcut: DeviceShortcut = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      keys: '',
      targetType,
      targetId,
    };
    updateShortcuts([...shortcuts, newShortcut]);
    setRecordingShortcutId(newShortcut.id);
  };

  const changeTarget = (shortcut: DeviceShortcut, value: string) => {
    const separatorIndex = value.indexOf(':');
    if (separatorIndex < 0) return;
    const targetType = value.slice(0, separatorIndex) as ShortcutTargetType;
    const targetId = value.slice(separatorIndex + 1);
    updateShortcuts(shortcuts.map(item =>
      item.id === shortcut.id ? { ...item, targetType, targetId } : item
    ));
  };

  const recordShortcut = (event: React.KeyboardEvent<HTMLInputElement>, shortcut: DeviceShortcut) => {
    event.preventDefault();
    const keys = formatKeyboardShortcut(event.nativeEvent);
    if (!keys) {
      setShortcutError('Добавьте к клавише Ctrl, Alt или Meta.');
      return;
    }
    if (shortcuts.some(item => item.id !== shortcut.id && item.keys === keys)) {
      setShortcutError(`Сочетание ${keys} уже назначено.`);
      return;
    }
    updateShortcuts(shortcuts.map(item =>
      item.id === shortcut.id ? { ...item, keys } : item
    ));
    setRecordingShortcutId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div className="bg-white dark:bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-soft">
          <h2 id="settings-modal-title" className="text-xl font-bold text-slate-900 dark:text-card-fg">Настройки</h2>
          <button
            onClick={onClose}
            className="p-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 rounded-lg transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-muted" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('updates')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'updates' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-card-fg'}`}
          >
            Обновления
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'shortcuts' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-card-fg'}`}
          >
            Горячие клавиши
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'updates' ? (
            <>
          {/* Current Version */}
          <div>
            <p className="text-sm text-slate-600 dark:text-muted mb-2">Текущая версия</p>
            <div className="bg-gray-100 dark:bg-surface-warm rounded-lg p-4">
              <p className="text-2xl font-bold text-slate-900 dark:text-card-fg">v{currentVersion}</p>
            </div>
          </div>

          {/* Latest Version Status */}
          <div>
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#176f91] dark:border-primary"></div>
              </div>
            )}

            {!isLoading && latestVersion && (
              <>
                {isUpdateAvailable ? (
                  <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-400 mb-2">
                      Доступно обновление!
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                      Новая версия: <span className="font-bold">{latestVersion}</span>
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      Выпущено: {new Date(latestRelease!.published_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-400 mb-2">
                      Вы используете последнюю версию
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Обновлено: {new Date(latestRelease!.published_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                )}
              </>
            )}

            {!isLoading && !latestVersion && !error && (
              <button
                onClick={checkForUpdates}
                className="w-full px-4 py-2 bg-[#176f91] dark:bg-primary hover:bg-[#145a72] dark:hover:bg-primary-hover text-white rounded-lg transition-colors font-medium text-sm"
              >
                Проверить обновление
              </button>
            )}
          </div>

          <div className="bg-gray-100 dark:bg-surface-warm rounded-lg p-4">
            <ToggleSwitch
              checked={checkOnStartup}
              onChange={(enabled) => {
                setCheckOnStartup(enabled);
                setCheckUpdatesOnStartup(enabled);
              }}
              label="Проверять наличие обновлений при запуске"
            />
          </div>
            </>
          ) : (
            <section className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-card-fg">Сочетания клавиш</h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-muted">
                    Нажмите сочетание с Ctrl, Alt или Meta и выберите устройство или сценарий.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addShortcut}
                  disabled={availableDevices.length === 0 && availableScenarios.length === 0}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  title="Добавить сочетание"
                >
                  <Plus className="h-4 w-4" />
                  Добавить
                </button>
              </div>

              {shortcuts.length === 0 ? (
                <div className="rounded-lg bg-gray-100 p-5 text-center text-sm text-slate-600 dark:bg-surface-warm dark:text-muted">
                  <Keyboard className="mx-auto mb-2 h-6 w-6 opacity-70" />
                  Горячие клавиши ещё не настроены.
                </div>
              ) : (
                <div className="space-y-3">
                  {shortcuts.map(shortcut => {
                    const targetValue = `${shortcut.targetType}:${shortcut.targetId}`;
                    const targetExists = shortcut.targetType === 'device'
                      ? availableDevices.some(device => device.id === shortcut.targetId)
                      : availableScenarios.some(scenario => scenario.id === shortcut.targetId);

                    return (
                      <div key={shortcut.id} className="rounded-lg border border-gray-200 p-3 dark:border-border-soft">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            autoFocus={recordingShortcutId === shortcut.id}
                            onClick={() => {
                              setShortcutError(null);
                              setRecordingShortcutId(shortcut.id);
                            }}
                            onKeyDown={event => recordingShortcutId === shortcut.id && recordShortcut(event, shortcut)}
                            onBlur={() => setRecordingShortcutId(current => current === shortcut.id ? null : current)}
                            value={recordingShortcutId === shortcut.id ? 'Нажмите сочетание клавиш…' : shortcut.keys || 'Назначить сочетание'}
                            onFocus={() => setRecordingShortcutId(shortcut.id)}
                            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-left text-sm outline-none ${recordingShortcutId === shortcut.id ? 'border-primary bg-primary/10 dark:bg-primary/10' : 'border-gray-200 bg-gray-50 dark:border-border-soft dark:bg-surface-warm'}`}
                            aria-label="Сочетание клавиш"
                            style={{ backgroundColor: recordingShortcutId === shortcut.id ? 'var(--surface)' : 'var(--surface-warm)', color: 'var(--fg)' }}
                          />
                          <button
                            type="button"
                            onClick={() => updateShortcuts(shortcuts.filter(item => item.id !== shortcut.id))}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                            aria-label="Удалить сочетание"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <select
                          value={targetExists ? targetValue : ''}
                          onChange={event => changeTarget(shortcut, event.target.value)}
                          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-border-soft dark:bg-surface dark:text-card-fg"
                          aria-label="Цель сочетания клавиш"
                        >
                          <option value="" disabled>Выберите устройство или сценарий</option>
                          {availableDevices.length > 0 && (
                            <optgroup label="Устройства">
                              {availableDevices.map(device => (
                                <option key={device.id} value={`device:${device.id}`}>{device.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {availableScenarios.length > 0 && (
                            <optgroup label="Сценарии">
                              {availableScenarios.map(scenario => (
                                <option key={scenario.id} value={`scenario:${scenario.id}`}>{scenario.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
              {shortcutError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{shortcutError}</p>}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-border-soft p-6 flex gap-3">
          {activeTab === 'updates' && isUpdateAvailable && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#176f91] dark:bg-primary hover:bg-[#145a72] dark:hover:bg-primary-hover text-white rounded-lg transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              Скачать
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 text-slate-900 dark:text-card-fg rounded-lg transition-colors font-medium text-sm"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
