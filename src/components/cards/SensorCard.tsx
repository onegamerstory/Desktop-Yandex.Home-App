import React from 'react';
import { YandexDevice } from '../../types/index';
import { getIconForDevice, localizeUnit } from '../../constants';
import {
  Star, Eye, EyeOff, Thermometer, Droplets, Sun, Gauge, Wind, BatteryFull,
  Waves, Footprints, DoorOpen, AlarmSmoke, Flame, Vibrate, Droplet,
  MousePointerClick, CircleDot
} from 'lucide-react';

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

const getIconForInstance = (instance: string, className: string = 'w-5 h-5'): React.ReactNode => {
  const IconComponent = INSTANCE_ICON_COMPONENTS[instance] ?? CircleDot;
  return <IconComponent className={className} />;
};

interface SensorCardProps {
  device: YandexDevice;
  /** Intentionally unused for sensor cards (sensors are not toggleable). Kept for interface compatibility with DeviceCardProps. */
  onToggle: (id: string, currentState: boolean) => Promise<void>;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenSettings?: (device: YandexDevice) => void;
  onOpenCameraStream?: (device: YandexDevice) => void;
  isEditMode?: boolean;
  iconHiddenState?: boolean;
  onToggleVisibility?: (id: string) => void;
}

interface PropertyData {
  key: string;
  instance: string;
  rawValue: unknown;
  type: string;
  unit?: string;
  events?: Array<{ value: string; name: string }>;
}

const extractProperties = (device: YandexDevice): PropertyData[] => {
  const props = device.properties ?? [];
  const result: PropertyData[] = [];
  
  for (let i = 0; i < props.length && result.length < 3; i++) {
    const anyProp = props[i] as any;
    const type: string | undefined = anyProp?.type;
    const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
    const value: unknown = anyProp?.state?.value;
    
    if (typeof type !== 'string' || !type.includes('devices.properties') || !instance || value === undefined) {
      continue;
    }
    
    result.push({
      key: `${instance}_${i}`,
      instance,
      rawValue: value,
      type,
      unit: anyProp?.parameters?.unit ?? anyProp?.state?.unit,
      events: anyProp?.parameters?.events as Array<{ value: string; name: string }> | undefined,
    });
  }
  
  return result;
};

const LOCALIZED_UNIT_FALLBACK: Record<string, string> = {
  humidity: ' %',
  temperature: ' °C',
};

const resolveUnit = (instance: string, unit?: string): string => {
  return localizeUnit(unit) || LOCALIZED_UNIT_FALLBACK[instance] || '';
};

const formatMainValue = (prop: PropertyData): string => {
  if (prop.type === 'devices.properties.event' && typeof prop.rawValue === 'string') {
    if (prop.events && Array.isArray(prop.events)) {
      const matchingEvent = prop.events.find(e => e.value === prop.rawValue);
      if (matchingEvent) return matchingEvent.name;
    }
    return prop.rawValue;
  }
  
  if (typeof prop.rawValue === 'number') {
    const unit = resolveUnit(prop.instance, prop.unit);
    return `${Number(prop.rawValue).toFixed(2)}${unit}`;
  }
  
  if (typeof prop.rawValue === 'boolean') {
    return prop.rawValue ? 'Да' : 'Нет';
  }
  
  return String(prop.rawValue ?? '—');
};

export const SensorCard: React.FC<SensorCardProps> = ({
  device,
  onToggle,
  isFavorite,
  onToggleFavorite,
  onOpenSettings,
  onOpenCameraStream,
  isEditMode = false,
  iconHiddenState = false,
  onToggleVisibility,
}) => {
  const props = extractProperties(device);
  const mainProp = props.length >= 3 ? props[2] : props[props.length - 1];

  const icon = getIconForDevice(device.type);

  const handleClick = () => {
    if (onOpenSettings) {
      onOpenSettings(device);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onOpenSettings) {
      e.preventDefault();
      e.stopPropagation();
      onOpenSettings(device);
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`device-card sensor-card is-on ${isEditMode && iconHiddenState ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="device-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="device-icon is-on">
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          {isEditMode && onToggleVisibility && (
            <div
              onClick={(e) => { e.stopPropagation(); onToggleVisibility(`device_${device.id}`); }}
              style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              className="edit-vis-btn"
            >
              {iconHiddenState ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(device.id); }}
            className={`device-fav ${isFavorite ? 'is-fav' : ''}`}
          >
            <Star className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="device-name">{device.name}</div>

      {props.length > 0 && (
        <div className="device-type-label">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {getIconForInstance(props[0].instance, 'w-3.5 h-3.5')}
            {formatMainValue(props[0])}
          </span>
          {props.length >= 2 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6 }}>
              {getIconForInstance(props[1].instance, 'w-3.5 h-3.5')}
              {formatMainValue(props[1])}
            </span>
          )}
        </div>
      )}

      {mainProp && <hr className="sensor-divider" />}

      {mainProp && (
        <div className="sensor-main-value">
          <span className="sensor-main-icon">
            {getIconForInstance(mainProp.instance, 'w-4 h-4')}
          </span>
          <span className="sensor-main-text">
            {formatMainValue(mainProp)}
          </span>
        </div>
      )}
    </div>
  );
};
