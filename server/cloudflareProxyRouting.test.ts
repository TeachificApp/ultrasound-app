import { describe, expect, it } from "vitest";
import edgeWorker from "../references/cloudflare-proxy-worker.js";

const worker = edgeWorker as {
  fetch: (request: Request, env: Record<string, string>) => Promise<Response>;
};

function route(pathname: string, env: Record<string, string> = {}) {
  return worker.fetch(new Request(`https://allaboutultrasound.com${pathname}`), {
    APP_ORIGIN: "https://app.allaboutultrasound.com",
    LEARN_ORIGIN: "https://learn.allaboutultrasound.com",
    ROOT_DOMAIN: "allaboutultrasound.com",
    ...env,
  });
}

describe("Cloudflare public-domain routing", () => {
  it("hands account management, content, and checkout routes to Learn", async () => {
    await expect(route("/my-dashboard?tab=subscriptions")).resolves.toMatchObject({ status: 302 });

    const dashboard = await route("/my-dashboard?tab=subscriptions");
    const course = await route("/courses/ultrasound-basics");
    const checkout = await route("/checkout/course/ultrasound-basics?coupon=SAVE");
    const workshop = await route("/workshops/fetal-echo");

    expect(dashboard.headers.get("location")).toBe("https://learn.allaboutultrasound.com/my-dashboard?tab=subscriptions");
    expect(course.headers.get("location")).toBe("https://learn.allaboutultrasound.com/courses/ultrasound-basics");
    expect(checkout.headers.get("location")).toBe("https://learn.allaboutultrasound.com/checkout/course/ultrasound-basics?coupon=SAVE");
    expect(workshop.headers.get("location")).toBe("https://learn.allaboutultrasound.com/workshops/fetal-echo");
  });

  it("keeps platform administration on the app domain while routing LMS administration to Learn", async () => {
    const platformAdmin = await route("/admin/users");
    const lmsAdmin = await route("/admin/lms/courses");

    expect(platformAdmin.headers.get("location")).toBe("https://app.allaboutultrasound.com/admin/users");
    expect(lmsAdmin.headers.get("location")).toBe("https://learn.allaboutultrasound.com/admin/lms/courses");
  });

  it("uses the configured iHeartEcho app and Learn destinations", async () => {
    const env = {
      APP_ORIGIN: "https://app.iheartecho.com",
      LEARN_ORIGIN: "https://learn.iheartecho.com",
      ROOT_DOMAIN: "iheartecho.com",
    };
    const account = await worker.fetch(new Request("https://iheartecho.com/my-dashboard"), env);
    const checkout = await worker.fetch(new Request("https://iheartecho.com/checkout/workshop/echo"), env);
    const admin = await worker.fetch(new Request("https://iheartecho.com/admin/settings"), env);

    expect(account.headers.get("location")).toBe("https://learn.iheartecho.com/my-dashboard");
    expect(checkout.headers.get("location")).toBe("https://learn.iheartecho.com/checkout/workshop/echo");
    expect(admin.headers.get("location")).toBe("https://app.iheartecho.com/admin/settings");
  });
});
