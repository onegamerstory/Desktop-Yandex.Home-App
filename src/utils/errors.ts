/**
 * Очищает сообщение об ошибке от технических префиксов Electron IPC,
 * оставляя только человеческий текст на русском языке.
 */
export function cleanErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) return 'Произошла неизвестная ошибка';

    let message = error.message;

    // Убираем префикс Electron IPC вида:
    // Error invoking remote method 'yandex-api:fetchUserInfo': Error: ...
    message = message.replace(/^Error invoking remote method\s+'[^']+':\s*Error:\s*/i, '');

    // Если после очистки остался HTTP статус код — заменяем
    if (/^\d{3}\s/.test(message) || /error_code/i.test(message)) {
        return 'Произошла ошибка при выполнении запроса. Попробуйте позже.';
    }

    return message;
}
