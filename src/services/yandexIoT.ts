import { YandexUserInfoResponse, YandexDevice, YandexModeAction, CameraStreamResult } from '../types/index';

const yandexApi = window.api;

export const fetchUserInfo = async (token: string): Promise<YandexUserInfoResponse> => {
    try {
        const userInfo = await yandexApi.fetchUserInfo(token) as YandexUserInfoResponse;

        const knownDeviceIds = new Set(userInfo.devices.map(d => d.id));
        const roomDeviceIds = new Set(userInfo.rooms.flatMap(r => r.devices));
        const missingDeviceIds = Array.from(roomDeviceIds).filter(id => !knownDeviceIds.has(id));

        if (missingDeviceIds.length === 0) {
            return userInfo;
        }

        const fetchedDevices: YandexDevice[] = [];

        for (const deviceId of missingDeviceIds) {
            try {
                const device = await yandexApi.fetchDevice(token, deviceId) as YandexDevice;

                const room = userInfo.rooms.find(r => r.devices.includes(deviceId));
                if (room) {
                    if (!device.room) {
                        device.room = room.id;
                    }
                    const anyDevice = device as any;
                    if (!anyDevice.household_id) {
                        anyDevice.household_id = room.household_id;
                    }
                }

                fetchedDevices.push(device);
            } catch (error) {
                console.warn(`Не удалось загрузить устройство ${deviceId}:`, error);
            }
        }

        return {
            ...userInfo,
            devices: [...userInfo.devices, ...fetchedDevices],
        };
    } catch (error) {
        console.error('Ошибка при загрузке данных через IPC:', error);
        throw error;
    }
};

export const toggleDevice = async (token: string, deviceId: string, newState: boolean): Promise<void> => {
    try {
        await yandexApi.toggleDevice(token, deviceId, newState);
        console.log('Устройство переключено успешно.');
    } catch (error) {
        console.error('Ошибка при переключении устройства через IPC:', error);
        throw error;
    }
};

export const executeScenario = async (token: string, scenarioId: string): Promise<void> => {
    try {
        await yandexApi.executeScenario(token, scenarioId);
        console.log('Сценарий запущен успешно.');
    } catch (error) {
        console.error('Ошибка при запуске сценария через IPC:', error);
        throw error;
    }
};

export const setDeviceMode = async (token: string, deviceId: string, modeActions: YandexModeAction[], turnOn: boolean = false): Promise<void> => {
    try {
        await yandexApi.setDeviceMode(token, deviceId, modeActions, turnOn);
    } catch (error) {
        console.error('Ошибка при установке режима устройства через IPC:', error);
        throw error;
    }
};

export const toggleGroup = async (token: string, groupId: string, deviceIds: string[], newState: boolean): Promise<void> => {
    try {
        await yandexApi.toggleGroup(token, groupId, deviceIds, newState);
        console.log('Группа переключена успешно.');
    } catch (error) {
        console.error('Ошибка при переключении группы через IPC:', error);
        throw error;
    }
};

export const getCameraStream = async (deviceId: string): Promise<CameraStreamResult> => {
    try {
        return await yandexApi.getCameraStream(deviceId);
    } catch (error) {
        console.error('Ошибка при получении видеопотока через IPC:', error);
        throw error;
    }
};

export const setCameraPrivacyMode = async (
    deviceId: string,
    privacyEnabled: boolean,
    toggleInstance = 'privacy',
): Promise<void> => {
    try {
        await yandexApi.setCameraPrivacyMode(deviceId, privacyEnabled, toggleInstance);
    } catch (error) {
        console.error('Ошибка при изменении режима приватности камеры:', error);
        throw error;
    }
};

export const getQuasarCameraDevice = async (deviceId: string): Promise<YandexDevice> => {
    try {
        return await yandexApi.getQuasarCameraDevice(deviceId);
    } catch (error) {
        console.error('Ошибка при получении камеры из Quasar:', error);
        throw error;
    }
};
