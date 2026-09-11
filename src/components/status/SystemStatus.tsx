import React from 'react';
import { Activity, Radio, Navigation2, Volume2, ShieldCheck } from 'lucide-react';

export interface SystemStatusProps {
  system?: 'ONLINE' | 'STANDBY' | 'ERROR';
  navigation?: 'ONLINE' | 'STANDBY' | 'ENGAGED';
  position?: 'ONLINE' | 'STANDBY' | 'ACQUIRING';
  audio?: 'ONLINE' | 'STANDBY' | 'MUTED';
  compact?: boolean;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  system = 'ONLINE',
  navigation = 'STANDBY',
  position = 'STANDBY',
  audio = 'STANDBY',
  compact = false,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
      case 'ENGAGED':
        return 'text-red-500 border-red-950/60 bg-red-950/20';
      case 'STANDBY':
        return 'text-slate-400 border-slate-800 bg-slate-900/40';
      case 'ACQUIRING':
        return 'text-amber-400 border-amber-950/60 bg-amber-950/20';
      default:
        return 'text-slate-500 border-slate-800 bg-slate-950';
    }
  };

  const getDotColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
      case 'ENGAGED':
        return 'bg-red-500 shadow-[0_0_8px_#ef4444]';
      case 'STANDBY':
        return 'bg-slate-500';
      case 'ACQUIRING':
        return 'bg-amber-400 animate-pulse';
      default:
        return 'bg-slate-600';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-[11px] font-mono tracking-wider">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-red-950/60 bg-red-950/20 text-red-400">
          <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(system)}`} />
          <span>SYS:{system}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-800 bg-slate-900/40 text-slate-400">
          <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(navigation)}`} />
          <span>NAV:{navigation}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono tracking-wider select-none">
      {/* SYSTEM */}
      <div className={`flex items-center gap-2 px-2.5 py-1 rounded border ${getStatusColor(system)} transition-all duration-300`}>
        <Activity className="w-3.5 h-3.5" />
        <span className="text-[10px] text-slate-400 uppercase font-semibold">SYSTEM:</span>
        <span className="font-bold flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(system)}`} />
          {system}
        </span>
      </div>

      {/* NAVIGATION */}
      <div className={`flex items-center gap-2 px-2.5 py-1 rounded border ${getStatusColor(navigation)} transition-all duration-300`}>
        <Navigation2 className="w-3.5 h-3.5" />
        <span className="text-[10px] text-slate-400 uppercase font-semibold">NAVIGATION:</span>
        <span className="font-bold flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(navigation)}`} />
          {navigation}
        </span>
      </div>

      {/* POSITION */}
      <div className={`flex items-center gap-2 px-2.5 py-1 rounded border ${getStatusColor(position)} transition-all duration-300`}>
        <Radio className="w-3.5 h-3.5" />
        <span className="text-[10px] text-slate-400 uppercase font-semibold">POSITION:</span>
        <span className="font-bold flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(position)}`} />
          {position}
        </span>
      </div>

      {/* AUDIO */}
      <div className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded border ${getStatusColor(audio)} transition-all duration-300`}>
        <Volume2 className="w-3.5 h-3.5" />
        <span className="text-[10px] text-slate-400 uppercase font-semibold">AUDIO:</span>
        <span className="font-bold flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(audio)}`} />
          {audio}
        </span>
      </div>

      {/* ENCRYPTION BADGE */}
      <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-900 bg-black/40 text-slate-400 text-[11px]">
        <ShieldCheck className="w-3 h-3 text-red-500/80" />
        <span>WAYNE-SEC://MIL-SPEC-256</span>
      </div>
    </div>
  );
};
