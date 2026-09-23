-- ==============================================================================
-- GasGuard Supabase / PostgreSQL Production Schema & Realtime Setup
-- ==============================================================================

-- 1. Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id TEXT PRIMARY KEY,                       -- e.g. 'GAS-000001'
    name TEXT NOT NULL DEFAULT 'Gas Detector Node',
    location TEXT DEFAULT 'Kitchen',
    device_type TEXT NOT NULL DEFAULT 'ESP32',  -- 'ESP32' | 'ArduinoUno'
    connection_type TEXT NOT NULL DEFAULT 'wifi-http',
    status TEXT NOT NULL DEFAULT 'offline',    -- 'online' | 'offline' | 'warning' | 'alert'
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for device lookups & heartbeats
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON public.devices(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_devices_created_at ON public.devices(created_at DESC);

-- 2. Gas Readings Table (Time-series telemetry from MQ-6 sensor via ESP32)
CREATE TABLE IF NOT EXISTS public.gas_readings (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    gas_value INT NOT NULL,                    -- Raw ADC / sensor reading (0-1023 or 0-4095)
    status TEXT NOT NULL DEFAULT 'NORMAL',     -- 'NORMAL' | 'WARNING' | 'ALERT'
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for time-series charts and queries
CREATE INDEX IF NOT EXISTS idx_readings_device_recorded ON public.gas_readings(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_recorded_at ON public.gas_readings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_status ON public.gas_readings(status);

-- 3. Alerts Table (Hazardous gas leaks & security incidents)
CREATE TABLE IF NOT EXISTS public.alerts (
    id TEXT PRIMARY KEY,                       -- e.g. 'alt-1727100000-xyz' or UUID
    device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    gas_value INT NOT NULL,
    alert_type TEXT NOT NULL DEFAULT 'GAS_LEAK',
    severity TEXT NOT NULL DEFAULT 'HIGH',     -- 'WARNING' | 'HIGH' | 'CRITICAL'
    message TEXT NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_device_created ON public.alerts(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON public.alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_at ON public.alerts(resolved_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- 4. Device Events Table (Heartbeats, connection changes, threshold crossings)
CREATE TABLE IF NOT EXISTS public.device_events (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,                  -- 'HEARTBEAT' | 'STATUS_CHANGE' | 'ALERT_TRIGGERED' | 'DEVICE_REGISTERED'
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_device_created ON public.device_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.device_events(created_at DESC);

-- 5. Device Settings Table (Configurable thresholds and heartbeat rules)
CREATE TABLE IF NOT EXISTS public.device_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',      -- 'global' or device_id for device-specific overrides
    device_id TEXT REFERENCES public.devices(id) ON DELETE CASCADE,
    warning_threshold INT NOT NULL DEFAULT 400,
    alert_threshold INT NOT NULL DEFAULT 700,
    heartbeat_timeout_seconds INT NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial global settings
INSERT INTO public.device_settings (id, device_id, warning_threshold, alert_threshold, heartbeat_timeout_seconds)
VALUES ('global', NULL, 400, 700, 60)
ON CONFLICT (id) DO NOTHING;

-- Seed default initial demo devices if none exist (for initial out-of-the-box readiness)
INSERT INTO public.devices (id, name, location, device_type, connection_type, status, last_seen)
VALUES 
    ('GAS-000001', 'Kitchen Range Detector', 'Kitchen - Main Counter', 'ESP32', 'wifi-http', 'online', NOW()),
    ('GAS-000002', 'Utility Gas Boiler Sensor', 'Basement Utility Room', 'ESP32', 'wifi-http', 'online', NOW() - INTERVAL '15 seconds'),
    ('GAS-000003', 'Storage Cylinder Monitor', 'Outdoor Cylinder Shed', 'ESP32', 'wifi-http', 'offline', NOW() - INTERVAL '10 minutes')
ON CONFLICT (id) DO NOTHING;

-- Seed initial baseline readings for the devices
INSERT INTO public.gas_readings (device_id, gas_value, status, recorded_at)
VALUES 
    ('GAS-000001', 185, 'NORMAL', NOW() - INTERVAL '30 seconds'),
    ('GAS-000001', 210, 'NORMAL', NOW() - INTERVAL '10 seconds'),
    ('GAS-000002', 290, 'NORMAL', NOW() - INTERVAL '40 seconds'),
    ('GAS-000002', 315, 'NORMAL', NOW() - INTERVAL '15 seconds'),
    ('GAS-000003', 140, 'NORMAL', NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- Seed an initial event
INSERT INTO public.device_events (device_id, event_type, message, created_at)
VALUES 
    ('GAS-000001', 'DEVICE_REGISTERED', 'Device GAS-000001 provisioned to Kitchen Range Detector', NOW() - INTERVAL '1 hour'),
    ('GAS-000002', 'DEVICE_REGISTERED', 'Device GAS-000002 provisioned to Utility Gas Boiler Sensor', NOW() - INTERVAL '1 hour'),
    ('GAS-000003', 'DEVICE_REGISTERED', 'Device GAS-000003 provisioned to Storage Cylinder Monitor', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- (Authentication is NOT required at this stage; enable public read/write access)
-- ==============================================================================
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_settings ENABLE ROW LEVEL SECURITY;

-- Allow anon & service_role all operations
CREATE POLICY "Public access devices" ON public.devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access gas_readings" ON public.gas_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access alerts" ON public.alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access device_events" ON public.device_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access device_settings" ON public.device_settings FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- Supabase Realtime Publication
-- ==============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gas_readings;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_events;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;
