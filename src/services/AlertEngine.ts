import { AlertEngineState, AlertRecord, AlertSettings, SensorReading } from '../types';
import { audioAlarm } from './audioAlarm';
import { notificationService } from './notificationService';

export type AlertStateChangeListener = (state: AlertEngineState, activeAlert: AlertRecord | null) => void;

export class AlertEngine {
  private state: AlertEngineState = 'SAFE';
  private settings: AlertSettings;
  private activeAlert: AlertRecord | null = null;
  private lastAlertEndedAt: number = 0;
  private listeners: AlertStateChangeListener[] = [];
  private onAlertCreatedCallback?: (alert: AlertRecord) => void;
  private onAlertResolvedCallback?: (alert: AlertRecord) => void;

  constructor(settings?: Partial<AlertSettings>) {
    this.settings = {
      warningThreshold: 400,
      dangerThreshold: 700,
      soundEnabled: true,
      vibrationEnabled: true,
      notificationsEnabled: true,
      cooldownSeconds: 15,
      ...settings,
    };
  }

  public getSettings(): AlertSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<AlertSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  public getState(): AlertEngineState {
    return this.state;
  }

  public getActiveAlert(): AlertRecord | null {
    return this.activeAlert;
  }

  public onStateChange(listener: AlertStateChangeListener) {
    this.listeners.push(listener);
  }

  public setOnAlertCreated(cb: (alert: AlertRecord) => void) {
    this.onAlertCreatedCallback = cb;
  }

  public setOnAlertResolved(cb: (alert: AlertRecord) => void) {
    this.onAlertResolvedCallback = cb;
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state, this.activeAlert));
  }

  /**
   * Process a new incoming reading through the safety state machine
   */
  public processReading(reading: SensorReading) {
    const gas = reading.gas;
    const now = Date.now();

    // 1. DANGER CONDITION
    if (gas >= this.settings.dangerThreshold) {
      if (this.state !== 'DANGER' && this.state !== 'ALERT_ACTIVE' && this.state !== 'ACKNOWLEDGED') {
        // Check cooldown from last alert to prevent rapid oscillating alerts
        const cooldownRemaining = (now - this.lastAlertEndedAt) / 1000;
        if (this.lastAlertEndedAt > 0 && cooldownRemaining < this.settings.cooldownSeconds) {
          // Cooldown active, stay in warning or log without spamming alarms
          this.state = 'WARNING';
          this.notify();
          return;
        }

        // Trigger New Danger Alert
        this.state = 'ALERT_ACTIVE';
        const newAlert: AlertRecord = {
          id: `alert-${now}-${Math.floor(Math.random() * 1000)}`,
          deviceId: reading.deviceId || 'GAS-001',
          type: 'GAS_LEAK',
          severity: 'danger',
          gasValue: gas,
          startedAt: new Date(now).toISOString(),
          status: 'active',
        };
        this.activeAlert = newAlert;

        // Alarm actions
        if (this.settings.soundEnabled) {
          audioAlarm.startSiren();
        }
        if (this.settings.vibrationEnabled) {
          notificationService.startVibrationPattern();
        }
        if (this.settings.notificationsEnabled) {
          notificationService.showSystemNotification(
            '🚨 CRITICAL GAS LEAK ALERT',
            `Elevated gas reading detected (${gas}). Evacuate area and shut off main gas valve!`,
            true
          );
        }

        if (this.onAlertCreatedCallback) {
          this.onAlertCreatedCallback(newAlert);
        }

        this.notify();
      } else if (this.activeAlert) {
        // Update peak gas value
        if (gas > this.activeAlert.gasValue) {
          this.activeAlert.gasValue = gas;
        }
      }
      return;
    }

    // 2. WARNING CONDITION (between warning and danger)
    if (gas >= this.settings.warningThreshold && gas < this.settings.dangerThreshold) {
      if (this.state === 'ALERT_ACTIVE' || this.state === 'DANGER') {
        // Still in active danger alert until acknowledged or recovered below warning
        return;
      }

      if (this.state === 'ACKNOWLEDGED') {
        // Remains acknowledged until fully safe
        return;
      }

      if (this.state !== 'WARNING') {
        this.state = 'WARNING';
        audioAlarm.playBeep(600, 200);
        this.notify();
      }
      return;
    }

    // 3. SAFE RECOVERY CONDITION (below warning threshold with hysteresis buffer)
    if (gas < this.settings.warningThreshold - 20 || (gas < this.settings.warningThreshold && this.state !== 'SAFE')) {
      if (this.state === 'ALERT_ACTIVE' || this.state === 'DANGER' || this.state === 'ACKNOWLEDGED') {
        // Resolve active alert
        if (this.activeAlert) {
          const endedIso = new Date(now).toISOString();
          const startMs = new Date(this.activeAlert.startedAt).getTime();
          const durationSec = Math.round((now - startMs) / 1000);

          const resolvedAlert: AlertRecord = {
            ...this.activeAlert,
            endedAt: endedIso,
            durationSeconds: Math.max(1, durationSec),
            status: 'resolved',
          };

          this.lastAlertEndedAt = now;
          if (this.onAlertResolvedCallback) {
            this.onAlertResolvedCallback(resolvedAlert);
          }
          this.activeAlert = null;
        }

        // Stop sirens
        audioAlarm.stopSiren();
        notificationService.stopVibration();
      }

      if (this.state !== 'SAFE') {
        this.state = 'SAFE';
        this.notify();
      }
    }
  }

  /**
   * User acknowledges the active emergency alert.
   * Silences audible alarms and vibration, but maintains safety notice until readings normalize.
   */
  public acknowledgeAlert() {
    if (this.state === 'ALERT_ACTIVE' || this.state === 'DANGER') {
      this.state = 'ACKNOWLEDGED';
      audioAlarm.stopSiren();
      notificationService.stopVibration();

      if (this.activeAlert) {
        this.activeAlert.acknowledgedAt = new Date().toISOString();
        this.activeAlert.status = 'acknowledged';
      }

      this.notify();
    }
  }
}

export const alertEngine = new AlertEngine();
