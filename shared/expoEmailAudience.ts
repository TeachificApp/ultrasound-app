import { normalizeExpoEventInterests, type ExpoEventTenant } from "./expoTenant";

/**
 * System-managed lists used by the Expo journeys. The names are deliberately
 * stable because application code uses them to segment future activity.
 */
export const EXPO_EMAIL_LISTS = {
  ultrasoundExpoAttendees: {
    name: "UltrasoundExpo™ Attendees",
    description: "Automatically includes confirmed attendee registrations for UltrasoundExpo™ event instances.",
  },
  echoExpoAttendees: {
    name: "EchoExpo™ Attendees",
    description: "Automatically includes confirmed attendee registrations for standalone EchoExpo™ event instances.",
  },
  exhibitorsAndSponsors: {
    name: "Exhibitors & Sponsors — UltrasoundExpo™ | EchoExpo™",
    description: "Automatically includes vendor, exhibitor, and sponsor applications and registrations. Tags identify the organization role and program pathway.",
  },
} as const;

export type ExpoEmailListKey = keyof typeof EXPO_EMAIL_LISTS;

export const EXPO_EMAIL_LIST_NAMES = Object.values(EXPO_EMAIL_LISTS).map((item) => item.name);

export function isExpoAudienceListName(name: string | null | undefined): boolean {
  return Boolean(name && EXPO_EMAIL_LIST_NAMES.includes(name as (typeof EXPO_EMAIL_LIST_NAMES)[number]));
}

export function getExpoAttendeeListKey(tenant: ExpoEventTenant): "ultrasoundExpoAttendees" | "echoExpoAttendees" {
  return tenant === "echo_expo" ? "echoExpoAttendees" : "ultrasoundExpoAttendees";
}

export function getExpoProgramLabel(tenant: ExpoEventTenant | "aaus_ihe"): string {
  if (tenant === "echo_expo") return "EchoExpo™";
  if (tenant === "aaus_ihe") return "All About Ultrasound™";
  return "UltrasoundExpo™";
}

export function getPartnerProgramTags(input: {
  requestedScopes?: readonly string[] | null;
  eventFocus?: string | null;
  eventInterests?: unknown;
}): string[] {
  const tags = new Set<string>();
  const scopes = input.requestedScopes ?? [];

  if (scopes.includes("aaus_ihe")) tags.add(getExpoProgramLabel("aaus_ihe"));
  if (scopes.includes("ultrasound_expo")) {
    for (const eventInterest of normalizeExpoEventInterests(input.eventInterests, input.eventFocus)) {
      tags.add(getExpoProgramLabel(eventInterest));
    }
  }
  return [...tags];
}

export function getPartnerRoleTags(partnerTypes: readonly string[] | null | undefined): string[] {
  const labels = new Map([
    ["vendor", "Vendor"],
    ["exhibitor", "Exhibitor"],
    ["sponsor", "Sponsor"],
  ]);
  return [...new Set((partnerTypes ?? []).map((type) => labels.get(type)).filter((label): label is string => Boolean(label)))];
}
