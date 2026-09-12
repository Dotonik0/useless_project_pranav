import { useState, useEffect, useRef, useCallback } from 'react';
import { BootSequence } from './components/BootSequence';
import { MapContainer } from './components/MapContainer';
import { ManeuverCard } from './components/navigation/ManeuverCard';
import { TelemetryDock } from './components/docks/TelemetryDock';
import { HologramDock } from './components/docks/HologramDock';
import { fetchBatRoute } from './services/routingEngine';
import { batTTS } from './services/audioTTS';
import { sfx } from './services/soundEffects';
import { gpsManager } from './services/geolocation';
import type { GpsTelemetry } from './services/geolocation';
import { TurnTracker } from './services/turnTracker';
import type { TurnUpdate } from './services/turnTracker';
import type { RouteManeuver as EngineManeuver } from './services/routing';
import type { LocationCoordinate, CalculatedRoute, SearchResult } from './types';
import { Navigation, Compass, Target, MapPin, Volume2, Shield } from 'lucide-react';

export function App() {
  const [bootCompleted, setBootCompleted] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<LocationCoordinate | null>(null);
  const [destination, setDestination] = useState<LocationCoordinate | null>(null);
  const [route, setRoute] = useState<CalculatedRoute | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPlotting, setIsPlotting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [sysMsg, setSysMsg] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsTelemetry | null>(null);
  const [turnUpdate, setTurnUpdate] = useState<TurnUpdate | null>(null);
  const [redrawKey, setRedrawKey] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards duplicate route requests (StrictMode / re-renders / GPS updates).
  const routeRequestRef = useRef<string | null>(null);
  const turnTrackerRef = useRef<TurnTracker | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  // Live GPS tracking (drives origin marker, telemetry docks, turn engine).
  useEffect(() => {
    gpsManager.startTracking();
    const unsub = gpsManager.subscribe((t) => {
      setGps(t);
      if (t.status === 'TRACKING') {
        setUserLocation({ lat: t.coords[1], lng: t.coords[0] });
      } else if (t.status === 'DENIED' || t.status === 'UNAVAILABLE') {
        setUserLocation((prev) => prev ?? { lat: 40.748817, lng: -73.98513 });
      }
    });
    return unsub;
  }, []);

  const handleBootComplete = () => {
    setBootCompleted(true);
    batTTS.speakCustom("Batcomputer online. 100 kilometer tactical pursuit matrix engaged.");
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    // Debounce so Nominatim doesn't rate-limit keystrokes
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Geocoding failed:", err);
      }
    }, 400);
  };

  // Single choke point for route computation: guarded against
  // duplicates, reports progress + failures, always leaves UI actionable.
  const requestRoute = useCallback(
    async (origin: LocationCoordinate, dest: LocationCoordinate) => {
      const key = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}>${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}`;
      if (routeRequestRef.current === key || isPlotting) return;
      routeRequestRef.current = key;
      setIsPlotting(true);
      setRouteError(null);
      try {
        const calcRoute = await fetchBatRoute(origin, dest);
        // Last-wins: a newer destination picked mid-flight supersedes this.
        if (routeRequestRef.current !== key) return;
        setRoute(calcRoute);
        // Arm the live turn engine with full maneuver geometry.
        const engineManeuvers: EngineManeuver[] = calcRoute.maneuvers.map((m) => ({
          type: m.type,
          modifier: m.modifier,
          location: m.location ?? [dest.lng, dest.lat],
          instruction: m.instruction,
          distance: m.distance ?? 0,
          duration: m.duration ?? 0,
          roadName: m.roadName,
        }));
        turnTrackerRef.current = new TurnTracker(engineManeuvers);
        setTurnUpdate(null);
        setSysMsg(
          `PATHWAY LOCKED // ${(calcRoute.distance / 1000).toFixed(1)} KM / ${calcRoute.maneuvers.length} MANEUVERS`
        );
        batTTS.speakCustom('Route established. Tactical pursuit trajectory locked.');
      } catch (err) {
        console.error('Route computation failed:', err);
        routeRequestRef.current = null; // allow retry
        setRouteError(err instanceof Error ? err.message : 'ROUTE UPLINK FAILED');
      } finally {
        setIsPlotting(false);
      }
    },
    [isPlotting]
  );

  // Auto-fetch when BOTH ends exist. Covers the race where the destination
  // is picked before the GPS fix arrives (previously: silently no route).
  useEffect(() => {
    if (destination && userLocation && !route && !routeError) {
      void requestRoute(userLocation, destination);
    }
  }, [destination, userLocation, route, routeError, requestRoute]);

  const handleSelectDestination = (result: SearchResult) => {
    sfx.playLockSound();
    const destLoc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setDestination(destLoc);
    setSearchResults([]);
    setSearchQuery(result.display_name);
    // New target → drop stale pathway, allow fresh request (effect fires
    // immediately if GPS is ready, or as soon as it resolves).
    setRoute(null);
    setIsNavigating(false);
    setTurnUpdate(null);
    turnTrackerRef.current = null;
    routeRequestRef.current = null;

    if (userLocation) {
      void requestRoute(userLocation, destLoc);
    } else {
      setSysMsg('AWAITING GPS FIX // PATHWAY PLOTS ON LOCK');
    }
  };

  // Live turn engine: every GPS fix recomputes distance-to-next-maneuver,
  // auto-advances inside 25m, and fires 500/200/50m voice alerts.
  useEffect(() => {
    if (!gps || gps.status !== 'TRACKING' || !isNavigating || !route) return;
    const tracker = turnTrackerRef.current;
    if (!tracker) return;
    const upd = tracker.updatePosition(gps.coords);
    setTurnUpdate(upd);
    if (upd.announcementAlert === '500M' && upd.currentStep) {
      batTTS.speakCustom(`In 500 metres, ${upd.currentStep.instruction}`);
    } else if (upd.announcementAlert === '200M' && upd.currentStep) {
      batTTS.speakCustom(`In 200 metres, ${upd.currentStep.instruction}`);
    } else if (upd.announcementAlert === '50M' && upd.currentStep) {
      batTTS.speakManeuver(upd.currentStep.maneuverType, upd.currentStep.modifier);
    } else if (upd.announcementAlert === 'ARRIVAL') {
      batTTS.speakManeuver('arrive');
      setSysMsg('TARGET REACHED // PURSUIT COMPLETE');
    }
  }, [gps, isNavigating, route]);

  const skipStep = () => {
    const tracker = turnTrackerRef.current;
    if (!tracker) return;
    tracker.advance();
    const pos: [number, number] =
      gps && gps.status === 'TRACKING'
        ? gps.coords
        : userLocation
          ? [userLocation.lng, userLocation.lat]
          : [0, 0];
    const upd = tracker.updatePosition(pos);
    setTurnUpdate(upd);
    if (upd.currentStep) batTTS.speakManeuver(upd.currentStep.maneuverType, upd.currentStep.modifier);
  };

  const startNavigation = () => {
    if (!route) return;
    const tracker = turnTrackerRef.current;
    if (tracker) {
      tracker.reset();
      const pos: [number, number] =
        gps && gps.status === 'TRACKING'
          ? gps.coords
          : userLocation
            ? [userLocation.lng, userLocation.lat]
            : [0, 0];
      setTurnUpdate(tracker.updatePosition(pos));
    }
    setIsNavigating(true);
    batTTS.speakCustom('Pursuit vector established.');

    if (route.maneuvers.length > 0) {
      const first = route.maneuvers[0];
      batTTS.speakManeuver(first.type, first.modifier);
    }
  };

  const disengage = () => {
    setIsNavigating(false);
    setTurnUpdate(null);
  };

  return (
    <div className="w-screen h-screen bg-bat-black font-mono text-bat-text flex flex-col overflow-hidden select-none">
      {!bootCompleted && <BootSequence onComplete={handleBootComplete} />}

      {/* Top Header HUD with Bat Logos */}
      <header className="h-14 bg-bat-charcoal border-b border-bat-red/40 px-4 flex items-center justify-between z-30 shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-bat-black border border-bat-red rounded-full">
            <svg className="w-6 h-6 fill-bat-red" viewBox="0 0 24 24">
              <path d="M12,2C10.5,3.5 8,4 6,3C4,2 3,3.5 3,5.5C3,9.5 7,12.5 12,21C17,12.5 21,9.5 21,5.5C21,3.5 20,2 18,3C16,4 13.5,3.5 12,2Z"/>
            </svg>
          </div>
          <span className="font-black text-lg tracking-widest text-white uppercase">THE BAT MAP</span>
          <span className="text-[10px] bg-bat-red/20 text-bat-red px-2 py-0.5 border border-bat-red/40 rounded uppercase font-bold">100KM MATRIX</span>
        </div>

        <div className="flex items-center gap-6 text-xs text-bat-text/80">
          <div className="hidden md:flex items-center gap-2">
            <Compass className="w-4 h-4 text-bat-red animate-spin" /> GPS:{' '}
            {gps?.status === 'TRACKING'
              ? `${gps.speedKmH} KM/H`
              : (gps?.status ?? 'ACQUIRING')}
          </div>
          <div className="flex items-center gap-2 text-bat-red font-bold">
            <Target className="w-4 h-4" /> BATCOMPUTER ONLINE
          </div>
        </div>
      </header>

      {/* Main Container: side docks flank the map so tech readouts
          never cover the tile window (docks hidden below lg screens) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <TelemetryDock gps={gps} maneuverCount={route?.maneuvers.length ?? 0} />

        <div className="flex-1 relative flex min-w-0 overflow-hidden">
        {/* Floating Bat Panel HUD */}
        <div className="absolute top-4 left-4 z-20 w-80 md:w-96 bg-bat-charcoal/95 backdrop-blur-md border border-bat-red/40 p-4 rounded shadow-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-bat-red/30 pb-2">
            <span className="text-[11px] font-bold text-bat-red tracking-widest uppercase flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> TARGET DESIGNATION
            </span>
            <svg className="w-4 h-4 fill-bat-red/70" viewBox="0 0 24 24">
              <path d="M12,2C10.5,3.5 8,4 6,3C4,2 3,3.5 3,5.5C3,9.5 7,12.5 12,21C17,12.5 21,9.5 21,5.5C21,3.5 20,2 18,3C16,4 13.5,3.5 12,2Z"/>
            </svg>
          </div>

          <div>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="ENTER LOCATION / COORDINATES..."
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-bat-black border border-bat-red/50 px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-bat-red shadow-inner placeholder:text-bat-text/30"
              />
              <MapPin className="absolute right-2.5 top-2.5 w-4 h-4 text-bat-red" />
            </div>

            {/* Auto-complete List */}
            {searchResults.length > 0 && (
              <div className="bg-bat-black border border-bat-red/40 mt-1 max-h-48 overflow-y-auto divide-y divide-bat-dark">
                {searchResults.map((item) => (
                  <button
                    key={item.place_id}
                    onClick={() => handleSelectDestination(item)}
                    className="w-full text-left px-3 py-2 text-[11px] text-bat-text/80 hover:bg-bat-red/20 hover:text-white transition-colors"
                  >
                    {item.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Plotting / error states */}
          {isPlotting && !route && (
            <div className="border border-bat-red/40 bg-bat-black p-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-bat-red animate-ping shrink-0" />
              <div className="text-[11px] text-bat-red font-bold tracking-widest uppercase">
                PLOTTING TACTICAL PATHWAY…
                <div className="text-[9px] text-bat-text/50 font-mono tracking-normal mt-0.5">
                  SCANNING 100KM MATRIX FOR LONGEST VECTOR
                </div>
              </div>
            </div>
          )}
          {routeError && !route && !isPlotting && (
            <div className="border border-amber-700/60 bg-amber-950/20 p-3 flex flex-col gap-2">
              <div className="text-[11px] text-amber-300 font-bold tracking-widest uppercase">
                ROUTE UPLINK FAILED
              </div>
              <div className="text-[10px] text-bat-text/60 font-mono break-words">{routeError}</div>
              <button
                onClick={() => {
                  if (userLocation && destination) void requestRoute(userLocation, destination);
                }}
                className="w-full py-2 border border-bat-red text-bat-red font-black text-[11px] tracking-widest hover:bg-bat-red hover:text-black transition-all uppercase cursor-pointer"
              >
                RETRY PLOT
              </button>
            </div>
          )}

          {/* Tactical Route Info (Strict tactical terminology) */}
          {route && (
            <div className="border-t border-bat-red/20 pt-3 flex flex-col gap-2">
              <div className="text-[11px] text-bat-red font-bold flex justify-between uppercase tracking-wider">
                <span>ROUTE ESTABLISHED</span>
                <span>100KM RADIUS BOUND</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-bat-black p-2 border border-bat-red/30">
                <div>
                  <div className="text-[9px] text-bat-text/50 uppercase font-bold">DISTANCE</div>
                  <div className="text-sm font-black text-white">{(route.distance / 1000).toFixed(2)} km</div>
                </div>
                <div>
                  <div className="text-[9px] text-bat-text/50 uppercase font-bold">EST. TIME</div>
                  <div className="text-sm font-black text-white">{Math.round(route.duration / 60)} mins</div>
                </div>
              </div>

              {!isNavigating ? (
                <>
                  <button
                    onClick={startNavigation}
                    className="w-full py-2.5 bg-bat-red text-black font-black text-xs tracking-widest hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(255,30,39,0.6)] flex items-center justify-center gap-2 uppercase cursor-pointer"
                  >
                    <Navigation className="w-4 h-4" /> ENGAGE NAVIGATION
                  </button>
                  <button
                    onClick={() => {
                      sfx.playLockSound();
                      setRedrawKey((k) => k + 1);
                      setSysMsg('MANUAL PATHWAY REDRAW // FORCING RENDER');
                    }}
                    className="w-full py-1.5 border border-bat-red/50 text-bat-red font-bold text-[10px] tracking-widest hover:bg-bat-red/20 transition-all uppercase cursor-pointer"
                  >
                    REDRAW PATH
                  </button>
                </>
              ) : (
                <div className="p-2 bg-bat-red/10 border border-bat-red flex items-center justify-between text-xs text-bat-red font-bold">
                  <span className="flex items-center gap-1.5"><Volume2 className="w-4 h-4 animate-pulse" /> PURSUIT ACTIVE</span>
                  <button onClick={disengage} className="underline text-[10px] text-bat-text hover:text-white">DISENGAGE</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Next-Turn Status: real-time instruction + metres-to-turn,
            driven by GPS through the turn engine (auto-advances <25m) */}
        {isNavigating && route && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-lg">
            {turnUpdate?.currentStep ? (
              <div className="flex flex-col gap-2">
                <ManeuverCard
                  currentStep={turnUpdate.currentStep}
                  nextStep={turnUpdate.nextStep}
                  distanceFormatted={turnUpdate.formattedDistanceToManeuver}
                  isArrived={turnUpdate.isArrived}
                />
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-bat-black border border-bat-red/30 overflow-hidden">
                    <div
                      className="h-full bg-bat-red shadow-[0_0_8px_#FF1E27] transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((turnUpdate.currentStep.index + 1) /
                            Math.max(route.maneuvers.length, 1)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-bat-text/60 font-mono whitespace-nowrap">
                    STEP {turnUpdate.currentStep.index + 1}/{route.maneuvers.length}
                  </span>
                  <button
                    onClick={skipStep}
                    className="text-[10px] border border-bat-red px-3 py-1.5 text-bat-red hover:bg-bat-red hover:text-black font-bold uppercase transition-all bg-bat-charcoal/90"
                  >
                    SKIP STEP
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-bat-charcoal border-2 border-bat-red p-4 shadow-[0_0_35px_rgba(0,0,0,0.95)] flex items-center gap-4">
                <div className="w-12 h-12 bg-bat-red text-black flex items-center justify-center font-black shadow-[0_0_15px_#FF1E27]">
                  <Navigation className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-bat-red font-bold tracking-widest uppercase">
                    ACQUIRING MANEUVER LOCK
                  </div>
                  <div className="text-xs md:text-sm font-black text-white uppercase">
                    {route.maneuvers[0]?.instruction || 'STANDBY'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tactical Corner Emblem Accents */}
        <div className="absolute top-4 right-4 z-20 pointer-events-none opacity-40 hidden md:block">
          <svg className="w-12 h-12 fill-bat-red" viewBox="0 0 24 24">
            <path d="M12,2C10.5,3.5 8,4 6,3C4,2 3,3.5 3,5.5C3,9.5 7,12.5 12,21C17,12.5 21,9.5 21,5.5C21,3.5 20,2 18,3C16,4 13.5,3.5 12,2Z"/>
          </svg>
        </div>

        {/* Map Rendering View */}
        <MapContainer
          userLocation={userLocation}
          destination={destination}
          route={route}
          redrawSignal={redrawKey}
          onStatusMessage={setSysMsg}
        />
        </div>

        <HologramDock gps={gps} navigating={isNavigating} />
      </div>

      {/* Footer */}
      <footer className="h-6 bg-bat-black border-t border-bat-red/20 px-4 flex items-center justify-between text-[10px] text-bat-text/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-bat-red animate-ping shrink-0"></span>
          <span className="truncate">{sysMsg ?? 'WAYNE ENTERPRISES TACTICAL GRID v9.0.4'}</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>LAT: {userLocation?.lat.toFixed(4) || "0.0000"}</span>
          <span>LNG: {userLocation?.lng.toFixed(4) || "0.0000"}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;