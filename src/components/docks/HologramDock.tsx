import React, { useEffect, useState } from 'react';
import { Hexagon, LayoutGrid, Cpu } from 'lucide-react';
import { BatsuitHologram } from './BatsuitHologram';
import type { GpsTelemetry } from '../../services/geolocation';

interface HologramDockProps {
  gps: GpsTelemetry | null;
  navigating: boolean;
}

function DockSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-bat-cyan/25 bg-bat-charcoal/80 backdrop-blur-sm p-2.5 flex flex-col gap-2">
      <header className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-bat-cyan uppercase border-b border-bat-cyan/20 pb-1.5">
        {icon}
        <span>{title}</span>
      </header>
      {children}
    </section>
  );
}

const SYS_BARS = ['CPU', 'PWR', 'MEM', 'LNK'];

/** Right tech dock: batsuit hologram, drifting tactical grid, sys meters. */
export const HologramDock: React.FC<HologramDockProps> = ({ gps, navigating }) => {
  const [bars, setBars] = useState<number[]>([62, 81, 44, 93]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setBars((b) => b.map((v) => Math.min(98, Math.max(12, v + (Math.random() * 22 - 11)))));
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside className="hidden lg:flex w-60 xl:w-72 shrink-0 flex-col gap-2 p-2 overflow-y-auto bg-bat-black/60 border-l border-bat-cyan/20">
      <DockSection title="HOLO-DECK" icon={<Hexagon className="w-3.5 h-3.5" />}>
        <BatsuitHologram />
        <div className="font-mono text-[9px] text-bat-text/50 flex justify-between">
          <span>MODE: {navigating ? 'PURSUIT' : 'STANDBY'}</span>
          <span>GPS: {gps?.status ?? 'ACQUIRING'}</span>
        </div>
      </DockSection>

      <DockSection title="TACTICAL GRID" icon={<LayoutGrid className="w-3.5 h-3.5" />}>
        <div className="relative h-28 overflow-hidden border border-bat-cyan/20 bg-bat-black">
          <div className="absolute inset-0 tactical-grid opacity-60 grid-drift" />
          <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />
          {/* sweeping range rings */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-24 h-24 rounded-full border border-bat-red/50" />
            <div className="absolute inset-0 rounded-full animate-radar-sweep">
              <div className="w-1/2 h-1/2 bg-gradient-to-br from-bat-cyan/30 to-transparent rounded-tl-full" />
            </div>
          </div>
          <div className="absolute bottom-1 left-1 font-mono text-[8px] text-bat-cyan/80">SECTOR 7G // 100KM</div>
          <div className="absolute top-1 right-1 font-mono text-[8px] text-bat-red/80 animate-pulse">● LIVE</div>
        </div>
      </DockSection>

      <DockSection title="SYS LOAD" icon={<Cpu className="w-3.5 h-3.5" />}>
        <div className="flex flex-col gap-1.5 font-mono text-[9px]">
          {SYS_BARS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-7 text-bat-text/50">{label}</span>
              <div className="flex-1 h-2 bg-bat-dark overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-bat-cyan to-bat-red transition-all duration-700"
                  style={{ width: `${bars[i]}%` }}
                />
              </div>
              <span className="w-8 text-right text-bat-cyan">{Math.round(bars[i])}%</span>
            </div>
          ))}
        </div>
      </DockSection>
    </aside>
  );
};
