import { useMemo } from 'react';
import { BatMap } from './map/BatMap';
import type { CalculatedRoute, LocationCoordinate } from '../types';

interface MapContainerProps {
  userLocation: LocationCoordinate | null;
  destination: LocationCoordinate | null;
  route: CalculatedRoute | null;
  redrawSignal?: number;
  onStatusMessage?: (msg: string) => void;
}

export function MapContainer({ userLocation, destination, route, redrawSignal = 0, onStatusMessage }: MapContainerProps) {
  const originCoord: [number, number] = useMemo(
    () => (userLocation ? [userLocation.lng, userLocation.lat] : [-74.006, 40.7128]),
    [userLocation]
  );

  const destinationCoord: [number, number] | null = useMemo(
    () => (destination ? [destination.lng, destination.lat] : null),
    [destination]
  );

  const userPosition: [number, number] | undefined = useMemo(
    () => (userLocation ? [userLocation.lng, userLocation.lat] : undefined),
    [userLocation]
  );

  const routeGeoJson = useMemo(() => route?.geojson ?? null, [route]);

  return (
    <div className="flex-1 w-full h-full min-h-0 min-w-0 relative">
      <BatMap
        originCoord={originCoord}
        destinationCoord={destinationCoord}
        userPosition={userPosition}
        routeGeoJson={routeGeoJson}
        redrawSignal={redrawSignal}
        onStatusMessage={onStatusMessage}
      />
    </div>
  );
}

export default MapContainer;
