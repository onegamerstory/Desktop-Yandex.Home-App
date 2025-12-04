// electron-api.d.ts
import { YandexUserInfoResponse, TrayMenuItem } from './types'; 

export interface IYandexApi {
    fetchUserInfo: (token: string) => Promise<YandexUserInfoResponse>;
    executeScenario: (token: string, scenarioId: string) => Promise<void>;
    toggleDevice: (token: string, deviceId: string, newState: boolean) => Promise<void>;
	  getSecureToken: () => Promise<string | null>;
    setSecureToken: (token: string) => Promise<void>;
    deleteSecureToken: () => Promise<void>;

    sendFavoritesToTray: (favorites: TrayMenuItem[]) => void;
    onTrayCommand: (callback: (command: string, id: string, currentState?: boolean) => void) => void;
    removeTrayCommandListener: () => void;
}

declare global {
    interface Window {
        api: IYandexApi;
    }
}

