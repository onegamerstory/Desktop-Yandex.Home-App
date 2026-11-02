import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { YandexScenario } from '../types/index';
import { Sidebar } from './Sidebar';
import { DashboardHomeView } from './DashboardHomeView';
import { DashboardRoomView } from './DashboardRoomView';
import { DashboardGroupView } from './DashboardGroupView';
import { ThermostatSettingsModal } from './modals/ThermostatSettingsModal';
import { BrightnessSettingsModal } from './modals/BrightnessSettingsModal';
import { GroupLightSettingsModal } from './modals/GroupLightSettingsModal';
import { GroupThermostatSettingsModal } from './modals/GroupThermostatSettingsModal';
import { FanSettingsModal } from './modals/FanSettingsModal';
import { GroupFanSettingsModal } from './modals/GroupFanSettingsModal';
import { CameraStreamModal } from './modals/CameraStreamModal';
import { SensorSettingsModal } from './modals/SensorSettingsModal';
import { SettingsModal } from './modals/SettingsModal';
import { Pencil, Power, Sun, Moon, RefreshCw, Settings, LogOut, X, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDashboardContext } from '../contexts/DashboardContext';
import { useDashboardState } from '../hooks/useDashboardState';
import { isLightDevice, isLightGroup, isCameraDevice, isSensorDevice } from '../constants';
import packageJson from '../../package.json';
import { BackgroundSettingsModal, DEFAULT_BACKGROUND_SETTINGS } from './modals/BackgroundSettingsModal';
import type { BackgroundSettings } from './modals/BackgroundSettingsModal';
import { getDeviceShortcuts } from '../utils/deviceShortcuts';

const DEFAULT_HOME_NAME = 'Мой Дом';

interface DashboardProps {
    hasUpdateAvailable: boolean;
}

const parseBackgroundSettings = (stored: string | null): BackgroundSettings => {
    if (!stored) return DEFAULT_BACKGROUND_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<BackgroundSettings>;
    const clamp = (value: number | undefined, min: number, max: number, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value)
            ? Math.min(max, Math.max(min, value))
            : fallback;

    return {
        image: typeof parsed.image === 'string' ? parsed.image : '',
        positionX: clamp(parsed.positionX, 0, 100, DEFAULT_BACKGROUND_SETTINGS.positionX),
        positionY: clamp(parsed.positionY, 0, 100, DEFAULT_BACKGROUND_SETTINGS.positionY),
        zoom: clamp(parsed.zoom, 100, 200, DEFAULT_BACKGROUND_SETTINGS.zoom),
        blur: clamp(parsed.blur, 0, 20, DEFAULT_BACKGROUND_SETTINGS.blur),
        dim: clamp(parsed.dim, 0, 80, DEFAULT_BACKGROUND_SETTINGS.dim),
    };
};

export const Dashboard: React.FC<DashboardProps> = ({ hasUpdateAvailable }) => {
    const ctx = useDashboardContext();
    const { theme, toggleTheme } = useTheme();
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(hasUpdateAvailable);
    const [isBackgroundSettingsOpen, setIsBackgroundSettingsOpen] = useState(false);
    const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>(DEFAULT_BACKGROUND_SETTINGS);
    const [editingBackgroundSettings, setEditingBackgroundSettings] = useState<BackgroundSettings>(DEFAULT_BACKGROUND_SETTINGS);
    const [backgroundRoomId, setBackgroundRoomId] = useState<string | null>(null);
    const [editingBackgroundKey, setEditingBackgroundKey] = useState<string | null>(null);

    const state = useDashboardState(
        ctx.activeHouseholdId,
        ctx.activeSidebarView,
        ctx.onSetDeviceMode,
        ctx.onSetLightSettings,
        { devices: ctx.data.devices },
        isCameraDevice,
        isLightDevice,
        isLightGroup,
    );

    useEffect(() => {
        if (hasUpdateAvailable) setIsUpdateAvailable(true);
    }, [hasUpdateAvailable]);

    const executeShortcutRef = useRef<(shortcutId: string) => void>(() => {});

    const executeShortcut = useCallback((shortcutId: string) => {
        const shortcut = getDeviceShortcuts().find(item => item.id === shortcutId);
        if (!shortcut) return;
        if (shortcut.targetType === 'scenario') {
            if (ctx.data.scenarios.some(scenario => scenario.id === shortcut.targetId)) {
                void ctx.onExecuteScenario(shortcut.targetId).catch(error => {
                    console.error('Не удалось выполнить сценарий по горячей клавише', error);
                });
            }
            return;
        }

        const device = ctx.data.devices.find(item => item.id === shortcut.targetId);
        const onOff = device?.capabilities.find(capability => capability.type === 'devices.capabilities.on_off');
        if (device && onOff) {
            void ctx.onToggleDevice(device.id, onOff.state?.value === true).catch(error => {
                console.error('Не удалось переключить устройство по горячей клавише', error);
            });
        }
    }, [ctx.data.devices, ctx.data.scenarios, ctx.onExecuteScenario, ctx.onToggleDevice]);

    useEffect(() => {
        executeShortcutRef.current = executeShortcut;
    }, [executeShortcut]);

    useEffect(() => {
        const shortcuts = getDeviceShortcuts().map(({ id, keys }) => ({ id, keys }));
        void window.api.registerGlobalShortcuts(shortcuts).then(failedIds => {
            if (failedIds.length > 0) {
                console.warn('Не удалось зарегистрировать некоторые горячие клавиши', failedIds);
            }
        }).catch(error => {
            console.error('Не удалось зарегистрировать глобальные горячие клавиши', error);
        });

        const unsubscribe = window.api.onGlobalShortcut(shortcutId => executeShortcutRef.current(shortcutId));
        return () => {
            unsubscribe();
            void window.api.registerGlobalShortcuts([]).catch(error => {
                console.error('Не удалось снять глобальные горячие клавиши', error);
            });
        };
    }, []);

    // ---- Computed values ----
    const currentHousehold = useMemo(() => {
        if (!ctx.households || ctx.households.length === 0) return null;
        if (ctx.activeHouseholdId) {
            const found = ctx.households.find(h => h.id === ctx.activeHouseholdId);
            if (found) return found;
        }
        return ctx.households[0];
    }, [ctx.households, ctx.activeHouseholdId]);

    const homeName = currentHousehold?.name || DEFAULT_HOME_NAME;
    const hasMultipleHomes = (ctx.households?.length || 0) > 1;
    const roomsForHome = useMemo(() => {
        if (!currentHousehold) return ctx.data.rooms;
        return ctx.data.rooms.filter(room => room.household_id === currentHousehold.id);
    }, [ctx.data.rooms, currentHousehold]);

    const backgroundTarget = useMemo(() => {
        const householdKey = ctx.activeHouseholdId || 'default';
        if (ctx.activeSidebarView === 'room' && ctx.activeRoomId) {
            const room = roomsForHome.find(item => item.id === ctx.activeRoomId);
            if (room) {
                return {
                    key: `dashboard:background:household:${householdKey}:room:${room.id}`,
                    title: room.name,
                    roomId: room.id,
                };
            }
        }
        if (ctx.activeSidebarView === 'home') {
            return {
                key: `dashboard:background:household:${householdKey}:home`,
                title: homeName,
                roomId: null,
            };
        }
        return null;
    }, [ctx.activeHouseholdId, ctx.activeSidebarView, ctx.activeRoomId, roomsForHome, homeName]);

    useEffect(() => {
        if (!backgroundTarget) {
            setBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
            return;
        }
        try {
            setBackgroundSettings(parseBackgroundSettings(localStorage.getItem(backgroundTarget.key)));
        } catch (error) {
            console.error('Failed to load background settings', error);
            setBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
        }
    }, [backgroundTarget]);

    const openBackgroundSettings = (roomId: string | null = null) => {
        if (roomId) {
            setBackgroundRoomId(roomId);
            const room = roomsForHome.find(item => item.id === roomId);
            const key = `dashboard:background:household:${ctx.activeHouseholdId || 'default'}:room:${roomId}`;
            if (!room) return;
            setEditingBackgroundKey(key);
            try {
                setEditingBackgroundSettings(parseBackgroundSettings(localStorage.getItem(key)));
            } catch (error) {
                console.error('Failed to load room background settings', error);
                setEditingBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
            }
        } else {
            if (!backgroundTarget) return;
            setBackgroundRoomId(backgroundTarget.roomId);
            setEditingBackgroundKey(backgroundTarget.key);
            try {
                setEditingBackgroundSettings(parseBackgroundSettings(localStorage.getItem(backgroundTarget.key)));
            } catch (error) {
                console.error('Failed to load background settings', error);
                setEditingBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
            }
        }
        setIsBackgroundSettingsOpen(true);
    };

    const saveBackgroundSettings = (settings: BackgroundSettings) => {
        const key = editingBackgroundKey;
        if (!key) throw new Error('No background settings target is selected');
        localStorage.setItem(key, JSON.stringify(settings));
        if (backgroundTarget?.key === key) setBackgroundSettings(settings);
    };

    const groupsForHome = useMemo(() => {
        if (!currentHousehold) return ctx.data.groups;
        return ctx.data.groups.filter(group => group.household_id === currentHousehold.id);
    }, [ctx.data.groups, currentHousehold]);

    const roomIdsForHome = useMemo(() => new Set(roomsForHome.map(r => r.id)), [roomsForHome]);

    const devicesForHome = useMemo(() => {
        if (!currentHousehold) return ctx.data.devices;
        return ctx.data.devices.filter(device => {
            const anyDevice = device as any;
            const deviceHouseholdId: string | undefined = anyDevice.household_id;
            if (deviceHouseholdId) return deviceHouseholdId === currentHousehold.id;
            if (device.room && roomIdsForHome.has(device.room)) return true;
            return false;
        });
    }, [ctx.data.devices, currentHousehold, roomIdsForHome]);

    const deviceHouseholdMap = useMemo(() => {
        const map = new Map<string, string>();
        ctx.data.devices.forEach(device => {
            const anyDevice = device as any;
            let householdId: string | undefined =
                typeof anyDevice.household_id === 'string' ? anyDevice.household_id : undefined;
            if (!householdId && device.room) {
                const room = ctx.data.rooms.find(r => r.id === device.room);
                if (room) householdId = room.household_id;
            }
            if (householdId) map.set(device.id, householdId);
        });
        ctx.data.rooms.forEach(room => {
            room.devices.forEach(deviceId => {
                if (!map.has(deviceId)) map.set(deviceId, room.household_id);
            });
        });
        return map;
    }, [ctx.data.devices, ctx.data.rooms]);

    const isScenarioInCurrentHome = useCallback(
        (scenario: YandexScenario) => {
            if (!ctx.households || ctx.households.length <= 1) return true;
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
        [ctx.households, currentHousehold, deviceHouseholdMap]
    );

    const activeScenarios = ctx.data.scenarios.filter(
        s => s.is_active && isScenarioInCurrentHome(s)
    );

    const favoriteScenarios = ctx.data.scenarios.filter(
        s => ctx.favoriteScenarioIds.includes(s.id) && isScenarioInCurrentHome(s)
    );
    const favoriteDevices = devicesForHome.filter(d => ctx.favoriteDeviceIds.includes(d.id));
    const favoriteGroups = groupsForHome.filter(g => ctx.favoriteGroupIds.includes(g.id));

    // Split devices into sensors and non-sensors
    const favoriteSensorDevices = favoriteDevices.filter(d => isSensorDevice(d));
    const favoriteNonSensorDevices = favoriteDevices.filter(d => !isSensorDevice(d));

    const visibleFavoriteScenarios = favoriteScenarios.filter(s => !state.getEffectiveHidden(`scenario_${s.id}`));
    const visibleFavoriteDevices = favoriteDevices.filter(d => !state.getEffectiveHidden(`device_${d.id}`));
    const visibleFavoriteSensorDevices = favoriteSensorDevices.filter(d => !state.getEffectiveHidden(`device_${d.id}`));
    const visibleFavoriteNonSensorDevices = favoriteNonSensorDevices.filter(d => !state.getEffectiveHidden(`device_${d.id}`));
    const visibleFavoriteGroups = favoriteGroups.filter(g => !state.getEffectiveHidden(`group_${g.id}`));

    const hasFavorites = favoriteScenarios.length > 0 || favoriteDevices.length > 0 || favoriteGroups.length > 0;
    const hasFavoriteSensors = favoriteSensorDevices.length > 0;

    // ---- Content title/subtitle ----
    const contentTitle = useMemo(() => {
        if (ctx.activeSidebarView === 'room' && ctx.activeRoomId) {
            const room = roomsForHome.find(r => r.id === ctx.activeRoomId);
            if (room) return room.name;
        }
        if (ctx.activeSidebarView === 'group' && ctx.activeGroupId) {
            const group = groupsForHome.find(g => g.id === ctx.activeGroupId);
            if (group) return group.name;
        }
        return homeName;
    }, [ctx.activeSidebarView, ctx.activeRoomId, ctx.activeGroupId, roomsForHome, groupsForHome, homeName]);

    const contentSubtitle = useMemo(() => {
        if (ctx.activeSidebarView === 'room' && ctx.activeRoomId) {
            const roomDevices = devicesForHome.filter(d => d.room === ctx.activeRoomId);
            const onCount = roomDevices.filter(d => {
                const onOff = d.capabilities.find(c => c.type === 'devices.capabilities.on_off');
                return onOff?.state?.value === true;
            }).length;
            return `${roomDevices.length} устройств, ${onCount} включено`;
        }
        if (ctx.activeSidebarView === 'group' && ctx.activeGroupId) {
            const group = groupsForHome.find(g => g.id === ctx.activeGroupId);
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
    }, [ctx.activeSidebarView, ctx.activeRoomId, ctx.activeGroupId, devicesForHome, groupsForHome]);

    // ---- Content rendering ----
    const renderContent = () => {
        switch (ctx.activeSidebarView) {
            case 'home':
                return (
                    <DashboardHomeView
                        state={state}
                        roomsForHome={roomsForHome}
                        groupsForHome={groupsForHome}
                        devicesForHome={devicesForHome}
                        activeScenarios={activeScenarios}
                        favoriteScenarios={favoriteScenarios}
                        favoriteDevices={favoriteDevices}
                        favoriteGroups={favoriteGroups}
                        favoriteSensorDevices={favoriteSensorDevices}
                        favoriteNonSensorDevices={favoriteNonSensorDevices}
                        visibleFavoriteScenarios={visibleFavoriteScenarios}
                        visibleFavoriteDevices={visibleFavoriteDevices}
                        visibleFavoriteSensorDevices={visibleFavoriteSensorDevices}
                        visibleFavoriteNonSensorDevices={visibleFavoriteNonSensorDevices}
                        visibleFavoriteGroups={visibleFavoriteGroups}
                        hasFavorites={hasFavorites}
                        hasFavoriteSensors={hasFavoriteSensors}
                        onOpenBackgroundSettings={(roomId) => openBackgroundSettings(roomId)}
                    />
                );
            case 'room':
                return (
                    <DashboardRoomView
                        state={state}
                        activeRoomId={ctx.activeRoomId}
                        roomsForHome={roomsForHome}
                        groupsForHome={groupsForHome}
                        devicesForHome={devicesForHome}
                    />
                );
            case 'group':
                return (
                    <DashboardGroupView
                        state={state}
                        activeGroupId={ctx.activeGroupId}
                        groupsForHome={groupsForHome}
                        devicesForHome={devicesForHome}
                    />
                );
            default:
                return (
                    <DashboardHomeView
                        state={state}
                        roomsForHome={roomsForHome}
                        groupsForHome={groupsForHome}
                        devicesForHome={devicesForHome}
                        activeScenarios={activeScenarios}
                        favoriteScenarios={favoriteScenarios}
                        favoriteDevices={favoriteDevices}
                        favoriteGroups={favoriteGroups}
                        favoriteSensorDevices={favoriteSensorDevices}
                        favoriteNonSensorDevices={favoriteNonSensorDevices}
                        visibleFavoriteScenarios={visibleFavoriteScenarios}
                        visibleFavoriteDevices={visibleFavoriteDevices}
                        visibleFavoriteSensorDevices={visibleFavoriteSensorDevices}
                        visibleFavoriteNonSensorDevices={visibleFavoriteNonSensorDevices}
                        visibleFavoriteGroups={visibleFavoriteGroups}
                        hasFavorites={hasFavorites}
                        hasFavoriteSensors={hasFavoriteSensors}
                        onOpenBackgroundSettings={(roomId) => openBackgroundSettings(roomId)}
                    />
                );
        }
    };

    return (
        <div className="window">
            <div className="body">
                <Sidebar onOpenCameraStream={state.openCameraStream} />
                <main className="content">
                    <div className="content-header">
                        <div>
                            <div className="content-title-row">
                                <h1>{contentTitle}</h1>
                                {backgroundTarget && (
                                    <button
                                        type="button"
                                        className="header-btn title-background-settings"
                                        title="Настроить фон"
                                        aria-label="Настроить фон"
                                        onClick={() => openBackgroundSettings()}
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="subtitle">{contentSubtitle}</div>
                        </div>
                        {ctx.activeSidebarView === 'home' && (
                            <div className="content-actions">
                                <button
                                    onClick={state.toggleEditMode}
                                    className={`header-btn ${state.edit.isEditMode ? 'active' : ''}`}
                                    title={state.edit.isEditMode ? 'Выйти из режима редактирования' : 'Редактировать дашборд'}
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={ctx.onToggleAutostart}
                                    className={`header-btn ${ctx.isAutostartEnabled ? 'active' : ''}`}
                                    title={ctx.isAutostartEnabled ? 'Автозапуск включен' : 'Автозапуск выключен'}
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
                                    onClick={ctx.onRefresh}
                                    disabled={ctx.isRefreshing}
                                    className="header-btn"
                                    title="Обновить"
                                >
                                    <RefreshCw className={`w-4 h-4 ${ctx.isRefreshing ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={() => state.setShowSettingsModal(true)}
                                    className={`header-btn ${isUpdateAvailable ? 'has-update' : ''}`}
                                    title={isUpdateAvailable ? 'Настройки — доступно обновление' : 'Настройки'}
                                    aria-label={isUpdateAvailable ? 'Настройки — доступно обновление' : 'Настройки'}
                                >
                                    <Settings className="w-4 h-4" />
                                    {isUpdateAvailable && <span className="settings-update-dot" aria-hidden="true" />}
                                </button>
                                <button
                                    onClick={() => state.setShowConfirmModal(true)}
                                    className="header-btn"
                                    title="Выйти"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    {renderContent()}
                    {backgroundTarget && backgroundSettings.image && (
                        <div className="content-background" aria-hidden="true">
                            <img
                                src={backgroundSettings.image}
                                alt=""
                                style={{
                                    objectPosition: `${backgroundSettings.positionX}% ${backgroundSettings.positionY}%`,
                                    transform: `scale(${backgroundSettings.zoom / 100})`,
                                    filter: `blur(${backgroundSettings.blur}px)`,
                                }}
                            />
                            <div style={{ backgroundColor: `rgba(0, 0, 0, ${backgroundSettings.dim / 100})` }} />
                        </div>
                    )}
                </main>
            </div>

            {/* Modals */}
            {state.modal.showConfirmModal && (
                <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-soft rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-card-fg">Подтверждение выхода</h3>
                            <button onClick={() => state.setShowConfirmModal(false)} className="text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-card-fg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-slate-700 dark:text-card-fg mb-6 text-sm">
                            Вы уверены, что хотите выйти из учетной записи? После этого действия для последующего входа потребуется токен.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => state.setShowConfirmModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-red-400 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                                Нет
                            </button>
                            <button onClick={() => { ctx.onLogout(); state.setShowConfirmModal(false); }} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary hover:bg-primary-hover text-white">
                                Да, уверен
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {state.modal.selectedThermostatDevice && (
                <ThermostatSettingsModal
                    device={state.modal.selectedThermostatDevice}
                    isOpen={!!state.modal.selectedThermostatDevice}
                    onClose={state.closeThermostatSettings}
                    onApply={state.handleApplyThermostatSettings}
                />
            )}

            {state.modal.selectedLightDevice && (
                <BrightnessSettingsModal
                    device={state.modal.selectedLightDevice}
                    isOpen={!!state.modal.selectedLightDevice}
                    onClose={state.closeLightSettings}
                    onApply={state.handleApplyLightBrightness}
                />
            )}

            {state.modal.selectedLightGroup && (
                <GroupLightSettingsModal
                    group={state.modal.selectedLightGroup}
                    devices={ctx.data.devices}
                    isOpen={!!state.modal.selectedLightGroup}
                    onClose={state.closeLightGroupSettings}
                    onApply={state.handleApplyGroupLightBrightness}
                />
            )}

            {state.modal.selectedThermostatGroup && (
                <GroupThermostatSettingsModal
                    group={state.modal.selectedThermostatGroup}
                    devices={ctx.data.devices}
                    isOpen={!!state.modal.selectedThermostatGroup}
                    onClose={state.closeThermostatGroupSettings}
                    onApply={state.handleApplyGroupThermostatSettings}
                />
            )}

            {state.modal.selectedFanDevice && (
                <FanSettingsModal
                    device={state.modal.selectedFanDevice}
                    isOpen={!!state.modal.selectedFanDevice}
                    onClose={state.closeFanSettings}
                    onApply={state.handleApplyFanSettings}
                />
            )}

            {state.modal.selectedFanGroup && (
                <GroupFanSettingsModal
                    group={state.modal.selectedFanGroup}
                    devices={ctx.data.devices}
                    isOpen={!!state.modal.selectedFanGroup}
                    onClose={state.closeFanGroupSettings}
                    onApply={state.handleApplyGroupFanSettings}
                />
            )}

            {state.modal.selectedCameraDevice && (
                <CameraStreamModal
                    device={ctx.data.devices.find((item) => item.id === state.modal.selectedCameraDevice!.id) ?? state.modal.selectedCameraDevice}
                    isOpen={!!state.modal.selectedCameraDevice}
                    onClose={state.closeCameraStream}
                    onGetStream={ctx.onGetCameraStream}
                    onSetPrivacy={ctx.onSetCameraPrivacy}
                    onPrivacyChanged={ctx.onRefresh}
                />
            )}

            {state.modal.selectedSensorDevice && (
                <SensorSettingsModal
                    device={state.modal.selectedSensorDevice}
                    isOpen={!!state.modal.selectedSensorDevice}
                    onClose={state.closeSensorSettings}
                    onSave={state.setSensorDisplayConfig}
                    initialConfig={state.sensorDisplayConfig[state.modal.selectedSensorDevice.id] ?? null}
                />
            )}

            <SettingsModal
                isOpen={state.modal.showSettingsModal}
                onClose={() => state.setShowSettingsModal(false)}
                currentVersion={packageJson.version}
                devices={ctx.data.devices}
                scenarios={ctx.data.scenarios}
                onUpdateAvailabilityChange={setIsUpdateAvailable}
            />
            {isBackgroundSettingsOpen && (
                <BackgroundSettingsModal
                    key={backgroundRoomId ?? backgroundTarget?.key ?? 'home'}
                    title={backgroundRoomId
                        ? roomsForHome.find(room => room.id === backgroundRoomId)?.name || 'Комната'
                        : homeName}
                    initialSettings={editingBackgroundSettings}
                    onClose={() => setIsBackgroundSettingsOpen(false)}
                    onSave={saveBackgroundSettings}
                />
            )}
        </div>
    );
};
