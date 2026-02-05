import React, { useState, useMemo } from 'react';
import { YandexGroup, YandexDevice } from '../types';
import { DeviceCard } from './DeviceCard';
import { Loader2, Power, ChevronDown, ChevronRight, Settings } from 'lucide-react';

interface GroupCardProps {
  group: YandexGroup;
  devices: YandexDevice[];
  onToggleGroup: (id: string, currentState: boolean) => Promise<void>;
  onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
  favoriteDeviceIds: string[];
  onToggleDeviceFavorite: (id: string) => void;
  onOpenSettings?: (device: YandexDevice) => void;
  onOpenGroupSettings?: (group: YandexGroup) => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  devices,
  onToggleGroup,
  onToggleDevice,
  favoriteDeviceIds,
  onToggleDeviceFavorite,
  onOpenSettings,
  onOpenGroupSettings,
}) => {
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Получаем устройства, относящиеся к этой группе
  const groupDevices = useMemo(() => {
    return devices.filter(d => group.devices.includes(d.id));
  }, [devices, group.devices]);

  // Проверяем, является ли группа группой светильников
  const isLightGroup = useMemo(() => {
    return groupDevices.length > 0 && groupDevices.every(d => d.type === 'devices.types.light');
  }, [groupDevices]);

  // Проверяем, является ли группа группой терморегуляторов
  const isThermostatGroup = useMemo(() => {
    return groupDevices.length > 0 && groupDevices.every(d => 
      d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat'
    );
  }, [groupDevices]);

  // Определяем состояние группы: ON если все устройства включены, OFF если все выключены, иначе смешанное
  const groupIsOn = useMemo(() => {
    if (groupDevices.length === 0) return false;

    const onDevices = groupDevices.filter(d => {
      const onOffCapability = d.capabilities.find(c => c.type === 'devices.capabilities.on_off');
      return onOffCapability?.state?.value === true;
    });

    return onDevices.length === groupDevices.length;
  }, [groupDevices]);

  const hasOnOffCapability = useMemo(() => {
    return group.capabilities.some(c => c.type === 'devices.capabilities.on_off');
  }, [group.capabilities]);

  const groupOnOffCapability = useMemo(() => {
    return group.capabilities.find(c => c.type === 'devices.capabilities.on_off');
  }, [group.capabilities]);

  const groupIsEnabled = groupOnOffCapability?.state?.value === true;

  const handleToggleGroup = async () => {
    if (!hasOnOffCapability || loading) return;

    setLoading(true);
    try {
      await onToggleGroup(group.id, groupIsEnabled);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/5 rounded-2xl p-6">
      {/* Заголовок группы с кнопкой переключения */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            )}
          </button>
          <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
            {group.name}
          </h3>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900 px-2 py-1 rounded-full">
            {groupDevices.length} устройств
          </span>
        </div>

      {/* Тумблер вкл/выкл для группы */}
        {hasOnOffCapability && (
          <div className="flex items-center gap-2">
            {isLightGroup && onOpenGroupSettings && (
              <button
                onClick={() => onOpenGroupSettings(group)}
                className="flex-shrink-0 p-3 rounded-lg transition-all duration-300 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                title="Настройки освещения группы"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            {isThermostatGroup && onOpenGroupSettings && (
              <button
                onClick={() => onOpenGroupSettings(group)}
                className="flex-shrink-0 p-3 rounded-lg transition-all duration-300 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                title="Настройки климата группы"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleToggleGroup}
              disabled={loading}
              className={`flex-shrink-0 p-3 rounded-lg transition-all duration-300 ${
                groupIsEnabled
                  ? 'bg-purple-100 dark:bg-primary/20 text-purple-600 dark:text-primary hover:bg-purple-200 dark:hover:bg-primary/30'
                  : 'bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={groupIsEnabled ? 'Выключить группу' : 'Включить группу'}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Power className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Список устройств в группе */}
      {!isCollapsed && groupDevices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {groupDevices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onToggle={onToggleDevice}
              isFavorite={favoriteDeviceIds.includes(device.id)}
              onToggleFavorite={onToggleDeviceFavorite}
              onOpenSettings={onOpenSettings}
            />
          ))}
        </div>
      )}

      {/* Если нет устройств */}
      {groupDevices.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          В этой группе нет устройств
        </p>
      )}
    </div>
  );
};
