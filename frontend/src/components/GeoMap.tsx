import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Layers, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

type IncidentLike = {
  id: string;
  type: string;
  severity: string;
  location: string;
  latitude: number;
  longitude: number;
  status: string;
  description: string;
};

type TelemetryLike = {
  sector?: string;
  rainfall?: number;
  temperature?: number;
  wind_speed?: number;
  humidity?: number;
  timestamp?: string;
};

type AnalysisLike = {
  detected?: boolean;
  type?: string;
  severity?: string;
  impact_score?: number;
  description?: string;
};

type GeoMapProps = {
  incidents?: IncidentLike[];
  latestTelemetry?: TelemetryLike | null;
  latestAnalysis?: AnalysisLike | null;
};

type LayerKey = 'roads' | 'hazards' | 'assets' | 'grid';
type ViewMode = 'standard' | 'evacuation';

type HeatmapZone = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clearanceTime: number;
  label: string;
};

type MapItem = {
  id: string;
  label: string;
  location: string;
  type: 'hazard' | 'road' | 'asset';
  status: string;
  x: number;
  y: number;
  color: string;
  details: string;
};

const createMapItems = (
  incidents: IncidentLike[],
  latestTelemetry: TelemetryLike | null,
  latestAnalysis: AnalysisLike | null
): MapItem[] => {
  const hazardItems = incidents
    .filter((incident) => incident.status !== 'Resolved')
    .map((incident, index) => {
      const x = 20 + (index % 3) * 23;
      const y = 16 + Math.floor(index / 3) * 16;
      const color = incident.severity === 'Critical' ? '#f87171' : incident.severity === 'High' ? '#fbbf24' : '#38bdf8';
      return {
        id: `HZ-${incident.id}`,
        label: incident.type,
        location: incident.location,
        type: 'hazard' as const,
        status: incident.severity,
        x,
        y,
        color,
        details: `${incident.description} (${incident.location})`,
      };
    });

  const telemetrySector = latestTelemetry?.sector || 'West Bengal';
  const liveThreat = latestAnalysis?.detected
    ? {
        id: 'HZ-LIVE',
        label: latestAnalysis.type || 'Live Threat',
        location: telemetrySector,
        type: 'hazard' as const,
        status: latestAnalysis.severity || 'Alert',
        x: 68,
        y: 25,
        color: latestAnalysis.severity === 'Critical' ? '#f87171' : latestAnalysis.severity === 'High' ? '#fbbf24' : '#38bdf8',
        details: latestAnalysis.description || 'Live telemetry indicates a developing operational threat.',
      }
    : null;

  const mergedHazards = liveThreat && !hazardItems.some((item) => item.label === liveThreat.label)
    ? [...hazardItems, liveThreat]
    : hazardItems;
  const telemetryText = latestTelemetry
    ? `${telemetrySector} • Rain ${latestTelemetry.rainfall ?? 0} mm • Wind ${latestTelemetry.wind_speed ?? 0} km/h`
    : 'Telemetry unavailable';

  return [
    ...mergedHazards,
    {
      id: 'AS-01',
      label: 'Live Ops Asset',
      location: telemetrySector,
      type: 'asset',
      status: 'Available',
      x: 42,
      y: 55,
      color: '#4ade80',
      details: telemetryText,
    },
    {
      id: 'AS-02',
      label: 'Response Coordination',
      location: 'West Bengal Corridor',
      type: 'asset',
      status: 'Dispatched',
      x: 82,
      y: 62,
      color: '#38bdf8',
      details: 'Current route and asset status is synchronized with the FastAPI backend.',
    },
  ];
};

const getHeatmapColor = (clearanceTime: number) => {
  if (clearanceTime < 15) return '#34d399';
  if (clearanceTime > 60) return '#f87171';
  return '#fbbf24';
};

const createHeatmapZones = (
  incidents: IncidentLike[],
  latestTelemetry: TelemetryLike | null,
  latestAnalysis: AnalysisLike | null
): HeatmapZone[] => {
  const activeIncidents = incidents.filter((incident) => incident.status !== 'Resolved').length;
  const rainfall = latestTelemetry?.rainfall ?? 0;
  const wind = latestTelemetry?.wind_speed ?? 0;
  const impact = latestAnalysis?.impact_score ?? 0;

  return [
    {
      id: 'HZ-FAST',
      x: 10,
      y: 12,
      width: 28,
      height: 18,
      clearanceTime: Math.max(8, 12 + Math.max(0, rainfall - 30) / 20),
      label: 'Fast',
    },
    {
      id: 'HZ-MEDIUM',
      x: 40,
      y: 24,
      width: 24,
      height: 18,
      clearanceTime: Math.max(18, 24 + activeIncidents * 3 + impact / 8 + wind / 12),
      label: 'Moderate',
    },
    {
      id: 'HZ-SLOW',
      x: 66,
      y: 42,
      width: 22,
      height: 16,
      clearanceTime: Math.max(60, 64 + activeIncidents * 4 + rainfall / 12 + impact / 5),
      label: 'Slow',
    },
  ];
};

const roads = [
  {
    id: 'RD-01',
    path: 'M10 10 L90 10 L90 28 L70 28 L70 48 L42 48 L42 64',
    thickness: 3,
    color: '#22d3ee',
  },
  {
    id: 'RD-02',
    path: 'M12 24 L34 24 L34 44 L58 44 L58 20 L88 20',
    thickness: 2,
    color: '#7c3aed',
  },
  {
    id: 'RD-03',
    path: 'M16 60 L31 46 L52 46 L52 26 L69 26 L69 15',
    thickness: 2,
    color: '#60a5fa',
  },
];

export const GeoMap: React.FC<GeoMapProps> = ({ incidents = [], latestTelemetry = null, latestAnalysis = null }) => {
  const [layerState, setLayerState] = useState<Record<LayerKey, boolean>>({
    roads: true,
    hazards: true,
    assets: true,
    grid: true,
  });
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [selectedMarker, setSelectedMarker] = useState<MapItem | null>(null);
  const [backendHeatmapZones, setBackendHeatmapZones] = useState<HeatmapZone[]>([]);
  const mapItems = useMemo(() => createMapItems(incidents, latestTelemetry, latestAnalysis), [incidents, latestTelemetry, latestAnalysis]);
  const evacuationZones = useMemo(() => {
    if (backendHeatmapZones.length > 0) {
      return backendHeatmapZones.map((zone) => ({
        ...zone,
        clearanceTime: zone.clearanceTime,
      }));
    }

    return createHeatmapZones(incidents, latestTelemetry, latestAnalysis);
  }, [backendHeatmapZones, incidents, latestTelemetry, latestAnalysis]);

  useEffect(() => {
    let isCancelled = false;

    const loadHeatmap = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ops/evacuation-heatmap`);
        if (!response.ok || isCancelled) {
          return;
        }

        const payload = await response.json();
        if (!payload?.zones || isCancelled) {
          return;
        }

        setBackendHeatmapZones(
          payload.zones.map((zone: { id: string; x: number; y: number; width: number; height: number; clearance_time: number; label: string }) => ({
            id: zone.id,
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            clearanceTime: zone.clearance_time,
            label: zone.label,
          }))
        );
      } catch (error) {
        if (!isCancelled) {
          console.error('Unable to load evacuation heatmap:', error);
        }
      }
    };

    void loadHeatmap();
    const intervalId = window.setInterval(() => {
      void loadHeatmap();
    }, 3000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [latestTelemetry?.timestamp, latestAnalysis?.impact_score, incidents.length]);

  const legendItems = useMemo(() => {
    const baseItems = [
      { label: 'Primary Route', color: '#22d3ee' },
      { label: 'Secondary Corridor', color: '#7c3aed' },
      { label: 'Hazard Marker', color: '#f87171' },
      { label: 'Responder Asset', color: '#4ade80' },
    ];

    if (viewMode === 'evacuation') {
      return [
        ...baseItems,
        { label: 'Fast clearance (<15 min)', color: '#34d399' },
        { label: 'Moderate clearance (15-60 min)', color: '#fbbf24' },
        { label: 'Slow clearance (>60 min)', color: '#f87171' },
      ];
    }

    return baseItems;
  }, [viewMode]);

  const toggleLayer = (key: LayerKey) => {
    setLayerState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hazardCount = mapItems.filter((item) => item.type === 'hazard').length;

  return (
    <div className="glass-card rounded-[32px] border border-slate-700/60 p-5 shadow-[0_10px_35px_-18px_rgba(15,23,42,0.9)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-slate-400">
            <Layers className="w-4 h-4 text-sky-400" />
            Geo-Vector View
          </div>
          <h2 className="mt-3 text-2xl font-bold text-white">West Bengal Geospatial Map Viewport</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">Interactive vector rendering of Kolkata, Howrah, Digha, Siliguri, and Sundarbans corridors for rapid situational awareness.</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'standard' as ViewMode, label: 'Standard' },
              { key: 'evacuation' as ViewMode, label: 'Evacuation Heatmap' },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setViewMode(mode.key)}
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                  viewMode === mode.key
                    ? 'border-violet-400/40 bg-violet-500/10 text-violet-200'
                    : 'border-slate-700/70 bg-slate-950/80 text-slate-400 hover:border-slate-500/60'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                { key: 'grid' as LayerKey, label: 'Grid', active: layerState.grid },
                { key: 'roads' as LayerKey, label: 'Roads', active: layerState.roads },
                { key: 'hazards' as LayerKey, label: 'Hazards', active: layerState.hazards },
                { key: 'assets' as LayerKey, label: 'Assets', active: layerState.assets },
              ]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleLayer(item.key)}
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                  item.active
                    ? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
                    : 'border-slate-700/70 bg-slate-950/80 text-slate-400 hover:border-slate-500/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[2.2fr_0.8fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-950/80 shadow-inner">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(248,113,113,0.12),transparent_25%)] pointer-events-none" />
          <svg viewBox="0 0 100 70" className="h-[420px] w-full">
            {layerState.grid && (
              <g stroke="#64748b" strokeWidth="0.15" opacity="0.3">
                <path d="M0 10 H100" />
                <path d="M0 20 H100" />
                <path d="M0 30 H100" />
                <path d="M0 40 H100" />
                <path d="M0 50 H100" />
                <path d="M0 60 H100" />
                <path d="M10 0 V70" />
                <path d="M20 0 V70" />
                <path d="M30 0 V70" />
                <path d="M40 0 V70" />
                <path d="M50 0 V70" />
                <path d="M60 0 V70" />
                <path d="M70 0 V70" />
                <path d="M80 0 V70" />
                <path d="M90 0 V70" />
              </g>
            )}

            {viewMode === 'evacuation' &&
              evacuationZones.map((zone) => {
                const color = getHeatmapColor(zone.clearanceTime);
                return (
                  <g key={zone.id}>
                    <rect
                      x={zone.x}
                      y={zone.y}
                      width={zone.width}
                      height={zone.height}
                      rx="3"
                      fill={color}
                      fillOpacity="0.24"
                      stroke={color}
                      strokeWidth="0.6"
                    />
                    <text x={zone.x + 2} y={zone.y + 5} fill="#f8fafc" fontSize="2.2" fontWeight="600">
                      {zone.label}
                    </text>
                    <text x={zone.x + 2} y={zone.y + 8.2} fill="#e2e8f0" fontSize="1.7">
                      {`${zone.clearanceTime.toFixed(0)} min`}
                    </text>
                  </g>
                );
              })}

            {layerState.roads &&
              roads.map((road) => (
                <path
                  key={road.id}
                  d={road.path}
                  fill="none"
                  stroke={road.color}
                  strokeWidth={road.thickness}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
              ))}

            {layerState.hazards &&
              mapItems
                .filter((item) => item.type === 'hazard')
                .map((item) => (
                  <g key={item.id}>
                    <circle
                      cx={item.x}
                      cy={item.y}
                      r="3.3"
                      fill={item.color}
                      stroke="#fff"
                      strokeWidth="0.5"
                      className="cursor-pointer"
                      onClick={() => setSelectedMarker(item)}
                    />
                    <circle
                      cx={item.x}
                      cy={item.y}
                      r="6"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="0.5"
                      opacity="0.35"
                    />
                  </g>
                ))}

            {layerState.assets &&
              mapItems
                .filter((item) => item.type === 'asset')
                .map((item) => (
                  <polygon
                    key={item.id}
                    points={`${item.x},${item.y - 3} ${item.x - 3},${item.y + 4} ${item.x + 3},${item.y + 4}`}
                    fill={item.color}
                    stroke="#e2e8f0"
                    strokeWidth="0.4"
                    className="cursor-pointer"
                    onClick={() => setSelectedMarker(item)}
                  />
                ))}
          </svg>
          <div className="absolute bottom-4 left-4 rounded-3xl border border-slate-700/70 bg-slate-950/90 px-4 py-3 text-sm text-slate-300 shadow-lg backdrop-blur">
            <div className="font-semibold text-slate-100">Map View</div>
            <div className="text-xs text-slate-500">{viewMode === 'evacuation' ? 'Evacuation clearance zones overlaid on the live vector map and refreshed from FastAPI.' : 'Vector layer rendering with interactive marker selection.'}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-3xl border border-slate-700/60 p-4 bg-slate-950/90">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              Operational Notes
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>Active route and hazard overlays are shown in real time. Tap markers for situational details.</p>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                {hazardCount} hazard zones currently active
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/60 p-4 bg-slate-950/90">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Layer Legend</p>
              </div>
              <div className="text-xs text-slate-400">Click markers for details</div>
            </div>
            <div className="mt-4 space-y-3">
              {legendItems.map((entry) => (
                <div key={entry.label} className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-slate-300">{entry.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-700/60 p-4 bg-slate-950/90">
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Selection Panel</p>
            {selectedMarker ? (
              <div className="mt-4 space-y-2 rounded-3xl border border-slate-700/50 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedMarker.label}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{selectedMarker.location}</p>
                  </div>
                  <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-slate-200 border border-slate-700/60">{selectedMarker.status}</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-300">{selectedMarker.details}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-slate-700/50 bg-slate-950/80 p-4 text-sm text-slate-400">
                Tap a hazard or asset marker to inspect its routing and deployment details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
