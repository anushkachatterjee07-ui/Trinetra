import { useEffect, useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Thermometer,
  Wind,
  Activity,
  CloudRain,
  Shield,
  AlertTriangle,
  HelpCircle,
  Cpu,
  HeartPulse,
  Bell,
  Server,
} from 'lucide-react';
import { telemetrySocket } from '../services/websocket';
import { API_BASE_URL } from '../services/api';
import { ActiveIncidents } from './ActiveIncidents';
import type { Incident, Resource } from './ActiveIncidents';
import { ResourceStatus } from './ResourceStatus';
import { RealTimeLog } from './RealTimeLog';
import type { SystemLog } from './RealTimeLog';
import { GeoMap } from './GeoMap';
import { TerminalFeed } from './TerminalFeed';

type TelemetryData = {
  sector: string;
  temperature: number;
  wind_speed: number;
  humidity: number;
  rainfall: number;
  seismic_activity: number;
  sensor_integrity: number;
  timestamp: string;
};

type AnalysisData = {
  detected: boolean;
  type: string;
  severity: string;
  impact_score: number;
  description: string;
};

export const CommandCenter: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryData | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisData | null>(null);

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const [incidentsResponse, resourcesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/incidents`),
          fetch(`${API_BASE_URL}/api/resources`),
        ]);

        if (incidentsResponse.ok && resourcesResponse.ok) {
          const [incidentData, resourceData] = await Promise.all([
            incidentsResponse.json(),
            resourcesResponse.json(),
          ]);

          setIncidents(incidentData || []);
          setResources(resourceData || []);
          setConnectionStatus('connected');
          setLogs([{
            id: 'init-log',
            timestamp: new Date().toLocaleTimeString(),
            level: 'INFO',
            message: 'Backend state loaded successfully from FastAPI endpoints.'
          }]);
        }
      } catch (error) {
        console.error('Unable to load backend state:', error);
      }
    };

    loadInitialState();

    // 1. Connect WebSocket
    telemetrySocket.connect();

    // 2. Status change listener
    const unsubStatus = telemetrySocket.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // 3. Register state updates
    const unsubInit = telemetrySocket.subscribe('INIT_STATE', (data) => {
      setIncidents(data.incidents || []);
      setResources(data.resources || []);
      setLogs([{
        id: 'init-log',
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        message: 'System initialization successful. Loaded active incident and resource tables.'
      }]);
    });

    const unsubTelemetry = telemetrySocket.subscribe('TELEMETRY', (data) => {
      setLatestTelemetry(data.telemetry);
      setLatestAnalysis(data.analysis);
    });

    const unsubIncNew = telemetrySocket.subscribe('INCIDENT_NEW', (incident: Incident) => {
      setIncidents((prev) => [incident, ...prev.filter((i) => i.id !== incident.id)]);
    });

    const unsubIncUpdate = telemetrySocket.subscribe('INCIDENT_UPDATE', (incident: Incident) => {
      setIncidents((prev) => prev.map((i) => (i.id === incident.id ? incident : i)));
    });

    const unsubResUpdate = telemetrySocket.subscribe('RESOURCE_UPDATE', (resource: Resource) => {
      setResources((prev) => prev.map((r) => (r.id === resource.id ? resource : r)));
    });

    const unsubSysLog = telemetrySocket.subscribe('SYSTEM_LOG', (log: SystemLog) => {
      setLogs((prev) => [...prev, log]);
    });

    return () => {
      unsubStatus();
      unsubInit();
      unsubTelemetry();
      unsubIncNew();
      unsubIncUpdate();
      unsubResUpdate();
      unsubSysLog();
      telemetrySocket.disconnect();
    };
  }, []);

  const handleResolve = (incidentId: string) => {
    telemetrySocket.send('RESOLVE_INCIDENT', { incident_id: incidentId });
  };

  const handleDispatch = async (resourceId: string, incidentId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/resources/${resourceId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error('Dispatch failed:', errData.detail);
      }
    } catch (e) {
      console.error('Network error during dispatch:', e);
    }
  };

  const handleStatusChange = async (resourceId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/resources/${resourceId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        console.error('Status update failed');
      }
    } catch (e) {
      console.error('Network error updating status:', e);
    }
  };

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 rounded-full">
            <Wifi className="w-3.5 h-3.5" />
            TELEMETRY LINK: ONLINE
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-amber-950/60 border border-amber-800/80 text-amber-400 rounded-full animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            TELEMETRY LINK: RECONNECTING
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-red-950/60 border border-red-800/80 text-red-400 rounded-full">
            <WifiOff className="w-3.5 h-3.5" />
            TELEMETRY LINK: OFFLINE
          </span>
        );
    }
  };

  const activeAlerts = incidents.filter((i) => i.status !== 'Resolved').length;
  const systemHealthLabel = connectionStatus === 'connected' ? 'Nominal' : connectionStatus === 'connecting' ? 'Degraded' : 'Critical';
  const systemHealthClass = connectionStatus === 'connected'
    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
    : connectionStatus === 'connecting'
      ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
      : 'bg-red-950/60 border-red-700/60 text-red-300';
  const aiStateLabel = latestAnalysis?.detected ? 'Alert' : 'Standby';
  const aiStateClass = latestAnalysis?.detected
    ? 'bg-red-950/60 border-red-700/60 text-red-300'
    : 'bg-sky-950/60 border-sky-700/60 text-sky-300';
  const sensorIntegrityLabel = latestTelemetry ? `${latestTelemetry.sensor_integrity}%` : '--';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 space-y-6">
      <div className="glass-card rounded-[32px] p-6 border border-slate-700/60 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.9)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-3xl bg-slate-950/60 border border-slate-700/80 px-4 py-2">
              <Shield className="w-6 h-6 text-violet-400" />
              <span className="text-[11px] uppercase tracking-[0.36em] text-slate-400">Tactical Operations</span>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Tactical Command Center</h1>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl">High-contrast operational dashboard for rapid incident triage, intelligent dispatch, and live AI telemetry monitoring.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Link Status</div>
              <div className="mt-4">{getConnectionBadge()}</div>
            </div>
            <div className="rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Last update</div>
              <div className="mt-4 text-sm font-semibold text-slate-100">
                {latestTelemetry ? new Date(latestTelemetry.timestamp).toLocaleTimeString() : 'Awaiting telemetry'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5">
          <div className="glass-card rounded-3xl p-4 border border-slate-700/60 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 text-sky-300 border border-sky-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">System Health</div>
              <div className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${systemHealthClass}`}>
                {systemHealthLabel}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-4 border border-slate-700/60 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 text-emerald-300 border border-emerald-500/20">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">AI State</div>
              <div className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${aiStateClass}`}>
                {aiStateLabel}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-4 border border-slate-700/60 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 text-violet-300 border border-violet-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Active Alerts</div>
              <div className="mt-2 text-2xl font-black text-white">{activeAlerts}</div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-4 border border-slate-700/60 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/90 text-cyan-300 border border-cyan-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sensor Integrity</div>
              <div className="mt-2 text-2xl font-black text-white">{sensorIntegrityLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="glass-card rounded-3xl p-4 flex flex-col justify-between h-32 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-[0.26em]">Sector Location</span>
            <HelpCircle className="w-4 h-4 opacity-60" />
          </div>
          <div className="text-sm font-extrabold text-slate-100 truncate mt-3">
            {latestTelemetry ? latestTelemetry.sector : 'Awaiting data...'}
          </div>
          <span className="text-[9px] text-slate-500">Active telemetry sector</span>
        </div>

        <div className="glass-card rounded-3xl p-4 flex flex-col justify-between h-32 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-[0.26em]">Temperature</span>
            <Thermometer className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-3xl font-black text-orange-400 mt-3">
            {latestTelemetry ? `${latestTelemetry.temperature}°C` : '--'}
          </div>
          <div className="w-full bg-slate-900/80 h-1 rounded-full overflow-hidden">
            <div
              className="bg-orange-500 h-full transition-all duration-300"
              style={{ width: latestTelemetry ? `${Math.min(100, Math.max(0, (latestTelemetry.temperature / 60) * 100))}%` : '0%' }}
            />
          </div>
        </div>

        <div className="glass-card rounded-3xl p-4 flex flex-col justify-between h-32 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-[0.26em]">Wind Speed</span>
            <Wind className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-black text-sky-400 mt-3">
            {latestTelemetry ? `${latestTelemetry.wind_speed} km/h` : '--'}
          </div>
          <div className="w-full bg-slate-900/80 h-1 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all duration-300"
              style={{ width: latestTelemetry ? `${Math.min(100, Math.max(0, (latestTelemetry.wind_speed / 120) * 100))}%` : '0%' }}
            />
          </div>
        </div>

        <div className="glass-card rounded-3xl p-4 flex flex-col justify-between h-32 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-[0.26em]">Precipitation</span>
            <CloudRain className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-blue-400 mt-3">
            {latestTelemetry ? `${latestTelemetry.rainfall} mm` : '--'}
          </div>
          <div className="w-full bg-slate-900/80 h-1 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: latestTelemetry ? `${Math.min(100, Math.max(0, (latestTelemetry.rainfall / 120) * 100))}%` : '0%' }}
            />
          </div>
        </div>

        <div className="glass-card rounded-3xl p-4 flex flex-col justify-between h-32 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-[0.26em]">Seismic Activity</span>
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-3">
            {latestTelemetry ? `${latestTelemetry.seismic_activity} Mg` : '--'}
          </div>
          <div className="w-full bg-slate-900/80 h-1 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: latestTelemetry ? `${Math.min(100, Math.max(0, (latestTelemetry.seismic_activity / 8) * 100))}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {latestAnalysis && latestAnalysis.detected && (
        <div className={`p-4 rounded-3xl border flex gap-3 items-center transition ${
          latestAnalysis.severity === 'Critical'
            ? 'bg-red-950/35 border-red-800/80 text-red-300 glow-critical'
            : 'bg-amber-950/35 border-amber-800/80 text-amber-300'
        }`}>
          <AlertTriangle
            className={`w-5 h-5 flex-shrink-0 ${latestAnalysis.severity === 'Critical' ? 'animate-bounce text-red-500' : 'text-amber-500'}`}
          />
          <div className="text-xs text-slate-200">
            <span className="font-bold">AI Threat Matrix</span>
            <span className="ml-2 text-slate-400">{latestAnalysis.type} / {latestAnalysis.severity} / Score {latestAnalysis.impact_score}/10</span>
            <div className="mt-1 text-[11px] text-slate-300">{latestAnalysis.description}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-6">
          <GeoMap incidents={incidents} latestTelemetry={latestTelemetry} latestAnalysis={latestAnalysis} />
          <TerminalFeed latestTelemetry={latestTelemetry} incidents={incidents} resources={resources} />
        </div>
        <div className="xl:col-span-5 space-y-6">
          <ActiveIncidents incidents={incidents} onResolve={handleResolve} onDispatch={handleDispatch} />
          <ResourceStatus resources={resources} onStatusChange={handleStatusChange} />
          <RealTimeLog logs={logs} />
        </div>
      </div>
    </div>
  );
};
