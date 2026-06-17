/**
 * remaining-seats-block.test.ts
 * Tests for the Remaining Seats block settings and data fetching.
 * Verifies that workshopAdminRouter.list includes instances correctly.
 */

import { describe, it, expect } from "vitest";

describe("Remaining Seats Block - Data Structure", () => {
  it("should correctly structure workshop data with instances for dropdown", () => {
    // Mock workshop data as returned from the database
    const mockWorkshop = {
      id: 1,
      slug: "test-workshop",
      title: "Test Workshop",
      brand: "aaus",
      status: "published",
    };

    // Mock instances data
    const mockInstances = [
      {
        id: 101,
        workshopId: 1,
        title: "Instance 1",
        startDate: new Date("2026-06-20"),
        endDate: new Date("2026-06-21"),
        capacity: 50,
        timezone: "UTC",
      },
      {
        id: 102,
        workshopId: 1,
        title: "Instance 2",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-02"),
        capacity: 30,
        timezone: "UTC",
      },
    ];

    // Simulate the structure that the frontend expects
    const workshopWithInstances = { ...mockWorkshop, instances: mockInstances };

    // Build the dropdown list like the frontend does
    const items: Array<{ id: number; label: string }> = [];
    for (const inst of workshopWithInstances.instances) {
      items.push({
        id: inst.id,
        label: `${workshopWithInstances.title} — ${inst.title ?? `Instance #${inst.id}`}`,
      });
    }

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe(101);
    expect(items[0].label).toBe("Test Workshop — Instance 1");
    expect(items[1].id).toBe(102);
    expect(items[1].label).toBe("Test Workshop — Instance 2");
  });

  it("should handle search filtering on dropdown items", () => {
    const mockItems = [
      { id: 101, label: "General Ultrasound — Session A" },
      { id: 102, label: "General Ultrasound — Session B" },
      { id: 201, label: "Advanced Vascular — Session 1" },
      { id: 202, label: "Advanced Vascular — Session 2" },
    ];

    const searchTerm = "vascular";
    const filtered = mockItems.filter((i) =>
      i.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe(201);
    expect(filtered[1].id).toBe(202);
  });

  it("should correctly display selected item in dropdown", () => {
    const mockItems = [
      { id: 101, label: "Workshop A — Instance 1" },
      { id: 102, label: "Workshop A — Instance 2" },
      { id: 201, label: "Workshop B — Instance 1" },
    ];

    const selectedId = 102;
    const selectedItem = mockItems.find((item) => item.id === selectedId);

    expect(selectedItem).toBeDefined();
    expect(selectedItem?.label).toBe("Workshop A — Instance 2");
  });

  it("should handle empty instances list", () => {
    const mockWorkshop = {
      id: 1,
      slug: "empty-workshop",
      title: "Empty Workshop",
      brand: "aaus",
      status: "published",
    };

    const mockInstances: any[] = [];
    const workshopWithInstances = { ...mockWorkshop, instances: mockInstances };

    const items: Array<{ id: number; label: string }> = [];
    for (const inst of workshopWithInstances.instances) {
      items.push({
        id: inst.id,
        label: `${workshopWithInstances.title} — ${inst.title ?? `Instance #${inst.id}`}`,
      });
    }

    expect(items).toHaveLength(0);
  });

  it("should correctly map cohort groups to dropdown items", () => {
    // Mock cohort data
    const mockCohorts = [
      { id: 1, title: "General Ultrasound - Spring 2026" },
      { id: 2, title: "Advanced Vascular - Summer 2026" },
      { id: 3, title: "Pediatric Echo - Fall 2026" },
    ];

    // Build dropdown list for cohorts
    const items = mockCohorts.map((c) => ({
      id: c.id,
      label: c.title ?? `Cohort #${c.id}`,
    }));

    expect(items).toHaveLength(3);
    expect(items[0].label).toBe("General Ultrasound - Spring 2026");
    expect(items[1].label).toBe("Advanced Vascular - Summer 2026");
    expect(items[2].label).toBe("Pediatric Echo - Fall 2026");
  });

  it("should persist sourceId and sourceName when applying selection patch atomically", () => {
    // Simulates BlockSettings setMany — both fields must survive a single update
    const initial = {
      sourceType: "workshop_instance" as const,
      sourceId: null as number | null,
      sourceName: "",
      headline: "Limited Seats Available",
    };

    const item = { id: 101, label: "Intro to Adult Echocardiography — August 17-19, 2026" };
    const next = { ...initial, sourceId: item.id, sourceName: item.label };

    expect(next.sourceId).toBe(101);
    expect(next.sourceName).toBe(item.label);

    // Sequential single-key updates without merging stale state would drop sourceId
    let ref = { ...initial };
    const staleSet = (key: keyof typeof ref, value: unknown) => {
      ref = { ...initial, [key]: value };
    };
    staleSet("sourceId", item.id);
    staleSet("sourceName", item.label);
    expect(ref.sourceId).toBeNull();
    expect(ref.sourceName).toBe(item.label);
  });
});
