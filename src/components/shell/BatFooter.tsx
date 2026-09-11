import React from 'react';
import { Terminal, Cpu, HardDrive } from 'lucide-react';
import { SystemStatus } from '../status/SystemStatus';

interface BatFooterProps {
  systemStatus?: 'ONLINE' | 'STANDBY' | 'ERROR';
  navigationStatus?: 'ONLINE' | 'STANDBY' | 'ENGAGED';
  positionStatus?: 'ONLINE' | 'STANDBY' | 'ACQUIRING';
  audioStatus?: 'ONLINE' | 'STANDBY' | 'MUTED';
}

export const BatFooter: React.FC<BatFooterProps> = ({
  systemStatus = 'ONLINE',
  navigationStatus = 'STANDBY',
  positionStatus = 'STANDBY',
  audioStatus = 'STANDBY',
}) => {
  return (
    <footer className="relative z-30 w-full border-t border-slate-800 bg-[#08090d]/95 backdrop-blur-md px-3 sm:px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 select-none text-[11px] font-mono">
      {/* Bottom red subtle line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-red-950/40" />

      {/* Left: Telemetry & Memory */}
      <div className="flex items-center gap-3 sm:gap-4 text-slate-400">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-red-500/80" />
          <span className="hidden xs:inline">CORE LOAD:</span>
          <span className="text-slate-300 font-semibold">14.2%</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span>LOCAL CACHE:</span>
          <span className="text-slate-300 font-semibold">SYNCED</span>
        </div>

        <div className="flex items-center gap-1.5 text-red-400">
          <Terminal className="w-3.5 h-3.5" />
          <span className="truncate max-w-[200px] sm:max-w-[320px]">
            BATCOMPUTER OS READY // PROTOCOL 773
          </span>
        </div>
      </div>

      {/* Right: Reusable System Status component */}
      <div className="flex items-center">
        <SystemStatus
          system={systemStatus}
          navigation={navigationStatus}
          position={positionStatus}
          audio={audioStatus}
        />
      </div>
    </footer>
  );
};
