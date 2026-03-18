import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
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
        `A user has requested access to a restricted area of iHeartEcho™.`,
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
