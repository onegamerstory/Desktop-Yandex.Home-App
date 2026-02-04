import React, { useState, useEffect } from 'react';
import { YandexDevice, YandexCapability, YandexModeCapabilityParameters } from '../types';
import { 
  X, 
  Settings, 
  Fan, 
  Volume2, 
  Zap, 
  RotateCcw, 
  ArrowLeftRight, 
  Pause, 
  ArrowUpDown,
  Snowflake,
  Droplet,
  Leaf,
  Flame,
  Wind,
  Gauge,
  MoveHorizontal,
  MoveVertical
} from 'lucide-react';

interface ThermostatSettingsModalProps {
  device: YandexDevice;
  isOpen: boolean;
  onClose: () => void;
  onApply: (modeActions: Array<{ instance: string; value: string }>, turnOn?: boolean) => Promise<void>;
}

export const ThermostatSettingsModal: React.FC<ThermostatSettingsModalProps> = ({
  device,
  isOpen,
  onClose,
  onApply,
}) => {
  const [thermostatMode, setThermostatMode] = useState<string>('');
  const [swingMode, setSwingMode] = useState<string>('');
  const [fanSpeed, setFanSpeed] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [temperatureRange, setTemperatureRange] = useState<{ min: number; max: number; precision: number } | null>(null);

  // Найти capability диапазона температуры
  const rangeCapability = device.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.range' && (cap.parameters as any)?.instance === 'temperature'
  ) as YandexCapability & { parameters?: { instance: string; range: { min: number; max: number; precision: number } } };

  useEffect(() => {
    if (rangeCapability && rangeCapability.parameters && (rangeCapability.parameters as any).range) {
      setTemperatureRange((rangeCapability.parameters as any).range);
      // Установить текущее значение температуры из state
      if (rangeCapability.state && typeof rangeCapability.state.value === 'number') {
        setTemperature(rangeCapability.state.value);
      } else {
        setTemperature((rangeCapability.parameters as any).range.min);
      }
    } else {
      setTemperatureRange(null);
      setTemperature(null);
    }
  }, [rangeCapability, isOpen, device]);

  // Ищем все capabilities с типом 'devices.capabilities.mode'
  const modeCapabilities = device.capabilities.filter(
    (cap) => cap.type === 'devices.capabilities.mode'
  ) as Array<YandexCapability & { parameters?: YandexModeCapabilityParameters }>;

  // Находим capability для каждого instance
  const findCapabilityByInstance = (instance: string) => {
    return modeCapabilities.find((cap) => {
      const params = cap.parameters as any;
      return params?.instance === instance;
    });
  };

  const thermostatCap = findCapabilityByInstance('thermostat');
  const swingCap = findCapabilityByInstance('swing');
  const fanSpeedCap = findCapabilityByInstance('fan_speed');

  // Получаем текущие значения из state
  const getCurrentValue = (instance: string): string => {
    const cap = findCapabilityByInstance(instance);
    if (cap && cap.state) {
      const state = cap.state as any;
      return (state.value as string) || '';
    }
    return '';
  };

  // Получаем массив modes из capability
  const getModes = (cap: YandexCapability | undefined): Array<{ value: string; name: string }> => {
    if (!cap || !cap.parameters) return [];
    const params = cap.parameters as any;
    
    // Проверяем, что parameters.modes существует и является массивом
    if (Array.isArray(params.modes)) {
      return params.modes;
    }
    
    return [];
  };

  const thermostatModes = getModes(thermostatCap);
  const swingModes = getModes(swingCap);
  const fanSpeedModes = getModes(fanSpeedCap);

  // Маппинг иконок для режимов
  const getThermostatIcon = (value: string) => {
    switch (value) {
      case 'auto': return Settings;
      case 'cool': return Snowflake;
      case 'dry': return Droplet;
      case 'eco': return Leaf;
      case 'fan_only': return Fan;
      case 'heat': return Flame;
      default: return Settings;
    }
  };

  const getSwingIcon = (value: string) => {
    switch (value) {
      case 'auto': return RotateCcw;
      case 'horizontal': return MoveHorizontal;
      case 'stationary': return Pause;
      case 'vertical': return MoveVertical;
      default: return RotateCcw;
    }
  };

  const getFanSpeedIcon = (value: string) => {
    switch (value) {
      case 'auto': return Settings;
      case 'high': return Gauge;
      case 'low': return Wind;
      case 'medium': return Fan;
      case 'quiet': return Volume2;
      case 'turbo': return Zap;
      default: return Settings;
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
      setThermostatMode(getCurrentValue('thermostat'));
      setSwingMode(getCurrentValue('swing'));
      setFanSpeed(getCurrentValue('fan_speed'));
    }
  }, [isOpen, device]);

  if (!isOpen) return null;

  const handleApply = async () => {
    // Формируем массив actions в расширенном формате для внутреннего использования
    const modeActions: Array<{ instance: string; value: string | number; type?: string }> = [];

    if (thermostatCap && thermostatMode) {
      modeActions.push({ instance: 'thermostat', value: thermostatMode, type: 'devices.capabilities.mode' });
    }
    if (swingCap && swingMode) {
      modeActions.push({ instance: 'swing', value: swingMode, type: 'devices.capabilities.mode' });
    }
    if (fanSpeedCap && fanSpeed) {
      modeActions.push({ instance: 'fan_speed', value: fanSpeed, type: 'devices.capabilities.mode' });
    }
    if (rangeCapability && temperature !== null) {
      modeActions.push({ instance: 'temperature', value: temperature, type: 'devices.capabilities.range' });
    }

    if (modeActions.length === 0) return;

    setIsLoading(true);
    try {
      // Преобразуем в формат, ожидаемый onApply, и передаём расширенную информацию через замыкание
      const actionsForApi = modeActions.map(action => ({
        instance: action.instance,
        value: String(action.value),
        type: action.type
      }));
      await (onApply as any)(actionsForApi, true); // Передаем true для включения устройства
    } catch (error) {
      console.error('Ошибка при применении настроек:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Настройки климата
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
          {/* Temperature Range Slider */}
          {temperatureRange && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Температура
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({temperature} °C)</span>
              </label>
              <input
                type="range"
                min={temperatureRange.min}
                max={temperatureRange.max}
                step={temperatureRange.precision}
                value={temperature ?? temperatureRange.min}
                onChange={e => setTemperature(Number(e.target.value))}
                className="w-full accent-purple-600 dark:accent-primary"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{temperatureRange.min}°C</span>
                <span>{temperatureRange.max}°C</span>
              </div>
            </div>
          )}
          {/* Thermostat Mode */}
          {thermostatCap && thermostatModes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Режим термостата
              </label>
              <div className="grid grid-cols-3 gap-2">
                {thermostatModes.map((mode) => {
                  const Icon = getThermostatIcon(mode.value);
                  const isSelected = thermostatMode === mode.value;
                  return (
                    <ModeIconButton
                      key={mode.value}
                      value={mode.value}
                      label={mode.name || mode.value}
                      icon={Icon}
                      isSelected={isSelected}
                      onClick={() => setThermostatMode(mode.value)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Swing Mode */}
          {swingCap && swingModes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Вращение вентилятора
              </label>
              <div className="grid grid-cols-4 gap-2">
                {swingModes.map((mode) => {
                  const Icon = getSwingIcon(mode.value);
                  const isSelected = swingMode === mode.value;
                  return (
                    <ModeIconButton
                      key={mode.value}
                      value={mode.value}
                      label={mode.name || mode.value}
                      icon={Icon}
                      isSelected={isSelected}
                      onClick={() => setSwingMode(mode.value)}
                    />
                  );
                })}
              </div>
            </div>
          )}

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
