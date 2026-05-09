/**
 * Geocoding helper — resolves a street address or zip code to lat/lng.
 *
 * MVP uses the Open-Meteo geocoding API (no API key required).
 * Switch to Google Places or Mapbox by implementing the respective provider
 * and setting NEXT_PUBLIC_GEOCODE_PROVIDER in the environment.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: number;
}

interface OpenMeteoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

interface OpenMeteoResponse {
  results?: OpenMeteoResult[];
}

/**
 * Geocode an address or zip code using the Open-Meteo geocoding API.
 * Returns null when no result is found or the input is blank.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = (await res.json()) as OpenMeteoResponse;
  const hit = data.results?.[0];
  if (!hit) return null;

  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  return {
    lat: hit.latitude,
    lng: hit.longitude,
    displayName: parts.join(", "),
    confidence: 0.8,
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
