/**
 * Submit a physical product order to Printful for print-on-demand fulfillment.
 */
import { eq } from "drizzle-orm";
import {
  physicalProductOrders,
  physicalProducts,
  users,
} from "../../drizzle/schema";
import {
  createOrder,
  isPrintfulConfigured,
} from "../printful";
import { ENV } from "../_core/env";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export interface FulfillPrintfulOrderResult {
  submitted: boolean;
  skipped?: boolean;
  reason?: string;
  printfulOrderId?: string;
  status?: string;
  error?: string;
}

export async function fulfillPrintfulOrder(
  db: Db,
  orderId: number,
  options?: { customerEmail?: string | null; force?: boolean },
): Promise<FulfillPrintfulOrderResult> {
  const [row] = await db
    .select({
      order: physicalProductOrders,
      product: {
        id: physicalProducts.id,
        title: physicalProducts.title,
        price: physicalProducts.price,
        printfulEnabled: physicalProducts.printfulEnabled,
        printfulStoreId: physicalProducts.printfulStoreId,
        printfulSyncProductId: physicalProducts.printfulSyncProductId,
        printfulSyncVariantId: physicalProducts.printfulSyncVariantId,
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(physicalProductOrders)
    .innerJoin(physicalProducts, eq(physicalProductOrders.productId, physicalProducts.id))
    .innerJoin(users, eq(physicalProductOrders.userId, users.id))
    .where(eq(physicalProductOrders.id, orderId))
    .limit(1);

  if (!row) return { submitted: false, reason: "order_not_found" };

  const { order, product, user } = row;

  if (!product.printfulEnabled) {
    return { submitted: false, skipped: true, reason: "printful_disabled" };
  }

  if (!product.printfulStoreId || !product.printfulSyncVariantId) {
    return { submitted: false, skipped: true, reason: "missing_printful_product_link" };
  }

  if (!isPrintfulConfigured()) {
    return { submitted: false, skipped: true, reason: "api_key_not_configured" };
  }

  if (order.printfulSubmittedAt && order.printfulOrderId && !options?.force) {
    return {
      submitted: false,
      skipped: true,
      reason: "already_submitted",
      printfulOrderId: order.printfulOrderId ?? undefined,
      status: order.printfulStatus ?? undefined,
    };
  }

  const line1 = order.shippingLine1?.trim();
  const city = order.shippingCity?.trim();
  const zip = order.shippingPostalCode?.trim();
  const country = (order.shippingCountry ?? "US").trim().toUpperCase();
  const email = options?.customerEmail?.trim() || user.email?.trim() || "";
  const name = order.shippingName?.trim() || user.name?.trim() || "Customer";

  if (!line1 || !city || !zip || !country) {
    const message = "Shipping address is incomplete for Printful fulfillment";
    await db.update(physicalProductOrders).set({
      printfulError: message,
      printfulStatus: "failed",
    }).where(eq(physicalProductOrders.id, orderId));
    return { submitted: false, error: message };
  }

  const externalId = `aaus-ppo-${order.id}`;
  const shipping = (process.env.PRINTFUL_SHIPPING_METHOD ?? ENV.printfulShippingMethod ?? "STANDARD").trim();
  const retailPrice = (product.price / 100).toFixed(2);

  try {
    const result = await createOrder(
      product.printfulStoreId,
      {
        external_id: externalId,
        shipping,
        recipient: {
          name,
          address1: line1,
          address2: order.shippingLine2?.trim() || undefined,
          city,
          state_code: order.shippingState?.trim() || undefined,
          zip,
          country_code: country,
          email: email || "orders@allaboutultrasound.com",
          phone: "0000000000",
        },
        items: [{
          sync_variant_id: product.printfulSyncVariantId,
          quantity: 1,
          retail_price: retailPrice,
          name: product.title,
        }],
      },
      true,
    );

    const printfulOrderId = result.id ? String(result.id) : null;
    const status = result.status ?? "pending";

    await db.update(physicalProductOrders).set({
      printfulOrderId,
      printfulStatus: status,
      printfulError: null,
      printfulSubmittedAt: new Date(),
      fulfillmentStatus: "processing",
      notes: order.notes
        ? `${order.notes}\nPrintful submitted (${externalId}${printfulOrderId ? `, order ${printfulOrderId}` : ""})`
        : `Printful submitted (${externalId}${printfulOrderId ? `, order ${printfulOrderId}` : ""})`,
    }).where(eq(physicalProductOrders.id, orderId));

    console.log(`[Printful] Order ${orderId} submitted as ${externalId}${printfulOrderId ? ` / ${printfulOrderId}` : ""}`);
    return { submitted: true, printfulOrderId: printfulOrderId ?? undefined, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(physicalProductOrders).set({
      printfulError: message,
      printfulStatus: "failed",
    }).where(eq(physicalProductOrders.id, orderId));
    console.error(`[Printful] Failed to submit order ${orderId}:`, message);
    return { submitted: false, error: message };
  }
}
