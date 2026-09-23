import { DeviceStatus, SensorReading } from '../types';

export interface GasDevice {
  /** Connect to the device */
  connect(): Promise<void>;
  
  /** Disconnect safely from the device */
  disconnect(): Promise<void>;
  
  /** Current connection status */
  getStatus(): DeviceStatus;
  
  /** Start continuous telemetry stream */
  startReading(): Promise<void>;
  
  /** Stop telemetry stream */
  stopReading(): Promise<void>;
  
  /** Register callback for incoming sensor telemetry */
  onReading(callback: (data: SensorReading) => void): void;
  
  /** Register callback for errors */
  onError(callback: (err: Error) => void): void;
  
  /** Register callback for connection state changes */
  onStatusChange(callback: (status: DeviceStatus) => void): void;

  /** Retrieve device identifier */
  getDeviceId(): string;

  /** Retrieve device human-friendly model/type */
  getModelName(): string;
}
