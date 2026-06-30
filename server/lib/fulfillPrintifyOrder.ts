/**
 * Submit a physical product order to Printify for print-on-demand fulfillment.
 */
import { eq } from "drizzle-orm";
import {
  physicalProductOrders,
  physicalProducts,
  users,
} from "../../drizzle/schema";
import {
  createOrder,
  isPrintifyConfigured,
  splitFullName,
} from "../printify";
import { ENV } from "../_core/env";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export interface FulfillPrintifyOrderResult {
  submitted: boolean;
  skipped?: boolean;
  reason?: string;
  printifyOrderId?: string;
  status?: string;
  error?: string;
}

export async function fulfillPrintifyOrder(
  db: Db,
  orderId: number,
  options?: { customerEmail?: string | null; force?: boolean },
): Promise<FulfillPrintifyOrderResult> {
  const [row] = await db
    .select({
      order: physicalProductOrders,
      product: {
        id: physicalProducts.id,
        title: physicalProducts.title,
        printifyEnabled: physicalProducts.printifyEnabled,
        printifyShopId: physicalProducts.printifyShopId,
        printifyProductId: physicalProducts.printifyProductId,
        printifyVariantId: physicalProducts.printifyVariantId,
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

  if (!product.printifyEnabled) {
    return { submitted: false, skipped: true, reason: "printify_disabled" };
  }

  if (!product.printifyShopId || !product.printifyProductId || !product.printifyVariantId) {
    return { submitted: false, skipped: true, reason: "missing_printify_product_link" };
  }

  if (!isPrintifyConfigured()) {
    return { submitted: false, skipped: true, reason: "api_token_not_configured" };
  }

  if (order.printifySubmittedAt && order.printifyOrderId && !options?.force) {
    return {
      submitted: false,
      skipped: true,
      reason: "already_submitted",
      printifyOrderId: order.printifyOrderId ?? undefined,
      status: order.printifyStatus ?? undefined,
    };
  }

  const line1 = order.shippingLine1?.trim();
  const city = order.shippingCity?.trim();
  const zip = order.shippingPostalCode?.trim();
  const country = (order.shippingCountry ?? "US").trim().toUpperCase();
  const email = options?.customerEmail?.trim() || user.email?.trim() || "";

  if (!line1 || !city || !zip || !country) {
    const message = "Shipping address is incomplete for Printify fulfillment";
    await db.update(physicalProductOrders).set({
      printifyError: message,
      printifyStatus: "failed",
    }).where(eq(physicalProductOrders.id, orderId));
    return { submitted: false, error: message };
  }

  const { first, last } = splitFullName(order.shippingName);
  const externalId = `aaus-ppo-${order.id}`;
  const shippingMethod = Number.parseInt(
    process.env.PRINTIFY_SHIPPING_METHOD ?? ENV.printifyShippingMethod ?? "1",
    10,
  );

  try {
    const result = await createOrder(product.printifyShopId, {
      external_id: externalId,
      line_items: [{
        product_id: product.printifyProductId,
        variant_id: product.printifyVariantId,
        quantity: 1,
      }],
      shipping_method: Number.isFinite(shippingMethod) ? shippingMethod : 1,
      send_shipping_notification: true,
      address_to: {
        first_name: first,
        last_name: last,
        email: email || "orders@allaboutultrasound.com",
        phone: "0000000000",
        country,
        region: order.shippingState?.trim() || "",
        address1: line1,
        address2: order.shippingLine2?.trim() || undefined,
        city,
        zip,
      },
    });

    const printifyOrderId = result.id ? String(result.id) : null;
    const status = result.status ?? "submitted";

    await db.update(physicalProductOrders).set({
      printifyOrderId,
      printifyStatus: status,
      printifyError: null,
      printifySubmittedAt: new Date(),
      fulfillmentStatus: "processing",
      notes: order.notes
        ? `${order.notes}\nPrintify submitted (${externalId}${printifyOrderId ? `, order ${printifyOrderId}` : ""})`
        : `Printify submitted (${externalId}${printifyOrderId ? `, order ${printifyOrderId}` : ""})`,
    }).where(eq(physicalProductOrders.id, orderId));

    console.log(`[Printify] Order ${orderId} submitted as ${externalId}${printifyOrderId ? ` / ${printifyOrderId}` : ""}`);
    return { submitted: true, printifyOrderId: printifyOrderId ?? undefined, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(physicalProductOrders).set({
      printifyError: message,
      printifyStatus: "failed",
    }).where(eq(physicalProductOrders.id, orderId));
    console.error(`[Printify] Failed to submit order ${orderId}:`, message);
    return { submitted: false, error: message };
  }
}
