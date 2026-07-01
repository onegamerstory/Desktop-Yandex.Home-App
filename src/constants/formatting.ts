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

    return '';
};

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
    }) as any;

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
};

/** Emoji icons for tray display mapped by property instance */
const TRAY_INSTANCE_EMOJI: Record<string, string> = {
    temperature: '🌡️',
    humidity: '💧',
    illumination: '☀️',
    pressure: '📊',
    co2_level: '🫁',
    pm1_density: '🌬️',
    pm2_5_density: '🌬️',
    pm10_density: '🌬️',
    tvoc: '🌬️',
    battery_level: '🔋',
    water_level: '🌊',
    motion: '🚶',
    open: '🚪',
    smoke: '🔥',
    gas: '🔥',
    vibration: '📳',
    water_leak: '💧',
    button: '🔘',
};

/** Unit fallback by instance for tray */
const TRAY_UNIT_FALLBACK: Record<string, string> = {
    humidity: '%',
    temperature: '°C',
};

/**
 * Formats first 3 sensor properties for tray display.
 * Order: main (3rd property) → secondary1 (1st) → secondary2 (2nd),
 * matching the card layout.
 * @param device - The Yandex device containing properties
 * @returns Formatted string (e.g. "📊 750.00   🌡️ 24.50 °C   💧 45.00 %") or null
 */
export const formatSensorValueForTray = (device: { properties?: Array<{
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
    if (!device.properties || device.properties.length === 0) return null;

    // Extract up to 3 properties with non-empty state value (same logic as SensorCard)
    const extracted: Array<{
        instance: string;
        value: unknown;
        unit?: string;
        type: string;
        events?: Array<{ value: string; name: string }>;
    }> = [];

    for (const prop of device.properties) {
        if (extracted.length >= 3) break;
        const anyProp = prop as any;
        const type: string | undefined = anyProp?.type;
        const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
        const value: unknown = anyProp?.state?.value;
        if (typeof type !== 'string' || !type.includes('devices.properties') || !instance || value === undefined) continue;
        extracted.push({
            instance,
            value,
            unit: anyProp?.parameters?.unit ?? anyProp?.state?.unit,
            type,
            events: anyProp?.parameters?.events as Array<{ value: string; name: string }> | undefined,
        });
    }

    if (extracted.length === 0) return null;

    // Format a single property value for tray
    const formatOne = (p: typeof extracted[0]): string => {
        const emoji = TRAY_INSTANCE_EMOJI[p.instance] ?? '🔹';

        // Event properties → localized name
        if (p.type === 'devices.properties.event' && typeof p.value === 'string') {
            if (p.events && Array.isArray(p.events)) {
                const match = p.events.find(e => e.value === p.value);
                if (match) return `${emoji} ${match.name}`;
            }
            return `${emoji} ${p.value}`;
        }

        // Numbers → toFixed(2)
        if (typeof p.value === 'number') {
            const locUnit = localizeUnit(p.unit) || (TRAY_UNIT_FALLBACK[p.instance] ? ` ${TRAY_UNIT_FALLBACK[p.instance]}` : '');
            return `${emoji} ${Number(p.value).toFixed(2)}${locUnit}`;
        }

        // Boolean
        if (typeof p.value === 'boolean') {
            return `${emoji} ${p.value ? 'Да' : 'Нет'}`;
        }

        return `${emoji} ${String(p.value ?? '—')}`;
    };

    // Order: main (3rd property) → secondary1 (1st) → secondary2 (2nd)
    const ordered: typeof extracted = [];
    const mainIdx = extracted.length >= 3 ? 2 : extracted.length - 1;

    // Main first
    ordered.push(extracted[mainIdx]);
    // Then secondary1, secondary2 (skip if same as main)
    for (let i = 0; i < Math.min(extracted.length, 2); i++) {
        if (i !== mainIdx) ordered.push(extracted[i]);
    }

    return ordered.map(formatOne).join('   ');
};
