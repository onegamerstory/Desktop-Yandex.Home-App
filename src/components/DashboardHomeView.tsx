import React from 'react';
import { YandexRoom, YandexDevice, YandexGroup, YandexScenario } from '../types/index';
import { ScenarioCard } from './cards/ScenarioCard';
import { DeviceCard } from './cards/DeviceCard';
import { GroupCard } from './cards/GroupCard';
import { useDashboardContext } from '../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../hooks/useDashboardState';
import { isLightGroup } from '../constants';
import { Building2, SquareSquare, ScrollText, Lightbulb, Star, ChevronRight, ChevronDown } from 'lucide-react';

interface DashboardHomeViewProps {
    state: UseDashboardStateReturn;
    roomsForHome: YandexRoom[];
    groupsForHome: YandexGroup[];
    devicesForHome: YandexDevice[];
    activeScenarios: YandexScenario[];
    favoriteScenarios: YandexScenario[];
    favoriteDevices: YandexDevice[];
    favoriteGroups: YandexGroup[];
    visibleFavoriteScenarios: YandexScenario[];
    visibleFavoriteDevices: YandexDevice[];
    visibleFavoriteGroups: YandexGroup[];
    hasFavorites: boolean;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
    state,
    roomsForHome,
    groupsForHome,
    devicesForHome,
    activeScenarios,
    favoriteScenarios,
    favoriteDevices,
    favoriteGroups,
    visibleFavoriteScenarios,
    visibleFavoriteDevices,
    visibleFavoriteGroups,
    hasFavorites,
}) => {
    const ctx = useDashboardContext();

    // ---- Render helpers ----
    const renderStatsRow = () => (
        <div className="stats-row">
            <div className="stat-chip">
                <Building2 /> Домов: {ctx.households.length}
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
                                    onExecute={ctx.onExecuteScenario}
                                    isFavorite={true}
                                    onToggleFavorite={ctx.onToggleScenarioFavorite}
                                    isEditMode={state.edit.isEditMode}
                                    iconHiddenState={state.getIconHiddenState(`scenario_${scenario.id}`)}
                                    onToggleVisibility={() => state.toggleCardVisibility(`scenario_${scenario.id}`)}
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
                                    onToggle={ctx.onToggleDevice}
                                    isFavorite={true}
                                    onToggleFavorite={ctx.onToggleDeviceFavorite}
                                    onOpenSettings={state.handleOpenDeviceSettings}
                                    onOpenCameraStream={state.openCameraStream}
                                    isEditMode={state.edit.isEditMode}
                                    iconHiddenState={state.getIconHiddenState(`device_${device.id}`)}
                                    onToggleVisibility={() => state.toggleCardVisibility(`device_${device.id}`)}
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
                                onToggleGroup={ctx.onToggleGroup}
                                onToggleDevice={ctx.onToggleDevice}
                                favoriteDeviceIds={ctx.favoriteDeviceIds}
                                onToggleDeviceFavorite={ctx.onToggleDeviceFavorite}
                                isFavorite={true}
                                onToggleFavorite={ctx.onToggleGroupFavorite}
                                onOpenSettings={state.handleOpenDeviceSettings}
                                onOpenCameraStream={state.openCameraStream}
                                onOpenGroupSettings={(g) => {
                                    const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
                                    if (isLightGroup(gDevices)) state.openGroupLightSettings(g);
                                    else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) state.openGroupThermostatSettings(g);
                                    else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) state.openGroupFanSettings(g);
                                }}
                                isEditMode={state.edit.isEditMode}
                                getEffectiveHidden={state.getEffectiveHidden}
                                getIconHiddenState={state.getIconHiddenState}
                                onToggleDeviceVisibility={state.toggleCardVisibility}
                            />
                        ))}
                    </>
                )}
            </section>
        );
    };

    return (
        <>
            {renderStatsRow()}
            {renderFavoritesSection()}

            {roomsForHome.map(room => {
                const roomDevices = devicesForHome.filter(d => room.devices.includes(d.id));
                if (roomDevices.length === 0) return null;
                const isRoomCollapsed = state.collapse.collapsedRooms.has(room.id);

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
                        <div className="room-header" onClick={() => state.toggleRoom(room.id)}>
                            {isRoomCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />}
                            <h2>{room.name}</h2>
                            <span className="room-count">{roomDevices.length}</span>
                        </div>
                        {!isRoomCollapsed && (
                            <>
                                {standaloneDevices.length > 0 && (
                                    <div className="device-grid" style={{ marginBottom: 16 }}>
                                        {standaloneDevices
                                            .filter(d => !state.getEffectiveHidden(`device_${d.id}`))
                                            .map(dev => (
                                                <DeviceCard
                                                    key={dev.id}
                                                    device={dev}
                                                    onToggle={ctx.onToggleDevice}
                                                    isFavorite={ctx.favoriteDeviceIds.includes(dev.id)}
                                                    onToggleFavorite={ctx.onToggleDeviceFavorite}
                                                    onOpenSettings={state.handleOpenDeviceSettings}
                                                    onOpenCameraStream={state.openCameraStream}
                                                    isEditMode={state.edit.isEditMode}
                                                    iconHiddenState={state.getIconHiddenState(`device_${dev.id}`)}
                                                    onToggleVisibility={() => state.toggleCardVisibility(`device_${dev.id}`)}
                                                />
                                            ))}
                                    </div>
                                )}

                                {roomGroups.map(group => (
                                    <GroupCard
                                        key={group.id}
                                        group={group}
                                        devices={devicesForHome}
                                        onToggleGroup={ctx.onToggleGroup}
                                        onToggleDevice={ctx.onToggleDevice}
                                        favoriteDeviceIds={ctx.favoriteDeviceIds}
                                        onToggleDeviceFavorite={ctx.onToggleDeviceFavorite}
                                        isFavorite={ctx.favoriteGroupIds.includes(group.id)}
                                        onToggleFavorite={ctx.onToggleGroupFavorite}
                                        onOpenSettings={state.handleOpenDeviceSettings}
                                        onOpenCameraStream={state.openCameraStream}
                                        onOpenGroupSettings={(g) => {
                                            const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
                                            if (isLightGroup(gDevices)) state.openGroupLightSettings(g);
                                            else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) state.openGroupThermostatSettings(g);
                                            else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) state.openGroupFanSettings(g);
                                        }}
                                        isEditMode={state.edit.isEditMode}
                                        getEffectiveHidden={state.getEffectiveHidden}
                                        getIconHiddenState={state.getIconHiddenState}
                                        onToggleDeviceVisibility={state.toggleCardVisibility}
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
                        <div className="room-header" onClick={state.toggleUnassignedDevices}>
                            {state.collapse.isUnassignedDevicesCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />}
                            <h2>Без комнаты</h2>
                            <span className="room-count">{unassignedDevices.length}</span>
                        </div>
                        {!state.collapse.isUnassignedDevicesCollapsed && (
                            <div className="device-grid">
                                {unassignedDevices
                                    .filter(d => !state.getEffectiveHidden(`device_${d.id}`))
                                    .map(dev => (
                                        <DeviceCard
                                            key={dev.id}
                                            device={dev}
                                            onToggle={ctx.onToggleDevice}
                                            isFavorite={ctx.favoriteDeviceIds.includes(dev.id)}
                                            onToggleFavorite={ctx.onToggleDeviceFavorite}
                                            onOpenSettings={state.handleOpenDeviceSettings}
                                            onOpenCameraStream={state.openCameraStream}
                                            isEditMode={state.edit.isEditMode}
                                            iconHiddenState={state.getIconHiddenState(`device_${dev.id}`)}
                                            onToggleVisibility={() => state.toggleCardVisibility(`device_${dev.id}`)}
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
                        <button onClick={state.toggleScenarios} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                            {state.collapse.isScenariosCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />}
                            <h2>Сценарии</h2>
                            <span className="section-count">{activeScenarios.filter(s => !state.getEffectiveHidden(`scenario_${s.id}`)).length}</span>
                        </button>
                    </div>
                    {!state.collapse.isScenariosCollapsed && (
                        <>
                            {activeScenarios.length === 0 ? (
                                <div className="empty-state"><p>У вас нет активных сценариев.</p></div>
                            ) : (
                                <div className="scenario-grid">
                                    {activeScenarios.map(scenario => {
                                        const cardId = `scenario_${scenario.id}`;
                                        const isHidden = state.getEffectiveHidden(cardId);
                                        if (!state.edit.isEditMode && isHidden) return null;
                                        return (
                                            <ScenarioCard
                                                key={scenario.id}
                                                scenario={scenario}
                                                onExecute={ctx.onExecuteScenario}
                                                isFavorite={ctx.favoriteScenarioIds.includes(scenario.id)}
                                                onToggleFavorite={ctx.onToggleScenarioFavorite}
                                                isEditMode={state.edit.isEditMode}
                                                iconHiddenState={state.getIconHiddenState(cardId)}
                                                onToggleVisibility={() => state.toggleCardVisibility(cardId)}
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
};
