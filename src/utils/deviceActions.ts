import { YandexModeAction } from '../types/index';

export interface LightActionSettings {
    brightness?: number;
    hsv?: { h: number; s: number; v: number };
    rgb?: number;
    temperature_k?: number;
}

export function buildLightActions(settings: LightActionSettings): YandexModeAction[] {
    const actions: YandexModeAction[] = [];
    if (settings.brightness !== undefined) {
        actions.push({ instance: 'brightness', value: settings.brightness.toString(), type: 'devices.capabilities.range' });
    }
    if (settings.hsv) {
        actions.push({ instance: 'hsv', value: settings.hsv, type: 'devices.capabilities.color_setting' });
    }
    if (settings.rgb !== undefined) {
        actions.push({ instance: 'rgb', value: settings.rgb, type: 'devices.capabilities.color_setting' });
    }
    if (settings.temperature_k !== undefined) {
        actions.push({ instance: 'temperature_k', value: settings.temperature_k.toString(), type: 'devices.capabilities.color_setting' });
    }
    return actions;
}
