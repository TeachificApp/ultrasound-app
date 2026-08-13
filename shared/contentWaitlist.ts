export type ContentWaitlistEntryLike = {
  id: number;
  productType: string;
  productId: number;
};

/** Groups waitlist entries by the exact public CTA target, including instances. */
export function groupContentWaitlistEntries<T extends ContentWaitlistEntryLike>(entries: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = `${entry.productType}:${entry.productId}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()];
}
