import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { ipAccessLogs } from "../../drizzle/schema";
import { getDb } from "../db";

type LookupStatus = "resolved" | "unavailable" | "private";

type IpWhoIsResponse = {
  success?: boolean;
  country?: string;
  region?: string;
  city?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: { id?: string };
  connection?: { isp?: string; org?: string; asn?: string };
};

type StoredIpLocation = {
  geoLookupStatus: LookupStatus;
  geoCountry: string | null;
  geoRegion: string | null;
  geoCity: string | null;
  geoPostalCode: string | null;
  geoLatitude: string | null;
  geoLongitude: string | null;
  geoTimezone: string | null;
  geoIsp: string | null;
  geoOrganization: string | null;
  geoAsn: string | null;
  geoResolvedAt: Date;
};

function isPublicIp(ip: string): boolean {
  const value = ip.trim().toLowerCase();
  if (!value || value === "::1" || value === "localhost" || value.startsWith("127.") || value.startsWith("10.") || value.startsWith("192.168.") || value.startsWith("fc") || value.startsWith("fd")) return false;
  const parts = value.split(".").map(Number);
  return !(parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

function nullableText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function buildStoredLocation(status: LookupStatus, response?: IpWhoIsResponse): StoredIpLocation {
  const latitude = typeof response?.latitude === "number" ? response.latitude.toFixed(7) : null;
  const longitude = typeof response?.longitude === "number" ? response.longitude.toFixed(7) : null;
  return {
    geoLookupStatus: status,
    geoCountry: nullableText(response?.country, 96),
    geoRegion: nullableText(response?.region, 128),
    geoCity: nullableText(response?.city, 128),
    geoPostalCode: nullableText(response?.postal, 32),
    geoLatitude: latitude,
    geoLongitude: longitude,
    geoTimezone: nullableText(response?.timezone?.id, 128),
    geoIsp: nullableText(response?.connection?.isp, 255),
    geoOrganization: nullableText(response?.connection?.org, 255),
    geoAsn: nullableText(response?.connection?.asn, 32),
    geoResolvedAt: new Date(),
  };
}

export async function enrichIpAccessLocation(ipAddress: string): Promise<LookupStatus | "pending"> {
  const db = await getDb();
  if (!db) return "pending";
  const ip = ipAddress.trim();

  const [cached] = await db
    .select({
      geoLookupStatus: ipAccessLogs.geoLookupStatus,
      geoCountry: ipAccessLogs.geoCountry,
      geoRegion: ipAccessLogs.geoRegion,
      geoCity: ipAccessLogs.geoCity,
      geoPostalCode: ipAccessLogs.geoPostalCode,
      geoLatitude: ipAccessLogs.geoLatitude,
      geoLongitude: ipAccessLogs.geoLongitude,
      geoTimezone: ipAccessLogs.geoTimezone,
      geoIsp: ipAccessLogs.geoIsp,
      geoOrganization: ipAccessLogs.geoOrganization,
      geoAsn: ipAccessLogs.geoAsn,
      geoResolvedAt: ipAccessLogs.geoResolvedAt,
    })
    .from(ipAccessLogs)
    .where(and(eq(ipAccessLogs.ipAddress, ip), isNotNull(ipAccessLogs.geoLookupStatus)))
    .limit(1);

  if (cached?.geoLookupStatus) {
    await db.update(ipAccessLogs)
      .set(cached)
      .where(and(eq(ipAccessLogs.ipAddress, ip), isNull(ipAccessLogs.geoLookupStatus)));
    return cached.geoLookupStatus as LookupStatus;
  }

  if (!isPublicIp(ip)) {
    const location = buildStoredLocation("private");
    await db.update(ipAccessLogs)
      .set(location)
      .where(and(eq(ipAccessLogs.ipAddress, ip), isNull(ipAccessLogs.geoLookupStatus)));
    return "private";
  }

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    const payload = await response.json() as IpWhoIsResponse;
    const location = buildStoredLocation(payload.success === false ? "unavailable" : "resolved", payload);
    await db.update(ipAccessLogs)
      .set(location)
      .where(and(eq(ipAccessLogs.ipAddress, ip), isNull(ipAccessLogs.geoLookupStatus)));
    return location.geoLookupStatus;
  } catch {
    return "pending";
  }
}

export async function enrichMissingUserIpLocations(userId: number, maxIps = 25): Promise<{ attempted: number; resolved: number; unavailable: number; private: number; pending: number }> {
  const db = await getDb();
  if (!db) return { attempted: 0, resolved: 0, unavailable: 0, private: 0, pending: 0 };
  const ips = await db
    .select({ ipAddress: ipAccessLogs.ipAddress })
    .from(ipAccessLogs)
    .where(and(eq(ipAccessLogs.userId, userId), isNull(ipAccessLogs.geoLookupStatus)))
    .groupBy(ipAccessLogs.ipAddress)
    .limit(maxIps);

  const result = { attempted: ips.length, resolved: 0, unavailable: 0, private: 0, pending: 0 };
  for (const row of ips) {
    const status = await enrichIpAccessLocation(row.ipAddress);
    result[status] += 1;
  }
  return result;
}
