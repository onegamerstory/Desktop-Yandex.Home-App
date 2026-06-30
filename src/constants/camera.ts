import { YandexDevice } from '../types/index';
import { isCameraDevice } from './deviceTypes';
import { getCapabilityInstance } from './parsing';

const PRIVACY_INSTANCE_KEYS = new Set(['camera_sw_mute']);

export interface CameraPrivacyControl {
    toggleInstance?: string;
    hasOnOff: boolean;
}

export const getCameraPrivacyControl = (device: YandexDevice): CameraPrivacyControl | null => {
    if (!isCameraDevice(device)) {
        return null;
    }

    const toggleCapability = device.capabilities.find((cap) => {
        if (cap.type !== 'devices.capabilities.toggle') {
            return false;
        }
        const instance = getCapabilityInstance(cap);
        if (instance && PRIVACY_INSTANCE_KEYS.has(instance)) {
            return true;
        }
        const name = ((cap.parameters as { name?: string } | undefined)?.name ?? '').toLowerCase();
        return name.includes('приват') || name.includes('privacy');
    });

    const hasOnOff = device.capabilities.some((cap) => cap.type === 'devices.capabilities.on_off');

    if (!toggleCapability && !hasOnOff) {
        return { hasOnOff: false, toggleInstance: 'privacy' };
    }

    return {
        toggleInstance: toggleCapability
            ? (getCapabilityInstance(toggleCapability) ?? 'privacy')
            : undefined,
        hasOnOff,
    };
};

export const getCameraPrivacyCapability = (device: YandexDevice) => {
    return device.capabilities.find((cap) => {
        if (cap.type !== 'devices.capabilities.toggle') {
            return false;
        }
        const instance = getCapabilityInstance(cap);
        if (instance && PRIVACY_INSTANCE_KEYS.has(instance)) {
            return true;
        }
        const name = ((cap.parameters as { name?: string } | undefined)?.name ?? '').toLowerCase();
        return name.includes('приват') || name.includes('privacy');
    }) ?? null;
};

export const hasCameraPrivacyControl = (device: YandexDevice): boolean => {
    return getCameraPrivacyControl(device) !== null;
};

export const getCameraPrivacyInstance = (device: YandexDevice): string => {
    const control = getCameraPrivacyControl(device);
    return control?.toggleInstance ?? 'privacy';
};

export const isCameraPrivacyModeEnabled = (device: YandexDevice): boolean => {
    const toggleCapability = getCameraPrivacyCapability(device);
    if (toggleCapability?.state && toggleCapability.state.value === true) {
        return true;
    }

    const onOffCapability = device.capabilities.find((cap) => cap.type === 'devices.capabilities.on_off');
    if (onOffCapability?.state && onOffCapability.state.value === false) {
        return true;
    }

    const modeCapability = device.capabilities.find((cap) => {
        if (cap.type !== 'devices.capabilities.mode') {
            return false;
        }
        const instance = getCapabilityInstance(cap);
        const value = String(cap.state?.value ?? '');
        return PRIVACY_INSTANCE_KEYS.has(instance ?? '')
            || /privacy|private|sleep|сон|приват/i.test(value);
    });
    if (modeCapability?.state) {
        const value = String(modeCapability.state.value ?? '');
        return /privacy|private|sleep|сон|приват/i.test(value);
    }

    return false;
};

export const mergeCameraDeviceState = (iotDevice: YandexDevice, quasarDevice?: YandexDevice | null): YandexDevice => {
    if (!quasarDevice?.capabilities?.length) {
        return iotDevice;
    }

    const capabilityMap = new Map(iotDevice.capabilities.map((cap) => [cap.type + ':' + (getCapabilityInstance(cap) ?? ''), cap]));
    for (const cap of quasarDevice.capabilities) {
        capabilityMap.set(cap.type + ':' + (getCapabilityInstance(cap) ?? ''), cap);
    }

    return {
        ...iotDevice,
        ...quasarDevice,
        capabilities: Array.from(capabilityMap.values()),
    };
};
