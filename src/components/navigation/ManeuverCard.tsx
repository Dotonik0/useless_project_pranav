import React from 'react';
import {
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  Compass,
  MapPin,
  CircleDot,
} from 'lucide-react';
import type { NavStep } from '../../services/turnTracker';

interface ManeuverCardProps {
  currentStep: NavStep | null;
  nextStep: NavStep | null;
  distanceFormatted: string;
  isArrived?: boolean;
}

export const ManeuverCard: React.FC<ManeuverCardProps> = ({
  currentStep,
  nextStep,
  distanceFormatted,
  isArrived,
}) => {
  if (!currentStep) return null;

  const renderIcon = (type: string, modifier?: string) => {
    if (isArrived || type === 'arrive') {
      return <MapPin className="w-8 h-8 text-red-500 animate-bounce" />;
    }
    if (type === 'roundabout') {
      return <CircleDot className="w-8 h-8 text-red-400 animate-spin-slow" />;
    }
    if (modifier === 'uturn') {
      return <RotateCcw className="w-8 h-8 text-red-400" />;
    }

    if (modifier?.includes('left')) {
      return <CornerUpLeft className="w-8 h-8 text-red-400" />;
    }
    if (modifier?.includes('right')) {
      return <CornerUpRight className="w-8 h-8 text-red-400" />;
    }
    if (modifier === 'straight' || type === 'depart') {
      return <ArrowUp className="w-8 h-8 text-red-400" />;
    }

    return <Compass className="w-8 h-8 text-red-400" />;
  };

  return (
    <div className="w-full select-none font-mono">
      <div className="hud-panel p-3.5 sm:p-4 rounded bg-[#0b0e14]/95 border-red-950/80 shadow-2xl backdrop-blur-md">
        {/* Top Tag */}
        <div className="flex items-center justify-between border-b border-red-950/60 pb-2 mb-2.5">
          <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase flex items-center gap-1.5 glow-text-red">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            {isArrived ? 'DESTINATION REACHED' : 'NEXT MANEUVER'}
          </span>
          <span className="text-[9px] text-slate-400">VECTOR STEP // 0{currentStep.index + 1}</span>
        </div>

        {/* Maneuver Main Content */}
        <div className="flex items-center gap-4">
          {/* Direction Icon Box */}
          <div className="w-14 h-14 rounded border border-red-900/60 bg-red-950/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(220,38,38,0.4)]">
            {renderIcon(currentStep.maneuverType, currentStep.modifier)}
          </div>

          {/* Turn Description & Distance */}
          <div className="flex-1 overflow-hidden">
            <div className="text-xl sm:text-2xl font-bold font-heading tracking-wider text-slate-100 flex items-center gap-2">
              <span className="text-red-400 glow-text-red">{distanceFormatted}</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-200 uppercase tracking-wide truncate">
              {currentStep.instruction}
            </div>
            <div className="text-xs text-slate-400 truncate mt-0.5">
              {currentStep.roadName}
            </div>
          </div>
        </div>

        {/* Next Step Preview */}
        {nextStep && !isArrived && (
          <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-[10px] text-slate-400 uppercase">THEN:</span>
            <span className="text-slate-300 font-semibold truncate max-w-[280px]">
              {nextStep.instruction} ({Math.round(nextStep.distance)} m)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
