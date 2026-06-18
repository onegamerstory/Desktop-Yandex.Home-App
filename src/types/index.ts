export interface YandexScenarioStep {
  parameters?: {
    items?: Array<{ id: string }>;
  };
}

export interface YandexScenario {
  id: string;
  name: string;
  is_active: boolean;
  icon?: string;
  steps?: YandexScenarioStep[];
}

export interface YandexModeAction {
  instance: string;
  value: any;
  type?: string;
}

export interface YandexCapabilityState {
  instance: string;
  value: boolean | number | string | Record<string, unknown>;
}

export interface YandexModeOption {
  value: string;
  name: string;
}

export interface YandexModeCapabilityParameters {
  instance: string;
  modes: YandexModeOption[];
}

export interface YandexCapability {
  type: string;
  retrievable: boolean;
  reportable: boolean;
  state?: YandexCapabilityState;
  parameters?: YandexModeCapabilityParameters | Record<string, unknown>;
}

export interface YandexPropertyState {
  instance: string;
  value: boolean | number | string;
  unit?: string;
}

export interface YandexPropertyEvent {
  value: string;
  name: string;
}

export interface YandexPropertyParameters {
  instance: string;
  unit?: string;
  events?: YandexPropertyEvent[];
}

export interface YandexProperty {
  type: string;
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

export interface YandexGroup {
  id: string;
  name: string;
  household_id: string;
  devices: string[];
  capabilities: YandexCapability[];
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
  groups: YandexGroup[];
  devices: YandexDevice[];
  scenarios: YandexScenario[];
  households: YandexHousehold[];
}

export interface YandexWebRtcRoom {
  serviceUrl: string;
  serviceName: string;
  roomId: string;
  participantId: string;
  credentials: string;
}

export interface CameraStreamResult {
  protocol: string;
  streamUrl?: string;
  webrtc?: YandexWebRtcRoom;
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
    isToggleable?: boolean; 
    isOn?: boolean;
    sensorValue?: string | null;
}
