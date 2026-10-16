import type { VendorPartnerScope } from "./vendorPartner";

export const EXPO_EVENT_TENANTS = ["ultrasound_expo", "echo_expo"] as const;
export type ExpoEventTenant = (typeof EXPO_EVENT_TENANTS)[number];

export type ExpoTenantConfig = {
  key: ExpoEventTenant;
  name: string;
  organizer: string;
  origin: string;
  siteDomain: string;
  partnerScope: VendorPartnerScope;
  adminPath: string;
  dashboardLabel: string;
};

export const EXPO_TENANT_CONFIG: Record<ExpoEventTenant, ExpoTenantConfig> = {
  ultrasound_expo: {
    key: "ultrasound_expo",
    name: "UltrasoundExpo™",
    organizer: "All About Ultrasound™",
    origin: "https://ultrasoundexpo.com",
    siteDomain: "ultrasoundexpo.com",
    partnerScope: "ultrasound_expo",
    adminPath: "/admin/ultrasound-expo",
    dashboardLabel: "UltrasoundExpo™",
  },
  echo_expo: {
    key: "echo_expo",
    name: "EchoExpo™",
    organizer: "iHeartEcho™",
    origin: "https://echoexpo.iheartecho.com",
    siteDomain: "echoexpo.iheartecho.com",
    // EchoExpo™ is marketing-only on its own host. Operations inherit the
    // approved UltrasoundExpo™ scope and are presented as a dashboard tab.
    partnerScope: "ultrasound_expo",
    adminPath: "/admin/ultrasound-expo",
    dashboardLabel: "UltrasoundExpo™ — EchoExpo™",
  },
};

export function isExpoEventTenant(value: string): value is ExpoEventTenant {
  return (EXPO_EVENT_TENANTS as readonly string[]).includes(value);
}

export function getExpoTenantForHostname(hostname: string | null | undefined): ExpoEventTenant {
  const host = (hostname || "").trim().toLowerCase().split(":")[0];
  return host === "echocardiographyexpo.com" || host === "www.echocardiographyexpo.com" || host === "echoexpo.iheartecho.com"
    ? "echo_expo"
    : "ultrasound_expo";
}

export function getExpoTenantConfig(tenant: ExpoEventTenant): ExpoTenantConfig {
  return EXPO_TENANT_CONFIG[tenant];
}
