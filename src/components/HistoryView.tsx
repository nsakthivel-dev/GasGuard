import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Flame, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  ChevronDown,
  Activity,
  Info,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ShieldAlert,
  Server
} from 'lucide-react';
import { SensorReading, TimeRangeFilter, AlertSettings, DeviceRecord, AlertRecord, DeviceEvent, GasStatus } from '../types';

interface HistoryViewProps {
  devices: DeviceRecord[];
  readings: SensorReading[];
  alerts: AlertRecord[];
  events: DeviceEvent[];
  currentReading: SensorReading | null;
  settings: AlertSettings;
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
}

type HistoryTab = 'readings' | 'alerts' | 'events';

export const HistoryView: React.FC<HistoryViewProps> = ({
  devices,
  readings,
  alerts,
  events,
  currentReading,
  settings,
  selectedDeviceId,
  onSelectDevice,
}) => {
  const [activeTab, setActiveTab] = useState<HistoryTab>('readings');
  const [timeFilter, setTimeFilter] = useState<TimeRangeFilter>('24h');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState<SensorReading | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const timeFilters: { id: TimeRangeFilter; label: string }[] = [
    { id: 'live', label: 'Live' },
    { id: '1h', label: '1h' },
    { id: '6h', label: '6h' },
    { id: '24h', label: '24h' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
  ];

  // 1. Filtered Readings Data
  const filteredReadings = useMemo(() => {
    if (!readings || readings.length === 0) return [];

    const now = Date.now();
    let cutoffMs = 0;
    switch (timeFilter) {
      case 'live': cutoffMs = 5 * 60 * 1000; break;
      case '1h': cutoffMs = 60 * 60 * 1000; break;
      case '6h': cutoffMs = 6 * 60 * 60 * 1000; break;
      case '24h': cutoffMs = 24 * 60 * 60 * 1000; break;
      case '7d': cutoffMs = 7 * 24 * 60 * 60 * 1000; break;
      case '30d': cutoffMs = 30 * 24 * 60 * 60 * 1000; break;
    }

    return readings.filter((r) => {
      // Time cutoff
      if (cutoffMs > 0 && now - r.timestamp > cutoffMs) return false;

      // Device filter
      const rDev = r.deviceId || r.device_id;
      if (deviceFilter !== 'all' && rDev !== deviceFilter) return false;

      // Status filter
      if (statusFilter !== 'all') {
        const gasStatus = r.status || (r.gas >= settings.dangerThreshold ? 'ALERT' : r.gas >= settings.warningThreshold ? 'WARNING' : 'NORMAL');
        if (gasStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [readings, timeFilter, deviceFilter, statusFilter, settings]);

  // Downsample data for responsive SVG chart (max 60 points)
  const chartData = useMemo(() => {
    if (filteredReadings.length <= 60) return filteredReadings;
    const step = Math.ceil(filteredReadings.length / 60);
    const sampled: SensorReading[] = [];
    for (let i = 0; i < filteredReadings.length; i += step) {
      sampled.push(filteredReadings[i]);
    }
    return sampled;
  }, [filteredReadings]);

  // Telemetry statistics
  const stats = useMemo(() => {
    if (filteredReadings.length === 0) {
      return { min: 0, max: 0, avg: 0, elevatedCount: 0 };
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let elevated = 0;

    filteredReadings.forEach((r) => {
      if (r.gas < min) min = r.gas;
      if (r.gas > max) max = r.gas;
      sum += r.gas;
      if (r.gas >= settings.warningThreshold) elevated++;
    });

    return {
      min: Math.round(min === Infinity ? 0 : min),
      max: Math.round(max === -Infinity ? 0 : max),
      avg: Math.round(sum / filteredReadings.length),
      elevatedCount: elevated,
    };
  }, [filteredReadings, settings.warningThreshold]);

  // Chart coordinate calculation for responsive SVG
  const chartHeight = 180;
  const chartWidth = 360;
  const maxScale = Math.max(1000, stats.max + 100);

  const points = useMemo(() => {
    if (chartData.length === 0) return '';
    return chartData
      .map((d, index) => {
        const x = (index / Math.max(1, chartData.length - 1)) * chartWidth;
        const y = chartHeight - (d.gas / maxScale) * chartHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [chartData, maxScale]);

  const warningY = chartHeight - (settings.warningThreshold / maxScale) * chartHeight;
  const dangerY = chartHeight - (settings.dangerThreshold / maxScale) * chartHeight;

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (deviceFilter !== 'all' && a.deviceId !== deviceFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter.toLowerCase()) return false;
      if (searchTerm && !a.id.toLowerCase().includes(searchTerm.toLowerCase()) && !a.message?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [alerts, deviceFilter, statusFilter, searchTerm]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (deviceFilter !== 'all' && e.device_id !== deviceFilter) return false;
      if (searchTerm && !e.event_type.toLowerCase().includes(searchTerm.toLowerCase()) && !e.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [events, deviceFilter, searchTerm]);

  // Pagination calculation
  const totalItems = activeTab === 'readings' ? filteredReadings.length : activeTab === 'alerts' ? filteredAlerts.length : filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedReadings = useMemo(() => {
    return [...filteredReadings].reverse().slice(startIndex, endIndex);
  }, [filteredReadings, startIndex, endIndex]);

  const paginatedAlerts = useMemo(() => {
    return filteredAlerts.slice(startIndex, endIndex);
  }, [filteredAlerts, startIndex, endIndex]);

  const paginatedEvents = useMemo(() => {
    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, startIndex, endIndex]);

  // Export to CSV
  const handleExportCSV = () => {
    if (activeTab === 'readings') {
      if (filteredReadings.length === 0) return alert('No readings to export.');
      const headers = ['Timestamp', 'Date', 'Time', 'Device_ID', 'Gas_Reading_ADC', 'Status'];
      const rows = filteredReadings.map((r) => [
        r.timestamp,
        new Date(r.timestamp).toLocaleDateString(),
        new Date(r.timestamp).toLocaleTimeString(),
        r.deviceId || r.device_id || 'UNKNOWN',
        r.gas,
        r.status || 'NORMAL',
      ]);
      downloadCSV('gasguard_readings_export.csv', [headers, ...rows]);
    } else if (activeTab === 'alerts') {
      if (filteredAlerts.length === 0) return alert('No alerts to export.');
      const headers = ['Alert_ID', 'Device_ID', 'Gas_Value', 'Severity', 'Started_At', 'Resolved_At', 'Status', 'Message'];
      const rows = filteredAlerts.map((a) => [
        a.id,
        a.deviceId,
        a.gasValue,
        a.severity,
        a.startedAt || a.created_at || '',
        a.resolved_at || '',
        a.status,
        `"${(a.message || '').replace(/"/g, '""')}"`,
      ]);
      downloadCSV('gasguard_alerts_export.csv', [headers, ...rows]);
    } else {
      if (filteredEvents.length === 0) return alert('No events to export.');
      const headers = ['Event_ID', 'Device_ID', 'Event_Type', 'Created_At', 'Message'];
      const rows = filteredEvents.map((e) => [
        e.id,
        e.device_id,
        e.event_type,
        e.created_at,
        `"${e.message.replace(/"/g, '""')}"`,
      ]);
      downloadCSV('gasguard_events_export.csv', [headers, ...rows]);
    }
  };

  const downloadCSV = (filename: string, rows: (string | number)[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-24 lg:pb-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            Telemetry History & Audit Records
          </h2>
          <p className="text-xs text-slate-400">
            Time series telemetry, incident records, and audit events stored in Supabase
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
        >
          <Download className="w-4 h-4 text-amber-400" />
          Export CSV Log
        </button>
      </div>

      {/* 2. Primary Tabs: Gas Readings | Alerts | Device Events */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => { setActiveTab('readings'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'readings'
              ? 'bg-amber-500 text-slate-950 font-black shadow'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Gas Readings ({filteredReadings.length})
        </button>

        <button
          onClick={() => { setActiveTab('alerts'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'bg-amber-500 text-slate-950 font-black shadow'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Alerts ({filteredAlerts.length})
        </button>

        <button
          onClick={() => { setActiveTab('events'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'events'
              ? 'bg-amber-500 text-slate-950 font-black shadow'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Device Events ({filteredEvents.length})
        </button>
      </div>

      {/* 3. Filter Controls Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Node Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono">Node:</span>
            <select
              value={deviceFilter}
              onChange={(e) => { setDeviceFilter(e.target.value); setCurrentPage(1); }}
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

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              {activeTab === 'readings' ? (
                <>
                  <option value="NORMAL">NORMAL (0-400)</option>
                  <option value="WARNING">WARNING (401-700)</option>
                  <option value="ALERT">ALERT (701+)</option>
                </>
              ) : (
                <>
                  <option value="active">Active</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="resolved">Resolved</option>
                </>
              )}
            </select>
          </div>

          {/* Time Filter (For Readings) */}
          {activeTab === 'readings' && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full md:w-auto">
              {timeFilters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setTimeFilter(f.id);
                    setHoveredPoint(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    timeFilter === f.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. TIME SERIES CHART (When on Readings tab) */}
      {activeTab === 'readings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Sensor Reading Timeline
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-0.5 bg-amber-400" /> Warning ({settings.warningThreshold})
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-0.5 bg-red-400" /> Danger ({settings.dangerThreshold})
              </span>
            </div>
          </div>

          {/* Responsive SVG Chart */}
          <div className="relative bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 overflow-hidden">
            {chartData.length > 0 ? (
              <div className="w-full">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-48 overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="gasGradHistory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                      <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Dotted Threshold lines */}
                  <line x1="0" y1={dangerY} x2={chartWidth} y2={dangerY} stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
                  <line x1="0" y1={warningY} x2={chartWidth} y2={warningY} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />

                  {/* Area Fill */}
                  {points && (
                    <polygon
                      points={`0,${chartHeight} ${points} ${chartWidth},${chartHeight}`}
                      fill="url(#gasGradHistory)"
                    />
                  )}

                  {/* Data Polyline */}
                  {points && (
                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points}
                    />
                  )}

                  {/* Interactive Points on tap / click */}
                  {chartData.map((d, idx) => {
                    const cx = (idx / Math.max(1, chartData.length - 1)) * chartWidth;
                    const cy = chartHeight - (d.gas / maxScale) * chartHeight;
                    const isHovered = hoveredPoint === d;
                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 6 : 3}
                        className="cursor-pointer transition-all fill-amber-400 stroke-slate-950 stroke-2 hover:r-6"
                        onClick={() => setHoveredPoint(d)}
                      />
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Activity className="w-8 h-8 opacity-40 animate-pulse" />
                <span>No telemetry readings recorded for this window.</span>
              </div>
            )}

            {/* Hovered Point Card */}
            {hoveredPoint && (
              <div className="mt-3 p-3 bg-slate-900 border border-amber-500/40 rounded-xl text-xs flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-slate-400 block text-[11px]">Selected Timestamp</span>
                  <span className="font-mono text-slate-200">
                    {new Date(hoveredPoint.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[11px]">Gas Concentration</span>
                  <span className="font-mono text-base font-bold text-amber-400">
                    {hoveredPoint.gas} ADC
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. PAGINATED DATA TABLES */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-4 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            {activeTab === 'readings' ? 'Gas Readings Records' : activeTab === 'alerts' ? 'Hazard Alerts Records' : 'Device Events Log'}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Showing {totalItems > 0 ? startIndex + 1 : 0} - {Math.min(endIndex, totalItems)} of {totalItems}
          </span>
        </div>

        {/* Tab 1: Gas Readings Table */}
        {activeTab === 'readings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Time & Date</th>
                  <th className="p-3">Device Node</th>
                  <th className="p-3">Gas Reading</th>
                  <th className="p-3">Gas Status</th>
                  <th className="p-3">Temperature</th>
                  <th className="p-3">Humidity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {paginatedReadings.length > 0 ? (
                  paginatedReadings.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono text-slate-300">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400">
                        {r.deviceId || r.device_id || 'GAS-000001'}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-100">
                        {r.gas} ADC
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'ALERT' ? 'bg-red-500/20 text-red-400' :
                          r.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {r.status || 'NORMAL'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">
                        {r.temperature !== undefined ? `${r.temperature}°C` : '--'}
                      </td>
                      <td className="p-3 text-slate-400 font-mono">
                        {r.humidity !== undefined ? `${r.humidity}%` : '--'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No gas readings match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Alerts Table */}
        {activeTab === 'alerts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Triggered Time</th>
                  <th className="p-3">Device Node</th>
                  <th className="p-3">Gas Peak</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Resolved Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {paginatedAlerts.length > 0 ? (
                  paginatedAlerts.map((a, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono text-slate-300">
                        {new Date(a.startedAt || a.created_at || Date.now()).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400">
                        {a.deviceId}
                      </td>
                      <td className="p-3 font-mono font-bold text-red-400">
                        {a.gasValue} ADC
                      </td>
                      <td className="p-3 font-bold uppercase text-slate-200">
                        {a.severity}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.status === 'active' ? 'bg-red-500 text-white' :
                          a.status === 'acknowledged' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">
                        {a.resolved_at ? new Date(a.resolved_at).toLocaleString() : 'Ongoing'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No alerts match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Device Events Table */}
        {activeTab === 'events' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Device Node</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {paginatedEvents.length > 0 ? (
                  paginatedEvents.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono text-slate-300">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400">
                        {e.device_id}
                      </td>
                      <td className="p-3 font-mono text-slate-200">
                        {e.event_type}
                      </td>
                      <td className="p-3 text-slate-300">
                        {e.message}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No events match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Navigation Controls */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl flex items-center gap-1 font-semibold"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <span className="font-mono text-slate-400 text-[11px]">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl flex items-center gap-1 font-semibold"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
