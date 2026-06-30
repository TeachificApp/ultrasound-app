/**
 * Submit a physical product order to BookVault for print-on-demand fulfillment.
 */
import { eq } from "drizzle-orm";
import {
  physicalProductOrders,
  physicalProducts,
  users,
} from "../../drizzle/schema";
import {
  buildDocRef,
  createOrder,
  isBookvaultConfigured,
  normalizeIsbn,
  type BookvaultCreateOrderPayload,
} from "../bookvault";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export interface FulfillBookvaultOrderResult {
  submitted: boolean;
  skipped?: boolean;
  reason?: string;
  docRef?: string;
  podRef?: string;
  status?: string;
  error?: string;
}

export async function fulfillBookvaultOrder(
  db: Db,
  orderId: number,
  options?: { customerEmail?: string | null; force?: boolean },
): Promise<FulfillBookvaultOrderResult> {
  const [row] = await db
    .select({
      order: physicalProductOrders,
      product: {
        id: physicalProducts.id,
        title: physicalProducts.title,
        bookvaultEnabled: physicalProducts.bookvaultEnabled,
        bookvaultIsbn: physicalProducts.bookvaultIsbn,
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

  if (!row) {
    return { submitted: false, reason: "order_not_found" };
  }

  const { order, product, user } = row;

  if (!product.bookvaultEnabled) {
    return { submitted: false, skipped: true, reason: "bookvault_disabled" };
  }

  const isbn = normalizeIsbn(product.bookvaultIsbn);
  if (!isbn) {
    return { submitted: false, skipped: true, reason: "missing_isbn" };
  }

  if (!isBookvaultConfigured()) {
    return { submitted: false, skipped: true, reason: "api_key_not_configured" };
  }

  if (order.bookvaultSubmittedAt && order.bookvaultPodRef && !options?.force) {
    return {
      submitted: false,
      skipped: true,
      reason: "already_submitted",
      docRef: order.bookvaultDocRef ?? undefined,
      podRef: order.bookvaultPodRef ?? undefined,
      status: order.bookvaultStatus ?? undefined,
    };
  }

  const docRef = order.bookvaultDocRef ?? buildDocRef(order.id);
  const email = options?.customerEmail?.trim() || user.email?.trim() || "";
  const addressee = order.shippingName?.trim() || user.name?.trim() || "Customer";
  const line1 = order.shippingLine1?.trim();
  const town = order.shippingCity?.trim();
  const postcode = order.shippingPostalCode?.trim();
  const country = (order.shippingCountry ?? "US").trim().toUpperCase();

  if (!line1 || !town || !postcode || !country) {
    const message = "Shipping address is incomplete for BookVault fulfillment";
    await db.update(physicalProductOrders).set({
      bookvaultDocRef: docRef,
      bookvaultError: message,
      bookvaultStatus: "failed",
    }).where(eq(physicalProductOrders.id, orderId));
    return { submitted: false, error: message, docRef };
  }

  // For US orders, pin to PartnerID 1 (BookVault US hub) so the book is printed and
  // shipped domestically — avoiding international customs fees for US customers.
  // For all other countries, use PartnerID 0 (auto-select best partner).
  const dispatchRequest = country === "US"
    ? { RequestedService: "CheapestTracked", PartnerID: 1 }
    : { RequestedService: process.env.BOOKVAULT_DISPATCH_SERVICE ?? "CheapestTracked", PartnerID: 0 };

  const payload: BookvaultCreateOrderPayload = {
    DocRef: docRef,
    CustomerRef: `user-${order.userId}`,
    Address: {
      Addressee: addressee,
      Address1: line1,
      Address2: order.shippingLine2?.trim() || undefined,
      Town: town,
      County: order.shippingState?.trim() || undefined,
      Postcode: postcode,
      Country: { ISO_Code: country },
      TelNumber: "0000000000",
      Email: email || "orders@allaboutultrasound.com",
    },
    DispatchRequest: dispatchRequest,
    OrderLines: [{ Quantity: 1, ISBN: isbn }],
  };

  try {
    const result = await createOrder(payload);
    const podRef = typeof result.PodRef === "string" ? result.PodRef : null;
    const status = typeof result.Status === "string" ? result.Status : "submitted";

    await db.update(physicalProductOrders).set({
      bookvaultDocRef: docRef,
      bookvaultPodRef: podRef,
      bookvaultStatus: status,
      bookvaultError: null,
      bookvaultSubmittedAt: new Date(),
      fulfillmentStatus: "processing",
      notes: order.notes
        ? `${order.notes}\nBookVault submitted (${docRef}${podRef ? `, PodRef ${podRef}` : ""})`
        : `BookVault submitted (${docRef}${podRef ? `, PodRef ${podRef}` : ""})`,
    }).where(eq(physicalProductOrders.id, orderId));

    console.log(`[BookVault] Order ${orderId} submitted as ${docRef}${podRef ? ` / ${podRef}` : ""}`);
    return { submitted: true, docRef, podRef: podRef ?? undefined, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(physicalProductOrders).set({
      bookvaultDocRef: docRef,
      bookvaultError: message,
      bookvaultStatus: "failed",
    }).where(eq(physicalProductOrders.id, orderId));
    console.error(`[BookVault] Failed to submit order ${orderId}:`, message);
    return { submitted: false, error: message, docRef };
  }
}
