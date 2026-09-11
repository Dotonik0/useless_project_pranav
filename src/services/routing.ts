import type { FeatureCollection, LineString } from 'geojson';

export interface RouteManeuver {
  type: string;
  modifier?: string;
  location: [number, number]; // [lng, lat]
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  roadName?: string;
}

export interface RouteData {
  geojson: FeatureCollection<LineString>;
  distanceMeters: number;
  durationSeconds: number;
  formattedDistance: string;
  formattedDuration: string;
  maneuvers: RouteManeuver[];
}

/**
 * Formats distance into clean tactical text (e.g., "14.2 KM" or "850 M")
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} KM`;
  }
  return `${Math.round(meters)} M`;
}

/**
 * Formats duration into clean tactical text (e.g., "35 MIN" or "1 HR 15 MIN")
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours} HR ${mins} MIN` : `${hours} HR`;
  }
  return `${Math.max(1, totalMinutes)} MIN`;
}

/**
 * Generates an intelligible navigation instruction from an OSRM step
 */
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
 * Calculates a route between start and destination coordinates using OSRM.
 */
export async function calculateRoute(
  start: [number, number],
  dest: [number, number],
  signal?: AbortSignal
): Promise<RouteData | null> {
  const [startLng, startLat] = start;
  const [destLng, destLat] = dest;

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(osrmUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs?.[0];

        const maneuvers: RouteManeuver[] = (leg?.steps || []).map(
          (step: {
            maneuver: { type: string; modifier?: string; location: [number, number] };
            distance: number;
            duration: number;
            name?: string;
          }) => ({
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
          })
        );

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
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    console.warn('OSRM routing request failed, falling back to tactical vector line:', err);
  }

  // Graceful fallback for offline / mock transit
  const dx = destLng - startLng;
  const dy = destLat - startLat;
  const roughDistMeters = Math.hypot(dx * 111000 * Math.cos((startLat * Math.PI) / 180), dy * 111000);
  const roughDurationSeconds = (roughDistMeters / 12) * 1.3; // ~40 km/h average speed

  const midLng = startLng + dx * 0.5 + 0.005;
  const midLat = startLat + dy * 0.5 - 0.003;

  const fallbackGeojson: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [startLng, startLat],
            [midLng, midLat],
            [destLng, destLat],
          ],
        },
      },
    ],
  };

  return {
    geojson: fallbackGeojson,
    distanceMeters: roughDistMeters,
    durationSeconds: roughDurationSeconds,
    formattedDistance: formatDistance(roughDistMeters),
    formattedDuration: formatDuration(roughDurationSeconds),
    maneuvers: [
      {
        type: 'depart',
        location: start,
        instruction: 'DEPART BATCAVE PLATFORM',
        distance: roughDistMeters * 0.5,
        duration: roughDurationSeconds * 0.5,
        roadName: 'BATCAVE ACCESS TUNNEL',
      },
      {
        type: 'turn',
        modifier: 'right',
        location: [midLng, midLat],
        instruction: 'TURN RIGHT ONTO GOTHAM EXPRESSWAY',
        distance: roughDistMeters * 0.5,
        duration: roughDurationSeconds * 0.5,
        roadName: 'GOTHAM EXPRESSWAY',
      },
      {
        type: 'arrive',
        location: dest,
        instruction: 'ARRIVE AT DESTINATION VECTOR',
        distance: 0,
        duration: 0,
      },
    ],
  };
}
