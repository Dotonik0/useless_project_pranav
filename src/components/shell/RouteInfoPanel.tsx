import React from 'react';
import { Route, Clock, Gauge, ArrowRight, ShieldCheck } from 'lucide-react';

interface RouteInfoPanelProps {
  routeStatus?: 'STANDBY' | 'ESTABLISHED' | 'ACTIVE';
  distance?: string;
  duration?: string;
  onInitiateNavigation?: () => void;
}

export const RouteInfoPanel: React.FC<RouteInfoPanelProps> = ({
  routeStatus = 'STANDBY',
  distance = '-- KM',
  duration = '-- MIN',
  onInitiateNavigation,
}) => {
  const isRouteReady = routeStatus === 'ESTABLISHED';

  return (
    <div className="hud-panel p-4 rounded border-slate-800 bg-[#0d0f14]/90 text-slate-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-red-500" />
          <span className="font-heading font-bold text-xs tracking-widest text-slate-100">
            TACTICAL ROUTE TELEMETRY
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-400">
          {routeStatus === 'STANDBY' ? 'STANDBY' : 'ACQUIRED'}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4 font-mono">
        {/* Distance Card */}
        <div className="p-3 rounded bg-slate-950/70 border border-slate-900 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
            <Gauge className="w-3 h-3 text-red-500/80" />
            <span>DISTANCE</span>
          </div>
          <div className="mt-1 text-base sm:text-lg font-bold text-slate-100">
            {distance}
          </div>
          <div className="text-[9px] text-slate-400">VECTOR DISPLACEMENT</div>
        </div>

        {/* Estimated Time Card */}
        <div className="p-3 rounded bg-slate-950/70 border border-slate-900 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
            <Clock className="w-3 h-3 text-red-500/80" />
            <span>ESTIMATED TIME</span>
          </div>
          <div className="mt-1 text-base sm:text-lg font-bold text-slate-100">
            {duration}
          </div>
          <div className="text-[9px] text-slate-400">NOMINAL TRANSIT</div>
        </div>
      </div>

      {/* Route Parameters / Status message */}
      <div className="mb-4 p-2.5 rounded border border-slate-900 bg-slate-950/50 text-[11px] font-mono text-slate-400 space-y-1">
        <div className="flex justify-between items-center">
          <span>VECTOR PROTOCOL:</span>
          <span className="text-slate-300 font-semibold">BAT-TRANSIT // SECURE</span>
        </div>
        <div className="flex justify-between items-center">
          <span>TRAFFIC OVERRIDE:</span>
          <span className="text-red-400/90 font-semibold">PASSIVE MONITOR</span>
        </div>
        <div className="flex justify-between items-center">
          <span>SURVEILLANCE AVOIDANCE:</span>
          <span className="text-slate-400">NOMINAL</span>
        </div>
      </div>

      {/* Navigation Button */}
      <button
        type="button"
        disabled={!isRouteReady}
        onClick={onInitiateNavigation}
        className={`w-full py-3 px-4 rounded font-mono font-bold tracking-widest text-xs flex items-center justify-center gap-2 transition-all select-none ${
          isRouteReady
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] cursor-pointer'
            : 'bg-slate-900/60 border border-slate-800 text-slate-400 cursor-not-allowed opacity-75'
        }`}
      >
        <ShieldCheck className="w-4 h-4" />
        <span>INITIATE PURSUIT VECTOR</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      {/* Standby Note */}
      {!isRouteReady && (
        <div className="mt-2 text-center text-[10px] font-mono text-slate-400">
          DESTINATION VECTOR REQUIRED TO ENGAGE PURSUIT
        </div>
      )}
    </div>
  );
};
