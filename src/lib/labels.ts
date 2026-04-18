/**
 * Central themed-label registry. Always pairs the real operational label with
 * an optional RPG "flavor" — UI components may opt into showing flavor.
 */
export const MATCH_STATUS_LABEL = {
  UPCOMING:   { label: "Upcoming",   flavor: "Awaiting Battle" },
  READY:      { label: "Ready",      flavor: "Arena Lit" },
  IN_PROGRESS:{ label: "Live",       flavor: "In Arena" },
  COMPLETE:   { label: "Completed",  flavor: "Resolved" },
  DISPUTED:   { label: "Disputed",   flavor: "Under Review" },
  DELAYED:    { label: "Delayed",    flavor: "Delayed" },
  CANCELLED:  { label: "Cancelled",  flavor: "Withdrawn" },
  FORFEIT:    { label: "Forfeit",    flavor: "Yielded" },
} as const;

export const REGISTRATION_STATUS_LABEL = {
  PENDING:     { label: "Pending",     flavor: "Pending Review" },
  APPROVED:    { label: "Registered",  flavor: "Enlisted" },
  WAITLISTED:  { label: "Waitlisted",  flavor: "In Reserve" },
  REJECTED:    { label: "Rejected",    flavor: "Turned Away" },
  WITHDRAWN:   { label: "Withdrawn",   flavor: "Withdrawn" },
  CHECKED_IN:  { label: "Checked In",  flavor: "Ready for Battle" },
} as const;

export const TIER_LABEL = {
  BRONZE:   { label: "Bronze",   color: "#b08870", glow: "ember" },
  SILVER:   { label: "Silver",   color: "#c7cad3", glow: "spectral" },
  GOLD:     { label: "Gold",     color: "#e8b84a", glow: "gold" },
  OBSIDIAN: { label: "Obsidian", color: "#7b4dff", glow: "rune" },
  MYTHIC:   { label: "Mythic",   color: "#e03a4d", glow: "crimson" },
} as const;
