export interface GeocodeResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
  city?: string;
}

/**
 * Searches for locations using Photon (OSM-based, high performance)
 * with a fallback to Nominatim.
 */
export async function searchLocations(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  // 1. Try Photon (fast, generous rate limits, OpenStreetMap data)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=5`;
    const res = await fetch(photonUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        return data.features.map((feat: {
          geometry: { coordinates: [number, number] };
          properties: {
            osm_id?: number | string;
            name?: string;
            street?: string;
            city?: string;
            state?: string;
            country?: string;
            osm_value?: string;
          };
        }, idx: number) => {
          const props = feat.properties;
          const name = props.name || props.street || trimmed.toUpperCase();
          const details = [props.city, props.state, props.country].filter(Boolean).join(', ');
          const displayName = details ? `${name}, ${details}` : name;
          return {
            id: String(props.osm_id || idx),
            name: name.toUpperCase(),
            displayName: displayName.toUpperCase(),
            lng: feat.geometry.coordinates[0],
            lat: feat.geometry.coordinates[1],
            type: props.osm_value?.toUpperCase() || 'POI',
            city: props.city?.toUpperCase(),
          };
        });
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    console.warn('Photon geocoding failed, trying Nominatim fallback...', err);
  }

  // 2. Fallback to Nominatim OpenStreetMap
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&limit=5&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      signal,
      headers: {
        'Accept-Language': 'en',
      },
    });
    if (res.ok) {
      const data = await res.json();
      return data.map((item: {
        place_id: number | string;
        display_name: string;
        lat: string;
        lon: string;
        type?: string;
        address?: { city?: string; town?: string; village?: string };
      }) => {
        const parts = item.display_name.split(',');
        const mainName = parts[0] ? parts[0].trim().toUpperCase() : trimmed.toUpperCase();
        return {
          id: String(item.place_id),
          name: mainName,
          displayName: item.display_name.toUpperCase(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type?.toUpperCase() || 'LOCATION',
          city: (item.address?.city || item.address?.town || item.address?.village)?.toUpperCase(),
        };
      });
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    console.error('Nominatim geocoder error:', err);
  }

  return [];
}
