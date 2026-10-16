export const EXPO_POINTS_LEADERBOARD_SCOPES = ["ultrasound_expo", "echo_expo", "combined"] as const;
export type ExpoPointsLeaderboardScope = (typeof EXPO_POINTS_LEADERBOARD_SCOPES)[number];

export const EXPO_POINTS_LEADERBOARD_SCOPE_LABELS: Record<ExpoPointsLeaderboardScope, string> = {
  ultrasound_expo: "UltrasoundExpo™ participants",
  echo_expo: "EchoExpo™ participants",
  combined: "Combined UltrasoundExpo™ + EchoExpo™ participants",
};

export const EXPO_POINTS_ELIGIBILITY_ROLES = ["attendee", "vendor", "exhibitor", "sponsor"] as const;
export type ExpoPointsEligibilityRole = (typeof EXPO_POINTS_ELIGIBILITY_ROLES)[number];

export const EXPO_POINTS_ELIGIBILITY_ROLE_LABELS: Record<ExpoPointsEligibilityRole, string> = {
  attendee: "Attendees",
  vendor: "Approved vendors",
  exhibitor: "Exhibitors",
  sponsor: "Sponsors",
};

export const EXPO_POINTS_ACTIVITY_TYPES = [
  "attendance",
  "cme",
  "booth_visit",
  "expo_game",
  "networking",
  "community",
  "other",
  "admin_adjustment",
  "reward_redemption",
] as const;
export type ExpoPointsActivityType = (typeof EXPO_POINTS_ACTIVITY_TYPES)[number];

export const EXPO_POINTS_ACTIVITY_TYPE_LABELS: Record<ExpoPointsActivityType, string> = {
  attendance: "Event attendance",
  cme: "CME / education activity",
  booth_visit: "Exhibitor booth visit",
  expo_game: "Expo game or challenge",
  networking: "Networking activity",
  community: "Community participation",
  other: "Other activity",
  admin_adjustment: "Administrator adjustment",
  reward_redemption: "Reward redemption",
};

export const EXPO_POINTS_REDEMPTION_STATUSES = ["requested", "fulfilled", "cancelled"] as const;
export type ExpoPointsRedemptionStatus = (typeof EXPO_POINTS_REDEMPTION_STATUSES)[number];

export function normalizeExpoPointsRoles(value: unknown): ExpoPointsEligibilityRole[] {
  if (!Array.isArray(value)) return [...EXPO_POINTS_ELIGIBILITY_ROLES];
  const allowed = new Set<string>(EXPO_POINTS_ELIGIBILITY_ROLES);
  const roles = value.filter((role): role is ExpoPointsEligibilityRole => typeof role === "string" && allowed.has(role));
  return roles.length ? [...new Set(roles)] : [...EXPO_POINTS_ELIGIBILITY_ROLES];
}

/** A monitor feed deliberately avoids email addresses and full account information. */
export function expoPointsPublicDisplayName(input: { displayName?: string | null; name?: string | null; firstName?: string | null; lastName?: string | null }) {
  const displayName = input.displayName?.trim();
  if (displayName) return displayName;
  const first = input.firstName?.trim() || input.name?.trim().split(/\s+/)[0] || "Expo";
  const lastInitial = input.lastName?.trim().slice(0, 1);
  return lastInitial ? `${first} ${lastInitial}.` : first;
}
