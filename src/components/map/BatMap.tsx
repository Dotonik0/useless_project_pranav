import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Feature } from 'geojson';
import { Layers, Plus, Minus, Crosshair, Compass, ShieldAlert, AlertTriangle } from 'lucide-react';

export interface BatMapProps {
  originCoord?: [number, number]; // [lng, lat]
  destinationCoord?: [number, number] | null; // [lng, lat]
  userPosition?: [number, number];
  userHeading?: number | null;
  isNavigating?: boolean;
  isCameraLocked?: boolean;
  routeGeoJson?: FeatureCollection | Feature | null;
  onMapLoaded?: () => void;
  onStatusMessage?: (msg: string) => void;
}

const DEFAULT_CENTER: [number, number] = [-74.0060, 40.7128]; // Gotham Central (NYC reference)
const DEFAULT_ZOOM = 13;
const DARK_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ||
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const BatMap: React.FC<BatMapProps> = ({
  originCoord = DEFAULT_CENTER,
  destinationCoord = null,
  userPosition,
  userHeading = null,
  isNavigating = false,
  isCameraLocked = true,
  routeGeoJson = null,
  onMapLoaded,
  onStatusMessage,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const originMarkerRef = useRef<Marker | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const mapLoadedRef = useRef<boolean>(false);

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);
  const [currentBearing, setCurrentBearing] = useState<number>(0);
  const [currentCoords, setCurrentCoords] = useState<{ lng: number; lat: number }>({
    lng: DEFAULT_CENTER[0],
    lat: DEFAULT_CENTER[1],
  });

  // 1. Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: DARK_STYLE_URL,
        center: originCoord,
        zoom: DEFAULT_ZOOM,
        pitch: 25,
        attributionControl: {
          compact: true,
        },
      });

      map.on('load', () => {
        mapLoadedRef.current = true;
        setMapLoaded(true);
        onMapLoaded?.();
        onStatusMessage?.('GIS CORE // MAP ENGINE ONLINE');

        // 7. Route Layer Architecture Setup
        if (!map.getSource('bat-route-source')) {
          map.addSource('bat-route-source', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          // Outer glowing casing
          map.addLayer({
            id: 'bat-route-casing',
            type: 'line',
            source: 'bat-route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#7f1d1d',
              'line-width': 7,
              'line-opacity': 0.75,
              'line-blur': 2,
            },
          });

          // Inner sharp tactical laser route
          map.addLayer({
            id: 'bat-route-line',
            type: 'line',
            source: 'bat-route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#ef4444',
              'line-width': 3.5,
              'line-opacity': 0.95,
            },
          });
        }
      });

      map.on('move', () => {
        const center = map.getCenter();
        setCurrentCoords({
          lng: parseFloat(center.lng.toFixed(4)),
          lat: parseFloat(center.lat.toFixed(4)),
        });
        setCurrentZoom(parseFloat(map.getZoom().toFixed(1)));
        setCurrentBearing(Math.round(map.getBearing()));
      });

      map.on('error', (e: maplibregl.ErrorEvent) => {
        console.warn('MapLibre error occurred:', e);
        // Do not crash the UI; show tactical warning
        if (!mapLoadedRef.current) {
          setMapError('OFFLINE TACTICAL GIS CACHE ENGAGED');
        }
      });

      mapRef.current = map;
    } catch (err: unknown) {
      console.error('Failed to initialize MapLibre:', err);
      queueMicrotask(() => {
        setMapError('TACTICAL MAP INITIALIZATION FAILED');
      });
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [originCoord, onMapLoaded, onStatusMessage]);

  // 5. Map Resize Handling (ResizeObserver on container + window resize)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });

    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  // 8. Marker Architecture: Manage Origin / Vehicle Position Marker & Navigation Camera
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const activePos = userPosition || originCoord;
    if (!activePos) return;

    if (!originMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'bat-marker-origin';
      el.title = isNavigating ? 'BAT-VEHICLE VECTOR' : 'BATCAVE / CURRENT POSITION';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(activePos)
        .addTo(mapRef.current);

      originMarkerRef.current = marker;
    } else {
      originMarkerRef.current.setLngLat(activePos);
    }

    // Camera Navigation Tracking
    if (isNavigating && isCameraLocked && mapRef.current) {
      mapRef.current.easeTo({
        center: activePos,
        zoom: 16.2,
        pitch: 45,
        bearing: userHeading !== null ? userHeading : mapRef.current.getBearing(),
        duration: 800,
        essential: true,
      });
    }
  }, [userPosition, originCoord, isNavigating, isCameraLocked, userHeading, mapLoaded]);

  // 8. Marker Architecture: Manage Destination Marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (destinationCoord) {
      if (!destinationMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'bat-marker-destination';
        el.innerHTML = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <circle cx="12" cy="12" r="9" stroke-dasharray="2 2" />
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
            <circle cx="12" cy="12" r="3" fill="#ef4444" />
          </svg>
        `;
        el.title = 'TARGET VECTOR';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(destinationCoord)
          .addTo(mapRef.current);

        destinationMarkerRef.current = marker;
      } else {
        destinationMarkerRef.current.setLngLat(destinationCoord);
      }

      // Smoothly fly towards destination
      mapRef.current.flyTo({
        center: destinationCoord,
        zoom: Math.max(mapRef.current.getZoom(), 13),
        speed: 1.2,
        curve: 1.4,
        essential: true,
      });
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }
  }, [destinationCoord, mapLoaded]);

  // 7. Route Layer Data Updates & Camera Fit
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const source = mapRef.current.getSource('bat-route-source') as GeoJSONSource | undefined;
    if (source) {
      if (routeGeoJson) {
        source.setData(routeGeoJson);

        // Fit camera to full route bounds
        try {
          const coords: [number, number][] = [];
          if ('features' in routeGeoJson && routeGeoJson.features.length > 0) {
            const feat = routeGeoJson.features[0];
            if (feat.geometry && feat.geometry.type === 'LineString') {
              coords.push(...(feat.geometry.coordinates as [number, number][]));
            }
          }

          if (coords.length > 1) {
            let minLng = coords[0][0];
            let maxLng = coords[0][0];
            let minLat = coords[0][1];
            let maxLat = coords[0][1];

            for (const c of coords) {
              if (c[0] < minLng) minLng = c[0];
              if (c[0] > maxLng) maxLng = c[0];
              if (c[1] < minLat) minLat = c[1];
              if (c[1] > maxLat) maxLat = c[1];
            }

            mapRef.current.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              {
                padding: { top: 80, bottom: 120, left: 80, right: 80 },
                maxZoom: 15,
                duration: 1200,
              }
            );
          }
        } catch (e) {
          console.warn('Could not fit bounds to route:', e);
        }
      } else {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [routeGeoJson, mapLoaded]);

  // 3 & 4. HUD Control Handlers
  const handleZoomIn = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.zoomIn({ duration: 300 });
    onStatusMessage?.('MAP OPTICS: ZOOM IN');
  }, [onStatusMessage]);

  const handleZoomOut = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.zoomOut({ duration: 300 });
    onStatusMessage?.('MAP OPTICS: ZOOM OUT');
  }, [onStatusMessage]);

  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return;
    const target = destinationCoord || originCoord || DEFAULT_CENTER;
    mapRef.current.flyTo({
      center: target,
      zoom: DEFAULT_ZOOM,
      bearing: 0,
      pitch: 25,
      duration: 1000,
    });
    onStatusMessage?.('MAP RECENTERED // PRIMARY VECTOR');
  }, [destinationCoord, originCoord, onStatusMessage]);

  const handleResetBearing = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.resetNorthPitch({ duration: 400 });
    onStatusMessage?.('BEARING RESET // TRUE NORTH');
  }, [onStatusMessage]);

  return (
    <div
      id="bat-map-container"
      className="relative w-full h-full bg-[#08090d] overflow-hidden select-none border border-slate-800/80 rounded"
    >
      {/* Actual MapLibre container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* CRT Scanline overlay (subtle, pointer-events-none) */}
      <div className="absolute inset-0 scanlines opacity-20 pointer-events-none z-10" />

      {/* Top Left HUD Telemetry Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none z-20 text-[10px] font-mono text-slate-400 flex flex-col gap-0.5 bg-black/40 backdrop-blur-sm p-1.5 rounded border border-slate-900">
        <div className="flex items-center gap-1.5 text-red-500 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
          <span>GIS CORE // {mapLoaded ? 'ONLINE' : 'INITIALIZING'}</span>
        </div>
        <div>
          GRID: {Math.abs(currentCoords.lat).toFixed(2)}°{currentCoords.lat >= 0 ? 'N' : 'S'},{' '}
          {Math.abs(currentCoords.lng).toFixed(2)}°{currentCoords.lng >= 0 ? 'E' : 'W'}
        </div>
        <div>ZOOM: LVL-{currentZoom}</div>
      </div>

      {/* Top Right HUD Telemetry */}
      <div className="absolute top-3 right-3 pointer-events-none z-20 text-[10px] font-mono text-slate-400 text-right bg-black/40 backdrop-blur-sm p-1.5 rounded border border-slate-900 hidden sm:block">
        <div>BEARING: {((currentBearing % 360) + 360) % 360}°</div>
        <div>PROJECTION: EPSG:3857</div>
        <div className="text-red-400/90 font-semibold">VECTOR ENGINE: MAPLIBRE-GL</div>
      </div>

      {/* Fallback Notice if Style / Network Error */}
      {mapError && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono flex items-center gap-2 shadow-xl backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>{mapError}</span>
        </div>
      )}

      {/* Loading Radar Overlay (fades once map loads) */}
      {!mapLoaded && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#07080b]/80 backdrop-blur-sm">
          <div className="relative w-28 h-28 mb-3">
            <div className="absolute inset-0 rounded-full border border-red-900/40" />
            <div className="absolute inset-3 rounded-full border border-red-700/50 border-dashed" />
            <div className="absolute inset-7 rounded-full border border-red-500/60 animate-beacon" />
            <div className="absolute inset-0 rounded-full animate-radar-sweep">
              <div className="w-1/2 h-1/2 bg-gradient-to-br from-red-600/30 to-transparent rounded-tl-full" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-red-500 font-heading text-xs font-bold tracking-widest glow-text-red">
            <ShieldAlert className="w-4 h-4" />
            <span>CALIBRATING SATELLITE TILES...</span>
          </div>
        </div>
      )}

      {/* Floating Tactical HUD Map Controls (Right side) */}
      <div className="absolute right-3 bottom-16 sm:bottom-6 z-20 flex flex-col gap-2">
        {/* Recenter */}
        <button
          type="button"
          onClick={handleRecenter}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Recenter to Target Vector"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Tactical Reset Compass / Bearing */}
        <button
          type="button"
          onClick={handleResetBearing}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title="Reset True North"
        >
          <Compass
            className="w-4 h-4 text-red-500 transition-transform duration-300"
            style={{ transform: `rotate(${-currentBearing}deg)` }}
          />
        </button>

        {/* Layer Indicator */}
        <div
          className="w-9 h-9 rounded bg-[#0d1017]/90 border border-slate-800 text-slate-400 flex items-center justify-center shadow-lg"
          title="Vector Style: Dark Matter"
        >
          <Layers className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
