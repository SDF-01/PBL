/**
 * One-time migration: copy VenueDoc records into the clubFacilities collection
 * and back-fill facilityId + leagueId onto existing playDates.
 *
 * Run once from an admin UI or standalone script. Safe to re-run — skips
 * venues whose name already has a matching facility in the same club.
 *
 * Usage (admin panel):
 *   import { migrateVenuesToFacilities } from "@/lib/migrations/migrateVenuesToFacilities";
 *   const report = await migrateVenuesToFacilities(clubId, userId);
 */

import {
  collection, doc, getDocs, query,
  updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore/collections";
import type { VenueDoc, PlayDateDoc } from "@/lib/firestore/types";
import type { ClubFacility } from "@/lib/permissions/types";

export interface MigrationReport {
  venuesFound: number;
  facilitiesCreated: number;
  playDatesUpdated: number;
  skipped: string[];
  errors: string[];
}

export async function migrateVenuesToFacilities(
  clubId: string,
  performedByUserId: string,
): Promise<MigrationReport> {
  const report: MigrationReport = {
    venuesFound: 0,
    facilitiesCreated: 0,
    playDatesUpdated: 0,
    skipped: [],
    errors: [],
  };

  // 1. Load all venues for this club
  const venuesSnap = await getDocs(
    query(collection(db(), COLLECTIONS.venues), where("clubId", "==", clubId)),
  );
  const venues = venuesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as VenueDoc));
  report.venuesFound = venues.length;

  // 2. Load existing facilities to avoid duplicates
  const facilitiesSnap = await getDocs(
    query(collection(db(), COLLECTIONS.clubFacilities), where("clubId", "==", clubId)),
  );
  const existingNames = new Set(
    facilitiesSnap.docs.map((d) => (d.data() as ClubFacility).facilityName?.toLowerCase()),
  );

  // 3. Map venue → facility, build a venueId → facilityId lookup for playDate patching
  const venueToFacility: Record<string, string> = {};

  for (const venue of venues) {
    const normName = venue.name.toLowerCase();
    if (existingNames.has(normName)) {
      report.skipped.push(`${venue.name} (already exists)`);
      // Still map it so playDates can be updated
      const match = facilitiesSnap.docs.find(
        (d) => (d.data() as ClubFacility).facilityName?.toLowerCase() === normName,
      );
      if (match) venueToFacility[venue.id] = match.id;
      continue;
    }

    try {
      const batch = writeBatch(db());
      const newRef = doc(collection(db(), COLLECTIONS.clubFacilities));
      const facilityData: Omit<ClubFacility, "id"> = {
        clubId,
        facilityName: venue.name,
        address: venue.address,
        lat: venue.lat || undefined,
        lng: venue.lng || undefined,
        checkInRadiusMeters: venue.radiusMeters,
        geofenceEnabled: !!(venue.lat && venue.lng),
        geocodeProvider: (venue.lat && venue.lng) ? "manual" : undefined,
        createdAt: venue.createdAt,
        updatedAt: new Date().toISOString(),
        updatedBy: performedByUserId,
      };
      batch.set(newRef, facilityData);
      await batch.commit();

      venueToFacility[venue.id] = newRef.id;
      report.facilitiesCreated++;
    } catch (err) {
      report.errors.push(`${venue.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Back-fill facilityId on playDates that reference migrated venues
  if (Object.keys(venueToFacility).length > 0) {
    const playDatesSnap = await getDocs(
      query(collection(db(), COLLECTIONS.playDates)),
    );
    const playDates = playDatesSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as PlayDateDoc),
    );

    for (const pd of playDates) {
      const facilityId = venueToFacility[pd.venueId];
      if (!facilityId || pd.facilityId === facilityId) continue;

      try {
        await updateDoc(doc(db(), COLLECTIONS.playDates, pd.id), { facilityId });
        report.playDatesUpdated++;
      } catch (err) {
        report.errors.push(
          `playDate ${pd.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return report;
}
