// yandex-api.js (Это будет чистый Node.js код)

import { getCameraStreamFromQuasar, sendQuasarDeviceActions, getQuasarDevice, buildPrivacyActionCandidates } from './yandex-quasar.js';

const BASE_URL = 'https://api.iot.yandex.net/v1.0';

// Константы для retry механизма
const RETRY_CONFIG = {
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 5000, // 5 секунд начальная задержка
};

const getRetryDelay = (attempt) => {
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s (макс 80с)
    return Math.min(RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1), 80000);
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
            
            // Если это ошибка авторизации или x-token, не повторяем попытку
            if (error.message?.includes('авторизац') || 
                error.message?.includes('Quasar auth') ||
                error.message?.includes('x-token') ||
                error.message?.includes('X_TOKEN_REQUIRED') ||
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
            
            const delay = getRetryDelay(attempt);
            console.log(`Попытка ${attempt} из ${RETRY_CONFIG.MAX_ATTEMPTS} не удалась. Повтор через ${delay / 1000} сек...`, error);
            
            // Ждем перед следующей попыткой
            await new Promise(resolve => setTimeout(resolve, delay));
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
export const executeScenario = async (token, scenarioId, onRetryAttempt = null) => {
    return withRetry(async () => {
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
    }, onRetryAttempt);
};

// 3. Переключение устройства
export const toggleDevice = async (token, deviceId, newState, onRetryAttempt = null) => {
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

    return withRetry(async () => {
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
        
        const data = await response.json();
        const deviceResult = data.devices?.find((d) => d.id === deviceId);
        if (deviceResult && 'error_code' in deviceResult) {
            throw new Error(`Ошибка устройства: ${deviceResult.error_message || deviceResult.error_code}`);
        }
    }, onRetryAttempt);
};

// 4. Установка режима устройства (для кондиционеров и других устройств с режимами)
export const setDeviceMode = async (token, deviceId, modeActions, turnOn = false, onRetryAttempt = null) => {
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
                    value: action.instance === 'temperature_k' ? Number(action.value) : action.value
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
        return {
            type: 'devices.capabilities.mode',
            state: {
                instance: action.instance,
                value: action.value
            }
        };
    });

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

    return withRetry(async () => {
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
    }, onRetryAttempt);
};

// 5. Управление группой устройств (включение/выключение всех устройств в группе)
export const toggleGroup = async (token, groupId, deviceIds, newState, onRetryAttempt = null) => {
    if (!deviceIds || deviceIds.length === 0) {
        throw new Error(`В группе нет устройств`);
    }

    const devices = deviceIds.map(id => ({
        id,
        actions: [
            {
                type: "devices.capabilities.on_off",
                state: {
                    instance: "on",
                    value: newState
                }
            }
        ]
    }));

    const body = { devices };

    return withRetry(async () => {
        const response = await fetch(`${BASE_URL}/devices/actions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Не удалось переключить группу: ${response.status}`);
        }

        const data = await response.json();
        const errors = (data.devices || []).filter(d => 'error_code' in d);
        if (errors.length > 0) {
            const firstError = errors[0];
            throw new Error(`Ошибка устройства: ${firstError.error_message || firstError.error_code}`);
        }
    }, onRetryAttempt);
};

// 6. Получение HLS-видеопотока с камеры (через Quasar API — нужен x-token, не IoT OAuth)
export const getCameraStream = async (xToken, deviceId, onRetryAttempt = null) => {
    return withRetry(async () => {
        return getCameraStreamFromQuasar(xToken, deviceId);
    }, onRetryAttempt);
};

// 7. Управление режимом приватности камеры
const sendIotDeviceAction = async (token, deviceId, action, onRetryAttempt = null) => {
    const body = {
        devices: [
            {
                id: deviceId,
                actions: [action],
            },
        ],
    };

    return withRetry(async () => {
        const response = await fetch(`${BASE_URL}/devices/actions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Не удалось изменить параметр устройства: ${response.status}`);
        }

        const data = await response.json();
        const deviceResult = data.devices?.find((d) => d.id === deviceId);
        if (deviceResult && 'error_code' in deviceResult) {
            throw new Error(deviceResult.error_message || deviceResult.error_code);
        }
    }, onRetryAttempt);
};

export const getQuasarCameraDevice = async (xToken, deviceId, onRetryAttempt = null) => {
    return withRetry(async () => getQuasarDevice(xToken, deviceId), onRetryAttempt);
};

export const setCameraPrivacyMode = async (
    iotToken,
    xToken,
    deviceId,
    privacyEnabled,
    toggleInstance = 'privacy',
    onRetryAttempt = null,
) => {
    let quasarDevice = null;
    if (xToken) {
        try {
            quasarDevice = await getQuasarDevice(xToken, deviceId);
        } catch {
            quasarDevice = null;
        }
    }

    const candidates = buildPrivacyActionCandidates(quasarDevice, privacyEnabled, toggleInstance);
    let lastError = null;

    if (xToken) {
        for (const action of candidates) {
            try {
                await sendQuasarDeviceActions(xToken, deviceId, [action]);
                return;
            } catch (error) {
                lastError = error;
            }
        }
    }

    for (const action of candidates) {
        try {
            await sendIotDeviceAction(iotToken, deviceId, action, onRetryAttempt);
            return;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError ?? new Error('Не удалось изменить режим приватности');
};