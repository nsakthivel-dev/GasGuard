import { GasDevice } from './GasDevice';
import { DeviceStatus, SensorReading } from '../types';
import { getNavigatorSerial, SerialPort } from './webSerialTypes';

export class ArduinoUnoSerialDevice implements GasDevice {
  private status: DeviceStatus = 'disconnected';
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private keepReading = false;
  private baudRate: number;
  private deviceId: string;
  private readingCallbacks: ((data: SensorReading) => void)[] = [];
  private errorCallbacks: ((err: Error) => void)[] = [];
  private statusCallbacks: ((status: DeviceStatus) => void)[] = [];

  constructor(baudRate: number = 9600, deviceId: string = 'ARDUINO-UNO-001') {
    this.baudRate = baudRate;
    this.deviceId = deviceId;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getModelName(): string {
    return 'Arduino Uno (USB Serial)';
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

  private emitError(err: Error): void {
    this.errorCallbacks.forEach((cb) => cb(err));
  }

  private emitReading(reading: SensorReading): void {
    this.readingCallbacks.forEach((cb) => cb(reading));
  }

  /**
   * Connects to the Arduino.
   * First checks navigator.serial.getPorts() for any previously approved port.
   * If not found, requests user permission via requestPort().
   */
  public async connect(): Promise<void> {
    const serial = getNavigatorSerial();
    if (!serial) {
      const err = new Error(
        'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera on Desktop or Android.'
      );
      this.setStatus('error');
      this.emitError(err);
      throw err;
    }

    try {
      this.setStatus('connecting');

      // Check if there is an already authorized port
      const ports = await serial.getPorts();
      if (ports.length > 0) {
        this.port = ports[0];
      } else {
        // Prompt user for port permission
        this.port = await serial.requestPort();
      }

      if (!this.port) {
        throw new Error('No serial port selected.');
      }

      // Open the port at specified baud rate
      await this.port.open({ baudRate: this.baudRate });

      this.setStatus('connected');
      await this.startReading();

      // Listen for USB unplug events
      const disconnectListener = (event: Event) => {
        const targetPort = (event as { port?: SerialPort }).port;
        if (targetPort === this.port) {
          console.warn('[Hardware] Device disconnected via USB event');
          this.handleDisconnect('Device was physically unplugged.');
        }
      };
      serial.addEventListener('disconnect', disconnectListener);

    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[Hardware] Connection failed:', error);
      this.setStatus('disconnected');
      this.emitError(error);
      throw error;
    }
  }

  /**
   * Continuous stream reader with newline-delimited text decoding and JSON parsing.
   */
  public async startReading(): Promise<void> {
    if (!this.port || !this.port.readable) {
      return;
    }

    this.keepReading = true;

    try {
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = (this.port.readable as any).pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      let lineBuffer = '';

      while (this.keepReading && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }

        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split(/\r?\n/);
          // Keep incomplete trailing fragment in buffer
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            this.parseLine(line.trim());
          }
        }
      }

      await readableStreamClosed.catch(() => {});
    } catch (err: unknown) {
      if (this.keepReading) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[Hardware] Stream read error:', error);
        this.handleDisconnect(error.message);
      }
    }
  }

  /**
   * Safely parses an incoming line from the serial device.
   * Handles JSON like {"gas": 523, "temperature": 28.4, "humidity": 64}
   * as well as resilient fallbacks for raw integer values or key-value formats.
   */
  private parseLine(rawLine: string): void {
    if (!rawLine || rawLine.length === 0) return;

    // Ignore Arduino startup comments/noise e.g. "Starting Gas System..."
    if (rawLine.startsWith('#') || rawLine.startsWith('//')) {
      return;
    }

    try {
      // 1. Try standard JSON parse
      if (rawLine.startsWith('{') && rawLine.endsWith('}')) {
        const parsed = JSON.parse(rawLine);
        if (typeof parsed.gas === 'number') {
          const reading: SensorReading = {
            gas: Math.max(0, Math.round(parsed.gas)),
            temperature: typeof parsed.temperature === 'number' ? Number(parsed.temperature.toFixed(1)) : undefined,
            humidity: typeof parsed.humidity === 'number' ? Number(parsed.humidity.toFixed(1)) : undefined,
            timestamp: Date.now(),
            deviceId: this.deviceId,
          };
          this.emitReading(reading);
          return;
        }
      }

      // 2. Fallback: Parse raw integer value (e.g. "450")
      const numericVal = Number(rawLine);
      if (!isNaN(numericVal) && numericVal >= 0 && numericVal <= 2000) {
        const reading: SensorReading = {
          gas: Math.round(numericVal),
          timestamp: Date.now(),
          deviceId: this.deviceId,
        };
        this.emitReading(reading);
        return;
      }

      // 3. Fallback: Parse "GAS: 450" or "gas=450"
      const match = rawLine.match(/(?:gas|val|reading)[:=]\s*(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        this.emitReading({
          gas: val,
          timestamp: Date.now(),
          deviceId: this.deviceId,
        });
      }
    } catch {
      // Ignore corrupt line fragments, never crash the app
    }
  }

  public async stopReading(): Promise<void> {
    this.keepReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Ignored
      }
      this.reader = null;
    }
  }

  public async disconnect(): Promise<void> {
    this.keepReading = false;
    await this.stopReading();

    if (this.port) {
      try {
        await this.port.close();
      } catch (err) {
        console.warn('[Hardware] Error closing serial port:', err);
      }
      this.port = null;
    }

    this.setStatus('disconnected');
  }

  private handleDisconnect(reason: string): void {
    this.keepReading = false;
    this.setStatus('disconnected');
    this.emitError(new Error(`Hardware disconnected: ${reason}`));
  }
}
