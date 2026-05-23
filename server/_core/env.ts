export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  appUrl: process.env.VITE_APP_URL ?? "https://app.allaboutultrasound.com",
  // When a Cloudflare Worker proxies landing/funnel pages from the root domain,
  // it sends this header so the server can emit canonical URLs pointing to the
  // root domain instead of the app subdomain.
  canonicalRootDomain: process.env.CANONICAL_ROOT_DOMAIN ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  thinkificApiKey: process.env.THINKIFIC_API_KEY ?? "",
  thinkificSubdomain: process.env.THINKIFIC_SUBDOMAIN ?? "",
};
