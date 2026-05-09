/**
 * OpenStreetMap Overpass API helper for pickleball court discovery.
 *
 * Flow:
 *   1. Geocode the area string with Nominatim → get bounding box
 *   2. Run Overpass query inside that bbox for sport=pickleball
 *   3. Map results to OsmFacility shape ready for ClubFacility import
 */

import type { ClubFacility, FacilityOwnershipType, FacilityAccessType } from "@/lib/permissions/types";
import { COMMUNITY_CLUB_ID } from "@/lib/community/constants";

export interface OsmFacility {
  /** "node/12345678" or "way/12345678" — used as osmId on ClubFacility */
  osmId: string;
  facilityName: string | undefined;
  address: string | undefined;
  lat: number;
  lng: number;
  pickleballCourts: number | undefined;
  hasLights: boolean | undefined;
  isIndoor: boolean | undefined;
  ownershipType: FacilityOwnershipType | undefined;
  accessType: FacilityAccessType | undefined;
  notes: string | undefined;
  /** Raw OSM tags for debugging */
  tags: Record<string, string>;
}

interface NominatimHit {
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [minLat, maxLat, minLng, maxLng]
  display_name: string;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** Nominatim geocode an area string → bounding box [s, n, w, e] */
async function geocodeAreaBbox(
  area: string,
): Promise<[number, number, number, number] | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", area);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "PBL-PickleballLeagueApp/1.0 (court-importer)" },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as NominatimHit[];
  const hit = data[0];
  if (!hit) return null;

  const [minLat, maxLat, minLng, maxLng] = hit.boundingbox;
  let s = parseFloat(minLat);
  let n = parseFloat(maxLat);
  let w = parseFloat(minLng);
  let e = parseFloat(maxLng);

  // For very small bboxes (city-level), expand by ~8 miles so we don't miss edge courts
  const latSpan = n - s;
  const lngSpan = e - w;
  if (latSpan < 0.15) { s -= 0.07; n += 0.07; }
  if (lngSpan < 0.15) { w -= 0.07; e += 0.07; }

  return [s, n, w, e];
}

function deriveOwnership(tags: Record<string, string>): FacilityOwnershipType | undefined {
  const access = tags["access"] ?? "";
  const operator = (tags["operator"] ?? tags["operator:type"] ?? "").toLowerCase();
  if (operator.includes("city") || operator.includes("municipal") || operator.includes("parks")) return "municipal";
  if (operator.includes("school") || operator.includes("university")) return "school";
  if (operator.includes("club") || operator.includes("association")) return "club_owned";
  if (access === "private") return "private";
  if (access === "public" || access === "yes" || tags["leisure"]) return "public";
  return undefined;
}

function deriveAccess(tags: Record<string, string>): FacilityAccessType | undefined {
  const access = tags["access"] ?? "";
  const fee = tags["fee"] ?? "";
  if (fee === "yes") return "fee_required";
  if (access === "private") return "members_only";
  if (access === "public" || access === "yes" || !access) return "public";
  return undefined;
}

function mapElement(el: OverpassElement): OsmFacility | null {
  const lat = el.type === "node" ? el.lat : el.center?.lat;
  const lng = el.type === "node" ? el.lon : el.center?.lon;
  if (!lat || !lng) return null;

  const tags = el.tags ?? {};
  const houseNumber = tags["addr:housenumber"] ?? "";
  const street = tags["addr:street"] ?? "";
  const city = tags["addr:city"] ?? "";
  const state = tags["addr:state"] ?? "";
  const postcode = tags["addr:postcode"] ?? "";

  const streetLine = [houseNumber, street].filter(Boolean).join(" ");
  const cityLine = [city, state, postcode].filter(Boolean).join(", ");
  const address = [streetLine, cityLine].filter(Boolean).join(", ") || undefined;

  const courtCount =
    parseInt(tags["sport:pickleball:courts"] ?? tags["pickleball:courts"] ?? "0", 10) || undefined;

  const notes = [tags["description"], tags["note"]].filter(Boolean).join(" ") || undefined;

  return {
    osmId: `${el.type}/${el.id}`,
    facilityName: tags["name"] ?? tags["official_name"] ?? undefined,
    address,
    lat,
    lng,
    pickleballCourts: courtCount,
    hasLights: tags["lit"] === "yes" ? true : tags["lit"] === "no" ? false : undefined,
    isIndoor: tags["indoor"] === "yes" ? true : undefined,
    ownershipType: deriveOwnership(tags),
    accessType: deriveAccess(tags),
    notes,
    tags,
  };
}

/** Search OpenStreetMap for pickleball courts within a named area. */
export async function searchPickleballCourts(area: string): Promise<OsmFacility[]> {
  const bbox = await geocodeAreaBbox(area);
  if (!bbox) throw new Error(`Could not resolve area: "${area}". Try a city or state name.`);

  const [s, n, w, e] = bbox;
  const bboxStr = `${s},${w},${n},${e}`;

  const query = `[out:json][timeout:30];
(
  node["sport"="pickleball"](${bboxStr});
  way["sport"="pickleball"](${bboxStr});
  node["leisure"="pickleball_court"](${bboxStr});
  way["leisure"="pickleball_court"](${bboxStr});
);
out center tags;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

  const data = (await res.json()) as OverpassResponse;

  // Deduplicate by osmId — ways can appear with and without center
  const seen = new Set<string>();
  const results: OsmFacility[] = [];
  for (const el of data.elements) {
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const mapped = mapElement(el);
    if (mapped) results.push(mapped);
  }

  return results;
}

/** Convert an OsmFacility to a ClubFacility payload ready for Firestore. */
export function osmToClubFacility(
  osm: OsmFacility,
  performedByUserId: string,
): Omit<ClubFacility, "id"> {
  return {
    clubId: COMMUNITY_CLUB_ID,
    facilityName: osm.facilityName,
    address: osm.address,
    lat: osm.lat,
    lng: osm.lng,
    geocodeProvider: "manual",
    geofenceEnabled: true,
    checkInRadiusMeters: 200,
    pickleballCourts: osm.pickleballCourts,
    hasLights: osm.hasLights,
    isIndoor: osm.isIndoor,
    ownershipType: osm.ownershipType,
    accessType: osm.accessType ?? "public",
    notes: osm.notes,
    osmId: osm.osmId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: performedByUserId,
  };
}
