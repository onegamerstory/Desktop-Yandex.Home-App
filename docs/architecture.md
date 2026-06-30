# Архитектура Yandex Smart Home Control

> **Версия документа:** 1.0  
> **Дата:** 29 июня 2026 г.  
> **Версия приложения:** 1.8.1-beta  
> **Назначение:** Описание общей архитектуры, стека технологий, потоков данных и контрактов между модулями проекта Yandex Smart Home Control
> **Аудитория:** Разработчики, архитекторы

---

## Содержание

- [1. Общая архитектура приложения](#1-общая-архитектура-приложения)
- [2. Стек технологий](#2-стек-технологий)
- [3. Поток данных (Data Flow)](#3-поток-данных-data-flow)
- [4. Иерархия компонентов React](#4-иерархия-компонентов-react)
- [5. Схема навигации](#5-схема-навигации)
- [6. Схема темизации](#6-схема-темизации)
- [7. Роль каждого модуля](#7-роль-каждого-модуля)
- [8. Контракты между модулями](#8-контракты-между-модулями)
- [9. Ключевые архитектурные проблемы](#9-ключевые-архитектурные-проблемы)
- [Связанные документы](#связанные-документы)

---

## 1. Общая архитектура приложения

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Yandex Smart Home Control                       │
│                          Electron + React 19 App                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PROCESS MAIN (Electron)                      │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │   │
│  │  │   main.js     │  │  yandex-api   │  │ yandex-quasar.js  │   │   │
│  │  │  (Window,     │  │  (REST-клиент │  │ (Камеры Quasar)   │   │   │
│  │  │   Tray, IPC)  │  │   к Yandex    │  │                   │   │   │
│  │  └───────┬───────┘  │   IoT API)    │  │                   │   │   │
│  │          │          └───────┬───────┘  └───────────────────┘   │   │
│  │          │                  │                                   │   │
│  │  ┌───────┴──────────────────┴──────────────────────────────┐   │   │
│  │  │              IPC Bridge (ipcMain/ipcRenderer)            │   │   │
│  │  └───────┬─────────────────────────────────────────────────┘   │   │
│  └──────────┼─────────────────────────────────────────────────────┘   │
│             │                    preload.js                            │
│  ┌──────────┼─────────────────────────────────────────────────────┐   │
│  │          ▼                 PROCESS RENDERER                    │   │
│  │  ┌───────────────┐  ┌────────────────────────────────────┐    │   │
│  │  │  window.api   │  │   React Application (Vite + HMR)   │    │   │
│  │  │  (IPC-мост)   │  │                                    │    │   │
│  │  └───────┬───────┘  │  ┌───────────┐  ┌──────────────┐   │    │   │
│  │          │          │  │  App.tsx   │  │ Dashboard    │   │    │   │
│  │          │          │  │ (состояние,│  │ (рендеринг,  │   │    │   │
│  │          │          │  │  логика)   │  │  модалки)    │   │    │   │
│  │          ▼          │  └─────┬─────┘  └──────┬───────┘   │    │   │
│  │  ┌───────────────┐  │        │                │           │    │   │
│  │  │  yandexIoT.ts │  │        ├── Sidebar.tsx  │           │    │   │
│  │  │  (сервис-слой)│  │        ├── DeviceCard   │           │    │   │
│  │  └───────────────┘  │        ├── ScenarioCard │           │    │   │
│  │  ┌───────────────┐  │        ├── GroupCard    │           │    │   │
│  │  │ yandexGoloom  │  │        ├── 7 модалок    │           │    │   │
│  │  │ WebRtc.ts     │  │        └── Contexts     │           │    │   │
│  │  └───────────────┘  │                           │           │    │   │
│  │  ┌───────────────┐  │                           │           │    │   │
│  │  │  constants.tsx│  │  (свальник констант и     )           │    │   │
│  │  └───────────────┘  │   хелперов)                          │    │   │
│  └─────────────────────┴────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 ┌───────────────────────┐
                 │   Yandex IoT API      │
                 │   api.iot.yandex.net  │
                 │   + Quasar API        │
                 └───────────────────────┘
```

## 2. Стек технологий

| Компонент          | Технология                     | Версия       |
|--------------------|--------------------------------|--------------|
| **Ядро**           | Electron                       | 39.8.10      |
| **UI-фреймворк**   | React                          | 19.2.0       |
| **Язык**           | TypeScript                     | 5.8          |
| **Сборщик**        | Vite                           | 6.2          |
| **Стилизация**     | Tailwind CSS                   | 3.4.17       |
| **Иконки**         | Lucide React                   | 0.555.0      |
| **Безопасное хранилище** | keytar                    | 7.9.0        |
| **Потоки видео**   | HLS.js                         | 1.6.16       |
| **Авторизация**    | QR-код (qrcode)                | 1.5.4        |
| **HTTP-клиент**    | fetch-cookie + tough-cookie    | 3.2.0 / 6.0.1|

**Стейт-менеджмент:** Только React hooks (useState, useCallback, useEffect, useMemo, useRef) — без внешних библиотек.

**Роутинг:** Ручной, через условный рендеринг на основе `activeSidebarView`.

## 3. Поток данных (Data Flow)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW DIAGRAM                               │
│                                                                         │
│  ┌──────┐    ┌─────────┐    ┌───────────┐    ┌────────────┐            │
│  │User  │───►│App.tsx  │───►│yandexIoT  │───►│window.api  │            │
│  │Action│    │(hook)   │    │.ts        │    │(ipcRenderer)│            │
│  └──────┘    └─────────┘    └───────────┘    └─────┬──────┘            │
│       ▲                                            │                   │
│       │                                            ▼                   │
│       │                                    ┌──────────────┐            │
│       │                                    │  main.js     │            │
│       │                                    │  (ipcMain)   │            │
│       │                                    └──────┬───────┘            │
│       │                                           │                    │
│       │                                           ▼                    │
│       │                                    ┌──────────────┐            │
│       │                                    │ yandex-api.js │            │
│       │                                    │ (REST client) │            │
│       │                                    └──────┬───────┘            │
│       │                                           │                    │
│       │                                           ▼                    │
│       │                              ┌─────────────────────┐           │
│       │                              │  Yandex IoT API     │           │
│       │                              │  api.iot.yandex.net │           │
│       │                              └─────────────────────┘           │
│       │                                           │                    │
│       │          OPTIMISTIC UPDATE                │                    │
│       └───────────────────────────────────────────┘                    │
│         (UI обновляется сразу, затем синхронизация)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Детальный поток:**

1. **Пользователь** → нажимает кнопку (вкл/выкл устройство)
2. **Dashboard** → вызывает `onToggleDevice(deviceId, currentState)`
3. **App.tsx** → `handleToggleDevice`:
   - Вызывает `toggleDevice(token, deviceId, newState)` из `yandexIoT.ts`
   - **Оптимистично** обновляет `userData` в стейте
   - Запускает `refreshDashboardData(token)` для синхронизации
4. **yandexIoT.ts** → `window.api.toggleDevice()` → IPC → main.js
5. **main.js** → `yandex-api.js` → `PUT /v1.0/devices/{id}/actions`
6. **Ответ** → обратно по цепочке → обновление UI

## 4. Иерархия компонентов React

```
<ThemeProvider>                       // contexts/ThemeContext.tsx
  └── <App>                           // App.tsx — GOD-компонент (~893 строки)
        │
        ├── <TokenInput />            // Экран входа (условно)
        ├── <QrAuthModal />           // Модалка QR-авторизации (условно)
        ├── <UpdateNotificationModal /> // Модалка обновлений (условно)
        │
        └── <Dashboard                // Dashboard.tsx — GOD-компонент (~1115 строк)
               data={userData}
               households={...}
               activeHouseholdId={...}
               favoriteDeviceIds={...}
               onToggleDevice={...}
               /* и ещё 25 пропсов — всего 30 */>
              │
              ├── <Sidebar             // 23 пропса
              │      households={...}
              │      roomsForHome={...}
              │      groupsForHome={...}
              │      devicesForHome={...}
              │      favoriteDeviceIds={...}
              │      activeSidebarView={...}
              │      onToggleDevice={...}
              │      /* и ещё 16 пропсов */>
              │
              ├── <ScenarioCard        // Карточка сценария
              │      scenario={...}
              │      isFavorite={...}
              │      onToggleFavorite={...} />
              │
              ├── <GroupCard           // Карточка группы
              │      group={...}
              │      devices={...}
              │      isFavorite={...}
              │      onToggleFavorite={...}
              │      onToggleGroup={...}
              │      onOpenSettings={...}
              │      isEditMode={...} />
              │
              ├── <DeviceCard          // Карточка устройства
              │      device={...}
              │      isFavorite={...}
              │      onToggleFavorite={...}
              │      onOpenSettings={...}
              │      onOpenCameraStream={...}
              │      isEditMode={...} />
              │
              ├── <ThermostatSettingsModal />     // Модалка термостата
              ├── <BrightnessSettingsModal />      // Модалка яркости
              ├── <GroupLightSettingsModal />      // Групповая яркость
              ├── <GroupThermostatSettingsModal /> // Групповой термостат
              ├── <FanSettingsModal />             // Модалка вентилятора
              ├── <GroupFanSettingsModal />        // Групповой вентилятор
              ├── <CameraStreamModal />            // Поток с камеры
              └── <InfoModal />                    // Информация о программе
        │
        └── <NotificationToast />     // Всплывающее уведомление (определён внутри App)
</ThemeProvider>
```

## 5. Схема навигации

```
                    ┌──────────────────────────┐
                    │       App.tsx            │
                    │   appState === LOADING   │
                    │   (спиннер загрузки)     │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │       App.tsx            │
                    │   appState === AUTH      │
                    │   <TokenInput />         │
                    │   (ввод токена)          │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │       App.tsx            │
                    │  appState === DASHBOARD  │
                    │  <Dashboard>             │
                    │                          │
                    │  activeSidebarView:      │
                    │  ┌────────────────────┐  │
                    │  │  'home'  ── Все    │  │
                    │  │  'room'  ── Комната│  │
                    │  │  'group' ── Группа │  │
                    │  └────────────────────┘  │
                    └──────────────────────────┘
```

**Логика переключения:**

- `'home'` — показывает все устройства всех комнат и групп выбранного дома
- `'room'` — фильтрует только устройства и группы указанной комнаты (`activeRoomId`)
- `'group'` — фильтрует только устройства указанной группы (`activeGroupId`)

Переключение между видами выполняется через Sidebar (клик по комнате/группе или кнопка «Главная»).

## 6. Схема темизации

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THEMING SYSTEM                               │
│                                                                      │
│  ThemeContext (src/contexts/ThemeContext.tsx)                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  state: theme = 'light' | 'dark'                              │  │
│  │  + toggleTheme()                                              │  │
│  │  + localStorage('app_theme') — сохранение выбора              │  │
│  │  + document.documentElement:                                 │  │
│  │    • classList: 'dark' / убрано                              │  │
│  │    • setAttribute('data-theme', 'light'|'dark')              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Tailwind CSS (JIT)                                            │  │
│  │  • dark: классы (dark:bg-gray-900) — через darkMode: 'class'  │  │
│  │  • [data-theme='dark'] селекторы — для кастомных свойств       │  │
│  │  • CSS Variables в index.css:                                  │  │
│  │    --bg-primary, --surface, --text-primary                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Компоненты                                                    │  │
│  │  • useTheme() хук — получает { theme, toggleTheme }           │  │
│  │  • Кнопка переключения темы в Dashboard (иконка Sun/Moon)     │  │
│  │  • Все компоненты используют Tailwind dark: вариации          │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 7. Роль каждого модуля

### Frontend (src/)

| Модуль / Файл                       | Роль                                              | Строк |
|-------------------------------------|---------------------------------------------------|-------|
| `src/App.tsx`                       | **GOD**: корневой компонент, состояние, логика    | 893   |
| `src/index.tsx`                     | Точка входа React                                 | ~15   |
| `src/index.css`                     | Глобальные стили, CSS переменные                   | ~200  |
| `src/constants.tsx`                 | **GOD**: свальник констант, хелперов, маппингов  | 413   |
| `src/components/Dashboard.tsx`      | **GOD**: панель, модалки, фильтрация              | 1115  |
| `src/components/Sidebar.tsx`        | Навигация, список комнат/групп/сценариев          | 358   |
| `src/components/TokenInput.tsx`     | Форма ввода токена                                 | ~80   |
| `src/components/cards/DeviceCard.tsx` | Карточка устройства                              | 201   |
| `src/components/cards/ScenarioCard.tsx` | Карточка сценария                              | 77    |
| `src/components/cards/GroupCard.tsx` | Карточка группы                                  | 155   |
| `src/components/modals/` (10 файлов)| Модальные окна (настройки, стрим, инфо, обновления)| разное |
| `src/contexts/ThemeContext.tsx`      | Провайдер темы (light/dark)                       | 55    |
| `src/services/yandexIoT.ts`         | Сервис-слой: вызовы IPC (77% — мок-функция)       | 741   |
| `src/services/yandexGoloomWebRtc.ts`| WebRTC стриминг с камер Yandex                    | ~500  |
| `src/types/index.ts`                | Все TypeScript интерфейсы                         | ~200  |
| `src/utils/colorConverter.ts`       | Конвертация HSV ↔ RGB                             | ~80   |

### Electron (electron/)

| Файл                 | Роль                                               |
|----------------------|----------------------------------------------------|
| `main.js`           | Главный процесс: окно, трей, IPC, keytar           |
| `yandex-api.js`     | REST-клиент к Yandex IoT API (с retry механизмом) |
| `yandex-quasar.js`  | API для камер Яндекса (Quasar)                     |
| `yandex-x-token-auth.js` | QR-авторизация для X-Token                    |

## 8. Контракты между модулями

### IPC-контракт (window.api)

Rendere-процесс взаимодействует с main-процессом через `window.api` — объект, инжектируемый preload-скриптом.

| Метод                          | Параметры                                | Возвращает        |
|--------------------------------|------------------------------------------|-------------------|
| `fetchUserInfo`                | `(token: string)`                        | `YandexUserInfoResponse` |
| `fetchDevice`                  | `(token: string, deviceId: string)`      | `YandexDevice`    |
| `toggleDevice`                 | `(token, deviceId, newState)`            | `void`            |
| `toggleGroup`                  | `(token, groupId, deviceIds, newState)`  | `void`            |
| `executeScenario`              | `(token, scenarioId)`                    | `void`            |
| `setDeviceMode`                | `(token, deviceId, modeActions, turnOn)` | `void`            |
| `getCameraStream`              | `(deviceId)`                             | `CameraStreamResult` |
| `setCameraPrivacyMode`         | `(deviceId, privacyEnabled, toggleInstance)` | `void`        |
| `getQuasarCameraDevice`        | `(deviceId)`                             | `Yandevice`       |
| `hasXToken`/`getXToken`/`setXToken`/`deleteXToken` | —                      | `boolean/string/void` |
| `getSecureToken`/`setSecureToken`/`deleteSecureToken` | —                | `string/void`     |
| `getAutostart`/`setAutostart`  | —                                        | `boolean/void`    |

### Сервис-слой → IPC

`yandexIoT.ts` — это тонкая обёртка над `window.api`, добавляющая обработку ошибок и, в одном случае, до-загрузку устройств, отсутствующих в списке комнаты.

### Компоненты → Сервис-слой

Компоненты НЕ вызывают `window.api` напрямую. Все вызовы идут через:
1. `yandexIoT.ts` (функции-обёртки)
2. Обработчики в `App.tsx`, которые прокидываются в Dashboard и ниже через props

### Контракт ThemeContext

```
<ThemeProvider>
  // 1. Устанавливает класс 'dark' на <html>
  // 2. Устанавливает data-theme атрибут
  // 3. Сохраняет выбор в localStorage
  // 4. Предоставляет { theme, toggleTheme } через контекст
</ThemeProvider>
```

## 9. Ключевые архитектурные проблемы

1. **God-компоненты** — `App.tsx` и `Dashboard.tsx` содержат всю логику приложения
2. **Prop drilling** — пропсы прокидываются через 3-4 уровня (App → Dashboard → GroupCard → DeviceCard)
3. **Смешение ответственности** — `constants.tsx` содержит и константы, и JSX-хелперы, и функции проверки типов
4. **Dead code** — `injectComprehensiveMockDevices` (573 строки, 77% файла yandexIoT.ts) не используется
5. **Отсутствие выделенных хуков** — вся логика в теле компонентов, хуки не вынесены
6. **Перерендеры** — NotificationToast пересоздаётся при каждом рендере App

## Связанные документы

- [`components-analysis.md`](./components-analysis.md) — Полный анализ каждого компонента, метрики, дублирование кода, dead code
- [`refactoring-plan.md`](./refactoring-plan.md) — Пошаговый план рефакторинга: выделение хуков, контекстов, устранение дублирования
