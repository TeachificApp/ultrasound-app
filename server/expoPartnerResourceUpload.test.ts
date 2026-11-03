import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { vendorPortalRouter } from "./routers/vendorPortalRouter";
import {
  EXPO_RESOURCE_MAX_BYTES,
  expoResourceFileError,
  expoResourceMimeType,
} from "../shared/expoPartnerResourceUpload";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserRoles: vi.fn(),
  getOrCreateUserByEmail: vi.fn(),
  storagePut: vi.fn(),
  sendEmail: vi.fn(),
  requireApprovedVendorApplication: vi.fn(),
  listCompatibleExpoEvents: vi.fn(),
  addExpoPartnerToEmailList: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getUserRoles: mocks.getUserRoles,
  getOrCreateUserByEmail: mocks.getOrCreateUserByEmail,
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./_core/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("./lib/vendorPartnerAccess", () => ({
  requireApprovedVendorApplication: mocks.requireApprovedVendorApplication,
}));
vi.mock("./lib/expoEventSchemaCompatibility", () => ({
  listCompatibleExpoEvents: mocks.listCompatibleExpoEvents,
}));
vi.mock("./lib/emailListHelper", () => ({
  addExpoPartnerToEmailList: mocks.addExpoPartnerToEmailList,
}));

const file = Buffer.from("%PDF-1.7\nSynthetic in-memory test fixture\n%%EOF");
const input = {
  eventId: 42,
  title: "Exhibitor prospectus",
  description: "Published exhibitor information",
  resourceType: "document" as const,
  fileName: "prospectus.pdf",
  mimeType: "application/pdf",
  dataUri: `data:application/pdf;base64,${file.toString("base64")}`,
  isPublished: false,
};
const metadata = {
  eventId: 42,
  title: "Existing map",
  resourceType: "floor_plan" as const,
  resourceUrl: "/manus-storage/expo/map.pdf",
  isPublished: true,
  sortOrder: 4,
};
const caller = (role: "admin" | "user" | null = "admin") =>
  vendorPortalRouter.createCaller({
    user: role ? { id: 1, role } : null,
    req: {},
    res: {},
  } as any);

// Real Drizzle compiles SQL against this fake driver only. No network requests,
// storage uploads, real DB reads/writes, DDL, or emails occur in these tests.
function mockDatabase(
  options: {
    eventId?: number | null;
    resource?: { id: number; eventId: number } | null;
    insertFailure?: boolean;
    insertId?: number;
  } = {}
) {
  const statements: { sql: string; params: unknown[] }[] = [];
  let nextId = options.insertId ?? 81;
  const client = {
    query: vi.fn(async (query: { sql: string }, params: unknown[]) => {
      statements.push({ sql: query.sql, params });
      if (/^select/i.test(query.sql)) {
        if (query.sql.includes("from `ultrasound_expo_events`")) {
          const id = options.eventId === undefined ? 42 : options.eventId;
          return [id === null ? [] : [[id]], []];
        }
        if (
          query.sql.includes("from `ultrasound_expo_partner_resources`") &&
          query.sql.includes("select `id`, `event_id`")
        ) {
          return [
            options.resource
              ? [[options.resource.id, options.resource.eventId]]
              : [],
            [],
          ];
        }
        return [[], []];
      }
      if (/^insert/i.test(query.sql)) {
        if (options.insertFailure)
          throw new Error("Synthetic database failure");
        return [{ insertId: nextId++, affectedRows: 1 }, []];
      }
      if (/^update/i.test(query.sql)) return [{ affectedRows: 1 }, []];
      throw new Error("Unexpected query");
    }),
  };
  mocks.getDb.mockResolvedValue(drizzle({ client: client as any }));
  return { statements, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserRoles.mockResolvedValue([]);
  mocks.storagePut.mockResolvedValue({
    key: "synthetic-key",
    url: "https://storage.example.test/new-resource.pdf",
  });
  mocks.requireApprovedVendorApplication.mockResolvedValue(null);
  mocks.listCompatibleExpoEvents.mockResolvedValue([]);
});

describe("adminUploadExpoResource access and versioned persistence", () => {
  it.each([null, "user"] as const)(
    "blocks %s before event lookup, upload or insertion",
    async role => {
      const { client } = mockDatabase();
      await expect(
        caller(role).adminUploadExpoResource(input)
      ).rejects.toMatchObject({
        code: role === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      expect(mocks.getDb).not.toHaveBeenCalled();
      expect(client.query).not.toHaveBeenCalled();
      expect(mocks.storagePut).not.toHaveBeenCalled();
    }
  );

  it("preserves explicit platform-admin access", async () => {
    mockDatabase();
    mocks.getUserRoles.mockResolvedValue(["platform_admin"]);
    expect(await caller("user").adminUploadExpoResource(input)).toEqual({
      id: 81,
      url: "https://storage.example.test/new-resource.pdf",
    });
  });

  it.each([null, 43])(
    "requires the exact event before uploading (driver event %s)",
    async eventId => {
      const { statements } = mockDatabase({ eventId });
      await expect(
        caller().adminUploadExpoResource(input)
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(statements).toHaveLength(1);
      expect(statements[0].sql).toContain(
        "where `ultrasound_expo_events`.`id` = ?"
      );
      expect(statements[0].params).toEqual([42, 1]);
      expect(mocks.storagePut).not.toHaveBeenCalled();
    }
  );

  it("saves only resource metadata/URL for the exact event after a validated upload", async () => {
    const { statements } = mockDatabase();
    const result = await caller().adminUploadExpoResource(input);
    expect(result).toEqual({
      id: 81,
      url: "https://storage.example.test/new-resource.pdf",
    });
    expect(mocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^expo-partner-resources\/42\/[a-f0-9]{32}\.pdf$/),
      file,
      "application/pdf"
    );
    const insert = statements.find(query => /^insert/i.test(query.sql))!;
    expect(insert.sql).toContain("`ultrasound_expo_partner_resources`");
    expect(insert.params).toEqual([
      42,
      "document",
      input.title,
      input.description,
      result.url,
      false,
      0,
    ]);
    expect(insert.params).not.toContain(input.dataUri);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.addExpoPartnerToEmailList).not.toHaveBeenCalled();
  });

  it("creates new version rows/random keys, never updates an existing upload", async () => {
    const { statements } = mockDatabase();
    expect((await caller().adminUploadExpoResource(input)).id).toBe(81);
    expect(
      (
        await caller().adminUploadExpoResource({
          ...input,
          isPublished: true,
          sortOrder: 8,
        })
      ).id
    ).toBe(82);
    const keys = mocks.storagePut.mock.calls.map(call => call[0]);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every(key => !key.includes(input.fileName))).toBe(true);
    expect(statements.filter(query => /^insert/i.test(query.sql))).toHaveLength(
      2
    );
    expect(statements.some(query => /^update/i.test(query.sql))).toBe(false);
    expect(statements.at(-1)?.params).toEqual([
      42,
      "document",
      input.title,
      input.description,
      "https://storage.example.test/new-resource.pdf",
      true,
      8,
    ]);
  });

  it("returns a sanitized storage failure without inserting or logging private data", async () => {
    const { statements } = mockDatabase();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.storagePut.mockRejectedValueOnce(
      new Error(
        "Private provider URL https://storage.example.test/private?token=secret"
      )
    );
    try {
      await expect(
        caller().adminUploadExpoResource(input)
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "The resource could not be uploaded. Please try again.",
      });
      expect(statements.some(query => /^insert/i.test(query.sql))).toBe(false);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it.each([{ insertFailure: true }, { insertId: 0 }])(
    "does not report success when metadata persistence fails: %j",
    async options => {
      mockDatabase(options);
      await expect(
        caller().adminUploadExpoResource(input)
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "The uploaded resource could not be saved. Please try again.",
      });
    }
  );
});

describe("invalid resource files never reach storage or DB inserts", () => {
  const invalid = [
    [
      "SVG",
      {
        fileName: "map.svg",
        mimeType: "image/svg+xml",
        dataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      },
    ],
    [
      "HTML disguised as a PDF",
      {
        dataUri: `data:application/pdf;base64,${Buffer.from("<html>unsafe</html>").toString("base64")}`,
      },
    ],
    [
      "macro-enabled Office",
      {
        fileName: "file.docm",
        mimeType: "application/vnd.ms-word.document.macroEnabled.12",
      },
    ],
    ["MIME/extension mismatch", { fileName: "map.png" }],
    [
      "data URI MIME mismatch",
      { dataUri: `data:image/png;base64,${file.toString("base64")}` },
    ],
    ["malformed base64", { dataUri: "data:application/pdf;base64,%%%%" }],
    ["invalid padding", { dataUri: "data:application/pdf;base64,AAAA====" }],
    ["empty file", { dataUri: "data:application/pdf;base64," }],
    [
      "over 10 MB",
      {
        dataUri: `data:application/pdf;base64,${Buffer.alloc(EXPO_RESOURCE_MAX_BYTES + 1).toString("base64")}`,
      },
    ],
  ] as const;
  it.each(invalid)("rejects %s", async (_label, override) => {
    const { statements } = mockDatabase();
    await expect(
      caller().adminUploadExpoResource({ ...input, ...override })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(statements.some(query => /^insert/i.test(query.sql))).toBe(false);
  });

  it("accepts a file exactly at 10 MB", async () => {
    mockDatabase();
    const bytes = Buffer.alloc(EXPO_RESOURCE_MAX_BYTES);
    file.copy(bytes);
    await expect(
      caller().adminUploadExpoResource({
        ...input,
        dataUri: `data:application/pdf;base64,${bytes.toString("base64")}`,
      })
    ).resolves.toMatchObject({ id: 81 });
    expect(mocks.storagePut.mock.calls[0][1].length).toBe(
      EXPO_RESOURCE_MAX_BYTES
    );
  });

  it.each([
    ["map.png", "image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])],
    ["map.jpg", "image/jpeg", Buffer.from([255, 216, 255, 0])],
    ["map.webp", "image/webp", Buffer.from("RIFF0000WEBP0000")],
    [
      "file.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      Buffer.from([80, 75, 3, 4, 0]),
    ],
    [
      "file.doc",
      "application/msword",
      Buffer.from([208, 207, 17, 224, 161, 177, 26, 225, 0]),
    ],
  ])(
    "supports whitelisted %s signatures",
    async (fileName, mimeType, bytes) => {
      mockDatabase();
      await expect(
        caller().adminUploadExpoResource({
          ...input,
          fileName,
          mimeType,
          dataUri: `data:${mimeType};base64,${bytes.toString("base64")}`,
        })
      ).resolves.toMatchObject({ id: 81 });
    }
  );

  it("uses the same extension/type and size checks for browser controls", () => {
    expect(expoResourceFileError("map.png", "image/png", 1)).toBeNull();
    expect(expoResourceFileError("map.svg", "image/svg+xml", 1)).not.toBeNull();
    expect(
      expoResourceFileError(
        "file.pdf",
        "application/pdf",
        EXPO_RESOURCE_MAX_BYTES + 1
      )
    ).not.toBeNull();
    expect(expoResourceMimeType("PROSPECTUS.PDF")).toBe("application/pdf");
    expect(expoResourceMimeType("file.docm")).toBeUndefined();
  });
});

describe("resource metadata editing and retrieval preserve exact event scope", () => {
  it("updates an existing resource only using both its ID and event ID, including storage paths", async () => {
    const { statements } = mockDatabase({ resource: { id: 81, eventId: 42 } });
    expect(
      await caller().adminSaveExpoResource({ ...metadata, id: 81 })
    ).toEqual({ id: 81, updated: true });
    const update = statements.find(query => /^update/i.test(query.sql))!;
    expect(update.sql).toContain(
      "where (`ultrasound_expo_partner_resources`.`id` = ? and `ultrasound_expo_partner_resources`.`event_id` = ?)"
    );
    expect(update.params.slice(-2)).toEqual([81, 42]);
    expect(update.params).toContain(metadata.resourceUrl);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it.each([null, { id: 81, eventId: 43 }])(
    "rejects a nonexistent/cross-event resource before updating: %j",
    async resource => {
      const { statements } = mockDatabase({ resource });
      await expect(
        caller().adminSaveExpoResource({ ...metadata, id: 81 })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(statements.some(query => /^update/i.test(query.sql))).toBe(false);
    }
  );

  it("rejects link creation for a nonexistent event", async () => {
    const { statements } = mockDatabase({ eventId: null });
    await expect(
      caller().adminSaveExpoResource(metadata)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(statements.some(query => /^insert/i.test(query.sql))).toBe(false);
  });

  it("preserves link creation without storage uploads", async () => {
    const { statements } = mockDatabase();
    expect(
      await caller().adminSaveExpoResource({
        ...metadata,
        resourceUrl: "https://example.test/map.pdf",
      })
    ).toEqual({ id: 81, updated: false });
    expect(
      statements.find(query => /^insert/i.test(query.sql))?.params
    ).toContain("https://example.test/map.pdf");
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejects unsafe script links before writes", async () => {
    const { statements } = mockDatabase();
    await expect(
      caller().adminSaveExpoResource({
        ...metadata,
        resourceUrl: "javascript:alert(1)",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(statements).toHaveLength(0);
  });

  it("returns resources/booths/requests only for the selected admin event", async () => {
    const { statements } = mockDatabase();
    expect(await caller().adminExpoOperations({ eventId: 42 })).toEqual({
      resources: [],
      booths: [],
      boothRequests: [],
    });
    expect(statements).toHaveLength(3);
    for (const statement of statements) {
      expect(statement.sql).toMatch(
        /where `ultrasound_expo_(partner_resources|booths|booth_requests)`\.`event_id` = \?/
      );
      expect(statement.params).toEqual([42]);
    }
  });

  it("keeps protected portal retrieval limited to published resources of published events", async () => {
    const { statements } = mockDatabase();
    mocks.requireApprovedVendorApplication.mockImplementation(
      async (_id, scope) =>
        scope === "ultrasound_expo"
          ? {
              id: 5,
              status: "approved",
              linkedUserId: 1,
              requestedScopes: '["ultrasound_expo"]',
              partnerTypes: '["exhibitor"]',
            }
          : null
    );
    mocks.listCompatibleExpoEvents.mockResolvedValue([{ id: 42 }]);
    await caller("user").myPortal();
    expect(mocks.listCompatibleExpoEvents).toHaveBeenCalledWith(
      expect.anything(),
      { publishedOnly: true }
    );
    const query = statements.find(statement =>
      statement.sql.includes("from `ultrasound_expo_partner_resources`")
    )!;
    expect(query.sql).toContain(
      "`ultrasound_expo_partner_resources`.`is_published` = ?"
    );
    expect(query.params).toEqual([42, true]);
  });
});
