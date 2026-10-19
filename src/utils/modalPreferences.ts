export function loadModalPreferences<T extends object>(key: string): Partial<T> {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return {};
        const preferences: unknown = JSON.parse(stored);
        if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
            throw new Error('Invalid modal preference format');
        }
        return preferences as Partial<T>;
    } catch (error) {
        console.error(`Не удалось загрузить настройки модального окна (${key})`, error);
        return {};
    }
}

export function saveModalPreferences<T extends object>(key: string, preferences: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(preferences));
    } catch (error) {
        console.error(`Не удалось сохранить настройки модального окна (${key})`, error);
    }
}
