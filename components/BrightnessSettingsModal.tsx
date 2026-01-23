import React, { useState, useEffect } from 'react';
import { YandexDevice, YandexCapability } from '../types';
import { X, Lightbulb } from 'lucide-react';

interface BrightnessSettingsModalProps {
  device: YandexDevice;
  isOpen: boolean;
  onClose: () => void;
  onApply: (brightness: number, turnOn?: boolean) => Promise<void>;
}

export const BrightnessSettingsModal: React.FC<BrightnessSettingsModalProps> = ({
  device,
  isOpen,
  onClose,
  onApply,
}) => {
  const [brightness, setBrightness] = useState<number | null>(null);
  const [brightnessRange, setBrightnessRange] = useState<{ min: number; max: number; precision: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Найти capability диапазона яркости
  const rangeCapability = device.capabilities.find(
    (cap) => cap.type === 'devices.capabilities.range' && (cap.parameters as any)?.instance === 'brightness'
  ) as YandexCapability & { parameters?: { instance: string; range: { min: number; max: number; precision: number } } };

  useEffect(() => {
    if (rangeCapability && rangeCapability.parameters && (rangeCapability.parameters as any).range) {
      setBrightnessRange((rangeCapability.parameters as any).range);
      // Установить текущее значение яркости из state
      if (rangeCapability.state && typeof rangeCapability.state.value === 'number') {
        setBrightness(rangeCapability.state.value);
      } else {
        setBrightness((rangeCapability.parameters as any).range.min);
      }
    } else {
      setBrightnessRange(null);
      setBrightness(null);
    }
  }, [rangeCapability, isOpen, device]);

  if (!isOpen || !brightnessRange) return null;

  const handleApply = async () => {
    if (brightness === null) return;

    setIsLoading(true);
    try {
      await onApply(brightness, true); // Передаем true для включения устройства
    } catch (error) {
      console.error('Ошибка при применении настроек яркости:', error);
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
              Настройки яркости
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

        {/* Brightness Slider */}
        <div className="space-y-6 mb-6">
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
