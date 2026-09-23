import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Flame, 
  ShieldAlert, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Filter, 
  Cpu, 
  Eye,
  Check,
  X,
  Search,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { AlertRecord, DeviceRecord } from '../types';

interface AlertsViewProps {
  alerts: AlertRecord[];
  devices?: DeviceRecord[];
  onAcknowledgeAlert?: (alertId: string) => void;
  onResolveAlert?: (alertId: string) => void;
  onClearAlerts?: () => void;
}

type DateFilter = 'all' | 'today' | '7days' | '30days';
type StatusFilter = 'all' | 'active' | 'acknowledged' | 'resolved';

export const AlertsView: React.FC<AlertsViewProps> = ({ 
  alerts, 
  devices = [],
  onAcknowledgeAlert, 
  onResolveAlert,
  onClearAlerts 
}) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<AlertRecord | null>(null);

  const deviceMap = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [devices]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const alertTime = new Date(alert.startedAt || alert.created_at || Date.now()).getTime();
      const now = Date.now();

      // Device filter
      if (deviceFilter !== 'all' && alert.deviceId !== deviceFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && alert.status !== statusFilter) {
        return false;
      }

      // Date filtering
      if (dateFilter === 'today') {
        const isToday = new Date(alertTime).toDateString() === new Date().toDateString();
        if (!isToday) return false;
      } else if (dateFilter === '7days') {
        if (now - alertTime > 7 * 24 * 3600 * 1000) return false;
      } else if (dateFilter === '30days') {
        if (now - alertTime > 30 * 24 * 3600 * 1000) return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesId = alert.id.toLowerCase().includes(term);
        const matchesDevice = alert.deviceId.toLowerCase().includes(term);
        const matchesMsg = alert.message?.toLowerCase().includes(term);
        if (!matchesId && !matchesDevice && !matchesMsg) return false;
      }

      return true;
    });
  }, [alerts, dateFilter, statusFilter, deviceFilter, searchTerm]);

  const activeAlerts = useMemo(() => {
    return filteredAlerts.filter((a) => a.status === 'active' || a.status === 'acknowledged');
  }, [filteredAlerts]);

  const resolvedAlerts = useMemo(() => {
    return filteredAlerts.filter((a) => a.status === 'resolved');
  }, [filteredAlerts]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            Hazard Alert Management & Audit History
          </h2>
          <p className="text-xs text-slate-400">
            Real-time hazard notifications, emergency acknowledgements, and permanent incident log
          </p>
        </div>

        {alerts.length > 0 && onClearAlerts && (
          <button
            onClick={onClearAlerts}
            className="text-xs text-slate-400 hover:text-rose-400 font-semibold px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl"
          >
            Clear Local Cache
          </button>
        )}
      </div>

      {/* 2. Filters Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search alert by ID, device, message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Device Dropdown Filter */}
          {devices.length > 0 && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase font-mono">Node:</span>
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">All Devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} ({d.name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date & Status Pills */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Status:</span>
            {(['all', 'active', 'acknowledged', 'resolved'] as StatusFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition ${
                  statusFilter === tab
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Date:</span>
            {(['all', 'today', '7days', '30days'] as DateFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setDateFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  dateFilter === tab
                    ? 'bg-slate-200 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/40'
                }`}
              >
                {tab === 'all' ? 'All Time' : tab === 'today' ? 'Today' : tab === '7days' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. ACTIVE ALERTS SECTION */}
      {statusFilter !== 'resolved' && activeAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-red-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping-slow" />
              Active Hazards Requiring Attention ({activeAlerts.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAlerts.map((alert) => {
              const isAcknowledged = alert.status === 'acknowledged';

              return (
                <div
                  key={alert.id}
                  className="bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-900 border-2 border-red-500/80 rounded-3xl p-5 shadow-xl space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                        <Flame className="w-5 h-5 animate-bounce" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">{alert.deviceId}</span>
                          <span className="text-[10px] text-slate-400">
                            {deviceMap.get(alert.deviceId) || 'Gas Node'}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-base text-white">
                          Combustible Gas Leak
                        </h4>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isAcknowledged
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-red-500 text-white animate-pulse'
                    }`}>
                      {alert.status}
                    </span>
                  </div>

                  <p className="text-xs text-red-200">
                    {alert.message || `Peak concentration recorded at ${alert.gasValue} ADC.`}
                  </p>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Peak Level</span>
                      <span className="font-mono font-bold text-red-400">{alert.gasValue} ADC</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Triggered</span>
                      <span className="font-mono text-slate-300">
                        {new Date(alert.startedAt || alert.created_at || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Severity</span>
                      <span className="font-bold text-red-400">{alert.severity}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" /> Details
                    </button>

                    <div className="flex items-center gap-2">
                      {!isAcknowledged && onAcknowledgeAlert && (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-4 py-2 bg-white hover:bg-slate-100 text-red-950 font-black text-xs rounded-xl shadow transition"
                        >
                          Acknowledge
                        </button>
                      )}

                      {onResolveAlert && (
                        <button
                          onClick={() => onResolveAlert(alert.id)}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow transition"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. PREVIOUS / RESOLVED ALERTS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            Incident Log & History ({filteredAlerts.length})
          </h3>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const isResolved = alert.status === 'resolved';
              const isDanger = alert.severity === 'CRITICAL' || alert.severity === 'danger' || alert.severity === 'HIGH';

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-2xl border transition-all shadow-md space-y-3 ${
                    alert.status === 'active'
                      ? 'bg-red-950/30 border-red-500/60'
                      : alert.status === 'acknowledged'
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        isResolved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {isResolved ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">{alert.deviceId}</span>
                          <span className="text-[11px] text-slate-400">
                            {deviceMap.get(alert.deviceId) || 'Gas Node'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-100">
                          {alert.type || 'GAS_LEAK'}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        alert.status === 'active'
                          ? 'bg-red-500 text-white animate-pulse'
                          : alert.status === 'acknowledged'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {alert.status}
                      </span>

                      <button
                        onClick={() => setSelectedAlert(alert)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Peak Level</span>
                      <span className="font-bold font-mono text-slate-200">{alert.gasValue} ADC</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Triggered Time</span>
                      <span className="font-mono text-slate-300">
                        {new Date(alert.startedAt || alert.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Date</span>
                      <span className="font-mono text-slate-400">
                        {new Date(alert.startedAt || alert.created_at || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Resolution</span>
                      <span className="font-medium text-slate-300">
                        {alert.resolved_at ? new Date(alert.resolved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800/60 rounded-3xl space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400/60 mx-auto" />
            <h4 className="font-bold text-slate-200 text-sm">No Alerts Recorded</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              No gas alerts or warnings have been triggered under the selected criteria.
            </p>
          </div>
        )}
      </div>

      {/* 5. MODAL: ALERT DETAIL */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Alert Record Details
              </h3>
              <button onClick={() => setSelectedAlert(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Incident ID</span>
                  <span className="font-mono text-slate-200">{selectedAlert.id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Device</span>
                  <span className="font-mono text-amber-400 font-bold">{selectedAlert.deviceId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Peak Concentration</span>
                  <span className="font-mono text-red-400 font-bold">{selectedAlert.gasValue} ADC</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Severity</span>
                  <span className="font-bold text-slate-200 uppercase">{selectedAlert.severity}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Status</span>
                  <span className="font-bold uppercase text-amber-400">{selectedAlert.status}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">System Message</span>
                <p className="p-3 bg-slate-950 rounded-xl text-slate-300 border border-slate-800">
                  {selectedAlert.message || 'Gas concentration exceeded safety threshold.'}
                </p>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                <div>Started: {new Date(selectedAlert.startedAt || selectedAlert.created_at || Date.now()).toLocaleString()}</div>
                {selectedAlert.resolved_at && (
                  <div>Resolved: {new Date(selectedAlert.resolved_at).toLocaleString()}</div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              {selectedAlert.status === 'active' && onAcknowledgeAlert && (
                <button
                  onClick={() => {
                    onAcknowledgeAlert(selectedAlert.id);
                    setSelectedAlert(null);
                  }}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Acknowledge
                </button>
              )}

              {selectedAlert.status !== 'resolved' && onResolveAlert && (
                <button
                  onClick={() => {
                    onResolveAlert(selectedAlert.id);
                    setSelectedAlert(null);
                  }}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Resolve Alert
                </button>
              )}

              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
