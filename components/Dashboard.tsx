import React, { useState } from 'react';
import { YandexUserInfoResponse, YandexScenario } from '../types';
import { ScenarioCard } from './ScenarioCard';
import { DeviceCard } from './DeviceCard';
import { LogOut, Home, Layers, MonitorSmartphone, RefreshCw, X, Star, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';


// 1. Константы для хранения и значения по умолчанию (хорошая практика)
const HOME_NAME_STORAGE_KEY = 'dashboard_home_name';
const DEFAULT_HOME_NAME = 'Мой Дом';

// 2. Функция для получения начального имени из localStorage
const getInitialHomeName = () => {
    // Проверяем, доступен ли localStorage (на случай рендеринга на сервере, хотя в Electron это обычно не нужно)
    if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(HOME_NAME_STORAGE_KEY) || DEFAULT_HOME_NAME;
    }
    return DEFAULT_HOME_NAME;
};

interface DashboardProps {
  data: YandexUserInfoResponse;
  onLogout: () => void;
  onExecuteScenario: (id: string) => Promise<void>;
  onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
  favoriteDeviceIds: string[];
  onToggleDeviceFavorite: (id: string) => void;
  favoriteScenarioIds: string[];
  onToggleScenarioFavorite: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onLogout, onExecuteScenario, onToggleDevice, onRefresh, isRefreshing, favoriteDeviceIds, onToggleDeviceFavorite, favoriteScenarioIds,  onToggleScenarioFavorite }) => {
  const activeScenarios = data.scenarios.filter(s => s.is_active);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Инициализация homeName с использованием сохраненного значения
  const [homeName, setHomeName] = useState(getInitialHomeName); 
  const [isEditingName, setIsEditingName] = useState(false);

  const favoriteScenarios = data.scenarios.filter(s => favoriteScenarioIds.includes(s.id));
  const favoriteDevices = data.devices.filter(d => favoriteDeviceIds.includes(d.id));
    
  const hasFavorites = favoriteScenarios.length > 0 || favoriteDevices.length > 0;

  const handleSaveName = (event: React.FormEvent<HTMLInputElement>) => {
        let newName = event.currentTarget.value.trim();

        if (newName === '') {
            newName = DEFAULT_HOME_NAME;
        }

        setHomeName(newName);
        
        // --- Главное изменение: Запись в localStorage ---
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(HOME_NAME_STORAGE_KEY, newName);
        }
        // ------------------------------------------------

        setIsEditingName(false);
    };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-slate-900 dark:text-slate-100 pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-surface/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-primary/20 rounded-lg">
              <Home className="w-5 h-5 text-purple-600 dark:text-primary" />
            </div>
            {isEditingName ? (
				<input
				  type="text"
				  value={homeName}
				  onChange={(e) => setHomeName(e.target.value)}
				  onBlur={handleSaveName} // Сохранение при потере фокуса
				  onKeyDown={(e) => {
					if (e.key === 'Enter') {
					  handleSaveName(e); // Сохранение при нажатии Enter
					} else if (e.key === 'Escape') {
						setIsEditingName(false); // Отмена при нажатии Esc
					}
				  }}
				  className="text-lg font-bold tracking-tight bg-gray-200 dark:bg-slate-700 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-primary text-slate-900 dark:text-slate-100"
				  autoFocus // Установить фокус сразу после перехода в режим редактирования
				  aria-label="Имя Дома"
				  maxLength={30} // Ограничение на длину имени
				/>
			  ) : (
				// В режиме отображения делаем H1 кликабельным для перехода в режим редактирования
				<h1 
				  className="text-lg font-bold tracking-tight cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-slate-900 dark:text-slate-100"
				  onClick={() => setIsEditingName(true)} // Переключение в режим редактирования
				  title="Нажмите, чтобы изменить название"
				>
				  {homeName}
				</h1>
			  )}
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-slate-900 rounded-full border border-gray-300 dark:border-slate-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Онлайн</span>
             </div>
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
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.rooms.length}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/5 p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400"><MonitorSmartphone className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-slate-600 dark:text-secondary">Устройств</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.devices.length}</p>
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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Сценарии</h2>
            <span className="text-sm text-slate-600 dark:text-secondary bg-white dark:bg-surface px-3 py-1 rounded-full border border-gray-200 dark:border-white/5">
              {activeScenarios.length} активных
            </span>
          </div>

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
        </section>

        {/* Devices Section */}
        <section>
            <h2 className="text-2xl font-bold mb-8 text-slate-900 dark:text-slate-100">Устройства</h2>
            
            {data.rooms.length === 0 && data.devices.length > 0 && (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {data.devices.map(device => (
                        <DeviceCard 
						key={device.id} 
						device={device} 
						onToggle={onToggleDevice} 
						isFavorite={favoriteDeviceIds.includes(device.id)} 
                        onToggleFavorite={onToggleDeviceFavorite}
						/>
                    ))}
                 </div>
            )}

            <div className="space-y-8">
                {data.rooms.map(room => {
                    const roomDevices = data.devices.filter(d => room.devices.includes(d.id));
                    if (roomDevices.length === 0) return null;
                    
                    return (
                        <div key={room.id} className="bg-gray-100 dark:bg-surface/30 border border-gray-200 dark:border-white/5 rounded-2xl p-6">
                            <h3 className="font-semibold text-lg mb-4 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-primary"></span>
                                {room.name}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {roomDevices.map(dev => (
                                    <DeviceCard 
									key={dev.id} 
									device={dev} 
									onToggle={onToggleDevice} 
									isFavorite={favoriteDeviceIds.includes(dev.id)} 
									onToggleFavorite={onToggleDeviceFavorite}
									/>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
            
            {/* Unassigned Devices */}
             {(() => {
                 const assignedIds = new Set(data.rooms.flatMap(r => r.devices));
                 const unassignedDevices = data.devices.filter(d => !assignedIds.has(d.id));
                 if (unassignedDevices.length === 0) return null;

                 return (
                     <div className="mt-8 bg-gray-100 dark:bg-surface/30 border border-gray-200 dark:border-white/5 rounded-2xl p-6">
                        <h3 className="font-semibold text-lg mb-4 text-slate-700 dark:text-slate-300">Без комнаты</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {unassignedDevices.map(dev => (
                                <DeviceCard 
								key={dev.id} 
								device={dev} 
								onToggle={onToggleDevice} 
								isFavorite={favoriteDeviceIds.includes(dev.id)} 
								onToggleFavorite={onToggleDeviceFavorite}
								/>
                            ))}
                        </div>
                     </div>
                 );
             })()}

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
	  
    </div>
  );
};