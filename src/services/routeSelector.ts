import type { FeatureCollection, LineString } from 'geojson';
import { type RouteData, type RouteManeuver, formatDistance, formatDuration } from './routing';

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

interface InternalRouteCandidate {
  raw: RawOSRMRoute;
  badnessScore: number;
  distance: number;
  duration: number;
  turns: number;
  detourRatio: number;
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
 * Evaluates candidates internally.
 * Internal Badness Score formula:
 * badnessScore = (distRatio * 0.40) + (durationRatio * 0.30) + (turnsRatio * 0.15) + (detourRatio * 0.15)
 * Values are strictly internal and never exposed to the UI.
 */
function evaluateCandidates(
  candidates: RawOSRMRoute[],
  start: [number, number],
  dest: [number, number]
): RawOSRMRoute {
  if (candidates.length === 1) return candidates[0];

  const straightLine = Math.max(straightLineDistance(start, dest), 500);

  const parsed: InternalRouteCandidate[] = candidates.map((route) => {
    let turns = 0;
    route.legs?.forEach((leg) => {
      leg.steps?.forEach((step) => {
        if (step.maneuver?.type === 'turn' || step.maneuver?.modifier) {
          turns++;
        }
      });
    });

    const detourRatio = route.distance / straightLine;

    return {
      raw: route,
      badnessScore: 0,
      distance: route.distance,
      duration: route.duration,
      turns: Math.max(turns, 1),
      detourRatio,
    };
  });

  // Normalize metrics
  const maxDist = Math.max(...parsed.map((c) => c.distance), 1);
  const maxDur = Math.max(...parsed.map((c) => c.duration), 1);
  const maxTurns = Math.max(...parsed.map((c) => c.turns), 1);
  const maxDetour = Math.max(...parsed.map((c) => c.detourRatio), 1);

  parsed.forEach((c) => {
    const distScore = c.distance / maxDist;
    const durScore = c.duration / maxDur;
    const turnScore = c.turns / maxTurns;
    const detourScore = c.detourRatio / maxDetour;

    // Internal rating formula
    c.badnessScore =
      distScore * 0.4 +
      durScore * 0.3 +
      turnScore * 0.15 +
      detourScore * 0.15;
  });

  // Pick the candidate with the highest internal score (most scenic/complex/winding)
  parsed.sort((a, b) => b.badnessScore - a.badnessScore);
  return parsed[0].raw;
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
 * Hidden Route Selection Engine
 * Selects an authentic, navigable, fully legal but significantly more elaborate route.
 */
export async function selectOptimalRoute(
  start: [number, number],
  dest: [number, number],
  signal?: AbortSignal
): Promise<RouteData | null> {
  const [startLng, startLat] = start;
  const [destLng, destLat] = dest;

  const candidateRoutes: RawOSRMRoute[] = [];

  // 1. Request multiple alternative routes from OSRM
  try {
    const multiUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true&alternatives=3`;
    const res = await fetch(multiUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        candidateRoutes.push(...data.routes);
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    console.warn('Initial multi-route query failed, checking waypoint variations...', err);
  }

  // 2. If alternatives are limited, generate a tactical waypoint detour to find a more elaborate legal road route
  if (candidateRoutes.length <= 1) {
    try {
      const midLng = (startLng + destLng) / 2;
      const midLat = (startLat + destLat) / 2;
      const dx = destLng - startLng;
      const dy = destLat - startLat;

      // Perpendicular offset (~25% lateral displacement)
      const offsetFactor = 0.28;
      const perpLng = midLng - dy * offsetFactor;
      const perpLat = midLat + dx * offsetFactor;

      const waypointUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${perpLng.toFixed(
        5
      )},${perpLat.toFixed(5)};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

      const wpRes = await fetch(waypointUrl, { signal });
      if (wpRes.ok) {
        const wpData = await wpRes.json();
        if (wpData.code === 'Ok' && wpData.routes && wpData.routes.length > 0) {
          candidateRoutes.push(wpData.routes[0]);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      console.warn('Waypoint detour query failed, proceeding with primary routes...', err);
    }
  }

  // 3. Evaluate candidate routes and select the most elaborate/navigable route
  if (candidateRoutes.length > 0) {
    const chosenRoute = evaluateCandidates(candidateRoutes, start, dest);
    return buildRouteData(chosenRoute);
  }

  return null;
}
