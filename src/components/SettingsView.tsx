import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Volume2, 
  Smartphone, 
  Sliders, 
  ShieldCheck, 
  Download, 
  Trash2, 
  Database, 
  Info, 
  Check, 
  Save, 
  Sun, 
  Moon, 
  Monitor,
  Play,
  Share2,
  Code2,
  Copy,
  CheckCircle2,
  Radio,
  Server
} from 'lucide-react';
import { AlertSettings, SensorReading, AlertRecord, DeviceSettings } from '../types';
import { audioAlarm } from '../services/audioAlarm';
import { notificationService } from '../services/notificationService';
import { 
  getStoredSupabaseConfig, 
  saveStoredSupabaseConfig, 
  resetSupabaseClient,
  fetchDeviceSettings,
  saveDeviceSettings,
  isSupabaseConfigured
} from '../lib/supabase';

interface SettingsViewProps {
  settings: AlertSettings;
  onUpdateSettings: (newSettings: Partial<AlertSettings>) => void;
  readings: SensorReading[];
  alerts: AlertRecord[];
  onClearHistory: () => void;
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  onRefresh?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  readings,
  alerts,
  onClearHistory,
  theme,
  setTheme,
  onRefresh,
}) => {
  const [warningThreshold, setWarningThreshold] = useState(settings.warningThreshold);
  const [dangerThreshold, setDangerThreshold] = useState(settings.dangerThreshold);
  const [heartbeatTimeout, setHeartbeatTimeout] = useState(settings.heartbeatTimeoutSeconds || 60);
  const [cooldown, setCooldown] = useState(settings.cooldownSeconds);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [thresholdSavedSuccess, setThresholdSavedSuccess] = useState(false);

  // Supabase Config state
  const currentSupa = getStoredSupabaseConfig();
  const [supaUrl, setSupaUrl] = useState(currentSupa.url);
  const [supaKey, setSupaKey] = useState(currentSupa.key);
  const [supaSaved, setSupaSaved] = useState(false);
  const [isSupaConfigured, setIsSupaConfigured] = useState(isSupabaseConfigured());

  // Notification permission
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    notificationService.getNotificationPermission()
  );

  // Copy snippet state
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Load cloud settings on mount
  useEffect(() => {
    fetchDeviceSettings().then((cloudSettings) => {
      if (cloudSettings) {
        setWarningThreshold(cloudSettings.warning_threshold);
        setDangerThreshold(cloudSettings.alert_threshold);
        setHeartbeatTimeout(cloudSettings.heartbeat_timeout_seconds);
      }
    });
  }, []);

  const handleSaveThresholds = async () => {
    setIsSavingThresholds(true);
    try {
      // 1. Save to Supabase device_settings
      await saveDeviceSettings({
        id: 'global',
        warning_threshold: warningThreshold,
        alert_threshold: dangerThreshold,
        heartbeat_timeout_seconds: heartbeatTimeout,
      });

      // 2. Update local alert engine
      onUpdateSettings({
        warningThreshold,
        dangerThreshold,
        cooldownSeconds: cooldown,
        heartbeatTimeoutSeconds: heartbeatTimeout,
      });

      setThresholdSavedSuccess(true);
      setTimeout(() => setThresholdSavedSuccess(false), 3000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert('Failed to save thresholds to Supabase: ' + err.message);
    } finally {
      setIsSavingThresholds(false);
    }
  };

  const handleTestSiren = () => {
    audioAlarm.unlockAudio();
    audioAlarm.startSiren();
    setTimeout(() => {
      audioAlarm.stopSiren();
    }, 2500);
  };

  const handleRequestNotif = async () => {
    const perm = await notificationService.requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === 'granted') {
      onUpdateSettings({ notificationsEnabled: true });
      notificationService.showSystemNotification(
        'GasGuard Notifications Active',
        'You will receive instant alerts when elevated gas is detected.'
      );
    }
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSupabaseConfig(supaUrl, supaKey);
    resetSupabaseClient();
    setIsSupaConfigured(isSupabaseConfigured());
    setSupaSaved(true);
    setTimeout(() => setSupaSaved(false), 3000);
    if (onRefresh) onRefresh();
  };

  const sampleCurl = `curl -X POST "https://your-domain.vercel.app/api/device/data" \\
  -H "Content-Type: application/json" \\
  -d '{"device_id": "GAS-000001", "gas_value": 820}'`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-24 lg:pb-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2">
          <Sliders className="w-6 h-6 text-amber-400" />
          System Configuration & Sensor Thresholds
        </h2>
        <p className="text-xs text-slate-400">
          Tune gas concentration trigger limits, device heartbeats, and view ESP32 API integration instructions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ============================================================== */}
        {/* CARD 1: Configurable Gas Safety Thresholds                     */}
        {/* ============================================================== */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-100">MQ-6 Gas Thresholds</h3>
                <p className="text-[11px] text-slate-400">Stored in Supabase `device_settings`</p>
              </div>
            </div>

            {thresholdSavedSuccess && (
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved to Cloud
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs">
            {/* Warning Threshold Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-amber-400">WARNING Threshold (Elevated)</span>
                <span className="font-mono text-slate-200">{warningThreshold} ADC</span>
              </div>
              <input
                type="range"
                min="100"
                max="600"
                step="10"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                NORMAL baseline: 0 - {warningThreshold} ADC. Triggers advisory warning above {warningThreshold}.
              </span>
            </div>

            {/* Alert / Danger Threshold Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-red-400">ALERT Threshold (Critical Leak)</span>
                <span className="font-mono text-slate-200">{dangerThreshold} ADC</span>
              </div>
              <input
                type="range"
                min="500"
                max="950"
                step="10"
                value={dangerThreshold}
                onChange={(e) => setDangerThreshold(Number(e.target.value))}
                className="w-full accent-red-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                ALERT level: &gt;= {dangerThreshold} ADC. Automatically registers alert record in Supabase.
              </span>
            </div>

            {/* Device Heartbeat Timeout */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between font-bold">
                <span className="text-slate-300">Device Offline Heartbeat Timeout</span>
                <span className="font-mono text-amber-400">{heartbeatTimeout} seconds</span>
              </div>
              <input
                type="range"
                min="20"
                max="300"
                step="10"
                value={heartbeatTimeout}
                onChange={(e) => setHeartbeatTimeout(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Marks an ESP32 as OFFLINE if no telemetry is received for {heartbeatTimeout} seconds.
              </span>
            </div>

            <button
              onClick={handleSaveThresholds}
              disabled={isSavingThresholds}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingThresholds ? 'Saving to Database...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CARD 2: Audible Alarms & Notifications                         */}
        {/* ============================================================== */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">Emergency Feedback & Siren</h3>
              <p className="text-[11px] text-slate-400">Audible buzzer and web push notifications</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div>
                <span className="font-bold text-slate-200 block">Audible High-Pitch Siren</span>
                <span className="text-[10px] text-slate-500">Dual-tone buzzer simulation in browser</span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Vibration Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div>
                <span className="font-bold text-slate-200 block">Mobile Vibration Feedback</span>
                <span className="text-[10px] text-slate-500">Haptic pulsing when gas alert triggers</span>
              </div>
              <input
                type="checkbox"
                checked={settings.vibrationEnabled}
                onChange={(e) => onUpdateSettings({ vibrationEnabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Test Siren Button */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleTestSiren}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                Test Emergency Siren (2.5s)
              </button>

              <button
                onClick={handleRequestNotif}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl"
                title="Request push notification permissions"
              >
                {notifPerm === 'granted' ? 'Notifs Active' : 'Enable Push'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ============================================================== */}
      {/* 2. ESP32 TELEMETRY INGESTION API GUIDE                         */}
      {/* ============================================================== */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">ESP32 Telemetry Ingestion API</h3>
              <p className="text-[11px] text-slate-400">Vercel Serverless Function: `POST /api/device/data`</p>
            </div>
          </div>

          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedSnippet ? 'Copied' : 'Copy cURL'}
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <p className="text-slate-400 leading-relaxed">
            Your ESP32 firmware transmits analog readings from the MQ-6 sensor to this endpoint. The serverless function validates the device ID, saves the reading into Supabase <code className="text-amber-400">gas_readings</code>, updates the device heartbeat in <code className="text-amber-400">devices</code>, and creates an alert when exceeding {dangerThreshold} ADC.
          </p>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
            <pre>{sampleCurl}</pre>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
              <span className="font-bold text-slate-300 block">Expected JSON Payload:</span>
              <code className="text-slate-400 block font-mono text-[10px]">
                {`{ "device_id": "GAS-000001", "gas_value": 820 }`}
              </code>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
              <span className="font-bold text-slate-300 block">Backend Response:</span>
              <code className="text-emerald-400 block font-mono text-[10px]">
                {`{ "success": true, "status": "ALERT", "gas_value": 820 }`}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. SUPABASE CLOUD CONNECTION SETTINGS                          */}
      {/* ============================================================== */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">Supabase Connection Settings</h3>
              <p className="text-[11px] text-slate-400">PostgreSQL database & Realtime stream link</p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
            isSupaConfigured
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSupaConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {isSupaConfigured ? 'Connected' : 'Missing Env'}
          </span>
        </div>

        <form onSubmit={handleSaveSupabase} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              placeholder="https://your-project.supabase.co"
              value={supaUrl}
              onChange={(e) => setSupaUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Supabase Public Anon Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supaKey}
              onChange={(e) => setSupaKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-slate-500">
              Values in .env take precedence in production.
            </span>

            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow transition"
            >
              {supaSaved ? 'Saved!' : 'Save Supabase Config'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
