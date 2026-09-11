import React, { useState, useEffect, useCallback } from 'react';
import { Shield, ChevronRight, Terminal } from 'lucide-react';

interface BootSequenceProps {
  onComplete: () => void;
}

interface BootLine {
  text: string;
  type?: 'header' | 'metric' | 'status' | 'ready';
  delay: number;
}

const BOOT_LINES: BootLine[] = [
  { text: 'BATCOMPUTER INITIALIZATION // PROTOCOL 773-ALPHA', type: 'header', delay: 200 },
  { text: 'SYSTEM CORE ................. ONLINE', type: 'metric', delay: 250 },
  { text: 'GEOSPATIAL DATABASE .......... ONLINE', type: 'metric', delay: 220 },
  { text: 'MAP INTERFACE ................ ONLINE', type: 'metric', delay: 240 },
  { text: 'NAVIGATION SYSTEM ............ ONLINE', type: 'metric', delay: 230 },
  { text: 'POSITIONING SYSTEM ........... ONLINE', type: 'metric', delay: 260 },
  { text: 'AUDIO SYSTEM ................. ONLINE', type: 'metric', delay: 210 },
  { text: 'ROUTE ANALYSIS ............... ONLINE', type: 'metric', delay: 250 },
  { text: 'SYSTEM STATUS: NOMINAL', type: 'status', delay: 350 },
  { text: 'NAVIGATION SYSTEM READY', type: 'ready', delay: 400 },
];

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [displayedLines, setDisplayedLines] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  const handleFinish = useCallback(() => {
    localStorage.setItem('batmap_boot_completed', 'true');
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 450);
  }, [onComplete]);

  // Handle ESC key to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleFinish();
      }
      if (e.key === 'Enter' && isReady) {
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinish, isReady]);

  // Terminal line-by-line progression
  useEffect(() => {
    if (displayedLines < BOOT_LINES.length) {
      const line = BOOT_LINES[displayedLines];
      const timer = setTimeout(() => {
        setDisplayedLines((prev) => prev + 1);
        const nextProgress = Math.round(((displayedLines + 1) / BOOT_LINES.length) * 100);
        setProgress(nextProgress);
      }, line.delay);
      return () => clearTimeout(timer);
    } else {
      const readyTimer = setTimeout(() => {
        setIsReady(true);
      }, 300);
      return () => clearTimeout(readyTimer);
    }
  }, [displayedLines]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-[#07080b] p-6 sm:p-12 transition-opacity duration-500 select-none overflow-hidden ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background scanlines & tactical grid */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-40 z-10" />
      <div className="absolute inset-0 tactical-grid opacity-30 pointer-events-none" />

      {/* Background subtle radar effect */}
      <div className="absolute right-1/2 bottom-1/2 translate-x-1/2 translate-y-1/2 w-[520px] h-[520px] sm:w-[700px] sm:h-[700px] pointer-events-none opacity-20">
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <circle cx="200" cy="200" r="190" fill="none" stroke="#dc2626" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.3" />
          <circle cx="200" cy="200" r="90" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.3" />
          <circle cx="200" cy="200" r="40" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
          <line x1="10" y1="200" x2="390" y2="200" stroke="#dc2626" strokeWidth="0.8" opacity="0.3" />
          <line x1="200" y1="10" x2="200" y2="390" stroke="#dc2626" strokeWidth="0.8" opacity="0.3" />
          <g className="animate-radar-sweep">
            <path
              d="M 200 200 L 390 200 A 190 190 0 0 0 200 10 Z"
              fill="url(#radarGradient)"
              opacity="0.35"
            />
          </g>
          <defs>
            <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Top Bar: System Header & Skip button */}
      <div className="relative z-20 flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border border-red-900/60 bg-red-950/30 flex items-center justify-center text-red-500 glow-red-sm">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono tracking-widest text-slate-400">WAYNE ENTERPRISES // ADVANCED RECON</div>
            <div className="text-sm font-bold tracking-wider text-slate-200 font-heading">TACTICAL OS v4.2</div>
          </div>
        </div>

        <button
          onClick={handleFinish}
          className="group flex items-center gap-2 px-3 py-1.5 rounded border border-slate-800 bg-slate-900/50 hover:border-red-900 hover:bg-red-950/20 text-xs font-mono text-slate-400 hover:text-red-400 transition-colors"
          title="Skip initialization sequence"
        >
          <span>SKIP SEQUENCE</span>
          <span className="text-[10px] text-slate-400 group-hover:text-red-500">(ESC)</span>
        </button>
      </div>

      {/* Center: Terminal Log Container */}
      <div className="relative z-20 my-auto max-w-2xl w-full mx-auto py-8">
        <div className="hud-panel p-6 sm:p-8 rounded shadow-2xl border-slate-800 bg-slate-950/90">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-5 text-[11px] font-mono text-slate-400 tracking-wider">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              SECURE BOOT STREAM
            </span>
            <span>TERMINAL ID: 0x9F4B</span>
          </div>

          {/* Lines */}
          <div className="space-y-2.5 font-mono text-xs sm:text-sm tracking-wide">
            {BOOT_LINES.slice(0, displayedLines).map((line, idx) => {
              if (line.type === 'header') {
                return (
                  <div key={idx} className="text-red-500 font-bold pb-2 border-b border-red-950/40 glow-text-red">
                    &gt; {line.text}
                  </div>
                );
              }
              if (line.type === 'status') {
                return (
                  <div key={idx} className="pt-2 text-slate-300 font-semibold flex items-center justify-between">
                    <span>{line.text}</span>
                    <span className="text-red-400 px-2 py-0.5 rounded bg-red-950/40 border border-red-900/40 text-xs">VERIFIED</span>
                  </div>
                );
              }
              if (line.type === 'ready') {
                return (
                  <div key={idx} className="pt-3 text-red-500 font-bold text-sm sm:text-base flex items-center gap-2 glow-text-red">
                    <Shield className="w-4 h-4 text-red-500" />
                    <span>{line.text}</span>
                  </div>
                );
              }
              return (
                <div key={idx} className="flex justify-between items-center text-slate-400">
                  <span>{line.text.split('...')[0]}</span>
                  <span className="text-red-500/90 font-semibold tracking-widest text-[11px] sm:text-xs">
                    ONLINE
                  </span>
                </div>
              );
            })}

            {displayedLines < BOOT_LINES.length && (
              <div className="flex items-center gap-1 text-red-500 pt-1">
                <span className="text-xs">&gt;</span>
                <span className="w-2 h-4 bg-red-500 animate-cursor inline-block" />
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-8 pt-4 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-2">
              <span className="tracking-wider">CALIBRATING SYSTEM SENSORS</span>
              <span className="text-red-400 font-bold">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
              <div
                className="h-full bg-red-600 transition-all duration-200 shadow-[0_0_10px_#dc2626]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Enter System Prompt */}
        {isReady && (
          <div className="mt-8 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
            <div className="text-2xl sm:text-3xl font-bold font-heading tracking-widest text-slate-100 mb-1 glow-text-red">
              THE BAT MAP
            </div>
            <div className="text-xs font-mono text-red-400/90 tracking-widest mb-6">
              TACTICAL NAVIGATION SYSTEM READY
            </div>

            <button
              onClick={handleFinish}
              className="group relative flex items-center gap-3 px-8 py-3.5 rounded border border-red-600 bg-red-950/40 hover:bg-red-900/50 text-slate-100 font-mono font-bold tracking-widest text-sm transition-all duration-200 glow-red hover:shadow-[0_0_25px_rgba(220,38,38,0.6)] cursor-pointer"
            >
              <span>[ ENTER SYSTEM ]</span>
              <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="mt-2 text-[10px] font-mono text-slate-400">
              PRESS ENTER OR CLICK TO ENGAGE
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="relative z-20 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/80 pt-4 text-[11px] font-mono text-slate-400 gap-2">
        <div>AUTHORIZED ACCESS ONLY // LEVEL 5 PROTOCOLS IN EFFECT</div>
        <div>STATION: BATCAVE CENTRAL GIS CORE</div>
      </div>
    </div>
  );
};
