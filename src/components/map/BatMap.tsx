import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import type { Map as MapLibreMap, Marker, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
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
  /** Increment to force a full re-ensure + setData + camera refit on demand. */
  redrawSignal?: number;
  onMapLoaded?: () => void;
  onStatusMessage?: (msg: string) => void;
}

/** Fit the camera to a route's LineString bounds. Returns point count. */
function fitRouteBounds(map: MapLibreMap, data: FeatureCollection | Feature): number {
  try {
    const coords: [number, number][] = [];
    if ('features' in data && data.features.length > 0) {
      const feat = data.features[0];
      if (feat.geometry && feat.geometry.type === 'LineString') {
        coords.push(...(feat.geometry.coordinates as [number, number][]));
      }
    } else {
      const geom = (data as Feature).geometry as unknown as {
        type?: string;
        coordinates?: [number, number][];
      };
      if (geom?.type === 'LineString') coords.push(...(geom.coordinates ?? []));
    }
    if (coords.length < 2) return coords.length;

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
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: { top: 80, bottom: 120, left: 80, right: 80 }, maxZoom: 15, duration: 1200 }
    );
    return coords.length;
  } catch (e) {
    console.warn('Could not fit bounds to route:', e);
    return 0;
  }
}

const DEFAULT_CENTER: [number, number] = [-74.0060, 40.7128]; // Gotham Central (NYC reference)
const DEFAULT_ZOOM = 13;

// ── Direct OpenStreetMap raster styles (inline — no style.json CDN) ──
// Tiles render straight from OpenStreetMap servers into the map window.
const OSM_STANDARD_STYLE: StyleSpecification = {
  version: 8,
  name: 'OpenStreetMap Standard',
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-raster', type: 'raster', source: 'osm-raster' }],
};

// Humanitarian (HOT) tile set — same OSM data, alternate renderer. Backup CDN.
const OSM_HOT_STYLE: StyleSpecification = {
  version: 8,
  name: 'OpenStreetMap Humanitarian',
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team',
    },
  },
  layers: [{ id: 'osm-raster', type: 'raster', source: 'osm-raster' }],
};

type OsmStyleId = 'osm' | 'hot';
const OSM_STYLES: Record<OsmStyleId, StyleSpecification> = {
  osm: OSM_STANDARD_STYLE,
  hot: OSM_HOT_STYLE,
};
const STYLE_LABELS: Record<OsmStyleId, string> = {
  osm: 'OSM-STANDARD',
  hot: 'OSM-HOT',
};

/** MapLibre v6 needs WebGL2. VMs / RDP / blocklisted GPUs often lack it —
 *  detect upfront so we show a real error instead of an eternal loader. */
function isWebGL2Available(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    if (!window.WebGL2RenderingContext) return false;
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl2');
    if (ctx) {
      // Release the probe context; it counts against the browser's limit.
      const lose = (ctx as WebGL2RenderingContext).getExtension('WEBGL_lose_context');
      lose?.loseContext();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * (Re)creates the `bat-route-source` GeoJSON source + its casing/line
 * layers if missing. Needed after every `setStyle` (which wipes all
 * custom sources/layers) and as a safety net before `setData`.
 */
function ensureRouteSource(map: MapLibreMap): GeoJSONSource | undefined {
  try {
    if (!map.getSource('bat-route-source')) {
      map.addSource('bat-route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
    }

    // (Re)attach layers independently — a source can exist while its
    // layers were wiped (style swaps), which leaves an invisible route.
    // Stack (bottom → top): dark casing / crimson body / hot core / dashes.
    const ROUTE_LAYERS: Array<{
      id: string;
      paint: {
        'line-color': string;
        'line-width': number;
        'line-opacity': number;
        'line-blur'?: number;
        'line-dasharray'?: number[];
      };
    }> = [
      {
        id: 'bat-route-casing',
        paint: {
          'line-color': '#3d0507',
          'line-width': 16,
          'line-opacity': 0.9,
          'line-blur': 3,
        },
      },
      {
        id: 'bat-route-glow',
        paint: {
          'line-color': '#DC143C',
          'line-width': 10,
          'line-opacity': 0.95,
          'line-blur': 1.5,
        },
      },
      {
        id: 'bat-route-line',
        paint: {
          'line-color': '#ff4d5e',
          'line-width': 5,
          'line-opacity': 1,
        },
      },
      {
        id: 'bat-route-dashes',
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.5,
          'line-opacity': 0.9,
          'line-dasharray': [1.5, 3],
        },
      },
    ];

    for (const layer of ROUTE_LAYERS) {
      if (!map.getLayer(layer.id)) {
        map.addLayer({
          id: layer.id,
          type: 'line',
          source: 'bat-route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: { ...layer.paint },
        });
      }
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'visible');
      } catch {
        // freshly added layers default to visible anyway
      }
    }

    return map.getSource('bat-route-source') as GeoJSONSource | undefined;
  } catch (err) {
    console.warn('Could not ensure bat-route-source:', err);
    return undefined;
  }
}

export const BatMap: React.FC<BatMapProps> = ({
  originCoord = DEFAULT_CENTER,
  destinationCoord = null,
  userPosition,
  userHeading = null,
  isNavigating = false,
  isCameraLocked = true,
  routeGeoJson = null,
  redrawSignal = 0,
  onMapLoaded,
  onStatusMessage,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const originMarkerRef = useRef<Marker | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const mapLoadedRef = useRef<boolean>(false);
  const fallbackAttemptedRef = useRef<boolean>(false);
  const hasCenteredOnUserRef = useRef<boolean>(false);
  const initialCenterRef = useRef<[number, number]>(originCoord);
  const callbacksRef = useRef({ onMapLoaded, onStatusMessage });
  callbacksRef.current = { onMapLoaded, onStatusMessage };
  // Latest route data, re-applied after every setStyle (which wipes all
  // sources/layers). Without this the pathway vanishes on style failover.
  const routeGeoJsonRef = useRef<FeatureCollection | Feature | null>(routeGeoJson);
  routeGeoJsonRef.current = routeGeoJson;

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [styleId, setStyleId] = useState<OsmStyleId>('osm');
  const activeStyleRef = useRef<OsmStyleId>('osm');
  // Set once real OSM tile *content* flows. Catches the "empty canvas"
  // case where the style is up but the tile servers stay blocked.
  const tilesFlowingRef = useRef<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [loadStage, setLoadStage] = useState<string>('CONTACTING OSM TILES');
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);
  const [currentBearing, setCurrentBearing] = useState<number>(0);
  const [currentCoords, setCurrentCoords] = useState<{ lng: number; lat: number }>({
    lng: DEFAULT_CENTER[0],
    lat: DEFAULT_CENTER[1],
  });

  // 1. Initialize MapLibre Map (re-runs on retryKey so RETRY always rebuilds)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized

    // Fresh attempt — clear stale flags from any previous failure.
    // Also pick up the latest known position (the real GPS fix often
    // arrives after first init, which used the fallback center).
    initialCenterRef.current = originCoord;
    mapLoadedRef.current = false;
    fallbackAttemptedRef.current = false;
    activeStyleRef.current = 'osm';
    tilesFlowingRef.current = false;
    setStyleId('osm');
    setMapLoaded(false);
    setMapError(null);
    setFatalError(null);
    setLoadStage('CONTACTING OSM TILES');

    // Hard gate: without WebGL2 the Map constructor will throw. Fail fast
    // with an actionable message instead of hanging on the radar forever.
    if (!isWebGL2Available()) {
      queueMicrotask(() => {
        setFatalError(
          'WEBGL2 UNAVAILABLE // GPU CONTEXT BLOCKED — ENABLE HARDWARE ACCELERATION OR RETRY UPLINK'
        );
      });
      return;
    }

    let loadTimeout: ReturnType<typeof setTimeout> | undefined;
    let tileWatchdog: ReturnType<typeof setTimeout> | undefined;

    const switchToBackupTiles = (map: MapLibreMap, reason: string): boolean => {
      activeStyleRef.current = 'hot';
      setStyleId('hot');
      tilesFlowingRef.current = false;
      setLoadStage(reason);
      callbacksRef.current.onStatusMessage?.(`${reason} // BACKUP OSM TILES`);
      try {
        map.setStyle(OSM_STYLES.hot);
        return true;
      } catch (err) {
        console.error('Backup tile switch failed:', err);
        setMapError('OSM TILE LINK DOWN // CHECK CONNECTION — RETRY UPLINK');
        return false;
      }
    };

    try {
      const map = new MLMap({
        container: mapContainerRef.current,
        style: OSM_STYLES.osm,
        center: initialCenterRef.current,
        zoom: DEFAULT_ZOOM,
        maxZoom: 19,
        pitch: 0,
        attributionControl: {
          // OSM tile policy: keep contributor attribution always visible.
          compact: false,
        },
      });

      map.on('style.load', () => {
        // Inline style parsed — map is usable even if tiles still stream.
        setLoadStage('FETCHING OSM TILES');
        map.resize();

        // 7. Route Layer Architecture Setup (re-added after every setStyle,
        //    which wipes all sources/layers — then re-apply current route
        //    data so the pathway survives tile failover)
        ensureRouteSource(map);
        const routeSource = map.getSource('bat-route-source') as GeoJSONSource | undefined;
        const pendingRoute = routeGeoJsonRef.current;
        if (routeSource) {
          routeSource.setData(
            (pendingRoute as FeatureCollection) ?? {
              type: 'FeatureCollection',
              features: [],
            }
          );
        }

        if (!mapLoadedRef.current) {
          mapLoadedRef.current = true;
          setMapLoaded(true);
          setMapError(null);
          if (loadTimeout) clearTimeout(loadTimeout);
          callbacksRef.current.onMapLoaded?.();
          callbacksRef.current.onStatusMessage?.('GIS CORE // OSM TILE ENGINE ONLINE');
        }
      });

      map.on('load', () => {
        // Second safety net: if the style.load-time source setup raced,
        // rebuild it here (style is guaranteed ready) and re-apply data.
        try {
          ensureRouteSource(map);
          const src = map.getSource('bat-route-source') as GeoJSONSource | undefined;
          const pending = routeGeoJsonRef.current;
          if (src && pending) src.setData(pending as FeatureCollection);
        } catch (e) {
          console.warn('load-time route re-apply missed:', e);
        }
        callbacksRef.current.onStatusMessage?.('GIS CORE // ALL TILES SYNCED');
      });

      map.on('sourcedata', (e) => {
        // Any real tile payload proves its tile server is reachable.
        if (e.sourceDataType === 'content') tilesFlowingRef.current = true;
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

      map.on('error', (e) => {
        // Surface the real cause to console AND UI — a swallowed error
        // is indistinguishable from "still loading".
        const detail = (
          (e as { error?: { message?: string } })?.error?.message ||
          (e as unknown as { message?: string })?.message ||
          ''
        ).trim();
        if (detail) console.warn('MapLibre error:', detail, e);
        // Do not crash the UI; try the backup OSM tiles once, then retry UI
        if (!mapLoadedRef.current && mapRef.current) {
          if (!fallbackAttemptedRef.current) {
            fallbackAttemptedRef.current = true;
            if (switchToBackupTiles(map, 'PRIMARY OSM LINK DOWN // FAILOVER TILES')) return;
          }
          setMapError(
            detail
              ? `OSM LINK DOWN // ${detail.toUpperCase().slice(0, 90)} — RETRY UPLINK`
              : 'OSM LINK DOWN // TILES UNREACHABLE — RETRY UPLINK'
          );
        }
      });

      // Staged failover: hanging tile requests fire NO error event, so the
      // timeout — not the error handler — is the real safety net.
      const armTimeout = (ms: number) => {
        if (loadTimeout) clearTimeout(loadTimeout);
        loadTimeout = setTimeout(() => {
          if (mapLoadedRef.current || !mapRef.current) return;
          if (!fallbackAttemptedRef.current) {
            fallbackAttemptedRef.current = true;
            if (!switchToBackupTiles(map, 'PRIMARY OSM LINK STALLED // FAILOVER TILES')) return;
            armTimeout(12000);
          } else {
            setMapError('OSM LINK TIMEOUT // CHECK CONNECTION — RETRY UPLINK');
          }
        }, ms);
      };
      armTimeout(12000);

      // Vector-tile watchdog: the style can be up while tile servers stay
      // blocked — leaving a blank canvas with no roads/buildings. If no
      // tile content flows in the window, fail over to backup OSM tiles.
      tileWatchdog = window.setTimeout(() => {
        const mapNow = mapRef.current;
        if (!mapNow || tilesFlowingRef.current) return;
        if (mapLoadedRef.current && activeStyleRef.current === 'osm') {
          try {
            if (mapNow.areTilesLoaded()) return;
          } catch {
            // fall through to failover
          }
          if (!switchToBackupTiles(mapNow, 'TILE FLOW STALLED // BACKUP OSM TILES')) return;
          // Second window for the backup servers, then a hard error.
          window.setTimeout(() => {
            const m = mapRef.current;
            if (!m || tilesFlowingRef.current) return;
            try {
              if (m.areTilesLoaded()) return;
            } catch {
              // fall through
            }
            setMapError('OSM TILE SERVERS UNREACHABLE // ALL LINKS DOWN — RETRY UPLINK');
          }, 12000);
        }
      }, 12000);

      mapRef.current = map;
      // TEMP-DEBUG: expose for headless repro (reverted after fix)
      (window as unknown as { __batMap: MapLibreMap }).__batMap = map;

      // Layout often still settles (fonts, flex, boot overlay) right after
      // init — nudge the canvas so it never stays at 0x0 / blank.
      requestAnimationFrame(() => map.resize());
      window.setTimeout(() => {
        if (mapRef.current) mapRef.current.resize();
      }, 400);
      window.setTimeout(() => {
        if (mapRef.current) mapRef.current.resize();
      }, 1500);
    } catch (err: unknown) {
      console.error('Failed to initialize MapLibre:', err);
      const detail =
        err instanceof Error && err.message ? ` // ${err.message.toUpperCase().slice(0, 90)}` : '';
      queueMicrotask(() => {
        // Construction failed (usually WebGL context) — mapRef is null, so
        // the only recovery is a full re-init via retryKey.
        setFatalError(`TACTICAL MAP INITIALIZATION FAILED${detail} — RETRY UPLINK`);
      });
    }

    // Cleanup on unmount / retry
    return () => {
      if (loadTimeout) clearTimeout(loadTimeout);
      clearTimeout(tileWatchdog);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // 5. Map Resize Handling (ResizeObserver on container + window resize)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Container may mount at 0px while flex/boot settles — resize once known.
    if (mapRef.current) mapRef.current.resize();

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

      const marker = new MLMarker({ element: el }).setLngLat(activePos).addTo(mapRef.current);

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

        const marker = new MLMarker({ element: el }).setLngLat(destinationCoord).addTo(mapRef.current);

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

    // ensureRouteSource: the source may have been wiped by a style
    // failover that happened after this effect last ran.
    const source = ensureRouteSource(mapRef.current);
    if (source) {
      if (routeGeoJson) {
        try {
          source.setData(routeGeoJson);
          try {
            mapRef.current?.triggerRepaint();
          } catch {
            // repaint is best-effort; setData already schedules a render
          }
          const ptCount =
            'features' in routeGeoJson && routeGeoJson.features.length > 0
              ? (
                  routeGeoJson.features[0]?.geometry as { coordinates?: unknown[] } | undefined
                )?.coordinates?.length ?? 0
              : 0;
          const hasSrc = !!mapRef.current?.getSource('bat-route-source');
          const lyrOk = ['bat-route-casing', 'bat-route-glow', 'bat-route-line', 'bat-route-dashes'].filter(
            (id) => mapRef.current?.getLayer(id)
          ).length;
          callbacksRef.current.onStatusMessage?.(
            `TACTICAL PATHWAY RENDERED // ${ptCount} PTS // SRC ${hasSrc ? 'OK' : 'MISS'} // LYR ${lyrOk}/4`
          );
        } catch (e) {
          console.error('Failed to render route pathway:', e);
          callbacksRef.current.onStatusMessage?.('PATHWAY RENDER FAULT // SEE CONSOLE');
        }

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

  // Manual redraw: bypasses all effect timing — re-ensures source/layers,
  // pushes current route data, repaints, refits camera. If the line appears
  // on REDRAW, the issue is timing; if not, data/layer fault (see message).
  useEffect(() => {
    if (!redrawSignal) return;
    const map = mapRef.current;
    if (!map || !mapLoaded) {
      callbacksRef.current.onStatusMessage?.('REDRAW QUEUED // MAP NOT READY');
      return;
    }
    try {
      const src = ensureRouteSource(map);
      const data = routeGeoJsonRef.current;
      if (!data) {
        callbacksRef.current.onStatusMessage?.('REDRAW FAULT // NO PATH DATA IN MAP');
        return;
      }
      const coords =
        'features' in data && data.features.length > 0
          ? (
              data.features[0]?.geometry as { coordinates?: unknown[] } | undefined
            )?.coordinates?.length ?? 0
          : 0;
      if (!src) {
        callbacksRef.current.onStatusMessage?.(
          `REDRAW FAULT // SOURCE MISSING // ${coords} PTS STAGED`
        );
        return;
      }
      src.setData(data as FeatureCollection);
      try {
        map.triggerRepaint();
      } catch {
        // best-effort
      }
      const fitted = fitRouteBounds(map, data);
      const lyrOk = ['bat-route-casing', 'bat-route-glow', 'bat-route-line', 'bat-route-dashes'].filter(
        (id) => map.getLayer(id)
      ).length;
      callbacksRef.current.onStatusMessage?.(
        `PATHWAY REDRAWN // ${coords} PTS // FIT ${fitted} // LYR ${lyrOk}/4`
      );
    } catch (e) {
      console.error('Manual pathway redraw failed:', e);
      callbacksRef.current.onStatusMessage?.('REDRAW FAULT // SEE CONSOLE');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redrawSignal]);

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
      pitch: 0,
      duration: 1000,
    });
    onStatusMessage?.('MAP RECENTERED // PRIMARY VECTOR');
  }, [destinationCoord, originCoord, onStatusMessage]);

  const handleResetBearing = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.resetNorthPitch({ duration: 400 });
    callbacksRef.current.onStatusMessage?.('BEARING RESET // TRUE NORTH');
  }, []);

  // Manual OSM tile-server switch (Layers button). If one server renders
  // empty on your network, tapping this swaps to the other. Route +
  // markers survive via the style.load re-apply path.
  const handleCycleStyle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next: OsmStyleId = activeStyleRef.current === 'osm' ? 'hot' : 'osm';
    activeStyleRef.current = next;
    setStyleId(next);
    tilesFlowingRef.current = false;
    setMapError(null);
    try {
      map.setStyle(OSM_STYLES[next]);
      callbacksRef.current.onStatusMessage?.(`OSM TILE SWITCH // ${STYLE_LABELS[next]}`);
    } catch (err) {
      console.error('Style switch failed:', err);
    }
  }, []);

  const handleRetryStyle = useCallback(() => {
    // Full re-init: tear down any half-built map and re-run the init
    // effect via retryKey. This recovers from construction failures
    // (mapRef === null) where setStyle alone is a dead no-op.
    try {
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    } catch {
      mapRef.current = null;
    }
    setLoadStage('RETRYING OSM UPLINK');
    callbacksRef.current.onStatusMessage?.('RETRYING OSM UPLINK...');
    setRetryKey((k) => k + 1);
  }, []);

  // Center once on the real GPS fix (init used the fallback center)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || hasCenteredOnUserRef.current) return;
    const target = userPosition || originCoord;
    if (!target) return;
    hasCenteredOnUserRef.current = true;
    mapRef.current.flyTo({ center: target, zoom: DEFAULT_ZOOM, duration: 1200, essential: true });
  }, [userPosition, originCoord, mapLoaded]);

  return (
    <div
      id="bat-map-container"
      className="relative w-full h-full bg-[#e8e4d8] overflow-hidden select-none border border-slate-800/80 rounded"
    >
      {/* Actual MapLibre container — OSM raster tiles render here */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* CRT Scanline overlay (subtle, pointer-events-none) */}
      <div className="absolute inset-0 scanlines opacity-20 pointer-events-none z-10" />

      {/* Top Left HUD Telemetry Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none z-20 text-[10px] font-mono text-slate-400 flex flex-col gap-0.5 bg-black/40 backdrop-blur-sm p-1.5 rounded border border-slate-900">
        <div className="flex items-center gap-1.5 text-red-500 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
          <span>
            GIS CORE // {mapLoaded ? 'ONLINE' : mapError || fatalError ? 'UPLINK FAILED' : 'INITIALIZING'}
          </span>
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
        <div>TILES: {STYLE_LABELS[styleId]}</div>
        <div className="text-red-400/90 font-semibold">SOURCE: OPENSTREETMAP</div>
      </div>

      {/* Fallback Notice if Style / Network Error */}
      {(mapError || fatalError) && mapLoaded && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono flex items-center gap-3 shadow-xl backdrop-blur-md whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{fatalError ?? mapError}</span>
          <button
            type="button"
            onClick={handleRetryStyle}
            className="px-2 py-1 border border-amber-600 text-amber-200 hover:bg-amber-800/50 font-bold uppercase tracking-widest text-[10px] transition-colors cursor-pointer"
          >
            Retry uplink
          </button>
        </div>
      )}

      {/* Loading Radar Overlay (fades once map loads; hidden on hard error) */}
      {!mapLoaded && !mapError && !fatalError && (
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
            <span>CALIBRATING OPENSTREETMAP TILES...</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 tracking-widest">{loadStage}…</div>
        </div>
      )}

      {/* Hard-error panel: replaces the eternal radar when the map engine
          is dead (WebGL blocked / tiles unreachable). RETRY performs a
          full map re-init. */}
      {!mapLoaded && (mapError || fatalError) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#07080b]/70 backdrop-blur-[2px] px-6">
          <div className="max-w-md w-full border border-red-900/60 bg-black/70 p-5 text-center shadow-[0_0_30px_rgba(255,30,39,0.25)]">
            <div className="flex items-center justify-center gap-2 text-red-500 font-heading text-xs font-bold tracking-widest glow-text-red mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>MAP UPLINK FAILED</span>
            </div>
            <p className="text-[11px] font-mono text-slate-300 leading-relaxed mb-1">
              {fatalError ?? mapError}
            </p>
            <p className="text-[10px] font-mono text-slate-500 tracking-widest mb-4">
              SEARCH + ROUTING STILL ARMED
            </p>
            <button
              type="button"
              onClick={handleRetryStyle}
              className="w-full py-2.5 bg-bat-red text-black font-black text-xs tracking-widest hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(255,30,39,0.6)] uppercase cursor-pointer"
            >
              RETRY UPLINK
            </button>
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

        {/* OSM Tile-Server Switch */}
        <button
          type="button"
          onClick={handleCycleStyle}
          className="w-9 h-9 rounded bg-[#0d1017]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-700/80 text-slate-300 hover:text-red-400 flex items-center justify-center shadow-lg transition-colors cursor-pointer"
          title={`Switch OSM tiles (current: ${STYLE_LABELS[styleId]})`}
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
