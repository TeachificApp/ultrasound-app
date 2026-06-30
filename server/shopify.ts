/**
 * Shopify Storefront API helper
 * Docs: https://shopify.dev/docs/api/storefront/latest
 */
import { ENV } from "./_core/env";

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-01";

export interface ShopifyStoreConfig {
  key: string;
  label: string;
  domain: string;
  token: string;
}

export interface ShopifyProductSummary {
  id: string;
  numericId: string;
  title: string;
  handle: string;
  url: string | null;
  imageUrl: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
  descriptionHtml: string | null;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

/** Resolve configured Shopify stores from env (supports primary + secondary). */
export function getShopifyStores(): ShopifyStoreConfig[] {
  const raw = process.env.SHOPIFY_STORES ?? ENV.shopifyStoresJson;
  if (raw?.trim()) {
    try {
      const parsed = JSON.parse(raw) as Array<Partial<ShopifyStoreConfig>>;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((s) => s.domain && s.token)
          .map((s, index) => ({
            key: s.key?.trim() || `store${index + 1}`,
            label: s.label?.trim() || s.key?.trim() || `Store ${index + 1}`,
            domain: normalizeDomain(s.domain!),
            token: s.token!.trim(),
          }));
      }
    } catch {
      // fall through to numbered env vars
    }
  }

  const stores: ShopifyStoreConfig[] = [];
  const primaryDomain = (process.env.SHOPIFY_STORE_DOMAIN ?? ENV.shopifyStoreDomain).trim();
  const primaryToken = (process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? ENV.shopifyStorefrontAccessToken).trim();
  if (primaryDomain && primaryToken) {
    stores.push({
      key: "default",
      label: "Primary",
      domain: normalizeDomain(primaryDomain),
      token: primaryToken,
    });
  }

  const secondaryDomain = (process.env.SHOPIFY_STORE_DOMAIN_2 ?? ENV.shopifyStoreDomain2).trim();
  const secondaryToken = (process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN_2 ?? ENV.shopifyStorefrontAccessToken2).trim();
  if (secondaryDomain && secondaryToken) {
    stores.push({
      key: "store2",
      label: "Secondary",
      domain: normalizeDomain(secondaryDomain),
      token: secondaryToken,
    });
  }

  return stores;
}

export function getShopifyStore(storeKey?: string | null): ShopifyStoreConfig | null {
  const stores = getShopifyStores();
  if (stores.length === 0) return null;
  if (!storeKey) return stores[0] ?? null;
  return stores.find((s) => s.key === storeKey) ?? stores[0] ?? null;
}

export function isShopifyConfigured(): boolean {
  return getShopifyStores().length > 0;
}

function authHeaders(token: string): Record<string, string> {
  if (token.startsWith("shpss_")) {
    return { "Shopify-Storefront-Private-Token": token };
  }
  return { "X-Shopify-Storefront-Access-Token": token };
}

export async function shopifyGraphql<T>(
  store: ShopifyStoreConfig,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://${store.domain}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(store.token),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GraphqlResponse<T>;
  if (!res.ok || json.errors?.length) {
    const message =
      json.errors?.map((e) => e.message || e.extensions?.code || "GraphQL error").join("; ") ||
      `Shopify API error ${res.status}`;
    throw new Error(message);
  }
  if (!json.data) throw new Error("Shopify API returned no data");
  return json.data;
}

export async function testStoreConnection(storeKey?: string): Promise<{
  storeKey: string;
  label: string;
  domain: string;
  shopName: string;
}> {
  const store = getShopifyStore(storeKey);
  if (!store) throw new Error("No Shopify store is configured");

  const data = await shopifyGraphql<{ shop: { name: string } }>(
    store,
    `query { shop { name } }`,
  );

  return {
    storeKey: store.key,
    label: store.label,
    domain: store.domain,
    shopName: data.shop.name,
  };
}

export function parseShopifyProductGid(gid: string): string {
  const match = gid.match(/\/Product\/(\d+)$/);
  return match?.[1] ?? gid;
}

export async function listProducts(
  storeKey?: string,
  first = 50,
  after?: string | null,
): Promise<{ products: ShopifyProductSummary[]; hasNextPage: boolean; endCursor: string | null }> {
  const store = getShopifyStore(storeKey);
  if (!store) throw new Error("No Shopify store is configured");

  const data = await shopifyGraphql<{
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{
        node: {
          id: string;
          title: string;
          handle: string;
          onlineStoreUrl: string | null;
          description: string;
          featuredImage: { url: string } | null;
          priceRange: {
            minVariantPrice: { amount: string; currencyCode: string };
          };
        };
      }>;
    };
  }>(
    store,
    `query ListProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            title
            handle
            onlineStoreUrl
            description
            featuredImage { url }
            priceRange {
              minVariantPrice { amount currencyCode }
            }
          }
        }
      }
    }`,
    { first, after: after ?? null },
  );

  const products = data.products.edges.map(({ node }) => ({
    id: node.id,
    numericId: parseShopifyProductGid(node.id),
    title: node.title,
    handle: node.handle,
    url: node.onlineStoreUrl ?? `https://${store.domain}/products/${node.handle}`,
    imageUrl: node.featuredImage?.url ?? null,
    priceAmount: node.priceRange?.minVariantPrice?.amount ?? null,
    priceCurrency: node.priceRange?.minVariantPrice?.currencyCode ?? null,
    descriptionHtml: node.description || null,
  }));

  return {
    products,
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor,
  };
}

export async function getProductById(
  storeKey: string | null | undefined,
  productId: string,
): Promise<ShopifyProductSummary | null> {
  const store = getShopifyStore(storeKey);
  if (!store) throw new Error("No Shopify store is configured");

  const gid = productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId.replace(/\D/g, "")}`;

  const data = await shopifyGraphql<{
    product: {
      id: string;
      title: string;
      handle: string;
      onlineStoreUrl: string | null;
      description: string;
      featuredImage: { url: string } | null;
      priceRange: {
        minVariantPrice: { amount: string; currencyCode: string };
      };
    } | null;
  }>(
    store,
    `query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        onlineStoreUrl
        description
        featuredImage { url }
        priceRange {
          minVariantPrice { amount currencyCode }
        }
      }
    }`,
    { id: gid },
  );

  if (!data.product) return null;
  const node = data.product;
  return {
    id: node.id,
    numericId: parseShopifyProductGid(node.id),
    title: node.title,
    handle: node.handle,
    url: node.onlineStoreUrl ?? `https://${store.domain}/products/${node.handle}`,
    imageUrl: node.featuredImage?.url ?? null,
    priceAmount: node.priceRange?.minVariantPrice?.amount ?? null,
    priceCurrency: node.priceRange?.minVariantPrice?.currencyCode ?? null,
    descriptionHtml: node.description || null,
  };
}
