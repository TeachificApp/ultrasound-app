/**
 * meetingRouter.ts
 * Quality Meeting Tool — lives inside DIY Accreditation Tool under Lab Admin.
 * Covers: meeting CRUD, attendee management, recording upload, transcription,
 * AI-generated meeting minutes, attendance tracking, and email invitations.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import {
  qualityMeetings,
  meetingAttendees,
  meetingRecordings,
  meetingTranscripts,
  meetingMinutesDrafts,
  diyOrgMembers,
} from "../../drizzle/schema";
import { storagePut } from "../storage";
import { transcribeAudio } from "../_core/voiceTranscription";
import { ENV } from "../_core/env";
import { sendEmail, buildMeetingInvitationEmail } from "../_core/email";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

async function getOrgId(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [row] = await db
    .select({ orgId: diyOrgMembers.orgId })
    .from(diyOrgMembers)
    .where(and(eq(diyOrgMembers.userId, userId), eq(diyOrgMembers.isActive, true)))
    .limit(1);
  if (!row?.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of any DIY Accreditation organization." });
  return row.orgId;
}

/** Generate AI meeting minutes from transcript using Forge LLM */
async function generateMinutesFromTranscript(
  meetingTitle: string,
  agenda: string | null | undefined,
  transcript: string,
  attendeeNames: string[]
): Promise<string> {
  const prompt = `You are a professional medical quality assurance coordinator. Generate structured meeting minutes in HTML format for the following quality meeting.

Meeting Title: ${meetingTitle}
Agenda: ${agenda || "Not specified"}
Attendees: ${attendeeNames.join(", ") || "Not recorded"}

Transcript:
${transcript.slice(0, 12000)}

Generate professional meeting minutes in HTML with these sections:
1. <h2>Meeting Details</h2> (title, date placeholder, attendees)
2. <h2>Agenda Items Discussed</h2> (numbered list of topics covered)
3. <h2>Key Decisions</h2> (bulleted list of decisions made)
4. <h2>Action Items</h2> (table with: Action, Responsible Person, Due Date)
5. <h2>Quality Metrics Reviewed</h2> (any QA metrics, scores, or data discussed)
6. <h2>Next Meeting</h2> (any scheduling discussed)
7. <h2>Additional Notes</h2>

Use clean, professional HTML with <p>, <ul>, <li>, <table>, <tr>, <th>, <td> tags.
Use Arial font. Keep it concise and clinical. Do not include CSS styles inline.`;

  try {
    const response = await fetch(`${ENV.forgeApiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });
    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
    const json = await response.json() as any;
    return json.choices?.[0]?.message?.content ?? "<p>Minutes generation failed. Please edit manually.</p>";
  } catch {
    return `<p><strong>Auto-generated minutes could not be created.</strong> Please edit manually.</p><p>Transcript excerpt:</p><pre>${transcript.slice(0, 2000)}</pre>`;
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const meetingRouter = router({
  // ── List meetings for the user's lab ──────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "all"]).optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const rows = await db
        .select()
        .from(qualityMeetings)
        .where(
          input.status && input.status !== "all"
            ? and(eq(qualityMeetings.orgId, orgId), eq(qualityMeetings.status, input.status))
            : eq(qualityMeetings.orgId, orgId)
        )
        .orderBy(desc(qualityMeetings.scheduledAt));
      return rows;
    }),

  // ── Get single meeting with attendees, recordings, transcripts ────────────
  get: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const [meeting] = await db
        .select()
        .from(qualityMeetings)
        .where(and(eq(qualityMeetings.id, input.meetingId), eq(qualityMeetings.orgId, orgId)));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const attendees = await db
        .select()
        .from(meetingAttendees)
        .where(eq(meetingAttendees.meetingId, input.meetingId));

      const recordings = await db
        .select()
        .from(meetingRecordings)
        .where(eq(meetingRecordings.meetingId, input.meetingId));

      const transcripts = await db
        .select()
        .from(meetingTranscripts)
        .where(eq(meetingTranscripts.meetingId, input.meetingId));

      const minutesDrafts = await db
        .select()
        .from(meetingMinutesDrafts)
        .where(eq(meetingMinutesDrafts.meetingId, input.meetingId))
        .orderBy(desc(meetingMinutesDrafts.createdAt));

      return { meeting, attendees, recordings, transcripts, minutesDrafts };
    }),

  // ── Create meeting ─────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(2).max(255),
      meetingType: z.enum(["quality_assurance", "peer_review", "accreditation", "staff_education", "policy_review", "other"]),
      scheduledAt: z.date(),
      durationMinutes: z.number().min(5).max(480).optional(),
      location: z.string().max(255).optional(),
      meetingLink: z.string().url().optional(),
      agenda: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const [result] = await db.insert(qualityMeetings).values({
        orgId,
        createdByUserId: ctx.user.id,
        title: input.title,
        meetingType: input.meetingType,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes ?? 60,
        location: input.location,
        meetingLink: input.meetingLink,
        agenda: input.agenda,
        status: "scheduled",
      });
      return { id: (result as any).insertId as number };
    }),

  // ── Update meeting ─────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      title: z.string().min(2).max(255).optional(),
      meetingType: z.enum(["quality_assurance", "peer_review", "accreditation", "staff_education", "policy_review", "other"]).optional(),
      scheduledAt: z.date().optional(),
      durationMinutes: z.number().min(5).max(480).optional(),
      location: z.string().max(255).optional(),
      meetingLink: z.string().url().optional().nullable(),
      agenda: z.string().optional(),
      status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const { meetingId, ...fields } = input;
      await db
        .update(qualityMeetings)
        .set(fields)
        .where(and(eq(qualityMeetings.id, meetingId), eq(qualityMeetings.orgId, orgId)));
      return { ok: true };
    }),

  // ── Delete meeting ─────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      await db
        .delete(qualityMeetings)
        .where(and(eq(qualityMeetings.id, input.meetingId), eq(qualityMeetings.orgId, orgId)));
      return { ok: true };
    }),

  // ── Add attendee ───────────────────────────────────────────────────────────
  addAttendee: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      name: z.string().min(1).max(255),
      email: z.string().email(),
      role: z.string().max(128).optional(),
      userId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const [meeting] = await db.select({ id: qualityMeetings.id })
        .from(qualityMeetings)
        .where(and(eq(qualityMeetings.id, input.meetingId), eq(qualityMeetings.orgId, orgId)));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const [result] = await db.insert(meetingAttendees).values({
        meetingId: input.meetingId,
        name: input.name,
        email: input.email,
        role: input.role,
        userId: input.userId,
        rsvpStatus: "pending",
        attendanceStatus: "unknown",
      });
      return { id: (result as any).insertId as number };
    }),

  // ── Remove attendee ────────────────────────────────────────────────────────
  removeAttendee: protectedProcedure
    .input(z.object({ attendeeId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(meetingAttendees).where(eq(meetingAttendees.id, input.attendeeId));
      return { ok: true };
    }),

  // ── Update attendance status ───────────────────────────────────────────────
  updateAttendance: protectedProcedure
    .input(z.object({
      attendeeId: z.number(),
      attendanceStatus: z.enum(["unknown", "present", "absent", "excused"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .update(meetingAttendees)
        .set({ attendanceStatus: input.attendanceStatus })
        .where(eq(meetingAttendees.id, input.attendeeId));
      return { ok: true };
    }),

  // ── Get upload URL for recording ───────────────────────────────────────────
  getRecordingUploadUrl: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      fileName: z.string(),
      mimeType: z.string(),
      fileSizeBytes: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const [meeting] = await db.select({ id: qualityMeetings.id })
        .from(qualityMeetings)
        .where(and(eq(qualityMeetings.id, input.meetingId), eq(qualityMeetings.orgId, orgId)));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const ext = input.fileName.split(".").pop() ?? "audio";
      const fileKey = `quality-meetings/${orgId}/${input.meetingId}/recordings/${randomSuffix()}.${ext}`;
      const { url } = await storagePut(fileKey, Buffer.alloc(0), input.mimeType);

      const [result] = await db.insert(meetingRecordings).values({
        meetingId: input.meetingId,
        uploadedByUserId: ctx.user.id,
        fileKey,
        fileUrl: url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        transcriptionStatus: "pending",
      });
      return { recordingId: (result as any).insertId as number, fileKey, uploadUrl: url };
    }),

  // ── Confirm recording upload and save final URL ────────────────────────────
  confirmRecordingUpload: protectedProcedure
    .input(z.object({
      recordingId: z.number(),
      fileUrl: z.string().url(),
      durationSeconds: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .update(meetingRecordings)
        .set({ fileUrl: input.fileUrl, durationSeconds: input.durationSeconds, transcriptionStatus: "pending" })
        .where(eq(meetingRecordings.id, input.recordingId));
      return { ok: true };
    }),

  // ── Transcribe a recording ─────────────────────────────────────────────────
  transcribeRecording: protectedProcedure
    .input(z.object({ recordingId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [recording] = await db
        .select()
        .from(meetingRecordings)
        .where(eq(meetingRecordings.id, input.recordingId));
      if (!recording) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(meetingRecordings)
        .set({ transcriptionStatus: "processing" })
        .where(eq(meetingRecordings.id, input.recordingId));

      try {
        const result = await transcribeAudio({
          audioUrl: recording.fileUrl,
          language: "en",
          prompt: "This is a medical quality assurance meeting. Transcribe accurately.",
        });

        if ("error" in result) {
          await db.update(meetingRecordings).set({ transcriptionStatus: "failed" }).where(eq(meetingRecordings.id, input.recordingId));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        }

        const [txResult] = await db.insert(meetingTranscripts).values({
          meetingId: recording.meetingId,
          recordingId: recording.id,
          fullText: result.text,
          language: result.language ?? "en",
          durationSeconds: result.duration ? Math.round(result.duration) : undefined,
          segmentsJson: result.segments ? JSON.stringify(result.segments) : undefined,
        });

        await db.update(meetingRecordings).set({ transcriptionStatus: "completed" }).where(eq(meetingRecordings.id, input.recordingId));
        return { transcriptId: (txResult as any).insertId as number, text: result.text };
      } catch (err) {
        await db.update(meetingRecordings).set({ transcriptionStatus: "failed" }).where(eq(meetingRecordings.id, input.recordingId));
        throw err;
      }
    }),

  // ── Generate AI meeting minutes from transcript ────────────────────────────
  generateMinutes: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const [meeting] = await db
        .select()
        .from(qualityMeetings)
        .where(and(eq(qualityMeetings.id, input.meetingId), eq(qualityMeetings.orgId, orgId)));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const [transcript] = await db
        .select()
        .from(meetingTranscripts)
        .where(eq(meetingTranscripts.meetingId, input.meetingId))
        .orderBy(desc(meetingTranscripts.createdAt));

      const attendees = await db
        .select({ name: meetingAttendees.name })
        .from(meetingAttendees)
        .where(eq(meetingAttendees.meetingId, input.meetingId));

      const transcriptText = transcript?.fullText ?? meeting.agenda ?? "";
      if (!transcriptText.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No transcript or agenda available to generate minutes from." });
      }

      const minutesHtml = await generateMinutesFromTranscript(
        meeting.title,
        meeting.agenda,
        transcriptText,
        attendees.map((a) => a.name)
      );

      const [result] = await db.insert(meetingMinutesDrafts).values({
        meetingId: input.meetingId,
        generatedByUserId: ctx.user.id,
        minutesHtml,
        isAiGenerated: true,
      });

      return { draftId: (result as any).insertId as number, minutesHtml };
    }),

  // ── Save/finalize meeting minutes ──────────────────────────────────────────
  saveMinutes: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      minutesHtml: z.string(),
      finalize: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const updates: Record<string, any> = { minutesHtml: input.minutesHtml };
      if (input.finalize) {
        updates.minutesFinalized = true;
        updates.minutesFinalizedAt = new Date();
        updates.status = "completed";
      }
      await db
        .update(qualityMeetings)
        .set(updates)
        .where(and(eq(qualityMeetings.id, input.meetingId), eq(qualityMeetings.orgId, orgId)));
      return { ok: true };
    }),

  // ── List finalized meetings (Minutes Archive) ────────────────────────────
  listFinalized: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      meetingType: z.enum(["quality_assurance", "peer_review", "accreditation", "staff_education", "policy_review", "other", "all"]).optional(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const rows = await db
        .select()
        .from(qualityMeetings)
        .where(
          and(
            eq(qualityMeetings.orgId, orgId),
            eq(qualityMeetings.minutesFinalized, true)
          )
        )
        .orderBy(desc(qualityMeetings.scheduledAt));
      // Filter in JS for search/type/year (small dataset)
      return rows.filter((m) => {
        if (input.meetingType && input.meetingType !== "all" && m.meetingType !== input.meetingType) return false;
        if (input.year && new Date(m.scheduledAt).getFullYear() !== input.year) return false;
        if (input.search) {
          const q = input.search.toLowerCase();
          if (!m.title.toLowerCase().includes(q) && !(m.agenda ?? "").toLowerCase().includes(q)) return false;
        }
        return true;
      });
    }),

  // ── Attendance analytics for DIY Reports ──────────────────────────────────
  getAttendanceStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const meetings = await db
        .select()
        .from(qualityMeetings)
        .where(and(eq(qualityMeetings.orgId, orgId), eq(qualityMeetings.status, "completed")))
        .orderBy(qualityMeetings.scheduledAt);
      const stats = await Promise.all(
        meetings.map(async (m) => {
          const attendees = await db
            .select({ status: meetingAttendees.attendanceStatus })
            .from(meetingAttendees)
            .where(eq(meetingAttendees.meetingId, m.id));
          const total = attendees.length;
          const present = attendees.filter((a) => a.status === "present").length;
          const absent = attendees.filter((a) => a.status === "absent").length;
          const excused = attendees.filter((a) => a.status === "excused").length;
          return {
            meetingId: m.id,
            title: m.title,
            meetingType: m.meetingType,
            scheduledAt: m.scheduledAt,
            total,
            present,
            absent,
            excused,
            attendanceRate: total > 0 ? Math.round((present / total) * 100) : null,
          };
        })
      );
      return stats;
    }),

  // ── Send email invitations ─────────────────────────────────────────────────
  sendInvitations: protectedProcedure
    .input(z.object({ meetingId: z.number(), attendeeIds: z.array(z.number()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const orgId = await getOrgId(ctx.user.id);
      const [meeting] = await db
        .select()
        .from(qualityMeetings)
        .where(and(eq(qualityMeetings.id, input.meetingId), eq(qualityMeetings.orgId, orgId)));
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });

      const attendees = await db
        .select()
        .from(meetingAttendees)
        .where(
          input.attendeeIds?.length
            ? and(eq(meetingAttendees.meetingId, input.meetingId), inArray(meetingAttendees.id, input.attendeeIds))
            : eq(meetingAttendees.meetingId, input.meetingId)
        );

      const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
      let sent = 0;
      const errors: string[] = [];

      for (const attendee of attendees) {
        const rsvpUrl = `${appUrl}/diy-accreditation?tab=meetings&meetingId=${meeting.id}&attendeeId=${attendee.id}`;
        const { subject, htmlBody } = buildMeetingInvitationEmail({
          recipientName: attendee.name,
          meetingTitle: meeting.title,
          meetingType: meeting.meetingType,
          scheduledAt: new Date(meeting.scheduledAt),
          durationMinutes: meeting.durationMinutes ?? 60,
          location: meeting.location,
          meetingLink: meeting.meetingLink ?? null,
          agenda: meeting.agenda,
          organizerName: ctx.user.name ?? "Lab Admin",
          appUrl,
          rsvpUrl,
        });
        const ok = await sendEmail({ to: { name: attendee.name, email: attendee.email }, subject, htmlBody });
        if (ok) {
          await db.update(meetingAttendees).set({ inviteSentAt: new Date() }).where(eq(meetingAttendees.id, attendee.id));
          sent++;
        } else {
          errors.push(attendee.email);
        }
      }

      return { sent, errors, total: attendees.length };
    }),
});
