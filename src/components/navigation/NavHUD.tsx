import React from 'react';
import { ShieldAlert, Gauge, Compass, XCircle, Navigation, Play, Pause } from 'lucide-react';
import { ManeuverCard } from './ManeuverCard';
import type { NavStep } from '../../services/turnTracker';

interface NavHUDProps {
  speedKmH: number;
  remainingDistance: string;
  remainingDuration: string;
  isSimulating: boolean;
  isCameraLocked: boolean;
  currentStep: NavStep | null;
  nextStep: NavStep | null;
  distanceToManeuverFormatted: string;
  isArrived: boolean;
  onToggleCameraLock: () => void;
  onToggleSimulation: () => void;
  onDisengage: () => void;
}

export const NavHUD: React.FC<NavHUDProps> = ({
  speedKmH,
  remainingDistance,
  remainingDuration,
  isSimulating,
  isCameraLocked,
  currentStep,
  nextStep,
  distanceToManeuverFormatted,
  isArrived,
  onToggleCameraLock,
  onToggleSimulation,
  onDisengage,
}) => {
  return (
    <div className="absolute top-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30 max-w-xl w-full select-none space-y-2">
      {/* 1. Next Turn Maneuver Card */}
      <ManeuverCard
        currentStep={currentStep}
        nextStep={nextStep}
        distanceFormatted={distanceToManeuverFormatted}
        isArrived={isArrived}
      />

      {/* 2. Tactical Telemetry & Controls Strip */}
      <div className="hud-panel p-2 sm:p-2.5 rounded bg-[#0b0e14]/95 border-red-950/80 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between text-xs font-mono">
          {/* Velocity & Metrics */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-900">
              <Gauge className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] text-slate-400">SPEED:</span>
              <span className="font-bold text-slate-100">{speedKmH} <span className="text-[9px] text-slate-400">KM/H</span></span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-900">
              <Compass className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] text-slate-400">REM:</span>
              <span className="font-bold text-red-400">{remainingDistance}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-900">
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] text-slate-400">ETA:</span>
              <span className="font-bold text-slate-200">{remainingDuration}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Simulation button */}
            <button
              onClick={onToggleSimulation}
              className={`px-2 py-1 rounded text-[10px] font-mono font-bold tracking-wider flex items-center gap-1 border transition-colors cursor-pointer ${
                isSimulating
                  ? 'border-red-600 bg-red-950/60 text-red-300 shadow-[0_0_8px_#ef4444]'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title="Simulate movement along route"
            >
              {isSimulating ? <Pause className="w-3 h-3 text-red-400" /> : <Play className="w-3 h-3" />}
              <span>{isSimulating ? 'PAUSE' : 'CRUISE'}</span>
            </button>

            {/* Camera follow toggle */}
            <button
              onClick={onToggleCameraLock}
              className={`p-1.5 rounded border text-xs transition-colors cursor-pointer ${
                isCameraLocked
                  ? 'border-red-600 bg-red-950/60 text-red-400 shadow-[0_0_8px_#ef4444]'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title={isCameraLocked ? 'Camera: Follow Vehicle' : 'Camera: Free Look'}
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>

            {/* Disengage Button */}
            <button
              onClick={onDisengage}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-red-800/80 bg-red-950/80 hover:bg-red-900 text-red-200 text-[10px] font-mono font-bold tracking-wider transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>DISENGAGE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
