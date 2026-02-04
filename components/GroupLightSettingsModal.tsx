import React, { useState, useEffect } from 'react';
import { YandexGroup, YandexDevice, YandexCapability } from '../types';
import { X, Lightbulb, Palette, Thermometer } from 'lucide-react';

interface GroupLightSettingsModalProps {
  group: YandexGroup;
  devices: YandexDevice[];
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: {
    brightness?: number;
    hsv?: { h: number; s: number; v: number };
    rgb?: number;
    temperature_k?: number;
  }) => Promise<void>;
}

interface ColorOption {
  name: string;
  hsv: { h: number; s: number; v: number };
  hex: string;
}

export const GroupLightSettingsModal: React.FC<GroupLightSettingsModalProps> = ({
  group,
  devices,
  isOpen,
  onClose,
  onApply,
}) => {
  const [brightness, setBrightness] = useState<number | null>(null);
  const [brightnessRange, setBrightnessRange] = useState<{ min: number; max: number; precision: number } | null>(null);
  const [temperature_k, setTemperature_k] = useState<number | null>(null);
  const [temperatureKRange, setTemperatureKRange] = useState<{ min: number; max: number; precision: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null);
  const [colorMode, setColorMode] = useState<'color' | 'temperature'>('color');
  const [isLoading, setIsLoading] = useState(false);

  // Получаем первое устройство группы для определения доступных свойств
  const groupDevices = devices.filter(d => group.devices.includes(d.id));
  const firstDevice = groupDevices.length > 0 ? groupDevices[0] : null;

  // Найти capability диапазона яркости
  const rangeCapability = firstDevice?.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.range' && (cap.parameters as any)?.instance === 'brightness'
  ) as YandexCapability & { parameters?: { instance: string; range: { min: number; max: number; precision: number } } };

  // Найти capability HSV цвета
  const hsvCapability = firstDevice?.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.color_setting' && (cap.parameters as any)?.color_model === 'hsv'
  ) as YandexCapability & { parameters?: { color_model: string; instance: string } };

  // Найти capability RGB цвета
  const rgbCapability = firstDevice?.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.color_setting' && (cap.parameters as any)?.color_model === 'rgb'
  ) as YandexCapability & { parameters?: { color_model: string; instance: string } };

  // Найти capability температуры света в color_setting параметрах
  const temperatureCapability = firstDevice?.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.color_setting' && (cap.parameters as any)?.temperature_k
  ) as YandexCapability & { parameters?: { temperature_k: { min: number; max: number; precision?: number } } };

  // Предопределенные цвета для выбора
  const colorOptions: ColorOption[] = [
    { name: 'Красный', hsv: { h: 0, s: 100, v: 100 }, hex: '#FF0000' },
    { name: 'Розовый', hsv: { h: 330, s: 100, v: 100 }, hex: '#FF69B4' },
    { name: 'Малиновый', hsv: { h: 345, s: 100, v: 100 }, hex: '#C71585' },
    { name: 'Бордовый', hsv: { h: 350, s: 100, v: 70 }, hex: '#800000' },
    { name: 'Алый', hsv: { h: 0, s: 100, v: 85 }, hex: '#DC143C' },
    { name: 'Оранжевый', hsv: { h: 30, s: 100, v: 100 }, hex: '#FFA500' },
    { name: 'Коралл', hsv: { h: 16, s: 100, v: 100 }, hex: '#FF7F50' },
    { name: 'Золотой', hsv: { h: 45, s: 100, v: 100 }, hex: '#FFD700' },
    { name: 'Желтый', hsv: { h: 60, s: 100, v: 100 }, hex: '#FFFF00' },
    { name: 'Лимонный', hsv: { h: 75, s: 100, v: 100 }, hex: '#CDDC39' },
    { name: 'Лайм', hsv: { h: 90, s: 100, v: 100 }, hex: '#00FF00' },
    { name: 'Зеленый', hsv: { h: 120, s: 100, v: 100 }, hex: '#00FF00' },
    { name: 'Хвоя', hsv: { h: 120, s: 100, v: 70 }, hex: '#228B22' },
    { name: 'Морской', hsv: { h: 150, s: 100, v: 100 }, hex: '#20B2AA' },
    { name: 'Бирюзовый', hsv: { h: 160, s: 100, v: 100 }, hex: '#40E0D0' },
    { name: 'Голубой', hsv: { h: 180, s: 100, v: 100 }, hex: '#00FFFF' },
    { name: 'Аквамарин', hsv: { h: 160, s: 50, v: 100 }, hex: '#7FFFD4' },
    { name: 'Стальной', hsv: { h: 180, s: 25, v: 100 }, hex: '#B0E0E6' },
    { name: 'Синий', hsv: { h: 240, s: 100, v: 100 }, hex: '#0000FF' },
    { name: 'Королевский', hsv: { h: 225, s: 100, v: 100 }, hex: '#4169E1' },
    { name: 'Индиго', hsv: { h: 270, s: 100, v: 100 }, hex: '#4B0082' },
    { name: 'Фиолетовый', hsv: { h: 280, s: 100, v: 100 }, hex: '#9400D3' },
    { name: 'Магента', hsv: { h: 300, s: 100, v: 100 }, hex: '#FF00FF' },
    { name: 'Оливковый', hsv: { h: 60, s: 100, v: 50 }, hex: '#808000' },
    { name: 'Сливовый', hsv: { h: 270, s: 100, v: 65 }, hex: '#660066' },
    { name: 'Белый', hsv: { h: 0, s: 0, v: 100 }, hex: '#FFFFFF' },
    { name: 'Серый', hsv: { h: 0, s: 0, v: 50 }, hex: '#808080' },
  ];

  useEffect(() => {
    // Инициализация только при открытии модала
    if (!isOpen) return;

    if (rangeCapability && rangeCapability.parameters && (rangeCapability.parameters as any).range) {
      setBrightnessRange((rangeCapability.parameters as any).range);
      // Инициализируем на середину диапазона вместо минимума
      const midValue = Math.round(((rangeCapability.parameters as any).range.min + (rangeCapability.parameters as any).range.max) / 2);
      setBrightness(midValue);
    } else {
      setBrightnessRange(null);
      setBrightness(null);
    }

    if (temperatureCapability && temperatureCapability.parameters && (temperatureCapability.parameters as any).temperature_k) {
      const tempData = (temperatureCapability.parameters as any).temperature_k;
      setTemperatureKRange({ min: tempData.min, max: tempData.max, precision: tempData.precision || 100 });
      // Инициализируем на середину диапазона
      const midTemp = Math.round((tempData.min + tempData.max) / 2);
      setTemperature_k(midTemp);
    } else {
      // Используем значения по умолчанию если capability не существует
      setTemperatureKRange({ min: 1500, max: 6500, precision: 100 });
      setTemperature_k(4000);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = async () => {
    const settings: any = {};

    if (brightness !== null && brightnessRange) {
      settings.brightness = brightness;
    }

    // Отправляем только выбранный режим: либо цвет, либо температуру
    if (colorMode === 'color' && selectedColor && hsvCapability) {
      settings.hsv = selectedColor.hsv;
    } else if (colorMode === 'temperature' && temperature_k !== null && temperatureKRange) {
      // Инвертируем температуру: левое положение (холодный) = высокое значение K, правое (теплый) = низкое значение K
      settings.temperature_k = temperatureKRange.min + temperatureKRange.max - temperature_k;
    }

    if (Object.keys(settings).length === 0) return;

    setIsLoading(true);
    try {
      await onApply(settings);
    } catch (error) {
      console.error('Ошибка при применении настроек освещения группы:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
      <style>{`
        input[type="range"]::-webkit-slider-runnable-track {
          background: linear-gradient(to right, #e2e8f0, #cbd5e1);
          height: 8px;
          border-radius: 4px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
          margin-top: -4px;
        }
        input[type="range"]::-moz-range-track {
          background: linear-gradient(to right, #e2e8f0, #cbd5e1);
          height: 8px;
          border-radius: 4px;
          border: none;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
          border: none;
          margin-top: -4px;
        }
        .dark input[type="range"]::-webkit-slider-runnable-track {
          background: linear-gradient(to right, #475569, #64748b);
        }
        .dark input[type="range"]::-moz-range-track {
          background: linear-gradient(to right, #475569, #64748b);
        }
      `}</style>
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Настройки освещения группы
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {group.name} ({groupDevices.length} устройств)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 mb-6">
          {/* Brightness Slider */}
          {brightnessRange && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Яркость
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({brightness}%)</span>
              </label>
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-purple-50 dark:bg-primary/20">
                  <Lightbulb className="w-5 h-5 text-purple-600 dark:text-primary" />
                </div>
                <input
                  type="range"
                  min={brightnessRange.min}
                  max={brightnessRange.max}
                  step={brightnessRange.precision}
                  value={brightness ?? brightnessRange.min}
                  onChange={e => setBrightness(Number(e.target.value))}
                  className="flex-1 accent-purple-600 dark:accent-primary"
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span>{brightnessRange.min}%</span>
                <span>{brightnessRange.max}%</span>
              </div>
            </div>
          )}

          {/* Color/Temperature Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setColorMode('color')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                colorMode === 'color'
                  ? 'bg-purple-600 dark:bg-primary text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <Palette className="w-4 h-4" />
              Цвет
            </button>
            <button
              onClick={() => setColorMode('temperature')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                colorMode === 'temperature'
                  ? 'bg-purple-600 dark:bg-primary text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <Thermometer className="w-4 h-4" />
              Температура
            </button>
          </div>

          {/* Color Picker */}
          {colorMode === 'color' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Выберите цвет
              </label>
              <div className="flex justify-center">
                <div className="grid grid-cols-9 gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color)}
                      className={`
                        relative w-12 h-12 rounded-lg transition-all duration-200 shadow-md
                        ${selectedColor?.name === color.name
                          ? 'ring-2 ring-purple-600 dark:ring-primary scale-105 shadow-md'
                          : 'hover:scale-105 hover:shadow-md'
                        }
                      `}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {selectedColor?.name === color.name && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Temperature Slider */}
          {colorMode === 'temperature' && temperatureKRange && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Температура света
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({temperature_k}K)</span>
              </label>
              <div className="flex items-center gap-4">
                <div className="text-xs text-slate-600 dark:text-slate-400 w-12">
                  Холодно
                </div>
                <input
                  type="range"
                  min={temperatureKRange.min}
                  max={temperatureKRange.max}
                  step={temperatureKRange.precision}
                  value={temperature_k ?? temperatureKRange.min}
                  onChange={e => setTemperature_k(Number(e.target.value))}
                  className="flex-1 accent-orange-500 dark:accent-orange-400"
                />
                <div className="text-xs text-slate-600 dark:text-slate-400 w-12 text-right">
                  Тепло
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span>{temperatureKRange.min}K</span>
                <span>{temperatureKRange.max}K</span>
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
