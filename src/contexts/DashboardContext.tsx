import React, { createContext, useContext } from 'react';
import { YandexUserInfoResponse, YandexHousehold, YandexDevice, YandexGroup, YandexModeAction, CameraStreamResult } from '../types/index';

export interface DashboardContextValue {
    // Данные
    data: YandexUserInfoResponse;
    households: YandexHousehold[];
    activeHouseholdId: string | null;

    // Избранное
    favoriteDeviceIds: string[];
    favoriteScenarioIds: string[];
    favoriteGroupIds: string[];
    onToggleDeviceFavorite: (id: string) => void;
    onToggleScenarioFavorite: (id: string) => void;
    onToggleGroupFavorite: (id: string) => void;

    // Действия
    onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
    onToggleGroup: (id: string, currentState: boolean) => Promise<void>;
    onExecuteScenario: (id: string) => Promise<void>;
    onSetDeviceMode: (deviceId: string, modeActions: YandexModeAction[], turnOn?: boolean) => Promise<void>;
    onGetCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    onSetCameraPrivacy: (deviceId: string, enabled: boolean, instance?: string) => Promise<void>;
    onRefresh: () => void;

    // Навигация
    activeSidebarView: 'home' | 'room' | 'group';
    activeRoomId: string | null;
    activeGroupId: string | null;
    onSelectHome: () => void;
    onSelectRoom: (roomId: string) => void;
    onSelectGroup: (groupId: string) => void;

    // UI-состояния
    isRefreshing: boolean;
    isAutostartEnabled: boolean;
    onToggleAutostart: () => void;
    onSwitchHousehold: () => void;
    onLogout: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext(): DashboardContextValue {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboardContext must be used within DashboardContext.Provider');
    }
    return context;
}

export default DashboardContext;
