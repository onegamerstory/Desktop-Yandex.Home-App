const STORAGE_KEY = 'app:checkUpdatesOnStartup';

export function getCheckUpdatesOnStartup(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === null) return true;
        return JSON.parse(stored) === true;
    } catch {
        return true;
    }
}

export function setCheckUpdatesOnStartup(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
    } catch (e) {
        console.error('Не удалось сохранить настройку проверки обновлений', e);
    }
}
