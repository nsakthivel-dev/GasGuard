import { AlertRecord, SensorReading } from '../types';
import { persistAlertToCloud, persistReadingToCloud } from './supabase';

const DB_NAME = 'GasGuardOfflineDB';
const DB_VERSION = 1;
const READINGS_STORE = 'queued_readings';
const ALERTS_STORE = 'queued_alerts';

class OfflineSyncService {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSampledTime: number = 0;
  private sampleIntervalMs: number = 10000; // Sample sensor readings every 10 seconds to save cloud storage

  constructor() {
    this.initDB();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        return resolve(this.db);
      }
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(READINGS_STORE)) {
          db.createObjectStore(READINGS_STORE, { autoIncrement: true, keyPath: 'localId' });
        }
        if (!db.objectStoreNames.contains(ALERTS_STORE)) {
          db.createObjectStore(ALERTS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Queue or immediately sync reading with rate sampling
   */
  public async handleReading(reading: SensorReading) {
    const now = Date.now();
    // Only persist reading once every 10 seconds, or if gas is elevated (> 300)
    if (now - this.lastSampledTime < this.sampleIntervalMs && reading.gas < 350) {
      return;
    }
    this.lastSampledTime = now;

    if (this.isOnline) {
      const success = await persistReadingToCloud(reading);
      if (success) return;
    }

    // Queue in IndexedDB
    try {
      const db = await this.initDB();
      const tx = db.transaction(READINGS_STORE, 'readwrite');
      tx.objectStore(READINGS_STORE).add({ ...reading, queuedAt: now });
    } catch {
      // Local fallback
    }
  }

  /**
   * Queue or immediately sync alert
   */
  public async handleAlert(alert: AlertRecord) {
    if (this.isOnline) {
      const success = await persistAlertToCloud(alert);
      if (success) return;
    }

    try {
      const db = await this.initDB();
      const tx = db.transaction(ALERTS_STORE, 'readwrite');
      tx.objectStore(ALERTS_STORE).put(alert);
    } catch {
      // Local fallback
    }
  }

  /**
   * Flush offline queue to cloud once connectivity is restored
   */
  public async flushQueue() {
    if (!this.isOnline) return;

    try {
      const db = await this.initDB();

      // 1. Flush alerts
      const alertTx = db.transaction(ALERTS_STORE, 'readwrite');
      const alertStore = alertTx.objectStore(ALERTS_STORE);
      const alertsRequest = alertStore.getAll();

      alertsRequest.onsuccess = async () => {
        const queuedAlerts: AlertRecord[] = alertsRequest.result || [];
        for (const alert of queuedAlerts) {
          const ok = await persistAlertToCloud(alert);
          if (ok) {
            const delTx = db.transaction(ALERTS_STORE, 'readwrite');
            delTx.objectStore(ALERTS_STORE).delete(alert.id);
          }
        }
      };

      // 2. Flush readings
      const readTx = db.transaction(READINGS_STORE, 'readwrite');
      const readStore = readTx.objectStore(READINGS_STORE);
      const readingsRequest = readStore.getAll();

      readingsRequest.onsuccess = async () => {
        const queuedReadings = readingsRequest.result || [];
        for (const item of queuedReadings) {
          const { localId, queuedAt, ...reading } = item;
          const ok = await persistReadingToCloud(reading);
          if (ok) {
            const delTx = db.transaction(READINGS_STORE, 'readwrite');
            delTx.objectStore(READINGS_STORE).delete(localId);
          }
        }
      };
    } catch (err) {
      console.warn('[OfflineSync] Flush queue failed:', err);
    }
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }
}

export const offlineSync = new OfflineSyncService();
