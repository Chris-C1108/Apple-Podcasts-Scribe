import React, { useEffect, useRef } from 'react';

interface LogConsoleProps {
  logs: string[];
}

const LogConsole: React.FC<LogConsoleProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="bg-slate-900 rounded-xl p-4 shadow-lg overflow-hidden border border-slate-700 mt-6 font-mono text-xs sm:text-sm">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">System Logs</span>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
        </div>
      </div>
      <div className="h-48 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {logs.map((log, i) => (
          <div key={i} className="text-slate-300 break-words leading-relaxed border-l-2 border-transparent hover:border-slate-700 pl-2">
            <span className="text-purple-400 mr-2 opacity-70">➜</span>
            {log}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default LogConsole;
