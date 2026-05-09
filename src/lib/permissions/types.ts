// Role-based access control types — from leagueforge_permissions_roles_schema.toon

export type RoleKey =
  | "SiteAdmin"
  | "ClubDirector"
  | "LeagueCoordinator"
  | "Player"
  | "ClubCreatorProvisional";

export type ClubStatus = "pending" | "approved" | "rejected" | "archived";

export type LeagueMembershipStatus = "active" | "inactive" | "waitlisted" | "removed";

export type RoleEventType = "ClubApproved" | "ClubRejected" | "RoleAssigned" | "RoleRemoved";

export interface UserRoleDoc {
  id: string;
  userId: string;
  roleId: RoleKey;
  /** null for global roles (SiteAdmin). Required for club/league-scoped roles. */
  clubId: string | null;
  /** Required for LeagueCoordinator; null otherwise. */
  leagueId: string | null;
  assignedAt: string;
  assignedBy: string | null;
  active: boolean;
}

export interface ClubDoc {
  id: string;
  clubName: string;
  /** URL-safe slug derived from clubName, e.g. "my-club-name". */
  slug?: string;
  location: string;
  description: string;
  logoUrl: string | null;
  status: ClubStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberIds: string[];
  followerIds: string[]; 
}

export interface RoleEventDoc {
  id: string;
  userId: string;
  clubId: string | null;
  leagueId: string | null;
  eventType: RoleEventType;
  oldRoleId: RoleKey | null;
  newRoleId: RoleKey | null;
  eventTimestamp: string;
  notes: string;
}

export interface LeagueMembershipDoc {
  id: string;
  leagueId: string;
  userId: string;
  status: LeagueMembershipStatus;
  joinedAt: string;
}

export interface ClubFollowerDoc {
  /** Document ID is `${userId}_${clubId}` for O(1) lookup. */
  id: string;
  userId: string;
  clubId: string;
  followedAt: string;
}

export interface CreateClubInput {
  clubName: string;
  location: string;
  description: string;
  logoUrl?: string;
}

export type FacilityOwnershipType =
  | "public"
  | "private"
  | "club_owned"
  | "partner"
  | "school"
  | "municipal"
  | "other";

export type FacilityAccessType =
  | "public"
  | "members_only"
  | "reservation_required"
  | "fee_required"
  | "invite_only"
  | "other";

export type FacilityOperatorType =
  | "club"
  | "city"
  | "school"
  | "private_business"
  | "parks_department"
  | "other";

export type FacilitySurfaceType =
  | "hard"
  | "clay"
  | "turf"
  | "indoor"
  | "acrylic"
  | "concrete"
  | "asphalt"
  | "other";

export type FacilityGeocodeProvider =
  | "nominatim"
  | "open_meteo"
  | "google_places"
  | "mapbox"
  | "manual";

export type OpenPlaySkillLevel =
  | "all"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "competitive"
  | "custom";

export type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export interface OpenPlaySession {
  id: string;
  dayOfWeek: DayOfWeek;
  /** HH:mm local time */
  startTime: string;
  /** HH:mm local time */
  endTime: string;
  skillLevel?: OpenPlaySkillLevel;
  cost?: string;
  signupUrl?: string;
  notes?: string;
  active: boolean;
}

export interface ClubFacility {
  /** Firestore document ID — populated by repo, not stored in the document itself. */
  id: string;
  clubId: string;

  // Naming & contact
  facilityName?: string;
  address?: string;
  websiteUrl?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Geolocation / geofence
  lat?: number;
  lng?: number;
  geocodedAddress?: string;
  geocodedAt?: string;
  geocodeProvider?: FacilityGeocodeProvider;
  geocodeConfidence?: number;
  /** Default 200 m. Used by check-in geofence when geoLocationAssistedCheckIn is true. */
  checkInRadiusMeters?: number;
  geofenceEnabled?: boolean;

  // Ownership & access
  ownershipType?: FacilityOwnershipType;
  accessType?: FacilityAccessType;
  operatorName?: string;
  operatorType?: FacilityOperatorType;

  // Court details
  pickleballCourts?: number;
  indoorCourts?: number;
  outdoorCourts?: number;
  tennisConversionCourts?: number;
  /** @deprecated Use indoorCourts/outdoorCourts instead. */
  isIndoor?: boolean;
  surfaceType?: FacilitySurfaceType;
  hasLights?: boolean;
  hasParking?: boolean;
  hasRestrooms?: boolean;
  hasWater?: boolean;
  hasProShop?: boolean;
  amenities?: string[];
  notes?: string;

  // Open-play schedule
  openPlaySessions?: OpenPlaySession[];

  // Audit
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ClubPost {
  id: string;
  clubId: string;
  clubName: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
}
