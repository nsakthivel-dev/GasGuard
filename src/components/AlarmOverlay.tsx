import React from 'react';
import { AlertTriangle, BellRing, CheckCircle, Flame, ShieldAlert, VolumeX, Wind } from 'lucide-react';
import { AlertEngineState, AlertRecord } from '../types';

interface AlarmOverlayProps {
  alertState: AlertEngineState;
  activeAlert: AlertRecord | null;
  onAcknowledge: () => void;
}

export const AlarmOverlay: React.FC<AlarmOverlayProps> = ({
  alertState,
  activeAlert,
  onAcknowledge,
}) => {
  if (alertState !== 'ALERT_ACTIVE' && alertState !== 'DANGER' && alertState !== 'ACKNOWLEDGED') {
    return null;
  }

  const isAcknowledged = alertState === 'ACKNOWLEDGED';

  return (
    <div className={`fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 transition-all duration-300 ${
      isAcknowledged
        ? 'bg-slate-950/95 backdrop-blur-md border-t-4 border-amber-500'
        : 'bg-red-950/95 backdrop-blur-lg border-t-8 border-red-600 animate-pulse-fast'
    }`}>
      {/* Top Banner */}
      <div className="max-w-xl w-full mx-auto space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isAcknowledged ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-red-500 text-white animate-bounce'
            }`}>
              <BellRing className="w-3.5 h-3.5" />
              {isAcknowledged ? 'Alert Acknowledged' : 'Emergency Priority Alarm'}
            </span>
          </div>
          <span className="text-xs text-slate-300 font-mono">
            {activeAlert?.startedAt ? new Date(activeAlert.startedAt).toLocaleTimeString() : 'Just now'}
          </span>
        </div>

        {/* Big Alert Header */}
        <div className="text-center space-y-2 py-2">
          <div className="inline-flex p-4 rounded-3xl bg-red-600/30 border border-red-500/40 text-red-400 mb-1 shadow-2xl">
            {isAcknowledged ? (
              <ShieldAlert className="w-14 h-14 text-amber-400" />
            ) : (
              <Flame className="w-14 h-14 text-red-500 animate-pulse" />
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
            {isAcknowledged ? '⚠️ Alert Acknowledged' : '🚨 Possible Gas Leak Detected'}
          </h2>

          <p className="text-sm sm:text-base text-red-200/90 max-w-md mx-auto">
            {isAcknowledged
              ? 'Audible alarm silenced. Keep observing safety protocols until gas levels return to normal.'
              : 'Sensors detected potentially hazardous combustible gas concentration.'}
          </p>
        </div>

        {/* Telemetry Snapshot Card */}
        <div className="grid grid-cols-2 gap-3 bg-slate-900/90 border border-red-800/60 p-4 rounded-2xl shadow-xl">
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">Gas Level Reading</span>
            <div className="text-3xl sm:text-4xl font-black text-red-400 font-mono mt-0.5">
              {activeAlert?.gasValue ?? '--'}
            </div>
            <span className="text-[10px] text-red-300/70 font-medium">ADC (Danger Threshold exceeded)</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">Device ID</span>
            <div className="text-xl sm:text-2xl font-bold text-slate-100 font-mono mt-1">
              {activeAlert?.deviceId ?? 'GAS-000001'}
            </div>
            <span className="text-[10px] text-slate-400">Kitchen</span>
          </div>
        </div>

        {/* Emergency Safety Protocol Checklist */}
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 text-xs space-y-2.5">
          <h4 className="font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
            <Wind className="w-4 h-4 text-amber-400" />
            Immediate Safety Action Steps:
          </h4>
          <ul className="space-y-1.5 text-slate-200 font-medium">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
              <span><strong>Shut off</strong> the main gas cylinder or supply valve immediately.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
              <span><strong>Open</strong> all windows and external doors to ventilate the area.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
              <span><strong>DO NOT</strong> switch on/off any electrical appliances, switches, or lighters.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px]">4</span>
              <span><strong>Evacuate</strong> all occupants outside and call your gas emergency helpline.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="max-w-xl w-full mx-auto pt-4 pb-2 space-y-3">
        {!isAcknowledged ? (
          <button
            onClick={onAcknowledge}
            className="w-full py-4 px-6 bg-white hover:bg-slate-100 active:scale-[0.98] transition-all text-red-950 font-black text-base sm:text-lg rounded-2xl shadow-2xl flex items-center justify-center gap-2 border-2 border-red-300"
          >
            <VolumeX className="w-6 h-6 text-red-600" />
            ACKNOWLEDGE ALERT
          </button>
        ) : (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wide">
              <CheckCircle className="w-4 h-4" />
              Alert Acknowledged by User
            </div>
            <p className="text-[11px] text-amber-200/80">
              Acknowledging this alert does not indicate that the gas leak is resolved.
              Maintain caution until sensor readings drop below safety thresholds.
            </p>
          </div>
        )}

        <p className="text-[11px] text-center text-slate-400">
          ⚠️ Indicative sensor readings only. This system does not guarantee safety.
        </p>
      </div>
    </div>
  );
};
