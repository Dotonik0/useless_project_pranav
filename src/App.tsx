import React, { useState, useEffect, useRef } from 'react';
import { BootSequence } from './components/boot/BootSequence';
import { BatHeader } from './components/shell/BatHeader';
import { DestinationPanel } from './components/shell/DestinationPanel';
import { BatMap } from './components/map/BatMap';
import { RouteInfoPanel } from './components/shell/RouteInfoPanel';
import { BatFooter } from './components/shell/BatFooter';
import { SettingsModal } from './components/shell/SettingsModal';
import { NavHUD } from './components/navigation/NavHUD';
import { calculateRoute, formatDistance, formatDuration, type RouteData } from './services/routing';
import { selectOptimalRoute } from './services/routeSelector';
import { gpsManager, type GpsTelemetry } from './services/geolocation';
import { TurnTracker, type TurnUpdate } from './services/turnTracker';
import { audioManager } from './services/audioManager';
import { Navigation, Compass, ChevronUp, ChevronDown } from 'lucide-react';

const BATCAVE_ORIGIN: [number, number] = [-74.0060, 40.7128];

export const App: React.FC = () => {
  const [bootCompleted, setBootCompleted] = useState<boolean>(() => {
    return localStorage.getItem('batmap_boot_completed') === 'true';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'destination' | 'route'>('destination');
  const [isMobileDrawerExpanded, setIsMobileDrawerExpanded] = useState<boolean>(false);
  const [destinationName, setDestinationName] = useState<string | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [, setIsRouting] = useState<boolean>(false);

  // GPS & Navigation state
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(true);
  const [gpsTelemetry, setGpsTelemetry] = useState<GpsTelemetry>(gpsManager.getTelemetry());

  // Turn-by-Turn state
  const turnTrackerRef = useRef<TurnTracker>(new TurnTracker());
  const [turnUpdate, setTurnUpdate] = useState<TurnUpdate>({
    currentStep: null,
    nextStep: null,
    distanceToManeuver: 0,
    formattedDistanceToManeuver: '--',
    isArrived: false,
  });

  // Dynamic remaining metrics during navigation
  const [remainingDistance, setRemainingDistance] = useState<string>('-- KM');
  const [remainingDuration, setRemainingDuration] = useState<string>('-- MIN');

  // HUD ticker notification
  const [systemNotice, setSystemNotice] = useState<string>('GIS CORE // MAP ENGINE ONLINE');

  const simulationTimerRef = useRef<number | null>(null);

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Subscribe to GPS Manager updates and evaluate turn tracking
  useEffect(() => {
    audioManager.setOnError((err) => setSystemNotice(err));

    const unsubscribe = gpsManager.subscribe((telemetry) => {
      setGpsTelemetry(telemetry);
      if (telemetry.errorMessage) {
        setSystemNotice(telemetry.errorMessage);
      }

      if (telemetry.coords) {
        const update = turnTrackerRef.current.updatePosition(telemetry.coords);
        setTurnUpdate(update);

        if (update.announcementAlert && update.currentStep) {
          const alert = update.announcementAlert;
          const step = update.currentStep;

          if (alert === '500M') {
            setSystemNotice(`IN 500 METRES, ${step.instruction}`);
          } else if (alert === '200M') {
            setSystemNotice(`IN 200 METRES, ${step.instruction}`);
          } else if (alert === '50M') {
            setSystemNotice(`${step.instruction}`);
          } else if (alert === 'ARRIVAL') {
            setSystemNotice('ARRIVAL VECTOR CONFIRMED. DESTINATION REACHED.');
          }

          // Trigger audio announcement (TTS or Custom sound from IndexedDB)
          audioManager.announceManeuver(
            step.maneuverType,
            step.modifier,
            alert,
            step.roadName
          );
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleBootComplete = () => {
    setBootCompleted(true);
  };

  const handleReplayBoot = () => {
    localStorage.removeItem('batmap_boot_completed');
    setBootCompleted(false);
  };

  const handleDestinationSelect = async (destination: string, coords?: [number, number]) => {
    const targetCoords = coords || [-74.009, 40.713];
    setDestinationName(destination);
    setDestinationCoords(targetCoords);
    setSystemNotice('DESTINATION LOCKED. CALCULATING PURSUIT VECTOR...');
    setIsRouting(true);

    const currentOrigin = gpsTelemetry.coords || BATCAVE_ORIGIN;

    try {
      const data =
        (await selectOptimalRoute(currentOrigin, targetCoords)) ||
        (await calculateRoute(currentOrigin, targetCoords));
      if (data) {
        setRouteData(data);
        turnTrackerRef.current.init(data.maneuvers);
        const initialTurn = turnTrackerRef.current.updatePosition(currentOrigin);
        setTurnUpdate(initialTurn);
        setRemainingDistance(data.formattedDistance);
        setRemainingDuration(data.formattedDuration);
        setSystemNotice('ROUTE ESTABLISHED.');
      }
    } catch (err) {
      console.error('Routing error:', err);
      setSystemNotice('ROUTE ESTABLISHED // VECTOR ESTIMATION ACTIVE');
    } finally {
      setIsRouting(false);
    }
  };

  const handleLocateMe = () => {
    gpsManager.startTracking();
    setSystemNotice('ACQUIRING POSITION TELEMETRY SATELLITE FIX...');
  };

  const handleInitiateNavigation = () => {
    if (!routeData) return;
    setIsNavigating(true);
    setIsCameraLocked(true);
    turnTrackerRef.current.reset();
    gpsManager.startTracking();
    setSystemNotice('PURSUIT VECTOR ESTABLISHED. NAVIGATION ACTIVE.');
  };

  const handleDisengageNavigation = () => {
    setIsNavigating(false);
    setIsSimulating(false);
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setSystemNotice('PURSUIT VECTOR DISENGAGED. NAVIGATION STANDBY.');
  };

  // Route Simulation Engine for Testing
  useEffect(() => {
    if (!isNavigating || !isSimulating || !routeData) {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      return;
    }

    const feature = routeData.geojson.features[0];
    if (!feature || feature.geometry.type !== 'LineString') return;
    const coords = feature.geometry.coordinates as [number, number][];
    if (coords.length === 0) return;

    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      if (idx >= coords.length) {
        setIsSimulating(false);
        setSystemNotice('ARRIVAL VECTOR CONFIRMED. YOU HAVE REACHED YOUR DESTINATION.');
        return;
      }

      const curr = coords[idx];
      const prev = coords[idx - 1];

      // Calculate heading degrees
      const dLng = curr[0] - prev[0];
      const dLat = curr[1] - prev[1];
      const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

      const simulatedSpeed = 58; // km/h
      gpsManager.updateSimulatedPosition(curr, simulatedSpeed, heading);

      // Turn tracker update
      const update = turnTrackerRef.current.updatePosition(curr);
      setTurnUpdate(update);

      // Remaining estimates
      const progressFraction = idx / coords.length;
      const remainDist = Math.max(0, routeData.distanceMeters * (1 - progressFraction));
      const remainDur = Math.max(0, routeData.durationSeconds * (1 - progressFraction));
      setRemainingDistance(formatDistance(remainDist));
      setRemainingDuration(formatDuration(remainDur));
    }, 700);

    simulationTimerRef.current = timer as unknown as number;

    return () => {
      clearInterval(timer);
      simulationTimerRef.current = null;
    };
  }, [isNavigating, isSimulating, routeData]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06070a] text-slate-200 flex flex-col font-mono">
      {/* CRT Scanlines and Ambient Grid */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30 z-40" />

      {/* 1. Cinematic Boot Sequence (Modal / Overlay) */}
      {!bootCompleted && (
        <BootSequence onComplete={handleBootComplete} />
      )}

      {/* 2. Main Application Shell */}
      {bootCompleted && (
        <>
          {/* Header */}
          <BatHeader
            onOpenSettings={() => setIsSettingsOpen(true)}
            onLocateMe={handleLocateMe}
            onReplayBoot={handleReplayBoot}
          />

          {/* System Notification Banner (HUD ticker) */}
          <div className="relative z-20 bg-[#0c0e14] border-b border-slate-900 px-4 py-1 text-[11px] font-mono flex items-center justify-between text-slate-400 select-none">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`w-2 h-2 rounded-full ${isNavigating ? 'bg-red-500 animate-ping' : 'bg-red-600 animate-pulse'} shrink-0`} />
              <span className="text-slate-400 font-semibold shrink-0">STATUS:</span>
              <span className="text-red-400/90 truncate tracking-wider">{systemNotice}</span>
            </div>
            <div className="hidden sm:block text-[10px] text-slate-400 shrink-0">
              BUILD: 2026.7 // TURN-BY-TURN ACTIVE
            </div>
          </div>

          {/* Main Viewport Content */}
          <div className="relative flex-1 w-full overflow-hidden flex flex-col md:flex-row">
            
            {/* DESKTOP & LAPTOP SIDEBAR (Hidden during Navigation Mode or on Mobile) */}
            <aside className={`hidden md:flex flex-col ${isNavigating ? 'w-72' : 'w-80 lg:w-96 xl:w-[420px]'} shrink-0 border-r border-slate-800/80 bg-[#0a0c11]/95 backdrop-blur p-4 overflow-y-auto z-20 space-y-4 transition-all duration-300`}>
              <DestinationPanel
                onSearchSubmit={(dest, coords) => handleDestinationSelect(dest, coords)}
                onSelectPreset={(dest, coords) => handleDestinationSelect(dest, coords)}
                onStatusNotice={(msg) => setSystemNotice(msg)}
              />
              <RouteInfoPanel
                routeStatus={isNavigating ? 'ACTIVE' : routeData ? 'ESTABLISHED' : 'STANDBY'}
                distance={isNavigating ? remainingDistance : routeData ? routeData.formattedDistance : '-- KM'}
                duration={isNavigating ? remainingDuration : routeData ? routeData.formattedDuration : '-- MIN'}
                onInitiateNavigation={handleInitiateNavigation}
              />
            </aside>

            {/* REAL MAPLIBRE MAP CONTAINER (Full on Mobile, Maximized on Desktop) */}
            <main className="relative flex-1 h-full w-full overflow-hidden">
              {/* Active Navigation Mode HUD Overlay with Maneuver Card */}
              {isNavigating && (
                <NavHUD
                  speedKmH={gpsTelemetry.speedKmH}
                  remainingDistance={remainingDistance}
                  remainingDuration={remainingDuration}
                  isSimulating={isSimulating}
                  isCameraLocked={isCameraLocked}
                  currentStep={turnUpdate.currentStep}
                  nextStep={turnUpdate.nextStep}
                  distanceToManeuverFormatted={turnUpdate.formattedDistanceToManeuver}
                  isArrived={turnUpdate.isArrived}
                  onToggleCameraLock={() => setIsCameraLocked(!isCameraLocked)}
                  onToggleSimulation={() => setIsSimulating(!isSimulating)}
                  onDisengage={handleDisengageNavigation}
                />
              )}

              <BatMap
                originCoord={BATCAVE_ORIGIN}
                destinationCoord={destinationCoords}
                userPosition={isNavigating ? gpsTelemetry.coords : undefined}
                userHeading={gpsTelemetry.heading}
                isNavigating={isNavigating}
                isCameraLocked={isCameraLocked}
                routeGeoJson={routeData?.geojson || null}
                onStatusMessage={(msg) => setSystemNotice(msg)}
              />

              {/* DEDICATED MOBILE OVERLAY (Visible only on < md screens) */}
              {!isNavigating && (
                <div className="md:hidden absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end pointer-events-none">
                  {/* Mobile Floating Drawer */}
                  <div className="pointer-events-auto w-full bg-[#0a0c12]/95 backdrop-blur-lg border-t border-slate-800 rounded-t-xl shadow-2xl p-3 pb-4">
                    {/* Drawer Handle & Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveTabMobile('destination')}
                          className={`px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider transition-colors min-h-[44px] flex items-center gap-1.5 ${
                            activeTabMobile === 'destination'
                              ? 'bg-red-950/60 border border-red-800 text-red-300'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>DESTINATION</span>
                        </button>

                        <button
                          onClick={() => setActiveTabMobile('route')}
                          className={`px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider transition-colors min-h-[44px] flex items-center gap-1.5 ${
                            activeTabMobile === 'route'
                              ? 'bg-red-950/60 border border-red-800 text-red-300'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>ROUTE</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setIsMobileDrawerExpanded(!isMobileDrawerExpanded)}
                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 rounded"
                        aria-label="Toggle drawer expansion"
                      >
                        {isMobileDrawerExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Drawer Body (Collapsible or Scrollable) */}
                    <div className={`transition-all duration-300 overflow-y-auto ${isMobileDrawerExpanded ? 'max-h-[60vh]' : 'max-h-[220px]'}`}>
                      {activeTabMobile === 'destination' ? (
                        <DestinationPanel
                          onSearchSubmit={(dest, coords) => handleDestinationSelect(dest, coords)}
                          onSelectPreset={(dest, coords) => handleDestinationSelect(dest, coords)}
                          onStatusNotice={(msg) => setSystemNotice(msg)}
                        />
                      ) : (
                        <RouteInfoPanel
                          routeStatus={routeData ? 'ESTABLISHED' : 'STANDBY'}
                          distance={routeData ? routeData.formattedDistance : '-- KM'}
                          duration={routeData ? routeData.formattedDuration : '-- MIN'}
                          onInitiateNavigation={handleInitiateNavigation}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

            </main>
          </div>

          {/* Footer */}
          <BatFooter
            systemStatus="ONLINE"
            navigationStatus={isNavigating ? 'ENGAGED' : destinationName ? 'ONLINE' : 'STANDBY'}
            positionStatus={gpsTelemetry.status === 'TRACKING' ? 'ONLINE' : gpsTelemetry.status === 'ACQUIRING' ? 'ACQUIRING' : 'STANDBY'}
            audioStatus="STANDBY"
          />

          {/* Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onReplayBoot={handleReplayBoot}
          />
        </>
      )}
    </div>
  );
};

export default App;
