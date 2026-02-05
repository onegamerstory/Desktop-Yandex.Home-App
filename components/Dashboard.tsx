import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { YandexUserInfoResponse, YandexScenario, YandexHousehold, YandexDevice, YandexGroup } from '../types';
import { ScenarioCard } from './ScenarioCard';
import { DeviceCard } from './DeviceCard';
import { GroupCard } from './GroupCard';
import { ThermostatSettingsModal } from './ThermostatSettingsModal';
import { BrightnessSettingsModal } from './BrightnessSettingsModal';
import { GroupLightSettingsModal } from './GroupLightSettingsModal';
import { GroupThermostatSettingsModal } from './GroupThermostatSettingsModal';
import { LogOut, Home, Layers, MonitorSmartphone, RefreshCw, X, Star, Sun, Moon, ChevronRight, ChevronDown, ChevronUp, Power } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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
  onSetDeviceMode: (deviceId: string, modeActions: Array<{ instance: string; value: string }>, turnOn?: boolean) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
  favoriteDeviceIds: string[];
  onToggleDeviceFavorite: (id: string) => void;
  favoriteScenarioIds: string[];
  onToggleScenarioFavorite: (id: string) => void;
  isAutostartEnabled: boolean;
  onToggleAutostart: () => void;
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
  onRefresh,
  isRefreshing,
  favoriteDeviceIds,
  onToggleDeviceFavorite,
  favoriteScenarioIds,
  onToggleScenarioFavorite,
  isAutostartEnabled,
  onToggleAutostart,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedThermostatDevice, setSelectedThermostatDevice] = useState<YandexDevice | null>(null);
  const [selectedLightDevice, setSelectedLightDevice] = useState<YandexDevice | null>(null);
  const [selectedLightGroup, setSelectedLightGroup] = useState<YandexGroup | null>(null);
  const [selectedThermostatGroup, setSelectedThermostatGroup] = useState<YandexGroup | null>(null);
  const { theme, toggleTheme } = useTheme();

  // Вспомогательные функции для работы с localStorage с учетом householdId
  const getStorageKey = (baseKey: string, householdId: string | null): string => {
    if (!householdId) return baseKey;
    return `${baseKey}:household:${householdId}`;
  };

  const loadCollapseState = (baseKey: string, householdId: string | null, defaultValue: boolean): boolean => {
    try {
      const key = getStorageKey(baseKey, householdId);
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  const saveCollapseState = (baseKey: string, householdId: string | null, value: boolean): void => {
    try {
      const key = getStorageKey(baseKey, householdId);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving collapse state for ${baseKey}:`, e);
    }
  };

  const loadCollapsedRooms = (householdId: string | null): Set<string> => {
    try {
      const key = getStorageKey('dashboard:collapsedRooms', householdId);
      const stored = localStorage.getItem(key);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  };

  const saveCollapsedRooms = (householdId: string | null, rooms: Set<string>): void => {
    try {
      const key = getStorageKey('dashboard:collapsedRooms', householdId);
      localStorage.setItem(key, JSON.stringify(Array.from(rooms)));
    } catch (e) {
      console.error('Error saving collapsed rooms:', e);
    }
  };

  // Состояние сворачивания секций (загружаем из localStorage с учетом текущего дома)
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

  // Обновляем состояние вкладок при переключении дома
  useEffect(() => {
    setIsScenariosCollapsed(loadCollapseState('dashboard:scenariosCollapsed', activeHouseholdId, false));
    setIsGroupsCollapsed(loadCollapseState('dashboard:groupsCollapsed', activeHouseholdId, false));
    setIsDevicesCollapsed(loadCollapseState('dashboard:devicesCollapsed', activeHouseholdId, false));
    setCollapsedRooms(loadCollapsedRooms(activeHouseholdId));
    setIsUnassignedDevicesCollapsed(loadCollapseState('dashboard:unassignedDevicesCollapsed', activeHouseholdId, false));
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
    const newCollapsedRooms = new Set(collapsedRooms);
    if (newCollapsedRooms.has(roomId)) {
      newCollapsedRooms.delete(roomId);
    } else {
      newCollapsedRooms.add(roomId);
    }
    setCollapsedRooms(newCollapsedRooms);
    saveCollapsedRooms(activeHouseholdId, newCollapsedRooms);
  };

  const toggleUnassignedDevices = () => {
    const newValue = !isUnassignedDevicesCollapsed;
    setIsUnassignedDevicesCollapsed(newValue);
    saveCollapseState('dashboard:unassignedDevicesCollapsed', activeHouseholdId, newValue);
  };

  // Текущий дом и индикатор наличия нескольких домов
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

  // Фильтрация сущностей по текущему дому
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

      if (deviceHouseholdId) {
        return deviceHouseholdId === currentHousehold.id;
      }

      // Если household_id нет, привязываем устройство к дому через комнату
      if (device.room && roomIdsForHome.has(device.room)) {
        return true;
      }

      return false;
    });
  }, [data.devices, currentHousehold, roomIdsForHome]);

  // Карта соответствия deviceId -> householdId (по данным устройств и комнат)
  const deviceHouseholdMap = useMemo(() => {
    const map = new Map<string, string>();

    data.devices.forEach(device => {
      const anyDevice = device as any;
      let householdId: string | undefined =
        typeof anyDevice.household_id === 'string' ? anyDevice.household_id : undefined;

      if (!householdId && device.room) {
        const room = data.rooms.find(r => r.id === device.room);
        if (room) {
          householdId = room.household_id;
        }
      }

      if (householdId) {
        map.set(device.id, householdId);
      }
    });

    // Дополняем карту устройствами, которые есть только в списке комнат
    data.rooms.forEach(room => {
      const householdId = room.household_id;
      room.devices.forEach(deviceId => {
        if (!map.has(deviceId)) {
          map.set(deviceId, householdId);
        }
      });
    });

    return map;
  }, [data.devices, data.rooms]);

  const isScenarioInCurrentHome = useCallback(
    (scenario: YandexScenario) => {
      // Если API не вернул несколько домов, оставляем поведение "один дом" и не фильтруем.
      if (!households || households.length <= 1) {
        return true;
      }

      // В режиме нескольких домов сценарий должен быть жёстко привязан к дому через устройства.
      if (!currentHousehold) return false;

      const anyScenario = scenario as any;
      const steps: any[] = Array.isArray(anyScenario.steps) ? anyScenario.steps : [];

      // Собираем items из steps[].parameters.items[]
      const items: any[] = [];
      for (const step of steps) {
        const parameters = step?.parameters;
        if (!parameters) continue;

        const stepItems: any[] = Array.isArray(parameters.items) ? parameters.items : [];
        for (const it of stepItems) {
          items.push(it);
        }
      }

      // Если в сценарии нет корректных items/id устройств — сценарий считается "ничейным" и исключается.
      if (items.length === 0) return false;

      const targetHouseholdId = currentHousehold.id;

      for (const item of items) {
        const deviceId = item && typeof item.id === 'string' ? item.id : null;
        if (!deviceId) continue;

        const deviceHouseholdId = deviceHouseholdMap.get(deviceId);
        if (deviceHouseholdId === targetHouseholdId) {
          return true;
        }
      }

      // Ни одно из устройств сценария не относится к текущему дому — исключаем сценарий.
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

  const hasFavorites = favoriteScenarios.length > 0 || favoriteDevices.length > 0;

  const handleOpenThermostatSettings = useCallback((device: YandexDevice) => {
    setSelectedThermostatDevice(device);
  }, []);

  const handleCloseThermostatSettings = useCallback(() => {
    setSelectedThermostatDevice(null);
  }, []);

  const handleApplyThermostatSettings = useCallback(async (modeActions: Array<{ instance: string; value: string }>) => {
    if (!selectedThermostatDevice) return;
    await onSetDeviceMode(selectedThermostatDevice.id, modeActions, true); // Включаем устройство при применении
  }, [selectedThermostatDevice, onSetDeviceMode]);

  const handleOkThermostatSettings = useCallback(async (modeActions: Array<{ instance: string; value: string }>) => {
    if (!selectedThermostatDevice) return;
    await onSetDeviceMode(selectedThermostatDevice.id, modeActions);
    setSelectedThermostatDevice(null);
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

  const handleApplyLightBrightness = useCallback(async (settings: {
    brightness?: number;
    hsv?: { h: number; s: number; v: number };
    rgb?: number;
    temperature_k?: number;
  }) => {
    if (!selectedLightDevice) return;

    const actions: any[] = [];

    // Добавляем яркость если есть
    if (settings.brightness !== undefined) {
      actions.push({
        instance: 'brightness',
        value: settings.brightness.toString(),
        type: 'devices.capabilities.range'
      });
    }

    // Добавляем HSV цвет если есть
    if (settings.hsv) {
      actions.push({
        instance: 'hsv',
        value: settings.hsv,
        type: 'devices.capabilities.color_setting'
      });
    }

    // Добавляем RGB цвет если есть
    if (settings.rgb !== undefined) {
      actions.push({
        instance: 'rgb',
        value: settings.rgb,
        type: 'devices.capabilities.color_setting'
      });
    }

    // Добавляем температуру света если есть
    if (settings.temperature_k !== undefined) {
      actions.push({
        instance: 'temperature_k',
        value: settings.temperature_k.toString(),
        type: 'devices.capabilities.color_setting'
      });
    }

    if (actions.length > 0) {
      await onSetDeviceMode(selectedLightDevice.id, actions, true); // Включаем устройство при применении
    }
    // Модальное окно остается открытым при нажатии "Применить"
  }, [selectedLightDevice, onSetDeviceMode]);

  const handleApplyGroupLightBrightness = useCallback(async (settings: {
    brightness?: number;
    hsv?: { h: number; s: number; v: number };
    rgb?: number;
    temperature_k?: number;
  }) => {
    if (!selectedLightGroup) return;

    // Получаем все устройства в группе
    const groupDevices = data.devices.filter(d => selectedLightGroup.devices.includes(d.id));

    if (groupDevices.length === 0) return;

    // Отправляем одинаковые настройки для всех устройств в группе
    const updatePromises = groupDevices.map(async (device) => {
      const actions: any[] = [];

      // Добавляем яркость если есть
      if (settings.brightness !== undefined) {
        actions.push({
          instance: 'brightness',
          value: settings.brightness.toString(),
          type: 'devices.capabilities.range'
        });
      }

      // Добавляем HSV цвет если есть
      if (settings.hsv) {
        actions.push({
          instance: 'hsv',
          value: settings.hsv,
          type: 'devices.capabilities.color_setting'
        });
      }

      // Добавляем RGB цвет если есть
      if (settings.rgb !== undefined) {
        actions.push({
          instance: 'rgb',
          value: settings.rgb,
          type: 'devices.capabilities.color_setting'
        });
      }

      // Добавляем температуру света если есть
      if (settings.temperature_k !== undefined) {
        actions.push({
          instance: 'temperature_k',
          value: settings.temperature_k.toString(),
          type: 'devices.capabilities.color_setting'
        });
      }

      if (actions.length > 0) {
        await onSetDeviceMode(device.id, actions, true); // Включаем устройство при применении
      }
    });

    await Promise.all(updatePromises);
    // Модальное окно остается открытым при нажатии "Применить"
  }, [selectedLightGroup, data.devices, onSetDeviceMode]);

  const handleApplyGroupThermostatSettings = useCallback(async (modeActions: Array<{ instance: string; value: string }>) => {
    if (!selectedThermostatGroup) return;

    // Получаем все устройства в группе
    const groupDevices = data.devices.filter(d => selectedThermostatGroup.devices.includes(d.id));

    if (groupDevices.length === 0) return;

    // Отправляем одинаковые настройки для всех устройств в группе
    const updatePromises = groupDevices.map(async (device) => {
      if (modeActions.length > 0) {
        await onSetDeviceMode(device.id, modeActions, true); // Включаем устройство при применении
      }
    });

    await Promise.all(updatePromises);
    // Модальное окно остается открытым при нажатии "Применить"
  }, [selectedThermostatGroup, data.devices, onSetDeviceMode]);

  // Автоматическое сворачивание блока "Сценарии", если он пуст
  useEffect(() => {
    // Проверяем, есть ли сохраненное состояние в localStorage
    const key = getStorageKey('dashboard:scenariosCollapsed', activeHouseholdId);
    const hasStoredState = localStorage.getItem(key) !== null;
    
    // Если сценариев нет и состояние не было сохранено пользователем, автоматически сворачиваем
    if (activeScenarios.length === 0 && !hasStoredState) {
      setIsScenariosCollapsed(true);
      saveCollapseState('dashboard:scenariosCollapsed', activeHouseholdId, true);
    }
    // Если сценариев нет, но секция развернута (пользователь мог развернуть вручную),
    // оставляем как есть - не принуждаем к сворачиванию
  }, [activeScenarios.length, activeHouseholdId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-slate-900 dark:text-slate-100 pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-surface/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-primary/20 rounded-lg">
              <Home className="w-5 h-5 text-purple-600 dark:text-primary" />
            </div>
            <div className="flex items-center gap-1">
              <h1
                className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100"
                title={homeName}
              >
                {homeName}
              </h1>
              {hasMultipleHomes && (
                <button
                  type="button"
                  onClick={onSwitchHousehold}
                  className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-full border border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  title="Переключить дом"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-slate-900 rounded-full border border-gray-300 dark:border-slate-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Онлайн</span>
             </div>
             <button
                onClick={onToggleAutostart}
                className={`p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors ${
                  isAutostartEnabled 
                    ? 'text-purple-600 dark:text-primary bg-purple-50 dark:bg-primary/20' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={isAutostartEnabled ? 'Автозапуск включен. Нажмите, чтобы выключить' : 'Автозапуск выключен. Нажмите, чтобы включить'}
            >
                <Power className={`w-5 h-5`} />
            </button>
             <button
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
            >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
			 <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Обновить данные">
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              title="Выйти"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-12">
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/5 p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400"><Layers className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-slate-600 dark:text-secondary">Комнат</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{roomsForHome.length}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/5 p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400"><MonitorSmartphone className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-slate-600 dark:text-secondary">Устройств</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{devicesForHome.length}</p>
                </div>
            </div>
        </div>
		
		{hasFavorites && ( // ВОССТАНОВИТЬ СЕКЦИЮ ИЗБРАННОГО
			<section className="mb-8">
				<div className="flex items-center gap-3 mb-4">
					<Star className="w-6 h-6 text-yellow-500 dark:text-accent" />
					<h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Избранное</h2>
				</div>

				{/* Избранные сценарии */}
				{favoriteScenarios.length > 0 && (
					<>
						<h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mt-6 mb-3">Сценарии ({favoriteScenarios.length})</h3>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
							{favoriteScenarios.map(scenario => (
								<ScenarioCard 
									key={scenario.id} 
									scenario={scenario} 
									onExecute={onExecuteScenario} 
									isFavorite={true} 
									onToggleFavorite={onToggleScenarioFavorite}
								/>
							))}
						</div>
					</>
				)}

				{/* Избранные устройства */}
				{favoriteDevices.length > 0 && (
					<>
						<h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mt-6 mb-3">Устройства ({favoriteDevices.length})</h3>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
							{favoriteDevices.map(device => (
								<DeviceCard 
									key={device.id} 
									device={device} 
									onToggle={onToggleDevice} 
									isFavorite={true} 
									onToggleFavorite={onToggleDeviceFavorite}
									onOpenSettings={(dev) => {
										if (dev.type === 'devices.types.light') {
											handleOpenLightSettings(dev);
										} else {
											handleOpenThermostatSettings(dev);
										}
									}}
								/>
							))}
						</div>
					</>
				)}
			</section>
		)}


        {/* Scenarios Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={toggleScenarios}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {isScenariosCollapsed ? (
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              )}
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Сценарии</h2>
            </button>
            <span className="text-sm text-slate-600 dark:text-secondary bg-white dark:bg-surface px-3 py-1 rounded-full border border-gray-200 dark:border-white/5">
              {activeScenarios.length} активных
            </span>
          </div>

          {!isScenariosCollapsed && (
            <>
              {activeScenarios.length === 0 ? (
                 <div className="text-center py-20 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-surface/30">
                    <p className="text-slate-600 dark:text-slate-400">У вас нет активных сценариев.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {activeScenarios.map((scenario: YandexScenario) => (
                    <ScenarioCard 
                      key={scenario.id} 
                      scenario={scenario} 
                      onExecute={onExecuteScenario} 
                      isFavorite={favoriteScenarioIds.includes(scenario.id)}
                      onToggleFavorite={onToggleScenarioFavorite}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Groups Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={toggleGroups}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {isGroupsCollapsed ? (
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              )}
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Группы</h2>
            </button>
            <span className="text-sm text-slate-600 dark:text-secondary bg-white dark:bg-surface px-3 py-1 rounded-full border border-gray-200 dark:border-white/5">
              {groupsForHome.length} групп
            </span>
          </div>

          {!isGroupsCollapsed && (
            <>
              {groupsForHome.length === 0 ? (
                 <div className="text-center py-20 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-surface/30">
                    <p className="text-slate-600 dark:text-slate-400">У вас нет групп устройств.</p>
                 </div>
              ) : (
                <div className="space-y-4">
                  {groupsForHome.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      devices={devicesForHome}
                      onToggleGroup={onToggleGroup}
                      onToggleDevice={onToggleDevice}
                      favoriteDeviceIds={favoriteDeviceIds}
                      onToggleDeviceFavorite={onToggleDeviceFavorite}
                      onOpenSettings={(device) => {
                        if (device.type === 'devices.types.light') {
                          handleOpenLightSettings(device);
                        } else {
                          handleOpenThermostatSettings(device);
                        }
                      }}
                      onOpenGroupSettings={(group) => {
                        // Check if group contains light or thermostat devices
                        const groupDevices = devicesForHome.filter(d => group.devices.includes(d.id));
                        const isLightGroup = groupDevices.length > 0 && groupDevices.every(d => d.type === 'devices.types.light');
                        const isThermostatGroup = groupDevices.length > 0 && groupDevices.every(d => 
                          d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat'
                        );
                        
                        if (isLightGroup) {
                          handleOpenGroupLightSettings(group);
                        } else if (isThermostatGroup) {
                          handleOpenGroupThermostatSettings(group);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Devices Section */}
        <section>
            <div className="flex items-center gap-2 mb-8">
              <button
                onClick={toggleDevices}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {isDevicesCollapsed ? (
                  <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                )}
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Устройства</h2>
              </button>
            </div>
            
            {!isDevicesCollapsed && (
              <>
                {roomsForHome.length === 0 && devicesForHome.length > 0 && (
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {devicesForHome.map(device => (
                            <DeviceCard 
                            key={device.id} 
                            device={device} 
                            onToggle={onToggleDevice} 
                            isFavorite={favoriteDeviceIds.includes(device.id)} 
                            onToggleFavorite={onToggleDeviceFavorite}
                            onOpenSettings={(dev) => {
                              if (dev.type === 'devices.types.light') {
                                handleOpenLightSettings(dev);
                              } else {
                                handleOpenThermostatSettings(dev);
                              }
                            }}
                            />
                        ))}
                     </div>
                )}

                <div className="space-y-8">
                    {roomsForHome.map(room => {
                        const roomDevices = devicesForHome.filter(d => room.devices.includes(d.id));
                        if (roomDevices.length === 0) return null;
                        const isRoomCollapsed = collapsedRooms.has(room.id);
                        
                        return (
                            <div key={room.id} className="bg-gray-100 dark:bg-surface/30 border border-gray-200 dark:border-white/5 rounded-2xl p-6">
                                <button
                                  onClick={() => toggleRoom(room.id)}
                                  className="w-full flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
                                >
                                  {isRoomCollapsed ? (
                                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                  )}
                                  <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-primary"></span>
                                      {room.name}
                                  </h3>
                                </button>
                                {!isRoomCollapsed && (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                      {roomDevices.map(dev => (
                                          <DeviceCard 
                                          key={dev.id} 
                                          device={dev} 
                                          onToggle={onToggleDevice} 
                                          isFavorite={favoriteDeviceIds.includes(dev.id)} 
                                          onToggleFavorite={onToggleDeviceFavorite}
                                          onOpenSettings={(device) => {
                                            if (device.type === 'devices.types.light') {
                                              handleOpenLightSettings(device);
                                            } else {
                                              handleOpenThermostatSettings(device);
                                            }
                                          }}
                                          />
                                      ))}
                                  </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                
                {/* Unassigned Devices */}
                 {(() => {
                     const assignedIds = new Set(roomsForHome.flatMap(r => r.devices));
                     const unassignedDevices = devicesForHome.filter(d => !assignedIds.has(d.id));
                     if (unassignedDevices.length === 0) return null;

                     return (
                         <div className="mt-8 bg-gray-100 dark:bg-surface/30 border border-gray-200 dark:border-white/5 rounded-2xl p-6">
                            <button
                              onClick={toggleUnassignedDevices}
                              className="w-full flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
                            >
                              {isUnassignedDevicesCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                              )}
                              <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-primary"></span>
                                  Без комнаты
                              </h3>
                            </button>
                            {!isUnassignedDevicesCollapsed && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                  {unassignedDevices.map(dev => (
                                      <DeviceCard 
                                      key={dev.id} 
                                      device={dev} 
                                      onToggle={onToggleDevice} 
                                      isFavorite={favoriteDeviceIds.includes(dev.id)} 
                                      onToggleFavorite={onToggleDeviceFavorite}
                                      onOpenSettings={(device) => {
                                        if (device.type === 'devices.types.light') {
                                          handleOpenLightSettings(device);
                                        } else {
                                          handleOpenThermostatSettings(device);
                                        }
                                      }}
                                      />
                                  ))}
                              </div>
                            )}
                         </div>
                     );
                 })()}
              </>
            )}
        </section>

      </main>
	  
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
                      {/* Кнопка "Нет" (выделена красной обводкой) */}
                      <button
                          onClick={() => setShowConfirmModal(false)}
                          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-red-400 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                          Нет
                      </button>

                      {/* Кнопка "Да, уверен" */}
                      <button
                          onClick={() => {
                              onLogout(); // Вызов функции выхода из App.tsx
                              setShowConfirmModal(false); // Закрываем модальное окно
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-purple-600 dark:bg-primary hover:bg-purple-700 dark:hover:bg-blue-600 text-white"
                      >
                          Да, уверен
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Thermostat Settings Modal */}
      {selectedThermostatDevice && (
        <ThermostatSettingsModal
          device={selectedThermostatDevice}
          isOpen={!!selectedThermostatDevice}
          onClose={handleCloseThermostatSettings}
          onApply={handleApplyThermostatSettings}
        />
      )}

      {/* Light Brightness Settings Modal */}
      {selectedLightDevice && (
        <BrightnessSettingsModal
          device={selectedLightDevice}
          isOpen={!!selectedLightDevice}
          onClose={handleCloseLightSettings}
          onApply={handleApplyLightBrightness}
        />
      )}

      {/* Light Brightness Settings Modal for Group */}
      {selectedLightGroup && (
        <GroupLightSettingsModal
          group={selectedLightGroup}
          devices={data.devices}
          isOpen={!!selectedLightGroup}
          onClose={handleCloseLightGroupSettings}
          onApply={handleApplyGroupLightBrightness}
        />
      )}

      {/* Thermostat Settings Modal for Group */}
      {selectedThermostatGroup && (
        <GroupThermostatSettingsModal
          group={selectedThermostatGroup}
          devices={data.devices}
          isOpen={!!selectedThermostatGroup}
          onClose={handleCloseThermostatGroupSettings}
          onApply={handleApplyGroupThermostatSettings}
        />
      )}
	  
    </div>
  );
};