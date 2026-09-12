import type { FeatureCollection, LineString } from 'geojson';
import {
  type RouteData,
  type RouteManeuver,
  formatDistance,
  formatDuration,
  fetchWithTimeout,
} from './routing';

interface RawOSRMRoute {
  geometry: LineString;
  distance: number;
  duration: number;
  legs?: Array<{
    steps?: Array<{
      maneuver: { type: string; modifier?: string; location: [number, number] };
      distance: number;
      duration: number;
      name?: string;
    }>;
  }>;
}

function generateStepInstruction(
  type: string,
  modifier: string | undefined,
  roadName: string | undefined
): string {
  const name = roadName ? `ONTO ${roadName.toUpperCase()}` : '';

  if (type === 'depart') return `DEPART ${name}`.trim();
  if (type === 'arrive') return 'ARRIVE AT DESTINATION';
  if (type === 'roundabout') return `ENTER ROUNDABOUT ${name}`.trim();

  switch (modifier) {
    case 'left':
      return `TURN LEFT ${name}`.trim();
    case 'right':
      return `TURN RIGHT ${name}`.trim();
    case 'slight left':
      return `BEAR SLIGHT LEFT ${name}`.trim();
    case 'slight right':
      return `BEAR SLIGHT RIGHT ${name}`.trim();
    case 'sharp left':
      return `SHARP LEFT ${name}`.trim();
    case 'sharp right':
      return `SHARP RIGHT ${name}`.trim();
    case 'straight':
      return `CONTINUE STRAIGHT ${name}`.trim();
    case 'uturn':
      return 'MAKE A U-TURN';
    default:
      return `${type.toUpperCase()} ${name}`.trim();
  }
}

/**
 * Calculates Euclidean straight-line distance in meters between two coordinates.
 */
function straightLineDistance(p1: [number, number], p2: [number, number]): number {
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
}

/**
 * Picks the LONGEST candidate whose total distance fits inside the
 * tactical radius. If nothing fits (destination itself beyond radius),
 * falls back to the shortest candidate so navigation still works.
 */
function pickLongestWithinRadius(
  candidates: RawOSRMRoute[],
  maxRadiusMeters: number
): RawOSRMRoute {
  if (candidates.length === 1) return candidates[0];

  const fitting = candidates.filter((r) => r.distance <= maxRadiusMeters);
  const pool = fitting.length > 0 ? fitting : candidates;
  // Longest first when fitting; shortest first when nothing fits.
  const sorted = [...pool].sort((a, b) =>
    fitting.length > 0 ? b.distance - a.distance : a.distance - b.distance
  );
  return sorted[0];
}

/**
 * Builds lateral detour waypoints (both sides of the direct line) sized
 * from the spare radius budget. Waypoints are clamped so they always stay
 * inside the radius around the origin.
 */
function buildDetourWaypoints(
  start: [number, number],
  dest: [number, number],
  maxRadiusMeters: number
): Array<[number, number]> {
  const [startLng, startLat] = start;
  const [destLng, destLat] = dest;
  const straight = straightLineDistance(start, dest);
  const spare = maxRadiusMeters - straight;
  // Need meaningful spare budget for a detour to make sense.
  if (spare < 4000) return [];

  const midLng = (startLng + destLng) / 2;
  const midLat = (startLat + destLat) / 2;
  const dx = destLng - startLng;
  const dy = destLat - startLat;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [];

  // Perpendicular unit vector (degree space), both sides.
  const px = -dy / len;
  const py = dx / len;

  // Lateral offset sized from spare budget, clamped to sane bounds.
  // Bigger offsets → much longer road loops (still legal OSRM routes).
  const offsetMeters = Math.min(Math.max(spare / 2.5, 3000), 30000);
  const latRad = (midLat * Math.PI) / 180;
  const degPerMeterLat = 1 / 111320;
  const degPerMeterLng = 1 / (111320 * Math.max(Math.cos(latRad), 0.2));

  const waypoints: Array<[number, number]> = [];
  for (const side of [1, -1]) {
    const wLng = midLng + px * side * offsetMeters * degPerMeterLng;
    const wLat = midLat + py * side * offsetMeters * degPerMeterLat;
    const waypoint: [number, number] = [wLng, wLat];
    // Hard radius gate: waypoint must stay inside the radius of origin.
    if (straightLineDistance(start, waypoint) <= maxRadiusMeters) {
      waypoints.push(waypoint);
    }
  }
  return waypoints;
}

/**
 * Builds RouteData object from chosen OSRM route.
 */
function buildRouteData(route: RawOSRMRoute): RouteData {
  const maneuvers: RouteManeuver[] = [];

  route.legs?.forEach((leg) => {
    leg.steps?.forEach((step) => {
      maneuvers.push({
        type: step.maneuver.type,
        modifier: step.maneuver.modifier,
        location: step.maneuver.location,
        instruction: generateStepInstruction(
          step.maneuver.type,
          step.maneuver.modifier,
          step.name
        ),
        distance: step.distance,
        duration: step.duration,
        roadName: step.name,
      });
    });
  });

  const geojson: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          distance: route.distance,
          duration: route.duration,
        },
        geometry: route.geometry,
      },
    ],
  };

  return {
    geojson,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    formattedDistance: formatDistance(route.distance),
    formattedDuration: formatDuration(route.duration),
    maneuvers,
  };
}

/**
 * Tactical Route Selection Engine — LONGEST legal road route inside the
 * radius (never the shortest). All requests fire IN PARALLEL so one slow
 * OSRM query can't stall plotting, and timeouts degrade to fewer
 * candidates instead of killing selection (only genuine caller aborts
 * propagate).
 *
 * Strategy: pull OSRM alternatives for the direct corridor plus real-road
 * detour candidates via lateral waypoints (both sides, sized from the
 * spare radius budget). From all candidates, select the LONGEST route
 * whose total distance stays within `maxRadiusMeters`. Every candidate is
 * a genuine OSRM road route.
 */
export async function selectOptimalRoute(
  start: [number, number],
  dest: [number, number],
  signal?: AbortSignal,
  maxRadiusMeters = 100000
): Promise<RouteData | null> {
  const [startLng, startLat] = start;
  const [destLng, destLat] = dest;

  const candidateRoutes: RawOSRMRoute[] = [];

  const collectRoutes = (data: unknown): void => {
    const d = data as { code?: string; routes?: RawOSRMRoute[] };
    if (d && d.code === 'Ok' && Array.isArray(d.routes) && d.routes.length > 0) {
      candidateRoutes.push(...d.routes);
    }
  };

  const queryUrl = async (url: string, tag: string): Promise<void> => {
    try {
      const res = await fetchWithTimeout(url, 12000, signal);
      if (res.ok) collectRoutes(await res.json());
    } catch (err) {
      // Caller abort is real cancellation — everything else (including our
      // own fetch timeouts) just means fewer candidates, never a failure.
      if (signal?.aborted) throw err;
      console.warn(`${tag} query missed, continuing with remaining candidates...`);
    }
  };

  // 1. Direct-corridor alternatives.
  const jobs: Array<Promise<void>> = [
    queryUrl(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true&alternatives=3`,
      'Corridor alternatives'
    ),
  ];

  // 2. Lateral detour candidates (real-road routes via offset waypoints),
  //    only when the straight-line distance leaves spare radius budget.
  const straight = straightLineDistance(start, dest);
  if (straight <= maxRadiusMeters) {
    for (const [wLng, wLat] of buildDetourWaypoints(start, dest, maxRadiusMeters)) {
      jobs.push(
        queryUrl(
          `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${wLng.toFixed(
            5
          )},${wLat.toFixed(5)};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`,
          'Waypoint detour'
        )
      );
    }
  }

  await Promise.all(jobs);

  // 3. Select the LONGEST candidate inside the radius bound.
  if (candidateRoutes.length > 0) {
    const chosenRoute = pickLongestWithinRadius(candidateRoutes, maxRadiusMeters);
    return buildRouteData(chosenRoute);
  }

  return null;
}
