// yandex-quasar.js — сессия Quasar и видеопоток камер (HLS + WebRTC fallback)

import { CookieJar } from 'tough-cookie';
import fetchCookie from 'fetch-cookie';

const QUASAR_ACTIONS_URL = 'https://iot.quasar.yandex.ru/m/user/devices';
const QUASAR_WEBRTC_URL = 'https://iot.quasar.yandex.ru/m/v3/user/devices';

/** @type {Map<string, { fetch: typeof fetch, csrf: string }>} */
const sessionCache = new Map();

const extractCsrfToken = (html) => {
    const match = html.match(/"csrfToken2":"(.+?)"/);
    return match?.[1] ?? null;
};

/** Browser-like UA — some Yandex edges reset bare Node/Electron undici clients. */
const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * CSRF / session pages used to live at /quasar; Yandex moved them to /iot.
 * /quasar now returns empty reply / UND_ERR_SOCKET from many networks (camera
 * connects from mobile app which never hits that page).
 */
const QUASAR_STORAGE_URL = 'https://yandex.ru/iot?storage=1';
const QUASAR_CSRF_URL = 'https://yandex.ru/iot';

const drainBody = async (response) => {
    try {
        await response.arrayBuffer();
    } catch {
        /* ignore */
    }
};

/**
 * mobileproxy.passport.yandex.net returns 403 HTML for desktop Chrome UAs.
 * Keep browser UA only for yandex.ru HTML/storage pages.
 */
const PASSPORT_MOBILE_UA =
    'com.yandex.mobile.auth.sdk/7.43.1.75534 Android/12 (Google; Pixel 6)';

const parseJsonResponse = async (response, label) => {
    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();
    const trimmed = bodyText.trim();

    if (!trimmed) {
        throw new Error(`${label}: пустой ответ (HTTP ${response.status})`);
    }

    const looksLikeHtml = trimmed.startsWith('<')
        || contentType.includes('text/html');
    if (looksLikeHtml) {
        throw new Error(
            `${label}: ожидался JSON, получен HTML (HTTP ${response.status}). `
            + 'Проверьте x-token или повторите вход.',
        );
    }

    try {
        return JSON.parse(trimmed);
    } catch (error) {
        const preview = trimmed.slice(0, 80).replace(/\s+/g, ' ');
        throw new Error(
            `${label}: некорректный JSON (HTTP ${response.status}): ${preview}`,
        );
    }
};

const getQuasarSession = async (xToken) => {
    const trimmedToken = xToken.trim();
    if (sessionCache.has(trimmedToken)) {
        return sessionCache.get(trimmedToken);
    }

    const jar = new CookieJar();
    const quasarFetch = fetchCookie(fetch, jar);

    // Do NOT send desktop Chrome UA here — mobileproxy answers with 403 HTML.
    const authResponse = await fetch('https://mobileproxy.passport.yandex.net/1/bundle/auth/x_token/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'Ya-Consumer-Authorization': `OAuth ${trimmedToken}`,
            'User-Agent': PASSPORT_MOBILE_UA,
        },
        body: 'type=x-token&retpath=https%3A%2F%2Fwww.yandex.ru',
    });

    const auth = await parseJsonResponse(authResponse, 'Quasar auth');
    if (auth.status !== 'ok') {
        const details = auth.errors?.[0]?.message || auth.errors?.[0]?.code || auth.errors?.[0] || auth.status;
        throw new Error(`Quasar auth: ${details}`);
    }

    const passportHost = auth.passport_host?.replace(/\/$/, '');
    const trackId = auth.track_id;
    if (!passportHost || !trackId) {
        throw new Error('Quasar auth: неполный ответ passport');
    }

    const sessionResponse = await quasarFetch(`${passportHost}/auth/session/?track_id=${trackId}`, {
        redirect: 'manual',
        headers: { 'User-Agent': BROWSER_UA },
    });

    const location = sessionResponse.headers.get('location') || '';
    // Avoid undici keep-alive reuse of a connection with an unread redirect body.
    await drainBody(sessionResponse);
    if (!location.includes('/auth/finish')) {
        throw new Error('Quasar auth: не удалось установить сессию passport');
    }

    const storageResponse = await quasarFetch(QUASAR_STORAGE_URL, {
        headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'application/json,text/plain,*/*',
        },
    });
    const storage = await parseJsonResponse(storageResponse, 'Quasar storage');
    const uid = storage?.storage?.user?.uid;
    if (!uid) {
        throw new Error('Quasar auth: сессия не подтверждена (нет uid)');
    }

    const quasarPage = await quasarFetch(QUASAR_CSRF_URL, {
        headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });
    const html = await quasarPage.text();
    const csrf = extractCsrfToken(html);

    if (!csrf) {
        throw new Error('Не удалось получить CSRF-токен Quasar');
    }

    const session = { fetch: quasarFetch, csrf, jar };
    sessionCache.set(trimmedToken, session);
    return session;
};

const refreshCsrf = async (session) => {
    const quasarPage = await session.fetch(QUASAR_CSRF_URL, {
        headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });
    const html = await quasarPage.text();
    const csrf = extractCsrfToken(html);
    if (!csrf) {
        throw new Error('Не удалось обновить CSRF-токен Quasar');
    }
    session.csrf = csrf;
    return csrf;
};

const parseStreamFromDevices = (devices, deviceId) => {
    const device = devices?.find((item) => item.id === deviceId) ?? devices?.[0];

    if (!device) {
        throw new Error('Камера не найдена в ответе Quasar API');
    }

    if (device.error_code) {
        throw new Error(device.error_message || device.error_code);
    }

    const capability = (device.capabilities || []).find(
        (cap) => cap.type === 'devices.capabilities.video_stream',
    );

    if (!capability?.state) {
        throw new Error('Камера не вернула видеопоток');
    }

    const actionResult = capability.state.action_result;
    if (actionResult?.status === 'ERROR') {
        throw new Error(actionResult.error_message || actionResult.error_code || 'Не удалось получить видеопоток');
    }

    const streamUrl = capability.state.value?.stream_url;
    const protocol = capability.state.value?.protocol || 'hls';

    if (!streamUrl) {
        throw new Error('URL видеопотока не получен');
    }

    return { streamUrl, protocol };
};

const shouldFallbackToWebRtc = (error) => {
    const message = error?.message || '';
    return message.includes('не умеет')
        || message.includes('видеопоток')
        || message.includes('video_stream')
        || message.includes('Quasar API');
};

const requestHlsStream = async (xToken, deviceId) => {
    const { fetch: quasarFetch, csrf } = await getQuasarSession(xToken);

    const body = {
        actions: [
            {
                type: 'devices.capabilities.video_stream',
                state: {
                    instance: 'get_stream',
                    value: {
                        protocols: ['hls'],
                    },
                },
            },
        ],
    };

    const response = await quasarFetch(`${QUASAR_ACTIONS_URL}/${deviceId}/actions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Quasar API: ${response.status} ${response.statusText}`);
    }

    const data = await parseJsonResponse(response, 'Quasar HLS');

    if (data.status !== 'ok') {
        throw new Error(data.message || data.text || 'Ошибка Quasar API при запросе видеопотока');
    }

    return parseStreamFromDevices(data.devices, deviceId);
};

const requestWebrtcRoom = async (xToken, deviceId) => {
    const session = await getQuasarSession(xToken);
    const csrf = await refreshCsrf(session);

    console.log(`[Camera] POST create-room for device ${deviceId}`);

    const response = await session.fetch(`${QUASAR_WEBRTC_URL}/${deviceId}/webrtc/create-room`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf,
        },
        body: JSON.stringify({ protocol: 'whip' }),
    });

    if (!response.ok) {
        console.error(`[Camera] create-room HTTP error: ${response.status} ${response.statusText}`);
        throw new Error(`Quasar WebRTC: ${response.status} ${response.statusText}`);
    }

    const data = await parseJsonResponse(response, 'Quasar WebRTC');
    console.log('[Camera] create-room response:', JSON.stringify({
        status: data.status,
        message: data.message,
        result: data.result ? {
            service_url: data.result.service_url,
            service_name: data.result.service_name,
            room_id: data.result.room_id,
            participant_id: data.result.participant_id,
            has_jwt: !!data.result.jwt,
        } : null,
    }));

    const result = data.result;

    if (!result?.service_url) {
        throw new Error(data.message || data.text || 'Не удалось создать WebRTC-комнату');
    }

    return {
        protocol: 'webrtc',
        webrtc: {
            serviceUrl: result.service_url,
            serviceName: result.service_name,
            roomId: result.room_id,
            participantId: result.participant_id,
            credentials: result.jwt,
        },
    };
};

export const getCameraStreamFromQuasar = async (xToken, deviceId) => {
    try {
        return await requestHlsStream(xToken, deviceId);
    } catch (error) {
        if (error.message?.includes('Quasar auth')) {
            sessionCache.delete(xToken.trim());
            throw error;
        }
        if (!shouldFallbackToWebRtc(error)) {
            throw error;
        }
    }

    try {
        return await requestWebrtcRoom(xToken, deviceId);
    } catch (error) {
        if (error.message?.includes('Quasar auth')) {
            sessionCache.delete(xToken.trim());
        }
        throw error;
    }
};

export const clearQuasarSessionCache = () => {
    sessionCache.clear();
};


const PRIVACY_KEYWORDS = /приват|privacy|private|mute|сон|sleep/i;
const PRIVACY_INSTANCES = new Set(['camera_sw_mute']);

const getCapabilityInstance = (cap) => cap.parameters?.instance ?? cap.state?.instance;

const getCapabilityName = (cap) => cap.parameters?.name ?? '';

export const getQuasarDevice = async (xToken, deviceId) => {
    const session = await getQuasarSession(xToken);

    const listResponse = await session.fetch('https://iot.quasar.yandex.ru/m/v3/user/devices');
    if (listResponse.ok) {
        const listData = await parseJsonResponse(listResponse, 'Quasar devices');
        for (const house of listData.households ?? []) {
            const found = (house.all ?? []).find((item) => item.id === deviceId);
            if (found) {
                return found;
            }
        }
    } else {
        await drainBody(listResponse);
    }

    const detailResponse = await session.fetch(`${QUASAR_ACTIONS_URL}/${deviceId}`);
    if (!detailResponse.ok) {
        throw new Error(`Quasar API: ${detailResponse.status} ${detailResponse.statusText}`);
    }

    const detailData = await parseJsonResponse(detailResponse, 'Quasar device');
    if (detailData.status !== 'ok') {
        throw new Error(detailData.message || detailData.text || 'Ошибка Quasar API');
    }

    if (detailData.id === deviceId) {
        return detailData;
    }

    throw new Error('Камера не найдена в Quasar API');
};

export const buildPrivacyActionCandidates = (quasarDevice, privacyEnabled, toggleInstance = 'privacy') => {
    const candidates = [];
    const seen = new Set();
    const addCandidate = (action) => {
        const key = JSON.stringify(action);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        candidates.push(action);
    };

    for (const cap of quasarDevice?.capabilities ?? []) {
        const instance = getCapabilityInstance(cap);
        const name = getCapabilityName(cap);

        if (cap.type === 'devices.capabilities.toggle' && instance) {
            if (PRIVACY_INSTANCES.has(instance) || PRIVACY_KEYWORDS.test(name)) {
                addCandidate({
                    type: 'devices.capabilities.toggle',
                    state: { instance, value: privacyEnabled },
                });
            }
        }

        if (cap.type === 'devices.capabilities.on_off') {
            addCandidate({
                type: 'devices.capabilities.on_off',
                state: { instance: 'on', value: !privacyEnabled },
            });
        }

        if (cap.type === 'devices.capabilities.mode' && instance) {
            const modes = cap.parameters?.modes ?? [];
            const privacyMode = modes.find((mode) => PRIVACY_KEYWORDS.test(String(mode.value))
                || PRIVACY_KEYWORDS.test(String(mode.name ?? '')));
            const normalMode = modes.find((mode) => !PRIVACY_KEYWORDS.test(String(mode.value))
                && !PRIVACY_KEYWORDS.test(String(mode.name ?? '')));

            if (privacyMode && normalMode) {
                addCandidate({
                    type: 'devices.capabilities.mode',
                    state: {
                        instance,
                        value: privacyEnabled ? privacyMode.value : normalMode.value,
                    },
                });
            }
        }

        if (cap.type === 'devices.capabilities.custom.button' && instance) {
            if (PRIVACY_KEYWORDS.test(name)) {
                addCandidate({
                    type: 'devices.capabilities.custom.button',
                    state: { instance, value: true },
                });
            }
        }
    }

    if (toggleInstance) {
        addCandidate({
            type: 'devices.capabilities.toggle',
            state: { instance: toggleInstance, value: privacyEnabled },
        });
    }

    return candidates;
};

const postQuasarDeviceActions = async (session, deviceId, actions) => {
    const csrf = await refreshCsrf(session);
    const body = JSON.stringify({ actions });
    const headers = {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
    };
    const urls = [
        `${QUASAR_WEBRTC_URL}/${deviceId}/actions`,
        `${QUASAR_ACTIONS_URL}/${deviceId}/actions`,
    ];

    let lastError = null;
    for (const url of urls) {
        const response = await session.fetch(url, { method: 'POST', headers, body });
        if (!response.ok) {
            lastError = new Error(`Quasar API: ${response.status} ${response.statusText}`);
            continue;
        }

        let data;
        try {
            data = await parseJsonResponse(response, 'Quasar actions');
        } catch (error) {
            lastError = error;
            continue;
        }
        console.log(`[Quasar] ${url.includes('v3') ? 'v3' : 'v1'} response:`, JSON.stringify(data).slice(0, 400));
        if (data.status !== 'ok') {
            lastError = new Error(data.message || data.text || 'Ошибка Quasar API');
            continue;
        }

        const device = data.devices?.find((item) => item.id === deviceId) ?? data.devices?.[0];
        if (device?.error_code) {
            lastError = new Error(device.error_message || device.error_code);
            continue;
        }

        return data;
    }

    throw lastError ?? new Error('Ошибка Quasar API');
};

export const sendQuasarDeviceActions = async (xToken, deviceId, actions) => {
    const session = await getQuasarSession(xToken);
    return postQuasarDeviceActions(session, deviceId, actions);
};

export const setDeviceToggleViaQuasar = async (xToken, deviceId, instance, value) => {
    await sendQuasarDeviceActions(xToken, deviceId, [
        {
            type: 'devices.capabilities.toggle',
            state: { instance, value },
        },
    ]);
};
