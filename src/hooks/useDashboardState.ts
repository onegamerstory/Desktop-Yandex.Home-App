import { useState, useCallback, useEffect } from 'react';
import { YandexDevice, YandexGroup, YandexModeAction } from '../types/index';

// ---- Types ----

interface ModalState {
    showConfirmModal: boolean;
    showInfoModal: boolean;
    selectedThermostatDevice: YandexDevice | null;
    selectedLightDevice: YandexDevice | null;
    selectedFanDevice: YandexDevice | null;
    selectedLightGroup: YandexGroup | null;
    selectedThermostatGroup: YandexGroup | null;
    selectedFanGroup: YandexGroup | null;
    selectedCameraDevice: YandexDevice | null;
}

interface CollapseState {
    isScenariosCollapsed: boolean;
    isGroupsCollapsed: boolean;
    isDevicesCollapsed: boolean;
    collapsedRooms: Set<string>;
    isUnassignedDevicesCollapsed: boolean;
}

interface EditState {
    isEditMode: boolean;
    hiddenCardIds: Set<string>;
    visibilityChanges: Map<string, boolean>;
}

export interface UseDashboardStateReturn {
    // Modal
    modal: ModalState;
    openThermostatSettings: (device: YandexDevice) => void;
    closeThermostatSettings: () => void;
    openLightSettings: (device: YandexDevice) => void;
    closeLightSettings: () => void;
    openFanSettings: (device: YandexDevice) => void;
    closeFanSettings: () => void;
    openGroupLightSettings: (group: YandexGroup) => void;
    closeLightGroupSettings: () => void;
    openGroupThermostatSettings: (group: YandexGroup) => void;
    closeThermostatGroupSettings: () => void;
    openGroupFanSettings: (group: YandexGroup) => void;
    closeFanGroupSettings: () => void;
    openCameraStream: (device: YandexDevice) => void;
    closeCameraStream: () => void;
    setShowConfirmModal: (show: boolean) => void;
    setShowInfoModal: (show: boolean) => void;

    // Collapse
    collapse: CollapseState;
    toggleScenarios: () => void;
    toggleGroups: () => void;
    toggleDevices: () => void;
    toggleRoom: (roomId: string) => void;
    toggleUnassignedDevices: () => void;

    // Edit
    edit: EditState;
    toggleEditMode: () => void;
    toggleCardVisibility: (cardId: string) => void;
    getEffectiveHidden: (cardId: string) => boolean;
    getIconHiddenState: (cardId: string) => boolean;
    getEffectiveWithChanges: (cardId: string) => boolean;

    // Apply handlers
    handleApplyThermostatSettings: (modeActions: YandexModeAction[]) => Promise<void>;
    handleApplyLightBrightness: (settings: {
        brightness?: number;
        hsv?: { h: number; s: number; v: number };
        rgb?: number;
        temperature_k?: number;
    }) => Promise<void>;
    handleApplyGroupLightBrightness: (settings: {
        brightness?: number;
        hsv?: { h: number; s: number; v: number };
        rgb?: number;
        temperature_k?: number;
    }) => Promise<void>;
    handleApplyGroupThermostatSettings: (modeActions: Array<{ instance: string; value: string }>) => Promise<void>;
    handleApplyFanSettings: (modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn: boolean) => Promise<void>;
    handleApplyGroupFanSettings: (modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn: boolean) => Promise<void>;
    handleOpenDeviceSettings: (device: YandexDevice) => void;
}

// ---- Helpers (localStorage) ----

function getStorageKey(baseKey: string, householdId: string | null): string {
    if (!householdId) return baseKey;
    return `${baseKey}:household:${householdId}`;
}

function loadCollapseState(baseKey: string, householdId: string | null, defaultValue: boolean): boolean {
    try {
        const key = getStorageKey(baseKey, householdId);
        const stored = localStorage.getItem(key);
        return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
}

function saveCollapseState(baseKey: string, householdId: string | null, value: boolean): void {
    try {
        const key = getStorageKey(baseKey, householdId);
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error(e); }
}

function loadCollapsedRooms(householdId: string | null): Set<string> {
    try {
        const key = getStorageKey('dashboard:collapsedRooms', householdId);
        const stored = localStorage.getItem(key);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
}

function saveCollapsedRooms(householdId: string | null, rooms: Set<string>): void {
    try {
        const key = getStorageKey('dashboard:collapsedRooms', householdId);
        localStorage.setItem(key, JSON.stringify(Array.from(rooms)));
    } catch (e) { console.error(e); }
}

// ---- Hook ----

export function useDashboardState(
    activeHouseholdId: string | null,
    activeSidebarView: 'home' | 'room' | 'group',
    onSetDeviceMode: (deviceId: string, modeActions: YandexModeAction[], turnOn?: boolean) => Promise<void>,
    data: { devices: YandexDevice[] },
    isCameraDevice: (device: YandexDevice) => boolean,
    isLightDevice: (type: string) => boolean,
    isLightGroup: (devices: YandexDevice[]) => boolean,
): UseDashboardStateReturn {
    // --- MODAL STATE ---
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [selectedThermostatDevice, setSelectedThermostatDevice] = useState<YandexDevice | null>(null);
    const [selectedLightDevice, setSelectedLightDevice] = useState<YandexDevice | null>(null);
    const [selectedFanDevice, setSelectedFanDevice] = useState<YandexDevice | null>(null);
    const [selectedLightGroup, setSelectedLightGroup] = useState<YandexGroup | null>(null);
    const [selectedThermostatGroup, setSelectedThermostatGroup] = useState<YandexGroup | null>(null);
    const [selectedFanGroup, setSelectedFanGroup] = useState<YandexGroup | null>(null);
    const [selectedCameraDevice, setSelectedCameraDevice] = useState<YandexDevice | null>(null);

    // --- COLLAPSE STATE ---
    const [isScenariosCollapsed, setIsScenariosCollapsed] = useState(() =>
        loadCollapseState('dashboard:scenariosCollapsed', activeHouseholdId, false)
    );
    const [isGroupsCollapsed, setIsGroupsCollapsed] = useState(() =>
        loadCollapseState('dashboard:groupsCollapsed', activeHouseholdId, false)
    );
    const [isDevicesCollapsed, setIsDevicesCollapsed] = useState(() =>
        loadCollapseState('dashboard:devicesCollapsed', activeHouseholdId, false)
    );
    const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(() =>
        loadCollapsedRooms(activeHouseholdId)
    );
    const [isUnassignedDevicesCollapsed, setIsUnassignedDevicesCollapsed] = useState(() =>
        loadCollapseState('dashboard:unassignedDevicesCollapsed', activeHouseholdId, false)
    );

    // --- EDIT STATE ---
    const [isEditMode, setIsEditMode] = useState(false);

    const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(() => {
        try {
            const key = getStorageKey('dashboard:hiddenCardIds', activeHouseholdId);
            const stored = localStorage.getItem(key);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch { return new Set(); }
    });

    const [visibilityChanges, setVisibilityChanges] = useState<Map<string, boolean>>(new Map());

    const saveHiddenCardIds = (householdId: string | null, ids: Set<string>) => {
        try {
            const key = getStorageKey('dashboard:hiddenCardIds', householdId);
            localStorage.setItem(key, JSON.stringify(Array.from(ids)));
        } catch (e) { console.error(e); }
    };

    const toggleEditMode = useCallback(() => {
        setIsEditMode(prev => {
            if (prev) {
                // Exiting edit mode — apply pending changes
                const newHidden: Set<string> = new Set(hiddenCardIds);
                visibilityChanges.forEach((shouldHide, cardId) => {
                    if (shouldHide) newHidden.add(cardId);
                    else newHidden.delete(cardId);
                });
                setHiddenCardIds(newHidden);
                saveHiddenCardIds(activeHouseholdId, newHidden);
                setVisibilityChanges(new Map());
            }
            return !prev;
        });
    }, [hiddenCardIds, visibilityChanges, activeHouseholdId]);

    const getEffectiveWithChanges = useCallback((cardId: string): boolean => {
        const baseHidden = hiddenCardIds.has(cardId);
        if (visibilityChanges.has(cardId)) return visibilityChanges.get(cardId)!;
        return baseHidden;
    }, [hiddenCardIds, visibilityChanges]);

    const toggleCardVisibility = useCallback((cardId: string) => {
        setVisibilityChanges(prev => {
            const newChanges = new Map(prev);
            const currentEffective = hiddenCardIds.has(cardId);
            const pending = prev.get(cardId);
            const effective = pending !== undefined ? pending : currentEffective;
            newChanges.set(cardId, !effective);
            return newChanges;
        });
    }, [hiddenCardIds]);

    const getEffectiveHidden = useCallback((cardId: string): boolean => {
        if (isEditMode) return false;
        return hiddenCardIds.has(cardId);
    }, [isEditMode, hiddenCardIds]);

    const getIconHiddenState = useCallback((cardId: string): boolean => {
        if (isEditMode) {
            const baseHidden = hiddenCardIds.has(cardId);
            if (visibilityChanges.has(cardId)) return visibilityChanges.get(cardId)!;
            return baseHidden;
        }
        return hiddenCardIds.has(cardId);
    }, [isEditMode, hiddenCardIds, visibilityChanges]);

    // --- EFFECT: сброс edit mode при смене вида ---
    useEffect(() => {
        if (activeSidebarView !== 'home') {
            setIsEditMode(false);
        }
    }, [activeSidebarView]);

    // --- EFFECT: загрузка collapse state при смене household ---
    useEffect(() => {
        setIsScenariosCollapsed(loadCollapseState('dashboard:scenariosCollapsed', activeHouseholdId, false));
        setIsGroupsCollapsed(loadCollapseState('dashboard:groupsCollapsed', activeHouseholdId, false));
        setIsDevicesCollapsed(loadCollapseState('dashboard:devicesCollapsed', activeHouseholdId, false));
        setCollapsedRooms(loadCollapsedRooms(activeHouseholdId));
        setIsUnassignedDevicesCollapsed(loadCollapseState('dashboard:unassignedDevicesCollapsed', activeHouseholdId, false));
        try {
            const key = getStorageKey('dashboard:hiddenCardIds', activeHouseholdId);
            const stored = localStorage.getItem(key);
            setHiddenCardIds(stored ? new Set(JSON.parse(stored)) : new Set());
        } catch { setHiddenCardIds(new Set()); }
        setVisibilityChanges(new Map());
    }, [activeHouseholdId]);

    // --- Collapse toggle handlers ---
    const toggleScenarios = useCallback(() => {
        setIsScenariosCollapsed(prev => {
            const newValue = !prev;
            saveCollapseState('dashboard:scenariosCollapsed', activeHouseholdId, newValue);
            return newValue;
        });
    }, [activeHouseholdId]);

    const toggleGroups = useCallback(() => {
        setIsGroupsCollapsed(prev => {
            const newValue = !prev;
            saveCollapseState('dashboard:groupsCollapsed', activeHouseholdId, newValue);
            return newValue;
        });
    }, [activeHouseholdId]);

    const toggleDevices = useCallback(() => {
        setIsDevicesCollapsed(prev => {
            const newValue = !prev;
            saveCollapseState('dashboard:devicesCollapsed', activeHouseholdId, newValue);
            return newValue;
        });
    }, [activeHouseholdId]);

    const toggleRoom = useCallback((roomId: string) => {
        setCollapsedRooms(prev => {
            const newCollapsedRooms: Set<string> = new Set(prev);
            if (newCollapsedRooms.has(roomId)) newCollapsedRooms.delete(roomId);
            else newCollapsedRooms.add(roomId);
            saveCollapsedRooms(activeHouseholdId, newCollapsedRooms);
            return newCollapsedRooms;
        });
    }, [activeHouseholdId]);

    const toggleUnassignedDevices = useCallback(() => {
        setIsUnassignedDevicesCollapsed(prev => {
            const newValue = !prev;
            saveCollapseState('dashboard:unassignedDevicesCollapsed', activeHouseholdId, newValue);
            return newValue;
        });
    }, [activeHouseholdId]);

    // --- Modal open/close handlers ---
    const openThermostatSettings = useCallback((device: YandexDevice) => {
        setSelectedThermostatDevice(device);
    }, []);

    const closeThermostatSettings = useCallback(() => {
        setSelectedThermostatDevice(null);
    }, []);

    const openLightSettings = useCallback((device: YandexDevice) => {
        setSelectedLightDevice(device);
    }, []);

    const closeLightSettings = useCallback(() => {
        setSelectedLightDevice(null);
    }, []);

    const openFanSettings = useCallback((device: YandexDevice) => {
        setSelectedFanDevice(device);
    }, []);

    const closeFanSettings = useCallback(() => {
        setSelectedFanDevice(null);
    }, []);

    const openGroupLightSettings = useCallback((group: YandexGroup) => {
        setSelectedLightGroup(group);
    }, []);

    const closeLightGroupSettings = useCallback(() => {
        setSelectedLightGroup(null);
    }, []);

    const openGroupThermostatSettings = useCallback((group: YandexGroup) => {
        setSelectedThermostatGroup(group);
    }, []);

    const closeThermostatGroupSettings = useCallback(() => {
        setSelectedThermostatGroup(null);
    }, []);

    const openGroupFanSettings = useCallback((group: YandexGroup) => {
        setSelectedFanGroup(group);
    }, []);

    const closeFanGroupSettings = useCallback(() => {
        setSelectedFanGroup(null);
    }, []);

    const openCameraStream = useCallback((device: YandexDevice) => {
        setSelectedCameraDevice(device);
    }, []);

    const closeCameraStream = useCallback(() => {
        setSelectedCameraDevice(null);
    }, []);

    const handleOpenDeviceSettings = useCallback((device: YandexDevice) => {
        if (isCameraDevice(device)) {
            openCameraStream(device);
            return;
        }
        if (isLightDevice(device.type)) openLightSettings(device);
        else if (device.type === 'devices.types.ventilation.fan') openFanSettings(device);
        else openThermostatSettings(device);
    }, [isCameraDevice, isLightDevice, openCameraStream, openLightSettings, openFanSettings, openThermostatSettings]);

    // --- Apply handlers ---

    const handleApplyThermostatSettings = useCallback(async (modeActions: YandexModeAction[]) => {
        if (!selectedThermostatDevice) return;
        await onSetDeviceMode(selectedThermostatDevice.id, modeActions, true);
    }, [selectedThermostatDevice, onSetDeviceMode]);

    const handleApplyLightBrightness = useCallback(async (settings: {
        brightness?: number;
        hsv?: { h: number; s: number; v: number };
        rgb?: number;
        temperature_k?: number;
    }) => {
        if (!selectedLightDevice) return;
        const actions: any[] = [];
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
        if (actions.length > 0) {
            await onSetDeviceMode(selectedLightDevice.id, actions, true);
        }
    }, [selectedLightDevice, onSetDeviceMode]);

    const handleApplyGroupLightBrightness = useCallback(async (settings: {
        brightness?: number;
        hsv?: { h: number; s: number; v: number };
        rgb?: number;
        temperature_k?: number;
    }) => {
        if (!selectedLightGroup) return;
        const groupDevices = data.devices.filter(d => selectedLightGroup.devices.includes(d.id));
        if (groupDevices.length === 0) return;
        const updatePromises = groupDevices.map(async (device) => {
            const actions: any[] = [];
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
            if (actions.length > 0) {
                await onSetDeviceMode(device.id, actions, true);
            }
        });
        await Promise.all(updatePromises);
    }, [selectedLightGroup, data.devices, onSetDeviceMode]);

    const handleApplyGroupThermostatSettings = useCallback(async (modeActions: Array<{ instance: string; value: string }>) => {
        if (!selectedThermostatGroup) return;
        const groupDevices = data.devices.filter(d => selectedThermostatGroup.devices.includes(d.id));
        if (groupDevices.length === 0) return;
        const updatePromises = groupDevices.map(async (device) => {
            if (modeActions.length > 0) await onSetDeviceMode(device.id, modeActions as YandexModeAction[], true);
        });
        await Promise.all(updatePromises);
    }, [selectedThermostatGroup, data.devices, onSetDeviceMode]);

    const handleApplyFanSettings = useCallback(async (modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn: boolean = false) => {
        if (!selectedFanDevice) return;
        await onSetDeviceMode(selectedFanDevice.id, modeActions as YandexModeAction[], turnOn);
    }, [selectedFanDevice, onSetDeviceMode]);

    const handleApplyGroupFanSettings = useCallback(async (modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn: boolean = false) => {
        if (!selectedFanGroup) return;
        const groupDevices = data.devices.filter(d => selectedFanGroup.devices.includes(d.id));
        if (groupDevices.length === 0) return;
        const updatePromises = groupDevices.map(async (device) => {
            if (modeActions.length > 0) await onSetDeviceMode(device.id, modeActions as YandexModeAction[], turnOn);
        });
        await Promise.all(updatePromises);
    }, [selectedFanGroup, data.devices, onSetDeviceMode]);

    // --- EFFECT: авто-скрытие сценариев если их нет ---
    // Note: activeScenarios length check needs to be passed from Dashboard's computed data.
    // This is a placeholder that will be called from Dashboard with the right value.
    // The actual invocation will happen in Dashboard via a separate effect using this hook's
    // setIsScenariosCollapsed and saveCollapseState directly if needed.

    return {
        // Modal
        modal: {
            showConfirmModal,
            showInfoModal,
            selectedThermostatDevice,
            selectedLightDevice,
            selectedFanDevice,
            selectedLightGroup,
            selectedThermostatGroup,
            selectedFanGroup,
            selectedCameraDevice,
        },
        openThermostatSettings,
        closeThermostatSettings,
        openLightSettings,
        closeLightSettings,
        openFanSettings,
        closeFanSettings,
        openGroupLightSettings,
        closeLightGroupSettings,
        openGroupThermostatSettings,
        closeThermostatGroupSettings,
        openGroupFanSettings,
        closeFanGroupSettings,
        openCameraStream,
        closeCameraStream,
        setShowConfirmModal,
        setShowInfoModal,

        // Collapse
        collapse: {
            isScenariosCollapsed,
            isGroupsCollapsed,
            isDevicesCollapsed,
            collapsedRooms,
            isUnassignedDevicesCollapsed,
        },
        toggleScenarios,
        toggleGroups,
        toggleDevices,
        toggleRoom,
        toggleUnassignedDevices,

        // Edit
        edit: {
            isEditMode,
            hiddenCardIds,
            visibilityChanges,
        },
        toggleEditMode,
        toggleCardVisibility,
        getEffectiveHidden,
        getIconHiddenState,
        getEffectiveWithChanges,

        // Apply handlers
        handleApplyThermostatSettings,
        handleApplyLightBrightness,
        handleApplyGroupLightBrightness,
        handleApplyGroupThermostatSettings,
        handleApplyFanSettings,
        handleApplyGroupFanSettings,
        handleOpenDeviceSettings,
    };
}
