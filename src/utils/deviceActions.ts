import { YandexModeAction } from '../types/index';

export interface LightActionSettings {
    brightness?: number;
    hsv?: { h: number; s: number; v: number };
    rgb?: number;
    temperature_k?: number;
}

export interface LightActionRequest {
    deviceId: string;
    actionGroups: YandexModeAction[][];
}

export function buildLightActionGroups(settings: LightActionSettings): YandexModeAction[][] {
    const actionGroups: YandexModeAction[][] = [];

    if (settings.brightness !== undefined) {
        actionGroups.push([{
            instance: 'brightness',
            value: settings.brightness.toString(),
            type: 'devices.capabilities.range',
        }]);
    }

    const colorActions: YandexModeAction[] = [];
    if (settings.hsv) {
        colorActions.push({ instance: 'hsv', value: settings.hsv, type: 'devices.capabilities.color_setting' });
    }
    if (settings.rgb !== undefined) {
        colorActions.push({ instance: 'rgb', value: settings.rgb, type: 'devices.capabilities.color_setting' });
    }
    if (settings.temperature_k !== undefined) {
        colorActions.push({
            instance: 'temperature_k',
            value: settings.temperature_k.toString(),
            type: 'devices.capabilities.color_setting',
        });
    }

    if (colorActions.length > 0) actionGroups.push(colorActions);
    return actionGroups;
}
