import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const sendEmailMock = vi.fn();
const notifyOwnerMock = vi.fn();
const emailWrapperMock = vi.fn((content: string) => content);

vi.mock("../server/_core/email", () => ({
  emailWrapper: emailWrapperMock,
  sendEmail: sendEmailMock,
}));

vi.mock("../server/_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

vi.mock("../server/_core/env", () => ({
  env: { platformAdminEmail: "admin@example.test" },
}));

describe("Group and Organization Sales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmailMock.mockResolvedValue(true);
    notifyOwnerMock.mockResolvedValue(true);
  });

  it("routes a multi-interest organization inquiry to the administrator and the requester", async () => {
    const { teamRouter } = await import("./routers/teamRouter");
    const caller = teamRouter.createCaller({} as any);

    await expect(caller.submitInquiry({
      orgName: "Lakeside Clinical Education",
      contactName: "Jordan Lee",
      contactEmail: "jordan@example.test",
      contactPhone: "555-0100",
      seatEstimate: 25,
      brand: "dual",
      plan: "custom",
      interests: ["course_quiz_access", "onsite_hands_on_training"],
      message: "We are planning a hands-on skills day.",
    })).resolves.toEqual({ success: true });

    expect(notifyOwnerMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "New Group / Organization Inquiry: Lakeside Clinical Education",
      content: expect.stringContaining("Group access to courses and quizzes"),
    }), { skipAdminEmail: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      to: { name: "Platform Administrator", email: "admin@example.test" },
      htmlBody: expect.stringContaining("Hands-on training at the organization’s facility"),
    }));
    expect(sendEmailMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      to: { name: "Jordan Lee", email: "jordan@example.test" },
      subject: "We received your group learning inquiry — Lakeside Clinical Education",
      htmlBody: expect.stringContaining("support@allaboutultrasound.com"),
    }));
  });

  it("requires a known group-sales interest when interests are supplied", async () => {
    const { teamRouter } = await import("./routers/teamRouter");
    const caller = teamRouter.createCaller({} as any);

    await expect(caller.submitInquiry({
      orgName: "Lakeside Clinical Education",
      contactName: "Jordan Lee",
      contactEmail: "jordan@example.test",
      seatEstimate: 25,
      brand: "dual",
      plan: "custom",
      interests: ["unknown_interest"],
    } as any)).rejects.toThrow();

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("escapes user-provided inquiry text before rendering it into transactional email", async () => {
    const { teamRouter } = await import("./routers/teamRouter");
    const caller = teamRouter.createCaller({} as any);

    await caller.submitInquiry({
      orgName: "<Lakeside>",
      contactName: "Jordan Lee",
      contactEmail: "jordan@example.test",
      seatEstimate: 5,
      brand: "aaus",
      plan: "custom",
      interests: ["professional_access"],
      message: "<strong>Need safe email markup</strong>",
    });

    const adminEmail = sendEmailMock.mock.calls[0][0];
    expect(adminEmail.htmlBody).toContain("&lt;Lakeside&gt;");
    expect(adminEmail.htmlBody).toContain("&lt;strong&gt;Need safe email markup&lt;/strong&gt;");
    expect(adminEmail.htmlBody).not.toContain("<strong>Need safe email markup</strong>");
  });

  it("keeps the sales page and its Group/Organization aliases mounted before public fallbacks", () => {
    const appSource = readFileSync("./client/src/App.tsx", "utf8");
    const pageSource = readFileSync("./client/src/pages/GroupOrganizationSales.tsx", "utf8");

    expect(appSource).toContain('const GroupOrganizationSales = lazy(() => import("./pages/GroupOrganizationSales"))');
    expect((appSource.match(/path="\/group-sales"/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect((appSource.match(/path="\/organization-sales"/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(appSource).toContain('"group-sales", "organization-sales"');
    expect(pageSource).toContain("Explore training that comes to your facility.");
    expect(pageSource).toContain("Group course access");
    expect(pageSource).toContain("Organization access");
    expect(pageSource).toContain("trpc.team.submitInquiry.useMutation");
    expect(pageSource).toContain("TooltipTrigger asChild");
    expect(pageSource).toContain("aria-label={`${label}. ${description}`}");
    expect(pageSource).toContain("Coordinated learning for a defined group");
  });
});
