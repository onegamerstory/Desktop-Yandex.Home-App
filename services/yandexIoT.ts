import { YandexUserInfoResponse, YandexDevice, YandexRoom, YandexGroup } from '../types';

// Используем глобально объявленный 'api'
const yandexApi = window.api;

/**
 * Инъекция мок-данных (6 примеров + 8 новых типов сенсоров)
 */
const injectComprehensiveMockDevices = (data: YandexUserInfoResponse): YandexUserInfoResponse => {
    if (!data.households || data.households.length === 0) {
        return data;
    }

    const firstHousehold = data.households[0];
    const existingDeviceIds = new Set(data.devices.map(d => d.id));

    // Helper function to create or find a room for mock devices
    const getOrCreateMockRoom = (roomId: string, roomName: string): YandexRoom => {
        let room = data.rooms.find(r => r.household_id === firstHousehold.id && r.id === roomId);
        if (!room) {
            room = {
                id: roomId,
                name: roomName,
                household_id: firstHousehold.id,
                devices: [],
            };
            data.rooms = [...data.rooms, room];
        }
        return room;
    };

    const mockDevices: YandexDevice[] = [];

    // ========== 6 EXAMPLE DEVICES FROM PROVIDED JSON ==========

    // 1. Счётчик холодной воды (DEVICE2_UUID)
    if (!existingDeviceIds.has('DEVICE2_UUID')) {
        const room1 = getOrCreateMockRoom('ROOM1_UUID', 'Комната 1');
        const device: YandexDevice = {
            id: 'DEVICE2_UUID',
            name: 'Счётчик холодной воды',
            type: 'devices.types.smart_meter.cold_water',
            room: room1.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'water_meter',
                        unit: 'unit.cubic_meter',
                    },
                    state: {
                        instance: 'water_meter',
                        value: 3758.142,
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 2. Счётчик горячей воды (DEVICE58_UUID)
    if (!existingDeviceIds.has('DEVICE58_UUID')) {
        const room5 = getOrCreateMockRoom('ROOM5_UUID', 'Комната 5');
        const device: YandexDevice = {
            id: 'DEVICE58_UUID',
            name: 'Счётчик горячей воды',
            type: 'devices.types.smart_meter.hot_water',
            room: room5.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'water_meter',
                        unit: 'unit.cubic_meter',
                    },
                    state: {
                        instance: 'water_meter',
                        value: 119.72,
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 3. Счётчик электричества (DEVICE30_UUID)
    if (!existingDeviceIds.has('DEVICE30_UUID')) {
        const room2 = getOrCreateMockRoom('ROOM2_UUID', 'Комната 2');
        const device: YandexDevice = {
            id: 'DEVICE30_UUID',
            name: 'Счётчик электричества',
            type: 'devices.types.smart_meter.electricity',
            room: room2.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'electricity_meter',
                        unit: 'unit.kilowatt_hour',
                    },
                    state: {
                        instance: 'electricity_meter',
                        value: 39233.93,
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 4. Температура в комнате (DEVICE35_UUID)
    if (!existingDeviceIds.has('DEVICE35_UUID')) {
        const room3 = getOrCreateMockRoom('ROOM3_UUID', 'Комната 3');
        const device: YandexDevice = {
            id: 'DEVICE35_UUID',
            name: 'Температура в комнате',
            type: 'devices.types.sensor',
            room: room3.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'temperature',
                        unit: 'unit.temperature.celsius',
                    },
                    state: {
                        instance: 'temperature',
                        value: 27.8,
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 5. Температура в кессоне (DEVICE10_UUID)
    if (!existingDeviceIds.has('DEVICE10_UUID')) {
        const room1 = getOrCreateMockRoom('ROOM1_UUID', 'Комната 1');
        const device: YandexDevice = {
            id: 'DEVICE10_UUID',
            name: 'Температура в кессоне',
            type: 'devices.types.sensor',
            room: room1.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'temperature',
                        unit: 'unit.temperature.celsius',
                    },
                    state: {
                        instance: 'temperature',
                        value: 8.7,
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 6. Датчик протечки воды (DEVICE22_UUID)
    if (!existingDeviceIds.has('DEVICE22_UUID')) {
        const room1 = getOrCreateMockRoom('ROOM1_UUID', 'Комната 1');
        const device: YandexDevice = {
            id: 'DEVICE22_UUID',
            name: 'Датчик протечки воды',
            type: 'devices.types.sensor',
            room: room1.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.event',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'open',
                        events: [
                            {
                                value: 'opened',
                                name: 'открыто',
                            },
                            {
                                value: 'closed',
                                name: 'закрыто',
                            },
                        ],
                    },
                    state: {
                        instance: 'open',
                        value: 'closed',
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // ========== 8 NEW SENSOR TYPES ==========

    const sensorRoom = getOrCreateMockRoom('MOCK_SENSORS_ROOM_UUID', 'Комната датчиков');

    // 7. Климатический датчик (climate)
    if (!existingDeviceIds.has('MOCK_SENSOR_CLIMATE_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_CLIMATE_UUID',
            name: 'Климатический датчик',
            type: 'devices.types.sensor.climate',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'temperature',
                        unit: 'unit.temperature.celsius',
                    },
                    state: {
                        instance: 'temperature',
                        value: 22.5,
                    },
                },
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'humidity',
                        unit: 'unit.percent',
                    },
                    state: {
                        instance: 'humidity',
                        value: 45,
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 8. Датчик газа (gas)
    if (!existingDeviceIds.has('MOCK_SENSOR_GAS_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_GAS_UUID',
            name: 'Датчик газа',
            type: 'devices.types.sensor.gas',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.event',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'gas',
                        events: [
                            {
                                value: 'normal',
                                name: 'норма',
                            },
                            {
                                value: 'detected',
                                name: 'обнаружен',
                            },
                        ],
                    },
                    state: {
                        instance: 'gas',
                        value: 'normal',
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 9. Датчик освещённости (illumination)
    if (!existingDeviceIds.has('MOCK_SENSOR_ILLUMINATION_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_ILLUMINATION_UUID',
            name: 'Датчик освещённости',
            type: 'devices.types.sensor.illumination',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.float',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'illumination',
                        unit: 'unit.illumination.lux',
                    },
                    state: {
                        instance: 'illumination',
                        value: 320,
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 10. Датчик движения (motion)
    if (!existingDeviceIds.has('MOCK_SENSOR_MOTION_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_MOTION_UUID',
            name: 'Датчик движения',
            type: 'devices.types.sensor.motion',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.event',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'motion',
                        events: [
                            {
                                value: 'detected',
                                name: 'обнаружено',
                            },
                            {
                                value: 'not_detected',
                                name: 'не обнаружено',
                            },
                        ],
                    },
                    state: {
                        instance: 'motion',
                        value: 'detected',
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 11. Датчик открытия (open)
    if (!existingDeviceIds.has('MOCK_SENSOR_OPEN_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_OPEN_UUID',
            name: 'Датчик открытия',
            type: 'devices.types.sensor.open',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.event',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'open',
                        events: [
                            {
                                value: 'opened',
                                name: 'открыто',
                            },
                            {
                                value: 'closed',
                                name: 'закрыто',
                            },
                        ],
                    },
                    state: {
                        instance: 'open',
                        value: 'closed',
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 12. Датчик дыма (smoke)
    if (!existingDeviceIds.has('MOCK_SENSOR_SMOKE_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_SMOKE_UUID',
            name: 'Датчик дыма',
            type: 'devices.types.sensor.smoke',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.event',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'smoke',
                        events: [
                            {
                                value: 'normal',
                                name: 'норма',
                            },
                            {
                                value: 'detected',
                                name: 'обнаружен',
                            },
                        ],
                    },
                    state: {
                        instance: 'smoke',
                        value: 'normal',
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 13. Датчик вибрации (vibration)
    if (!existingDeviceIds.has('MOCK_SENSOR_VIBRATION_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_VIBRATION_UUID',
            name: 'Датчик вибрации',
            type: 'devices.types.sensor.vibration',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.event',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'vibration',
                        events: [
                            {
                                value: 'normal',
                                name: 'норма',
                            },
                            {
                                value: 'detected',
                                name: 'обнаружена',
                            },
                        ],
                    },
                    state: {
                        instance: 'vibration',
                        value: 'normal',
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // 14. Датчик протечки воды (water_leak)
    if (!existingDeviceIds.has('MOCK_SENSOR_WATER_LEAK_UUID')) {
        const device: YandexDevice = {
            id: 'MOCK_SENSOR_WATER_LEAK_UUID',
            name: 'Датчик протечки воды',
            type: 'devices.types.sensor.water_leak',
            room: sensorRoom.id,
            groups: [],
            external_id: undefined,
            skill_id: undefined,
            capabilities: [],
            properties: [
                {
                    type: 'devices.properties.event',
                    reportable: true,
                    retrievable: true,
                    parameters: {
                        instance: 'water_leak',
                        events: [
                            {
                                value: 'normal',
                                name: 'норма',
                            },
                            {
                                value: 'detected',
                                name: 'обнаружена',
                            },
                        ],
                    },
                    state: {
                        instance: 'water_leak',
                        value: 'normal',
                    },
                },
            ],
        };
        (device as any).household_id = firstHousehold.id;
        mockDevices.push(device);
    }

    // If no new devices to add, return original data
    if (mockDevices.length === 0) {
        return data;
    }

    // Update devices array
    const updatedDevices = [...data.devices, ...mockDevices];

    // Update rooms to include device IDs
    const deviceIdsByRoom = new Map<string, string[]>();
    mockDevices.forEach(device => {
        if (device.room) {
            if (!deviceIdsByRoom.has(device.room)) {
                deviceIdsByRoom.set(device.room, []);
            }
            deviceIdsByRoom.get(device.room)!.push(device.id);
        }
    });

    const updatedRooms = data.rooms.map(room => {
        const newDeviceIds = deviceIdsByRoom.get(room.id);
        if (newDeviceIds && newDeviceIds.length > 0) {
            return {
                ...room,
                devices: [...room.devices, ...newDeviceIds],
            };
        }
        return room;
    });

    // Создаем мок-группы устройств
    const existingGroupIds = new Set(data.groups.map(g => g.id));
    const mockGroups = [];

    // Группа 1: Группа лампочек (если есть лампочки в мок-устройствах)
    if (!existingGroupIds.has('GROUP_LIGHTS')) {
        const lightDevices = [...data.devices, ...mockDevices].filter(d => d.type.startsWith('devices.types.light'));
        if (lightDevices.length > 0) {
            mockGroups.push({
                id: 'GROUP_LIGHTS',
                name: 'Лампочки',
                household_id: firstHousehold.id,
                devices: lightDevices.map(d => d.id),
                capabilities: [
                    {
                        type: 'devices.capabilities.on_off',
                        retrievable: true,
                        reportable: true,
                        state: {
                            instance: 'on',
                            value: false
                        }
                    }
                ]
            } as any);
        }
    }

    // Группа 2: Группа сенсоров (если есть сенсоры)
    if (!existingGroupIds.has('GROUP_SENSORS')) {
        const sensorDevices = [...data.devices, ...mockDevices].filter(d => 
            d.properties && d.properties.length > 0 && 
            d.type.includes('sensor') || d.type.includes('meter')
        );
        if (sensorDevices.length > 0) {
            mockGroups.push({
                id: 'GROUP_SENSORS',
                name: 'Датчики',
                household_id: firstHousehold.id,
                devices: sensorDevices.map(d => d.id),
                capabilities: []
            } as any);
        }
    }

    return {
        ...data,
        devices: updatedDevices,
        rooms: updatedRooms,
        groups: [...data.groups, ...mockGroups],
    };
};

export const fetchUserInfo = async (token: string): Promise<YandexUserInfoResponse> => {
    try {
        // Вызываем функцию через IPC-мост, а не fetch напрямую!
        const userInfo = await yandexApi.fetchUserInfo(token) as YandexUserInfoResponse;

        // Собираем устройства, которые есть только в rooms.devices[], но отсутствуют в devices[]
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

                // Проставляем room/household, если API их не вернул
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
        // Здесь вы получите ошибки, переданные из main.js
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

// 2. ДОБАВЛЕНО: Не хватает функции executeScenario (должна быть вызвана из App.tsx)
export const executeScenario = async (token: string, scenarioId: string): Promise<void> => {
    try {
        await yandexApi.executeScenario(token, scenarioId);
        console.log('Сценарий запущен успешно.');
    } catch (error) {
        console.error('Ошибка при запуске сценария через IPC:', error);
        throw error;
    }
};

export const setDeviceMode = async (token: string, deviceId: string, modeActions: Array<{ instance: string; value: string }>, turnOn: boolean = false): Promise<void> => {
    try {
        await yandexApi.setDeviceMode(token, deviceId, modeActions, turnOn);
        console.log('Режим устройства установлен успешно.');
    } catch (error) {
        console.error('Ошибка при установке режима устройства через IPC:', error);
        throw error;
    }
};

export const toggleGroup = async (token: string, groupId: string, newState: boolean): Promise<void> => {
    try {
        await yandexApi.toggleGroup(token, groupId, newState);
        console.log('Группа переключена успешно.');
    } catch (error) {
        console.error('Ошибка при переключении группы через IPC:', error);
        throw error;
    }
};