import React, { useEffect, useRef } from 'react';
import { Terminal, Cpu } from 'lucide-react';

export type SystemLog = {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
};

interface RealTimeLogProps {
  logs: SystemLog[];
}

export const RealTimeLog: React.FC<RealTimeLogProps> = ({ logs }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-400 font-extrabold bg-red-950/40 border border-red-800/40';
      case 'WARNING':
        return 'text-amber-400 font-bold bg-amber-950/40 border border-amber-800/40';
      case 'SUCCESS':
        return 'text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/40';
      default:
        return 'text-sky-400 bg-sky-950/40 border border-sky-800/40';
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col h-[260px] w-full">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-gray-100 m-0">Live Command Log</h2>
        <span className="flex items-center gap-1.5 ml-auto text-[10px] text-gray-400 font-semibold bg-gray-900/50 border border-gray-800 px-2.5 py-1 rounded">
          <Cpu className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          AI ANALYTICS ONLINE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-950/80 rounded-lg p-3 border border-gray-900 font-mono text-xs space-y-1.5 scrollbar">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic text-center py-10">
            Awaiting WebSocket connection initialization...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-gray-900/30 p-1 rounded transition">
              <span className="text-gray-500 select-none">[{log.timestamp}]</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${getLogLevelStyle(log.level)}`}>
                {log.level}
              </span>
              <span className="text-gray-300 leading-normal ml-1">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
