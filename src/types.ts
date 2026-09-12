import type { FeatureCollection, LineString } from 'geojson';

export interface LocationCoordinate {
  lat: number;
  lng: number;
}

export interface RouteManeuver {
  type: string;
  modifier?: string;
  instruction: string;
  distance?: number;
  duration?: number;
  location?: [number, number];
  roadName?: string;
}

export interface CalculatedRoute {
  distance: number; // meters
  duration: number; // seconds
  maneuvers: RouteManeuver[];
  geojson?: FeatureCollection<LineString> | null;
}

export interface SearchResult {
  place_id: string | number;
  lat: string;
  lon: string;
  display_name: string;
}
