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

/**
 * Formats sensor values (temperature and humidity) for tray display
 * Returns a compact string suitable for system tray menu
 * @param device - The Yandex device containing properties
 * @returns Formatted sensor value string (e.g., "24.5°C 65%") or null if no sensor data found
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
    if (!device.properties || device.properties.length === 0) {
        return null;
    }

    // Extract temperature property
    const temperatureProperty = device.properties.find(prop => {
        const anyProp = prop as any;
        const type: string | undefined = anyProp?.type;
        const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
        return type === 'devices.properties.float' && instance === 'temperature';
    }) as any;

    // Extract humidity property
    const humidityProperty = device.properties.find(prop => {
        const anyProp = prop as any;
        const type: string | undefined = anyProp?.type;
        const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
        return type === 'devices.properties.float' && instance === 'humidity';
    }) as any;

    // Get temperature value and unit
    const temperatureValue: number | null = temperatureProperty?.state?.value ?? null;
    const temperatureUnit = temperatureProperty?.parameters?.unit 
        ? localizeUnit(temperatureProperty.parameters.unit) 
        : temperatureProperty?.state?.unit 
            ? localizeUnit(temperatureProperty.state.unit)
            : '°C';

    // Get humidity value and unit
    const humidityValue: number | null = humidityProperty?.state?.value ?? null;
    const humidityUnit = humidityProperty?.parameters?.unit 
        ? localizeUnit(humidityProperty.parameters.unit)
        : humidityProperty?.state?.unit 
            ? localizeUnit(humidityProperty.state.unit)
            : '%';

    // Build the output string with icons
    const parts: string[] = [];
    if (temperatureValue !== null) {
        parts.push(`🌡️ ${temperatureValue}${temperatureUnit}`);
    }
    if (humidityValue !== null) {
        parts.push(`💧 ${humidityValue}${humidityUnit}`);
    }

    // Return null if no sensor values found, otherwise return the formatted string
    return parts.length > 0 ? parts.join(' ') : null;
};
