import { createClient } from '@supabase/supabase-js';

// Helper to parse JSON body across different runtime environments
async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: any, res: any) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    // Health check endpoint
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'GasGuard Device Telemetry Ingestion API' }));
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  try {
    const body = await parseBody(req);

    // 2. Validate API key if configured
    const configuredApiKey = process.env.DEVICE_API_KEY;
    if (configuredApiKey) {
      const providedKey = req.headers['x-api-key'] || body.apiKey || body.api_key;
      if (providedKey !== configuredApiKey) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid device API key' }));
        return;
      }
    }

    // 3. Validate device_id & gas_value
    const rawDeviceId = body.device_id || body.deviceId || body.id;
    if (!rawDeviceId || typeof rawDeviceId !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Validation Error: device_id is required and must be a string (e.g. GAS-000001)' }));
      return;
    }

    // Normalize device ID (e.g. GAS-000001)
    const normalizeDeviceId = (id: string): string => {
      const clean = id.trim().toUpperCase();
      const match = clean.match(/^GAS-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        return `GAS-${String(num).padStart(6, '0')}`;
      }
      return clean;
    };

    const deviceId = normalizeDeviceId(rawDeviceId);

    const rawGasValue = body.gas_value !== undefined 
      ? body.gas_value 
      : body.gasValue !== undefined 
      ? body.gasValue 
      : body.gas;

    if (rawGasValue === undefined || isNaN(Number(rawGasValue))) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Validation Error: gas_value is required and must be a valid number' }));
      return;
    }

    const gasValue = Math.max(0, Math.round(Number(rawGasValue)));
    const nowIso = body.timestamp 
      ? new Date(body.timestamp).toISOString() 
      : body.recorded_at 
      ? new Date(body.recorded_at).toISOString() 
      : new Date().toISOString();

    // 4. Connect to Supabase using server-side keys
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Server configuration error: Supabase URL or key not configured in environment.' 
      }));
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // 5. Fetch configurable thresholds (from device_settings)
    let warningThreshold = 400;
    let alertThreshold = 700;

    try {
      const { data: settingsData } = await supabase
        .from('device_settings')
        .select('*')
        .or(`device_id.eq.${deviceId},id.eq.global`)
        .order('device_id', { ascending: false, nullsFirst: false })
        .limit(1);

      if (settingsData && settingsData.length > 0) {
        warningThreshold = settingsData[0].warning_threshold ?? 400;
        alertThreshold = settingsData[0].alert_threshold ?? 700;
      }
    } catch (e) {
      console.warn('[API] Could not fetch settings, using defaults (400/700):', e);
    }

    // 6. Calculate gas status on backend
    let status: 'NORMAL' | 'WARNING' | 'ALERT' = 'NORMAL';
    if (gasValue >= alertThreshold) {
      status = 'ALERT';
    } else if (gasValue >= warningThreshold) {
      status = 'WARNING';
    } else {
      status = 'NORMAL';
    }

    // 7. Find existing device using device_id (exact or normalized)
    let deviceRecord: { id: string; name: string } | null = null;

    const { data: exactDevice } = await supabase
      .from('devices')
      .select('id, name')
      .eq('id', deviceId)
      .maybeSingle();

    if (exactDevice) {
      deviceRecord = exactDevice;
    } else {
      // Check if any registered device matches normalized ID
      const { data: allDevices } = await supabase
        .from('devices')
        .select('id, name');

      if (allDevices && allDevices.length > 0) {
        const matched = allDevices.find(
          (d) => normalizeDeviceId(d.id) === deviceId
        );
        if (matched) {
          deviceRecord = matched;
        } else if (allDevices.length === 1) {
          // If only 1 device is registered (e.g. Kitchen), associate with this permanent hardware node
          deviceRecord = allDevices[0];
        }
      }
    }

    let deviceName = 'Kitchen';

    if (!deviceRecord) {
      // Auto-provision new hardware device if none exists
      deviceName = 'Kitchen';
      const { data: created } = await supabase.from('devices').insert({
        id: deviceId,
        name: deviceName,
        location: 'Kitchen - Main Area',
        device_type: 'ESP32',
        connection_type: 'wifi-http',
        status: 'online',
        last_seen: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      }).select('id, name').single();

      if (created) {
        deviceRecord = created;
        deviceName = created.name;
      }

      await supabase.from('device_events').insert({
        device_id: deviceId,
        event_type: 'DEVICE_REGISTERED',
        message: `Device ${deviceId} registered automatically via ESP32 telemetry ingestion.`,
        created_at: nowIso,
      });
    } else {
      // Update existing device - PRESERVE its existing name!
      deviceName = deviceRecord.name || 'Kitchen';
      await supabase.from('devices').update({
        last_seen: nowIso,
        status: 'online',
        updated_at: nowIso,
      }).eq('id', deviceRecord.id);
    }

    const targetDeviceId = deviceRecord ? deviceRecord.id : deviceId;

    // 8. Store gas reading
    const { error: readingError } = await supabase.from('gas_readings').insert({
      device_id: targetDeviceId,
      gas_value: gasValue,
      status: status,
      recorded_at: nowIso,
    });

    if (readingError) {
      console.error('[API] Failed to insert gas reading:', readingError);
    }

    // 9. Alert Management Logic
    if (status === 'ALERT') {
      // Check if an unresolved active alert already exists for this device
      const { data: activeAlerts } = await supabase
        .from('alerts')
        .select('id, gas_value')
        .eq('device_id', targetDeviceId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!activeAlerts || activeAlerts.length === 0) {
        // Create new alert
        const alertId = `alt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const severity = gasValue >= alertThreshold + 300 ? 'CRITICAL' : 'HIGH';
        const message = `Hazardous gas concentration detected (${gasValue} ADC). Alert threshold (${alertThreshold}) exceeded.`;

        await supabase.from('alerts').insert({
          id: alertId,
          device_id: targetDeviceId,
          gas_value: gasValue,
          alert_type: 'GAS_LEAK',
          severity: severity,
          message: message,
          acknowledged: false,
          created_at: nowIso,
        });

        await supabase.from('device_events').insert({
          device_id: targetDeviceId,
          event_type: 'ALERT_TRIGGERED',
          message: message,
          created_at: nowIso,
        });
      } else {
        // Update peak gas value if current reading is higher
        const currentActive = activeAlerts[0];
        if (gasValue > currentActive.gas_value) {
          await supabase.from('alerts').update({
            gas_value: gasValue,
          }).eq('id', currentActive.id);
        }
      }
    } else if (status === 'NORMAL') {
      // Auto-resolve any pending active alerts when gas levels normalize
      const { data: unresolvedAlerts } = await supabase
        .from('alerts')
        .select('id')
        .eq('device_id', targetDeviceId)
        .is('resolved_at', null);

      if (unresolvedAlerts && unresolvedAlerts.length > 0) {
        for (const al of unresolvedAlerts) {
          await supabase.from('alerts').update({
            resolved_at: nowIso,
          }).eq('id', al.id);
        }

        await supabase.from('device_events').insert({
          device_id: targetDeviceId,
          event_type: 'ALERT_RESOLVED',
          message: `Gas concentration normalized to safe baseline (${gasValue} ADC).`,
          created_at: nowIso,
        });
      }
    }

    // 10. Return success response with all required fields (Requirement 5 & 12)
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      device_id: targetDeviceId,
      deviceId: targetDeviceId,
      name: deviceName,
      device_name: deviceName,
      deviceName: deviceName,
      gas_value: gasValue,
      gasValue: gasValue,
      status: status,
      gas_status: status,
      gasStatus: status,
      last_seen: nowIso,
      lastSeen: nowIso,
      connection_status: 'online',
      connectionStatus: 'online',
      is_online: true,
      isOnline: true,
      thresholds: {
        warning: warningThreshold,
        alert: alertThreshold,
      },
      recorded_at: nowIso,
    }));

  } catch (error: any) {
    console.error('[API] Unexpected error processing telemetry:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error?.message || 'Failed to process device telemetry',
    }));
  }
}
