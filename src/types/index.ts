export type DeviceStatus = 'online' | 'offline' | 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';

export type GasStatus = 'NORMAL' | 'WARNING' | 'ALERT';

export type AlertSeverity = 'safe' | 'warning' | 'danger' | 'HIGH' | 'CRITICAL';

export type AlertEngineState = 'SAFE' | 'WARNING' | 'DANGER' | 'ALERT_ACTIVE' | 'ACKNOWLEDGED';

export interface SensorReading {
  id?: number;
  gas: number;               // Raw ADC value (0-1023 or 0-4095)
  gas_value?: number;
  status?: GasStatus;
  temperature?: number;      // Celsius (optional if DHT sensor attached)
  humidity?: number;         // Percentage (optional if DHT sensor attached)
  timestamp: number;         // Milliseconds epoch timestamp
  recorded_at?: string;
  deviceId?: string;
  device_id?: string;
  isStale?: boolean;
}

export interface DeviceRecord {
  id: string;                // e.g. 'GAS-000001'
  name: string;
  location: string;
  device_type: 'ESP32' | 'ArduinoUno';
  connection_type: string;
  status: 'online' | 'offline';
  last_seen?: string;
  created_at?: string;
  updated_at?: string;
  latestReading?: SensorReading | null;
  currentGas?: number;
  currentStatus?: GasStatus;
  isOnlineComputed?: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  location: string;
  deviceType: 'ArduinoUno' | 'ESP32';
  connectionType: 'usb-serial' | 'wifi-websocket' | 'wifi-http';
  baudRate: number;
  lastSeenAt?: string;
  status: DeviceStatus;
  errorMessage?: string;
}

export interface AlertRecord {
  id: string;
  deviceId: string;
  device_id?: string;
  type: string;              // e.g. 'GAS_LEAK', 'DEVICE_OFFLINE', 'SENSOR_ERROR'
  severity: AlertSeverity | string;
  gasValue: number;
  gas_value?: number;
  message?: string;
  startedAt: string;         // ISO String
  created_at?: string;
  endedAt?: string;          // ISO String
  resolved_at?: string;
  acknowledgedAt?: string;   // ISO String
  acknowledged?: boolean;
  durationSeconds?: number;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface DeviceEvent {
  id: number;
  device_id: string;
  event_type: string;
  message: string;
  created_at: string;
}

export interface DeviceSettings {
  id: string;
  device_id?: string | null;
  warning_threshold: number;
  alert_threshold: number;
  heartbeat_timeout_seconds: number;
  created_at?: string;
  updated_at?: string;
}

export interface AlertSettings {
  warningThreshold: number;  // e.g. 400
  dangerThreshold: number;   // e.g. 700
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
  cooldownSeconds: number;
  heartbeatTimeoutSeconds?: number;
}

export interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  activeAlerts: number;
}

export type TimeRangeFilter = 'live' | '1h' | '6h' | '24h' | '7d' | '30d';
