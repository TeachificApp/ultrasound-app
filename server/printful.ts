/**
 * Printful API v1 helper
 * Docs: https://developers.printful.com/docs/
 */
import { ENV } from "./_core/env";

const BASE_URL = "https://api.printful.com";

export interface PrintfulStore {
  id: number;
  name: string;
  type: string;
  website?: string;
  currency?: string;
  country?: string;
}

export interface PrintfulSyncProduct {
  id: number;
  external_id: string | null;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string | null;
  is_ignored: boolean;
}

export interface PrintfulSyncVariant {
  id: number;
  external_id: string | null;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  main_category_id: number;
  warehouse_product_id: number | null;
  warehouse_product_variant_id: number | null;
  retail_price: string;
  sku: string | null;
  currency: string;
  product: {
    variant_id: number;
    product_id: number;
    image: string;
    name: string;
  };
  files: Array<{
    id: number;
    type: string;
    hash: string | null;
    url: string | null;
    filename: string;
    mime_type: string;
    size: number;
    width: number;
    height: number;
    dpi: number | null;
    status: string;
    created: number;
    thumbnail_url: string;
    preview_url: string;
    visible: boolean;
    is_temporary: boolean;
  }>;
  options: Array<{ id: string; value: string | string[] }>;
  is_ignored: boolean;
}

export interface PrintfulOrder {
  id: number;
  external_id: string | null;
  store: number;
  status: string;
  error: string | null;
  errorCode: number;
  shipping: string;
  shipping_service_name: string;
  created: number;
  updated: number;
  recipient: {
    name: string;
    company: string | null;
    address1: string;
    address2: string | null;
    city: string;
    state_code: string;
    state_name: string;
    country_code: string;
    country_name: string;
    zip: string;
    phone: string;
    email: string | null;
  };
  items: Array<{
    id: number;
    external_id: string | null;
    variant_id: number;
    sync_variant_id: number | null;
    external_variant_id: string | null;
    quantity: number;
    price: string;
    retail_price: string | null;
    name: string;
    product: {
      variant_id: number;
      product_id: number;
      image: string;
      name: string;
    };
    sku: string | null;
  }>;
  costs: {
    currency: string;
    subtotal: string;
    discount: string;
    shipping: string;
    digitization: string;
    additional_fee: string;
    fulfillment_fee: string;
    retail_delivery_fee: string;
    tax: string;
    vat: string;
    total: string;
  };
  shipments: Array<{
    id: number;
    status: string;
    carrier: string;
    service: string;
    tracking_number: string | null;
    tracking_url: string | null;
    created: number | null;
    ship_date: string | null;
    shipped_at: number | null;
    delivered_at: number | null;
    reshipment: boolean;
    location: string;
    items: Array<{ item_id: number; quantity: number; picked: number; printed: number }>;
  }>;
  dashboard_url: string;
}

export interface PrintfulShippingRate {
  id: string;
  name: string;
  rate: string;
  currency: string;
  minDeliveryDays: number;
  maxDeliveryDays: number;
}

function getApiKey(): string {
  const apiKey = (process.env.PRINTFUL_API_KEY ?? ENV.printfulApiKey).trim();
  if (!apiKey) throw new Error("PRINTFUL_API_KEY is not configured");
  return apiKey;
}

async function printfulFetch<T>(
  path: string,
  options: RequestInit = {},
  storeId?: number
): Promise<T> {
  const apiKey = getApiKey();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(storeId ? { "X-PF-Store-Id": String(storeId) } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = (await res.json()) as { code: number; result: T; error?: { message: string } };

  if (!res.ok || json.code >= 400) {
    throw new Error(
      json.error?.message ?? `Printful API error ${json.code} for ${path}`
    );
  }
  return json.result;
}

/** List all stores connected to this API key */
export async function listStores(): Promise<PrintfulStore[]> {
  return printfulFetch<PrintfulStore[]>("/stores");
}

/** List sync products in a store */
export async function listSyncProducts(
  storeId: number,
  offset = 0,
  limit = 100
): Promise<{ paging: { total: number; limit: number; offset: number }; result: PrintfulSyncProduct[] }> {
  const raw = await fetch(`${BASE_URL}/store/products?limit=${limit}&offset=${offset}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "X-PF-Store-Id": String(storeId),
    },
  });
  const json = (await raw.json()) as {
    code: number;
    result: PrintfulSyncProduct[];
    paging: { total: number; limit: number; offset: number };
  };
  return { paging: json.paging, result: json.result ?? [] };
}

/** Get a single sync product with all its variants */
export async function getSyncProduct(
  storeId: number,
  syncProductId: number
): Promise<{ sync_product: PrintfulSyncProduct; sync_variants: PrintfulSyncVariant[] }> {
  return printfulFetch(`/store/products/${syncProductId}`, {}, storeId);
}

/** List orders in a store */
export async function listOrders(
  storeId: number,
  status?: string,
  offset = 0,
  limit = 20
): Promise<{ paging: { total: number; limit: number; offset: number }; result: PrintfulOrder[] }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set("status", status);
  const raw = await fetch(`${BASE_URL}/orders?${params}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "X-PF-Store-Id": String(storeId),
    },
  });
  const json = (await raw.json()) as {
    code: number;
    result: PrintfulOrder[];
    paging: { total: number; limit: number; offset: number };
  };
  return { paging: json.paging, result: json.result ?? [] };
}

/** Get a single order */
export async function getOrder(storeId: number, orderId: number): Promise<PrintfulOrder> {
  return printfulFetch<PrintfulOrder>(`/orders/${orderId}`, {}, storeId);
}

/** Cancel an order */
export async function cancelOrder(storeId: number, orderId: number): Promise<PrintfulOrder> {
  return printfulFetch<PrintfulOrder>(`/orders/${orderId}`, { method: "DELETE" }, storeId);
}

/** Calculate shipping rates for a recipient + items */
export async function calculateShipping(
  storeId: number,
  recipient: {
    address1: string;
    city: string;
    country_code: string;
    state_code?: string;
    zip?: string;
  },
  items: Array<{ quantity: number; variant_id: number }>
): Promise<PrintfulShippingRate[]> {
  return printfulFetch<PrintfulShippingRate[]>(
    "/shipping/rates",
    {
      method: "POST",
      body: JSON.stringify({ recipient, items }),
    },
    storeId
  );
}

/** Create a new order */
export async function createOrder(
  storeId: number,
  orderData: {
    external_id?: string;
    shipping: string;
    recipient: {
      name: string;
      address1: string;
      city: string;
      country_code: string;
      state_code?: string;
      zip?: string;
      email?: string;
      phone?: string;
    };
    items: Array<{
      sync_variant_id?: number;
      variant_id?: number;
      quantity: number;
      retail_price?: string;
      name?: string;
    }>;
    retail_costs?: {
      currency?: string;
      subtotal?: string;
      shipping?: string;
      tax?: string;
      total?: string;
    };
    gift?: { subject: string; message: string } | null;
    packing_slip?: { email?: string; phone?: string; message?: string; logo_url?: string } | null;
  },
  confirm = false
): Promise<PrintfulOrder> {
  const path = confirm ? "/orders?confirm=true" : "/orders";
  return printfulFetch<PrintfulOrder>(path, { method: "POST", body: JSON.stringify(orderData) }, storeId);
}

export function isPrintfulConfigured(): boolean {
  return Boolean((process.env.PRINTFUL_API_KEY ?? ENV.printfulApiKey).trim());
}

export function getDefaultPrintfulStoreId(): number | null {
  const raw = (process.env.PRINTFUL_DEFAULT_STORE_ID ?? ENV.printfulDefaultStoreId).trim();
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

export async function testConnection(): Promise<{ stores: PrintfulStore[] }> {
  const stores = await listStores();
  return { stores };
}

export function splitFullName(name: string | null | undefined): { first: string; last: string } {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { first: "Customer", last: "." };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: "." };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export function retailPriceToCents(retailPrice: string | null | undefined): number {
  if (!retailPrice) return 0;
  const value = Number.parseFloat(retailPrice);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
