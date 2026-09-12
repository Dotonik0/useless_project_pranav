import { calculateRoute } from './routing';
import { selectOptimalRoute } from './routeSelector';
import type { CalculatedRoute, LocationCoordinate } from '../types';

/** Tactical pursuit radius bound (meters): longest road route ≤ 100km. */
export const TACTICAL_RADIUS_METERS = 100000;

/**
 * Batcomputer routing engine adapter.
 * App.tsx expects `fetchBatRoute(start, dest)` returning a CalculatedRoute.
 * Selects the LONGEST legal road route inside the 50km tactical radius
 * via `selectOptimalRoute`, falling back to the direct `calculateRoute`
 * (which itself degrades to a straight-line vector offline).
 */
export async function fetchBatRoute(
  start: LocationCoordinate,
  dest: LocationCoordinate
): Promise<CalculatedRoute> {
  const startLngLat: [number, number] = [start.lng, start.lat];
  const destLngLat: [number, number] = [dest.lng, dest.lat];

  let result = null;
  try {
    result = await selectOptimalRoute(startLngLat, destLngLat, undefined, TACTICAL_RADIUS_METERS);
  } catch (err) {
    console.warn('Longest-path selection failed, falling back to direct route:', err);
  }
  result ??= await calculateRoute(startLngLat, destLngLat);

  if (!result) {
    throw new Error('Route calculation failed');
  }

  return {
    distance: result.distanceMeters,
    duration: result.durationSeconds,
    maneuvers: result.maneuvers.map((m) => ({
      type: m.type,
      modifier: m.modifier,
      instruction: m.instruction,
      distance: m.distance,
      duration: m.duration,
      location: m.location,
      roadName: m.roadName,
    })),
    geojson: result.geojson,
  };
}
