// yandex-x-token-auth.js — получение x-token через QR (как YandexStation)

import { CookieJar } from 'tough-cookie';
import fetchCookie from 'fetch-cookie';
import QRCode from 'qrcode';

const PASSPORT_CLIENT_ID = 'c0ebe342af7d48fbbbfcf2d2eedb8f9e';
const PASSPORT_CLIENT_SECRET = 'ad0a908f0aa341a182a37ecd75bc319e';

/** @type {QrAuthSession | null} */
let activeSession = null;

class QrAuthSession {
    constructor() {
        this.jar = new CookieJar();
        this.fetch = fetchCookie(fetch, this.jar);
        this.authHeaders = null;
        this.authJson = null;
    }

    async getQrUrl() {
        const pageResponse = await this.fetch('https://passport.yandex.ru/pwl-yandex');
        const pageHtml = await pageResponse.text();
        const csrfMatch = pageHtml.match(/__CSRF__ = "([^"]+)"/);
        if (!csrfMatch?.[1]) {
            throw new Error('Не удалось получить CSRF-токен Passport');
        }

        this.authHeaders = { 'X-CSRF-Token': csrfMatch[1] };

        const submitResponse = await this.fetch(
            'https://passport.yandex.ru/pwl-yandex/api/passport/auth/password/submit',
            {
                method: 'POST',
                headers: {
                    ...this.authHeaders,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ retpath: 'https://passport.yandex.ru/' }),
            },
        );
        this.authJson = await submitResponse.json();

        const magicResponse = await this.fetch(
            'https://passport.yandex.ru/pwl-yandex/api/passport/auth/magic/code',
            {
                method: 'POST',
                headers: {
                    ...this.authHeaders,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    location_id: '0',
                    magic_track_id: this.authJson.track_id,
                    track_id: '',
                }),
            },
        );
        const magic = await magicResponse.json();
        if (!magic.link) {
            throw new Error('Не удалось создать QR-код для входа');
        }
        return magic.link;
    }

    async pollLogin() {
        const statusResponse = await this.fetch(
            'https://passport.yandex.ru/pwl-yandex/api/passport/auth/magic/code/status',
            {
                method: 'POST',
                headers: {
                    ...this.authHeaders,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.authJson),
            },
        );
        const status = await statusResponse.json();

        if (status.state !== 'otp_auth_finished') {
            return { status: 'pending' };
        }

        await this.fetch(
            'https://passport.yandex.ru/pwl-yandex/api/passport/sessions/get_session',
            {
                method: 'POST',
                headers: {
                    ...this.authHeaders,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ track_id: status.trackId }),
            },
        );

        return this.exchangeCookiesForXToken();
    }

    async exchangeCookiesForXToken() {
        const cookies = await this.jar.getCookies('https://yandex.ru');
        const passportCookies = cookies.filter((cookie) => cookie.domain?.includes('yandex'));
        const cookieHeader = passportCookies.map((cookie) => `${cookie.key}=${cookie.value}`).join('; ');

        if (!cookieHeader) {
            throw new Error('Сессия Passport не установлена');
        }

        const tokenResponse = await fetch(
            'https://mobileproxy.passport.yandex.net/1/bundle/oauth/token_by_sessionid',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Ya-Client-Host': 'passport.yandex.ru',
                    'Ya-Client-Cookie': cookieHeader,
                },
                body: new URLSearchParams({
                    client_id: PASSPORT_CLIENT_ID,
                    client_secret: PASSPORT_CLIENT_SECRET,
                }),
            },
        );
        const tokenData = await tokenResponse.json();
        const xToken = tokenData.access_token;
        if (!xToken) {
            throw new Error(tokenData.error_description || 'Не удалось получить x-token');
        }

        return validateXToken(xToken);
    }
}

const validateXToken = async (xToken) => {
    const response = await fetch(
        'https://mobileproxy.passport.yandex.net/1/bundle/account/short_info/?avatar_size=islands-300',
        {
            headers: { Authorization: `OAuth ${xToken}` },
        },
    );
    const data = await response.json();
    if (data.status !== 'ok') {
        const details = data.errors?.[0]?.message || data.errors?.[0]?.code || 'invalid_token';
        throw new Error(`x-token недействителен: ${details}`);
    }
    return {
        status: 'ok',
        xToken,
        displayLogin: data.display_login,
    };
};

export const startQrAuth = async () => {
    activeSession = new QrAuthSession();
    const qrUrl = await activeSession.getQrUrl();
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 256, margin: 1 });
    return { qrUrl, qrDataUrl };
};

export const pollQrAuth = async () => {
    if (!activeSession) {
        throw new Error('QR-авторизация не запущена');
    }
    try {
        return await activeSession.pollLogin();
    } catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Ошибка QR-авторизации',
        };
    }
};

export const cancelQrAuth = () => {
    activeSession = null;
};

export const validateStoredXToken = async (xToken) => {
    try {
        const result = await validateXToken(xToken);
        return { valid: true, displayLogin: result.displayLogin };
    } catch {
        return { valid: false };
    }
};
