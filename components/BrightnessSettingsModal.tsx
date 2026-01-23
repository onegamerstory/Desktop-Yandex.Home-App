import React, { useState, useEffect } from 'react';
import { YandexDevice, YandexCapability } from '../types';
import { X, Lightbulb, Palette, Thermometer } from 'lucide-react';

interface BrightnessSettingsModalProps {
  device: YandexDevice;
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: {
    brightness?: number;
    hsv?: { h: number; s: number; v: number };
    rgb?: number;
    temperature_k?: number;
  }, turnOn?: boolean) => Promise<void>;
}

interface ColorOption {
  name: string;
  hsv: { h: number; s: number; v: number };
  hex: string;
}

export const BrightnessSettingsModal: React.FC<BrightnessSettingsModalProps> = ({
  device,
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

  // Найти capability диапазона яркости
  const rangeCapability = device.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.range' && (cap.parameters as any)?.instance === 'brightness'
  ) as YandexCapability & { parameters?: { instance: string; range: { min: number; max: number; precision: number } } };

  // Найти capability HSV цвета
  const hsvCapability = device.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.color_setting' && (cap.parameters as any)?.color_model === 'hsv'
  ) as YandexCapability & { parameters?: { color_model: string; instance: string } };

  // Найти capability RGB цвета
  const rgbCapability = device.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.color_setting' && (cap.parameters as any)?.color_model === 'rgb'
  ) as YandexCapability & { parameters?: { color_model: string; instance: string } };

  // Найти capability температуры света в color_setting параметрах
  const temperatureCapability = device.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.color_setting' && (cap.parameters as any)?.temperature_k
  ) as YandexCapability & { parameters?: { temperature_k: { min: number; max: number; precision?: number } } };

  // Предопределенные цвета для выбора
  const colorOptions: ColorOption[] = [
    { name: 'Красный', hsv: { h: 0, s: 100, v: 100 }, hex: '#FF0000' },
    { name: 'Оранжевый', hsv: { h: 30, s: 100, v: 100 }, hex: '#FFA500' },
    { name: 'Желтый', hsv: { h: 60, s: 100, v: 100 }, hex: '#FFFF00' },
    { name: 'Зеленый', hsv: { h: 120, s: 100, v: 100 }, hex: '#00FF00' },
    { name: 'Голубой', hsv: { h: 180, s: 100, v: 100 }, hex: '#00FFFF' },
    { name: 'Синий', hsv: { h: 240, s: 100, v: 100 }, hex: '#0000FF' },
    { name: 'Фиолетовый', hsv: { h: 270, s: 100, v: 100 }, hex: '#FF00FF' },
    { name: 'Белый', hsv: { h: 0, s: 0, v: 100 }, hex: '#FFFFFF' },
    { name: 'Розовый', hsv: { h: 330, s: 100, v: 100 }, hex: '#FF69B4' },
  ];

  useEffect(() => {
    if (rangeCapability && rangeCapability.parameters && (rangeCapability.parameters as any).range) {
      setBrightnessRange((rangeCapability.parameters as any).range);
      if (rangeCapability.state && typeof rangeCapability.state.value === 'number') {
        setBrightness(rangeCapability.state.value);
      } else {
        setBrightness((rangeCapability.parameters as any).range.min);
      }
    } else {
      setBrightnessRange(null);
      setBrightness(null);
    }

    if (temperatureCapability && temperatureCapability.parameters && (temperatureCapability.parameters as any).temperature_k) {
      const tempData = (temperatureCapability.parameters as any).temperature_k;
      setTemperatureKRange({ min: tempData.min, max: tempData.max, precision: tempData.precision || 100 });
      if (temperatureCapability.state && typeof temperatureCapability.state.value === 'number') {
        setTemperature_k(temperatureCapability.state.value);
      } else {
        setTemperature_k(tempData.min);
      }
    } else {
      // Используем значения по умолчанию если capability не существует
      setTemperatureKRange({ min: 1500, max: 6500, precision: 100 });
      setTemperature_k(4000);
    }
  }, [rangeCapability, temperatureCapability, isOpen, device]);

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
      settings.temperature_k = temperature_k;
    }

    if (Object.keys(settings).length === 0) return;

    setIsLoading(true);
    try {
      await onApply(settings, true);
    } catch (error) {
      console.error('Ошибка при применении настроек освещения:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Настройки освещения
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
              <div className="grid grid-cols-3 gap-3">
                {colorOptions.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color)}
                    className={`
                      relative p-4 rounded-lg transition-all duration-200
                      ${selectedColor?.name === color.name
                        ? 'ring-2 ring-purple-600 dark:ring-primary scale-105'
                        : 'hover:scale-105'
                      }
                    `}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {selectedColor?.name === color.name && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
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
