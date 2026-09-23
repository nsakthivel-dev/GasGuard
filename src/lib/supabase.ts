import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { 
  AlertRecord, 
  AlertSettings, 
  DeviceInfo, 
  DeviceRecord, 
  DeviceEvent, 
  DeviceSettings, 
  DashboardStats, 
  SensorReading, 
  GasStatus 
} from '../types';

const STORAGE_KEY_URL = 'gasguard_supabase_url';
const STORAGE_KEY_KEY = 'gasguard_supabase_key';

export function getStoredSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const customUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : null;
  const customKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : null;

  return {
    url: customUrl || envUrl || '',
    key: customKey || envKey || '',
  };
}

export function saveStoredSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (key) localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY_KEY);
  }
}

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const { url, key } = getStoredSupabaseConfig();
  return Boolean(url && key && url.startsWith('http'));
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseConfig();
  if (!url || !key) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (e) {
      console.warn('[Supabase] Failed to initialize Supabase client:', e);
      return null;
    }
  }

  return clientInstance;
}

export function resetSupabaseClient() {
  clientInstance = null;
}

/**
 * Computes whether a device is currently ONLINE based on its last_seen heartbeat timestamp
 */
export function isDeviceOnline(lastSeen?: string | null, timeoutSeconds: number = 60): boolean {
  if (!lastSeen) return false;
  const lastTime = new Date(lastSeen).getTime();
  if (isNaN(lastTime)) return false;
  return Date.now() - lastTime <= timeoutSeconds * 1000;
}

// ==============================================================================
// 1. Device Operations
// ==============================================================================

export async function fetchDevices(timeoutSeconds: number = 60): Promise<DeviceRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data: devicesData, error } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !devicesData) {
      console.warn('[Supabase] fetchDevices error:', error);
      return [];
    }

    // Get the most recent reading for each device
    const { data: latestReadings } = await supabase
      .from('gas_readings')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(50);

    const readingMap = new Map<string, any>();
    if (latestReadings) {
      for (const r of latestReadings) {
        if (!readingMap.has(r.device_id)) {
          readingMap.set(r.device_id, r);
        }
      }
    }

    return devicesData.map((d: any) => {
      const isOnline = isDeviceOnline(d.last_seen, timeoutSeconds);
      const latest = readingMap.get(d.id);

      return {
        id: d.id,
        name: d.name,
        location: d.location || 'Unassigned',
        device_type: d.device_type || 'ESP32',
        connection_type: d.connection_type || 'wifi-http',
        status: isOnline ? 'online' : 'offline',
        last_seen: d.last_seen,
        created_at: d.created_at,
        updated_at: d.updated_at,
        isOnlineComputed: isOnline,
        currentGas: latest ? latest.gas_value : undefined,
        currentStatus: latest ? latest.status : undefined,
        latestReading: latest ? {
          id: latest.id,
          gas: latest.gas_value,
          status: latest.status,
          timestamp: new Date(latest.recorded_at).getTime(),
          recorded_at: latest.recorded_at,
          deviceId: latest.device_id,
        } : null,
      };
    });
  } catch (err) {
    console.error('[Supabase] Failed to fetch devices:', err);
    return [];
  }
}

export async function createDevice(device: { id: string; name: string; location?: string; device_type?: string }) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client is not configured');

  const now = new Date().toISOString();
  const cleanId = device.id.trim().toUpperCase();

  const { data, error } = await supabase.from('devices').insert({
    id: cleanId,
    name: device.name.trim(),
    location: device.location?.trim() || 'General Area',
    device_type: device.device_type || 'ESP32',
    connection_type: 'wifi-http',
    status: 'offline',
    created_at: now,
    updated_at: now,
  }).select().single();

  if (error) {
    throw error;
  }

  // Record audit event
  await supabase.from('device_events').insert({
    device_id: cleanId,
    event_type: 'DEVICE_REGISTERED',
    message: `New detector node ${cleanId} added: ${device.name}`,
    created_at: now,
  });

  return data;
}

export async function updateDevice(id: string, updates: Partial<DeviceRecord>) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client is not configured');

  const now = new Date().toISOString();
  const { data, error } = await supabase.from('devices').update({
    ...updates,
    updated_at: now,
  }).eq('id', id).select().single();

  if (error) throw error;
  return data;
}

export async function deleteDevice(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase.from('devices').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ==============================================================================
// 2. Gas Readings & Telemetry
// ==============================================================================

export async function fetchDeviceReadings(
  deviceId?: string, 
  limit: number = 200, 
  hours?: number
): Promise<SensorReading[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from('gas_readings')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (deviceId && deviceId !== 'ALL') {
      query = query.eq('device_id', deviceId);
    }

    if (hours && hours > 0) {
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      query = query.gte('recorded_at', since);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Return in ascending time order for charting
    return data.reverse().map((r: any) => ({
      id: r.id,
      gas: r.gas_value,
      gas_value: r.gas_value,
      status: r.status as GasStatus,
      timestamp: new Date(r.recorded_at).getTime(),
      recorded_at: r.recorded_at,
      deviceId: r.device_id,
      device_id: r.device_id,
    }));
  } catch {
    return [];
  }
}

export async function persistReadingToCloud(reading: SensorReading) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const devId = reading.deviceId || reading.device_id || 'GAS-000001';
    const nowIso = reading.recorded_at || new Date(reading.timestamp || Date.now()).toISOString();

    const { error } = await supabase.from('gas_readings').insert({
      device_id: devId,
      gas_value: reading.gas,
      status: reading.status || (reading.gas >= 700 ? 'ALERT' : reading.gas >= 400 ? 'WARNING' : 'NORMAL'),
      recorded_at: nowIso,
    });

    // Update last_seen on device
    await supabase.from('devices').update({
      last_seen: nowIso,
      status: 'online',
    }).eq('id', devId);

    return !error;
  } catch {
    return false;
  }
}

export async function persistAlertToCloud(alert: AlertRecord): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('alerts').upsert({
      id: alert.id,
      device_id: alert.deviceId || alert.device_id || 'GAS-000001',
      gas_value: alert.gasValue ?? alert.gas_value ?? 0,
      alert_type: alert.type || 'GAS_LEAK',
      severity: alert.severity || 'HIGH',
      message: alert.message || 'Gas alert triggered.',
      acknowledged: alert.acknowledged || false,
      resolved_at: alert.resolved_at || alert.endedAt || null,
      created_at: alert.startedAt || alert.created_at || new Date().toISOString(),
    }, { onConflict: 'id' });

    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// 3. Alerts Management
// ==============================================================================

export async function fetchAlertsFromCloud(options?: {
  deviceId?: string;
  status?: string;
  limit?: number;
}): Promise<AlertRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit || 100);

    if (options?.deviceId && options.deviceId !== 'ALL') {
      query = query.eq('device_id', options.deviceId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row: any) => {
      let alertStatus: 'active' | 'acknowledged' | 'resolved' = 'active';
      if (row.resolved_at) {
        alertStatus = 'resolved';
      } else if (row.acknowledged) {
        alertStatus = 'acknowledged';
      }

      return {
        id: row.id,
        deviceId: row.device_id,
        device_id: row.device_id,
        type: row.alert_type || 'GAS_LEAK',
        severity: row.severity,
        gasValue: row.gas_value,
        gas_value: row.gas_value,
        message: row.message,
        startedAt: row.created_at,
        created_at: row.created_at,
        endedAt: row.resolved_at ?? undefined,
        resolved_at: row.resolved_at ?? undefined,
        acknowledged: row.acknowledged,
        status: alertStatus,
      };
    });
  } catch {
    return [];
  }
}

export async function acknowledgeAlertInCloud(alertId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('alerts').update({
      acknowledged: true,
    }).eq('id', alertId);

    return !error;
  } catch {
    return false;
  }
}

export async function resolveAlertInCloud(alertId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('alerts').update({
      resolved_at: new Date().toISOString(),
    }).eq('id', alertId);

    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// 4. Device Events
// ==============================================================================

export async function fetchDeviceEvents(options?: {
  deviceId?: string;
  limit?: number;
}): Promise<DeviceEvent[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from('device_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50);

    if (options?.deviceId && options.deviceId !== 'ALL') {
      query = query.eq('device_id', options.deviceId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

// ==============================================================================
// 5. Configurable Settings
// ==============================================================================

export async function fetchDeviceSettings(deviceId?: string): Promise<DeviceSettings> {
  const defaultSettings: DeviceSettings = {
    id: 'global',
    device_id: null,
    warning_threshold: 400,
    alert_threshold: 700,
    heartbeat_timeout_seconds: 60,
  };

  const supabase = getSupabaseClient();
  if (!supabase) return defaultSettings;

  try {
    let query = supabase
      .from('device_settings')
      .select('*')
      .or(deviceId ? `device_id.eq.${deviceId},id.eq.global` : `id.eq.global`)
      .order('device_id', { ascending: false, nullsFirst: false })
      .limit(1);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return defaultSettings;

    return {
      id: data[0].id,
      device_id: data[0].device_id,
      warning_threshold: data[0].warning_threshold ?? 400,
      alert_threshold: data[0].alert_threshold ?? 700,
      heartbeat_timeout_seconds: data[0].heartbeat_timeout_seconds ?? 60,
      created_at: data[0].created_at,
      updated_at: data[0].updated_at,
    };
  } catch {
    return defaultSettings;
  }
}

export async function saveDeviceSettings(settings: Partial<DeviceSettings>): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const id = settings.id || 'global';
    const { error } = await supabase.from('device_settings').upsert({
      id: id,
      device_id: settings.device_id || null,
      warning_threshold: settings.warning_threshold ?? 400,
      alert_threshold: settings.alert_threshold ?? 700,
      heartbeat_timeout_seconds: settings.heartbeat_timeout_seconds ?? 60,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// 6. Dashboard Stats Overview
// ==============================================================================

export async function fetchDashboardOverview(heartbeatTimeoutSeconds: number = 60): Promise<{
  stats: DashboardStats;
  devices: DeviceRecord[];
  alerts: AlertRecord[];
  events: DeviceEvent[];
}> {
  const devices = await fetchDevices(heartbeatTimeoutSeconds);
  const alerts = await fetchAlertsFromCloud({ limit: 50 });
  const events = await fetchDeviceEvents({ limit: 20 });

  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.isOnlineComputed).length;
  const offlineDevices = totalDevices - onlineDevices;
  const activeAlerts = alerts.filter((a) => a.status === 'active').length;

  return {
    stats: {
      totalDevices,
      onlineDevices,
      offlineDevices,
      activeAlerts,
    },
    devices,
    alerts,
    events,
  };
}

// ==============================================================================
// 7. Supabase Realtime Subscriptions
// ==============================================================================

export function subscribeToRealtime(handlers: {
  onReading?: (reading: SensorReading) => void;
  onDevice?: (device: any) => void;
  onAlert?: (alert: any) => void;
  onEvent?: (event: any) => void;
}): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const channel: RealtimeChannel = supabase.channel('gasguard-telemetry-realtime');

  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gas_readings' },
      (payload) => {
        if (payload.new && handlers.onReading) {
          const row = payload.new as any;
          handlers.onReading({
            id: row.id,
            gas: row.gas_value,
            gas_value: row.gas_value,
            status: row.status,
            timestamp: new Date(row.recorded_at).getTime(),
            recorded_at: row.recorded_at,
            deviceId: row.device_id,
            device_id: row.device_id,
          });
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'devices' },
      (payload) => {
        if (payload.new && handlers.onDevice) {
          handlers.onDevice(payload.new);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'alerts' },
      (payload) => {
        if (payload.new && handlers.onAlert) {
          handlers.onAlert(payload.new);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'device_events' },
      (payload) => {
        if (payload.new && handlers.onEvent) {
          handlers.onEvent(payload.new);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Supabase Realtime] Connected to live telemetry stream');
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

// Compatibility helper for existing code
export async function syncDeviceToCloud(device: DeviceInfo) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('devices').upsert(
      {
        id: device.id,
        name: device.name,
        location: device.location,
        device_type: device.deviceType,
        connection_type: device.connectionType,
        status: device.status,
        last_seen: device.lastSeenAt || new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}
