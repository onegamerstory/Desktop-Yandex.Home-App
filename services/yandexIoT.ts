// service.ts или component.tsx (пример использования)

import { YandexUserInfoResponse, YandexDevice, YandexRoom } from '../types';

// Используем глобально объявленный 'api'
const yandexApi = window.api;

/*
const MOCK_HUMIDITY_SENSOR_ID = 'mock-humidity-sensor';

// Вспомогательная функция для инъекции тестового датчика влажности
const injectMockHumiditySensor = (data: YandexUserInfoResponse): YandexUserInfoResponse => {
    // Нужен как минимум второй дом
    if (!data.households || data.households.length < 2) {
        return data;
    }

    // Не создаём дубль, если датчик уже есть
    if (data.devices.some(d => d.id === MOCK_HUMIDITY_SENSOR_ID)) {
        return data;
    }

    const secondHousehold = data.households[1];

    // Пытаемся привязать датчик к существующей комнате второго дома
    let targetRoom: YandexRoom | undefined = data.rooms.find(r => r.household_id === secondHousehold.id && r.name === 'Спальня');

    // Если комнаты для второго дома нет — создаём тестовую
    if (!targetRoom) {
        targetRoom = {
            id: 'mock-humidity-room',
            name: 'Комната датчиков (мок)',
            household_id: secondHousehold.id,
            devices: [],
        };
        data.rooms = [...data.rooms, targetRoom];
    }

    const humidityDevice: YandexDevice = {
        id: MOCK_HUMIDITY_SENSOR_ID,
        name: 'Датчик влажности (мок)',
        type: 'devices.types.humidity_sensor',
        room: targetRoom.id,
        groups: [],
        external_id: undefined,
        skill_id: undefined,
        capabilities: [],
        properties: [
            {
                type: 'devices.properties.float',
                retrievable: true,
                reportable: false,
                parameters: {
                    instance: 'humidity',
                    unit: '%',
                },
                state: {
                    instance: 'humidity',
                    value: 55,
                    unit: '%',
                },
            },
        ],
    };

    // Явно линкуем устройство ко второму дому через нестандартное поле household_id
    (humidityDevice as any).household_id = secondHousehold.id;

    // Добавляем устройство в общий список и в выбранную комнату
    const updatedDevices = [...data.devices, humidityDevice];
    const updatedRooms = data.rooms.map(room =>
        room.id === targetRoom!.id
            ? { ...room, devices: [...room.devices, MOCK_HUMIDITY_SENSOR_ID] }
            : room
    );

    return {
        ...data,
        devices: updatedDevices,
        rooms: updatedRooms,
    };
};
*/

export const fetchUserInfo = async (token: string): Promise<YandexUserInfoResponse> => {
    try {
        // Вызываем функцию через IPC-мост, а не fetch напрямую!
        const userInfo = await yandexApi.fetchUserInfo(token) as YandexUserInfoResponse;
        // Инъекция мок-датчика влажности для второго дома
        //return injectMockHumiditySensor(userInfo);
        return userInfo;
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