// Great-circle distance in meters between two WGS84 coordinates.
// Haversine formula. Spec requires venue-geofence check-in validation.
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000; // Earth radius, meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function withinGeofence(
  point: { lat: number; lng: number },
  venue: { lat: number; lng: number; radiusMeters: number },
): boolean {
  return distanceMeters(point, venue) <= venue.radiusMeters;
}
