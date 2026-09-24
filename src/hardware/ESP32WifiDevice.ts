import { GasDevice } from './GasDevice';
import { DeviceStatus, SensorReading } from '../types';

/**
 * ESP32 Wi-Fi Device Driver
 * Connects via WebSocket or HTTP endpoint to an ESP32 micro-controller on the local network
 * or cloud MQTT/WebSocket bridge.
 */
export class ESP32WifiDevice implements GasDevice {
  private status: DeviceStatus = 'disconnected';
  private ws: WebSocket | null = null;
  private endpointUrl: string;
  private deviceId: string;
  private readingCallbacks: ((data: SensorReading) => void)[] = [];
  private errorCallbacks: ((err: Error) => void)[] = [];
  private statusCallbacks: ((status: DeviceStatus) => void)[] = [];

  constructor(endpointUrl: string = 'ws://192.168.1.100/ws', deviceId: string = 'GAS-000001') {
    this.endpointUrl = endpointUrl;
    this.deviceId = deviceId;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getModelName(): string {
    return 'ESP32 (Wi-Fi WebSocket)';
  }

  public getStatus(): DeviceStatus {
    return this.status;
  }

  public onReading(callback: (data: SensorReading) => void): void {
    this.readingCallbacks.push(callback);
  }

  public onError(callback: (err: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  public onStatusChange(callback: (status: DeviceStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  private setStatus(newStatus: DeviceStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusCallbacks.forEach((cb) => cb(newStatus));
    }
  }

  public async connect(): Promise<void> {
    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.endpointUrl);

        this.ws.onopen = () => {
          this.setStatus('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (typeof data.gas === 'number') {
              const reading: SensorReading = {
                gas: Math.max(0, Math.round(data.gas)),
                temperature: data.temperature,
                humidity: data.humidity,
                timestamp: Date.now(),
                deviceId: this.deviceId,
              };
              this.readingCallbacks.forEach((cb) => cb(reading));
            }
          } catch {
            // Ignore malformed packet
          }
        };

        this.ws.onerror = (e) => {
          const err = new Error('ESP32 Wi-Fi connection error');
          this.setStatus('error');
          this.errorCallbacks.forEach((cb) => cb(err));
          reject(e);
        };

        this.ws.onclose = () => {
          this.setStatus('disconnected');
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.setStatus('error');
        this.errorCallbacks.forEach((cb) => cb(error));
        reject(error);
      }
    });
  }

  public async startReading(): Promise<void> {
    // Already streaming via WebSocket onopen
  }

  public async stopReading(): Promise<void> {
    // Handled in disconnect
  }

  public async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}
