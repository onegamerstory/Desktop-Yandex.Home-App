import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TokenInput } from './components/TokenInput';
import { Dashboard } from './components/Dashboard';
import { UpdateNotificationModal } from './components/modals/UpdateNotificationModal';
import { fetchUserInfo, executeScenario, toggleDevice, toggleGroup, setDeviceMode } from './services/yandexIoT';
import { AppState, YandexUserInfoResponse, YandexDevice, YandexRoom, YandexScenario, YandexGroup, TrayMenuItem, TrayItemType, YandexHousehold } from './types/index'; 
import { formatSensorValueForTray } from './constants';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import packageJson from '../package.json';

// Получаем доступ к IPC-мосту, предоставленному Electron preload скриптом
const yandexApi = window.api; 

// --- Вспомогательные функции для LocalStorage ---
const getFavorites = (key: string): string[] => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Error reading favorites from localStorage", e);
        return [];
    }
};

const setFavorites = (key: string, ids: string[]): void => {
    try {
        localStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {
        console.error("Error saving favorites to localStorage", e);
    }
};

// --- Вспомогательная функция для сравнения версий ---
const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
};

// --- Вспомогательная функция для проверки обновлений ---
const checkForUpdates = async (): Promise<{latestVersion: string, releaseUrl: string, releaseDate: string} | null> => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/onegamerstory/Desktop-Yandex.Home-App/releases/latest'
      );
      if (!response.ok) {
        throw new Error('Не удалось получить информацию о последней версии');
      }
      const data = await response.json();
      const latestVersion = data.tag_name || null;
      const currentVersion = packageJson.version;
      
      if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
        return {
          latestVersion,
          releaseUrl: data.html_url,
          releaseDate: new Date(data.published_at).toLocaleDateString('ru-RU'),
        };
      }
      return null;
    } catch (err) {
      console.error('Ошибка при проверке обновлений:', err);
      return null;
    }
};
function App() {
  // --- Состояние приложения ---
  const [appState, setAppState] = useState<AppState>(AppState.LOADING);
  const [token, setToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<YandexUserInfoResponse | null>(null);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Состояние избранного, загруженное из LocalStorage
  const [favoriteDeviceIds, setFavoriteDeviceIds] = useState<string[]>(getFavorites('favoriteDeviceIds'));
  const [favoriteScenarioIds, setFavoriteScenarioIds] = useState<string[]>(getFavorites('favoriteScenarioIds'));
  
  // Состояние автозапуска
  const [isAutostartEnabled, setIsAutostartEnabled] = useState<boolean>(false);
  
  // Состояние для отслеживания повторных попыток подключения
  const [retryInfo, setRetryInfo] = useState<{attempt: number, maxAttempts: number, message: string} | null>(null);

  // Состояние для уведомления об обновлении
  const [showUpdateNotification, setShowUpdateNotification] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<{latestVersion: string, releaseUrl: string, releaseDate: string} | null>(null);

  // Ref для userData, чтобы избежать пересоздания refreshDashboardData при обновлении данных
  const userDataRef = useRef(userData);
  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

	// --- Уведомления ---
	const showNotification = useCallback((message: string, type: 'error' | 'success' = 'error') => {
	  setNotification({ message, type });
	  setTimeout(() => setNotification(null), 3000); // Автоматическое скрытие через 3 секунды
	}, []); // Зависимости не требуются

	// --- Функция для обеспечения стабильного порядка элементов ---
  const stableSortData = useCallback((data: YandexUserInfoResponse): YandexUserInfoResponse => {
        // 1. Сортировка устройств по ID (для стабильности при переключении)
        const sortedDevices: YandexDevice[] = [...data.devices].sort((a, b) => a.id.localeCompare(b.id));

        // 2. Сортировка комнат по названию
        const sortedRooms: YandexRoom[] = [...data.rooms].sort((a, b) => a.name.localeCompare(b.name));

        // 3. Сортировка сценариев по названию
        const sortedScenarios: YandexScenario[] = [...data.scenarios].sort((a, b) => a.name.localeCompare(b.name));

        // 4. Сортировка групп по названию
        const sortedGroups: YandexGroup[] = [...data.groups].sort((a, b) => a.name.localeCompare(b.name));

        return { 
            ...data, 
            devices: sortedDevices,
            rooms: sortedRooms,
            scenarios: sortedScenarios,
            groups: sortedGroups,
        };
    }, []);

	// --- ФУНКЦИИ ДЕЙСТВИЙ ---

	// Функция для проверки изменений в состоянии устройств
	const hasDeviceStateChanges = useCallback((oldData: YandexUserInfoResponse | null, newData: YandexUserInfoResponse): boolean => {
		if (!oldData) return true;
		
		// Создаем карты устройств для быстрого сравнения
		const oldDevicesMap = new Map(oldData.devices.map(d => [d.id, d]));
		const newDevicesMap = new Map(newData.devices.map(d => [d.id, d]));
		
		// Проверяем изменения в capabilities (состояния устройств)
		for (const [deviceId, newDevice] of newDevicesMap) {
			const oldDevice = oldDevicesMap.get(deviceId);
			if (!oldDevice) continue;
			
			// Сравниваем состояния capabilities
			const oldCapabilities = oldDevice.capabilities || [];
			const newCapabilities = newDevice.capabilities || [];
			
			if (oldCapabilities.length !== newCapabilities.length) return true;
			
			for (let i = 0; i < oldCapabilities.length; i++) {
				const oldCap = oldCapabilities[i];
				const newCap = newCapabilities[i];
				if (oldCap.type !== newCap.type) return true;
				if (JSON.stringify(oldCap.state) !== JSON.stringify(newCap.state)) return true;
			}
			
			// Сравниваем состояния properties (для сенсоров)
			const oldProperties = oldDevice.properties || [];
			const newProperties = newDevice.properties || [];
			
			if (oldProperties.length !== newProperties.length) return true;
			
			for (let i = 0; i < oldProperties.length; i++) {
				const oldProp = oldProperties[i] as any;
				const newProp = newProperties[i] as any;
				if (oldProp.type !== newProp.type) return true;
				if (JSON.stringify(oldProp.state) !== JSON.stringify(newProp.state)) return true;
			}
		}
		
		return false;
	}, []);

	// Функция для тихого фонового обновления данных (не сбрасывает scroll)
  const refreshDashboardData = useCallback(async (apiToken: string, silent: boolean = false) => {
		if (!silent) {
			setIsRefreshing(true);
		}
    		try {
     		const data = await fetchUserInfo(apiToken);
     		const sortedData = stableSortData(data);
     		
     		// Проверяем, есть ли изменения в состоянии устройств
      		const hasChanges = hasDeviceStateChanges(userDataRef.current, sortedData);
     		
     		setUserData(sortedData);
            const households = sortedData.households || [];
            setActiveHouseholdId(prev => {
              if (prev && households.some(h => h.id === prev)) {
                return prev;
              }
              return households.length > 0 ? households[0].id : null;
            });
            
            // Показываем уведомление только при ручном обновлении
            if (!silent) {
            	showNotification('Данные успешно обновлены.', 'success');
            } else if (hasChanges) {
            	// Тихая синхронизация: обновляем без уведомления, но данные обновятся в UI
            	console.log('Device states synchronized from external changes');
            }
     		// Важно: не меняем appState, чтобы оставаться на Dashboard и не терять скролл
    	} catch (err: unknown) {
     		// Если при фоновом обновлении получаем ошибку авторизации, выходим из системы
     		if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
         		await yandexApi.deleteSecureToken(); 
         		setToken(null);
         		setUserData(null);
         		setAppState(AppState.AUTH);
         		showNotification('Сессия истекла. Пожалуйста, введите токен заново.', 'error');
     		} else {
     			// При тихой синхронизации не показываем ошибки (чтобы не мешать пользователю)
     			if (!silent) {
     				showNotification('Ошибка обновления данных.', 'error');
     			} else {
     				console.error('Silent sync error:', err);
     			}
     		}
    	} finally {
    		if (!silent) {
    			setIsRefreshing(false);
    		}
    	}
 	}, [showNotification, stableSortData, hasDeviceStateChanges]);
  
	// Функция для инициализации и авторизации (меняет appState)
	const loadData = useCallback(async (apiToken: string) => {
		setAppState(AppState.LOADING);
		setErrorMsg(undefined);
		try {
		  const data = await fetchUserInfo(apiToken);
		  const sortedData = stableSortData(data);
		  setUserData(sortedData);
          const households = sortedData.households || [];
          setActiveHouseholdId(prev => {
            if (prev && households.some(h => h.id === prev)) {
              return prev;
            }
            return households.length > 0 ? households[0].id : null;
          });
		  setAppState(AppState.DASHBOARD);
		} catch (err: unknown) {
		  if (err instanceof Error) {
			setErrorMsg(err.message);
		  } else {
			setErrorMsg('Неизвестная ошибка');
		  }
		  setAppState(AppState.AUTH);
		  
		  // Если ошибка авторизации, очищаем невалидный токен
		  if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
			  await yandexApi.deleteSecureToken();
			  setToken(null);
		  }
		}
	  }, [stableSortData]);

  // Переключение активного дома (round-robin)
  const handleSwitchHousehold = useCallback(() => {
    if (!userData || !userData.households || userData.households.length === 0) return;

    setActiveHouseholdId(prev => {
      const households = userData.households;
      if (!prev) {
        return households[0].id;
      }
      const currentIndex = households.findIndex(h => h.id === prev);
      if (currentIndex === -1) {
        return households[0].id;
      }
      const nextIndex = (currentIndex + 1) % households.length;
      return households[nextIndex].id;
    });

    if (token) {
      refreshDashboardData(token);
    }
  }, [userData, token, refreshDashboardData]);

	// Обработчик переключения устройства (выполняется API-запрос + оптимистичное обновление)
  	const handleToggleDevice = useCallback(async (deviceId: string, currentState: boolean) => {
      	if (!token || !userData) return;
      
      	const newState = !currentState;

    	try {
          	// 1. Выполняем API-запрос на переключение
          	await toggleDevice(token, deviceId, newState);
          
          	// 2. Оптимистичное обновление UI
          	setUserData(prevData => {
              		if (!prevData) return null;
              
              		const updatedDevices = prevData.devices.map(device => {
                  		if (device.id === deviceId) {
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
		  
			// 3. Запускаем полное обновление для синхронизации
		  	refreshDashboardData(token);
		  
      	} catch (err) {
          	if (err instanceof Error) {
          		showNotification(`Ошибка: ${err.message}`, 'error');
          	} else {
          		showNotification('Не удалось переключить устройство', 'error');
          	}
          	throw err; // Пробрасываем ошибку для обработки, например, в трее
      	}
  	}, [token, userData, refreshDashboardData, stableSortData, showNotification]);
	// Обработчик переключения группы
	const handleToggleGroup = useCallback(async (groupId: string, currentState: boolean) => {
		if (!token || !userData) return;
		
		const newState = !currentState;
		const group = userData.groups.find(g => g.id === groupId);
		const deviceIds = group?.devices || [];

		try {
			// 1. Выполняем API-запрос на переключение группы
			await toggleGroup(token, groupId, deviceIds, newState);
			
			// 2. Запускаем обновление для синхронизации
			refreshDashboardData(token);
			showNotification('Группа успешно переключена', 'success');
		} catch (err) {
			if (err instanceof Error) {
				showNotification(`Ошибка: ${err.message}`, 'error');
			} else {
				showNotification('Не удалось переключить группу', 'error');
			}
			throw err;
		}
	}, [token, userData, refreshDashboardData, showNotification]);
	// Обработчик запуска сценария
 	const handleExecuteScenario = useCallback(async (scenarioId: string) => {
   		if (!token) return;
   		try {
     			await executeScenario(token, scenarioId);
     			showNotification('Сценарий успешно запущен', 'success');
				// Обновляем данные на случай, если сценарий изменил состояние устройств
				refreshDashboardData(token); 
   		} catch (err) {
     			if (err instanceof Error) {
       				showNotification(err.message, 'error');
     			} else {
       				showNotification('Ошибка выполнения сценария', 'error');
     			}
     			throw err; // Пробрасываем ошибку для обработки, например, в трее
   		}
 	}, [token, refreshDashboardData, showNotification]);

	// Обработчик установки режима устройства (для кондиционеров)
 	const handleSetDeviceMode = useCallback(async (deviceId: string, modeActions: Array<{ instance: string; value: any; type?: string }>, turnOn: boolean = false) => {
   		if (!token) return;
   		try {
     			await setDeviceMode(token, deviceId, modeActions, turnOn);
     			showNotification('Настройки успешно применены', 'success');
				// Обновляем данные для синхронизации состояния
				refreshDashboardData(token);
   		} catch (err) {
     			if (err instanceof Error) {
       				showNotification(err.message, 'error');
     			} else {
       				showNotification('Ошибка применения настроек', 'error');
     			}
     			throw err;
   		}
 	}, [token, refreshDashboardData, showNotification]);
	
	// Обработчик отправки токена
  	const handleTokenSubmit = async (newToken: string) => {
    		setToken(newToken);
    		// Сохраняем токен безопасно через IPC
			await yandexApi.setSecureToken(newToken); 
			loadData(newToken);
  	};

	// Обработчик выхода
  	const handleLogout = async () => {
    		// Удаляем токен безопасно через IPC
			await yandexApi.deleteSecureToken(); 
			
			setToken(null);
			setUserData(null);
			setAppState(AppState.AUTH);
			setErrorMsg(undefined);
  	};

	// Обработчик отмены переподключения
	const handleCancelRetry = async () => {
		// Удаляем токен и возвращаемся на экран авторизации
		await yandexApi.deleteSecureToken();
		
		setToken(null);
		setUserData(null);
		setRetryInfo(null);
		setAppState(AppState.AUTH);
		setErrorMsg('Подключение отменено. Пожалуйста, авторизуйтесь снова.');
	};

	// --- Управление избранным ---
	const handleToggleDeviceFavorite = useCallback((id: string) => {
		setFavoriteDeviceIds(prevIds => {
			const newIds = prevIds.includes(id) 
				? prevIds.filter(itemId => itemId !== id) // Удаляем
				: [...prevIds, id];                        // Добавляем
			setFavorites('favoriteDeviceIds', newIds);
			return newIds;
		});
	}, []);

	const handleToggleScenarioFavorite = useCallback((id: string) => {
		setFavoriteScenarioIds(prevIds => {
			const newIds = prevIds.includes(id) 
				? prevIds.filter(itemId => itemId !== id)
				: [...prevIds, id];
			setFavorites('favoriteScenarioIds', newIds);
			return newIds;
		});
	}, []);

  // --- 1. useEffect: Проверка токена при запуске ---
  useEffect(() => {
    const checkToken = async () => {
      console.log('[App] Starting token check...');
      setAppState(AppState.LOADING);
      
      // Используем IPC для безопасного извлечения токена
      const storedToken = await yandexApi.getSecureToken(); 
      console.log('[App] Token retrieved:', !!storedToken);
      
      // Загружаем состояние автозапуска
      try {
        const autostartEnabled = await yandexApi.isAutostartEnabled();
        setIsAutostartEnabled(autostartEnabled);
      } catch (error) {
        console.error('Ошибка при загрузке состояния автозапуска:', error);
      }

      // Проверяем наличие обновлений при запуске приложения (асинхронно, не блокируем)
      checkForUpdates().then(newUpdateInfo => {
        if (newUpdateInfo) {
          console.log('[App] Update available:', newUpdateInfo.latestVersion);
          setUpdateInfo(newUpdateInfo);
          setShowUpdateNotification(true);
        }
      }).catch(error => {
        console.error('Ошибка при проверке обновлений:', error);
      });
      
      if (storedToken) {
        console.log('[App] Token found, loading user data...');
        setToken(storedToken);
        try {
          const data = await fetchUserInfo(storedToken);
          console.log('[App] User data loaded successfully');
          const sortedData = stableSortData(data);
          setUserData(sortedData);
          const households = sortedData.households || [];
          setActiveHouseholdId(prev => {
            if (prev && households.some(h => h.id === prev)) {
              return prev;
            }
            return households.length > 0 ? households[0].id : null;
          });
          console.log('[App] Setting state to DASHBOARD');
          setAppState(AppState.DASHBOARD);
        } catch (err) {
          console.error('[App] Error loading user data:', err);
          if (err instanceof Error) {
            setErrorMsg(err.message);
          } else {
            setErrorMsg('Ошибка при загрузке данных');
          }
          // Если ошибка авторизации, очищаем невалидный токен
          if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
            await yandexApi.deleteSecureToken();
            setToken(null);
          }
          console.log('[App] Setting state to AUTH due to error');
          setAppState(AppState.AUTH);
        }
      } else {
        console.log('[App] No token found, setting state to AUTH');
        setAppState(AppState.AUTH);
      }
    };
    
    checkToken();
  }, []); // Пустой массив зависимостей - запускаем только один раз при монтировании

	// --- 1.1 useEffect: Слушаем события повторных попыток подключения ---
	useEffect(() => {
		// Регистрируем слушатель для событий повторных попыток
		if (!window.api?.onRetryAttempt) {
			return;
		}

		const unsubscribe = window.api.onRetryAttempt((data: {attempt: number, maxAttempts: number, message: string}) => {
			setRetryInfo(data);
		});

		// Очистка слушателя при размонтировании компонента
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, []);

  // Обработчик переключения автозапуска
	// Create a mutable ref for the current autostart state to avoid stale closure issues
	const autostartStateRef = useRef(isAutostartEnabled);
	useEffect(() => {
		autostartStateRef.current = isAutostartEnabled;
	}, [isAutostartEnabled]);

	const handleToggleAutostart = useCallback(async () => {
		try {
			// Use the ref to get the current state, avoiding stale closure issues
			const newState = !autostartStateRef.current;
			await yandexApi.setAutostartEnabled(newState);
			setIsAutostartEnabled(newState);
			showNotification(
				newState 
					? 'Автозапуск включен. Приложение будет запускаться вместе с системой.' 
					: 'Автозапуск выключен. Приложение будет запускаться только вручную.',
				'success'
			);
		} catch (error) {
			console.error('Ошибка при изменении автозапуска:', error);
			showNotification('Не удалось изменить настройки автозапуска', 'error');
		}
	}, [showNotification]);

  
// --- 2. Вспомогательная функция для подготовки данных для трея ---
const getTrayMenuItems = useCallback((
    data: YandexUserInfoResponse | null,
    favDevices: string[],
    favScenarios: string[]
): TrayMenuItem[] => {
    if (!data) return [];

    const deviceMap = new Map(data.devices.map(d => [d.id, d]));
    const scenarioMap = new Map(data.scenarios.map(s => [s.id, s]));
    
    // 1. Избранные устройства
    const favDeviceItems: TrayMenuItem[] = favDevices
        .map(id => deviceMap.get(id))
        .filter((d): d is YandexDevice => !!d) 
        .map(device => {
            const onOffCapability = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
            const isToggleable = !!onOffCapability;
            
            // Check if this is a sensor, smart meter, air conditioner, or kettle device
            // These devices have temperature/humidity properties to display
            const deviceType = device.type.toLowerCase();
            const isSensorOrMeter = deviceType.includes('sensor') || deviceType.includes('smart_meter');
            const isClimateDevice = deviceType.includes('thermostat') || deviceType.includes('kettle');
            
            // Calculate sensor value for devices that have temperature/humidity properties
            let sensorValue: string | null = null;
            if ((isSensorOrMeter && !isToggleable) || isClimateDevice) {
                sensorValue = formatSensorValueForTray(device);
            }
            
            return {
                id: device.id,
                name: device.name,
                type: 'device' as TrayItemType,
                isToggleable: isToggleable,
                isOn: onOffCapability?.state?.value === true,
                sensorValue: sensorValue,
            };
        });

    // 2. Избранные сценарии
    const favScenarioItems: TrayMenuItem[] = favScenarios
        .map(id => scenarioMap.get(id))
        .filter((s): s is YandexScenario => !!s)
        .map(scenario => ({
            id: scenario.id,
            name: scenario.name,
            type: 'scenario' as TrayItemType,
        }));
        
    return [...favDeviceItems, ...favScenarioItems];
}, []);

// --- 3. useEffect: Отправка данных избранного в главный процесс (для меню трея) ---
useEffect(() => {
    if (appState === AppState.DASHBOARD && userData) {
        const trayItems = getTrayMenuItems(userData, favoriteDeviceIds, favoriteScenarioIds);
        // Отправляем данные в главный процесс для обновления меню трея
        yandexApi.sendFavoritesToTray(trayItems);
    }
}, [appState, userData, favoriteDeviceIds, favoriteScenarioIds, getTrayMenuItems]);


// --- 4. useEffect: Обработка команд из трея ---
useEffect(() => {
    // Вспомогательная функция для выполнения команды переключения устройства
    const handleDeviceToggleCommand = async (deviceId: string, currentState: boolean) => {
        // Используем основной обработчик, который содержит логику API-запроса,
		// оптимистичного обновления и полного обновления данных.
        if (token) {
            try {
                await handleToggleDevice(deviceId, currentState); 
            } catch (error) {
                // Ошибка уже обработана внутри handleToggleDevice
            }
        }
    };
    
    // Вспомогательная функция для выполнения команды запуска сценария
    const handleScenarioExecuteCommand = async (scenarioId: string) => {
        // Используем основной обработчик
        if (token) {
            try {
                await handleExecuteScenario(scenarioId);
            } catch (error) {
                // Ошибка уже обработана внутри handleExecuteScenario
            }
        }
    };

    // Слушаем команду от главного процесса
    yandexApi.onTrayCommand((command: string, id: string, currentState: boolean | undefined) => {
        if (command === 'TOGGLE_DEVICE' && typeof currentState === 'boolean') {
            handleDeviceToggleCommand(id, currentState);
        } else if (command === 'EXECUTE_SCENARIO') {
            handleScenarioExecuteCommand(id);
        }
    });

    // Функция очистки (важно для удаления слушателя при демонтировании компонента)
    return () => {
        yandexApi.removeTrayCommandListener();
    };
	}, [handleToggleDevice, handleExecuteScenario, token]);  // Зависимости корректны

	// --- 5. useEffect: Автоматическая синхронизация (polling) ---
	useEffect(() => {
		// Polling только когда пользователь на дашборде и есть токен
		if (appState !== AppState.DASHBOARD || !token) {
			return;
		}

		// Интервал синхронизации: 120 секунд
		const POLLING_INTERVAL = 120000; // 120 секунд

		const pollingInterval = setInterval(() => {
			// Тихая синхронизация без уведомлений и индикатора загрузки
			refreshDashboardData(token, true).catch(err => {
				console.error('Polling sync error:', err);
			});
		}, POLLING_INTERVAL);

		// Очистка интервала при размонтировании или изменении зависимостей
		return () => {
			clearInterval(pollingInterval);
		};
	}, [appState, token, refreshDashboardData]);

  // Global Notification Toast Component
  const NotificationToast = () => {
      if (!notification) return null;
      return (
          <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 border ${notification.type === 'error' ? 'bg-red-100 dark:bg-red-900/90 border-red-300 dark:border-red-500/30 text-red-900 dark:text-white' : 'bg-green-100 dark:bg-green-900/90 border-green-300 dark:border-green-500/30 text-green-900 dark:text-white'}`}>
              {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />} 
              <span className="text-sm font-medium">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100">
                  <X className="w-4 h-4"/>
              </button>
          </div>
      );
  };

  // --- Рендеринг в зависимости от состояния приложения ---

  // Экран загрузки
  if (appState === AppState.LOADING) {    console.log('[App] Rendering LOADING screen');    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="flex flex-col items-center gap-6">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-600 dark:text-slate-400 animate-pulse">
              {retryInfo ? retryInfo.message : 'Загрузка данных...'}
            </p>
            {retryInfo && (
              <>
                <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                  Нет соединения. Приложение пытается подключиться...<br/>
                  Попытка {retryInfo.attempt} из {retryInfo.maxAttempts}
                </p>
                <button
                  onClick={handleCancelRetry}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Отменить
                </button>
              </>
            )}
          </div>
          <NotificationToast />
        </div>
      </ThemeProvider>
    );
  }

  // Основная панель
  if (appState === AppState.DASHBOARD && userData) {
    return (
      <ThemeProvider>
        <Dashboard 
          data={userData} 
          households={userData.households as YandexHousehold[]}
          activeHouseholdId={activeHouseholdId}
          onSwitchHousehold={handleSwitchHousehold}
          onLogout={handleLogout} 
          onExecuteScenario={handleExecuteScenario} 
          onToggleDevice={handleToggleDevice}
          onToggleGroup={handleToggleGroup}
          onSetDeviceMode={handleSetDeviceMode}
		      onRefresh={() => token && refreshDashboardData(token)}
          isRefreshing={isRefreshing}
		      favoriteDeviceIds={favoriteDeviceIds}
          onToggleDeviceFavorite={handleToggleDeviceFavorite}
          favoriteScenarioIds={favoriteScenarioIds}
          onToggleScenarioFavorite={handleToggleScenarioFavorite}
          isAutostartEnabled={isAutostartEnabled}
          onToggleAutostart={handleToggleAutostart}
        />
        {updateInfo && (
          <UpdateNotificationModal
            isOpen={showUpdateNotification}
            onClose={() => setShowUpdateNotification(false)}
            currentVersion={packageJson.version}
            latestVersion={updateInfo.latestVersion}
            releaseUrl={updateInfo.releaseUrl}
            releaseDate={updateInfo.releaseDate}
          />
        )}
        <NotificationToast />
      </ThemeProvider>
    );
  }

  // Экран авторизации (по умолчанию)
  return (
    <ThemeProvider>
        <TokenInput 
        onTokenSubmit={handleTokenSubmit} 
        isLoading={false}
        error={errorMsg}
        />
        <NotificationToast />
    </ThemeProvider>
  );
}

export default App;