import { YandexDevice } from '../types/index';

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

export const isCameraDevice = (device: YandexDevice): boolean => {
    return device.type.startsWith('devices.types.camera')
        || device.capabilities.some((cap) => cap.type === 'devices.capabilities.video_stream');
};

export const isAlwaysOnDevice = (device: YandexDevice): boolean => {
    const t = device.type.toLowerCase();
    return t.includes('smart_speaker') || t.includes('hub') || t.includes('other');
};

export const isSensorDevice = (device: { type: string }): boolean => {
    return device.type.startsWith('devices.types.sensor') || device.type === 'devices.types.smart_meter';
};
