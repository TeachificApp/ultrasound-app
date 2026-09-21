import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(`${root}${path}`, "utf8");

describe("Study Groups", () => {
  it("loads the protected Study Group router module", async () => {
    const module = await import("./routers/studyGroupsRouter");
    expect(module.studyGroupsRouter).toBeDefined();
    expect(module.handleStudyGroupCheckoutCompleted).toBeTypeOf("function");
  });

  it("defines private collaboration, organization, content, and editable-block storage", () => {
    const migration = read("drizzle/0070_study_groups.sql");
    for (const table of ["study_groups", "study_group_members", "study_group_documents", "study_group_tasks", "study_group_messages", "study_group_modules", "study_group_content_access", "study_group_workspace_blocks"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
    }
    expect(migration).toContain("DEFAULT 5");
    expect(read("server/routers/studyGroupsRouter.ts")).toContain("STUDY_GROUP_ORGANIZATION_MONTHLY_CENTS = 9900");
  });

  it("keeps the deployed legacy billing-period column compatible with the current schema", () => {
    const compatibilityMigration = read("drizzle/0073_study_group_legacy_period_compat.sql");
    const schema = read("drizzle/schema.ts");
    expect(compatibilityMigration).toContain("stripe_current_period_end");
    expect(schema).toContain('legacyStripeCurrentPeriodEnd: timestamp("stripe_current_period_end")');
    expect(schema).toContain('currentPeriodEnd: timestamp("current_period_end")');
  });

  it("keeps invitations email-address based and supports Zoom and Microsoft Teams meeting links", () => {
    const router = read("server/routers/studyGroupsRouter.ts");
    expect(router).toContain("inviteByEmail");
    expect(router).toContain("z.string().email()");
    expect(router).toContain("Sign in with the invited email address");
    expect(router).toContain('"zoom", "teams", "other"');
    expect(router).toContain("teams.microsoft.com");
    expect(router).toContain("zoom.us");
    expect(router).toContain("getSafeStudyGroupOrigin");
    expect(router).toContain("learn.allaboutultrasound.com");
    expect(router).toContain("Study Group links must use an approved Learn platform address.");
  });

  it("protects group content, platform admin oversight, group seats, and the 10 percent discount", () => {
    const router = read("server/routers/studyGroupsRouter.ts");
    expect(router).toContain("requireGroupAccess");
    expect(router).toContain("requirePlatformAdmin");
    expect(router).toContain("STUDY_GROUP_CONTENT_DISCOUNT_PERCENT = 10");
    expect(router).toContain("createOrganizationCheckout");
    expect(router).toContain("adminListGroups");
    expect(read("server/routes/uploadStudyGroupDocument.ts")).toContain("study-groups/${groupId}/");
    expect(router).toContain("study_group_access_${access.id}");
    expect(router).toContain("members: access.canManage ? members.map");
    expect(read("client/src/pages/StudyGroupWorkspace.tsx")).toContain("{permissions.canManage && <span");
  });

  it("registers payment lifecycle and secure document upload paths", () => {
    const webhook = read("server/webhooks/stripe.ts");
    const index = read("server/_core/index.ts");
    const upload = read("server/routes/uploadStudyGroupDocument.ts");
    expect(webhook).toContain("handleStudyGroupCheckoutCompleted");
    expect(webhook).toContain("handleStudyGroupSubscriptionLifecycle");
    expect(index).toContain("registerStudyGroupDocumentUploadRoute(app)");
    expect(upload).toContain("study-groups/${groupId}/");
    expect(upload).toContain("MAX_DOCUMENT_BYTES");
    expect(upload).toContain("/api/study-groups/:groupId/documents/:documentId/download");
    expect(upload).toContain("storageGet(document.storageKey)");
    expect(upload).toContain("aes-256-gcm");
    expect(upload).toContain("encryptStudyGroupDocument(req.file.buffer)");
    expect(upload).toContain("decryptStudyGroupDocument(encryptedDocument)");
    expect(read("server/routers/studyGroupsRouter.ts")).toContain("storageKey: _storageKey, fileUrl: _fileUrl");
    expect(upload).toContain("study-group-private://${storageKey}");
    expect(upload).toContain("documentId: inserted[0]?.id ?? null");
    expect(upload).not.toContain("return res.json({ storageKey");
    const workspace = read("client/src/pages/StudyGroupWorkspace.tsx");
    expect(workspace).toContain("/api/study-groups/${groupId}/documents/${document.id}/download");
    expect(workspace).not.toContain("trpc.studyGroups.addDocument");
  });

  it("exposes Study Groups inside the Education Library and keeps admin workspace blocks editable", () => {
    const app = read("client/src/App.tsx");
    const library = read("client/src/pages/EducationLibrary.tsx");
    const workspace = read("client/src/pages/StudyGroupWorkspace.tsx");
    const admin = read("client/src/pages/admin/StudyGroupsAdmin.tsx");
    expect(app).toContain('path="/study-groups"');
    expect(app).toContain('path="/admin/study-groups"');
    expect(library).toContain("Study Groups");
    expect(workspace).toContain("Microsoft Teams");
    expect(workspace).toContain("Group content access");
    expect(admin).toContain("Workspace content blocks");
  });
});
