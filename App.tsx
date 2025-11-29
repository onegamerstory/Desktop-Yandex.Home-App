import React, { useState, useEffect, useCallback } from 'react';
import { TokenInput } from './components/TokenInput';
import { Dashboard } from './components/Dashboard';
import { fetchUserInfo, executeScenario, toggleDevice } from './services/yandexIoT';
import { AppState, YandexUserInfoResponse } from './types';
import { AlertCircle, X } from 'lucide-react';

const yandexApi = window.api; // Получаем доступ к IPC-мосту

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LOADING);
  const [token, setToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<YandexUserInfoResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

	const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
	  setNotification({ message, type });
	  setTimeout(() => setNotification(null), 5000); // Auto hide
	};	
	
	const stableSortData = useCallback((data: YandexUserInfoResponse): YandexUserInfoResponse => {
        // 1. Сортировка устройств по ID (для стабильности при переключении)
        const sortedDevices: Device[] = [...data.devices].sort((a, b) => a.id.localeCompare(b.id));

        // 2. Сортировка комнат по названию
        const sortedRooms: YandexRoom[] = [...data.rooms].sort((a, b) => a.name.localeCompare(b.name));

        // 3. Сортировка сценариев по названию
        const sortedScenarios: YandexScenario[] = [...data.scenarios].sort((a, b) => a.name.localeCompare(b.name));

        return { 
            ...data, 
            devices: sortedDevices,
            rooms: sortedRooms,
            scenarios: sortedScenarios,
        };
    }, []);
	
	// --- 1. ФУНКЦИЯ ДЛЯ ТИХОГО ФОНОВОГО ОБНОВЛЕНИЯ ДАННЫХ (НЕ СБРАСЫВАЕТ SCROLL) ---
  const refreshDashboardData = useCallback(async (apiToken: string) => {
    try {
      const data = await fetchUserInfo(apiToken);
	  const sortedData = stableSortData(data);
      setUserData(sortedData);
      // Важно: не меняем appState, чтобы оставаться на Dashboard и не терять скролл
    } catch (err: unknown) {
      // Если при фоновом обновлении получаем ошибку авторизации,
      // выходим из системы (fallback)
      if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
          await yandexApi.deleteSecureToken(); 
          setToken(null);
          setUserData(null);
          setAppState(AppState.AUTH);
          showNotification('Сессия истекла. Пожалуйста, введите токен заново.', 'error');
      } else {
        showNotification('Ошибка обновления данных.', 'error');
      }
    }
  }, [showNotification, stableSortData]);
  
  
	// --- 2. ФУНКЦИЯ ДЛЯ ИНИЦИАЛИЗАЦИИ И АВТОРИЗАЦИИ (МЕНЯЕТ appState) ---
	const loadData = useCallback(async (apiToken: string) => {
		setAppState(AppState.LOADING);
		setErrorMsg(undefined);
		try {
		  const data = await fetchUserInfo(apiToken);
		  const sortedData = stableSortData(data);
		  setUserData(sortedData);
		  setAppState(AppState.DASHBOARD);
		} catch (err: unknown) {
		  if (err instanceof Error) {
			setErrorMsg(err.message);
		  } else {
			setErrorMsg('Неизвестная ошибка');
		  }
		  setAppState(AppState.AUTH);
		  
		  // If unauthorized, clear invalid token
		  if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
			  await yandexApi.deleteSecureToken();
			  setToken(null);
		  }
		}
	  }, [stableSortData]);


  // Initialize: Check Local Storage
  useEffect(() => {
    const checkToken = async () => {
		setAppState(AppState.LOADING);
		
		// ИСПОЛЬЗУЕМ IPC ДЛЯ БЕЗОПАСНОГО ИЗВЛЕЧЕНИЯ ТОКЕНА
		const storedToken = await yandexApi.getSecureToken(); 
		
		if (storedToken) {
			setToken(storedToken);
			loadData(storedToken);
		} else {
			setAppState(AppState.AUTH);
		}
	};
	checkToken();
  }, [loadData]);

  

  

  const handleTokenSubmit = async (newToken: string) => {
    setToken(newToken);
        
	// ИСПОЛЬЗУЕМ IPC ДЛЯ СОХРАНЕНИЯ ТОКЕНА
	await yandexApi.setSecureToken(newToken); 
	
	loadData(newToken);
  };

  const handleLogout = async () => {
    // ИСПОЛЬЗУЕМ IPC ДЛЯ УДАЛЕНИЯ ТОКЕНА
	await yandexApi.deleteSecureToken(); 
	
	setToken(null);
	setUserData(null);
	setAppState(AppState.AUTH);
	setErrorMsg(undefined);
  };

  const handleExecuteScenario = useCallback(async (scenarioId: string) => {
    if (!token) return;
    try {
        await executeScenario(token, scenarioId);
        showNotification('Сценарий успешно запущен', 'success');
		refreshDashboardData(token);
    } catch (err) {
        if (err instanceof Error) {
            showNotification(err.message, 'error');
        } else {
            showNotification('Ошибка выполнения сценария', 'error');
        }
        throw err; // Re-throw to let component know
    }
  }, [token, refreshDashboardData]);

  const handleToggleDevice = useCallback(async (deviceId: string, currentState: boolean) => {
      if (!token || !userData) return;
      
      const newState = !currentState;

      try {
          await toggleDevice(token, deviceId, newState);
          
          // Optimistically update the UI state
          setUserData(prevData => {
              if (!prevData) return null;
              
              const updatedDevices = prevData.devices.map(device => {
                  if (device.id === deviceId) {
                      // Clone device and capabilities
                      const updatedCapabilities = device.capabilities.map(cap => {
                          if (cap.type === 'devices.capabilities.on_off') {
                              return {
                                  ...cap,
                                  state: { ...cap.state, instance: 'on', value: newState }
                              };
                          }
                          return cap;
                      });
                      return { ...device, capabilities: updatedCapabilities };
                  }
                  return device;
              });

              return stableSortData({ ...prevData, devices: updatedDevices });
          });
		  
		  refreshDashboardData(token);
		  
      } catch (err) {
          if (err instanceof Error) {
            showNotification(`Ошибка: ${err.message}`, 'error');
          } else {
            showNotification('Не удалось переключить устройство', 'error');
          }
          throw err;
      }
  }, [token, userData, refreshDashboardData, stableSortData]);

  // Global Notification Toast
  const NotificationToast = () => {
      if (!notification) return null;
      return (
          <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 border ${notification.type === 'error' ? 'bg-red-900/90 border-red-500/30 text-white' : 'bg-green-900/90 border-green-500/30 text-white'}`}>
              {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-white/50 border-t-white animate-spin-none" />} 
              <span className="text-sm font-medium">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100">
                  <X className="w-4 h-4"/>
              </button>
          </div>
      );
  };

  // Loading Screen
  if (appState === AppState.LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 animate-pulse">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  // Dashboard
  if (appState === AppState.DASHBOARD && userData) {
    return (
      <>
        <Dashboard 
          data={userData} 
          onLogout={handleLogout} 
          onExecuteScenario={handleExecuteScenario} 
          onToggleDevice={handleToggleDevice}
        />
        <NotificationToast />
      </>
    );
  }

  // Auth Screen (Default fallthrough)
  return (
    <>
        <TokenInput 
        onTokenSubmit={handleTokenSubmit} 
        isLoading={false}
        error={errorMsg}
        />
        {/* If there was a fatal error in loadData leading to Auth screen, notification might still be useful, or use errorMsg prop */}
    </>
  );
}

export default App;