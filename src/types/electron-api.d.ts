// electron-api.d.ts
import { YandexUserInfoResponse, YandexDevice, TrayMenuItem, YandexModeAction, CameraStreamResult } from './index'; 

export interface IYandexApi {
    fetchUserInfo: (token: string) => Promise<YandexUserInfoResponse>;
    fetchDevice: (token: string, deviceId: string) => Promise<YandexDevice>; 
    executeScenario: (token: string, scenarioId: string) => Promise<void>;
    toggleDevice: (token: string, deviceId: string, newState: boolean) => Promise<void>;
    toggleGroup: (token: string, groupId: string, deviceIds: string[], newState: boolean) => Promise<void>;
    setDeviceMode: (token: string, deviceId: string, modeActions: YandexModeAction[], turnOn?: boolean) => Promise<void>;
    getCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    setCameraPrivacyMode: (deviceId: string, privacyEnabled: boolean, toggleInstance?: string) => Promise<void>;
    getQuasarCameraDevice: (deviceId: string) => Promise<YandexDevice>;
	  getSecureToken: () => Promise<string | null>;
    setSecureToken: (token: string) => Promise<void>;
    deleteSecureToken: () => Promise<void>;

    hasXToken: () => Promise<boolean>;
    startQrAuth: () => Promise<{ qrUrl: string; qrDataUrl: string }>;
    pollQrAuth: () => Promise<
      | { status: 'pending' }
      | { status: 'ok'; xToken: string; displayLogin?: string }
      | { status: 'error'; message: string }
    >;
    cancelQrAuth: () => Promise<void>;

    isAutostartEnabled: () => Promise<boolean>;
    setAutostartEnabled: (enabled: boolean) => Promise<boolean>;

    sendFavoritesToTray: (favorites: TrayMenuItem[]) => void;
    onTrayCommand: (callback: (command: string, id: string, currentState?: boolean) => void) => void;
    removeTrayCommandListener: () => void;
    
    onRetryAttempt: (callback: (data: {attempt: number, maxAttempts: number, message: string}) => void) => () => void;
}

declare global {
    interface Window {
        api: IYandexApi;
    }
}
