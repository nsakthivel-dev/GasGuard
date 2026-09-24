import { GasDevice } from '../hardware/GasDevice';
import { ArduinoUnoSerialDevice } from '../hardware/ArduinoUnoSerialDevice';
import { ESP32WifiDevice } from '../hardware/ESP32WifiDevice';
import { DeviceInfo, DeviceStatus, SensorReading } from '../types';
import { alertEngine } from './AlertEngine';

export type SensorReadingListener = (reading: SensorReading) => void;
export type DeviceStatusListener = (info: DeviceInfo) => void;

class SensorService {
  private activeDevice: GasDevice;
  private currentReading: SensorReading | null = null;
  private readingsHistory: SensorReading[] = [];
  private readingListeners: SensorReadingListener[] = [];
  private statusListeners: DeviceStatusListener[] = [];
  private stalenessTimer: number | null = null;
  private deviceInfo: DeviceInfo = {
    id: 'GAS-000001',
    name: 'Kitchen',
    location: 'Kitchen / Utility Area',
    deviceType: 'ArduinoUno',
    connectionType: 'usb-serial',
    baudRate: 9600,
    status: 'disconnected',
  };

  constructor() {
    this.activeDevice = new ArduinoUnoSerialDevice(this.deviceInfo.baudRate, this.deviceInfo.id);
    this.attachDeviceListeners(this.activeDevice);
    this.startStalenessCheck();
  }

  private attachDeviceListeners(device: GasDevice) {
    device.onReading((reading) => {
      this.handleIncomingReading(reading);
    });

    device.onStatusChange((status) => {
      this.deviceInfo.status = status;
      if (status === 'connected') {
        this.deviceInfo.lastSeenAt = new Date().toISOString();
      }
      this.notifyStatusChange();
    });

    device.onError((err) => {
      this.deviceInfo.errorMessage = err.message;
      this.notifyStatusChange();
    });
  }

  public getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  public updateDeviceInfo(updates: Partial<DeviceInfo>) {
    this.deviceInfo = { ...this.deviceInfo, ...updates };
    this.notifyStatusChange();
  }

  public getCurrentReading(): SensorReading | null {
    return this.currentReading;
  }

  public getReadingsHistory(): SensorReading[] {
    return [...this.readingsHistory];
  }

  public onReading(listener: SensorReadingListener) {
    this.readingListeners.push(listener);
  }

  public onStatusChange(listener: DeviceStatusListener) {
    this.statusListeners.push(listener);
  }

  private notifyStatusChange() {
    this.statusListeners.forEach((l) => l(this.getDeviceInfo()));
  }

  private handleIncomingReading(reading: SensorReading) {
    this.currentReading = reading;
    this.deviceInfo.lastSeenAt = new Date().toISOString();

    // In-memory telemetry buffer (keep last 500 data points for responsive charts)
    this.readingsHistory.push(reading);
    if (this.readingsHistory.length > 500) {
      this.readingsHistory.shift();
    }

    // Process reading through safety engine
    alertEngine.processReading(reading);

    // Notify UI listeners
    this.readingListeners.forEach((l) => l(reading));
  }

  /**
   * Switches device type (e.g. from Arduino Uno USB to ESP32 Wi-Fi)
   */
  public async setDeviceType(type: 'ArduinoUno' | 'ESP32', options?: { baudRate?: number; wsUrl?: string }) {
    await this.disconnectDevice();

    if (type === 'ArduinoUno') {
      const baud = options?.baudRate || 9600;
      this.deviceInfo.deviceType = 'ArduinoUno';
      this.deviceInfo.connectionType = 'usb-serial';
      this.deviceInfo.baudRate = baud;
      this.activeDevice = new ArduinoUnoSerialDevice(baud, this.deviceInfo.id);
    } else {
      this.deviceInfo.deviceType = 'ESP32';
      this.deviceInfo.connectionType = 'wifi-websocket';
      this.activeDevice = new ESP32WifiDevice(options?.wsUrl || 'ws://192.168.1.100/ws', this.deviceInfo.id);
    }

    this.attachDeviceListeners(this.activeDevice);
    this.notifyStatusChange();
  }

  public async connectDevice(): Promise<void> {
    try {
      this.deviceInfo.errorMessage = undefined;
      await this.activeDevice.connect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.deviceInfo.errorMessage = error.message;
      this.notifyStatusChange();
      throw error;
    }
  }

  public async disconnectDevice(): Promise<void> {
    await this.activeDevice.disconnect();
    this.deviceInfo.status = 'disconnected';
    this.notifyStatusChange();
  }

  /**
   * Monitor for stale sensor data (e.g. if device hangs or stops transmitting)
   */
  private startStalenessCheck() {
    this.stalenessTimer = window.setInterval(() => {
      if (this.currentReading && this.deviceInfo.status === 'connected') {
        const elapsed = Date.now() - this.currentReading.timestamp;
        if (elapsed > 8000) {
          // Stale reading
          this.currentReading = { ...this.currentReading, isStale: true };
          this.readingListeners.forEach((l) => l(this.currentReading!));
        }
      }
    }, 3000);
  }

  public cleanup() {
    if (this.stalenessTimer) {
      clearInterval(this.stalenessTimer);
    }
    this.disconnectDevice();
  }
}

export const sensorService = new SensorService();
