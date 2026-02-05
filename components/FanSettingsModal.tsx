import React, { useState, useEffect } from 'react';
import { YandexDevice, YandexCapability, YandexModeCapabilityParameters } from '../types';
import { 
  X, 
  Wind, 
  Volume2, 
  Zap, 
  Settings, 
  Fan,
  Gauge,
  RotateCcw,
  Rotate3D,
  Pause,
  Play
} from 'lucide-react';

interface FanSettingsModalProps {
  device: YandexDevice;
  isOpen: boolean;
  onClose: () => void;
  onApply: (modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn?: boolean) => Promise<void>;
}

export const FanSettingsModal: React.FC<FanSettingsModalProps> = ({
  device,
  isOpen,
  onClose,
  onApply,
}) => {
  const [fanSpeed, setFanSpeed] = useState<string>('');
  const [oscillation, setOscillation] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const isApplyingRef = React.useRef(false);

  // Получаем mode capability для скорости вентилятора
  const modeCapabilities = device.capabilities.filter(
    (cap) => cap.type === 'devices.capabilities.mode'
  ) as Array<YandexCapability & { parameters?: YandexModeCapabilityParameters }>;

  // Находим capability для скорости вентилятора
  const findCapabilityByInstance = (instance: string) => {
    return modeCapabilities.find((cap) => {
      const params = cap.parameters as any;
      return params?.instance === instance;
    });
  };

  const fanSpeedCap = findCapabilityByInstance('fan_speed');

  // Получаем toggle capability для oscillation
  const oscillationCapability = device.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.toggle' && (cap.parameters as any)?.instance === 'oscillation'
  );

  // Получаем текущее значение скорости вентилятора
  const getCurrentFanSpeed = (): string => {
    const cap = fanSpeedCap;
    if (cap && cap.state) {
      const state = cap.state as any;
      return (state.value as string) || '';
    }
    return '';
  };

  // Получаем текущее значение oscillation
  const getCurrentOscillation = (): boolean => {
    if (oscillationCapability && oscillationCapability.state) {
      const state = oscillationCapability.state as any;
      return (state.value as boolean) ?? false;
    }
    return false;
  };

  // Получаем массив modes из capability
  const getModes = (cap: YandexCapability | undefined): Array<{ value: string; name: string }> => {
    if (!cap || !cap.parameters) return [];
    const params = cap.parameters as any;
    
    if (Array.isArray(params.modes)) {
      return params.modes;
    }
    
    return [];
  };

  const fanSpeedModes = getModes(fanSpeedCap);

  // Маппинг иконок для режимов скорости
  const getFanSpeedIcon = (value: string) => {
    switch (value) {
      case 'auto': return Settings;
      case 'high': return Gauge;
      case 'low': return Wind;
      case 'medium': return Fan;
      case 'quiet': return Volume2;
      case 'turbo': return Zap;
      default: return Wind;
    }
  };

  // Компонент для отображения иконки режима
  const ModeIconButton: React.FC<{
    value: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isSelected: boolean;
    onClick: () => void;
  }> = ({ value, label, icon: Icon, isSelected, onClick }) => {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200
          ${isSelected 
            ? 'border-purple-500 dark:border-primary bg-purple-50 dark:bg-primary/20 shadow-md scale-105' 
            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 opacity-60 hover:opacity-80'
          }
        `}
        title={label}
      >
        <Icon 
          className={`
            w-7 h-7 transition-all duration-200
            ${isSelected 
              ? 'text-purple-600 dark:text-primary opacity-100' 
              : 'text-gray-400 dark:text-slate-500 opacity-50'
            }
          `} 
        />
        <span className={`
          text-xs font-medium transition-all duration-200
          ${isSelected 
            ? 'text-purple-600 dark:text-primary opacity-100' 
            : 'text-gray-500 dark:text-slate-400 opacity-60'
          }
        `}>
          {label}
        </span>
      </button>
    );
  };

  // Инициализация значений при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      setFanSpeed(getCurrentFanSpeed());
      setOscillation(getCurrentOscillation());
    }
  }, [isOpen, device]);

  if (!isOpen) return null;

  const handleApply = async () => {
    // Предотвращаем двойной клик
    if (isApplyingRef.current) {
      return;
    }

    // Получаем текущие значения
    const currentFanSpeed = getCurrentFanSpeed();
    const currentOscillation = getCurrentOscillation();
    
    const modeActions: Array<{ instance: string; value: any; type?: string }> = [];

    // Отправляем только измененные параметры
    if (fanSpeedCap && fanSpeed && fanSpeed !== currentFanSpeed) {
      modeActions.push({ instance: 'fan_speed', value: fanSpeed });
    }

    if (oscillationCapability && oscillation !== currentOscillation) {
      modeActions.push({ 
        instance: 'oscillation', 
        value: oscillation,
        type: 'devices.capabilities.toggle'
      });
    }

    if (modeActions.length === 0) {
      return;
    }

    // Проверяем, включено ли устройство
    const onOffCap = device.capabilities.find(cap => cap.type === 'devices.capabilities.on_off');
    const isDeviceOn = onOffCap ? (onOffCap.state as any)?.value === true : true;
    const shouldTurnOn = !isDeviceOn;

    isApplyingRef.current = true;
    setIsLoading(true);
    try {
      await onApply(modeActions, shouldTurnOn); // Включаем устройство только если оно выключено
      onClose(); // Закрываем модальное окно после успешного применения
    } catch (error) {
      console.error('Ошибка при применении настроек вентилятора:', error);
    } finally {
      setIsLoading(false);
      isApplyingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Настройки вентилятора
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {device.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings */}
        <div className="space-y-6 mb-6">
          {/* Fan Speed */}
          {fanSpeedCap && fanSpeedModes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Скорость вращения
              </label>
              <div className="grid grid-cols-3 gap-2">
                {fanSpeedModes.map((mode) => {
                  const Icon = getFanSpeedIcon(mode.value);
                  const isSelected = fanSpeed === mode.value;
                  return (
                    <ModeIconButton
                      key={mode.value}
                      value={mode.value}
                      label={mode.name || mode.value}
                      icon={Icon}
                      isSelected={isSelected}
                      onClick={() => setFanSpeed(mode.value)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Oscillation Toggle */}
          {oscillationCapability && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Вращение вентилятора
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOscillation(false)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all duration-200
                    ${!oscillation 
                      ? 'border-purple-500 dark:border-primary bg-purple-50 dark:bg-primary/20 shadow-md' 
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 opacity-60 hover:opacity-80'
                    }
                  `}
                  title="Отключить вращение"
                >
                  <Pause 
                    className={`
                      w-5 h-5 transition-all duration-200
                      ${!oscillation 
                        ? 'text-purple-600 dark:text-primary' 
                        : 'text-gray-400 dark:text-slate-500'
                      }
                    `} 
                  />
                  <span className={`
                    text-sm font-medium transition-all duration-200
                    ${!oscillation 
                      ? 'text-purple-600 dark:text-primary' 
                      : 'text-gray-500 dark:text-slate-400'
                    }
                  `}>
                    Выкл
                  </span>
                </button>
                <button
                  onClick={() => setOscillation(true)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all duration-200
                    ${oscillation 
                      ? 'border-purple-500 dark:border-primary bg-purple-50 dark:bg-primary/20 shadow-md' 
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 opacity-60 hover:opacity-80'
                    }
                  `}
                  title="Включить вращение"
                >
                  <Rotate3D 
                    className={`
                      w-5 h-5 transition-all duration-200
                      ${oscillation 
                        ? 'text-purple-600 dark:text-primary' 
                        : 'text-gray-400 dark:text-slate-500'
                      }
                    `} 
                  />
                  <span className={`
                    text-sm font-medium transition-all duration-200
                    ${oscillation 
                      ? 'text-purple-600 dark:text-primary' 
                      : 'text-gray-500 dark:text-slate-400'
                    }
                  `}>
                    Вкл
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleApply}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-purple-400 dark:border-primary text-purple-600 dark:text-primary hover:bg-purple-50 dark:hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Применение...' : 'Применить'}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-purple-600 dark:bg-primary hover:bg-purple-700 dark:hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Применение...' : 'Закрыть'}
          </button>
        </div>
      </div>
    </div>
  );
};
