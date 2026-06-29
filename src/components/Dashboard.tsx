import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { YandexUserInfoResponse, YandexScenario, YandexHousehold, YandexDevice, YandexGroup, YandexModeAction, CameraStreamResult } from '../types/index';
import { Sidebar } from './Sidebar';
import { ScenarioCard } from './cards/ScenarioCard';
import { DeviceCard } from './cards/DeviceCard';
import { GroupCard } from './cards/GroupCard';
import { ThermostatSettingsModal } from './modals/ThermostatSettingsModal';
import { BrightnessSettingsModal } from './modals/BrightnessSettingsModal';
import { GroupLightSettingsModal } from './modals/GroupLightSettingsModal';
import { GroupThermostatSettingsModal } from './modals/GroupThermostatSettingsModal';
import { FanSettingsModal } from './modals/FanSettingsModal';
import { GroupFanSettingsModal } from './modals/GroupFanSettingsModal';
import { CameraStreamModal } from './modals/CameraStreamModal';
import { InfoModal } from './modals/InfoModal';
import { SquareSquare, Lightbulb, X, Star, ChevronRight, ChevronDown, Building2, ScrollText, Pencil, Power, Sun, Moon, RefreshCw, Info, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { isLightDevice, isLightGroup, isCameraDevice } from '../constants';
import packageJson from '../../package.json';

const DEFAULT_HOME_NAME = 'Мой Дом';

interface DashboardProps {
  data: YandexUserInfoResponse;
  households: YandexHousehold[];
  activeHouseholdId: string | null;
  onSwitchHousehold: () => void;
  onLogout: () => void;
  onExecuteScenario: (id: string) => Promise<void>;
  onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
  onToggleGroup: (id: string, currentState: boolean) => Promise<void>;
  onSetDeviceMode: (deviceId: string, modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn?: boolean) => Promise<void>;
  onGetCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
  onSetCameraPrivacy: (deviceId: string, privacyEnabled: boolean, toggleInstance?: string) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
  favoriteDeviceIds: string[];
  onToggleDeviceFavorite: (id: string) => void;
  favoriteScenarioIds: string[];
  onToggleScenarioFavorite: (id: string) => void;
  favoriteGroupIds: string[];
  onToggleGroupFavorite: (id: string) => void;
  isAutostartEnabled: boolean;
  onToggleAutostart: () => void;
  activeSidebarView: 'home' | 'room' | 'group';
  activeRoomId: string | null;
  activeGroupId: string | null;
  onSelectHome: () => void;
  onSelectRoom: (roomId: string) => void;
  onSelectGroup: (groupId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  households,
  activeHouseholdId,
  onSwitchHousehold,
  onLogout,
  onExecuteScenario,
  onToggleDevice,
  onToggleGroup,
  onSetDeviceMode,
  onGetCameraStream,
  onSetCameraPrivacy,
  onRefresh,
  isRefreshing,
  favoriteDeviceIds,
  onToggleDeviceFavorite,
  favoriteScenarioIds,
  onToggleScenarioFavorite,
  favoriteGroupIds,
  onToggleGroupFavorite,
  isAutostartEnabled,
  onToggleAutostart,
  activeSidebarView,
  activeRoomId,
  activeGroupId,
  onSelectHome,
  onSelectRoom,
  onSelectGroup,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedThermostatDevice, setSelectedThermostatDevice] = useState<YandexDevice | null>(null);
  const [selectedLightDevice, setSelectedLightDevice] = useState<YandexDevice | null>(null);
  const [selectedFanDevice, setSelectedFanDevice] = useState<YandexDevice | null>(null);
  const [selectedLightGroup, setSelectedLightGroup] = useState<YandexGroup | null>(null);
  const [selectedThermostatGroup, setSelectedThermostatGroup] = useState<YandexGroup | null>(null);
  const [selectedFanGroup, setSelectedFanGroup] = useState<YandexGroup | null>(null);
  const [selectedCameraDevice, setSelectedCameraDevice] = useState<YandexDevice | null>(null);
  const { theme, toggleTheme } = useTheme();

  const getStorageKey = (baseKey: string, householdId: string | null): string => {
    if (!householdId) return baseKey;
    return `${baseKey}:household:${householdId}`;
  };

  const loadCollapseState = (baseKey: string, householdId: string | null, defaultValue: boolean): boolean => {
    try {
      const key = getStorageKey(baseKey, householdId);
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  };

  const saveCollapseState = (baseKey: string, householdId: string | null, value: boolean): void => {
    try {
      const key = getStorageKey(baseKey, householdId);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error(e); }
  };

  const loadCollapsedRooms = (householdId: string | null): Set<string> => {
    try {
      const key = getStorageKey('dashboard:collapsedRooms', householdId);
      const stored = localStorage.getItem(key);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  };

  const saveCollapsedRooms = (householdId: string | null, rooms: Set<string>): void => {
    try {
      const key = getStorageKey('dashboard:collapsedRooms', householdId);
      localStorage.setItem(key, JSON.stringify(Array.from(rooms)));
    } catch (e) { console.error(e); }
  };

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

  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (activeSidebarView !== 'home') {
      setIsEditMode(false);
    }
  }, [activeSidebarView]);
  
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

  const toggleEditMode = () => {
    if (isEditMode) {
      const newHidden: Set<string> = new Set(hiddenCardIds);
      visibilityChanges.forEach((shouldHide, cardId) => {
        if (shouldHide) newHidden.add(cardId);
        else newHidden.delete(cardId);
      });
      setHiddenCardIds(newHidden);
      saveHiddenCardIds(activeHouseholdId, newHidden);
      setVisibilityChanges(new Map());
    }
    setIsEditMode(prev => !prev);
  };

  const getEffectiveWithChanges = (cardId: string): boolean => {
    const baseHidden = hiddenCardIds.has(cardId);
    if (visibilityChanges.has(cardId)) return visibilityChanges.get(cardId)!;
    return baseHidden;
  };

  const toggleCardVisibility = (cardId: string) => {
    const newChanges = new Map(visibilityChanges);
    const currentEffective = getEffectiveWithChanges(cardId);
    newChanges.set(cardId, !currentEffective);
    setVisibilityChanges(newChanges);
  };

  const getEffectiveHidden = (cardId: string): boolean => {
    if (isEditMode) return false;
    return hiddenCardIds.has(cardId);
  };

  const getIconHiddenState = (cardId: string): boolean => {
    if (isEditMode) {
      const baseHidden = hiddenCardIds.has(cardId);
      if (visibilityChanges.has(cardId)) return visibilityChanges.get(cardId)!;
      return baseHidden;
    }
    return hiddenCardIds.has(cardId);
  };

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

  const toggleScenarios = () => {
    const newValue = !isScenariosCollapsed;
    setIsScenariosCollapsed(newValue);
    saveCollapseState('dashboard:scenariosCollapsed', activeHouseholdId, newValue);
  };

  const toggleGroups = () => {
    const newValue = !isGroupsCollapsed;
    setIsGroupsCollapsed(newValue);
    saveCollapseState('dashboard:groupsCollapsed', activeHouseholdId, newValue);
  };

  const toggleDevices = () => {
    const newValue = !isDevicesCollapsed;
    setIsDevicesCollapsed(newValue);
    saveCollapseState('dashboard:devicesCollapsed', activeHouseholdId, newValue);
  };

  const toggleRoom = (roomId: string) => {
    const newCollapsedRooms: Set<string> = new Set(collapsedRooms);
    if (newCollapsedRooms.has(roomId)) newCollapsedRooms.delete(roomId);
    else newCollapsedRooms.add(roomId);
    setCollapsedRooms(newCollapsedRooms);
    saveCollapsedRooms(activeHouseholdId, newCollapsedRooms);
  };

  const toggleUnassignedDevices = () => {
    const newValue = !isUnassignedDevicesCollapsed;
    setIsUnassignedDevicesCollapsed(newValue);
    saveCollapseState('dashboard:unassignedDevicesCollapsed', activeHouseholdId, newValue);
  };

  const currentHousehold = useMemo(() => {
    if (!households || households.length === 0) return null;
    if (activeHouseholdId) {
      const found = households.find(h => h.id === activeHouseholdId);
      if (found) return found;
    }
    return households[0];
  }, [households, activeHouseholdId]);

  const homeName = currentHousehold?.name || DEFAULT_HOME_NAME;
  const hasMultipleHomes = (households?.length || 0) > 1;

  const roomsForHome = useMemo(() => {
    if (!currentHousehold) return data.rooms;
    return data.rooms.filter(room => room.household_id === currentHousehold.id);
  }, [data.rooms, currentHousehold]);

  const groupsForHome = useMemo(() => {
    if (!currentHousehold) return data.groups;
    return data.groups.filter(group => group.household_id === currentHousehold.id);
  }, [data.groups, currentHousehold]);

  const roomIdsForHome = useMemo(() => new Set(roomsForHome.map(r => r.id)), [roomsForHome]);

  const devicesForHome = useMemo(() => {
    if (!currentHousehold) return data.devices;
    return data.devices.filter(device => {
      const anyDevice = device as any;
      const deviceHouseholdId: string | undefined = anyDevice.household_id;
      if (deviceHouseholdId) return deviceHouseholdId === currentHousehold.id;
      if (device.room && roomIdsForHome.has(device.room)) return true;
      return false;
    });
  }, [data.devices, currentHousehold, roomIdsForHome]);

  const deviceHouseholdMap = useMemo(() => {
    const map = new Map<string, string>();
    data.devices.forEach(device => {
      const anyDevice = device as any;
      let householdId: string | undefined =
        typeof anyDevice.household_id === 'string' ? anyDevice.household_id : undefined;
      if (!householdId && device.room) {
        const room = data.rooms.find(r => r.id === device.room);
        if (room) householdId = room.household_id;
      }
      if (householdId) map.set(device.id, householdId);
    });
    data.rooms.forEach(room => {
      room.devices.forEach(deviceId => {
        if (!map.has(deviceId)) map.set(deviceId, room.household_id);
      });
    });
    return map;
  }, [data.devices, data.rooms]);

  const isScenarioInCurrentHome = useCallback(
    (scenario: YandexScenario) => {
      if (!households || households.length <= 1) return true;
      if (!currentHousehold) return false;
      const steps = scenario.steps || [];
      const items: Array<{ id: string }> = [];
      for (const step of steps) {
        if (!step?.parameters?.items) continue;
        for (const it of step.parameters.items) items.push(it);
      }
      if (items.length === 0) return true;
      const targetHouseholdId = currentHousehold.id;
      for (const item of items) {
        const deviceId = typeof item.id === 'string' ? item.id : null;
        if (!deviceId) continue;
        if (deviceHouseholdMap.get(deviceId) === targetHouseholdId) return true;
      }
      return false;
    },
    [households, currentHousehold, deviceHouseholdMap]
  );

  const activeScenarios = data.scenarios.filter(
    s => s.is_active && isScenarioInCurrentHome(s)
  );

  const favoriteScenarios = data.scenarios.filter(
    s => favoriteScenarioIds.includes(s.id) && isScenarioInCurrentHome(s)
  );
  const favoriteDevices = devicesForHome.filter(d => favoriteDeviceIds.includes(d.id));
  const favoriteGroups = groupsForHome.filter(g => favoriteGroupIds.includes(g.id));

  const visibleFavoriteScenarios = favoriteScenarios.filter(s => !getEffectiveHidden(`scenario_${s.id}`));
  const visibleFavoriteDevices = favoriteDevices.filter(d => !getEffectiveHidden(`device_${d.id}`));
  const visibleFavoriteGroups = favoriteGroups.filter(g => !getEffectiveHidden(`group_${g.id}`));

  const hasFavorites = favoriteScenarios.length > 0 || favoriteDevices.length > 0 || favoriteGroups.length > 0;

  const handleOpenThermostatSettings = useCallback((device: YandexDevice) => {
    setSelectedThermostatDevice(device);
  }, []);

  const handleCloseThermostatSettings = useCallback(() => {
    setSelectedThermostatDevice(null);
  }, []);

  const handleApplyThermostatSettings = useCallback(async (modeActions: YandexModeAction[]) => {
    if (!selectedThermostatDevice) return;
    await onSetDeviceMode(selectedThermostatDevice.id, modeActions, true);
  }, [selectedThermostatDevice, onSetDeviceMode]);

  const handleOpenLightSettings = useCallback((device: YandexDevice) => {
    setSelectedLightDevice(device);
  }, []);

  const handleCloseLightSettings = useCallback(() => {
    setSelectedLightDevice(null);
  }, []);

  const handleOpenGroupLightSettings = useCallback((group: YandexGroup) => {
    setSelectedLightGroup(group);
  }, []);

  const handleCloseLightGroupSettings = useCallback(() => {
    setSelectedLightGroup(null);
  }, []);

  const handleOpenGroupThermostatSettings = useCallback((group: YandexGroup) => {
    setSelectedThermostatGroup(group);
  }, []);

  const handleCloseThermostatGroupSettings = useCallback(() => {
    setSelectedThermostatGroup(null);
  }, []);

  const handleOpenFanSettings = useCallback((device: YandexDevice) => {
    setSelectedFanDevice(device);
  }, []);

  const handleCloseFanSettings = useCallback(() => {
    setSelectedFanDevice(null);
  }, []);

  const handleOpenGroupFanSettings = useCallback((group: YandexGroup) => {
    setSelectedFanGroup(group);
  }, []);

  const handleCloseFanGroupSettings = useCallback(() => {
    setSelectedFanGroup(null);
  }, []);

  const handleOpenCameraStream = useCallback((device: YandexDevice) => {
    setSelectedCameraDevice(device);
  }, []);

  const handleCloseCameraStream = useCallback(() => {
    setSelectedCameraDevice(null);
  }, []);

  const handleOpenDeviceSettings = useCallback((device: YandexDevice) => {
    if (isCameraDevice(device)) {
      handleOpenCameraStream(device);
      return;
    }
    if (isLightDevice(device.type)) handleOpenLightSettings(device);
    else if (device.type === 'devices.types.ventilation.fan') handleOpenFanSettings(device);
    else handleOpenThermostatSettings(device);
  }, [handleOpenCameraStream, handleOpenFanSettings, handleOpenLightSettings, handleOpenThermostatSettings]);

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
      if (modeActions.length > 0) await onSetDeviceMode(device.id, modeActions, true);
    });
    await Promise.all(updatePromises);
  }, [selectedThermostatGroup, data.devices, onSetDeviceMode]);

  const handleApplyFanSettings = useCallback(async (modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn: boolean = false) => {
    if (!selectedFanDevice) return;
    await onSetDeviceMode(selectedFanDevice.id, modeActions, turnOn);
  }, [selectedFanDevice, onSetDeviceMode]);

  const handleApplyGroupFanSettings = useCallback(async (modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn: boolean = false) => {
    if (!selectedFanGroup) return;
    const groupDevices = data.devices.filter(d => selectedFanGroup.devices.includes(d.id));
    if (groupDevices.length === 0) return;
    const updatePromises = groupDevices.map(async (device) => {
      if (modeActions.length > 0) await onSetDeviceMode(device.id, modeActions, turnOn);
    });
    await Promise.all(updatePromises);
  }, [selectedFanGroup, data.devices, onSetDeviceMode]);

  useEffect(() => {
    const key = getStorageKey('dashboard:scenariosCollapsed', activeHouseholdId);
    const hasStoredState = localStorage.getItem(key) !== null;
    if (activeScenarios.length === 0 && !hasStoredState) {
      setIsScenariosCollapsed(true);
      saveCollapseState('dashboard:scenariosCollapsed', activeHouseholdId, true);
    }
  }, [activeScenarios.length, activeHouseholdId]);

  // Content title based on view
  const contentTitle = useMemo(() => {
    if (activeSidebarView === 'room' && activeRoomId) {
      const room = roomsForHome.find(r => r.id === activeRoomId);
      if (room) return room.name;
    }
    if (activeSidebarView === 'group' && activeGroupId) {
      const group = groupsForHome.find(g => g.id === activeGroupId);
      if (group) return group.name;
    }
    return homeName;
  }, [activeSidebarView, activeRoomId, activeGroupId, roomsForHome, groupsForHome, homeName]);

  const contentSubtitle = useMemo(() => {
    if (activeSidebarView === 'room' && activeRoomId) {
      const roomDevices = devicesForHome.filter(d => d.room === activeRoomId);
      const onCount = roomDevices.filter(d => {
        const onOff = d.capabilities.find(c => c.type === 'devices.capabilities.on_off');
        return onOff?.state?.value === true;
      }).length;
      return `${roomDevices.length} устройств, ${onCount} включено`;
    }
    if (activeSidebarView === 'group' && activeGroupId) {
      const group = groupsForHome.find(g => g.id === activeGroupId);
      if (group) {
        const groupDevices = devicesForHome.filter(d => group.devices.includes(d.id));
        const onCount = groupDevices.filter(d => {
          const onOff = d.capabilities.find(c => c.type === 'devices.capabilities.on_off');
          return onOff?.state?.value === true;
        }).length;
        return `${groupDevices.length} устройств, ${onCount} включено`;
      }
    }
    return `${devicesForHome.length} устройств в доме`;
  }, [activeSidebarView, activeRoomId, activeGroupId, devicesForHome, groupsForHome]);

  // ---- Render helpers ----
  const renderStatsRow = () => (
    <div className="stats-row">
      <div className="stat-chip">
        <Building2 /> Домов: {households.length}
      </div>
      <div className="stat-chip">
        <SquareSquare /> Комнат: {roomsForHome.length}
      </div>
      <div className="stat-chip">
        <ScrollText /> Сценариев: {activeScenarios.length}
      </div>
      <div className="stat-chip">
        <Lightbulb /> Устройств: {devicesForHome.length}
      </div>
    </div>
  );

  const renderFavoritesSection = () => {
    if (!hasFavorites) return null;
    return (
      <section className="favorites-section">
        <div className="favorites-title">
          <Star />
          <h2>Избранное</h2>
        </div>

        {visibleFavoriteScenarios.length > 0 && (
          <>
            <div className="section-header" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Сценарии</span>
                <span className="section-count">{visibleFavoriteScenarios.length}</span>
              </div>
            </div>
            <div className="scenario-grid" style={{ marginBottom: 16 }}>
              {visibleFavoriteScenarios.map(scenario => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onExecute={onExecuteScenario}
                  isFavorite={true}
                  onToggleFavorite={onToggleScenarioFavorite}
                  isEditMode={isEditMode}
                  iconHiddenState={getIconHiddenState(`scenario_${scenario.id}`)}
                  onToggleVisibility={() => toggleCardVisibility(`scenario_${scenario.id}`)}
                />
              ))}
            </div>
          </>
        )}

        {visibleFavoriteDevices.length > 0 && (
          <>
            <div className="section-header" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Устройства</span>
                <span className="section-count">{visibleFavoriteDevices.length}</span>
              </div>
            </div>
            <div className="device-grid" style={{ marginBottom: 16 }}>
              {visibleFavoriteDevices.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onToggle={onToggleDevice}
                  isFavorite={true}
                  onToggleFavorite={onToggleDeviceFavorite}
                  onOpenSettings={handleOpenDeviceSettings}
                  onOpenCameraStream={handleOpenCameraStream}
                  isEditMode={isEditMode}
                  iconHiddenState={getIconHiddenState(`device_${device.id}`)}
                  onToggleVisibility={() => toggleCardVisibility(`device_${device.id}`)}
                />
              ))}
            </div>
          </>
        )}

        {visibleFavoriteGroups.length > 0 && (
          <>
            <div className="section-header" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Группы</span>
                <span className="section-count">{visibleFavoriteGroups.length}</span>
              </div>
            </div>
            {visibleFavoriteGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                devices={devicesForHome}
                onToggleGroup={onToggleGroup}
                onToggleDevice={onToggleDevice}
                favoriteDeviceIds={favoriteDeviceIds}
                onToggleDeviceFavorite={onToggleDeviceFavorite}
                isFavorite={true}
                onToggleFavorite={onToggleGroupFavorite}
                onOpenSettings={handleOpenDeviceSettings}
                onOpenCameraStream={handleOpenCameraStream}
                onOpenGroupSettings={(g) => {
                  const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
                  if (isLightGroup(gDevices)) handleOpenGroupLightSettings(g);
                  else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) handleOpenGroupThermostatSettings(g);
                  else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) handleOpenGroupFanSettings(g);
                }}
                isEditMode={isEditMode}
                getEffectiveHidden={getEffectiveHidden}
                getIconHiddenState={getIconHiddenState}
                onToggleDeviceVisibility={toggleCardVisibility}
              />
            ))}
          </>
        )}
      </section>
    );
  };

  const renderHomeView = () => (
    <>
      {renderStatsRow()}
      {renderFavoritesSection()}

      {roomsForHome.map(room => {
        const roomDevices = devicesForHome.filter(d => room.devices.includes(d.id));
        if (roomDevices.length === 0) return null;
        const isRoomCollapsed = collapsedRooms.has(room.id);

        // Separate standalone devices and devices that belong to groups
        const groupedDeviceIds = new Set(
          groupsForHome
            .filter(g => g.devices.some(deviceId => roomDevices.some(d => d.id === deviceId)))
            .flatMap(g => g.devices)
        );
        const standaloneDevices = roomDevices.filter(d => !groupedDeviceIds.has(d.id));
        const roomGroups = groupsForHome.filter(g => g.devices.some(deviceId => roomDevices.some(d => d.id === deviceId)));

        return (
          <div key={room.id} className="room-section">
            <div className="room-header" onClick={() => toggleRoom(room.id)}>
              {isRoomCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />}
              <h2>{room.name}</h2>
              <span className="room-count">{roomDevices.length}</span>
            </div>
            {!isRoomCollapsed && (
              <>
                {standaloneDevices.length > 0 && (
                  <div className="device-grid" style={{ marginBottom: 16 }}>
                    {standaloneDevices
                      .filter(d => !getEffectiveHidden(`device_${d.id}`))
                      .map(dev => (
                        <DeviceCard
                          key={dev.id}
                          device={dev}
                          onToggle={onToggleDevice}
                          isFavorite={favoriteDeviceIds.includes(dev.id)}
                          onToggleFavorite={onToggleDeviceFavorite}
                          onOpenSettings={handleOpenDeviceSettings}
                          onOpenCameraStream={handleOpenCameraStream}
                          isEditMode={isEditMode}
                          iconHiddenState={getIconHiddenState(`device_${dev.id}`)}
                          onToggleVisibility={() => toggleCardVisibility(`device_${dev.id}`)}
                        />
                      ))}
                  </div>
                )}

                {roomGroups.map(group => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    devices={devicesForHome}
                    onToggleGroup={onToggleGroup}
                    onToggleDevice={onToggleDevice}
                    favoriteDeviceIds={favoriteDeviceIds}
                    onToggleDeviceFavorite={onToggleDeviceFavorite}
                    isFavorite={favoriteGroupIds.includes(group.id)}
                    onToggleFavorite={onToggleGroupFavorite}
                    onOpenSettings={handleOpenDeviceSettings}
                    onOpenCameraStream={handleOpenCameraStream}
                    onOpenGroupSettings={(g) => {
                      const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
                      if (isLightGroup(gDevices)) handleOpenGroupLightSettings(g);
                      else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) handleOpenGroupThermostatSettings(g);
                      else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) handleOpenGroupFanSettings(g);
                    }}
                    isEditMode={isEditMode}
                    getEffectiveHidden={getEffectiveHidden}
                    getIconHiddenState={getIconHiddenState}
                    onToggleDeviceVisibility={toggleCardVisibility}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}

      {/* Unassigned Devices */}
      {(() => {
        const assignedIds = new Set(roomsForHome.flatMap(r => r.devices));
        const unassignedDevices = devicesForHome.filter(d => !assignedIds.has(d.id));
        if (unassignedDevices.length === 0) return null;
        return (
          <div className="room-section">
            <div className="room-header" onClick={toggleUnassignedDevices}>
              {isUnassignedDevicesCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />}
              <h2>Без комнаты</h2>
              <span className="room-count">{unassignedDevices.length}</span>
            </div>
            {!isUnassignedDevicesCollapsed && (
              <div className="device-grid">
                {unassignedDevices
                  .filter(d => !getEffectiveHidden(`device_${d.id}`))
                  .map(dev => (
                    <DeviceCard
                      key={dev.id}
                      device={dev}
                      onToggle={onToggleDevice}
                      isFavorite={favoriteDeviceIds.includes(dev.id)}
                      onToggleFavorite={onToggleDeviceFavorite}
                      onOpenSettings={handleOpenDeviceSettings}
                      onOpenCameraStream={handleOpenCameraStream}
                      isEditMode={isEditMode}
                      iconHiddenState={getIconHiddenState(`device_${dev.id}`)}
                      onToggleVisibility={() => toggleCardVisibility(`device_${dev.id}`)}
                    />
                  ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Scenarios Section */}
      {activeScenarios.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="section-header">
            <button onClick={toggleScenarios} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
              {isScenariosCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />}
              <h2>Сценарии</h2>
              <span className="section-count">{activeScenarios.filter(s => !getEffectiveHidden(`scenario_${s.id}`)).length}</span>
            </button>
          </div>
          {!isScenariosCollapsed && (
            <>
              {activeScenarios.length === 0 ? (
                <div className="empty-state"><p>У вас нет активных сценариев.</p></div>
              ) : (
                <div className="scenario-grid">
                  {activeScenarios.map(scenario => {
                    const cardId = `scenario_${scenario.id}`;
                    const isHidden = getEffectiveHidden(cardId);
                    if (!isEditMode && isHidden) return null;
                    return (
                      <ScenarioCard
                        key={scenario.id}
                        scenario={scenario}
                        onExecute={onExecuteScenario}
                        isFavorite={favoriteScenarioIds.includes(scenario.id)}
                        onToggleFavorite={onToggleScenarioFavorite}
                        isEditMode={isEditMode}
                        iconHiddenState={getIconHiddenState(cardId)}
                        onToggleVisibility={() => toggleCardVisibility(cardId)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );

  const renderRoomView = () => {
    if (!activeRoomId) return null;
    const room = roomsForHome.find(r => r.id === activeRoomId);
    if (!room) return <div className="empty-state"><p>Комната не найдена</p></div>;

    const roomDevices = devicesForHome.filter(d => room.devices.includes(d.id));
    if (roomDevices.length === 0) return <div className="empty-state"><p>В этой комнате нет устройств</p></div>;

    const groupedDeviceIds = new Set(
      groupsForHome
        .filter(g => g.devices.some(deviceId => roomDevices.some(d => d.id === deviceId)))
        .flatMap(g => g.devices)
    );
    const standaloneDevices = roomDevices.filter(d => !groupedDeviceIds.has(d.id));
    const roomGroups = groupsForHome.filter(g => g.devices.some(deviceId => roomDevices.some(d => d.id === deviceId)));

    return (
      <>
        {standaloneDevices.length > 0 && (
          <div className="device-grid" style={{ marginBottom: 16 }}>
            {standaloneDevices
              .filter(d => !getEffectiveHidden(`device_${d.id}`))
              .map(dev => (
                <DeviceCard
                  key={dev.id}
                  device={dev}
                  onToggle={onToggleDevice}
                  isFavorite={favoriteDeviceIds.includes(dev.id)}
                  onToggleFavorite={onToggleDeviceFavorite}
                  onOpenSettings={handleOpenDeviceSettings}
                  onOpenCameraStream={handleOpenCameraStream}
                  isEditMode={isEditMode}
                  iconHiddenState={getIconHiddenState(`device_${dev.id}`)}
                  onToggleVisibility={() => toggleCardVisibility(`device_${dev.id}`)}
                />
              ))}
          </div>
        )}

        {roomGroups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            devices={devicesForHome}
            onToggleGroup={onToggleGroup}
            onToggleDevice={onToggleDevice}
            favoriteDeviceIds={favoriteDeviceIds}
            onToggleDeviceFavorite={onToggleDeviceFavorite}
            isFavorite={favoriteGroupIds.includes(group.id)}
            onToggleFavorite={onToggleGroupFavorite}
            onOpenSettings={handleOpenDeviceSettings}
            onOpenCameraStream={handleOpenCameraStream}
            onOpenGroupSettings={(g) => {
              const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
              if (isLightGroup(gDevices)) handleOpenGroupLightSettings(g);
              else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) handleOpenGroupThermostatSettings(g);
              else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) handleOpenGroupFanSettings(g);
            }}
            isEditMode={isEditMode}
            getEffectiveHidden={getEffectiveHidden}
            getIconHiddenState={getIconHiddenState}
            onToggleDeviceVisibility={toggleCardVisibility}
          />
        ))}
      </>
    );
  };

  const renderGroupView = () => {
    if (!activeGroupId) return null;
    const group = groupsForHome.find(g => g.id === activeGroupId);
    if (!group) return <div className="empty-state"><p>Группа не найдена</p></div>;

    const groupDevices = devicesForHome.filter(d => group.devices.includes(d.id));
    if (groupDevices.length === 0) return <div className="empty-state"><p>В этой группе нет устройств</p></div>;

    return (
      <div className="device-grid">
        {groupDevices
          .filter(d => !getEffectiveHidden(`device_${d.id}`))
          .map(dev => (
            <DeviceCard
              key={dev.id}
              device={dev}
              onToggle={onToggleDevice}
              isFavorite={favoriteDeviceIds.includes(dev.id)}
              onToggleFavorite={onToggleDeviceFavorite}
              onOpenSettings={handleOpenDeviceSettings}
              onOpenCameraStream={handleOpenCameraStream}
              isEditMode={isEditMode}
              iconHiddenState={getIconHiddenState(`device_${dev.id}`)}
              onToggleVisibility={() => toggleCardVisibility(`device_${dev.id}`)}
            />
          ))}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSidebarView) {
      case 'home':
        return renderHomeView();
      case 'room':
        return renderRoomView();
      case 'group':
        return renderGroupView();
      default:
        return renderHomeView();
    }
  };

  return (
    <div className="window">
      <div className="body">
        <Sidebar
          households={households}
          activeHouseholdId={activeHouseholdId}
          onSwitchHousehold={onSwitchHousehold}
          roomsForHome={roomsForHome}
          groupsForHome={groupsForHome}
          activeScenarios={activeScenarios}
          devicesForHome={devicesForHome}
          favoriteDeviceIds={favoriteDeviceIds}
          favoriteScenarioIds={favoriteScenarioIds}
          favoriteGroupIds={favoriteGroupIds}
          onToggleDeviceFavorite={onToggleDeviceFavorite}
          onToggleScenarioFavorite={onToggleScenarioFavorite}
          onToggleGroupFavorite={onToggleGroupFavorite}
          onExecuteScenario={onExecuteScenario}
          onToggleDevice={onToggleDevice}
          onToggleGroup={onToggleGroup}
          activeSidebarView={activeSidebarView}
          activeRoomId={activeRoomId}
          activeGroupId={activeGroupId}
          onSelectHome={onSelectHome}
          onSelectRoom={onSelectRoom}
          onSelectGroup={onSelectGroup}
        />
        <main className="content">
          <div className="content-header">
            <div>
              <h1>{contentTitle}</h1>
              <div className="subtitle">{contentSubtitle}</div>
            </div>
            {activeSidebarView === 'home' && (
              <div className="content-actions">
                <button
                  onClick={toggleEditMode}
                  className={`header-btn ${isEditMode ? 'active' : ''}`}
                  title={isEditMode ? 'Выйти из режима редактирования' : 'Редактировать дашборд'}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={onToggleAutostart}
                  className={`header-btn ${isAutostartEnabled ? 'active' : ''}`}
                  title={isAutostartEnabled ? 'Автозапуск включен' : 'Автозапуск выключен'}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleTheme}
                  className="header-btn"
                  title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="header-btn"
                  title="Обновить"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="header-btn"
                  title="О программе"
                >
                  <Info className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="header-btn"
                  title="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          {renderContent()}
        </main>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Подтверждение выхода</h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-700 dark:text-slate-300 mb-6 text-sm">
              Вы уверены, что хотите выйти из учетной записи? После этого действия для последующего входа потребуется токен.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-red-400 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                Нет
              </button>
              <button onClick={() => { onLogout(); setShowConfirmModal(false); }} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary hover:bg-[#145a72] text-white">
                Да, уверен
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedThermostatDevice && (
        <ThermostatSettingsModal
          device={selectedThermostatDevice}
          isOpen={!!selectedThermostatDevice}
          onClose={handleCloseThermostatSettings}
          onApply={handleApplyThermostatSettings}
        />
      )}

      {selectedLightDevice && (
        <BrightnessSettingsModal
          device={selectedLightDevice}
          isOpen={!!selectedLightDevice}
          onClose={handleCloseLightSettings}
          onApply={handleApplyLightBrightness}
        />
      )}

      {selectedLightGroup && (
        <GroupLightSettingsModal
          group={selectedLightGroup}
          devices={data.devices}
          isOpen={!!selectedLightGroup}
          onClose={handleCloseLightGroupSettings}
          onApply={handleApplyGroupLightBrightness}
        />
      )}

      {selectedThermostatGroup && (
        <GroupThermostatSettingsModal
          group={selectedThermostatGroup}
          devices={data.devices}
          isOpen={!!selectedThermostatGroup}
          onClose={handleCloseThermostatGroupSettings}
          onApply={handleApplyGroupThermostatSettings}
        />
      )}

      {selectedFanDevice && (
        <FanSettingsModal
          device={selectedFanDevice}
          isOpen={!!selectedFanDevice}
          onClose={handleCloseFanSettings}
          onApply={handleApplyFanSettings}
        />
      )}

      {selectedFanGroup && (
        <GroupFanSettingsModal
          group={selectedFanGroup}
          devices={data.devices}
          isOpen={!!selectedFanGroup}
          onClose={handleCloseFanGroupSettings}
          onApply={handleApplyGroupFanSettings}
        />
      )}

      {selectedCameraDevice && (
        <CameraStreamModal
          device={data.devices.find((item) => item.id === selectedCameraDevice.id) ?? selectedCameraDevice}
          isOpen={!!selectedCameraDevice}
          onClose={handleCloseCameraStream}
          onGetStream={onGetCameraStream}
          onSetPrivacy={onSetCameraPrivacy}
          onPrivacyChanged={onRefresh}
        />
      )}

      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        currentVersion={packageJson.version}
      />
    </div>
  );
};
