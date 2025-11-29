import React, { useState } from 'react';
import { YandexUserInfoResponse, YandexScenario } from '../types';
import { ScenarioCard } from './ScenarioCard';
import { DeviceCard } from './DeviceCard';
import { LogOut, Home, Layers, MonitorSmartphone, RefreshCw, X } from 'lucide-react';

interface DashboardProps {
  data: YandexUserInfoResponse;
  onLogout: () => void;
  onExecuteScenario: (id: string) => Promise<void>;
  onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onLogout, onExecuteScenario, onToggleDevice, onRefresh, isRefreshing }) => {
  const activeScenarios = data.scenarios.filter(s => s.is_active);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  return (
    <div className="min-h-screen bg-background text-slate-100 pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-white/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Home className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Мой Дом</h1>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-slate-400 font-medium">Онлайн</span>
             </div>
			 <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Обновить данные">
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
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
            <div className="bg-surface border border-white/5 p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><Layers className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-secondary">Комнат</p>
                    <p className="text-xl font-bold">{data.rooms.length}</p>
                </div>
            </div>
            <div className="bg-surface border border-white/5 p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400"><MonitorSmartphone className="w-6 h-6"/></div>
                <div>
                    <p className="text-sm text-secondary">Устройств</p>
                    <p className="text-xl font-bold">{data.devices.length}</p>
                </div>
            </div>
        </div>


        {/* Scenarios Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Сценарии</h2>
            <span className="text-sm text-secondary bg-surface px-3 py-1 rounded-full border border-white/5">
              {activeScenarios.length} активных
            </span>
          </div>

          {activeScenarios.length === 0 ? (
             <div className="text-center py-20 border-2 border-dashed border-slate-700 rounded-2xl bg-surface/30">
                <p className="text-slate-400">У вас нет активных сценариев.</p>
             </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {activeScenarios.map((scenario: YandexScenario) => (
                <ScenarioCard 
                  key={scenario.id} 
                  scenario={scenario} 
                  onExecute={onExecuteScenario} 
                />
              ))}
            </div>
          )}
        </section>

        {/* Devices Section */}
        <section>
            <h2 className="text-2xl font-bold mb-8">Устройства</h2>
            
            {data.rooms.length === 0 && data.devices.length > 0 && (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {data.devices.map(device => (
                        <DeviceCard key={device.id} device={device} onToggle={onToggleDevice} />
                    ))}
                 </div>
            )}

            <div className="space-y-8">
                {data.rooms.map(room => {
                    const roomDevices = data.devices.filter(d => room.devices.includes(d.id));
                    if (roomDevices.length === 0) return null;
                    
                    return (
                        <div key={room.id} className="bg-surface/30 border border-white/5 rounded-2xl p-6">
                            <h3 className="font-semibold text-lg mb-4 text-slate-300 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                {room.name}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {roomDevices.map(dev => (
                                    <DeviceCard key={dev.id} device={dev} onToggle={onToggleDevice} />
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
                     <div className="mt-8 bg-surface/30 border border-white/5 rounded-2xl p-6">
                        <h3 className="font-semibold text-lg mb-4 text-slate-300">Без комнаты</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {unassignedDevices.map(dev => (
                                <DeviceCard key={dev.id} device={dev} onToggle={onToggleDevice} />
                            ))}
                        </div>
                     </div>
                 );
             })()}

        </section>

      </main>
	  
      {showConfirmModal && (
          <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-300">
                  <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold text-slate-100">Подтверждение выхода</h3>
                      <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                  <p className="text-slate-300 mb-6 text-sm">
                      Вы уверены, что хотите выйти из учетной записи? После этого действия для последующего входа потребуется токен.
                  </p>

                  <div className="flex justify-end gap-3">
                      {/* Кнопка "Нет" (выделена красной обводкой) */}
                      <button
                          onClick={() => setShowConfirmModal(false)}
                          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border border-red-500 text-red-400 hover:bg-red-900/30"
                      >
                          Нет
                      </button>

                      {/* Кнопка "Да, уверен" */}
                      <button
                          onClick={() => {
                              onLogout(); // Вызов функции выхода из App.tsx
                              setShowConfirmModal(false); // Закрываем модальное окно
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary hover:bg-blue-600 text-white"
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