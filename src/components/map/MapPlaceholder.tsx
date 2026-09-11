import React from 'react';
import { Layers, Plus, Minus, Crosshair, Compass, ShieldAlert } from 'lucide-react';

interface MapPlaceholderProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onRecenter?: () => void;
}

export const MapPlaceholder: React.FC<MapPlaceholderProps> = ({
  onZoomIn,
  onZoomOut,
  onRecenter,
}) => {
  return (
    <div
      id="bat-map-container"
      className="relative w-full h-full bg-[#08090d] overflow-hidden select-none flex flex-col items-center justify-center border border-slate-800/80 rounded"
    >
      {/* Tactical Coordinate Grid Background */}
      <div className="absolute inset-0 tactical-grid opacity-35 pointer-events-none" />

      {/* Subtle CRT Scanline overlay */}
      <div className="absolute inset-0 scanlines opacity-25 pointer-events-none z-10" />

      {/* Radar sweep / GIS Wireframe Visuals */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
        <div className="relative w-[340px] h-[340px] sm:w-[540px] sm:h-[540px]">
          {/* Concentric rings */}
          <div className="absolute inset-0 rounded-full border border-red-900/50" />
          <div className="absolute inset-12 rounded-full border border-red-900/40" />
          <div className="absolute inset-24 rounded-full border border-red-800/30 border-dashed" />
          <div className="absolute inset-36 rounded-full border border-red-700/40" />
          <div className="absolute inset-48 rounded-full border border-red-600/50 animate-beacon" />

          {/* Crosshairs */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-red-900/50" />
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-red-900/50" />

          {/* Rotating radar sweep */}
          <div className="absolute inset-0 rounded-full animate-radar-sweep">
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-red-600/20 to-transparent rounded-tl-full" />
          </div>
        </div>
      </div>

      {/* Corner Brackets / Tactical HUD Accents */}
      <div className="absolute top-3 left-3 pointer-events-none text-[10px] font-mono text-slate-400 flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-red-500 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>GIS CORE // ACTIVE</span>
        </div>
        <div>GRID: 40-74-NW</div>
        <div>ZOOM: LVL-14 [SIM]</div>
      </div>

      <div className="absolute top-3 right-3 pointer-events-none text-[10px] font-mono text-slate-400 text-right">
        <div>BEARING: 042° NNE</div>
        <div>PROJECTION: EPSG:3857</div>
        <div className="text-red-500/80">STANDBY FOR MAP ENGINE</div>
      </div>

      <div className="absolute bottom-3 left-3 pointer-events-none text-[10px] font-mono text-slate-400 flex items-center gap-2">
        <div className="w-24 h-1 bg-slate-800 rounded relative overflow-hidden">
          <div className="w-1/2 h-full bg-red-500/70" />
        </div>
        <span>500 M / SECTOR SCALE</span>
      </div>

      {/* Center Tactical Status Notice */}
      <div className="relative z-20 text-center px-6 py-4 max-w-md mx-auto hud-panel rounded border-red-950/80 bg-[#090b10]/90">
        <div className="flex items-center justify-center gap-2 mb-2 text-red-500 font-heading text-sm font-bold tracking-widest glow-text-red">
          <ShieldAlert className="w-4 h-4" />
          <span>GEOSPATIAL VECTOR DISPLAY</span>
        </div>
        <p className="text-xs font-mono text-slate-400 mb-2 leading-relaxed">
          PRIMARY SATELLITE TELEMETRY READY. MAP ENGINE CONTAINER INITIALIZED FOR VECTOR STREAMING.
        </p>
        <div className="text-[10px] font-mono text-red-400/80 tracking-widest flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span>MAPLIBRE INTEGRATION READY [CHUNK 2]</span>
        </div>
      </div>

      {/* Floating HUD Controls (Right side) */}
      <div className="absolute right-3 bottom-16 sm:bottom-6 z-20 flex flex-col gap-2">
        {/* Recenter */}
        <button
          onClick={onRecenter}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Recenter Map"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Layer Selector Mock */}
        <button
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Tactical Overlay Layers"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Compass Heading */}
        <div className="w-9 h-9 rounded bg-[#0d1017]/90 border border-slate-800 text-red-400 flex items-center justify-center shadow-lg">
          <Compass className="w-4 h-4 text-red-500 animate-spin-slow" />
        </div>
      </div>
    </div>
  );
};
