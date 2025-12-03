export interface YandexScenario {
  id: string;
  name: string;
  is_active: boolean;
  icon?: string; 
}

export interface YandexCapabilityState {
  instance: string;
  value: boolean | number | string;
}

export interface YandexCapability {
  type: string;
  retrievable: boolean;
  reportable: boolean;
  state?: YandexCapabilityState;
  parameters?: unknown;
}

// Дополнительные типы для свойств датчиков (сенсоров)
export interface YandexPropertyState {
  instance: string;
  value: boolean | number | string;
  unit?: string;
}

export interface YandexPropertyParameters {
  instance: string; // например, 'humidity', 'temperature'
  unit?: string;    // например, 'percent', 'celsius'
}

export interface YandexProperty {
  type: string;               // 'devices.properties.float', 'devices.properties.event' и т.д.
  retrievable: boolean;
  reportable: boolean;
  parameters?: YandexPropertyParameters;
  state?: YandexPropertyState;
}

export interface YandexDevice {
  id: string;
  name: string;
  type: string;
  external_id?: string;
  skill_id?: string;
  room?: string;
  groups?: string[];
  capabilities: YandexCapability[];
  properties?: YandexProperty[];
}

export interface YandexRoom {
  id: string;
  name: string;
  household_id: string;
  devices: string[]; 
}

export interface YandexHousehold {
  id: string;
  name: string;
  location?: unknown;
}

export interface YandexUserInfoResponse {
  status: string;
  request_id: string;
  rooms: YandexRoom[];
  groups: unknown[];
  devices: YandexDevice[];
  scenarios: YandexScenario[];
  households: YandexHousehold[];
}

export interface ApiError {
  status: string;
  message: string;
}

export enum AppState {
  AUTH = 'AUTH',
  LOADING = 'LOADING',
  DASHBOARD = 'DASHBOARD',
  ERROR = 'ERROR'
}

export type TrayItemType = 'device' | 'scenario';

export interface TrayMenuItem {
    id: string;
    name: string;
    type: TrayItemType;
    // Для устройств
    isToggleable?: boolean; 
    isOn?: boolean; 
}