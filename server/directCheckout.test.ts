import { describe, expect, it } from "vitest";
import { isScheduledDeadlineOpen } from "../shared/platformTime";
import { hasFiniteWorkshopCapacity } from "../shared/workshopAvailability";

/** Mirror of pickWorkshopCheckoutInstance in funnelRouter.ts for unit testing. */
function pickWorkshopCheckoutInstance(instances: Array<{
  id: number;
  availableForPurchase: boolean;
  status: string;
  salesOpenDate: Date | null;
  salesCloseDate: Date | null;
  enrollmentCloseDate?: Date | null;
  startDate: Date;
  timezone?: string | null;
  capacity?: number | null;
  enrolledCount?: number | null;
}>) {
  const now = new Date();
  const onSale = instances.filter((instance) => {
    if (!instance.availableForPurchase) return false;
    if (instance.status !== "published" && instance.status !== "presale") return false;
    if (instance.salesOpenDate && now < instance.salesOpenDate) return false;
    const closeDate = instance.salesCloseDate ?? instance.enrollmentCloseDate ?? instance.startDate;
    if (!isScheduledDeadlineOpen(closeDate, instance.timezone, now)) return false;
    if (hasFiniteWorkshopCapacity(instance.capacity) && (instance.enrolledCount ?? 0) >= instance.capacity) return false;
    return true;
  });
  return onSale.find(i => i.startDate && new Date(i.startDate) >= now)
    ?? onSale.find(i => i.status === "published" || i.status === "presale")
    ?? onSale[0]
    ?? null;
}

describe("pickWorkshopCheckoutInstance", () => {
  it("treats legacy zero capacity as unlimited when sales are open", () => {
    const future = new Date(Date.now() + 7 * 86400000);
    const picked = pickWorkshopCheckoutInstance([{
      id: 0,
      availableForPurchase: true,
      status: "published",
      salesOpenDate: null,
      salesCloseDate: null,
      startDate: future,
      capacity: 0,
      enrolledCount: 0,
    }]);
    expect(picked?.id).toBe(0);
  });

  it("skips sold-out instances and picks the next on-sale date", () => {
    const future = new Date(Date.now() + 7 * 86400000);
    const picked = pickWorkshopCheckoutInstance([
      {
        id: 1,
        availableForPurchase: true,
        status: "published",
        salesOpenDate: null,
        salesCloseDate: null,
        startDate: future,
        capacity: 10,
        enrolledCount: 10,
      },
      {
        id: 2,
        availableForPurchase: true,
        status: "published",
        salesOpenDate: null,
        salesCloseDate: null,
        startDate: future,
        capacity: 20,
        enrolledCount: 5,
      },
    ]);
    expect(picked?.id).toBe(2);
  });
});
