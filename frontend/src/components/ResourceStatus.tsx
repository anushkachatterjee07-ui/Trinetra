import React, { useState } from 'react';
import { Shield, Hammer, MapPin, Truck, RefreshCw } from 'lucide-react';
import type { Resource } from './ActiveIncidents';

interface ResourceStatusProps {
  resources: Resource[];
  onStatusChange: (id: string, newStatus: string) => void;
}

export const ResourceStatus: React.FC<ResourceStatusProps> = ({ resources, onStatusChange }) => {
  const [filter, setFilter] = useState<'All' | 'Available' | 'Dispatched' | 'On-Scene' | 'Maintenance'>('All');

  const filteredResources = resources.filter((res) => {
    if (filter === 'All') return true;
    return res.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60';
      case 'Dispatched':
        return 'bg-amber-950/40 text-amber-400 border border-amber-800/60';
      case 'On-Scene':
        return 'bg-purple-950/40 text-purple-400 border border-purple-800/60';
      default:
        return 'bg-gray-800 text-gray-400 border border-gray-700';
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col h-[520px]">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5 text-violet-400" />
        <h2 className="text-lg font-semibold text-gray-100 m-0">Responder Assets</h2>
      </div>

      {/* Filter Tills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['All', 'Available', 'Dispatched', 'On-Scene', 'Maintenance'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
              filter === tab
                ? 'bg-violet-600 text-white shadow-md'
                : 'bg-gray-900/50 hover:bg-gray-800/80 text-gray-400 border border-gray-850'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Resource Listings */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filteredResources.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 py-10">
            <Truck className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No assets match selected filter.</p>
          </div>
        ) : (
          filteredResources.map((res) => (
            <div
              key={res.id}
              className="p-3 bg-gray-900/40 border border-gray-850 rounded-lg hover:border-gray-800 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-gray-200">{res.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{res.type}</div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${getStatusBadge(res.status)}`}>
                  {res.status}
                </span>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-850/50">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <MapPin className="w-3 h-3 text-gray-500" />
                  <span>{res.location}</span>
                </div>

                <div className="flex gap-1.5">
                  {res.status === 'Maintenance' ? (
                    <button
                      onClick={() => onStatusChange(res.id, 'Available')}
                      className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/20 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Restore
                    </button>
                  ) : (
                    res.status === 'Available' && (
                      <button
                        onClick={() => onStatusChange(res.id, 'Maintenance')}
                        className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded bg-gray-800 hover:bg-gray-750 text-gray-300 border border-gray-700 cursor-pointer"
                      >
                        <Hammer className="w-2.5 h-2.5" />
                        Service
                      </button>
                    )
                  )}
                  {res.status !== 'Available' && res.status !== 'Maintenance' && (
                    <div className="text-[9px] text-violet-400 font-bold bg-violet-950/20 border border-violet-500/20 px-2 py-1 rounded">
                      Inc: {res.assigned_incident_id}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
