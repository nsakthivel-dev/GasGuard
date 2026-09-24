import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigation, TabType } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { DeviceView } from './components/DeviceView';
import { HistoryView } from './components/HistoryView';
import { AlertsView } from './components/AlertsView';
import { SettingsView } from './components/SettingsView';
import { AlarmOverlay } from './components/AlarmOverlay';
import { InstallPrompt } from './components/InstallPrompt';
import { sensorService } from './services/SensorService';
import { alertEngine } from './services/AlertEngine';
import { 
  fetchDashboardOverview, 
  fetchDeviceReadings, 
  fetchDeviceSettings,
  fetchLatestTelemetry,
  acknowledgeAlertInCloud, 
  resolveAlertInCloud, 
  subscribeToRealtime,
  isDeviceOnline,
  isSupabaseConfigured,
  normalizeDeviceId,
  areDeviceIdsEqual
} from './lib/supabase';
import { 
  AlertEngineState, 
  AlertRecord, 
  AlertSettings, 
  DeviceInfo, 
  DeviceRecord,
  DeviceEvent,
  DashboardStats,
  SensorReading,
  GasStatus
} from './types';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  PlugZap, 
  Unplug, 
  RefreshCw,
  Cpu
} from 'lucide-react';
import { audioAlarm } from './services/audioAlarm';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('GAS-000001');
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [readingsHistory, setReadingsHistory] = useState<SensorReading[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(sensorService.getDeviceInfo());
  const [alertState, setAlertState] = useState<AlertEngineState>('SAFE');
  const [activeAlert, setActiveAlert] = useState<AlertRecord | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [deviceEvents, setDeviceEvents] = useState<DeviceEvent[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(alertEngine.getSettings());
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [isLoading, setIsLoading] = useState(true);
  const [heartbeatTimeout, setHeartbeatTimeout] = useState<number>(60);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live system clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch data from Supabase
  const loadCloudData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      // Fetch settings first
      const dbSettings = await fetchDeviceSettings();
      const currentTimeout = dbSettings.heartbeat_timeout_seconds || 60;
      setHeartbeatTimeout(currentTimeout);

      alertEngine.updateSettings({
        warningThreshold: dbSettings.warning_threshold,
        dangerThreshold: dbSettings.alert_threshold,
        heartbeatTimeoutSeconds: currentTimeout,
      });
      setSettings(alertEngine.getSettings());

      // Fetch dashboard overview
      const overview = await fetchDashboardOverview(currentTimeout);
      setDevices(overview.devices);
      setAlerts(overview.alerts);
      setDeviceEvents(overview.events);

      // Select default device
      if (overview.devices.length > 0) {
        setSelectedDeviceId((prev) => {
          if (prev && overview.devices.some((d) => areDeviceIdsEqual(d.id, prev))) {
            return prev;
          }
          // Prioritize device with active alert or online device
          const alertDevice = overview.devices.find((d) => d.currentStatus === 'ALERT');
          if (alertDevice) return alertDevice.id;
          const onlineDev = overview.devices.find((d) => d.isOnlineComputed);
          return onlineDev ? onlineDev.id : overview.devices[0].id;
        });
      }

      // Check active alerts
      const active = overview.alerts.find((a) => a.status === 'active');
      if (active) {
        setActiveAlert(active);
        setAlertState('ALERT_ACTIVE');
      } else {
        setActiveAlert(null);
        setAlertState('SAFE');
      }
    } catch (err) {
      console.warn('[App] Failed to load data from Supabase:', err);
    } finally {
      if (showLoading) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // 2. Load historical readings for selected device
  useEffect(() => {
    if (!selectedDeviceId) return;

    fetchDeviceReadings(selectedDeviceId, 100, 24).then((history) => {
      if (history && history.length > 0) {
        setReadingsHistory(history);
        const latest = history[history.length - 1];
        setReading(latest);
      }
    });
  }, [selectedDeviceId]);

  // Keep local device info display synchronized with selected device
  useEffect(() => {
    const targetDev = devices.find((d) => areDeviceIdsEqual(d.id, selectedDeviceId)) || devices[0];
    if (targetDev) {
      setDeviceInfo({
        id: targetDev.id,
        name: targetDev.name,
        location: targetDev.location,
        deviceType: targetDev.device_type,
        connectionType: targetDev.connection_type as any,
        baudRate: 9600,
        lastSeenAt: targetDev.last_seen,
        status: targetDev.isOnlineComputed ? 'connected' : 'disconnected',
      });
    }
  }, [devices, selectedDeviceId]);

  // 3. Initial load, polling, & Supabase Realtime setup
  useEffect(() => {
    loadCloudData(true);

    // Subscribe to Supabase Realtime stream
    const unsubscribe = subscribeToRealtime({
      onReading: (newReading) => {
        const gasVal = newReading.gas ?? newReading.gas_value ?? 0;
        const readingDevId = newReading.deviceId || newReading.device_id || '';

        // Update device in list with latest reading & mark online
        setDevices((prev) =>
          prev.map((dev) => {
            if (areDeviceIdsEqual(dev.id, readingDevId)) {
              return {
                ...dev,
                last_seen: newReading.recorded_at || new Date().toISOString(),
                status: 'online',
                isOnlineComputed: true,
                currentGas: gasVal,
                currentStatus: newReading.status,
                latestReading: newReading,
              };
            }
            return dev;
          })
        );

        // If the reading belongs to the actively selected device, update chart & gauge
        if (
          !selectedDeviceId ||
          areDeviceIdsEqual(readingDevId, selectedDeviceId)
        ) {
          setReading(newReading);
          setReadingsHistory((prev) => {
            const next = [...prev, newReading];
            return next.length > 300 ? next.slice(-300) : next;
          });

          // Process reading through safety engine
          alertEngine.processReading(newReading);
        }
      },
      onDevice: (updatedRow) => {
        if (updatedRow && updatedRow.id) {
          setDevices((prev) =>
            prev.map((d) => {
              if (areDeviceIdsEqual(d.id, updatedRow.id)) {
                const isOnline = isDeviceOnline(updatedRow.last_seen, heartbeatTimeout);
                return {
                  ...d,
                  name: updatedRow.name || d.name,
                  location: updatedRow.location || d.location,
                  last_seen: updatedRow.last_seen,
                  status: (isOnline ? 'online' : 'offline') as 'online' | 'offline',
                  isOnlineComputed: isOnline,
                };
              }
              return d;
            })
          );
        }
        loadCloudData(false);
      },
      onAlert: (newAlertRow) => {
        const mappedAlert: AlertRecord = {
          id: newAlertRow.id,
          deviceId: newAlertRow.device_id,
          device_id: newAlertRow.device_id,
          type: newAlertRow.alert_type || 'GAS_LEAK',
          severity: newAlertRow.severity,
          gasValue: newAlertRow.gas_value,
          gas_value: newAlertRow.gas_value,
          message: newAlertRow.message,
          startedAt: newAlertRow.created_at,
          created_at: newAlertRow.created_at,
          endedAt: newAlertRow.resolved_at ?? undefined,
          resolved_at: newAlertRow.resolved_at ?? undefined,
          acknowledged: newAlertRow.acknowledged,
          status: newAlertRow.resolved_at ? 'resolved' : newAlertRow.acknowledged ? 'acknowledged' : 'active',
        };

        setAlerts((prev) => {
          const exists = prev.some((a) => a.id === mappedAlert.id);
          if (exists) {
            return prev.map((a) => (a.id === mappedAlert.id ? mappedAlert : a));
          }
          return [mappedAlert, ...prev];
        });

        if (mappedAlert.status === 'active') {
          setActiveAlert(mappedAlert);
          setAlertState('ALERT_ACTIVE');
          audioAlarm.startSiren();
        } else if (mappedAlert.status === 'resolved') {
          audioAlarm.stopSiren();
          setActiveAlert((curr) => (curr?.id === mappedAlert.id ? null : curr));
          setAlertState('SAFE');
        }
      },
      onEvent: (eventRow) => {
        setDeviceEvents((prev) => [eventRow, ...prev.slice(0, 49)]);
      },
    });

    // 4. Fast 1-second telemetry refresh loop (targeted query on gas_readings & device last_seen only)
    let isFetchingTelemetry = false;
    const telemetryInterval = setInterval(async () => {
      if (isFetchingTelemetry) return;
      isFetchingTelemetry = true;
      try {
        const targetId = selectedDeviceId || 'GAS-000001';
        const { reading: latest, lastSeen } = await fetchLatestTelemetry(targetId);

        if (latest) {
          setReading(latest);
          setReadingsHistory((prev) => {
            if (prev.length === 0 || prev[prev.length - 1].id !== latest.id) {
              const next = [...prev, latest];
              return next.length > 300 ? next.slice(-300) : next;
            }
            return prev;
          });
          alertEngine.processReading(latest);
        }

        // Dynamically update device online status strictly based on last_seen (<=60s ONLINE, >60s OFFLINE)
        setDevices((prev) =>
          prev.map((d): DeviceRecord => {
            if (areDeviceIdsEqual(d.id, targetId)) {
              const effectiveSeen = lastSeen || d.last_seen;
              const online = isDeviceOnline(effectiveSeen, heartbeatTimeout);
              return {
                ...d,
                last_seen: effectiveSeen || d.last_seen,
                status: online ? 'online' : 'offline',
                isOnlineComputed: online,
                currentGas: latest ? (latest.gas_value ?? latest.gas) : d.currentGas,
                currentStatus: (latest?.status || d.currentStatus || 'NORMAL') as GasStatus,
                latestReading: latest || d.latestReading,
              };
            } else {
              const online = isDeviceOnline(d.last_seen, heartbeatTimeout);
              if (online !== d.isOnlineComputed || (online && d.status !== 'online') || (!online && d.status !== 'offline')) {
                return {
                  ...d,
                  status: online ? 'online' : 'offline',
                  isOnlineComputed: online,
                };
              }
              return d;
            }
          })
        );
      } catch (err) {
        console.warn('[App] Telemetry tick error:', err);
      } finally {
        isFetchingTelemetry = false;
      }
    }, 1000);

    // 5. Low-frequency background sync (every 30 seconds) for alerts, settings & overview
    const fullSyncInterval = setInterval(() => {
      loadCloudData(false);
    }, 30000);

    // 6. Sensor service hook for optional direct hardware (WebSerial)
    sensorService.onReading((localReading) => {
      setReading(localReading);
      setReadingsHistory((prev) => [...prev.slice(-200), localReading]);
      alertEngine.processReading(localReading);
    });

    sensorService.onStatusChange((info) => {
      setDeviceInfo(info);
    });

    alertEngine.onStateChange((state, currentAlert) => {
      setAlertState(state);
      setActiveAlert(currentAlert);
    });

    return () => {
      unsubscribe();
      clearInterval(telemetryInterval);
      clearInterval(fullSyncInterval);
    };
  }, [loadCloudData, heartbeatTimeout, selectedDeviceId]);

  // Alert acknowledgement action
  const handleAcknowledgeAlert = async (alertId?: string) => {
    const targetId = alertId || activeAlert?.id;
    if (targetId) {
      await acknowledgeAlertInCloud(targetId);
      alertEngine.acknowledgeAlert();
      setAlerts((prev) =>
        prev.map((a) => (a.id === targetId ? { ...a, status: 'acknowledged', acknowledged: true } : a))
      );
      if (activeAlert && activeAlert.id === targetId) {
        setActiveAlert({ ...activeAlert, status: 'acknowledged', acknowledged: true });
        setAlertState('ACKNOWLEDGED');
      }
    }
  };

  // Alert resolution action
  const handleResolveAlert = async (alertId: string) => {
    await resolveAlertInCloud(alertId);
    audioAlarm.stopSiren();
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: 'resolved', resolved_at: new Date().toISOString() } : a))
    );
    if (activeAlert && activeAlert.id === alertId) {
      setActiveAlert(null);
      setAlertState('SAFE');
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadCloudData();
  };

  const handleUpdateSettings = (newSettings: Partial<AlertSettings>) => {
    alertEngine.updateSettings(newSettings);
    setSettings(alertEngine.getSettings());
    if (newSettings.heartbeatTimeoutSeconds) {
      setHeartbeatTimeout(newSettings.heartbeatTimeoutSeconds);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear local readings cache?')) {
      setReadingsHistory([]);
    }
  };

  const activeAlertCount = useMemo(() => {
    return alerts.filter((a) => a.status === 'active').length;
  }, [alerts]);

  const dashboardStats: DashboardStats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.isOnlineComputed).length;
    const offline = total - online;
    return {
      totalDevices: total,
      onlineDevices: online,
      offlineDevices: offline,
      activeAlerts: activeAlertCount,
    };
  }, [devices, activeAlertCount]);

  const selectedDevice = useMemo(() => {
    return devices.find((d) => areDeviceIdsEqual(d.id, selectedDeviceId)) || devices[0] || null;
  }, [devices, selectedDeviceId]);

  const isConnected = selectedDevice ? selectedDevice.isOnlineComputed : false;

  const sectionTitles: Record<TabType, { title: string; subtitle: string }> = {
    home: { title: 'Live Telemetry Operations', subtitle: 'Real-time multi-device safety monitor & hazard index' },
    history: { title: 'Telemetry History & Trends', subtitle: 'Multi-node time series, alerts, and audit logs' },
    device: { title: 'Device Management', subtitle: 'Register, inspect, and configure gas detector nodes' },
    alerts: { title: 'Incident Event Records', subtitle: 'Active hazard alerts, history, and resolution audit' },
    settings: { title: 'System Configuration', subtitle: 'Thresholds, heartbeat rules, and ESP32 telemetry API' },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* PWA Install Banner */}
      <InstallPrompt />

      {/* Emergency Overlay */}
      <AlarmOverlay
        alertState={alertState}
        activeAlert={activeAlert}
        onAcknowledge={() => handleAcknowledgeAlert()}
      />

      <div className="flex flex-1 w-full">
        {/* Navigation Sidebar */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          alertState={alertState}
          deviceStatus={isConnected ? 'connected' : 'disconnected'}
          activeAlertCount={activeAlertCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
          
          {/* Desktop Top Header Bar */}
          <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-slate-950/80 border-b border-slate-800/80 sticky top-0 z-30 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                    GasGuard //
                  </span>
                  <h2 className="text-sm font-extrabold text-white tracking-tight">
                    {sectionTitles[activeTab].title}
                  </h2>
                </div>
                <p className="text-[11px] text-slate-400">
                  {sectionTitles[activeTab].subtitle}
                </p>
              </div>
            </div>

            {/* Top Right Quick Stats & Controls */}
            <div className="flex items-center gap-3">
              {/* Manual Refresh Button */}
              <button
                onClick={handleManualRefresh}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                title="Refresh Cloud Telemetry"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              </button>

              {/* Local Clock */}
              <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentTime}</span>
              </div>

              {/* Focus Device Quick Selector */}
              {devices.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Focus Node:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-transparent text-xs font-mono font-semibold text-amber-400 focus:outline-none cursor-pointer"
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                        {d.id} - {d.name} {d.isOnlineComputed ? '(Online)' : '(Offline)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </header>

          {/* Mobile Top Header (< 1024px) */}
          <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800/80 sticky top-0 z-30 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                activeAlertCount > 0
                  ? 'bg-red-500 text-white animate-pulse'
                  : dashboardStats.onlineDevices > 0
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {activeAlertCount > 0 ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-white block leading-tight">
                  GasGuard
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {dashboardStats.onlineDevices} / {dashboardStats.totalDevices} Nodes Online
                </span>
              </div>
            </div>

            {/* Mobile Refresh & Device Badge */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleManualRefresh}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              </button>
              <button
                onClick={() => setActiveTab('device')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800"
              >
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                <span className="text-[11px] font-mono text-slate-300">
                  {selectedDevice ? selectedDevice.id : 'No Node'}
                </span>
              </button>
            </div>
          </header>

          {/* Tab Views Container */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            {activeTab === 'home' && (
              <HomeView
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                stats={dashboardStats}
                reading={reading}
                readingsHistory={readingsHistory}
                selectedDevice={selectedDevice}
                alertState={alertState}
                activeAlert={activeAlert}
                alerts={alerts}
                deviceEvents={deviceEvents}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResolveAlert={handleResolveAlert}
                onNavigateToDevice={() => setActiveTab('device')}
                onRefresh={loadCloudData}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                devices={devices}
                readings={readingsHistory}
                alerts={alerts}
                events={deviceEvents}
                currentReading={reading}
                settings={settings}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
              />
            )}

            {activeTab === 'device' && (
              <DeviceView
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onRefreshDevices={loadCloudData}
                deviceInfo={deviceInfo}
                onConnect={async () => { await sensorService.connectDevice(); }}
                onDisconnect={async () => { await sensorService.disconnectDevice(); }}
                onUpdateDeviceInfo={(updates) => sensorService.updateDeviceInfo(updates)}
                onSwitchDeviceType={async (type, opts) => { await sensorService.setDeviceType(type, opts); }}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertsView
                alerts={alerts}
                devices={devices}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResolveAlert={handleResolveAlert}
                onClearAlerts={handleClearHistory}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                readings={readingsHistory}
                alerts={alerts}
                onClearHistory={handleClearHistory}
                theme={theme}
                setTheme={setTheme}
                onRefresh={loadCloudData}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
