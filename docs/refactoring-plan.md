# План рефакторинга Yandex Smart Home Control

> **Версия документа:** 1.0  
> **Дата:** 29 июня 2026 г.  
> **Версия приложения (текущая):** 1.8.1-beta  
> **Целевая версия после рефакторинга:** 2.0.0  
> **Назначение:** Пошаговый план рефакторинга: выделение хуков, контекстов, устранение дублирования, удаление dead code
> **Аудитория:** Разработчики, ревьюеры

---

## Содержание

- [1. Приоритеты рефакторинга](#1-приоритеты-рефакторинга-по-степени-критичности)
- [2. План рефакторинга GOD-компонентов](#2-план-рефакторинга-god-компонентов)
- [3. План устранения дублирования](#3-план-устранения-дублирования)
- [4. План удаления Dead Code](#4-план-удаления-dead-code)
- [5. Рефакторинг constants.tsx](#5-рефакторинг-constantstsx)
- [6. План рефакторинга Dashboard.tsx](#6-план-рефакторинга-dashboardtsx)
- [7. Полный пошаговый план для разработчика](#7-полный-пошаговый-план-для-разработчика)
- [8. Оценка сложности шагов](#8-оценка-сложности-шагов)
- [9. Риски и сложности](#9-риски-и-сложности)
- [10. Критерии завершения рефакторинга](#10-критерии-завершения-рефакторинга)
- [Связанные документы](#связанные-документы)

---

## 1. Приоритеты рефакторинга (по степени критичности)

```
Приоритет 1: 🔴 КРИТИЧЕСКИЙ
  ├── Выделение кастомных хуков из App.tsx (снижение с 893 → ~200 строк)
  ├── Выделение DashboardContext (устранение prop drilling)
  └── Выделение хуков из Dashboard.tsx

Приоритет 2: 🟡 ВАЖНЫЙ
  ├── Удаление dead code (injectComprehensiveMockDevices, hasVideoStreamCapability)
  ├── Устранение дублирования (buildLightActions, утилиты)
  ├── Рефакторинг constants.tsx → модули
  └── Вынос NotificationToast

Приоритет 3: 🟢 УЛУЧШЕНИЯ
  ├── Оптимизация мемоизации в GroupCard.tsx
  ├── Вынос render-функций Dashboard в компоненты
  └── Декомпозиция Sidebar
```

## 2. План рефакторинга GOD-компонентов

### 2.1. Выделение кастомных хуков из App.tsx

```
Текущее состояние:          Целевое состояние:

App.tsx (893 строки)        App.tsx (~200 строк)
├── 18 useState              ├── useAuth()
├── 23 useCallback           ├── useYandexData()
├── 5 useEffect              ├── useFavorites()
├── 3 useRef                 ├── useDeviceActions()
└── вся логика               ├── useNavigation()
                             ├── useHousehold()
                             ├── useCameraAuth()
                             └── useNotification()
```

#### Шаг 1: `src/hooks/useAuth.ts`

**Ответственность:** управление токеном, состоянием приложения, вход/выход.

| Элемент             | Перенос из App.tsx       |
|---------------------|--------------------------|
| `token`             | `useState`               |
| `appState`          | `useState`               |
| `errorMsg`          | `useState`               |
| `retryInfo`         | `useState`               |
| `loadData()`        | `useCallback`            |
| `handleLogout()`    | callback                 |
| `getFavorites`      | утилита (вынести)        |

**Интерфейс:**
```typescript
interface UseAuthReturn {
    token: string | null;
    appState: AppState;
    errorMsg: string | undefined;
    retryInfo: RetryInfo | null;
    loadData: (apiToken: string) => Promise<void>;
    handleLogout: () => Promise<void>;
}
```

**Сложность:** ⭐⭐ (средняя)

#### Шаг 2: `src/hooks/useYandexData.ts`

**Ответственность:** загрузка и обновление данных Yandex API.

| Элемент                  | Перенос из App.tsx        |
|--------------------------|---------------------------|
| `userData`               | `useState`                |
| `isRefreshing`           | `useState`                |
| `refreshDashboardData()` | `useCallback`             |
| `stableSortData()`       | `useCallback`             |
| `hasDeviceStateChanges()`| `useCallback`             |
| `setUserData`            | для оптимистичных обновлений |

**Интерфейс:**
```typescript
interface UseYandexDataReturn {
    userData: YandexUserInfoResponse | null;
    isRefreshing: boolean;
    refreshDashboardData: (apiToken: string, silent?: boolean) => Promise<void>;
    userDataRef: React.MutableRefObject<YandexUserInfoResponse | null>;
    setUserData: React.Dispatch<YandexUserInfoResponse | null>;
    stableSortData: (data: YandexUserInfoResponse) => YandexUserInfoResponse;
}
```

**Сложность:** ⭐⭐ (средняя)

#### Шаг 3: `src/hooks/useFavorites.ts`

**Ответственность:** избранное (устройства, сценарии, группы).

| Элемент                | Перенос из App.tsx               |
|------------------------|-----------------------------------|
| `favoriteDeviceIds`    | `useState` + localStorage         |
| `favoriteScenarioIds`  | `useState` + localStorage         |
| `favoriteGroupIds`     | `useState` + localStorage         |
| `handleToggleDeviceFavorite` | `useCallback`              |
| `handleToggleScenarioFavorite` | `useCallback`            |
| `handleToggleGroupFavorite`   | `useCallback`              |

**Ключевое улучшение:** устранить 3 идентичных колбэка, заменив на один параметризованный.

```typescript
interface UseFavoritesReturn {
    favoriteDeviceIds: string[];
    favoriteScenarioIds: string[];
    favoriteGroupIds: string[];
    toggleFavorite: (type: 'device' | 'scenario' | 'group', id: string) => void;
    isFavorite: (type: 'device' | 'scenario' | 'group', id: string) => boolean;
}
```

**Сложность:** ⭐ (низкая)

#### Шаг 4: `src/hooks/useDeviceActions.ts`

**Ответственность:** все операции с устройствами/группами/сценариями.

| Элемент                           | Перенос из App.tsx |
|-----------------------------------|--------------------|
| `handleToggleDevice`              | `useCallback`      |
| `handleToggleGroup`               | `useCallback`      |
| `handleExecuteScenario`           | `useCallback`      |
| `handleSetDeviceMode`             | `useCallback`      |
| `handleGetCameraStream`           | `useCallback`      |
| `handleSetCameraPrivacy`          | `useCallback`      |

**Интерфейс:**
```typescript
interface UseDeviceActionsReturn {
    handleToggleDevice: (deviceId: string, currentState: boolean) => Promise<void>;
    handleToggleGroup: (groupId: string, currentState: boolean) => Promise<void>;
    handleExecuteScenario: (scenarioId: string) => Promise<void>;
    handleSetDeviceMode: (deviceId: string, actions: ModeAction[], turnOn?: boolean) => Promise<void>;
    handleGetCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    handleSetCameraPrivacy: (deviceId: string, enabled: boolean, instance?: string) => Promise<void>;
}
```

**Зависимости:** `token`, `userData`, `showNotification`.

**Сложность:** ⭐⭐⭐ (средняя-высокая)

#### Шаг 5: `src/hooks/useNavigation.ts`

**Ответственность:** навигация (sidebar view, активная комната/группа).

| Элемент               | Перенос из App.tsx  |
|-----------------------|---------------------|
| `activeSidebarView`   | `useState`          |
| `activeRoomId`        | `useState`          |
| `activeGroupId`       | `useState`          |
| `handleSelectHome`    | `useCallback`       |
| `handleSelectRoom`    | `useCallback`       |
| `handleSelectGroup`   | `useCallback`       |

**Сложность:** ⭐ (низкая)

#### Шаг 6: `src/hooks/useHousehold.ts`

**Ответственность:** управление активным домом (round-robin).

| Элемент               | Перенос из App.tsx        |
|-----------------------|---------------------------|
| `activeHouseholdId`   | `useState`                |
| `handleSwitchHousehold` | `useCallback`           |

**Сложность:** ⭐ (низкая)

#### Шаг 7: `src/hooks/useCameraAuth.ts`

**Ответственность:** QR-авторизация для камер (X-Token).

| Элемент                  | Перенос из App.tsx  |
|--------------------------|---------------------|
| `showQrAuth`             | `useState`          |
| `qrAuthPromiseRef`       | `useRef`            |
| `promptXTokenIfNeeded()` | `useCallback`       |
| `requestXTokenAuth()`    | `useCallback`       |
| `handleQrAuthSuccess()`  | `useCallback`       |
| `handleQrAuthClose()`    | `useCallback`       |

**Сложность:** ⭐⭐ (средняя)

#### Шаг 8: `src/hooks/useNotification.ts`

**Ответственность:** всплывающие уведомления.

| Элемент               | Перенос из App.tsx  |
|-----------------------|---------------------|
| `notification`        | `useState`          |
| `showNotification()`  | `useCallback`       |
| `NotificationToast`   | JSX (вынести)       |

**Сложность:** ⭐ (низкая)

### 2.2. Создание контекстов для устранения Prop Drilling

#### Шаг 9: `src/contexts/DashboardContext.tsx`

**Проблема:** 30 пропсов у Dashboard, 23 у Sidebar, глубокий prop drilling.

**Решение:** Контекст, объединяющий данные, действия и навигацию.

```typescript
interface DashboardContextValue {
    // Данные
    data: YandexUserInfoResponse;
    households: YandexHousehold[];
    activeHouseholdId: string | null;
    
    // Избранное
    favoriteDeviceIds: string[];
    favoriteScenarioIds: string[];
    favoriteGroupIds: string[];
    isFavorite: (type: 'device' | 'scenario' | 'group', id: string) => boolean;
    toggleFavorite: (type: 'device' | 'scenario' | 'group', id: string) => void;
    
    // Действия
    onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
    onToggleGroup: (id: string, currentState: boolean) => Promise<void>;
    onExecuteScenario: (id: string) => Promise<void>;
    onSetDeviceMode: (deviceId: string, actions: ModeAction[], turnOn?: boolean) => Promise<void>;
    onGetCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    onSetCameraPrivacy: (deviceId: string, enabled: boolean, instance?: string) => Promise<void>;
    onRefresh: () => void;
    
    // Навигация
    activeSidebarView: 'home' | 'room' | 'group';
    activeRoomId: string | null;
    activeGroupId: string | null;
    onSelectHome: () => void;
    onSelectRoom: (roomId: string) => void;
    onSelectGroup: (groupId: string) => void;
    
    // UI-состояния
    isRefreshing: boolean;
    isAutostartEnabled: boolean;
    onToggleAutostart: () => void;
    onSwitchHousehold: () => void;
    onLogout: () => void;
}
```

**Провайдер:** оборачивает `Dashboard` и всё поддерево, берёт значения из хуков.

**Сложность:** ⭐⭐⭐ (высокая, требуется аккуратность с ре-рендерами)

#### Шаг 10: Выделение render-функций Dashboard в компоненты

Dashboard содержит три больших render-функции:
- `renderHomeView()` — ~200 строк
- `renderRoomView()` — ~150 строк  
- `renderGroupView()` — ~100 строк

**План:**
1. Создать `src/components/DashboardHomeView.tsx`
2. Создать `src/components/DashboardRoomView.tsx`
3. Создать `src/components/DashboardGroupView.tsx`

Каждый компонент использует `DashboardContext` для получения данных.

**Сложность:** ⭐ (низкая)

### 2.3. Целевая структура App.tsx после рефакторинга

```typescript
function App() {
    const { token, appState, errorMsg, loadData, handleLogout } = useAuth();
    const { userData, isRefreshing, refreshDashboardData, setUserData, stableSortData } = useYandexData();
    const { favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds, toggleFavorite } = useFavorites();
    const { handleToggleDevice, handleToggleGroup, handleExecuteScenario, handleSetDeviceMode,
            handleGetCameraStream, handleSetCameraPrivacy } = useDeviceActions();
    const { activeSidebarView, activeRoomId, activeGroupId, handleSelectHome, handleSelectRoom, handleSelectGroup } = useNavigation();
    const { activeHouseholdId, handleSwitchHousehold } = useHousehold();
    const { showQrAuth, promptXTokenIfNeeded, handleQrAuthSuccess, handleQrAuthClose } = useCameraAuth();
    const { notification, showNotification, NotificationToast } = useNotification();

    const [isAutostartEnabled, setIsAutostartEnabled] = useState(false);
    const [showUpdateNotification, setShowUpdateNotification] = useState(false);
    const [updateInfo, setUpdateInfo] = useState(null);

    useEffect(() => { /* init: проверка токена, автозагрузка, polling, обновления */ }, []);

    return (
        <ThemeProvider>
            {appState === AppState.LOADING && <LoadingScreen />}
            {appState === AppState.AUTH && (
                <TokenInput onTokenSubmit={loadData} errorMsg={errorMsg} onRetry={handleRetry} retryInfo={retryInfo} />
            )}
            {appState === AppState.DASHBOARD && userData && (
                <DashboardContext.Provider value={{ /* значения из хуков */ }}>
                    <Dashboard />
                </DashboardContext.Provider>
            )}
            {showQrAuth && <QrAuthModal onSuccess={handleQrAuthSuccess} onClose={handleQrAuthClose} />}
            {showUpdateNotification && updateInfo && (
                <UpdateNotificationModal updateInfo={updateInfo} onClose={() => setShowUpdateNotification(false)} />
            )}
            <NotificationToast />
        </ThemeProvider>
    );
}
```

**Цель:** ~200 строк, 5-7 useState, 3 useEffect, без useCallback (всё в хуках).

## 3. План устранения дублирования

### 3.1. Шаг 11: Утилита `buildLightActions`

**Проблема:** дублирование построения массива `modeActions` в `handleApplyLightBrightness` и `handleApplyGroupLightBrightness`.

**Решение:** создать функцию в `src/utils/deviceActions.ts`:

```typescript
interface LightSettings {
    brightness?: number;
    temperature?: number;
    color?: { r: number; g: number; b: number };
}

export function buildLightActions(settings: LightSettings): YandexModeAction[] {
    const actions: YandexModeAction[] = [];
    if (settings.brightness !== undefined) {
        actions.push({ instance: 'brightness', value: settings.brightness });
    }
    if (settings.temperature !== undefined) {
        actions.push({ instance: 'temperature', value: settings.temperature });
    }
    if (settings.color) {
        const hsv = rgbToHsv(settings.color.r, settings.color.g, settings.color.b);
        actions.push({ instance: 'color', value: { h: hsv[0], s: hsv[1], v: hsv[2] } });
    }
    return actions;
}
```

**Сложность:** ⭐ (низкая)

### 3.2. Шаг 12: Хук `useDeviceDisplayProps`

**Проблема:** проверки типов устройств (`isLightGroup`, `isThermostat`, `isFan`, `isCameraDevice`) дублируются в 3+ компонентах. Парсинг сенсорных свойств — в 3 копиях.

**Решение:** единый хук для получения display-свойств устройства.

```typescript
interface DeviceDisplayProps {
    icon: React.ReactNode;
    isToggleable: boolean;
    isOn: boolean;
    isAlwaysOn: boolean;
    sensorValue: string | null;
    deviceType: 'light' | 'thermostat' | 'fan' | 'camera' | 'sensor' | 'other';
}

function useDeviceDisplayProps(device: YandexDevice): DeviceDisplayProps {
    const icon = getIconForDevice(device.type);
    const onOffCapability = findCapabilityByInstance(device, 'on_off');
    const isToggleable = !!onOffCapability;
    const isOn = onOffCapability?.state?.value === true;
    const isAlwaysOn = !isToggleable && isAlwaysOnDevice(device);
    const sensorValue = formatSensorValue(device);
    const deviceType = classifyDeviceType(device);
    
    return { icon, isToggleable, isOn, isAlwaysOn, sensorValue, deviceType };
}
```

**Сложность:** ⭐⭐ (средняя)

### 3.3. Шаг 13: Устранение дублирования loadData/useEffect

**Проблема:** ~30 строк в `loadData()` идентичны коду в первом `useEffect`.

**Решение:** вынести общую логику в `useYandexData` и использовать `loadData` как в эффекте инициализации, так и при повторной авторизации.

**Сложность:** ⭐ (низкая)

## 4. План удаления Dead Code

### 4.1. Шаг 14: Вынос/удаление `injectComprehensiveMockDevices`

| Действие              | Описание                                        |
|-----------------------|-------------------------------------------------|
| 1. Анализ             | Проверить, не используется ли функция где-либо  |
| 2. Перемещение        | Вынести в отдельный файл `src/services/mockDevices.ts` |
| 3. Git-игнор или удаление | Если mock не нужен — удалить полностью     |
| 4. Сокращение `yandexIoT.ts` | После выноса файл уменьшится с 741 → ~168 строк |

**Сложность:** ⭐ (низкая)

### 4.2. Шаг 15: Удаление `hasVideoStreamCapability`

- Проверить через поиск, что функция не используется
- Удалить из `constants.tsx`
- **Сложность:** ⭐ (низкая)

### 4.3. Шаг 16: Вынос `NotificationToast`

```typescript
// src/components/NotificationToast.tsx
interface NotificationToastProps {
    message: string | null;
    type: 'error' | 'success';
    onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = React.memo(({ message, type, onClose }) => {
    if (!message) return null;
    return (
        <div className={`notification ${type}`}>
            {type === 'error' ? <AlertCircle /> : <CheckCircle />}
            <span>{message}</span>
            <button onClick={onClose}><X /></button>
        </div>
    );
});
```

**Сложность:** ⭐ (низкая)

## 5. Рефакторинг constants.tsx

### 5.1. Шаг 17: Разделение на модули

```
src/constants.tsx (413 строк)           Целевая структура:
                                           │
├── SCENARIO_ICON_MAP                    src/constants/
├── getIconForScenario                   ├── icons.ts — иконки, getIconForScenario, getIconForDevice
├── getIconForDevice                     ├── deviceTypes.ts — isLightDevice, isLightGroup, isThermostatLike,
├── isLightDevice                              isCameraDevice, isAlwaysOnDevice, isFanDevice, classifyDeviceType
├── isLightGroup                        ├── formatting.ts — localizeUnit, formatSensorValue,
├── isThermostatLike                          formatSensorValueForTray
├── isCameraDevice                       └── parsing.ts — getCapabilityInstance, getPropertyValue,
├── isAlwaysOnDevice                           getPropertyInstanceValue, findCapabilityByInstance
├── isFanDevice
├── localizeUnit
├── formatSensorValue
├── formatSensorValueForTray             export * from './icons';
├── hasVideoStreamCapability (dead)      export * from './deviceTypes';
├── getCapabilityInstance                export * from './formatting';
├── getPropertyValue                     export * from './parsing';
└── getPropertyInstanceValue
```

**Сложность:** ⭐ (низкая)

## 6. План рефакторинга Dashboard.tsx

### 6.1. Шаг 18: Выделение `src/hooks/useDashboardState.ts`

**Ответственность:** все 17 useState из Dashboard, управление модалками, collapse, edit mode.

```typescript
interface UseDashboardStateReturn {
    // Модалки
    showConfirmModal: boolean;
    setShowConfirmModal: Dispatch<boolean>;
    showInfoModal: boolean;
    setShowInfoModal: Dispatch<boolean>;
    selectedThermostatDevice: YandexDevice | null;
    openThermostatSettings: (device: YandexDevice) => void;
    closeThermostatSettings: () => void;
    // ... для всех 7 модалок
    
    // Collapse
    collapsedRooms: Set<string>;
    collapsedGroups: Set<string>;
    toggleRoomCollapse: (roomId: string) => void;
    toggleGroupCollapse: (groupId: string) => void;
    
    // Edit mode
    isEditMode: boolean;
    toggleEditMode: () => void;
    
    // Hidden items
    hiddenDeviceIds: Set<number>;
    hiddenScenarioIds: Set<number>;
    hiddenGroupIds: Set<number>;
    toggleCardVisibility: (type: string, id: number) => void;
}
```

**Сложность:** ⭐⭐⭐ (высокая — из-за объёма, но технически простая)

### 6.2. Шаг 19: Вынос хендлеров модалок

После создания `useDashboardState`, вынести хендлеры применения настроек:
- `handleApplyThermostatSettings`
- `handleApplyLightBrightness`
- `handleApplyGroupLightBrightness`
- `handleApplyGroupThermostatSettings`
- `handleApplyFanSettings`
- `handleApplyGroupFanSettings`

Объединить общие части через `buildLightActions`.

**Сложность:** ⭐⭐ (средняя)

## 7. Полный пошаговый план для разработчика

### Фаза 1: Подготовка (создание структуры)

```
Шаг 1: Создать папку src/hooks/
Шаг 2: Создать папку src/constants/
Шаг 3: Создать папку src/utils/
```

### Фаза 2: Декомпозиция constants.tsx

```
Шаг 4:  Создать src/constants/icons.ts         — SCENARIO_ICON_MAP, getIconForScenario, getIconForDevice
Шаг 5:  Создать src/constants/deviceTypes.ts    — isLightDevice, isLightGroup, isThermostatLike,
                                                   isCameraDevice, isAlwaysOnDevice, isFanDevice,
                                                   classifyDeviceType (новая)
Шаг 6:  Создать src/constants/formatting.ts     — localizeUnit, formatSensorValue, formatSensorValueForTray
Шаг 7:  Создать src/constants/parsing.ts        — getCapabilityInstance, getPropertyValue,
                                                   getPropertyInstanceValue, findCapabilityByInstance (новая)
Шаг 8:  Создать src/constants/index.ts          — re-export всего из подмодулей
Шаг 9:  Заменить импорты в компонентах          — с constants.tsx → constants/index.ts
Шаг 10: Удалить hasVideoStreamCapability         — dead code, не используется
Шаг 11: Удалить src/constants.tsx                — старый файл больше не нужен
```

### Фаза 3: Dead Code

```
Шаг 12: Создать src/services/mockDevices.ts     — перенести injectComprehensiveMockDevices
Шаг 13: Сократить src/services/yandexIoT.ts     — удалить мок-функцию (168 строк вместо 741)
Шаг 14: Создать src/components/NotificationToast.tsx — вынести из App.tsx
```

### Фаза 4: Кастомные хуки (декомпозиция App.tsx)

```
Шаг 15: Создать src/hooks/useNotification.ts
Шаг 16: Создать src/hooks/useAuth.ts
Шаг 17: Создать src/hooks/useFavorites.ts       — с единым toggleFavorite
Шаг 18: Создать src/hooks/useNavigation.ts
Шаг 19: Создать src/hooks/useHousehold.ts
Шаг 20: Создать src/hooks/useCameraAuth.ts
Шаг 21: Создать src/hooks/useYandexData.ts
Шаг 22: Создать src/hooks/useDeviceActions.ts
Шаг 23: Создать src/hooks/index.ts              — re-export всех хуков
Шаг 24: Рефакторинг App.tsx                     — заменить логику на хуки (~200 строк)
Шаг 25: Удалить дублирование loadData/useEffect  — через useYandexData
```

### Фаза 5: DashboardContext

```
Шаг 26: Создать src/contexts/DashboardContext.tsx
Шаг 27: Интегрировать DashboardContext в App.tsx
Шаг 28: Создать src/hooks/useDashboardState.ts  — состояние Dashboard
Шаг 29: Создать src/components/DashboardHomeView.tsx
Шаг 30: Создать src/components/DashboardRoomView.tsx
Шаг 31: Создать src/components/DashboardGroupView.tsx
Шаг 32: Рефакторинг Dashboard.tsx               — заменить render-функции на компоненты (~300 строк)
```

### Фаза 6: Устранение дублирования

```
Шаг 33: Создать src/utils/deviceActions.ts      — buildLightActions
Шаг 34: Создать src/hooks/useDeviceDisplayProps.ts — единый хук для display-пропсов
Шаг 35: Заменить дублированные проверки в Dashboard, DeviceCard, GroupCard на useDeviceDisplayProps
Шаг 36: Заменить дублирование handleApply* на buildLightActions
```

### Фаза 7: Оптимизация

```
Шаг 37: Уменьшить useMemo в GroupCard.tsx        — с 7 до 2 (только тяжёлые фильтрации)
Шаг 38: Уменьшить пропсы Sidebar                — через DashboardContext
Шаг 39: Проверить re-renders                    — использование React.memo где необходимо
```

### Фаза 8: Тестирование и сборка

```
Шаг 40: npm run build                           — проверка сборки
Шаг 41: npm run dev + electron-dev               — ручное тестирование
Шаг 42: Проверка: авторизация, список, toggle, избранное, модалки, тема, трей
```

## 8. Оценка сложности шагов

```
Шаги                Сложность  Файлы  Риск регрессии
─────────────────────────────────────────────────────
Фаза 2 (константы)  ⭐         ~6     Низкий (только импорты)
Фаза 3 (dead code)  ⭐         ~3     Низкий (удаление/перенос)
Фаза 4 (хуки)       ⭐⭐       ~11    Средний (бизнес-логика)
Фаза 5 (контекст)   ⭐⭐⭐      ~6     Высокий (изменение архитектуры)
Фаза 6 (дублир-е)   ⭐⭐       ~3     Средний
Фаза 7 (оптимиз-я)  ⭐         ~3     Низкий
Фаза 8 (сборка)     ⭐         —      —

Итого:               ~30 шагов  ~32 файла
```

## 9. Риски и сложности

| Риск                              | Вероятность | Влияние | Митигация                                    |
|-----------------------------------|-------------|---------|----------------------------------------------|
| Регрессия после выноса хуков      | Средняя     | Высокое | Пошаговое тестирование после каждого шага     |
| Изменение интерфейсов контекста   | Средняя     | Среднее | TypeScript + явные интерфейсы                 |
| Потеря оптимистичных обновлений   | Низкая      | Высокое | Сохранить логику optimistic update в хуках    |
| Поломка IPC-коммуникации          | Низкая      | Высокое | Не трогаем electron/ файлы                    |
| Регрессия камер (WebRTC)          | Низкая      | Среднее | useCameraAuth выносится целиком               |
| Конфликты при merge               | Средняя     | Среднее | Делать частые коммиты, по одному шагу         |

## 10. Критерии завершения рефакторинга

- [ ] App.tsx ≤ 250 строк
- [ ] Dashboard.tsx ≤ 400 строк
- [ ] constants.tsx удалён, заменён на модули
- [ ] yandexIoT.ts без мок-функции (≤ 200 строк)
- [ ] Все 16 кастомных хуков созданы и работают
- [ ] DashboardContextProvider создан, prop drilling устранён
- [ ] NotificationToast — отдельный компонент
- [ ] `hasVideoStreamCapability` удалена
- [ ] `buildLightActions` используется вместо дублирования
- [ ] `useDeviceDisplayProps` используется вместо 3 копий парсинга
- [ ] `npm run build` успешен
- [ ] Все основные функции работают: авторизация, список устройств, toggle, избранное, модалки, тема, камеры, трей

## Связанные документы

- [`architecture.md`](./architecture.md) — Общая архитектура проекта, стек технологий, контракты между модулями
- [`components-analysis.md`](./components-analysis.md) — Детальный анализ компонентов, метрики, дублирование, dead code
