export type ShortcutTargetType = 'device' | 'scenario';

export interface DeviceShortcut {
    id: string;
    keys: string;
    targetType: ShortcutTargetType;
    targetId: string;
}

const STORAGE_KEY = 'app:deviceShortcuts';

export function getDeviceShortcuts(): DeviceShortcut[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) throw new Error('Invalid shortcut settings format');

        return parsed.filter((item): item is DeviceShortcut =>
            typeof item?.id === 'string' &&
            typeof item?.keys === 'string' &&
            (item?.targetType === 'device' || item?.targetType === 'scenario') &&
            typeof item?.targetId === 'string'
        );
    } catch (error) {
        console.error('Не удалось прочитать настройки горячих клавиш', error);
        return [];
    }
}

export function saveDeviceShortcuts(shortcuts: DeviceShortcut[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
}

export function formatKeyboardShortcut(event: KeyboardEvent): string | null {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return null;

    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Meta');

    if (!event.ctrlKey && !event.altKey && !event.metaKey) return null;

    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    return [...modifiers, key].join('+');
}
