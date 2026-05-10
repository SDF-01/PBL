/**
 * Geocoding helper — resolves a street address or zip code to lat/lng.
 *
 * Uses Nominatim (OpenStreetMap) — handles full street addresses, no API key
 * required. Nominatim's terms of use require a descriptive User-Agent and
 * prohibit bulk/automated requests; this is fine for single-address admin UI use.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  importance: number;
}

/**
 * Geocode a full street address using Nominatim (OpenStreetMap).
 * Returns null when no result is found or the input is blank.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "PBL-PickleballLeagueApp/1.0 (facility-geocoder)",
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as NominatimResult[];
  const hit = data[0];
  if (!hit) return null;

  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name,
    confidence: hit.importance,
  };
}

/** Returns true only if the coordinates represent a real location (not 0,0). */
export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Haversine distance between two WGS84 coordinate pairs, in miles. */
export function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
