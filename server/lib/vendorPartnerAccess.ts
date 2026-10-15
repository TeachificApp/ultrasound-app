import { and, desc, eq } from "drizzle-orm";
import { vendorPartnerApplications } from "../../drizzle/schema";
import { type VendorPartnerScope, isApprovedVendorForScope } from "../../shared/vendorPartner";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

export async function getApprovedVendorApplicationForUser(userId: number, scope?: VendorPartnerScope) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Partner access is temporarily unavailable." });

  const rows = await db.select().from(vendorPartnerApplications)
    .where(and(eq(vendorPartnerApplications.linkedUserId, userId), eq(vendorPartnerApplications.status, "approved")))
    .orderBy(desc(vendorPartnerApplications.reviewedAt), desc(vendorPartnerApplications.id));

  const record = scope
    ? rows.find(item => isApprovedVendorForScope(item, userId, scope))
    : rows.find(item => item.linkedUserId === userId && item.status === "approved");
  return record ?? null;
}

export async function requireApprovedVendorApplication(userId: number, scope: VendorPartnerScope) {
  const application = await getApprovedVendorApplicationForUser(userId, scope);
  if (!application || !isApprovedVendorForScope(application, userId, scope)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "An approved partner account is required to view pricing or begin secure checkout.",
    });
  }
  return application;
}
