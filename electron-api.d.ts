// electron-api.d.ts
import { YandexUserInfoResponse, YandexDevice, TrayMenuItem } from './types'; 

export interface IYandexApi {
    fetchUserInfo: (token: string) => Promise<YandexUserInfoResponse>;
    fetchDevice: (token: string, deviceId: string) => Promise<YandexDevice>; 
    executeScenario: (token: string, scenarioId: string) => Promise<void>;
    toggleDevice: (token: string, deviceId: string, newState: boolean) => Promise<void>;
    setDeviceMode: (token: string, deviceId: string, modeActions: Array<{ instance: string; value: string }>, turnOn?: boolean) => Promise<void>;
	  getSecureToken: () => Promise<string | null>;
    setSecureToken: (token: string) => Promise<void>;
    deleteSecureToken: () => Promise<void>;

    // Auto-launch methods
    isAutostartEnabled: () => Promise<boolean>;
    setAutostartEnabled: (enabled: boolean) => Promise<boolean>;

    sendFavoritesToTray: (favorites: TrayMenuItem[]) => void;
    onTrayCommand: (callback: (command: string, id: string, currentState?: boolean) => void) => void;
    removeTrayCommandListener: () => void;
}

declare global {
    interface Window {
        api: IYandexApi;
    }
}

