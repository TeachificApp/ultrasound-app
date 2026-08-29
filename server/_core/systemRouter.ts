import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./trpc";
import { ENV } from "./env";
import { verifyManusApiConnection } from "../lib/manusApiClient";
import { verifyAiConnection } from "../lib/aiConnection";
import { getStorageHealth } from "../storage";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z
        .object({
          timestamp: z.number().min(0, "timestamp cannot be negative").optional(),
        })
        .optional()
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  verifyManusAi: adminProcedure.mutation(async () => {
    try {
      await verifyManusApiConnection();
      return { connected: true } as const;
    } catch (error) {
      console.warn("[ManusAPI] Railway connection check failed", error instanceof Error ? error.message : "unknown error");
      return { connected: false } as const;
    }
  }),

  verifyAi: adminProcedure.mutation(async () => {
    try {
      const status = await verifyAiConnection();
      return status;
    } catch (error) {
      console.warn("[AI] Connection check failed", error instanceof Error ? error.message : "unknown error");
      return {
        configured: true,
        backend: ENV.manusApiKey ? ("manus-api-v2" as const) : ("forge-chat" as const),
        connected: false,
      };
    }
  }),

  /** Reports only storage readiness stages; no values, object paths, URLs, or credentials are returned. */
  checkStorageHealth: adminProcedure.mutation(async () => getStorageHealth()),

  /**
   * requestAccess — called by authenticated users who land on the Access Required page.
   * Sends the owner a notification with the user's name, email, current roles, and the
   * route they were trying to reach.
   */
  requestAccess: protectedProcedure
    .input(
      z.object({
        requestedRoute: z.string().max(200).default("/"),
        message: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const title = `Access Request — ${user.name ?? user.email ?? "Unknown User"}`;
      const content = [
        `A user has requested access to a restricted area of All About Ultrasound™.`,
        ``,
        `**User Details**`,
        `- Name: ${user.name ?? "(not set)"}`,
        `- Email: ${user.email ?? "(not set)"}`,
        `- User ID: ${user.id}`,
        ``,
        `**Request Details**`,
        `- Requested Route: ${input.requestedRoute}`,
        ...(input.message ? [`- Message: ${input.message}`] : []),
        ``,
        `To grant access, visit the Platform Admin panel at /platform-admin.`,
      ].join("\n");

      const delivered = await notifyOwner({ title, content });
      return { success: delivered } as const;
    }),
});
