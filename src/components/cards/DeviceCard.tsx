import React, { useState } from 'react';
import { YandexDevice } from '../../types/index';
import { getIconForDevice, localizeUnit, isCameraDevice } from '../../constants';
import { Loader2, Star, Settings, Eye, EyeOff, Video } from 'lucide-react';

interface DeviceCardProps {
  device: YandexDevice;
  onToggle: (id: string, currentState: boolean) => Promise<void>;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenSettings?: (device: YandexDevice) => void;
  onOpenCameraStream?: (device: YandexDevice) => void;
  isEditMode?: boolean;
  iconHiddenState?: boolean;
  onToggleVisibility?: (id: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onToggle, isFavorite, onToggleFavorite, onOpenSettings, onOpenCameraStream, isEditMode = false, iconHiddenState = false, onToggleVisibility }) => {
  const [loading, setLoading] = useState(false);

  const isThermostat = device.type === 'devices.types.thermostat.ac' || device.type === 'devices.types.thermostat';
  const isLight = device.type.startsWith('devices.types.light');
  const isFan = device.type === 'devices.types.ventilation.fan';
  const isCamera = isCameraDevice(device);

  const onOffCapability = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
  const isToggleable = !!onOffCapability;
  const isOn = onOffCapability?.state?.value === true ||
    device.type.toLowerCase().includes('smart_speaker') ||
    device.type.toLowerCase().includes('hub') ||
    device.type.toLowerCase().includes('other');

  const sensorProperty = (device.properties ?? []).find(prop => {
    const anyProp = prop as any;
    const type: string | undefined = anyProp?.type;
    const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
    return typeof type === 'string' && type.includes('devices.properties') && typeof instance === 'string';
  }) as any | undefined;

  const temperatureProperty = (device.properties ?? []).find(prop => {
    const anyProp = prop as any;
    const type: string | undefined = anyProp?.type;
    const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
    return type === 'devices.properties.float' && instance === 'temperature';
  }) as any | undefined;

  const humidityProperty = (device.properties ?? []).find(prop => {
    const anyProp = prop as any;
    const type: string | undefined = anyProp?.type;
    const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
    return type === 'devices.properties.float' && instance === 'humidity';
  }) as any | undefined;

  const temperatureValue: number | null = temperatureProperty?.state?.value ?? null;
  const temperatureUnit = temperatureProperty?.parameters?.unit
    ? localizeUnit(temperatureProperty.parameters.unit)
    : temperatureProperty?.state?.unit
      ? localizeUnit(temperatureProperty.state.unit)
      : ' °C';

  const humidityValue: number | null = humidityProperty?.state?.value ?? null;
  const humidityUnit = humidityProperty?.parameters?.unit
    ? localizeUnit(humidityProperty.parameters.unit)
    : humidityProperty?.state?.unit
      ? localizeUnit(humidityProperty.state.unit)
      : ' %';

  const isSensor = !isToggleable && !!sensorProperty;

  const sensorInstance: string | undefined = sensorProperty?.parameters?.instance ?? sensorProperty?.state?.instance;
  const rawSensorValue: unknown = sensorProperty?.state?.value;
  const rawSensorUnit: string | undefined = sensorProperty?.parameters?.unit ?? sensorProperty?.state?.unit;
  const propertyType: string | undefined = sensorProperty?.type;

  const isEventProperty = propertyType === 'devices.properties.event';
  let localizedEventValue: string | null = null;
  if (isEventProperty && typeof rawSensorValue === 'string') {
    const events = (sensorProperty as any)?.parameters?.events as Array<{ value: string; name: string }> | undefined;
    if (events && Array.isArray(events)) {
      const matchingEvent = events.find(event => event.value === rawSensorValue);
      if (matchingEvent) localizedEventValue = matchingEvent.name;
    }
    if (!localizedEventValue) localizedEventValue = rawSensorValue;
  }

  const localizedUnit = localizeUnit(rawSensorUnit);
  const resolvedUnit = localizedUnit ||
    (sensorInstance === 'humidity' ? ' %' : sensorInstance === 'temperature' ? ' °C' : '');

  const formattedSensorValue = isEventProperty && localizedEventValue
    ? localizedEventValue
    : typeof rawSensorValue === 'number'
      ? `${rawSensorValue}${resolvedUnit ?? ''}`
      : typeof rawSensorValue === 'string'
        ? `${rawSensorValue}${resolvedUnit ?? ''}`
        : null;

  const handleClick = async () => {
    if (isCamera && onOpenCameraStream) { onOpenCameraStream(device); return; }
    if (!isToggleable || loading) return;
    setLoading(true);
    try { await onToggle(device.id, isOn); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isCamera && onOpenCameraStream) { e.preventDefault(); e.stopPropagation(); onOpenCameraStream(device); return; }
    if ((isThermostat || isLight || isFan) && onOpenSettings) { e.preventDefault(); e.stopPropagation(); onOpenSettings(device); }
  };

  const icon = getIconForDevice(device.type);

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`device-card ${isToggleable && isOn ? 'is-on' : ''} ${isEditMode && iconHiddenState ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="device-card-top">
        <div className={`device-icon ${isOn && isToggleable ? 'is-on' : ''}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4' })}
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
          {(isThermostat || isLight || isFan) && onOpenSettings && (
            <div
              onClick={(e) => { e.stopPropagation(); onOpenSettings(device); }}
              style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              className="settings-btn"
              title={isThermostat ? 'Настройки климата' : isFan ? 'Настройки вентилятора' : 'Настройки яркости'}
            >
              <Settings className="w-3.5 h-3.5" />
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
      <div className="device-type-label">
        {loading ? 'Обновление...' : (
          temperatureValue !== null || humidityValue !== null ? (
            <>
              {temperatureValue !== null && `${temperatureValue}${temperatureUnit}`}
              {temperatureValue !== null && humidityValue !== null ? ' · ' : ''}
              {humidityValue !== null && `${humidityValue}${humidityUnit}`}
            </>
          ) : isCamera ? 'Нажмите для просмотра' : isOn ? 'Включено' : 'Отключено'
        )}
      </div>

      {isSensor && formattedSensorValue && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 'auto' }}>
          <span className="device-sensor-value">{formattedSensorValue}</span>
        </div>
      )}
    </div>
  );
};
