import React, { useState, useMemo, useEffect } from 'react';
import { 
  Cpu, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Eye, 
  Wifi, 
  WifiOff, 
  Activity, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  X, 
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Radio,
  PlugZap,
  Unplug
} from 'lucide-react';
import { DeviceRecord, DeviceInfo, SensorReading, GasStatus } from '../types';
import { 
  createDevice, 
  updateDevice, 
  deleteDevice, 
  fetchDeviceReadings, 
  isDeviceOnline 
} from '../lib/supabase';
import { getNavigatorSerial } from '../hardware/webSerialTypes';

interface DeviceViewProps {
  devices: DeviceRecord[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  onRefreshDevices: () => Promise<void>;
  deviceInfo: DeviceInfo;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onUpdateDeviceInfo: (updates: Partial<DeviceInfo>) => void;
  onSwitchDeviceType: (type: 'ArduinoUno' | 'ESP32', options?: { baudRate?: number; wsUrl?: string }) => Promise<void>;
}

export const DeviceView: React.FC<DeviceViewProps> = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onRefreshDevices,
  deviceInfo,
  onConnect,
  onDisconnect,
  onUpdateDeviceInfo,
  onSwitchDeviceType,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [detailDevice, setDetailDevice] = useState<DeviceRecord | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceRecord | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<DeviceRecord | null>(null);

  // Form states
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceLocation, setNewDeviceLocation] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<'ESP32' | 'ArduinoUno'>('ESP32');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Device Detail History state
  const [detailHistory, setDetailHistory] = useState<SensorReading[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // WebSerial direct fallback state
  const [showDirectSerial, setShowDirectSerial] = useState(false);
  const [isConnectingSerial, setIsConnectingSerial] = useState(false);
  const isWebSerialSupported = !!getNavigatorSerial();

  // Load history when detail device is opened
  useEffect(() => {
    if (detailDevice) {
      setIsLoadingHistory(true);
      fetchDeviceReadings(detailDevice.id, 50, 24).then((data) => {
        setDetailHistory(data);
        setIsLoadingHistory(false);
      });
    } else {
      setDetailHistory([]);
    }
  }, [detailDevice]);

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch = 
        d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.location.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const online = Boolean(d.isOnlineComputed ?? isDeviceOnline(d.last_seen));
      if (statusFilter === 'online' && !online) return false;
      if (statusFilter === 'offline' && online) return false;

      return true;
    });
  }, [devices, searchTerm, statusFilter]);

  // Relative time helper
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    const ms = Date.now() - new Date(isoString).getTime();
    if (isNaN(ms) || ms < 0) return 'Just now';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 15) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Add Device Submit
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanId = newDeviceId.trim().toUpperCase();
    if (!cleanId) {
      setFormError('Device ID is required (e.g. GAS-000004)');
      return;
    }

    // Check duplicate ID
    if (devices.some((d) => d.id === cleanId)) {
      setFormError(`Device ID "${cleanId}" already exists. Device IDs must be unique.`);
      return;
    }

    if (!newDeviceName.trim()) {
      setFormError('Device Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createDevice({
        id: cleanId,
        name: newDeviceName.trim(),
        location: newDeviceLocation.trim() || 'General Area',
        device_type: newDeviceType,
      });

      await onRefreshDevices();
      setIsAddModalOpen(false);
      setNewDeviceId('');
      setNewDeviceName('');
      setNewDeviceLocation('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create device');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Device Submit
  const handleEditDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      await updateDevice(editingDevice.id, {
        name: editingDevice.name,
        location: editingDevice.location,
      });

      await onRefreshDevices();
      setIsEditModalOpen(false);
      setEditingDevice(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update device');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Device Submit
  const handleDeleteDevice = async () => {
    if (!deletingDevice) return;
    setIsSubmitting(true);
    try {
      await deleteDevice(deletingDevice.id);
      await onRefreshDevices();
      setIsDeleteModalOpen(false);
      setDeletingDevice(null);
      if (detailDevice?.id === deletingDevice.id) {
        setDetailDevice(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete device');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct USB Web Serial Connect
  const handleDirectConnect = async () => {
    setIsConnectingSerial(true);
    try {
      await onConnect();
    } catch (err: any) {
      alert(err.message || 'Failed to connect via Web Serial');
    } finally {
      setIsConnectingSerial(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-24 lg:pb-8">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-amber-400" />
            Device Management Center
          </h2>
          <p className="text-xs text-slate-400">
            Registered MQ-6 hardware telemetry nodes, real-time heartbeat status & provisioning
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Device Node
          </button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, name, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          {(['all', 'online', 'offline'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                statusFilter === filter
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {filter === 'all' ? `All (${devices.length})` : filter}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Devices Grid / List */}
      {filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((dev) => {
            const isOnline = Boolean(dev.isOnlineComputed ?? isDeviceOnline(dev.last_seen));
            const isAlert = dev.currentStatus === 'ALERT';
            const isWarning = dev.currentStatus === 'WARNING';
            const gas = isOnline ? (dev.currentGas ?? '--') : '--';

            return (
              <div
                key={dev.id}
                className={`bg-slate-900/80 border rounded-3xl p-5 backdrop-blur-md transition-all shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 ${
                  isAlert
                    ? 'border-red-500/70 bg-gradient-to-br from-red-950/30 to-slate-900'
                    : isOnline
                    ? 'border-slate-800/80'
                    : 'border-slate-800/50 opacity-80'
                }`}
              >
                {/* Card Top: Node Info & Online Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                        isAlert
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                          : isOnline
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}>
                        {dev.device_type === 'ArduinoUno' ? (
                          <Cpu className="w-5 h-5" />
                        ) : (
                          <Wifi className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold text-amber-400 tracking-wider block">
                          {dev.id}
                        </span>
                        <h3 className="font-extrabold text-sm text-slate-100 truncate max-w-[170px]">
                          {dev.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate max-w-[170px]">
                          {dev.location}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                      isOnline
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`} />
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Gas Reading & Status Pill */}
                  <div className="mt-4 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Gas Level
                      </span>
                      <span className={`text-xl font-black font-mono ${
                        isAlert ? 'text-red-400' : isWarning ? 'text-amber-400' : isOnline ? 'text-slate-100' : 'text-slate-500'
                      }`}>
                        {isOnline ? `${gas} ADC` : '--'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Detection Status
                      </span>
                      <span className={`text-xs font-bold uppercase ${
                        isAlert ? 'text-red-400' : isWarning ? 'text-amber-400' : isOnline ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {isOnline ? (dev.currentStatus || 'NORMAL') : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5" /> Last Communication:
                      </span>
                      <span className="font-mono text-slate-300 font-medium">
                        {getRelativeTime(dev.last_seen)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" /> Registered:
                      </span>
                      <span className="font-mono text-slate-400">
                        {dev.created_at ? new Date(dev.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setDetailDevice(dev)}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    Details & Chart
                  </button>

                  <button
                    onClick={() => {
                      setEditingDevice({ ...dev });
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
                    title="Edit Device"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setDeletingDevice(dev);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
                    title="Deactivate / Delete Node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
          <Cpu className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-200 text-base">No Devices Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'No registered gas detector nodes match your search or status filter.'
              : 'No hardware devices have been connected yet. Click the button below to register your first device.'}
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Device
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: DEVICE DETAILS & REAL-TIME HISTORY CHART             */}
      {/* ============================================================== */}
      {detailDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                {(() => {
                  const isDetailOnline = Boolean(detailDevice.isOnlineComputed ?? isDeviceOnline(detailDevice.last_seen));
                  return (
                    <>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                        isDetailOnline
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {detailDevice.id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isDetailOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {isDetailOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <h3 className="font-black text-lg text-slate-100">{detailDevice.name}</h3>
                        <p className="text-xs text-slate-400">{detailDevice.location}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <button
                onClick={() => setDetailDevice(null)}
                className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Current Gas</span>
                <span className="text-xl font-black font-mono text-slate-100">
                  {detailDevice.currentGas ?? '--'} ADC
                </span>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Detection Status</span>
                <span className={`text-base font-bold uppercase ${
                  detailDevice.currentStatus === 'ALERT' ? 'text-red-400' :
                  detailDevice.currentStatus === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {detailDevice.currentStatus || 'NORMAL'}
                </span>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Last Seen</span>
                <span className="text-xs font-mono font-medium text-slate-300">
                  {getRelativeTime(detailDevice.last_seen)}
                </span>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Hardware Link</span>
                <span className="text-xs font-mono text-slate-300">
                  {detailDevice.connection_type}
                </span>
              </div>
            </div>

            {/* Time-Series Chart */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Gas Level History (Recent Telemetry)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {detailHistory.length} data points
                </span>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 h-44 flex items-center justify-center">
                {isLoadingHistory ? (
                  <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
                ) : detailHistory.length > 1 ? (
                  <svg viewBox="0 0 400 120" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <line x1="0" y1="36" x2="400" y2="36" stroke="#ef4444" strokeDasharray="3 3" opacity="0.5" />
                    <line x1="0" y1="72" x2="400" y2="72" stroke="#f59e0b" strokeDasharray="3 3" opacity="0.5" />
                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={detailHistory.map((d, i) => {
                        const x = (i / Math.max(1, detailHistory.length - 1)) * 400;
                        const y = 120 - Math.min(120, (d.gas / 1000) * 120);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(' ')}
                    />
                  </svg>
                ) : (
                  <p className="text-xs text-slate-500">Not enough history points recorded yet.</p>
                )}
              </div>
            </div>

            {/* Recent Readings Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Recent Readings Table
              </span>
              <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5">Time</th>
                      <th className="p-2.5">Gas Reading</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {detailHistory.slice(-10).reverse().map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono text-slate-400">
                          {new Date(r.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-slate-200">
                          {r.gas} ADC
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'ALERT' ? 'bg-red-500/20 text-red-400' :
                            r.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {r.status || 'NORMAL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setDetailDevice(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL: ADD NEW DEVICE                                      */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Register New Gas Detector
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddDevice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Device ID <span className="text-amber-400">*</span> (Unique Hardware Identifier)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GAS-000004"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono uppercase focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500">
                  Matches the unique device identifier programmed into your ESP32.
                </span>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Device Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Living Room Gas Sensor"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Physical Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kitchen / Cylinder Bank"
                  value={newDeviceLocation}
                  onChange={(e) => setNewDeviceLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Hardware Microcontroller
                </label>
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="ESP32">ESP32 (Wi-Fi HTTP Cloud Telemetry)</option>
                  <option value="ArduinoUno">Arduino UNO (Serial / Local Hub)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL: EDIT DEVICE                                         */}
      {/* ============================================================== */}
      {isEditModalOpen && editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Edit Device: {editingDevice.id}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditDevice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Device Name</label>
                <input
                  type="text"
                  required
                  value={editingDevice.name}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Physical Location</label>
                <input
                  type="text"
                  value={editingDevice.location}
                  onChange={(e) => setEditingDevice({ ...editingDevice, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. MODAL: DELETE / DEACTIVATE CONFIRMATION                     */}
      {/* ============================================================== */}
      {isDeleteModalOpen && deletingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-extrabold text-base text-slate-100">
                Deactivate Device {deletingDevice.id}?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to remove <strong className="text-white">{deletingDevice.name}</strong>? Telemetry logs and alerts associated with this device will be cleared from Supabase.
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDevice}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow"
              >
                {isSubmitting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. OPTIONAL: DIRECT HARDWARE WEB SERIAL INTERFACE             */}
      {/* ============================================================== */}
      <div className="mt-8 pt-6 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              Direct Serial Hardware Diagnostic Port
            </h4>
            <p className="text-[11px] text-slate-500">
              Optional USB Web Serial bridge for local debugging or flashing calibration
            </p>
          </div>

          <button
            onClick={() => setShowDirectSerial(!showDirectSerial)}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            {showDirectSerial ? 'Hide Port' : 'Show Port'}
          </button>
        </div>

        {showDirectSerial && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                deviceInfo.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-200">Web Serial USB Interface</div>
                <div className="text-[11px] text-slate-400">
                  Status: <span className="capitalize font-mono text-amber-400">{deviceInfo.status}</span> • 9600 Baud
                </div>
              </div>
            </div>

            {deviceInfo.status !== 'connected' ? (
              <button
                onClick={handleDirectConnect}
                disabled={!isWebSerialSupported || isConnectingSerial}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                <PlugZap className="w-3.5 h-3.5 text-amber-400" />
                {isConnectingSerial ? 'Connecting...' : 'Connect USB Serial'}
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Unplug className="w-3.5 h-3.5" />
                Disconnect Port
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
