# SensorCard — компонент карточки датчика/сенсора

> **Версия документа:** 1.0  
> **Дата:** 1 июля 2026 г.  
> **Назначение:** Описание компонента `SensorCard` — выделенной карточки для устройств-датчиков (сенсоров), форматирования показателей и интеграции в существующую архитектуру
> **Аудитория:** Разработчики, ревьюеры

---

## Содержание

- [1. Назначение](#1-назначение)
- [2. Архитектура](#2-архитектура)
- [3. Интерфейс пропсов](#3-интерфейс-пропсов)
- [4. Форматирование показателей](#4-форматирование-показателей)
- [5. Логика отображения](#5-логика-отображения)
- [6. Интеграция](#6-интеграция)
- [7. CSS-классы](#7-css-классы)
- [8. Детекция сенсоров](#8-детекция-сенсоров)
- [Связанные документы](#связанные-документы)

---

## 1. Назначение

`SensorCard` — отдельный компонент для отображения карточек устройств-датчиков (сенсоров) и счётчиков (`smart_meter`). Отвечает за:

- Отображение **всех** свойств (`properties`) устройства с форматированием
- Единообразный вывод числовых значений (дробные → `toFixed(2)`)
- Локализацию event-свойств (маппинг `value → name` из `parameters.events`)
- Булевы значения → русский текст («Да» / «Нет»)
- Постоянное состояние `is-on` (сенсоры не переключаются)

Создан в рамках рефакторинга для устранения дублирования логики парсинга сенсорных свойств между `DeviceCard.tsx`, `formatSensorValue()` и `formatSensorValueForTray()`.

---

## 2. Архитектура

```
DeviceCardAdapter
  │
  ├── isSensorDevice(device) === true
  │     └── SensorCard (все свойства, is-on)
  │
  └── isSensorDevice(device) === false
        └── DeviceCard (одно свойство, toggle, модалки)
```

`SensorCard` и `DeviceCard` реализуют **общий интерфейс пропсов** (`DeviceCardProps`) и взаимозаменяемы через адаптер. Компонент не знает о `DeviceCardAdapter` — он получает пропсы напрямую.

| Компонент            | Файл                           | Роль                                |
|----------------------|--------------------------------|--------------------------------------|
| `DeviceCardAdapter`  | `src/components/cards/DeviceCardAdapter.tsx` | Адаптер: выбирает SensorCard или DeviceCard |
| `SensorCard`         | `src/components/cards/SensorCard.tsx`        | Карточка сенсора (все свойства)      |
| `DeviceCard`         | `src/components/cards/DeviceCard.tsx`        | Карточка устройства (одно свойство)  |

---

## 3. Интерфейс пропсов

`SensorCardProps` — полная копия `DeviceCardProps` (обеспечивает взаимозаменяемость через `DeviceCardAdapter`):

```typescript
interface SensorCardProps {
  device: YandexDevice;                                    // Данные устройства
  onToggle: (id: string, currentState: boolean) => Promise<void>;  // Не используется (сенсор не выключается)
  isFavorite: boolean;                                     // Флаг избранного
  onToggleFavorite: (id: string) => void;                  // Переключение избранного
  onOpenSettings?: (device: YandexDevice) => void;         // Открытие настроек (опционально)
  onOpenCameraStream?: (device: YandexDevice) => void;     // Поток с камеры (опционально)
  isEditMode?: boolean;                                    // Режим редактирования
  iconHiddenState?: boolean;                               // Флаг скрытия карточки
  onToggleVisibility?: (id: string) => void;               // Переключение видимости
}
```

> **Примечание:** `onToggle` передаётся для совместимости интерфейсов, но в `SensorCard` **не используется** — сенсоры не имеют capability `on_off` и не могут быть выключены.

---

## 4. Форматирование показателей

Вся логика форматирования вынесена в функцию `formatAllSensorProperties(device)`, возвращающую массив `FormattedSensorProperty[]`:

```typescript
interface FormattedSensorProperty {
  key: string;             // `${instance}_${index}` — уникальный ключ для рендеринга
  instance: string;        // Тип показателя (temperature, humidity, event, battery_level и т.д.)
  formattedValue: string;  // Отформатированное строковое значение
}
```

### Правила форматирования

| Тип свойства              | Условие                              | Формат вывода                                          |
|---------------------------|--------------------------------------|--------------------------------------------------------|
| **Event**                 | `type === 'devices.properties.event'` | Локализованное имя события из `parameters.events`      |
| **Number**                | `typeof value === 'number'`          | `Number(value).toFixed(2)` + локализованная единица    |
| **Boolean**               | `typeof value === 'boolean'`         | `"Да"` / `"Нет"`                                       |
| **String / Fallback**     | всё остальное                        | `String(value)` или `"—"` если `value === null`        |

### Особенности

- **Локализация единиц:** `localizeUnit(unit)` из `constants/formatting.ts`
- **Единицы по умолчанию:** для `humidity` → `" %"`, для `temperature` → `" °C"` (при отсутствии `parameters.unit`)
- **Фильтрация:** функция пропускает свойства, у которых `type` не содержит `devices.properties`, отсутствует `instance`, или `value === undefined`

---

## 5. Логика отображения

### Ключевые отличия от DeviceCard

| Характеристика            | `DeviceCard`                          | `SensorCard`                          |
|---------------------------|---------------------------------------|---------------------------------------|
| **CSS-класс `is-on`**     | Условный (только если устройство включено) | **Всегда** (сенсор всегда «включён») |
| **Показатели устройства** | Показывает **один** первый property    | Показывает **все** properties         |
| **Toggle-кнопка**         | Есть (on/off)                         | Нет (сенсор не переключается)         |
| **Контекстное меню**      | Камера → стрим, иначе → настройки     | Всегда → настройки (при наличии)      |
| **Loading-состояние**     | Есть (спиннер при toggle)             | Нет                                    |
| **Иконка микрофона**      | Есть (для камер с микрофоном)         | Нет                                    |

### Поведение

1. Карточка всегда имеет CSS-класс `is-on` — сенсоры считаются постоянно активными
2. Все отфильтрованные свойства рендерятся списком в блоке `.sensor-properties`
3. Клик по карточке (или контекстное меню) открывает настройки устройства
4. В режиме редактирования отображается кнопка скрытия карточки
5. Кнопка избранного работает стандартно

---

## 6. Интеграция

`SensorCard` не используется напрямую. Внедрение происходит через `DeviceCardAdapter`:

```typescript
// src/components/cards/DeviceCardAdapter.tsx
export const DeviceCardAdapter: React.FC<DeviceCardProps> = (props) => {
  return isSensorDevice(props.device)
    ? <SensorCard {...props} />
    : <DeviceCard {...props} />;
};
```

### Точки интеграции

| Компонент                  | Файл                                    | Использование                                         |
|----------------------------|-----------------------------------------|-------------------------------------------------------|
| `DashboardHomeView.tsx`    | `src/components/DashboardHomeView.tsx`  | Рендерит `DeviceCardAdapter` для каждого устройства   |
| `DashboardRoomView.tsx`    | `src/components/DashboardRoomView.tsx`  | Рендерит `DeviceCardAdapter` для устройств в комнате  |
| `GroupCard.tsx`            | `src/components/cards/GroupCard.tsx`    | Рендерит `DeviceCardAdapter` для устройств внутри группы |

Все три точки передают полный набор пропсов `DeviceCardProps`, и адаптер самостоятельно выбирает нужную реализацию карточки.

---

## 7. CSS-классы

| Селектор                          | Назначение                                        |
|-----------------------------------|---------------------------------------------------|
| `.sensor-card`                   | Модификатор карточки сенсора (дополняет `.device-card`) |
| `.sensor-card.is-on`             | Состояние «включено» — применяется всегда          |
| `.sensor-properties`             | Контейнер списка всех свойств сенсора              |
| `.sensor-property-row`           | Строка одного свойства внутри контейнера           |
| `.device-sensor-value`           | Стилизация отформатированного значения (переиспользуется из DeviceCard) |
| `.device-card`                   | Базовый класс карточки (общий с DeviceCard)        |
| `.device-card-top`               | Верхняя часть карточки (иконка + кнопки)           |
| `.device-name`                   | Название устройства                                |
| `.device-type-label`             | Метка типа устройства (последний сегмент `device.type`) |
| `.device-fav` / `.is-fav`       | Кнопка избранного                                  |
| `.edit-vis-btn`                  | Кнопка скрытия карточки (режим редактирования)     |

---

## 8. Детекция сенсоров

Функция `isSensorDevice()` определена в `src/constants/deviceTypes.ts` и экспортируется через `src/constants/index.ts`:

```typescript
// src/constants/deviceTypes.ts
export const isSensorDevice = (device: { type: string }): boolean => {
  return device.type.startsWith('devices.types.sensor')
      || device.type === 'devices.types.smart_meter';
};
```

### Маппинг типов

| Тип устройства                          | isSensorDevice | Компонент     |
|-----------------------------------------|----------------|---------------|
| `devices.types.sensor.*`               | `true`         | `SensorCard`  |
| `devices.types.smart_meter`            | `true`         | `SensorCard`  |
| `devices.types.light.*`                | `false`        | `DeviceCard`  |
| `devices.types.thermostat.*`           | `false`        | `DeviceCard`  |
| `devices.types.camera.*`               | `false`        | `DeviceCard`  |
| `devices.types.ventilation.fan`        | `false`        | `DeviceCard`  |
| `devices.types.smart_speaker` / `hub` / `other` | `false` | `DeviceCard` |

### Примеры устройств, попадающих под SensorCard

- Датчики температуры и влажности (`devices.types.sensor.temperature`, `devices.types.sensor.humidity`)
- Датчики движения (`devices.types.sensor.motion`)
- Датчики открытия двери/окна (`devices.types.sensor.open`)
- Датчики дыма (`devices.types.sensor.smoke`)
- Счётчики воды/электроэнергии (`devices.types.smart_meter`)

---

## Связанные документы

- [`architecture.md`](./architecture.md) — Общая архитектура проекта, иерархия компонентов
- [`components-analysis.md`](./components-analysis.md) — Анализ дублирования кода: 3 копии парсинга сенсорных свойств
- [`refactoring-plan.md`](./refactoring-plan.md) — План рефакторинга: шаг 34 (useDeviceDisplayProps), устранение дублирования форматирования
- [`../src/components/cards/SensorCard.tsx`](../src/components/cards/SensorCard.tsx) — исходный код компонента
- [`../src/components/cards/DeviceCardAdapter.tsx`](../src/components/cards/DeviceCardAdapter.tsx) — адаптер, выбирающий реализацию карточки
- [`../src/constants/deviceTypes.ts`](../src/constants/deviceTypes.ts) — функция `isSensorDevice`
