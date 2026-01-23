// yandex-api.js (Это будет чистый Node.js код)

const BASE_URL = 'https://api.iot.yandex.net/v1.0';

// Вспомогательная функция для обработки ошибок
const handleFetchError = (error) => {
    // В Main Process нет CORS, так что ошибка "Failed to fetch"
    // будет означать реальную проблему с сетью (офлайн, DNS, firewall).
    if (error.name === 'FetchError' || error.code === 'ENOTFOUND') {
        throw new Error('Ошибка сети. Проверьте подключение.');
    }
    throw error;
};

// 1. Получение информации о пользователе
export const fetchUserInfo = async (token) => {
    try {
        const response = await fetch(`${BASE_URL}/user/info`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Ошибка авторизации. Проверьте ваш токен.');
            }
            throw new Error(`Ошибка загрузки данных: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        handleFetchError(error);
        throw error;
    }
};

// 1.1 Получение информации об устройстве по ID
export const fetchDevice = async (token, deviceId) => {
    try {
        const response = await fetch(`${BASE_URL}/devices/${deviceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Ошибка авторизации. Проверьте ваш токен.');
            }
            throw new Error(`Не удалось получить устройство ${deviceId}: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        handleFetchError(error);
        throw error;
    }
};

// 2. Выполнение сценария
export const executeScenario = async (token, scenarioId) => {
    try {
        const response = await fetch(`${BASE_URL}/scenarios/${scenarioId}/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Не удалось запустить сценарий: ${response.status}`);
        }
    } catch (error) {
        handleFetchError(error);
        throw error;
    }
};

// 3. Переключение устройства
export const toggleDevice = async (token, deviceId, newState) => {
    const body = {
        devices: [
            {
                id: deviceId,
                actions: [
                    {
                        type: "devices.capabilities.on_off",
                        state: {
                            instance: "on",
                            value: newState
                        }
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetch(`${BASE_URL}/devices/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Не удалось изменить состояние устройства: ${response.status}`);
        }
        
        // ... (логика проверки ошибок в теле ответа)
        const data = await response.json();
        const deviceResult = data.devices?.find((d) => d.id === deviceId);
        if (deviceResult && 'error_code' in deviceResult) {
            throw new Error(`Ошибка устройства: ${deviceResult.error_message || deviceResult.error_code}`);
        }
    } catch (error) {
        handleFetchError(error);
        throw error;
    }
};

// 4. Установка режима устройства (для кондиционеров и других устройств с режимами)
export const setDeviceMode = async (token, deviceId, modeActions, turnOn = false) => {
    // modeActions - массив объектов { instance: string, value: string }
    // Например: [{ instance: "thermostat", value: "cool" }, { instance: "fan_speed", value: "auto" }]
    // turnOn - опциональный параметр для включения устройства

    // Корректно формируем actions для mode и range
    const actions = modeActions.map(action => {
        if (action.type === 'devices.capabilities.range' || action.instance === 'temperature' || action.instance === 'brightness') {
            return {
                type: 'devices.capabilities.range',
                state: {
                    instance: action.instance,
                    value: Number(action.value)
                }
            };
        }
        // По умолчанию mode
        return {
            type: 'devices.capabilities.mode',
            state: {
                instance: action.instance,
                value: action.value
            }
        };
    });

    // Если нужно включить устройство, добавляем действие включения
    if (turnOn) {
        actions.push({
            type: "devices.capabilities.on_off",
            state: {
                instance: "on",
                value: true
            }
        });
    }

    const body = {
        devices: [
            {
                id: deviceId,
                actions: actions
            }
        ]
    };

    try {
        const response = await fetch(`${BASE_URL}/devices/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Не удалось изменить режим устройства: ${response.status}`);
        }
        
        const data = await response.json();
        const deviceResult = data.devices?.find((d) => d.id === deviceId);
        if (deviceResult && 'error_code' in deviceResult) {
            throw new Error(`Ошибка устройства: ${deviceResult.error_message || deviceResult.error_code}`);
        }
    } catch (error) {
        handleFetchError(error);
        throw error;
    }
};