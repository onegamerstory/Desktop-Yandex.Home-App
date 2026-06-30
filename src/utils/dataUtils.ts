import { YandexDevice, YandexGroup, YandexRoom, YandexScenario, YandexUserInfoResponse } from '../types/index';

// --- Вспомогательная функция для сравнения версий ---
export const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
};

// --- Функция для обеспечения стабильного порядка элементов ---
export const stableSortData = (data: YandexUserInfoResponse): YandexUserInfoResponse => {
    // 1. Сортировка устройств по ID (для стабильности при переключении)
    const sortedDevices: YandexDevice[] = [...data.devices].sort((a, b) => a.id.localeCompare(b.id));

    // 2. Сортировка комнат по названию
    const sortedRooms: YandexRoom[] = [...data.rooms].sort((a, b) => a.name.localeCompare(b.name));

    // 3. Сортировка сценариев по названию
    const sortedScenarios: YandexScenario[] = [...data.scenarios].sort((a, b) => a.name.localeCompare(b.name));

    // 4. Сортировка групп по названию
    const sortedGroups: YandexGroup[] = [...data.groups].sort((a, b) => a.name.localeCompare(b.name));

    return {
        ...data,
        devices: sortedDevices,
        rooms: sortedRooms,
        scenarios: sortedScenarios,
        groups: sortedGroups,
    };
};

// Функция для проверки изменений в состоянии устройств
export const hasDeviceStateChanges = (oldData: YandexUserInfoResponse | null, newData: YandexUserInfoResponse): boolean => {
    if (!oldData) return true;

    // Создаем карты устройств для быстрого сравнения
    const oldDevicesMap = new Map(oldData.devices.map(d => [d.id, d]));
    const newDevicesMap = new Map(newData.devices.map(d => [d.id, d]));

    // Проверяем изменения в capabilities (состояния устройств)
    for (const [deviceId, newDevice] of newDevicesMap) {
        const oldDevice = oldDevicesMap.get(deviceId);
        if (!oldDevice) continue;

        // Сравниваем состояния capabilities
        const oldCapabilities = oldDevice.capabilities || [];
        const newCapabilities = newDevice.capabilities || [];

        if (oldCapabilities.length !== newCapabilities.length) return true;

        for (let i = 0; i < oldCapabilities.length; i++) {
            const oldCap = oldCapabilities[i];
            const newCap = newCapabilities[i];
            if (oldCap.type !== newCap.type) return true;
            if (JSON.stringify(oldCap.state) !== JSON.stringify(newCap.state)) return true;
        }

        // Сравниваем состояния properties (для сенсоров)
        const oldProperties = oldDevice.properties || [];
        const newProperties = newDevice.properties || [];

        if (oldProperties.length !== newProperties.length) return true;

        for (let i = 0; i < oldProperties.length; i++) {
            const oldProp = oldProperties[i] as any;
            const newProp = newProperties[i] as any;
            if (oldProp.type !== newProp.type) return true;
            if (JSON.stringify(oldProp.state) !== JSON.stringify(newProp.state)) return true;
        }
    }

    return false;
};
