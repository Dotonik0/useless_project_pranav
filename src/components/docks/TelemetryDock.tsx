import React, { useEffect, useRef, useState } from 'react';
import { Activity, Gauge, Satellite, Radio } from 'lucide-react';
import { Sparkline } from './Sparkline';
import type { GpsTelemetry } from '../../services/geolocation';

interface TelemetryDockProps {
  gps: GpsTelemetry | null;
  maneuverCount: number;
}

const CANNED_EVENTS = [
  'UPLINK HANDSHAKE // AES-256 OK',
  'RADAR SWEEP // SECTOR CLEAR',
  'SAT SYNC // EPHEMERIS FRESH',
  'THERMAL NOMINAL // 36.4°C',
  'GRID RECALIBRATED // EPSG:3857',
  'ENCRYPTION ROTATED // KEY 7F',
  'PROXIMITY SCAN // NO CONTACTS',
];

function DockSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-bat-red/25 bg-bat-charcoal/80 backdrop-blur-sm p-2.5 flex flex-col gap-2">
      <header className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-bat-red uppercase border-b border-bat-red/20 pb-1.5">
        {icon}
        <span>{title}</span>
      </header>
      {children}
    </section>
  );
}

/** Left tech dock: live velocity graph, signal bars, sat-link, event log. */
export const TelemetryDock: React.FC<TelemetryDockProps> = ({ gps, maneuverCount }) => {
  const [speedHist, setSpeedHist] = useState<number[]>(() => Array(36).fill(0));
  const [sigHist, setSigHist] = useState<number[]>(() => Array(36).fill(0));
  const [bars, setBars] = useState(4);
  const [log, setLog] = useState<string[]>(['BATCOMPUTER ONLINE // ALL SYSTEMS GO']);
  const tick = useRef(0);

  const speed = gps?.speedKmH ?? 0;

  useEffect(() => {
    const id = window.setInterval(() => {
      tick.current += 1;
      const t = tick.current;
      setSpeedHist((h) => {
        // Live GPS speed + breathing jitter so the trace always moves.
        const jitter = 0.6 + 0.4 * Math.sin(t / 3) + 0.25 * Math.sin(t / 1.3);
        const next = [...h.slice(1), Math.max(0, speed + (speed > 0.5 ? jitter : jitter * 0.4))];
        return next;
      });
      setSigHist((h) => {
        const base = gps?.status === 'TRACKING' ? 62 : 18;
        const next = [...h.slice(1), base + 14 * Math.sin(t / 2.2) + 8 * Math.sin(t / 0.9)];
        return next;
      });
      setBars(3 + Math.abs(Math.round(Math.sin(t / 4) + Math.sin(t / 1.7))) % 3);
      if (t % 5 === 0) {
        setLog((l) => {
          const msg = CANNED_EVENTS[Math.floor(Math.random() * CANNED_EVENTS.length)];
          const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
          return [`${stamp} ${msg}`, ...l].slice(0, 5);
        });
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [speed, gps?.status]);

  const lat = gps ? gps.coords[1].toFixed(4) : '0.0000';
  const lng = gps ? gps.coords[0].toFixed(4) : '0.0000';

  return (
    <aside className="hidden lg:flex w-60 xl:w-72 shrink-0 flex-col gap-2 p-2 overflow-y-auto bg-bat-black/60 border-r border-bat-red/20">
      <DockSection title="VELOCITY" icon={<Gauge className="w-3.5 h-3.5" />}>
        <div className="flex items-baseline justify-between font-mono">
          <span className="text-2xl font-black text-white glow-text-red">{speed}</span>
          <span className="text-[9px] text-bat-text/50">KM/H // LIVE GPS</span>
        </div>
        <Sparkline values={speedHist} stroke="#ff1e27" unit="KM/H" />
      </DockSection>

      <DockSection title="SIGNAL" icon={<Radio className="w-3.5 h-3.5" />}>
        <Sparkline values={sigHist} stroke="#00e5ff" unit="DB" />
        <div className="flex items-end gap-1 h-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex-1 rounded-[1px] transition-all duration-300 ${
                i < bars ? 'bg-bat-cyan shadow-[0_0_6px_rgba(0,229,255,0.8)]' : 'bg-bat-dark'
              }`}
              style={{ height: `${20 + i * 20}%` }}
            />
          ))}
          <span className="ml-auto text-[9px] font-mono text-bat-text/50 self-center">
            SAT-LINK {gps?.status ?? 'ACQUIRING'}
          </span>
        </div>
      </DockSection>

      <DockSection title="POSITION" icon={<Satellite className="w-3.5 h-3.5" />}>
        <div className="font-mono text-[10px] text-bat-text/80 flex flex-col gap-1">
          <div className="flex justify-between"><span className="text-bat-text/40">LAT</span><span className="text-white">{lat}</span></div>
          <div className="flex justify-between"><span className="text-bat-text/40">LNG</span><span className="text-white">{lng}</span></div>
          <div className="flex justify-between"><span className="text-bat-text/40">FIX ±</span><span className="text-white">{gps?.accuracy ?? '--'} M</span></div>
          <div className="flex justify-between"><span className="text-bat-text/40">HDG</span><span className="text-white">{gps?.heading != null ? `${gps.heading}°` : '---'}</span></div>
          <div className="flex justify-between"><span className="text-bat-text/40">WPTS</span><span className="text-bat-red font-bold">{maneuverCount}</span></div>
        </div>
      </DockSection>

      <DockSection title="EVENT LOG" icon={<Activity className="w-3.5 h-3.5" />}>
        <div className="font-mono text-[9px] text-bat-text/60 flex flex-col gap-1 max-h-28 overflow-hidden">
          {log.map((entry, i) => (
            <div key={`${i}-${entry}`} className={i === 0 ? 'text-bat-cyan' : ''}>&gt; {entry}</div>
          ))}
        </div>
      </DockSection>
    </aside>
  );
};
