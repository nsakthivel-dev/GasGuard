// Web Serial API Type Definitions for TypeScript compatibility

export interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface SerialPortOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

export interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOptions): Promise<void>;
  close(): Promise<void>;
  forget?(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

export interface SerialStorage {
  requestPort(options?: { filters?: SerialPortFilter[] }): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
}

export function getNavigatorSerial(): SerialStorage | null {
  if (typeof navigator !== 'undefined' && 'serial' in navigator) {
    return (navigator as unknown as { serial: SerialStorage }).serial;
  }
  return null;
}
