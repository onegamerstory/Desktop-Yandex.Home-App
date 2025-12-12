import React, { useState } from 'react';
import { YandexDevice } from '../types';
import { getIconForDevice, localizeUnit } from '../constants';
import { Loader2, Power, Star } from 'lucide-react';

interface DeviceCardProps {
  device: YandexDevice;
  onToggle: (id: string, currentState: boolean) => Promise<void>;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onToggle, isFavorite, onToggleFavorite }) => {
  const [loading, setLoading] = useState(false);

  // Find the on_off capability
  const onOffCapability = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
  
  // If no on_off capability, device might be a sensor or unsupported for simple toggle
  const isToggleable = !!onOffCapability;
  // Если у девайса явно есть состояние и onOffCapability ИЛИ это умная колонка
  const isOn = onOffCapability?.state?.value === true || 
                device.type.toLowerCase().includes('smart_speaker') || 
                device.type.toLowerCase().includes('hub') ||
                device.type.toLowerCase().includes('other');

  // Sensor detection: ищем свойство с текущим значением
  const sensorProperty = (device.properties ?? []).find(prop => {
    const anyProp = prop as any;
    const type: string | undefined = anyProp?.type;
    const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
    return (
      typeof type === 'string' &&
      type.includes('devices.properties') &&
      typeof instance === 'string'
    );
  }) as any | undefined;

  const isSensor = !isToggleable && !!sensorProperty;

  const sensorInstance: string | undefined =
    sensorProperty?.parameters?.instance ?? sensorProperty?.state?.instance;
  const rawSensorValue: unknown = sensorProperty?.state?.value;
  const rawSensorUnit: string | undefined =
    sensorProperty?.parameters?.unit ?? sensorProperty?.state?.unit;
  const propertyType: string | undefined = sensorProperty?.type;

  // Check if this is an event property that needs localization
  const isEventProperty = propertyType === 'devices.properties.event';
  
  // Localize event status: find the Russian name from parameters.events array
  let localizedEventValue: string | null = null;
  if (isEventProperty && typeof rawSensorValue === 'string') {
    const events = (sensorProperty as any)?.parameters?.events as Array<{ value: string; name: string }> | undefined;
    if (events && Array.isArray(events)) {
      const matchingEvent = events.find(event => event.value === rawSensorValue);
      if (matchingEvent) {
        localizedEventValue = matchingEvent.name;
      }
    }
    // Fallback to original value if no matching event found
    if (!localizedEventValue) {
      localizedEventValue = rawSensorValue;
    }
  }

  // Localize the unit code to a user-friendly display string (for float properties)
  const localizedUnit = localizeUnit(rawSensorUnit);
  
  // Fallback to instance-based unit if no unit code is provided
  const resolvedUnit =
    localizedUnit ||
    (sensorInstance === 'humidity' ? ' %' : sensorInstance === 'temperature' ? ' °C' : '');

  // Format sensor value: use localized event name for events, or formatted number/string with unit for floats
  const formattedSensorValue = isEventProperty && localizedEventValue
    ? localizedEventValue
    : typeof rawSensorValue === 'number'
    ? `${rawSensorValue}${resolvedUnit ?? ''}`
    : typeof rawSensorValue === 'string'
    ? `${rawSensorValue}${resolvedUnit ?? ''}`
    : null;

  const handleClick = async () => {
    if (!isToggleable || loading) return;

    setLoading(true);
    try {
      await onToggle(device.id, isOn);
    } catch (err) {
      console.error(err);
      // Parent component handles the global error alert, but we stop loading here
    } finally {
      setLoading(false);
    }
  };

  const icon = getIconForDevice(device.type);

  return (
    <button
      onClick={handleClick}
      // Отключаем только во время загрузки, чтобы датчики без on_off
      // всё равно можно было добавлять/убирать из избранного.
      disabled={loading}
      className={`
        relative overflow-hidden group
        flex flex-col p-4 gap-3
        border rounded-xl text-left
        transition-all duration-200 ease-out
        w-full
        ${isToggleable ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}
        ${
          isToggleable
            ? isOn
              ? 'bg-purple-50 dark:bg-primary/20 border-purple-300 dark:border-primary/50 shadow-purple-200 dark:shadow-[0_0_15px_rgba(59,130,246,0.15)]'
              : 'bg-white dark:bg-surface border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-slate-700/50'
            : 'bg-white dark:bg-surface border-gray-200 dark:border-white/5'
        }
      `}
    >
	
	<button
          onClick={(e) => {
              e.stopPropagation(); // Важно: предотвращаем переключение устройства
              onToggleFavorite(device.id);
          }}
          className={`
              absolute top-3 right-3 z-20 p-1 rounded-full transition-all duration-200
              ${isFavorite ? 'text-yellow-500 dark:text-accent bg-white/80 dark:bg-surface/80 hover:bg-white dark:hover:bg-surface' : 'text-gray-400 dark:text-slate-500 hover:text-yellow-500 dark:hover:text-accent opacity-0 group-hover:opacity-100'}
          `}
          title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      >
          <Star className="w-4 h-4 fill-current" />
      </button>
	
      <div className="flex items-start justify-between w-full">
        <div
          className={`
            p-2 rounded-full transition-colors duration-300
            ${
              isToggleable
                ? isOn
                  ? 'bg-purple-600 dark:bg-primary text-white'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                : isSensor
                  ? 'bg-purple-50 dark:bg-primary text-purple-600 dark:text-slate-100'
                  : isOn
                    ? 'bg-purple-50 dark:bg-primary text-purple-600 dark:text-slate-100'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
            }
        `}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
              className: 'w-5 h-5',
            })
          )}
        </div>
      </div>

      <div className="mt-2">
        <p className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1 text-sm">
          {device.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          {loading
            ? 'Обновление...'
            : isSensor && formattedSensorValue
            ? formattedSensorValue
            : isOn
              ? 'Включено'
              : 'Отключено'}
        </p>
      </div>
	  
	  <div className="flex justify-end">
        {isToggleable && (
             <div className={`
                w-8 h-4 rounded-full relative transition-colors duration-300
                ${isOn ? 'bg-purple-400 dark:bg-primary/50' : 'bg-gray-300 dark:bg-slate-700'}
             `}>
                 <div className={`
                    absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300
                    ${isOn ? 'left-4.5' : 'left-0.5'}
                 `} style={{ left: isOn ? '1.1rem' : '0.15rem' }}></div>
             </div>
        )}
      </div>
    </button>
  );
};