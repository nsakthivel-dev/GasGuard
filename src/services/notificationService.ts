// Vibration & Browser Notification Service

class NotificationService {
  private vibrationInterval: number | null = null;

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        return await Notification.requestPermission();
      } catch (e) {
        console.warn('Failed to request notification permission', e);
        return 'denied';
      }
    }
    return 'denied';
  }

  public getNotificationPermission(): NotificationPermission {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  public showSystemNotification(title: string, body: string, isCritical: boolean = false) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/gas-icon-192.png',
          badge: '/gas-icon-192.png',
          requireInteraction: isCritical,
          tag: isCritical ? 'gas-alert' : 'gas-info',
        });
      } catch (err) {
        console.warn('Error showing system notification:', err);
      }
    }
  }

  public startVibrationPattern() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        // [vibrate 500ms, pause 250ms, vibrate 500ms, pause 500ms]
        navigator.vibrate([500, 250, 500, 500]);
        if (!this.vibrationInterval) {
          this.vibrationInterval = window.setInterval(() => {
            navigator.vibrate([500, 250, 500, 500]);
          }, 2000);
        }
      } catch {
        // Ignore vibration error
      }
    }
  }

  public stopVibration() {
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
  }
}

export const notificationService = new NotificationService();
