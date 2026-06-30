export const ENV = {
  appId: process.env.VITE_APP_ID ?? process.env.APP_ID ?? "ultrasound-app",
  appUrl: process.env.VITE_APP_URL ?? "https://app.allaboutultrasound.com",
  // When a Cloudflare Worker proxies landing/funnel pages from the root domain,
  // it sends this header so the server can emit canonical URLs pointing to the
  // root domain instead of the app subdomain.
  canonicalRootDomain: process.env.CANONICAL_ROOT_DOMAIN ?? "",
  iheCanonicalRootDomain: process.env.IHE_CANONICAL_ROOT_DOMAIN ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  thinkificApiKey: process.env.THINKIFIC_API_KEY ?? "",
  thinkificSubdomain: process.env.THINKIFIC_SUBDOMAIN ?? "",
  thinkificAdminEmail: process.env.THINKIFIC_ADMIN_EMAIL ?? "",
  thinkificAdminPassword: process.env.THINKIFIC_ADMIN_PASSWORD ?? "",
  thinkificGraphqlJwt: process.env.THINKIFIC_GRAPHQL_JWT ?? "",
  platformAdminEmail: process.env.PLATFORM_ADMIN_EMAIL ?? "admin@allaboutultrasound.com",
  printfulApiKey: process.env.PRINTFUL_API_KEY ?? "",
  bookvaultApiKey: process.env.BOOKVAULT_API_KEY ?? "",
  // US orders are automatically routed to BookvaultUS in fulfillBookvaultOrder.ts.
  // This fallback is used for all non-US orders (defaults to BookvaultUK).
  bookvaultDispatchService: process.env.BOOKVAULT_DISPATCH_SERVICE ?? "BookvaultUK",
  bookvaultProductionLevel: process.env.BOOKVAULT_PRODUCTION_LEVEL ?? "Standard",
  shopifyStoresJson: process.env.SHOPIFY_STORES ?? "",
  shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN ?? "",
  shopifyStorefrontAccessToken: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? "",
  shopifyStoreDomain2: process.env.SHOPIFY_STORE_DOMAIN_2 ?? "",
  shopifyStorefrontAccessToken2: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN_2 ?? "",
};
