import React, { useEffect, useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Flame, 
  Thermometer, 
  Droplets, 
  Cpu, 
  Clock, 
  PhoneCall, 
  CheckCircle2, 
  Info,
  PlugZap,
  Activity,
  Wind,
  Radio,
  Sliders,
  Sparkles,
  Server,
  Wifi,
  WifiOff,
  BellRing,
  ArrowRight,
  Plus
} from 'lucide-react';
import { 
  AlertEngineState, 
  AlertRecord, 
  DeviceRecord, 
  DeviceEvent, 
  DashboardStats, 
  SensorReading 
} from '../types';
import { isDeviceOnline, areDeviceIdsEqual } from '../lib/supabase';

interface HomeViewProps {
  devices: DeviceRecord[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  stats: DashboardStats;
  reading: SensorReading | null;
  readingsHistory?: SensorReading[];
  selectedDevice: DeviceRecord | null;
  alertState: AlertEngineState;
  activeAlert: AlertRecord | null;
  alerts: AlertRecord[];
  deviceEvents: DeviceEvent[];
  onAcknowledgeAlert: (alertId?: string) => void;
  onResolveAlert: (alertId: string) => void;
  onNavigateToDevice: () => void;
  onRefresh?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  stats,
  reading,
  readingsHistory = [],
  selectedDevice,
  alertState,
  activeAlert,
  alerts,
  deviceEvents,
  onAcknowledgeAlert,
  onResolveAlert,
  onNavigateToDevice,
}) => {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (reading?.timestamp) {
        setSecondsAgo(Math.floor((Date.now() - reading.timestamp) / 1000));
      } else if (selectedDevice?.last_seen) {
        setSecondsAgo(Math.floor((Date.now() - new Date(selectedDevice.last_seen).getTime()) / 1000));
      } else {
        setSecondsAgo(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reading?.timestamp, selectedDevice?.last_seen]);

  const isOnline = selectedDevice ? Boolean(selectedDevice.isOnlineComputed ?? isDeviceOnline(selectedDevice.last_seen)) : false;
  const hasEverReceivedTelemetry = Boolean(selectedDevice?.last_seen || reading);
  const lastRecordedGas = selectedDevice?.currentGas ?? reading?.gas ?? reading?.gas_value;
  const gasValue = isOnline ? (reading?.gas ?? reading?.gas_value ?? selectedDevice?.currentGas ?? 0) : (lastRecordedGas ?? 0);

  // Determine safety state presentation (never treat offline device as safe or normal)
  const isDanger = isOnline && (alertState === 'ALERT_ACTIVE' || alertState === 'DANGER' || alertState === 'ACKNOWLEDGED' || (selectedDevice?.currentStatus === 'ALERT'));
  const isWarning = isOnline && (alertState === 'WARNING' || (selectedDevice?.currentStatus === 'WARNING'));
  const isSafe = isOnline && !isDanger && !isWarning;

  // Radial gauge angle calculation (0 to 1023 ADC mapped to 0% - 100%)
  const gaugePercent = Math.min(100, Math.max(0, (gasValue / 1000) * 100));
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (gaugePercent / 100) * (circumference * 0.75);

  // Sparkline data for recent 20 readings
  const recentPoints = useMemo(() => {
    if (!readingsHistory || readingsHistory.length === 0) return '';
    const slice = readingsHistory.slice(-20);
    const maxVal = Math.max(800, ...slice.map((s) => s.gas));
    const width = 280;
    const height = 50;

    return slice
      .map((item, idx) => {
        const x = (idx / Math.max(1, slice.length - 1)) * width;
        const y = height - (item.gas / maxVal) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [readingsHistory]);

  const activeAlertsList = useMemo(() => {
    return alerts.filter((a) => a.status === 'active' || a.status === 'acknowledged');
  }, [alerts]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 lg:pb-8">
      
      {/* ============================================================== */}
      {/* 1. TOP STATS CARDS (Production KPIs: TOTAL, ONLINE, OFFLINE, ALERTS) */}
      {/* ============================================================== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Devices */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md relative overflow-hidden transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              TOTAL DEVICES
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/80 text-amber-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-white">
            {stats.totalDevices}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Hardware Nodes</span>
            <span className="text-slate-400">MQ-6 / ESP32</span>
          </div>
        </div>

        {/* Online Devices */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md relative overflow-hidden transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              ONLINE
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-emerald-400 flex items-center gap-2">
            {stats.onlineDevices}
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping-slow" />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Active Heartbeat</span>
            <span className="text-emerald-400 font-semibold font-mono">
              {stats.totalDevices > 0 ? `${Math.round((stats.onlineDevices / stats.totalDevices) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Offline Devices */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md relative overflow-hidden transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              OFFLINE
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-400 flex items-center justify-center">
              <WifiOff className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-slate-400">
            {stats.offlineDevices}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Timeout Exceeded</span>
            <span className="text-slate-500 font-mono">&gt; 60s silent</span>
          </div>
        </div>

        {/* Active Gas Alerts */}
        <div className={`rounded-2xl p-4 sm:p-5 backdrop-blur-md relative overflow-hidden border transition-all ${
          stats.activeAlerts > 0
            ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/40'
            : 'bg-slate-900/80 border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider font-mono ${
              stats.activeAlerts > 0 ? 'text-red-400' : 'text-slate-400'
            }`}>
              ACTIVE ALERTS
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              stats.activeAlerts > 0
                ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                : 'bg-slate-800/80 border border-slate-700/80 text-emerald-400'
            }`}>
              {stats.activeAlerts > 0 ? <BellRing className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
          </div>
          <div className={`mt-2 text-2xl sm:text-3xl font-black font-mono ${
            stats.activeAlerts > 0 ? 'text-red-400 animate-pulse' : 'text-slate-300'
          }`}>
            {stats.activeAlerts}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Combustible Hazard</span>
            <span className={stats.activeAlerts > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              {stats.activeAlerts > 0 ? 'ATTENTION REQUIRED' : 'All Clear'}
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. ACTIVE HAZARD BANNER (When any device reports ALERT)        */}
      {/* ============================================================== */}
      {activeAlertsList.length > 0 && (
        <section className="bg-gradient-to-r from-red-950/80 via-red-900/60 to-slate-900 border-2 border-red-500/80 rounded-3xl p-5 shadow-2xl shadow-red-950/50 space-y-3 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center font-black shrink-0">
                <Flame className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-base">
                    🚨 HAZARDOUS GAS LEAK DETECTED ({activeAlertsList.length} Active)
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500 text-white uppercase">
                    HIGH PRIORITY
                  </span>
                </div>
                <p className="text-xs text-red-200">
                  {activeAlertsList[0].message || 'Sensor reading exceeded safe threshold. Evacuate area immediately.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeAlertsList[0].status === 'active' ? (
                <button
                  onClick={() => onAcknowledgeAlert(activeAlertsList[0].id)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-red-950 font-black text-xs rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-red-600" />
                  ACKNOWLEDGE
                </button>
              ) : (
                <button
                  onClick={() => onResolveAlert(activeAlertsList[0].id)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  RESOLVE ALERT
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* 3. HERO SECTION: Radial Gauge for Focused Device              */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Industrial Safety Hero Card (7 Cols) */}
        <section className={`lg:col-span-7 rounded-3xl p-6 sm:p-8 transition-all duration-300 border relative overflow-hidden backdrop-blur-xl shadow-2xl ${
          !isOnline
            ? 'bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950 border-slate-800/80'
            : isDanger
            ? 'bg-gradient-to-br from-red-950/70 via-slate-950 to-slate-950 border-red-500/80 shadow-red-950/40'
            : isWarning
            ? 'bg-gradient-to-br from-amber-950/60 via-slate-950 to-slate-950 border-amber-500/80 shadow-amber-950/40'
            : 'bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 border-emerald-500/50 shadow-emerald-950/30'
        }`}>
          {/* Subtle Ambient Glow */}
          <div className={`absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-slate-700'
          }`} />

          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            
            {/* Top Node Selector / Status Pill */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className={`px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-2 border ${
                !isOnline
                  ? 'bg-slate-900 text-amber-400 border-amber-500/40'
                  : isDanger
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                  : isWarning
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  !isOnline ? 'bg-amber-400' : isDanger ? 'bg-red-400 animate-ping-slow' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
                }`} />
                {!isOnline ? 'Device communication lost' : isDanger ? 'Hazard Alert Active' : isWarning ? 'Elevated Warning' : 'Atmosphere Secure'}
              </span>

              {selectedDevice && (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                  {selectedDevice.id} • {selectedDevice.name}
                </span>
              )}
            </div>

            {/* Radial SVG Gauge & Value Indicator */}
            <div className="relative flex items-center justify-center my-2">
              <svg className="w-56 h-56 sm:w-64 sm:h-64 -rotate-90 transform" viewBox="0 0 200 200">
                {/* Background Ring Track */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke="#1e293b"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
                  strokeLinecap="round"
                />

                {/* Warning Mark (400) */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke="#f59e0b"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`2 ${circumference - 2}`}
                  strokeDashoffset={circumference - (0.4 * circumference * 0.75)}
                  opacity="0.4"
                />

                {/* Danger Mark (700) */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke="#ef4444"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`2 ${circumference - 2}`}
                  strokeDashoffset={circumference - (0.7 * circumference * 0.75)}
                  opacity="0.6"
                />

                {/* Dynamic Value Ring */}
                {isOnline && (
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    stroke={isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                )}
              </svg>

              {/* Inside Gauge Reading */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  {isOnline ? 'Gas Index' : hasEverReceivedTelemetry ? 'Last Reading' : 'Telemetry Status'}
                </span>
                <span className={`text-5xl sm:text-6xl font-black font-mono tracking-tight my-0.5 ${
                  !isOnline ? 'text-slate-400' : isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-slate-100'
                }`}>
                  {hasEverReceivedTelemetry ? (lastRecordedGas !== undefined ? lastRecordedGas : '--') : '--'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {!hasEverReceivedTelemetry
                    ? 'Waiting for device telemetry'
                    : isOnline
                    ? 'MQ-6 Raw ADC'
                    : secondsAgo !== null
                    ? `Last seen ${secondsAgo}s ago (Offline)`
                    : 'Last received (Offline)'}
                </span>
              </div>
            </div>

            {/* Status Summary & Subtitle */}
            <div className="max-w-md space-y-1">
              <h3 className="text-lg sm:text-xl font-bold text-slate-100">
                {!isOnline ? (
                  selectedDevice ? `${selectedDevice.name} Communication Lost` : 'Device Communication Lost'
                ) : isDanger ? (
                  alertState === 'ACKNOWLEDGED' ? 'Hazard Alert Acknowledged' : 'Hazardous Combustible Gas Level'
                ) : isWarning ? (
                  'Elevated Atmospheric Gas Reading'
                ) : (
                  'Normal Atmospheric Gas Baseline'
                )}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {!isOnline
                  ? (!hasEverReceivedTelemetry
                      ? 'Waiting for device telemetry from ESP32 node GAS-000001.'
                      : `Device communication lost. Local Arduino & servo safety functions operate independently. Last reading: ${lastRecordedGas ?? '--'} ADC (${secondsAgo !== null ? `${secondsAgo}s ago` : 'previously'}).`)
                  : isDanger
                  ? 'Readings exceeded danger safety threshold. Evacuate area and shut off main valve.'
                  : isWarning
                  ? 'Concentration is elevated above normal. Inspect burners and cylinder connections.'
                  : 'MQ-6 sensor telemetry confirms normal ambient air. Continuous detection active.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-sm pt-2 flex flex-col gap-2">
              {isDanger && activeAlert && activeAlert.status === 'active' ? (
                <button
                  onClick={() => onAcknowledgeAlert(activeAlert.id)}
                  className="w-full py-3.5 px-6 bg-white hover:bg-slate-100 active:scale-95 transition-all text-red-950 font-black text-xs sm:text-sm rounded-2xl shadow-2xl flex items-center justify-center gap-2 border-2 border-red-300"
                >
                  <CheckCircle2 className="w-5 h-5 text-red-600" />
                  ACKNOWLEDGE ALERT
                </button>
              ) : (
                <button
                  onClick={onNavigateToDevice}
                  className="w-full py-3 px-6 bg-slate-900 hover:bg-slate-850 active:scale-95 transition-all text-slate-200 font-bold text-xs rounded-2xl border border-slate-800 flex items-center justify-center gap-2 hover:border-amber-500/50"
                >
                  <Cpu className="w-4 h-4 text-amber-400" />
                  Manage Hardware Nodes
                </button>
              )}
            </div>

          </div>
        </section>

        {/* Right Column: Telemetry Tiles & Device Roster (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Telemetry Tiles Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Gas Sensor Tile */}
            <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-3xl backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold text-slate-300">Gas Reading</span>
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {hasEverReceivedTelemetry ? (lastRecordedGas !== undefined ? lastRecordedGas : '--') : '--'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Scale: 0-1023</span>
                <span className={isOnline ? "text-amber-400 font-medium" : "text-amber-500/80 font-medium"}>
                  {isOnline ? 'MQ-6 ADC' : 'Last Reading (Offline)'}
                </span>
              </div>
            </div>

            {/* Temperature Tile */}
            <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-3xl backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold text-slate-300">Temperature</span>
                <div className="w-7 h-7 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                  <Thermometer className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {isOnline && reading?.temperature !== undefined ? `${reading.temperature}°C` : '--'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Ambient</span>
                <span className="text-slate-400">{reading?.temperature !== undefined ? 'Active' : 'Optional'}</span>
              </div>
            </div>

            {/* Humidity Tile */}
            <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-3xl backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold text-slate-300">Humidity</span>
                <div className="w-7 h-7 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                  <Droplets className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {isOnline && reading?.humidity !== undefined ? `${reading.humidity}%` : '--'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Rel. Moisture</span>
                <span className="text-slate-400">{reading?.humidity !== undefined ? 'Active' : 'Optional'}</span>
              </div>
            </div>

            {/* Hardware Link Tile */}
            <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-3xl backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold text-slate-300">Link Mode</span>
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Radio className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-100 truncate">
                {selectedDevice ? selectedDevice.connection_type : 'Cloud API'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{selectedDevice?.device_type || 'ESP32'}</span>
                <span className={isOnline ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Node Switcher Card */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 sm:p-5 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                Active Hardware Nodes ({devices.length})
              </span>
              <button
                onClick={onNavigateToDevice}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
              >
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {devices.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {devices.map((dev) => {
                  const isDevOnline = dev.isOnlineComputed ?? isDeviceOnline(dev.last_seen);
                  const isSelected = areDeviceIdsEqual(dev.id, selectedDeviceId);
                  const devGas = isDevOnline ? (dev.currentGas ?? '--') : '--';
                  const isDevAlert = dev.currentStatus === 'ALERT';

                  return (
                    <button
                      key={dev.id}
                      onClick={() => onSelectDevice(dev.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 text-white'
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          isDevAlert ? 'bg-red-500 animate-ping-slow' : isDevOnline ? 'bg-emerald-400' : 'bg-slate-600'
                        }`} />
                        <div className="truncate">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            {dev.name}
                            <span className="text-[10px] font-mono text-slate-500">[{dev.id}]</span>
                          </div>
                          <div className="text-[10px] text-slate-500">{dev.location}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-xs font-mono font-bold ${
                          isDevAlert ? 'text-red-400' : isDevOnline ? 'text-slate-200' : 'text-slate-500'
                        }`}>
                          {devGas !== '--' ? `${devGas} ADC` : '--'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isDevOnline ? 'Active' : 'Offline'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 space-y-2">
                <p>No detector devices registered in Supabase yet.</p>
                <button
                  onClick={onNavigateToDevice}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Device
                </button>
              </div>
            )}
          </div>

          {/* Emergency Safety Protocol & Call Card */}
          <div className="bg-gradient-to-r from-red-950/30 to-slate-900 border border-red-900/30 rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Wind className="w-4 h-4 text-amber-400" />
                <span>Gas Emergency Action</span>
              </div>
              <a
                href="tel:911"
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Call Helpline
              </a>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If smell of gas persists: Shut supply valve, ventilate area, and evacuate. Do not operate electrical switches.
            </p>
          </div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. ROW 3: Live Telemetry Sparkline & Recent Activity Feed     */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Live Sparkline Card (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Live Sensor Telemetry Sparkline: {selectedDevice ? selectedDevice.id : 'No Node'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {isOnline ? 'Real-time Stream' : 'Communication Lost'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60 h-24 flex items-center justify-center overflow-hidden">
            {recentPoints ? (
              <svg viewBox="0 0 280 50" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={recentPoints}
                />
              </svg>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Activity className="w-4 h-4 opacity-40 animate-pulse" />
                <span>Waiting for telemetry stream from {selectedDevice?.id || 'device'}...</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Audit / Events Log (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Recent Activity
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Audit Log</span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {deviceEvents.length > 0 ? (
              deviceEvents.slice(0, 5).map((evt) => (
                <div key={evt.id} className="text-xs p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span className="text-amber-400">{evt.event_type}</span>
                    <span>{new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">{evt.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                No recent events recorded.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
