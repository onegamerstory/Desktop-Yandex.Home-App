import React, { useState, useEffect, useCallback } from 'react';
import { YandexDevice } from '../../types/index';
import { localizeUnit } from '../../constants/formatting';
import {
  X, Settings, Thermometer, Droplets, Sun, Gauge, Wind, BatteryFull,
  Waves, Footprints, DoorOpen, AlarmSmoke, Flame, Vibrate, Droplet,
  MousePointerClick, CircleDot
} from 'lucide-react';

export interface SensorDisplayConfig {
  /** Index in device.properties array to use as the main (primary) value */
  primaryIndex: number;
  /** Indices in device.properties array to use as secondary values (max 2) */
  secondaryIndexes: number[];
}

interface SensorPropertyEntry {
  index: number;
  instance: string;
  type: string;
  rawValue: unknown;
  unit?: string;
  events?: Array<{ value: string; name: string }>;
}

interface SensorSettingsModalProps {
  device: YandexDevice;
  isOpen: boolean;
  onClose: () => void;
  onSave: (deviceId: string, config: SensorDisplayConfig) => void;
  initialConfig?: SensorDisplayConfig | null;
}

const INSTANCE_ICON_COMPONENTS: Record<string, React.ElementType> = {
  temperature: Thermometer,
  humidity: Droplets,
  illumination: Sun,
  pressure: Gauge,
  co2_level: Wind,
  pm1_density: Wind,
  pm2_5_density: Wind,
  pm10_density: Wind,
  tvoc: Wind,
  battery_level: BatteryFull,
  water_level: Waves,
  motion: Footprints,
  open: DoorOpen,
  smoke: AlarmSmoke,
  gas: Flame,
  vibration: Vibrate,
  water_leak: Droplet,
  button: MousePointerClick,
};

const INSTANCE_LABELS: Record<string, string> = {
  temperature: 'Температура',
  humidity: 'Влажность',
  illumination: 'Освещённость',
  pressure: 'Давление',
  co2_level: 'CO₂',
  pm1_density: 'PM1',
  pm2_5_density: 'PM2.5',
  pm10_density: 'PM10',
  tvoc: 'TVOC',
  battery_level: 'Заряд батареи',
  water_level: 'Уровень воды',
  motion: 'Движение',
  open: 'Открытие',
  smoke: 'Дым',
  gas: 'Газ',
  vibration: 'Вибрация',
  water_leak: 'Протечка',
  button: 'Кнопка',
};

const INSTANCE_UNIT_FALLBACK: Record<string, string> = {
  humidity: ' %',
  temperature: ' °C',
};

const getIconForInstance = (instance: string, className: string = 'w-5 h-5'): React.ReactNode => {
  const IconComponent = INSTANCE_ICON_COMPONENTS[instance] ?? CircleDot;
  return <IconComponent className={className} />;
};

const getInstanceLabel = (instance: string): string => {
  return INSTANCE_LABELS[instance] ?? instance;
};

const extractModalProperties = (device: YandexDevice): SensorPropertyEntry[] => {
  const props = device.properties ?? [];
  const result: SensorPropertyEntry[] = [];

  for (let i = 0; i < props.length; i++) {
    const anyProp = props[i] as any;
    const type: string | undefined = anyProp?.type;
    const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
    const value: unknown = anyProp?.state?.value;

    if (typeof type !== 'string' || !type.includes('devices.properties') || !instance || value === undefined) {
      continue;
    }

    result.push({
      index: i,
      instance,
      type,
      rawValue: value,
      unit: anyProp?.parameters?.unit ?? anyProp?.state?.unit,
      events: anyProp?.parameters?.events as Array<{ value: string; name: string }> | undefined,
    });
  }

  return result;
};

const formatPreviewValue = (prop: SensorPropertyEntry): string => {
  if (prop.type === 'devices.properties.event' && typeof prop.rawValue === 'string') {
    if (prop.events && Array.isArray(prop.events)) {
      const matchingEvent = prop.events.find(e => e.value === prop.rawValue);
      if (matchingEvent) return matchingEvent.name;
    }
    return prop.rawValue;
  }

  if (typeof prop.rawValue === 'number') {
    const unit = localizeUnit(prop.unit) || INSTANCE_UNIT_FALLBACK[prop.instance] || '';
    return `${Number(prop.rawValue).toFixed(2)}${unit}`;
  }

  if (typeof prop.rawValue === 'boolean') {
    return prop.rawValue ? 'Да' : 'Нет';
  }

  return String(prop.rawValue ?? '—');
};

export const SensorSettingsModal: React.FC<SensorSettingsModalProps> = ({
  device,
  isOpen,
  onClose,
  onSave,
  initialConfig,
}) => {
  const allProperties = extractModalProperties(device);

  const [primaryIndex, setPrimaryIndex] = useState<number | null>(null);
  const [secondaryIndexes, setSecondaryIndexes] = useState<number[]>([]);

  // Initialize state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (initialConfig && allProperties.some(p => p.index === initialConfig.primaryIndex)) {
      setPrimaryIndex(initialConfig.primaryIndex);
      const validSecondary = initialConfig.secondaryIndexes.filter(
        idx => idx !== initialConfig.primaryIndex && allProperties.some(p => p.index === idx)
      );
      setSecondaryIndexes(validSecondary.slice(0, 2));
    } else if (allProperties.length > 0) {
      // Default: last property as primary, first up to 2 as secondary
      const lastIdx = allProperties[allProperties.length - 1].index;
      setPrimaryIndex(lastIdx);
      const secondary = allProperties
        .filter(p => p.index !== lastIdx)
        .slice(0, 2)
        .map(p => p.index);
      setSecondaryIndexes(secondary);
    }
  }, [isOpen, device.id]);

  const toggleSecondary = useCallback((index: number) => {
    setSecondaryIndexes(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length >= 2) {
        return prev; // max 2 secondary
      }
      return [...prev, index];
    });
  }, []);

  const isValid =
    primaryIndex !== null &&
    !secondaryIndexes.includes(primaryIndex) &&
    secondaryIndexes.length <= 2;

  const handleSave = () => {
    if (!isValid || primaryIndex === null) return;
    onSave(device.id, {
      primaryIndex,
      secondaryIndexes,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-soft rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-card-fg">
              Настройки отображения датчика
            </h3>
            <p className="text-sm text-slate-600 dark:text-muted mt-1">
              {device.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-card-fg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-muted mb-4">
          Выберите, какие показания отображать на карточке датчика.
          Одно основное (внизу карточки) и до двух второстепенных (в верхней строке).
        </p>

        {/* Properties List */}
        {allProperties.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-muted">
            У этого датчика нет доступных свойств для отображения.
          </div>
        ) : (
          <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-1">
            {allProperties.map((prop) => {
              const isPrimary = primaryIndex === prop.index;
              const isSecondary = secondaryIndexes.includes(prop.index);
              const isSelected = isPrimary || isSecondary;

              return (
                <div
                  key={prop.index}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200
                    ${isPrimary
                      ? 'border-primary bg-primary/10 dark:bg-primary/20 shadow-md'
                      : isSecondary
                        ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm'
                        : 'border-gray-100 dark:border-border bg-gray-50/50 dark:bg-surface hover:border-gray-200 dark:hover:border-border-soft'
                    }
                  `}
                >
                  {/* Primary radio */}
                  <button
                    onClick={() => {
                      setPrimaryIndex(prop.index);
                      // Remove from secondary if it was there
                      setSecondaryIndexes(prev => prev.filter(i => i !== prop.index));
                    }}
                    className={`
                      flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200
                      ${isPrimary
                        ? 'border-primary bg-primary'
                        : 'border-gray-300 dark:border-muted hover:border-primary dark:hover:border-primary'
                      }
                    `}
                    title="Сделать основным"
                  >
                    {isPrimary && <div className="w-2 h-2 rounded-full bg-white" />}
                  </button>

                  {/* Icon */}
                  <div className={`flex-shrink-0 ${isPrimary ? 'text-primary' : isSecondary ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-muted'}`}>
                    {getIconForInstance(prop.instance, 'w-5 h-5')}
                  </div>

                  {/* Label + value */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isPrimary || isSecondary ? 'text-slate-900 dark:text-card-fg' : 'text-slate-700 dark:text-card-fg'}`}>
                      {getInstanceLabel(prop.instance)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-muted truncate">
                      {formatPreviewValue(prop)}
                    </div>
                  </div>

                  {/* Secondary checkbox */}
                  <button
                    onClick={() => {
                      if (isPrimary) {
                        // Switching primary to secondary — clear primary
                        setPrimaryIndex(null);
                        setSecondaryIndexes(prev => {
                          if (prev.includes(prop.index)) return prev;
                          if (prev.length >= 2) return prev;
                          return [...prev, prop.index];
                        });
                      } else {
                        toggleSecondary(prop.index);
                      }
                    }}
                    className={`
                      flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                      ${isSecondary
                        ? 'border-blue-400 dark:border-blue-500 bg-blue-400 dark:bg-blue-500'
                        : isPrimary
                          ? 'border-primary/30 dark:border-primary/30'
                          : 'border-gray-300 dark:border-muted hover:border-blue-400 dark:hover:border-blue-500'
                      }
                    `}
                    title={isPrimary ? 'Сделать второстепенным' : 'Показать второстепенным'}
                  >
                    {isSecondary && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mb-6 text-xs text-slate-500 dark:text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-primary bg-primary" />
            Основное
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-blue-400 dark:border-blue-500 bg-blue-400 dark:bg-blue-500">
              <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Второстепенное
          </span>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-[#176f91] dark:border-primary text-[#176f91] dark:text-primary hover:bg-[#176f91]/10 dark:hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Сохранить
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#176f91] dark:bg-primary hover:bg-[#145a72] dark:hover:bg-primary-hover text-white"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
