import { useState } from 'react';
import { AlertOctagon, CheckCircle2, Activity, Navigation, UserCheck } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

export type Incident = {
  id: string;
  type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  location: string;
  latitude: number;
  longitude: number;
  status: 'Active' | 'Contained' | 'Resolved';
  timestamp: string;
  description: string;
  impact_score: number;
};

export type Resource = {
  id: string;
  name: string;
  type: string;
  status: 'Available' | 'Dispatched' | 'On-Scene' | 'Maintenance';
  location: string;
  latitude: number;
  longitude: number;
  assigned_incident_id: string | null;
};

export type Recommendation = {
  resource: Resource;
  distance_km: number;
  match_score: number;
  is_specialized: boolean;
};

interface ActiveIncidentsProps {
  incidents: Incident[];
  onResolve: (id: string) => void;
  onDispatch: (resourceId: string, incidentId: string) => void;
}

export const ActiveIncidents: React.FC<ActiveIncidentsProps> = ({
  incidents,
  onResolve,
  onDispatch,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState<boolean>(false);

  const activeList = incidents.filter((inc) => inc.status !== 'Resolved');

  const fetchRecommendations = async (incident: Incident) => {
    setSelectedIncident(incident);
    setIsLoadingRecs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/incidents/${incident.id}/recommendations`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch (e) {
      console.error('Error fetching recommendations:', e);
    } finally {
      setIsLoadingRecs(false);
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-950/50 text-red-400 border border-red-800/80';
      case 'High':
        return 'bg-amber-950/50 text-amber-400 border border-amber-800/80';
      case 'Medium':
        return 'bg-yellow-950/50 text-yellow-400 border border-yellow-800/80';
      default:
        return 'bg-blue-950/50 text-blue-400 border border-blue-800/80';
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col h-[520px]">
      <div className="flex items-center gap-2 mb-4">
        <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
        <h2 className="text-lg font-semibold text-gray-100 m-0">Active Crisis Incidents</h2>
        <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-800/50 font-semibold">
          {activeList.length} Active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {activeList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-sm">No active threats detected. System normal.</p>
          </div>
        ) : (
          activeList.map((inc) => (
            <div
              key={inc.id}
              className={`p-4 rounded-lg transition-all duration-200 ${
                inc.severity === 'Critical' ? 'glow-critical' : ''
              } bg-gray-900/40 hover:bg-gray-900/70 border border-gray-800`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-300">{inc.id}</span>
                    <span className="text-sm font-semibold text-gray-100">{inc.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getSeverityBadgeClass(inc.severity)}`}>
                      {inc.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{inc.location} ({inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)})</span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="text-xs text-gray-500">Impact Score</div>
                  <div className="text-lg font-extrabold text-red-400">{inc.impact_score}/10</div>
                </div>
              </div>

              <p className="text-xs text-gray-300 mb-3 leading-relaxed">{inc.description}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => fetchRecommendations(inc)}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-all cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  AI Allocator
                </button>
                <button
                  onClick={() => onResolve(inc.id)}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600/80 hover:bg-emerald-500/90 text-white transition-all cursor-pointer ml-auto border border-emerald-500/25"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* AI Recommendation Modal Overlay */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-xl max-w-md w-full p-6 relative border border-gray-800">
            <h3 className="text-md font-bold text-gray-100 flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-violet-500" />
              AI Allocator: Incident {selectedIncident.id}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              AI optimization based on specialization and proximity to {selectedIncident.location}
            </p>

            {isLoadingRecs ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-gray-400 gap-2">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                Computing optimal dispatches...
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500">
                    No available matching resource found. Please clear or update statuses.
                  </div>
                ) : (
                  recommendations.map((rec) => (
                    <div
                      key={rec.resource.id}
                      className="p-3 bg-gray-900/60 rounded-lg border border-gray-800 flex justify-between items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-300">{rec.resource.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                            {rec.resource.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1">
                          Distance: <span className="text-gray-200 font-semibold">{rec.distance_km} km</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 block">Match Score</span>
                          <span className="text-xs font-black text-emerald-400">{rec.match_score}%</span>
                        </div>
                        <button
                          onClick={() => {
                            onDispatch(rec.resource.id, selectedIncident.id);
                            setSelectedIncident(null);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white transition-all cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                          Dispatch
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={() => setSelectedIncident(null)}
                  className="w-full text-center text-xs py-2 mt-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
