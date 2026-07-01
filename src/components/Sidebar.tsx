import React, { useState, useMemo, useRef, useEffect } from 'react';
import { YandexHousehold, YandexRoom, YandexGroup, YandexScenario, YandexDevice } from '../types/index';
import { getIconForScenario, getIconForDevice, isCameraDevice, isSensorDevice } from '../constants';
import { Home, ChevronDown, SquareSquare, Star, Loader2 } from 'lucide-react';

const DEFAULT_HOME_NAME = 'Мой Дом';

interface SidebarProps {
  households: YandexHousehold[];
  activeHouseholdId: string | null;
  onSwitchHousehold: (householdId?: string) => void;
  roomsForHome: YandexRoom[];
  groupsForHome: YandexGroup[];
  activeScenarios: YandexScenario[];
  devicesForHome: YandexDevice[];
  favoriteDeviceIds: string[];
  favoriteScenarioIds: string[];
  favoriteGroupIds: string[];
  onToggleDeviceFavorite: (id: string) => void;
  onToggleScenarioFavorite: (id: string) => void;
  onToggleGroupFavorite: (id: string) => void;
  onExecuteScenario: (id: string) => Promise<void>;
  onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
  onOpenCameraStream?: (device: YandexDevice) => void;
  onToggleGroup: (id: string, currentState: boolean) => Promise<void>;
  activeSidebarView: 'home' | 'room' | 'group';
  activeRoomId: string | null;
  activeGroupId: string | null;
  onSelectHome: () => void;
  onSelectRoom: (roomId: string) => void;
  onSelectGroup: (groupId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  households,
  activeHouseholdId,
  onSwitchHousehold,
  roomsForHome,
  groupsForHome,
  activeScenarios,
  devicesForHome,
  favoriteDeviceIds,
  favoriteScenarioIds,
  favoriteGroupIds,
  onToggleDeviceFavorite,
  onToggleScenarioFavorite,
  onToggleGroupFavorite,
  onExecuteScenario,
  onToggleDevice,
  onOpenCameraStream,
  onToggleGroup,
  activeSidebarView,
  activeRoomId,
  activeGroupId,
  onSelectHome,
  onSelectRoom,
  onSelectGroup,
}) => {
  const [houseDropdownOpen, setHouseDropdownOpen] = useState(false);
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  const getStorageKey = (baseKey: string): string => {
    if (!activeHouseholdId) return baseKey;
    return `${baseKey}:household:${activeHouseholdId}`;
  };

  const loadCollapsedSections = (): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem(getStorageKey('sidebar:collapsedSections'));
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  };

  const saveCollapsedSections = (sections: Record<string, boolean>) => {
    try {
      localStorage.setItem(getStorageKey('sidebar:collapsedSections'), JSON.stringify(sections));
    } catch (e) { console.error(e); }
  };

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(loadCollapsedSections);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      saveCollapsedSections(updated);
      return updated;
    });
  };

  useEffect(() => {
    setCollapsedSections(loadCollapsedSections());
  }, [activeHouseholdId]);

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

  const hasFavorites = favoriteScenarioIds.length > 0 || favoriteDeviceIds.length > 0 || favoriteGroupIds.length > 0;

  const favoriteScenarios = activeScenarios.filter(s => favoriteScenarioIds.includes(s.id));
  const favoriteDevices = devicesForHome.filter(d => favoriteDeviceIds.includes(d.id));
  const favoriteGroups = groupsForHome.filter(g => favoriteGroupIds.includes(g.id));

  const favoriteSensorDevices = useMemo(() => {
    return favoriteDevices
      .filter(d => isSensorDevice(d))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [favoriteDevices]);

  const favoriteRegularDevices = useMemo(() => {
    return favoriteDevices
      .filter(d => !isSensorDevice(d))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [favoriteDevices]);

  // All sensor devices for the Датчики section (always shown)
  const allSensors = devicesForHome.filter(d => isSensorDevice(d));
  const hasSensors = allSensors.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setHouseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const withLoading = (key: string, action: () => Promise<void>): (() => void) => {
    return () => {
      if (loadingItems[key]) return;
      setLoadingItems(prev => ({ ...prev, [key]: true }));
      action().finally(() => {
        setLoadingItems(prev => ({ ...prev, [key]: false }));
      });
    };
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="house-selector" onClick={() => hasMultipleHomes && setHouseDropdownOpen(!houseDropdownOpen)} ref={dropdownRef}>
          <div className="house-selector-name">{homeName}</div>
          {hasMultipleHomes && (
            <ChevronDown className="w-3.5 h-3.5 text-muted" style={{ transform: houseDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
          )}
          {houseDropdownOpen && (
            <div className="house-selector-dropdown">
              {households.map(h => (
                <div
                  key={h.id}
                  className={`house-option ${h.id === activeHouseholdId ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (h.id !== activeHouseholdId) {
                      onSwitchHousehold(h.id);
                    }
                    setHouseDropdownOpen(false);
                  }}
                >
                  {h.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-item ${activeSidebarView === 'home' ? 'active' : ''}`}
          onClick={onSelectHome}
        >
          <span className="sidebar-item-icon"><Home /></span>
          Все устройства
        </button>

        {hasFavorites && (
          <>
            <div className="sidebar-section-title" onClick={() => toggleSection('favorites')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronDown className="w-3 h-3" style={{ transform: collapsedSections['favorites'] ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
              Избранное
            </div>
            {!collapsedSections['favorites'] && (<>
              {favoriteScenarios.map(s => (
                <div key={s.id} className="sidebar-item" style={{ paddingRight: '8px' }}>
                  <span className="sidebar-item-icon">
                    {loadingItems[`scenario:${s.id}`]
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : React.cloneElement(getIconForScenario(s.icon, s.name) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                    }
                  </span>
                  <span
                    style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                    onClick={withLoading(`scenario:${s.id}`, () => onExecuteScenario(s.id))}
                  >{s.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleScenarioFavorite(s.id); }}
                    className="device-fav is-fav"
                    style={{ position: 'static', opacity: 1 }}
                  >
                    <Star className="w-3 h-3" fill="currentColor" />
                  </button>
                </div>
              ))}
              {favoriteSensorDevices.slice(0, 5).map(d => {
                const onOff = d.capabilities?.find(c => c.type === 'devices.capabilities.on_off');
                const isOn = onOff?.state?.value === true;
                return (
                  <div key={d.id} className="sidebar-item" style={{ paddingRight: '8px', opacity: 0.7 }}>
                    <span className="sidebar-item-icon">
                      {loadingItems[`device:${d.id}`]
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : React.cloneElement(getIconForDevice(d.type) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                      }
                    </span>
                    <span
                      style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                      onClick={withLoading(`device:${d.id}`, async () => {
                          if (isCameraDevice(d) && onOpenCameraStream) {
                              onOpenCameraStream(d);
                              return;
                          }
                          await onToggleDevice(d.id, isOn);
                      })}
                    >
                      {d.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleDeviceFavorite(d.id); }}
                      className="device-fav is-fav"
                      style={{ position: 'static', opacity: 1 }}
                    >
                      <Star className="w-3 h-3" fill="currentColor" />
                    </button>
                  </div>
                );
              })}
              {favoriteRegularDevices.slice(0, 5).map(d => {
                const onOff = d.capabilities?.find(c => c.type === 'devices.capabilities.on_off');
                const isOn = onOff?.state?.value === true;
                return (
                  <div key={d.id} className="sidebar-item" style={{ paddingRight: '8px', opacity: 0.7 }}>
                    <span className="sidebar-item-icon">
                      {loadingItems[`device:${d.id}`]
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : React.cloneElement(getIconForDevice(d.type) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                      }
                    </span>
                    <span
                      style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                      onClick={withLoading(`device:${d.id}`, async () => {
                          if (isCameraDevice(d) && onOpenCameraStream) {
                              onOpenCameraStream(d);
                              return;
                          }
                          await onToggleDevice(d.id, isOn);
                      })}
                    >
                      {d.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleDeviceFavorite(d.id); }}
                      className="device-fav is-fav"
                      style={{ position: 'static', opacity: 1 }}
                    >
                      <Star className="w-3 h-3" fill="currentColor" />
                    </button>
                  </div>
                );
              })}
              {favoriteGroups.map(g => {
                const onOff = g.capabilities?.find(c => c.type === 'devices.capabilities.on_off');
                const isOn = onOff?.state?.value === true;
                return (
                <div key={g.id} className="sidebar-item" style={{ paddingRight: '8px', opacity: 0.7 }}>
                  <span className="sidebar-item-icon">
                    {loadingItems[`group:${g.id}`]
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                        </svg>
                    }
                  </span>
                  <span
                    style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                    onClick={withLoading(`group:${g.id}`, () => onToggleGroup(g.id, isOn))}
                  >
                    {g.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleGroupFavorite(g.id); }}
                    className="device-fav is-fav"
                    style={{ position: 'static', opacity: 1 }}
                  >
                    <Star className="w-3 h-3" fill="currentColor" />
                  </button>
                </div>
              );
            })}
            </>)}
          </>
        )}

        {hasSensors && (
          <>
            <div className="sidebar-section-title" onClick={() => toggleSection('sensors')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronDown className="w-3 h-3" style={{ transform: collapsedSections['sensors'] ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
              Датчики
              <span className="sidebar-item-badge">{allSensors.length}</span>
            </div>
            {!collapsedSections['sensors'] && allSensors.map(d => {
              const isFav = favoriteDeviceIds.includes(d.id);
              return (
                <div key={d.id} className="sidebar-item" style={{ paddingRight: '8px', opacity: 0.7 }}>
                  <span className="sidebar-item-icon">
                    {React.cloneElement(getIconForDevice(d.type) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {d.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleDeviceFavorite(d.id); }}
                    className={isFav ? 'device-fav is-fav' : ''}
                    style={{
                      position: 'static',
                      ...(isFav
                        ? {}
                        : {
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            flexShrink: 0,
                          }),
                    }}
                  >
                    <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                </div>
              );
            })}
          </>
        )}

        {roomsForHome.length > 0 && (
          <>
            <div className="sidebar-section-title" onClick={() => toggleSection('rooms')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronDown className="w-3 h-3" style={{ transform: collapsedSections['rooms'] ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
              Комнаты
            </div>
            {!collapsedSections['rooms'] && roomsForHome.map(room => {
              const count = devicesForHome.filter(d => d.room === room.id).length;
              return (
                <button
                  key={room.id}
                  className={`sidebar-item ${activeSidebarView === 'room' && activeRoomId === room.id ? 'active' : ''}`}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <span className="sidebar-item-icon"><SquareSquare /></span>
                  {room.name}
                  <span className="sidebar-item-badge">{count}</span>
                </button>
              );
            })}
          </>
        )}

        {groupsForHome.length > 0 && (
          <>
            <div className="sidebar-section-title" onClick={() => toggleSection('groups')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronDown className="w-3 h-3" style={{ transform: collapsedSections['groups'] ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
              Группы устройств
            </div>
            {!collapsedSections['groups'] && groupsForHome.map(group => {
              const count = group.devices.length;
              return (
                <button
                  key={group.id}
                  className={`sidebar-item ${activeSidebarView === 'group' && activeGroupId === group.id ? 'active' : ''}`}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <span className="sidebar-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </span>
                  {group.name}
                  <span className="sidebar-item-badge">{count}</span>
                </button>
              );
            })}
          </>
        )}

        {activeScenarios.length > 0 && (
          <>
            <div className="sidebar-section-title" onClick={() => toggleSection('scenarios')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronDown className="w-3 h-3" style={{ transform: collapsedSections['scenarios'] ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
              Сценарии
            </div>
            {!collapsedSections['scenarios'] && activeScenarios.map(s => (
              <div key={s.id} className="sidebar-item" style={{ paddingRight: '8px' }}>
                <span className="sidebar-item-icon">
                  {loadingItems[`scenario:${s.id}`]
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : React.cloneElement(getIconForScenario(s.icon, s.name) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                  }
                </span>
                <span
                  style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                  onClick={withLoading(`scenario:${s.id}`, () => onExecuteScenario(s.id))}
                >
                  {s.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleScenarioFavorite(s.id); }}
                  style={{
                    position: 'static',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: favoriteScenarioIds.includes(s.id) ? 'var(--fav-star)' : 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  <Star className="w-3.5 h-3.5" fill={favoriteScenarioIds.includes(s.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
};
