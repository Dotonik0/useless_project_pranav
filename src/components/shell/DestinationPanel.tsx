import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Compass, Navigation, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { searchLocations, type GeocodeResult } from '../../services/geocoding';

export interface WaypointPreset {
  name: string;
  sector: string;
  coords: [number, number];
}

interface DestinationPanelProps {
  onSearchSubmit?: (query: string, coords?: [number, number]) => void;
  onSelectResult?: (result: GeocodeResult) => void;
  onSelectPreset?: (destination: string, coords?: [number, number]) => void;
  onStatusNotice?: (msg: string) => void;
}

const TACTICAL_PRESETS: WaypointPreset[] = [
  { name: 'WAYNE TOWER', sector: 'SECTOR 01 - FINANCIAL', coords: [-74.009, 40.713] },
  { name: 'GOTHAM PORT AUTHORITY', sector: 'SECTOR 03 - INDUSTRIAL', coords: [-74.025, 40.725] },
  { name: 'AMUSEMENT MILE', sector: 'SECTOR 07 - NORTH SHORE', coords: [-73.985, 40.748] },
  { name: 'EAST DOCKS // BERTH 4', sector: 'SECTOR 04 - DOCKS', coords: [-73.975, 40.708] },
];

export const DestinationPanel: React.FC<DestinationPanelProps> = ({
  onSearchSubmit,
  onSelectResult,
  onSelectPreset,
  onStatusNotice,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (val.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsDropdownOpen(false);
    } else {
      setIsDropdownOpen(true);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      onStatusNotice?.('ACQUIRING DESTINATION...');

      try {
        const data = await searchLocations(query, controller.signal);
        setResults(data);
        setIsDropdownOpen(data.length > 0);
        setSelectedIndex(-1);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Search error:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, onStatusNotice]);

  const handleSelectResult = (item: GeocodeResult) => {
    setSelectedDestination(item.name);
    setQuery(item.name);
    setIsDropdownOpen(false);
    onStatusNotice?.('DESTINATION LOCKED.');
    onSelectResult?.(item);
    onSearchSubmit?.(item.name, [item.lng, item.lat]);
  };

  const handleSelectPreset = (preset: WaypointPreset) => {
    setSelectedDestination(preset.name);
    setQuery(preset.name);
    setIsDropdownOpen(false);
    onStatusNotice?.('DESTINATION LOCKED.');
    onSelectPreset?.(preset.name, preset.coords);
    onSearchSubmit?.(preset.name, preset.coords);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectResult(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelectResult(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="hud-panel p-4 rounded border-slate-800 bg-[#0d0f14]/90 text-slate-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-red-500" />
          <span className="font-heading font-bold text-xs tracking-widest text-slate-100">
            DESTINATION VECTOR ACQUISITION
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">GEO-SATELLITE // ONLINE</span>
      </div>

      {/* Origin Vector Readout */}
      <div className="mb-3 p-2 rounded bg-slate-950/70 border border-slate-900 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-400">
          <Navigation className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px]">ORIGIN:</span>
          <span className="text-slate-300 font-semibold">BATCAVE MAIN PLATFORM</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
          FIXED
        </span>
      </div>

      {/* Search Input Box with Dropdown */}
      <div className="relative mb-3.5">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setIsDropdownOpen(true);
            }}
            placeholder="ENTER ADDRESS, CITY, LANDMARK..."
            className="w-full pl-9 pr-10 py-2.5 rounded bg-slate-950 border border-slate-800 focus:border-red-600 focus:ring-1 focus:ring-red-600 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-500 outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          {isLoading && (
            <Loader2 className="w-4 h-4 text-red-500 animate-spin absolute right-3 top-3" />
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {isDropdownOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded bg-[#0b0d13] border border-red-950/80 shadow-2xl overflow-hidden font-mono divide-y divide-slate-800/80 max-h-60 overflow-y-auto">
            <div className="px-3 py-1 bg-slate-950 text-[10px] text-slate-400 tracking-wider flex items-center justify-between">
              <span>SATELLITE MATCHES</span>
              <span>ENTER TO LOCK</span>
            </div>
            {results.map((res, index) => (
              <button
                key={res.id + index}
                type="button"
                onClick={() => handleSelectResult(res)}
                className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2.5 transition-colors cursor-pointer ${
                  selectedIndex === index
                    ? 'bg-red-950/40 text-slate-100 border-l-2 border-red-500'
                    : 'hover:bg-slate-900/80 text-slate-300'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <div className="overflow-hidden w-full">
                  <div className="font-bold text-slate-100 truncate text-[11px] flex items-center justify-between">
                    <span>{res.name}</span>
                    <span className="text-[9px] text-red-400 font-normal">{res.type}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{res.displayName}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tactical Waypoint Presets */}
      <div className="mb-3">
        <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-2 flex items-center justify-between">
          <span>FREQUENT RECON TARGETS</span>
          <span>PRESET VECTOR</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {TACTICAL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`text-left p-2 rounded border transition-all text-xs font-mono flex items-start gap-2 ${
                selectedDestination === preset.name
                  ? 'border-red-600/80 bg-red-950/30 text-red-200'
                  : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin
                className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                  selectedDestination === preset.name ? 'text-red-500' : 'text-slate-400'
                }`}
              />
              <div className="overflow-hidden">
                <div className="font-semibold truncate text-[11px] text-slate-200">{preset.name}</div>
                <div className="text-[9px] text-slate-400 truncate">{preset.sector}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Status Indicator */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-400">TARGET STATUS:</span>
        {selectedDestination ? (
          <span className="text-red-400 font-bold flex items-center gap-1.5 glow-text-red">
            <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />
            DESTINATION LOCKED: {selectedDestination}
          </span>
        ) : (
          <span className="text-slate-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            DESTINATION: NOT ACQUIRED
          </span>
        )}
      </div>
    </div>
  );
};
