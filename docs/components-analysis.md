# Анализ компонентов Yandex Smart Home Control

> **Версия документа:** 1.0  
> **Дата:** 29 июня 2026 г.  
> **Назначение:** Детальный анализ каждого компонента React, метрики, выявление дублирования кода, dead code и паттернов prop drilling
> **Аудитория:** Разработчики, ревьюеры

---

## Содержание

- [1. Полный анализ каждого компонента](#1-полный-анализ-каждого-компонента)
  - [1.1. App.tsx](#11-apptsx--корневой-компонент)
  - [1.2. Dashboard.tsx](#12-dashboardtsx--панель-управления)
  - [1.3. Sidebar.tsx](#13-sidebartsx)
  - [1.4. DeviceCard.tsx](#14-devicecardtsx)
  - [1.5. ScenarioCard.tsx](#15-scenariocardtsx)
  - [1.6. GroupCard.tsx](#16-groupcardtsx)
  - [1.7. Модальные окна](#17-модальные-окна-10-файлов)
  - [1.8. constants.tsx](#18-constantstsx)
- [2. Карта дублирования кода](#2-карта-дублирования-кода)
- [3. Инвентаризация Dead Code](#3-инвентаризация-dead-code)
- [4. Паттерн Prop Drilling](#4-паттерн-prop-drilling--диаграмма-передачи-пропсов)
- [5. Избыточная мемоизация](#5-избыточная-мемоизация)
- [6. Обобщающая статистика](#6-обобщающая-статистика)
- [Связанные документы](#связанные-документы)

---

## 1. Полный анализ каждого компонента

### 1.1. App.tsx — Корневой компонент

| МЕТРИКА          | ЗНАЧЕНИЕ      |
|------------------|---------------|
| **Строк**        | 893           |
| **useState**     | 18            |
| **useCallback**  | 23            |
| **useEffect**    | 5             |
| **useRef**       | 3             |
| **Импорты**      | ~40           |

**Ответственность (STARK — Single Responsibility нарушена):**

```
✅ Авторизация (токен, appState, QrAuth)
✅ Загрузка данных (fetchUserInfo, loadData, refreshDashboardData)
✅ Управление избранным (favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds)
✅ Навигация (activeSidebarView, activeRoomId, activeGroupId)
✅ Управление устройствами (toggleDevice, toggleGroup, setDeviceMode)
✅ Управление сценариями (executeScenario)
✅ Работа с камерами (promptXTokenIfNeeded, requestXTokenAuth)
✅ Polling (setInterval для автообновления)
✅ Системный трей (обновление меню трея)
✅ Проверка обновлений (checkForUpdates)
✅ Показ уведомлений (NotificationToast)
```

**Состояния (все 18):**

| №  | Состояние               | Тип                                    | Начальное значение            |
|----|-------------------------|----------------------------------------|-------------------------------|
| 1  | `appState`              | `AppState`                             | `AppState.LOADING`            |
| 2  | `token`                 | `string \| null`                       | `null`                        |
| 3  | `userData`              | `YandexUserInfoResponse \| null`       | `null`                        |
| 4  | `activeHouseholdId`     | `string \| null`                       | `null`                        |
| 5  | `errorMsg`              | `string \| undefined`                  | `undefined`                   |
| 6  | `notification`          | `{message, type} \| null`              | `null`                        |
| 7  | `isRefreshing`          | `boolean`                              | `false`                       |
| 8  | `favoriteDeviceIds`     | `string[]`                             | `getFavorites('...')`         |
| 9  | `favoriteScenarioIds`   | `string[]`                             | `getFavorites('...')`         |
| 10 | `favoriteGroupIds`      | `string[]`                             | `getFavorites('...')`         |
| 11 | `activeSidebarView`     | `'home' \| 'room' \| 'group'`          | `'home'`                      |
| 12 | `activeRoomId`          | `string \| null`                       | `null`                        |
| 13 | `activeGroupId`         | `string \| null`                       | `null`                        |
| 14 | `isAutostartEnabled`    | `boolean`                              | `false`                       |
| 15 | `retryInfo`             | `{attempt, maxAttempts, message} \| null` | `null`                    |
| 16 | `showUpdateNotification`| `boolean`                              | `false`                       |
| 17 | `updateInfo`            | `{latestVersion, ...} \| null`         | `null`                        |
| 18 | `showQrAuth`            | `boolean`                              | `false`                       |

**useRef:**
- `qrAuthPromiseRef` — промис для QR-авторизации
- `userDataRef` — реф для предотвращения пересоздания колбэков
- `intervalRef` — ссылка на setInterval polling

**Вывод: GOD-компонент.** 6 зон ответственности в одном компоненте. Превышение порога в 200 строк в 4.5 раза.

### 1.2. Dashboard.tsx — Панель управления

| МЕТРИКА          | ЗНАЧЕНИЕ      |
|------------------|---------------|
| **Строк**        | 1115          |
| **useState**     | 17            |
| **useCallback**  | 20            |
| **useMemo**      | 8             |
| **useEffect**    | 0             |
| **Пропсы**       | 30            |

**Пропсы (все 30):**

```
data: YandexUserInfoResponse
households: YandexHousehold[]
activeHouseholdId: string | null
onSwitchHousehold: () => void
onLogout: () => void
onExecuteScenario: (id: string) => Promise<void>
onToggleDevice: (id: string, currentState: boolean) => Promise<void>
onToggleGroup: (id: string, currentState: boolean) => Promise<void>
onSetDeviceMode: (deviceId, modeActions, turnOn?) => Promise<void>
onGetCameraStream: (deviceId) => Promise<CameraStreamResult>
onSetCameraPrivacy: (deviceId, privacyEnabled, toggleInstance?) => Promise<void>
onRefresh: () => void
isRefreshing: boolean
favoriteDeviceIds: string[]
onToggleDeviceFavorite: (id: string) => void
favoriteScenarioIds: string[]
onToggleScenarioFavorite: (id: string) => void
favoriteGroupIds: string[]
onToggleGroupFavorite: (id: string) => void
isAutostartEnabled: boolean
onToggleAutostart: () => void
activeSidebarView: 'home' | 'room' | 'group'
activeRoomId: string | null
activeGroupId: string | null
onSelectHome: () => void
onSelectRoom: (roomId: string) => void
onSelectGroup: (groupId: string) => void
```

**Ответственность:**

```
✅ Рендеринг основного содержимого
✅ Состояния 7 модалок (термостат, яркость, вентилятор — для устройств и групп, камера)
✅ Логика collapse-состояний (localStorage)
✅ Режим редактирования (isEditMode)
✅ Фильтрация устройств по комнатам/группам (8 useMemo)
✅ Отображение/скрытие карточек
✅ Рендеринг представлений: home, room, group
```

**useState (все 17):**

| №  | Состояние                     | Тип                          |
|----|-------------------------------|------------------------------|
| 1  | `showConfirmModal`            | `boolean`                    |
| 2  | `showInfoModal`               | `boolean`                    |
| 3  | `selectedThermostatDevice`    | `YandexDevice \| null`      |
| 4  | `selectedLightDevice`         | `YandexDevice \| null`      |
| 5  | `selectedFanDevice`           | `YandexDevice \| null`      |
| 6  | `selectedLightGroup`          | `YandexGroup \| null`       |
| 7  | `selectedThermostatGroup`     | `YandexGroup \| null`       |
| 8  | `selectedFanGroup`            | `YandexGroup \| null`       |
| 9  | `selectedCameraDevice`        | `YandexDevice \| null`      |
| 10 | `isEditMode`                  | `boolean`                    |
| 11 | `collapsedRooms`              | `Set<string>`                |
| 12 | `collapsedGroups`             | `Set<string>`                |
| 13 | `hiddenDeviceIds`             | `Set<number>`                |
| 14 | `hiddenScenarioIds`           | `Set<number>`                |
| 15 | `hiddenGroupIds`              | `Set<number>`                |
| 16 | `hiddenRoomIds`               | `Set<string>`                |
| 17 | `hiddenGroupCardIds`          | `Set<string>`                |

**Вывод: GOD-компонент.** 1115 строк, 30 пропсов, 17 useState, 20 useCallback. Превышение порога в 200 строк в 5.5 раза.

### 1.3. Sidebar.tsx

| МЕТРИКА          | ЗНАЧЕНИЕ      |
|------------------|---------------|
| **Строк**        | 358           |
| **useState**     | 2             |
| **useMemo**      | 2             |
| **useRef**       | 1             |
| **useEffect**    | 0             |
| **Пропсы**       | 23            |

**Примечание:** 23 пропса — это много. Sidebar получает почти всю модель данных, хотя использует только часть. Многие пропсы — для списков избранного, хотя сам Sidebar только отображает звездочки.

### 1.4. DeviceCard.tsx

| МЕТРИКА          | ЗНАЧЕНИЕ      |
|------------------|---------------|
| **Строк**        | 201           |
| **useState**     | 1 (`loading`) |
| **Пропсы**       | 9             |
| **Особенности**  | Содержит свою логику парсинга свойств |

### 1.5. ScenarioCard.tsx

| МЕТРИКА          | ЗНАЧЕНИЕ      |
|------------------|---------------|
| **Строк**        | 77            |
| **useState**     | 0             |
| **Пропсы**       | 3             |
| **Чистота**      | Хороший, простой компонент |

### 1.6. GroupCard.tsx

| МЕТРИКА          | ЗНАЧЕНИЕ      |
|------------------|---------------|
| **Строк**        | 155           |
| **useState**     | 0             |
| **useMemo**      | 7 (избыточно) |
| **Пропсы**       | 7             |

**Примечание:** 7 useMemo на дешёвых операциях (проверка `isLightGroup`, `isThermostat`, `isFan`, фильтрация устройств). Это избыточная мемоизация.

### 1.7. Модальные окна (10 файлов)

| Файл                          | Строк | Пропсы | Ответственность         |
|-------------------------------|-------|--------|-------------------------|
| `BrightnessSettingsModal.tsx` | ~150  | 4      | Настройка яркости света  |
| `CameraStreamModal.tsx`       | ~200  | 5      | Поток с камеры + HLS     |
| `FanSettingsModal.tsx`        | ~120  | 4      | Настройка вентилятора    |
| `GroupFanSettingsModal.tsx`   | ~80   | 5      | Групповой вентилятор     |
| `GroupLightSettingsModal.tsx` | ~150  | 5      | Групповая яркость        |
| `GroupThermostatSettingsModal.tsx` | ~100 | 5    | Групповой термостат      |
| `InfoModal.tsx`               | ~50   | 3      | Инфо о программе         |
| `QrAuthModal.tsx`             | ~80   | 2      | QR-авторизация           |
| `ThermostatSettingsModal.tsx` | ~180  | 4      | Настройка термостата     |
| `UpdateNotificationModal.tsx` | ~60   | 3      | Уведомление об обновлении |

### 1.8. constants.tsx

| МЕТРИКА          | ЗНАЧЕНИЕ      |
|------------------|---------------|
| **Строк**        | 413           |
| **Экспортов**    | ~16           |

**Содержимое (свальник):**

| №  | Экспорт                       | Тип                   | Категория      |
|----|-------------------------------|-----------------------|----------------|
| 1  | `SCENARIO_ICON_MAP`           | `Record<string, ReactNode>` | Константа |
| 2  | `getIconForScenario`          | функция               | JSX-хелпер     |
| 3  | `getIconForDevice`            | функция               | JSX-хелпер     |
| 4  | `isLightDevice`               | функция               | Проверка типа  |
| 5  | `isLightGroup`                | функция               | Проверка типа  |
| 6  | `isThermostatLike`            | функция               | Проверка типа  |
| 7  | `isCameraDevice`              | функция               | Проверка типа  |
| 8  | `isAlwaysOnDevice`            | функция               | Проверка типа  |
| 9  | `isFanDevice`                 | функция               | Проверка типа  |
| 10 | `localizeUnit`                | функция               | Форматирование |
| 11 | `formatSensorValue`           | функция               | Форматирование |
| 12 | `formatSensorValueForTray`    | функция               | Форматирование |
| 13 | `hasVideoStreamCapability`    | функция (dead code)   | —              |
| 14 | `getCapabilityInstance`       | функция               | Парсинг        |
| 15 | `getPropertyValue`            | функция               | Парсинг        |
| 16 | `getPropertyInstanceValue`    | функция               | Парсинг        |

## 2. Карта дублирования кода

### 2.1. Дублирование `loadData` и первого useEffect

**Место 1:** `App.tsx` — функция `loadData` (~30 строк):

```typescript
const loadData = useCallback(async (apiToken: string) => {
    setAppState(AppState.LOADING);
    setErrorMsg(undefined);
    try {
        const data = await fetchUserInfo(apiToken);
        const sortedData = stableSortData(data);
        setUserData(sortedData);
        const households = sortedData.households || [];
        setActiveHouseholdId(prev => {
            if (prev && households.some(h => h.id === prev)) return prev;
            return households.length > 0 ? households[0].id : null;
        });
        setAppState(AppState.DASHBOARD);
        await promptXTokenIfNeeded(sortedData);
    } catch (err) { /* ... */ }
}, [stableSortData, promptXTokenIfNeeded]);
```

**Место 2:** `App.tsx` — первый useEffect (appState === LOADING):

```typescript
useEffect(() => {
    const init = async () => {
        // ... та же логика: fetchUserInfo, stableSortData, setUserData,
        //     setActiveHouseholdId, setAppState, promptXTokenIfNeeded
    };
    init();
}, []);
```

Идентичный код (~30 строк) выполняет одну и ту же задачу — инициализацию данных.

### 2.2. Парсинг свойств устройств (3 копии)

| Функция                           | Где определена         | Что делает                |
|-----------------------------------|------------------------|---------------------------|
| `formatSensorValue`               | `constants.tsx`        | Извлекает и форматирует   |
| `formatSensorValueForTray`        | `constants.tsx`        | То же, для трея           |
| Встроенная логика в DeviceCard    | `DeviceCard.tsx:30-80` | То же, для карточки       |

Три копии одной логики парсинга сенсорных свойств устройств.

### 2.3. `handleApplyLightBrightness` и `handleApplyGroupLightBrightness`

| Функция                           | Где      | Дублирование                        |
|-----------------------------------|----------|-------------------------------------|
| `handleApplyLightBrightness`      | Dashboard | Построение actions для одного устройства |
| `handleApplyGroupLightBrightness` | Dashboard | То же, но для группы устройств      |

Структура построения массива `modeActions` идентична (brightness, temperature, color).

### 2.4. `handleToggleDeviceFavorite`, `handleToggleScenarioFavorite`, `handleToggleGroupFavorite`

```typescript
const handleToggleXFavorite = useCallback((id: string) => {
    setFavoriteXIds(prev => {
        const updated = prev.includes(id)
            ? prev.filter(fid => fid !== id)
            : [...prev, id];
        setFavorites('favoriteXIds', updated);
        return updated;
    });
}, []);
```

Три идентичных по структуре обработчика, отличающихся только названием стейта и ключа localStorage.

### 2.5. Проверки типов устройств

```
isLightGroup(devices)    → Dashboard.tsx, GroupCard.tsx
isThermostat(device)     → Dashboard.tsx, GroupCard.tsx, DeviceCard.tsx
isFan(device)            → Dashboard.tsx, GroupCard.tsx, DeviceCard.tsx
isCameraDevice(device)   → Dashboard.tsx, DeviceCard.tsx, App.tsx
```

Эти проверки размазаны по 3+ компонентам каждый.

## 3. Инвентаризация Dead Code

### 3.1. `injectComprehensiveMockDevices` — 573 строки, 77% файла yandexIoT.ts

- **Файл:** `src/services/yandexIoT.ts`
- **Строки:** 1–573
- **Статус:** не экспортируется, не вызывается нигде
- **Содержимое:** 6 мок-устройств (счётчик воды, лампочка, выключатель и т.д.) с полным набором capabilities и properties
- **Риск:** создаёт иллюзию функциональности, увеличивает бандл (? проверять tree-shaking), затрудняет навигацию по файлу

### 3.2. `hasVideoStreamCapability` — 0 вызовов

- **Файл:** `src/constants.tsx`
- **Статус:** функция определена, но нигде не импортируется и не вызывается

### 3.3. `NotificationToast` — компонент внутри App()

- **Файл:** `src/App.tsx`
- **Проблема:** JSX для уведомления определён прямо внутри `App()`, пересоздаётся при каждом рендере
- **Решение:** вынести в отдельный компонент или мемоизировать

### 3.4. Потенциально мёртвый код

| Функция / Код                      | Файл                     | Статус           |
|------------------------------------|--------------------------|------------------|
| `stableSortData`                   | `App.tsx`                | Используется, но может быть утилитой |
| `hasDeviceStateChanges`            | `App.tsx`                | Используется в одном месте |
| `compareVersions`                  | `App.tsx`                | Используется в `checkForUpdates` |

## 4. Паттерн Prop Drilling — диаграмма передачи пропсов

```
App.tsx
  │
  │  onToggleDevice
  │  onToggleDeviceFavorite
  │  onToggleGroup
  │  onToggleGroupFavorite
  │  onExecuteScenario
  │  onSetDeviceMode
  │  favoriteDeviceIds
  │  favoriteScenarioIds
  │  favoriteGroupIds
  │  isEditMode (×)
  │  и ещё 20 пропсов
  │
  ▼
Dashboard.tsx (30 props)
  │
  ├──────────────────────────────┐
  │                              │
  ▼                              ▼
Sidebar.tsx (23 props)     GroupCard.tsx (7 props)
  │                              │
  │  onToggleDeviceFavorite      │  onToggleDeviceFavorite
  │  onToggleScenarioFavorite    │  onToggleGroup
  │  onToggleGroupFavorite       │  onOpenSettings
  │  onToggleDevice              │  isEditMode
  │  onToggleGroup               │
  │                              │
  ▼                              ▼
  (рендерит список)         DeviceCard.tsx (9 props)
                                   │
                                   │  onToggle
                                   │  onToggleFavorite
                                   │  onOpenSettings
                                   │  isEditMode
                                   ▼
                              (рендерит карточку)
```

**Глубина:** 3–4 уровня (App → Dashboard → GroupCard → DeviceCard)

**Проблема:** Пропсы `onToggleDeviceFavorite`, `isEditMode`, `favoriteDeviceIds` и др. проходят через компоненты, которые их не используют, только передают дальше.

## 5. Избыточная мемоизация

### GroupCard.tsx — 7 useMemo

```typescript
// Проверки типов (дешёвые операции, не нуждающиеся в мемоизации)
const isLightGroup = useMemo(() => devices.every(...), [devices]);
const isThermostat = useMemo(() => devices.every(...), [devices]);
const isFan = useMemo(() => devices.every(...), [devices]);

// Фильтрация устройств
const lightDevices = useMemo(() => devices.filter(...), [devices]);
const thermostatDevices = useMemo(() => devices.filter(...), [devices]);
const fanDevices = useMemo(() => devices.filter(...), [devices]);
const acDevices = useMemo(() => devices.filter(...), [devices]);
```

Вызов `useMemo` для дешёвых `.every()` и `.filter()` на массивах из 1-20 элементов. Это добавляет оверхед (сравнение зависимостей) без выгоды.

### Dashboard.tsx — 8 useMemo

Мемоизируются фильтрации устройств по комнатам/группам, что оправдано, если данных много. Но мемоизация может быть избыточной при малом количестве устройств.

## 6. Обобщающая статистика

| Метрика                         | Значение          |
|---------------------------------|-------------------|
| Всего файлов в src/             | 24                |
| Всего строк в src/              | ~4500             |
| Строк в 2 god-компонентах       | 2008 (44%)        |
| Строк мёртвого кода             | ~580 (13%)        |
| Градус prop drilling            | Высокий (3-4 ур.) |
| Дублирование (приблизительно)   | ~150 строк (3%)   |
| Импортов из constants.tsx       | Множественные     |
| Pure-компонентов                | 3 из ~20          |

## Связанные документы

- [`architecture.md`](./architecture.md) — Общая архитектура проекта, стек технологий, контракты между модулями
- [`refactoring-plan.md`](./refactoring-plan.md) — Пошаговый план рефакторинга на основе данного анализа
