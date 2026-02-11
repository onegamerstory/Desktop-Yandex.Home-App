import React from 'react';
import { 
  Sun, 
  Moon, 
  Zap, 
  Play, 
  Home, 
  Coffee, 
  PartyPopper, 
  Thermometer,
  Lightbulb,
  Music,
  Tv,
  Lock,
  Unlock,
  Power,
  Fan,
  ToggleLeft,
  Plug,
  AlarmSmoke,
  AirVent,
  Sunset,
  Speaker,
  ReceiptText,
  GamepadDirectional
} from 'lucide-react';

// Mapping Yandex icon strings to Lucide React Components
export const SCENARIO_ICON_MAP: Record<string, React.ReactNode> = {
  'icon_morning': <Sun className="w-8 h-8" />,
  'icon_sun': <Sun className="w-8 h-8" />,
  'icon_night': <Moon className="w-8 h-8" />,
  'icon_moon': <Moon className="w-8 h-8" />,
  'icon_party': <PartyPopper className="w-8 h-8" />,
  'icon_alarm': <Zap className="w-8 h-8" />,
  'icon_cleaning': <Home className="w-8 h-8" />, 
  'icon_coffee': <Coffee className="w-8 h-8" />,
  'icon_temp': <Thermometer className="w-8 h-8" />,
  'icon_fan': <Fan className="w-8 h-8" />,
  'icon_airvent': <AirVent className="w-8 h-8" />,
  'icon_sunset': <Sunset className="w-8 h-8" />,
  'default': <Play className="w-8 h-8" />
};

export const getIconForScenario = (iconName?: string, scenarioName?: string): React.ReactNode => {
  if (iconName && SCENARIO_ICON_MAP[iconName]) {
    return SCENARIO_ICON_MAP[iconName];
  }
  
  const lowerName = (scenarioName || '').toLowerCase();
  if (lowerName.includes('свет') || lowerName.includes('light')) return <Lightbulb className="w-8 h-8" />;
  if (lowerName.includes('музык') || lowerName.includes('music')) return <Music className="w-8 h-8" />;
  if (lowerName.includes('тв') || lowerName.includes('tv') || lowerName.includes('кино')) return <Tv className="w-8 h-8" />;
  if (lowerName.includes('утро') || lowerName.includes('morning')) return <Sun className="w-8 h-8" />;
  if (lowerName.includes('ноч') || lowerName.includes('night') || lowerName.includes('спать')) return <Moon className="w-8 h-8" />;
  if (lowerName.includes('вечер')) return <Sunset className="w-8 h-8" />;
  if (lowerName.includes('колонк') || lowerName.includes('speaker') ) return <Speaker className="w-8 h-8" />;
  if (lowerName.includes('гост') || lowerName.includes('тусов') || lowerName.includes('вечерин') || lowerName.includes('party') ) return <PartyPopper className="w-8 h-8" />;
  if (lowerName.includes('выкл') || lowerName.includes('off')) return <Power className="w-8 h-8" />;
  if (lowerName.includes('откр') || lowerName.includes('open')) return <Unlock className="w-8 h-8" />;
  if (lowerName.includes('закр') || lowerName.includes('close')) return <Lock className="w-8 h-8" />;
  if (lowerName.includes('вентилят') || lowerName.includes('fan')) return <Fan className="w-8 h-8" />;
  if (lowerName.includes('кондиц') || lowerName.includes('condit')) return <AirVent className="w-8 h-8" />;

  return SCENARIO_ICON_MAP['default'];
};

export const getIconForDevice = (type: string): React.ReactNode => {
    const t = type.toLowerCase();
    const className = "w-8 h-8";
    
    if (t.includes('light')) return <Lightbulb className={className} />;
    if (t.includes('socket')) return <Plug className={className} />;
    if (t.includes('switch')) return <ToggleLeft className={className} />;
    if (t.includes('fan') || t.includes('air')) return <Fan className={className} />;
    if (t.includes('tv') || t.includes('media')) return <Tv className={className} />;
    if (t.includes('kettle') || t.includes('coffee')) return <Coffee className={className} />;
    if (t.includes('sensor')) return <AlarmSmoke className={className} />;
    if (t.includes('thermostat')) return <AirVent className={className} />;
    if (t.includes('speaker')) return <Speaker className={className} />;
    if (t.includes('smart_meter')) return <ReceiptText className={className} />;
    if (t.includes('hub')) return <GamepadDirectional className={className} />;
    
    return <Zap className={className} />;
}

/**
 * Unit localization map for Yandex Smart Home API
 * Maps technical unit codes to user-friendly display strings
 */
export const UNIT_LOCALIZATION_MAP: Record<string, string> = {
    'unit.cubic_meter': ' м³',
    'unit.kilowatt_hour': ' кВт/ч',
    'unit.temperature.celsius': ' °C',
    'unit.illumination.lux': ' лк',
    'unit.percent': ' %',
};

/**
 * Localizes a technical unit code to a user-friendly display string
 * @param unitCode - The technical unit code (e.g., 'unit.cubic_meter')
 * @returns The localized display string (e.g., 'м³') or the original code if not found
 */
export const localizeUnit = (unitCode: string | undefined): string => {
    if (!unitCode) {
        return '';
    }
    
    // Check if the unit code exists in the localization map
    if (UNIT_LOCALIZATION_MAP[unitCode]) {
        return UNIT_LOCALIZATION_MAP[unitCode];
    }
    
    // Return empty string for unknown units (or return original code if preferred)
    return '';
}

/**
 * Formats a sensor value for display, handling both event and float properties
 * @param device - The Yandex device containing properties
 * @returns Formatted sensor value string (e.g., "24.5 °C", "закрыто", "3758.142 м³") or null if no sensor value found
 */
export const formatSensorValue = (device: { properties?: Array<{
    type?: string;
    parameters?: {
        instance?: string;
        unit?: string;
        events?: Array<{ value: string; name: string }>;
    };
    state?: {
        instance?: string;
        value?: unknown;
        unit?: string;
    };
}> }): string | null => {
    if (!device.properties || device.properties.length === 0) {
        return null;
    }

    // Find the first property with a state value
    const sensorProperty = device.properties.find(prop => {
        const anyProp = prop as any;
        const type: string | undefined = anyProp?.type;
        const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
        return (
            typeof type === 'string' &&
            type.includes('devices.properties') &&
            typeof instance === 'string' &&
            anyProp?.state?.value !== undefined
        );
    }) as any | undefined;

    if (!sensorProperty) {
        return null;
    }

    const sensorInstance: string | undefined =
        sensorProperty?.parameters?.instance ?? sensorProperty?.state?.instance;
    const rawSensorValue: unknown = sensorProperty?.state?.value;
    const rawSensorUnit: string | undefined =
        sensorProperty?.parameters?.unit ?? sensorProperty?.state?.unit;
    const propertyType: string | undefined = sensorProperty?.type;

    // Check if this is an event property that needs localization
    const isEventProperty = propertyType === 'devices.properties.event';

    // Localize event status: find the Russian name from parameters.events array
    if (isEventProperty && typeof rawSensorValue === 'string') {
        const events = sensorProperty?.parameters?.events as Array<{ value: string; name: string }> | undefined;
        if (events && Array.isArray(events)) {
            const matchingEvent = events.find(event => event.value === rawSensorValue);
            if (matchingEvent) {
                return matchingEvent.name;
            }
        }
        // Fallback to original value if no matching event found
        return rawSensorValue;
    }

    // Handle float properties with unit localization
    const localizedUnit = localizeUnit(rawSensorUnit);

    // Fallback to instance-based unit if no unit code is provided
    const resolvedUnit =
        localizedUnit ||
        (sensorInstance === 'humidity' ? ' %' : sensorInstance === 'temperature' ? ' °C' : '');

    // Format sensor value with unit
    if (typeof rawSensorValue === 'number') {
        return `${rawSensorValue}${resolvedUnit}`;
    } else if (typeof rawSensorValue === 'string') {
        return `${rawSensorValue}${resolvedUnit}`;
    }

    return null;
}

/**
 * Checks if a device type is a light device
 * Supports all light types: devices.types.light, devices.types.light.ceiling, devices.types.light.lamp, devices.types.light.strip, etc.
 * @param deviceType - The device type string
 * @returns true if the device is a light type
 */
export const isLightDevice = (deviceType: string): boolean => {
    return deviceType.startsWith('devices.types.light');
};

/**
 * Checks if a group contains only light devices
 * @param devices - Array of YandexDevice objects in the group
 * @returns true if all devices in the group are light types
 */
export const isLightGroup = (devices: Array<{ type: string }>): boolean => {
    return devices.length > 0 && devices.every(d => isLightDevice(d.type));
};