import { describe, it, expect } from "vitest";
import { distanceMeters, withinGeofence } from "./geofence";

const MINNEAPOLIS = { lat: 44.9778, lng: -93.265 };
const COON_RAPIDS = { lat: 45.1235, lng: -93.3096 };

describe("distanceMeters", () => {
  it("same point is 0 meters", () => {
    expect(distanceMeters(MINNEAPOLIS, MINNEAPOLIS)).toBe(0);
  });

  it("known distance Minneapolis → Coon Rapids is ~17 km", () => {
    const d = distanceMeters(MINNEAPOLIS, COON_RAPIDS);
    expect(d).toBeGreaterThan(16_000);
    expect(d).toBeLessThan(18_000);
  });

  it("is symmetric", () => {
    const ab = distanceMeters(MINNEAPOLIS, COON_RAPIDS);
    const ba = distanceMeters(COON_RAPIDS, MINNEAPOLIS);
    expect(ab).toBeCloseTo(ba, 0);
  });

  it("small offset (~111 m per 0.001 degrees latitude)", () => {
    const a = { lat: 45.0, lng: -93.0 };
    const b = { lat: 45.001, lng: -93.0 };
    const d = distanceMeters(a, b);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe("withinGeofence", () => {
  const venue = { lat: 45.0, lng: -93.0, radiusMeters: 200 };

  it("point at venue center is within", () => {
    expect(withinGeofence({ lat: 45.0, lng: -93.0 }, venue)).toBe(true);
  });

  it("point just inside radius is within", () => {
    // ~100m offset
    expect(withinGeofence({ lat: 45.0009, lng: -93.0 }, venue)).toBe(true);
  });

  it("point outside radius is not within", () => {
    // ~500m offset
    expect(withinGeofence({ lat: 45.005, lng: -93.0 }, venue)).toBe(false);
  });

  it("point exactly on boundary is within (<=)", () => {
    const point = { lat: 45.0, lng: -93.0 };
    const tightVenue = { ...venue, radiusMeters: 0 };
    expect(withinGeofence(point, tightVenue)).toBe(true);
  });
});
