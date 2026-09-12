import React, { useState, useEffect } from 'react';
import { Shield, Radio, Terminal, ChevronRight, Cpu, Activity, Lock } from 'lucide-react';
import { sfx, unlockAudio } from '../../services/soundEffects';

interface BootSequenceProps {
  onComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [opening, setOpening] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [canProceed, setCanProceed] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Warm the AudioContext on first interaction (browsers block audio before it)
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    const bootLogs = [
      "INITIALIZING BATCOMPUTER CORE v9.0.4...",
      "CONNECTING TO WAYNE-NET SATELLITE MATRIX...",
      "TACTICAL RADAR ENCRYPTED PROTOCOL ACTIVATED.",
      "GEOSPATIAL VECTOR MATRIX ONLINE (100 KM RADIUS LOCK).",
      "TACTICAL ROUTING ENGINE ARMED & READY."
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];
    bootLogs.forEach((log, index) => {
      timers.push(
        setTimeout(() => {
          setLogs((prev) => [...prev, log]);
          sfx.playBootStep(index, bootLogs.length);
          if (index === bootLogs.length - 1) {
            setCanProceed(true);
            // Online chime lands just after the final log line
            setTimeout(() => sfx.playSystemOnline(), 250);
          }
        }, index * 600)
      );
    });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Techy gate-breach progress ticker
  useEffect(() => {
    if (!opening) return;
    setProgress(0);
    const start = performance.now();
    const duration = 1150;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out for techy feel
      setProgress(Math.round((1 - Math.pow(1 - t, 3)) * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [opening]);

  const handleInitiate = () => {
    if (opening) return;
    setOpening(true);
    sfx.playLockSound();
    // staggered beeps for gate release feel
    setTimeout(() => sfx.playBeep(440, 'sawtooth', 0.08), 150);
    setTimeout(() => sfx.playBeep(880, 'sawtooth', 0.08), 350);
    setTimeout(() => sfx.playBeep(1320, 'sine', 0.12), 600);
    setTimeout(() => {
      onComplete();
    }, 1250);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-bat-black flex items-center justify-center font-mono select-none">
      <style>{`
        @keyframes gate-slit {
          0% { transform: scaleY(0.02) scaleX(0.6); opacity: 0; }
          20% { transform: scaleY(0.06) scaleX(1); opacity: 1; }
          60% { transform: scaleY(1) scaleX(1); opacity: 1; }
          100% { transform: scaleY(1.4) scaleX(1.1); opacity: 0; }
        }
        @keyframes gate-flash {
          0% { opacity: 0; }
          25% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes gate-shock {
          0% { transform: scale(0.1); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes grid-pan {
          0% { background-position: 0 0; }
          100% { background-position: 0 40px; }
        }
        @keyframes data-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes hex-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-gate-slit { animation: gate-slit 1.15s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-gate-flash { animation: gate-flash 1.15s ease-out forwards; }
        .animate-gate-shock { animation: gate-shock 1.1s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-grid-pan { animation: grid-pan 1.2s linear infinite; }
      `}</style>

      {/* ── TECHY AMBIENT BACKGROUND (always visible, no solid hull) ── */}
      <div
        className="absolute inset-0 opacity-[0.14] animate-grid-pan"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,229,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />
      {/* radar rings */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
        <div className="w-[70vmin] h-[70vmin] rounded-full border border-bat-cyan/40" />
        <div className="absolute inset-8 rounded-full border border-bat-cyan/30" />
        <div className="absolute inset-20 rounded-full border border-bat-red/40" />
        <div
          className="absolute inset-0 rounded-full animate-radar"
          style={{ background: 'conic-gradient(from 0deg, rgba(0,229,255,0.35), transparent 25%)' }}
        />
      </div>
      {/* scanline */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-bat-cyan/10 to-transparent animate-scanline pointer-events-none" />
      {/* floating data particles */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute w-1 h-1 bg-bat-cyan rounded-full"
            style={{
              left: `${(i * 41) % 100}%`,
              top: `${(i * 29) % 100}%`,
              animation: `data-flicker ${(1 + (i % 5) * 0.4).toFixed(1)}s infinite`,
              animationDelay: `${(i * 0.17).toFixed(2)}s`,
            }}
          />
        ))}
      </div>

      {/* corner HUD brackets */}
      <div className="absolute top-4 left-4 w-10 h-10 border-l-2 border-t-2 border-bat-cyan/70" />
      <div className="absolute top-4 right-4 w-10 h-10 border-r-2 border-t-2 border-bat-cyan/70" />
      <div className="absolute bottom-4 left-4 w-10 h-10 border-l-2 border-b-2 border-bat-cyan/70" />
      <div className="absolute bottom-4 right-4 w-10 h-10 border-r-2 border-b-2 border-bat-cyan/70" />

      {/* top telemetry bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-8 py-2 text-[10px] tracking-[0.25em] uppercase text-bat-cyan/80 border-b border-bat-cyan/20 bg-bat-black/60 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> WAYNE TECH // SECURE UPLINK
        </span>
        <span className="hidden md:flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 animate-pulse" /> LAT 40.7488 :: LNG -73.9851 :: ENC AES-256
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-bat-red animate-ping" /> LIVE
        </span>
      </div>

      {/* ── CENTER TERMINAL (never covered by solid hull) ── */}
      <div className="relative z-20 flex flex-col items-center max-w-md w-full px-6 text-center">
        <div className="mb-5 relative">
          <div className="absolute -inset-4 rounded-full border border-dashed border-bat-cyan/30" style={{ animation: 'hex-spin 12s linear infinite' }} />
          <div className="w-24 h-24 rounded-full border-2 border-bat-red flex items-center justify-center bg-bat-black shadow-[0_0_30px_rgba(255,30,39,0.5)] relative">
            <Cpu className="w-10 h-10 text-bat-red animate-pulse" />
            <div className="absolute inset-0 rounded-full border border-bat-cyan/40 animate-ping" />
          </div>
          {/* orbit ticks */}
          <div className="absolute -inset-1 flex items-center justify-between pointer-events-none">
            <span className="w-1.5 h-1.5 bg-bat-cyan rotate-45" />
            <span className="w-1.5 h-1.5 bg-bat-cyan rotate-45" />
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-[0.3em] text-white uppercase mb-1">THE BAT MAP</h1>
        <p className="text-[11px] text-bat-cyan tracking-[0.25em] uppercase mb-4 font-bold flex items-center gap-2">
          <Radio className="w-3.5 h-3.5" /> Batcomputer Tactical Dispatch
        </p>

        {/* Diagnostic Logs Box */}
        <div className="w-full bg-bat-black/80 backdrop-blur border border-bat-cyan/30 rounded p-4 text-left h-40 font-mono text-xs overflow-hidden mb-4 shadow-[0_0_25px_rgba(0,229,255,0.12)] relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-bat-cyan/70 to-transparent" />
          <div className="flex items-center justify-between border-b border-bat-cyan/20 pb-2 mb-2 text-bat-cyan font-bold text-[10px] uppercase tracking-widest">
            <span className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" /> DIAGNOSTIC CONSOLE
            </span>
            <span className="text-bat-text/50">{logs.length}/5 SYNCED</span>
          </div>
          {logs.map((log, idx) => (
            <div key={idx} className="text-bat-text/90 tracking-tight flex items-center gap-2 text-[11px] leading-5">
              <span className="text-bat-cyan font-bold">&gt;</span> {log}
            </div>
          ))}
          {logs.length === 0 && <div className="text-bat-text/40 text-[11px] animate-pulse">&gt; awaiting uplink…</div>}
          {/* progress hairline */}
          <div className="absolute bottom-0 left-0 h-0.5 bg-bat-cyan/80 transition-all duration-300" style={{ width: `${(logs.length / 5) * 100}%` }} />
        </div>

        {!opening ? (
          <button
            onClick={handleInitiate}
            disabled={!canProceed && logs.length < 2}
            className="w-full py-3 bg-bat-red text-black font-black text-xs tracking-[0.25em] hover:bg-red-500 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,30,39,0.6)] flex items-center justify-center gap-2 uppercase cursor-pointer disabled:opacity-40 disabled:cursor-wait border border-bat-red"
          >
            <Lock className="w-4 h-4" />
            <span>BREACH GATE / INITIALIZE</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-full border border-bat-cyan/40 bg-bat-black/80 p-3">
            <div className="flex items-center justify-between text-[10px] tracking-[0.25em] text-bat-cyan uppercase mb-2">
              <span className="animate-pulse">Gate disengaging…</span>
              <span className="font-black">{progress}%</span>
            </div>
            <div className="h-2 bg-bat-dark overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-bat-cyan via-white to-bat-cyan transition-[width] duration-75 shadow-[0_0_12px_rgba(0,229,255,0.9)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 text-[9px] text-bat-text/50 tracking-[0.2em] uppercase">HULL SEAL RELEASE :: MAG-LOCK BYPASS</div>
          </div>
        )}
        {!opening && (
          <button
            type="button"
            onClick={onComplete}
            className="mt-3 text-[10px] tracking-[0.3em] uppercase text-bat-text/40 hover:text-bat-cyan transition-colors cursor-pointer"
          >
            SKIP BOOT ▸
          </button>
        )}
      </div>

      {/* ── HULL-GATE OPENING ANIMATION ONLY (no resting closed hull) ── */}
      {opening && (
        <div className="absolute inset-0 z-40 pointer-events-none">
          {/* full-screen flash */}
          <div className="absolute inset-0 bg-bat-cyan/20 animate-gate-flash" />
          <div className="absolute inset-0 bg-white/10 animate-gate-flash" style={{ animationDelay: '0.1s' }} />

          {/* central light slit that blooms open */}
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-1 bg-white shadow-[0_0_40px_10px_rgba(0,229,255,0.9)] animate-gate-slit" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-2 border-white/80 animate-gate-shock" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-bat-cyan animate-gate-shock" style={{ animationDelay: '0.12s' }} />

          {/* LEFT energy gate — slides open */}
          <div className="absolute top-0 left-0 w-1/2 h-full animate-hullLeft">
            <div className="absolute inset-0 bg-gradient-to-r from-bat-charcoal/95 via-bat-dark/80 to-transparent backdrop-blur-[2px] border-r-2 border-bat-cyan shadow-[0_0_30px_rgba(0,229,255,0.5)]">
              {/* circuit lines */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent 0 22px, rgba(0,229,255,0.4) 22px 23px), repeating-linear-gradient(90deg, transparent 0 46px, rgba(0,229,255,0.25) 46px 47px)',
                }}
              />
              {/* warning stripes on gate edge */}
              <div
                className="absolute right-0 top-0 bottom-0 w-3 opacity-80"
                style={{ background: 'repeating-linear-gradient(180deg, #FF1E27 0 12px, #0A0A0C 12px 24px)' }}
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 items-end text-bat-cyan text-[10px] tracking-[0.3em] uppercase">
                <span className="border border-bat-cyan/50 px-2 py-1 bg-bat-black/70">BAY 01</span>
                <span className="border border-bat-cyan/50 px-2 py-1 bg-bat-black/70">MAG-LOCK ▮▮▮○○</span>
                <span className="text-bat-red font-black">◀ RETRACT</span>
              </div>
            </div>
          </div>

          {/* RIGHT energy gate — slides open */}
          <div className="absolute top-0 right-0 w-1/2 h-full animate-hullRight">
            <div className="absolute inset-0 bg-gradient-to-l from-bat-charcoal/95 via-bat-dark/80 to-transparent backdrop-blur-[2px] border-l-2 border-bat-cyan shadow-[0_0_30px_rgba(0,229,255,0.5)]">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent 0 22px, rgba(0,229,255,0.4) 22px 23px), repeating-linear-gradient(90deg, transparent 0 46px, rgba(0,229,255,0.25) 46px 47px)',
                }}
              />
              <div
                className="absolute left-0 top-0 bottom-0 w-3 opacity-80"
                style={{ background: 'repeating-linear-gradient(180deg, #FF1E27 0 12px, #0A0A0C 12px 24px)' }}
              />
              <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 items-start text-bat-cyan text-[10px] tracking-[0.3em] uppercase">
                <span className="border border-bat-cyan/50 px-2 py-1 bg-bat-black/70">BAY 02</span>
                <span className="border border-bat-cyan/50 px-2 py-1 bg-bat-black/70">SEAL ▮▮▮▮○</span>
                <span className="text-bat-red font-black">RETRACT ▶</span>
              </div>
            </div>
          </div>

          {/* access granted stamp */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-bat-cyan text-bat-cyan font-black tracking-[0.35em] text-sm px-6 py-3 bg-bat-black/80 animate-gate-flash">
            ACCESS GRANTED
          </div>
        </div>
      )}

      {/* bottom status strip */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between px-8 py-1.5 text-[9px] tracking-[0.25em] uppercase text-bat-text/50 border-t border-bat-red/20 bg-bat-black/70">
        <span>HULL PORTAL // STANDBY — NO PHYSICAL SEAL</span>
        <span className="text-bat-cyan/70">GATE FX: HOLOGRAPHIC BREACH v2</span>
      </div>
    </div>
  );
};
