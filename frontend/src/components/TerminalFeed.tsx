import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Gauge, Radio, Route, ShieldCheck, Sparkles, TerminalSquare } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

type TelemetrySnapshot = {
  sector?: string;
  temperature?: number;
  wind_speed?: number;
  humidity?: number;
  rainfall?: number;
  seismic_activity?: number;
  timestamp?: string;
};

type IncidentLike = {
  id: string;
  location: string;
  severity: string;
  status: string;
};

type ResourceLike = {
  id: string;
  name: string;
  status: string;
  location: string;
};

interface TerminalFeedProps {
  latestTelemetry: TelemetrySnapshot | null;
  incidents: IncidentLike[];
  resources: ResourceLike[];
}

type FeedEntry = {
  id: number;
  prompt: string;
  output: string;
  timestamp: string;
};

const samplePrompt = 'If a flood happens here today, which roads should remain open?';

const statusTone = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (value.includes('open')) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (value.includes('blocked') || value.includes('restricted')) return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
  return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
};

const capacityTone = (capacity?: string) => {
  const value = (capacity || '').toLowerCase();
  if (value.includes('high')) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (value.includes('medium')) return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  return 'border-slate-500/40 bg-slate-500/10 text-slate-300';
};

const buildResponse = (prompt: string, telemetry: TelemetrySnapshot | null, incidents: IncidentLike[], resources: ResourceLike[]) => {
  const floodMatch = /flood|storm|rain/i.test(prompt);
  const sector = telemetry?.sector || 'North Delta Corridor';
  const rainfall = telemetry?.rainfall ?? 56;
  const hazardCount = incidents.filter((item) => item.status !== 'Resolved').length;
  const availableAssets = resources.filter((item) => item.status === 'Available').length;

  const recommendedOpen = floodMatch
    ? ['NH-12 Kolkata–Howrah', 'NH-16 Kolkata–Digha', 'NH-10 Siliguri–Bagdogra']
    : ['NH-12 Kolkata–Howrah', 'Sundarbans Embankment Link', 'NH-16 Kolkata–Digha'];

  const restricted = floodMatch
    ? ['Hooghly Connector', 'Digha Sea-Wall Segment', 'Mahananda River Crossing']
    : ['Mahananda River Crossing'];

  return {
    query: prompt,
    sector: sector.includes('West Bengal') ? sector : `${sector} (West Bengal)`,
    scenario: floodMatch ? 'Flooding' : 'General Operations',
    rainfall_mm: rainfall,
    recommended_open_roads: recommendedOpen,
    restricted_roads: restricted,
    active_incidents: hazardCount,
    available_assets: availableAssets,
    guidance: floodMatch
      ? 'Keep arterial routes open for evacuation and reserve alternate corridors for medical support.'
      : 'Preserve main access corridors and maintain reserve capacity near staging areas.',
    timestamp: new Date().toISOString(),
  };
};

export const TerminalFeed: React.FC<TerminalFeedProps> = ({ latestTelemetry, incidents, resources }) => {
  const [query, setQuery] = useState(samplePrompt);
  const [entries, setEntries] = useState<FeedEntry[]>([
    {
      id: 1,
      prompt: 'Sample query',
      output: '{\n  "status": "ready",\n  "scenario": "standby",\n  "recommended_open_roads": ["NH-12 Kolkata–Howrah", "NH-16 Kolkata–Digha"]\n}',
      timestamp: 'System ready',
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  const quickPrompts = useMemo(
    () => [
      'If a flood happens here today, which roads should remain open?',
      'Where is the nearest elevated flood shelter in South 24 Parganas?',
      'What are the standard evacuation steps during a flash flood?',
      'Which assets should be kept closest to the wildfire corridor?',
    ],
    []
  );

  const handleRunQuery = async () => {
    const entryId = Date.now();
    const nextEntry: FeedEntry = {
      id: entryId,
      prompt: query,
      output: '',
      timestamp: new Date().toLocaleTimeString(),
    };

    setEntries((prev) => [nextEntry, ...prev]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ops/routing-analysis?prompt=${encodeURIComponent(query)}`);
      const parsed = await response.json();
      const payload = {
        query,
        telemetry: latestTelemetry,
        active_lifeline_corridors: parsed?.active_lifeline_corridors || [],
        road_capacities: parsed?.road_capacities || {},
        blocked_segments: parsed?.blocked_segments || [],
        summary: parsed?.summary || buildResponse(query, latestTelemetry, incidents, resources),
      };

      const jsonText = JSON.stringify(payload, null, 2);
      let cursor = 0;
      const timer = window.setInterval(() => {
        cursor += 1;
        setEntries((prev) =>
          prev.map((entry) => (entry.id === entryId ? { ...entry, output: jsonText.slice(0, cursor) } : entry))
        );

        if (cursor >= jsonText.length) {
          window.clearInterval(timer);
          setIsStreaming(false);
        }
      }, 10);
    } catch (error) {
      const fallbackPayload = buildResponse(query, latestTelemetry, incidents, resources);
      const jsonText = JSON.stringify({
        ...fallbackPayload,
        active_lifeline_corridors: [],
        road_capacities: {
          'Route 2C': 'High',
          'Route 4A': 'Medium',
          'Route 9B': 'High',
        },
        blocked_segments: ['Hooghly Connector', 'Digha Sea-Wall Segment'],
      }, null, 2);
      let cursor = 0;
      const timer = window.setInterval(() => {
        cursor += 1;
        setEntries((prev) =>
          prev.map((entry) => (entry.id === entryId ? { ...entry, output: jsonText.slice(0, cursor) } : entry))
        );

        if (cursor >= jsonText.length) {
          window.clearInterval(timer);
          setIsStreaming(false);
        }
      }, 10);
    }
  };

  return (
    <div className="glass-card rounded-[32px] border border-slate-700/60 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-slate-400">
            <TerminalSquare className="w-4 h-4 text-emerald-300" />
            Tactical Terminal
          </div>
          <h3 className="mt-3 text-xl font-bold text-white">Live JSON query stream</h3>
          <p className="mt-2 text-sm text-slate-400">Issue operational queries and watch a structured response stream in real time.</p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-300">
          <Radio className={`w-3.5 h-3.5 ${isStreaming ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
          {isStreaming ? 'Streaming response…' : 'Awaiting query'}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={4}
            spellCheck={false}
            className="min-h-[128px] flex-1 rounded-2xl border border-slate-700/70 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 outline-none ring-0 placeholder:text-slate-500 resize-y"
            placeholder="Enter a natural-language inquiry such as: Where is the nearest elevated flood shelter in South 24 Parganas?"
          />
          <p className="text-[11px] text-slate-500">Multi-line and long-form inquiries are supported. Press Run Query to send your message.</p>
        </div>
        <button
          type="button"
          onClick={handleRunQuery}
          className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 self-start"
        >
          <Sparkles className="w-4 h-4" />
          Run query
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setQuery(prompt)}
            className="rounded-full border border-slate-700/70 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400 transition hover:border-slate-500/70 hover:text-slate-200"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-700/70 bg-slate-950/90 p-4 font-mono text-xs text-slate-200">
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-500">
          <span>Response stream</span>
          <span className="rounded-full border border-slate-700/70 px-2 py-1">JSON</span>
        </div>

        <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
          {entries.map((entry) => {
            let parsedPayload: Record<string, any> | null = null;
            try {
              parsedPayload = entry.output ? JSON.parse(entry.output) : null;
            } catch {
              parsedPayload = null;
            }

            return (
              <div key={entry.id} className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                  <span className="flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5" />
                    {entry.timestamp}
                  </span>
                  <span className="text-slate-400">{entry.prompt}</span>
                </div>

                {parsedPayload ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${parsedPayload.scenario?.toLowerCase() === 'flooding' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-sky-500/30 bg-sky-500/10 text-sky-300'}`}>
                        {parsedPayload.scenario || 'Operational'}
                      </span>
                      <span className="rounded-full border border-slate-700/70 bg-slate-800/80 px-2.5 py-1 text-[10px] text-slate-300">
                        {parsedPayload.sector || 'Sector unknown'}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-3">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                          <Route className="w-3.5 h-3.5 text-violet-300" />
                          Lifeline corridors
                        </div>
                        <div className="mt-3 space-y-2">
                          {(parsedPayload.active_lifeline_corridors || []).map((item: any, index: number) => (
                            <div key={`${item.road}-${index}`} className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-slate-100">{item.road}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusTone(item.status)}`}>{item.status || 'Open'}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Capacity</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${capacityTone(item.capacity)}`}>{item.capacity || 'Unknown'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-3">
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                            <Gauge className="w-3.5 h-3.5 text-emerald-300" />
                            Road capacities
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(parsedPayload.road_capacities || {}).map(([road, value]) => (
                              <span key={road} className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[10px] text-slate-200">
                                {road}: <span className="ml-1 text-slate-400">{String(value)}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-3">
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                            Blocked segments
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(parsedPayload.blocked_segments || []).map((segment: string) => (
                              <span key={segment} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] text-rose-200">
                                {segment}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                        Operational summary
                      </div>
                      <p className="mt-2 text-[11px] leading-6 text-slate-300">
                        {parsedPayload.summary?.guidance || parsedPayload.summary || 'No further guidance available.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <pre className="mt-3 whitespace-pre-wrap break-words text-[11px] leading-6 text-slate-200">
                    {entry.output || '{\n  "status": "streaming"\n}'}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
