// --- Вспомогательные функции для LocalStorage ---

export const getFavorites = (key: string): string[] => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Error reading favorites from localStorage", e);
        return [];
    }
};

export const setFavorites = (key: string, ids: string[]): void => {
    try {
        localStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {
        console.error("Error saving favorites to localStorage", e);
    }
};
