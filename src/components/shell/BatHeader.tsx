import React, { useState, useEffect } from 'react';
import { Crosshair, Settings, Shield, RefreshCw } from 'lucide-react';
import { SystemStatus } from '../status/SystemStatus';

interface BatHeaderProps {
  onOpenSettings?: () => void;
  onLocateMe?: () => void;
  onReplayBoot?: () => void;
}

export const BatHeader: React.FC<BatHeaderProps> = ({
  onOpenSettings,
  onLocateMe,
  onReplayBoot,
}) => {
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      const tz = 'LOC';
      setTimeString(`${hours}:${mins}:${secs} ${tz}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative z-30 w-full border-b border-slate-800 bg-[#0a0b10]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 select-none">
      {/* Top red accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600/70 to-transparent" />

      {/* Brand & Telemetry */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded border border-red-900/80 bg-red-950/40 flex items-center justify-center text-red-500 glow-red-sm shrink-0">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm sm:text-base tracking-widest text-slate-100">
              THE BAT MAP
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-red-900/50 bg-red-950/30 text-red-400 font-bold">
              SYS-NAV // 2.0
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span className="hidden md:inline">SECTOR: 04-GOTHAM</span>
            <span className="hidden lg:inline text-slate-400">|</span>
            <span className="hidden lg:inline">COORDS: 40.7128° N, 74.0060° W</span>
          </div>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="hidden lg:flex items-center">
        <SystemStatus />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Tactical Clock */}
        <div className="hidden sm:flex flex-col items-end px-2.5 py-1 rounded border border-slate-800/80 bg-slate-950/60 font-mono text-right mr-1">
          <span className="text-[10px] text-slate-400 leading-none">SYS CLOCK</span>
          <span className="text-xs font-bold text-red-400 tracking-wider leading-tight">{timeString || '00:00:00 LOC'}</span>
        </div>

        {/* Locate Me (Standby in Chunk 1) */}
        <button
          onClick={onLocateMe}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-800 bg-slate-900/60 hover:border-red-900/80 hover:bg-red-950/20 text-slate-300 hover:text-red-400 text-xs font-mono transition-colors"
          title="Acquire current telemetry"
        >
          <Crosshair className="w-3.5 h-3.5 text-red-500" />
          <span className="hidden md:inline text-[11px] font-semibold tracking-wider">LOCATE ME</span>
        </button>

        {/* Replay Boot sequence (convenient developer & user setting) */}
        {onReplayBoot && (
          <button
            onClick={onReplayBoot}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors"
            title="Replay boot sequence"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">REPLAY BOOT</span>
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-800 bg-slate-900/60 hover:border-red-900/80 hover:bg-red-950/20 text-slate-300 hover:text-red-400 text-xs font-mono transition-colors"
          title="System Settings"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-400" />
          <span className="hidden sm:inline text-[11px] font-semibold tracking-wider">SETTINGS</span>
        </button>
      </div>
    </header>
  );
};
