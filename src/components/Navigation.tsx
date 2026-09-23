import React from 'react';
import { 
  Home, 
  History, 
  Cpu, 
  AlertTriangle, 
  Settings, 
  ShieldCheck, 
  ShieldAlert,
  Flame,
  Radio,
  Wifi,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AlertEngineState, DeviceStatus } from '../types';

export type TabType = 'home' | 'history' | 'device' | 'alerts' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  alertState: AlertEngineState;
  deviceStatus: DeviceStatus;
  activeAlertCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  alertState,
  deviceStatus,
  activeAlertCount,
}) => {
  const tabs: { id: TabType; label: string; description: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Monitor', description: 'Live Telemetry & Safety', icon: Home },
    { id: 'history', label: 'History', description: 'Trends & Analytics', icon: History },
    { id: 'device', label: 'Device', description: 'Serial & Wi-Fi Node', icon: Cpu },
    { id: 'alerts', label: 'Incidents', description: 'Alert Logs & Events', icon: AlertTriangle },
    { id: 'settings', label: 'Settings', description: 'Thresholds & Cloud', icon: Settings },
  ];

  const isDanger = alertState === 'ALERT_ACTIVE' || alertState === 'DANGER';
  const isWarning = alertState === 'WARNING';
  const isConnected = deviceStatus === 'connected';

  return (
    <>
      {/* Desktop Left Rail / Sidebar (Sticky, sleek industrial aesthetics) */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-950/80 border-r border-slate-800/80 p-5 shrink-0 justify-between backdrop-blur-2xl sticky top-0 h-screen overflow-y-auto select-none">
        <div className="space-y-6">
          {/* Logo & Safety Branding Header */}
          <div className="flex items-center gap-3.5 px-2 py-1">
            <div className={`relative w-11 h-11 rounded-2xl flex items-center justify-center font-black transition-all duration-300 shadow-xl border ${
              isDanger
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                : isWarning
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              {isDanger ? (
                <ShieldAlert className="w-6 h-6 text-red-400" />
              ) : isWarning ? (
                <Flame className="w-6 h-6 text-amber-400" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              )}
              {/* Status pulse dot */}
              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${
                isConnected ? 'bg-emerald-400 animate-ping-slow' : 'bg-red-500'
              }`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white">
                  GasGuard
                </h1>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700/80">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide">
                Safety IoT Sentinel
              </p>
            </div>
          </div>

          {/* Device Live Link Status Pill */}
          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                Link State
              </span>
              <span className={`font-semibold flex items-center gap-1 text-[11px] ${
                isConnected ? 'text-emerald-400' :
                deviceStatus === 'connecting' ? 'text-amber-400' :
                'text-rose-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? 'bg-emerald-400' :
                  deviceStatus === 'connecting' ? 'bg-amber-400 animate-pulse' :
                  'bg-rose-400'
                }`} />
                <span className="capitalize">{deviceStatus}</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
              <span>Hardware</span>
              <span className="text-slate-300">Arduino Uno</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              System Modules
            </div>

            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full group flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs transition-all duration-200 border ${
                    isActive
                      ? 'bg-slate-800/90 text-white font-semibold border-slate-700/80 shadow-md shadow-slate-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-900 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/80 border border-slate-800/60'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className={`font-semibold ${isActive ? 'text-slate-100' : 'text-slate-300'}`}>
                        {tab.label}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">
                        {tab.description}
                      </div>
                    </div>
                  </div>

                  {tab.id === 'alerts' && activeAlertCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse font-mono">
                      {activeAlertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Technical & Safety Notice */}
        <div className="space-y-2 pt-4 border-t border-slate-800/60">
          <div className="p-3 bg-slate-900/40 border border-slate-800/50 rounded-2xl text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[10px] uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5" />
              Safety Standard
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Readings indicative. Follow certified gas safety protocols.
            </p>
          </div>

          <div className="flex items-center justify-between px-2 text-[10px] text-slate-500 font-mono">
            <span>PWA v1.0.0</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Ready
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-2xl px-3 py-1.5 safe-bottom">
        <nav className="flex items-center justify-around max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all relative ${
                  isActive
                    ? 'text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-label={tab.label}
              >
                <div className="relative">
                  <div className={`p-1 rounded-lg transition-colors ${
                    isActive ? 'bg-amber-500/15 text-amber-400' : ''
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {tab.id === 'alerts' && activeAlertCount > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {activeAlertCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 w-6 h-0.5 bg-amber-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};
