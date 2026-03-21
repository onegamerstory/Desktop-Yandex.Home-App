// yandex-api.js (Это будет чистый Node.js код)

const BASE_URL = 'https://api.iot.yandex.net/v1.0';

// Константы для retry механизма
const RETRY_CONFIG = {
    MAX_ATTEMPTS: 5,
    RETRY_DELAY_MS: 60000, // 60 секунд
};

// Вспомогательная функция для проверки ошибок сети
const isNetworkError = (error) => {
    return error.name === 'FetchError' || 
           error.code === 'ENOTFOUND' || 
           error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT' ||
           error.message?.includes('fetch failed') ||
           error.message?.includes('network error') ||
           error.message?.includes('Ошибка сети');
};

// Вспомогательная функция для обработки ошибок
const handleFetchError = (error) => {
    // В Main Process нет CORS, так что ошибка "Failed to fetch"
    // будет означать реальную проблему с сетью (офлайн, DNS, firewall).
    if (isNetworkError(error)) {
        throw new Error('Ошибка сети. Проверьте подключение.');
    }
    throw error;
};

// Wrapper функция для retry механизма
const withRetry = async (asyncFn, onRetryAttempt = null) => {
    let lastError = null;
    
    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
        try {
            return await asyncFn();
        } catch (error) {
            lastError = error;
            
            // Если это ошибка авторизации, не повторяем попытку
            if (error.message?.includes('авторизац') || 
                error.message?.includes('401') || 
                error.message?.includes('403')) {
                throw error;
            }
            
            // Проверяем, является ли это ошибкой сети
            if (!isNetworkError(error) && attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                // Для других ошибок (не сетевых) не повторяем
                throw error;
            }
            
            if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
                // Это была последняя попытка
                break;
            }
            
            // Уведомляем о повторной попытке
            if (onRetryAttempt) {
                onRetryAttempt(attempt, RETRY_CONFIG.MAX_ATTEMPTS);
            }
            
            console.log(`Попытка ${attempt} из ${RETRY_CONFIG.MAX_ATTEMPTS} не удалась. Повтор через ${RETRY_CONFIG.RETRY_DELAY_MS / 1000} сек...`, error);
            
            // Ждем перед следующей попыткой
            await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.RETRY_DELAY_MS));
        }
    }
    
    throw lastError;
};

// 1. Получение информации о пользователе
export const fetchUserInfo = async (token, onRetryAttempt = null) => {
    return withRetry(async () => {
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
    }, onRetryAttempt);
};

// 1.1 Получение информации об устройстве по ID
export const fetchDevice = async (token, deviceId, onRetryAttempt = null) => {
    return withRetry(async () => {
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
    }, onRetryAttempt);
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
    // modeActions - массив объектов { instance: string, value: any, type?: string }
    // Например: 
    // [{ instance: "thermostat", value: "cool" }, { instance: "fan_speed", value: "auto" }] - mode
    // [{ instance: "brightness", value: "50", type: 'devices.capabilities.range' }] - range
    // [{ instance: "hsv", value: { h: 125, s: 25, v: 100 }, type: 'devices.capabilities.color_setting' }] - color
    // [{ instance: "oscillation", value: true, type: 'devices.capabilities.toggle' }] - toggle
    // turnOn - опциональный параметр для включения устройства

    // Корректно формируем actions для mode, range, color_setting и toggle
    const actions = modeActions.map(action => {
        if (action.type === 'devices.capabilities.toggle' || action.instance === 'oscillation') {
            return {
                type: 'devices.capabilities.toggle',
                state: {
                    instance: action.instance,
                    value: typeof action.value === 'string' ? action.value === 'on' || action.value === 'true' : Boolean(action.value)
                }
            };
        }
        if (action.type === 'devices.capabilities.color_setting' || action.instance === 'hsv' || action.instance === 'rgb' || action.instance === 'temperature_k') {
            return {
                type: 'devices.capabilities.color_setting',
                state: {
                    instance: action.instance,
                    value: action.instance === 'temperature_k' ? Number(action.value) : action.value // temperature_k как число, HSV и RGB как объекты
                }
            };
        }
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

// 5. Управление группой устройств (включение/выключение всех устройств в группе)
export const toggleGroup = async (token, groupId, newState) => {
    try {
        // Сначала получаем информацию о группе, чтобы узнать ID устройств
        const userInfo = await fetch(`${BASE_URL}/user/info`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        if (!userInfo.ok) {
            throw new Error(`Не удалось получить информацию о пользователе: ${userInfo.status}`);
        }

        const userData = await userInfo.json();
        const group = userData.groups?.find(g => g.id === groupId);

        if (!group) {
            throw new Error(`Группа не найдена: ${groupId}`);
        }

        if (!group.devices || group.devices.length === 0) {
            throw new Error(`В группе нет устройств`);
        }

        // Переключаем каждое устройство в группе
        const devicePromises = group.devices.map(deviceId => 
            toggleDevice(token, deviceId, newState)
        );

        await Promise.all(devicePromises);
    } catch (error) {
        handleFetchError(error);
        throw error;
    }
};