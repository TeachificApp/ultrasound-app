/**
 * careerNetworkRouter.ts
 * Career Network module — job listings, RSS/URL scraping, candidate profiles,
 * resumes, AI resume builder, and internal job postings.
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, or, like, desc, asc, isNull, sql, inArray, ne } from "drizzle-orm";
import { getDb } from "../db";
import {
  jobs,
  jobCategories,
  jobSources,
  candidateProfiles,
  resumes,
  jobApplications,
  careerNetworkSettings,
  users,
  employerProfiles,
  employerSubscriptions,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import axios from "axios";
import * as cheerio from "cheerio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertAdmin(role: string) {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

/** Parse an RSS feed XML string and return job-like items */
function parseRssFeed(xml: string): Array<{
  title: string; company: string; location: string; description: string;
  applyUrl: string; externalId: string; publishedAt: Date | null; salary: string;
}> {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: ReturnType<typeof parseRssFeed> = [];
  $("item, entry").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    const link = $el.find("link").first().text().trim() || $el.find("link").first().attr("href") || "";
    const description = $el.find("description, summary, content").first().text().trim();
    const pubDate = $el.find("pubDate, published, updated").first().text().trim();
    const guid = $el.find("guid, id").first().text().trim() || link;
    // Try to extract company from various RSS fields
    const company =
      $el.find("company, author, dc\\:creator").first().text().trim() ||
      $el.find("[name='company']").text().trim() ||
      "Unknown";
    const location = $el.find("location, georss\\:point").first().text().trim() || "";
    const salary = $el.find("salary, compensation").first().text().trim() || "";
    if (title) {
      items.push({
        title,
        company,
        location,
        description,
        applyUrl: link,
        externalId: guid,
        publishedAt: pubDate ? new Date(pubDate) : null,
        salary,
      });
    }
  });
  return items;
}

/** Scrape a web page for job listings using heuristics */
async function scrapeJobPage(url: string): Promise<Array<{
  title: string; company: string; location: string; description: string;
  applyUrl: string; externalId: string; publishedAt: Date | null; salary: string;
}>> {
  const resp = await axios.get(url, {
    timeout: 15000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UltrasoundAssistJobBot/1.0)" },
  });
  const $ = cheerio.load(resp.data);
  const items: ReturnType<typeof scrapeJobPage> = [];
  // Generic heuristic: look for job card patterns
  const selectors = [
    ".job-listing", ".job-card", ".job-post", "[data-job]",
    "article.job", ".position", ".opening", ".vacancy",
  ];
  for (const sel of selectors) {
    if ($(sel).length > 0) {
      $(sel).each((_, el) => {
        const $el = $(el);
        const title = $el.find("h1,h2,h3,h4,.title,.job-title").first().text().trim();
        const link = $el.find("a").first().attr("href") || url;
        const fullLink = link.startsWith("http") ? link : new URL(link, url).href;
        const company = $el.find(".company,.employer,.organization").first().text().trim() || "Unknown";
        const location = $el.find(".location,.city,.region").first().text().trim() || "";
        const description = $el.find(".description,.summary,.details,.body").first().text().trim() || "";
        const salary = $el.find(".salary,.compensation,.pay").first().text().trim() || "";
        if (title) {
          items.push({ title, company, location, description, applyUrl: fullLink, externalId: fullLink, publishedAt: null, salary });
        }
      });
      if (items.length > 0) break;
    }
  }
  return items;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const careerNetworkRouter = router({

  // ── Public: list jobs ──────────────────────────────────────────────────────
  listJobs: publicProcedure.input(z.object({
    search: z.string().optional(),
    categoryId: z.number().optional(),
    locationType: z.enum(["remote", "onsite", "hybrid"]).optional(),
    employmentType: z.enum(["full_time", "part_time", "contract", "per_diem", "travel", "prn"]).optional(),
    locationText: z.string().optional(), // city/state text filter
    isInternal: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    page: z.number().default(1),
    pageSize: z.number().min(1).max(50).default(20),
  })).query(async ({ input }) => {
    const db = await getDb();
    const offset = (input.page - 1) * input.pageSize;
    const conditions = [eq(jobs.status, "active")];
    if (input.categoryId) conditions.push(eq(jobs.categoryId, input.categoryId));
    if (input.locationType) conditions.push(eq(jobs.locationType, input.locationType));
    if (input.employmentType) conditions.push(eq(jobs.employmentType, input.employmentType));
    if (input.locationText) conditions.push(like(jobs.location, `%${input.locationText}%`));
    if (input.isInternal !== undefined) conditions.push(eq(jobs.isInternal, input.isInternal));
    if (input.isFeatured !== undefined) conditions.push(eq(jobs.isFeatured, input.isFeatured));
    if (input.search) {
      const q = `%${input.search}%`;
      conditions.push(or(like(jobs.title, q), like(jobs.company, q), like(jobs.location, q), like(jobs.description, q))!);
    }
    const [rows, countRows] = await Promise.all([
      db.select({
        id: jobs.id, title: jobs.title, company: jobs.company, companyLogoUrl: jobs.companyLogoUrl,
        location: jobs.location, locationType: jobs.locationType, employmentType: jobs.employmentType,
        salary: jobs.salary, salaryMin: jobs.salaryMin, salaryMax: jobs.salaryMax, salaryPeriod: jobs.salaryPeriod,
        categoryId: jobs.categoryId, tags: jobs.tags, isInternal: jobs.isInternal, isFeatured: jobs.isFeatured,
        applyUrl: jobs.applyUrl, applyEmail: jobs.applyEmail, publishedAt: jobs.publishedAt,
        viewCount: jobs.viewCount, applyCount: jobs.applyCount, expiresAt: jobs.expiresAt,
      }).from(jobs).where(and(...conditions)).orderBy(desc(jobs.isFeatured), desc(jobs.publishedAt)).limit(input.pageSize).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(and(...conditions)),
    ]);
    return { jobs: rows, total: countRows[0]?.count ?? 0, page: input.page, pageSize: input.pageSize };
  }),

  // ── Public: get single job ─────────────────────────────────────────────────
  getJob: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    const [job] = await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1);
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    // Increment view count
    await db.update(jobs).set({ viewCount: sql`${jobs.viewCount} + 1` }).where(eq(jobs.id, input.id));
    return job;
  }),

  // ── Public: list categories ────────────────────────────────────────────────
  listCategories: publicProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(jobCategories).orderBy(asc(jobCategories.sortOrder));
  }),

  // ── Public: career network settings ───────────────────────────────────────
  getSettings: publicProcedure.query(async () => {
    const db = await getDb();
    const [settings] = await db.select().from(careerNetworkSettings).limit(1);
    return settings ?? null;
  }),

  // ── Protected: apply to internal job ──────────────────────────────────────
  applyToJob: protectedProcedure.input(z.object({
    jobId: z.number(),
    resumeId: z.number().optional(),
    coverLetter: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const [job] = await db.select({ id: jobs.id, isInternal: jobs.isInternal, applyUrl: jobs.applyUrl }).from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    if (!job.isInternal) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the external apply link for this job" });
    const existing = await db.select({ id: jobApplications.id }).from(jobApplications)
      .where(and(eq(jobApplications.jobId, input.jobId), eq(jobApplications.userId, ctx.user.id))).limit(1);
    if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Already applied" });
    await db.insert(jobApplications).values({ jobId: input.jobId, userId: ctx.user.id, resumeId: input.resumeId, coverLetter: input.coverLetter });
    await db.update(jobs).set({ applyCount: sql`${jobs.applyCount} + 1` }).where(eq(jobs.id, input.jobId));
    return { ok: true };
  }),

  // ── Protected: candidate profile ──────────────────────────────────────────
  getMyCandidateProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const [profile] = await db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, ctx.user.id)).limit(1);
    return profile ?? null;
  }),

  saveCandidateProfile: protectedProcedure.input(z.object({
    headline: z.string().max(300).optional(),
    bio: z.string().optional(),
    location: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    linkedinUrl: z.string().url().optional().or(z.literal("")),
    portfolioUrl: z.string().url().optional().or(z.literal("")),
    yearsExperience: z.number().min(0).max(60).optional(),
    specialties: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    availability: z.enum(["immediately", "2_weeks", "1_month", "3_months", "not_looking"]).optional(),
    desiredSalary: z.string().max(100).optional(),
    desiredLocationType: z.enum(["remote", "onsite", "hybrid", "any"]).optional(),
    isPublic: z.boolean().optional(),
    openToTravel: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const existing = await db.select({ id: candidateProfiles.id }).from(candidateProfiles).where(eq(candidateProfiles.userId, ctx.user.id)).limit(1);
    const data = {
      ...input,
      specialties: input.specialties ? JSON.stringify(input.specialties) : undefined,
      certifications: input.certifications ? JSON.stringify(input.certifications) : undefined,
    };
    if (existing.length > 0) {
      await db.update(candidateProfiles).set(data).where(eq(candidateProfiles.userId, ctx.user.id));
    } else {
      await db.insert(candidateProfiles).values({ userId: ctx.user.id, ...data });
    }
    return { ok: true };
  }),

  // ── Protected: resumes ────────────────────────────────────────────────────
  getMyResumes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return db.select().from(resumes).where(eq(resumes.userId, ctx.user.id)).orderBy(desc(resumes.isPrimary), desc(resumes.createdAt));
  }),

  saveResume: protectedProcedure.input(z.object({
    id: z.number().optional(),
    name: z.string().min(1).max(200),
    content: z.string().optional(),
    contentJson: z.string().optional(),
    isAiGenerated: z.boolean().optional(),
    isPrimary: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (input.isPrimary) {
      await db.update(resumes).set({ isPrimary: false }).where(eq(resumes.userId, ctx.user.id));
    }
    if (input.id) {
      const [existing] = await db.select({ userId: resumes.userId }).from(resumes).where(eq(resumes.id, input.id)).limit(1);
      if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(resumes).set({ name: input.name, content: input.content, contentJson: input.contentJson, isAiGenerated: input.isAiGenerated, isPrimary: input.isPrimary }).where(eq(resumes.id, input.id));
      return { id: input.id };
    } else {
      const [result] = await db.insert(resumes).values({ userId: ctx.user.id, name: input.name, content: input.content, contentJson: input.contentJson, isAiGenerated: input.isAiGenerated ?? false, isPrimary: input.isPrimary ?? false });
      return { id: (result as { insertId: number }).insertId };
    }
  }),

  deleteResume: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const [existing] = await db.select({ userId: resumes.userId }).from(resumes).where(eq(resumes.id, input.id)).limit(1);
    if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    await db.delete(resumes).where(eq(resumes.id, input.id));
    return { ok: true };
  }),

  uploadResumePdf: protectedProcedure.input(z.object({
    fileName: z.string(),
    fileBase64: z.string(),
    mimeType: z.string().default("application/pdf"),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const buffer = Buffer.from(input.fileBase64, "base64");
    const key = `resumes/${ctx.user.id}/${Date.now()}-${randomSuffix()}.pdf`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    const [result] = await db.insert(resumes).values({ userId: ctx.user.id, name: input.fileName, fileUrl: url, fileKey: key, isAiGenerated: false, isPrimary: false });
    return { id: (result as { insertId: number }).insertId, url };
  }),

  // ── Protected: AI resume builder ──────────────────────────────────────────
  buildResumeWithAi: protectedProcedure.input(z.object({
    currentRole: z.string().optional(),
    yearsExperience: z.number().optional(),
    specialties: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    education: z.string().optional(),
    workHistory: z.string().optional(),
    targetJobTitle: z.string().optional(),
    targetJobDescription: z.string().optional(),
    additionalInfo: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const systemPrompt = `You are an expert resume writer specializing in healthcare and medical imaging careers (sonography, echocardiography, vascular technology, POCUS, radiology). Create a professional, ATS-optimized resume in structured JSON format. Use strong action verbs, quantify achievements where possible, and tailor content to the target role if provided.`;
    const userPrompt = `Create a professional resume for a healthcare imaging professional with these details:
Current Role: ${input.currentRole || "Sonographer/Ultrasound Professional"}
Years of Experience: ${input.yearsExperience || "Not specified"}
Specialties: ${input.specialties?.join(", ") || "General Ultrasound"}
Certifications: ${input.certifications?.join(", ") || "Not specified"}
Education: ${input.education || "Not specified"}
Work History: ${input.workHistory || "Not provided"}
Target Job Title: ${input.targetJobTitle || "Sonographer"}
Target Job Description: ${input.targetJobDescription || "Not provided"}
Additional Info: ${input.additionalInfo || "None"}

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence professional summary",
  "skills": ["skill1", "skill2", ...],
  "experience": [{"title": "", "company": "", "dates": "", "bullets": ["...", "..."]}],
  "education": [{"degree": "", "institution": "", "year": ""}],
  "certifications": [{"name": "", "issuer": "", "year": ""}],
  "keywords": ["ats keyword1", ...]
}`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "resume_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              skills: { type: "array", items: { type: "string" } },
              experience: { type: "array", items: { type: "object", properties: { title: { type: "string" }, company: { type: "string" }, dates: { type: "string" }, bullets: { type: "array", items: { type: "string" } } }, required: ["title", "company", "dates", "bullets"], additionalProperties: false } },
              education: { type: "array", items: { type: "object", properties: { degree: { type: "string" }, institution: { type: "string" }, year: { type: "string" } }, required: ["degree", "institution", "year"], additionalProperties: false } },
              certifications: { type: "array", items: { type: "object", properties: { name: { type: "string" }, issuer: { type: "string" }, year: { type: "string" } }, required: ["name", "issuer", "year"], additionalProperties: false } },
              keywords: { type: "array", items: { type: "string" } },
            },
            required: ["summary", "skills", "experience", "education", "certifications", "keywords"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    // Save as a new resume
    const db = await getDb();
    const [result] = await db.insert(resumes).values({
      userId: ctx.user.id,
      name: `AI Resume — ${input.targetJobTitle || "General"} (${new Date().toLocaleDateString()})`,
      contentJson: content,
      content: buildResumeText(parsed),
      isAiGenerated: true,
      isPrimary: false,
    });
    return { id: (result as { insertId: number }).insertId, resume: parsed };
  }),

  // ── Admin: job sources (RSS/URL feeds) ────────────────────────────────────
  adminListSources: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    return db.select().from(jobSources).orderBy(desc(jobSources.createdAt));
  }),

  adminSaveSource: protectedProcedure.input(z.object({
    id: z.number().optional(),
    name: z.string().min(1).max(200),
    type: z.enum(["rss", "url"]),
    url: z.string().url(),
    categoryId: z.number().optional(),
    isActive: z.boolean().default(true),
    fetchIntervalHours: z.number().min(1).max(168).default(6),
  })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    if (input.id) {
      await db.update(jobSources).set({ name: input.name, type: input.type, url: input.url, categoryId: input.categoryId, isActive: input.isActive, fetchIntervalHours: input.fetchIntervalHours }).where(eq(jobSources.id, input.id));
      return { id: input.id };
    } else {
      const [result] = await db.insert(jobSources).values({ name: input.name, type: input.type, url: input.url, categoryId: input.categoryId, isActive: input.isActive, fetchIntervalHours: input.fetchIntervalHours });
      return { id: (result as { insertId: number }).insertId };
    }
  }),

  adminDeleteSource: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    await db.delete(jobSources).where(eq(jobSources.id, input.id));
    return { ok: true };
  }),

  // ── Admin: trigger fetch for a source ─────────────────────────────────────
  adminFetchSource: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    const [source] = await db.select().from(jobSources).where(eq(jobSources.id, input.id)).limit(1);
    if (!source) throw new TRPCError({ code: "NOT_FOUND" });
    let items: Array<{ title: string; company: string; location: string; description: string; applyUrl: string; externalId: string; publishedAt: Date | null; salary: string }> = [];
    let errorMsg: string | null = null;
    try {
      if (source.type === "rss") {
        const resp = await axios.get(source.url, { timeout: 15000, headers: { "User-Agent": "UltrasoundAssistJobBot/1.0" } });
        items = parseRssFeed(resp.data);
      } else {
        items = await scrapeJobPage(source.url);
      }
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }
    let newCount = 0;
    for (const item of items) {
      const existing = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.sourceId, source.id), eq(jobs.externalId, item.externalId))).limit(1);
      if (existing.length === 0) {
        await db.insert(jobs).values({
          sourceId: source.id,
          externalId: item.externalId,
          title: item.title,
          company: item.company,
          location: item.location,
          description: item.description,
          applyUrl: item.applyUrl,
          salary: item.salary,
          categoryId: source.categoryId,
          status: "active",
          isInternal: false,
          publishedAt: item.publishedAt ?? new Date(),
        });
        newCount++;
      }
    }
    await db.update(jobSources).set({ lastFetchedAt: new Date(), totalFetched: sql`${jobSources.totalFetched} + ${newCount}`, lastError: errorMsg }).where(eq(jobSources.id, source.id));
    return { fetched: items.length, newJobs: newCount, error: errorMsg };
  }),

  // ── Admin: manage jobs ────────────────────────────────────────────────────
  adminListJobs: protectedProcedure.input(z.object({
    search: z.string().optional(),
    status: z.enum(["active", "expired", "draft", "closed"]).optional(),
    isInternal: z.boolean().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(30),
  })).query(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    const offset = (input.page - 1) * input.pageSize;
    const conditions = [];
    if (input.status) conditions.push(eq(jobs.status, input.status));
    if (input.isInternal !== undefined) conditions.push(eq(jobs.isInternal, input.isInternal));
    if (input.search) {
      const q = `%${input.search}%`;
      conditions.push(or(like(jobs.title, q), like(jobs.company, q))!);
    }
    const [rows, countRows] = await Promise.all([
      db.select().from(jobs).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(jobs.createdAt)).limit(input.pageSize).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);
    return { jobs: rows, total: countRows[0]?.count ?? 0 };
  }),

  adminSaveJob: protectedProcedure.input(z.object({
    id: z.number().optional(),
    title: z.string().min(1).max(500),
    company: z.string().min(1).max(300),
    companyLogoUrl: z.string().url().optional().or(z.literal("")),
    location: z.string().max(300).optional(),
    locationType: z.enum(["remote", "onsite", "hybrid"]).optional(),
    employmentType: z.enum(["full_time", "part_time", "contract", "per_diem", "travel", "prn"]).optional(),
    description: z.string().optional(),
    descriptionHtml: z.string().optional(),
    applyUrl: z.string().url().optional().or(z.literal("")),
    applyEmail: z.string().email().optional().or(z.literal("")),
    salary: z.string().max(200).optional(),
    salaryMin: z.number().optional(),
    salaryMax: z.number().optional(),
    salaryPeriod: z.enum(["hourly", "daily", "weekly", "annual"]).optional(),
    categoryId: z.number().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(["active", "expired", "draft", "closed"]).optional(),
    isInternal: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    expiresAt: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    const data = {
      ...input,
      tags: input.tags ? JSON.stringify(input.tags) : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      postedById: ctx.user.id,
    };
    if (input.id) {
      await db.update(jobs).set(data).where(eq(jobs.id, input.id));
      return { id: input.id };
    } else {
      const [result] = await db.insert(jobs).values({ ...data, isInternal: true });
      return { id: (result as { insertId: number }).insertId };
    }
  }),

  adminDeleteJob: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    await db.delete(jobs).where(eq(jobs.id, input.id));
    return { ok: true };
  }),

  // ── Admin: categories ─────────────────────────────────────────────────────
  adminSaveCategory: protectedProcedure.input(z.object({
    id: z.number().optional(),
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    color: z.string().optional(),
    icon: z.string().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    if (input.id) {
      await db.update(jobCategories).set({ name: input.name, slug: input.slug, color: input.color, icon: input.icon, sortOrder: input.sortOrder }).where(eq(jobCategories.id, input.id));
      return { id: input.id };
    } else {
      const [result] = await db.insert(jobCategories).values({ name: input.name, slug: input.slug, color: input.color, icon: input.icon, sortOrder: input.sortOrder });
      return { id: (result as { insertId: number }).insertId };
    }
  }),

  adminDeleteCategory: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    await db.delete(jobCategories).where(eq(jobCategories.id, input.id));
    return { ok: true };
  }),

  // ── Admin: settings ───────────────────────────────────────────────────────
  adminSaveSettings: protectedProcedure.input(z.object({
    heroTitle: z.string().max(300).optional(),
    heroSubtitle: z.string().optional(),
    heroImageUrl: z.string().url().optional().or(z.literal("")),
    featuredBannerHtml: z.string().optional(),
    seoTitle: z.string().max(300).optional(),
    seoDescription: z.string().optional(),
    showCandidateProfiles: z.boolean().optional(),
    allowGuestApply: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    await db.update(careerNetworkSettings).set(input).where(eq(careerNetworkSettings.id, 1));
    return { ok: true };
  }),

  // ── Admin: candidate browser ──────────────────────────────────────────────
  adminListCandidates: protectedProcedure.input(z.object({
    search: z.string().optional(),
    availability: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(20),
  })).query(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    const offset = (input.page - 1) * input.pageSize;
    const conditions = [eq(candidateProfiles.isPublic, true)];
    if (input.availability) conditions.push(eq(candidateProfiles.availability, input.availability as "immediately" | "2_weeks" | "1_month" | "3_months" | "not_looking"));
    if (input.search) {
      const q = `%${input.search}%`;
      conditions.push(or(like(candidateProfiles.headline, q), like(candidateProfiles.bio, q), like(candidateProfiles.specialties, q))!);
    }
    const rows = await db.select({
      id: candidateProfiles.id,
      userId: candidateProfiles.userId,
      headline: candidateProfiles.headline,
      location: candidateProfiles.location,
      yearsExperience: candidateProfiles.yearsExperience,
      specialties: candidateProfiles.specialties,
      certifications: candidateProfiles.certifications,
      availability: candidateProfiles.availability,
      desiredSalary: candidateProfiles.desiredSalary,
      desiredLocationType: candidateProfiles.desiredLocationType,
      userName: users.name,
      userEmail: users.email,
      userAvatar: users.avatarUrl,
    }).from(candidateProfiles).leftJoin(users, eq(candidateProfiles.userId, users.id)).where(and(...conditions)).orderBy(desc(candidateProfiles.updatedAt)).limit(input.pageSize).offset(offset);
    return rows;
  }),

  // ── Admin: applications ───────────────────────────────────────────────────
  adminListApplications: protectedProcedure.input(z.object({
    jobId: z.number().optional(),
    status: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(20),
  })).query(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    const offset = (input.page - 1) * input.pageSize;
    const conditions = [];
    if (input.jobId) conditions.push(eq(jobApplications.jobId, input.jobId));
    if (input.status) conditions.push(eq(jobApplications.status, input.status as "submitted" | "reviewing" | "interview" | "offer" | "rejected" | "withdrawn"));
    const rows = await db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      userId: jobApplications.userId,
      resumeId: jobApplications.resumeId,
      coverLetter: jobApplications.coverLetter,
      status: jobApplications.status,
      notes: jobApplications.notes,
      createdAt: jobApplications.createdAt,
      userName: users.name,
      userEmail: users.email,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
    }).from(jobApplications)
      .leftJoin(users, eq(jobApplications.userId, users.id))
      .leftJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobApplications.createdAt))
      .limit(input.pageSize).offset(offset);
    return rows;
  }),

  adminUpdateApplicationStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["submitted", "reviewing", "interview", "offer", "rejected", "withdrawn"]),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    assertAdmin(ctx.user.role);
    const db = await getDb();
    await db.update(jobApplications).set({ status: input.status, notes: input.notes }).where(eq(jobApplications.id, input.id));
    return { ok: true };
  }),

  // ── Protected: my applications ────────────────────────────────────────────
  getMyApplications: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      status: jobApplications.status,
      createdAt: jobApplications.createdAt,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
      jobLocation: jobs.location,
    }).from(jobApplications)
      .leftJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .where(eq(jobApplications.userId, ctx.user.id))
      .orderBy(desc(jobApplications.createdAt));
  }),

  // ── Employer: create checkout for single job post ($39) ─────────────────────
  createJobPostCheckout: protectedProcedure.mutation(async ({ ctx }) => {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
    const origin = ctx.req.headers.origin || `https://${ctx.req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: ctx.user.email ?? undefined,
      client_reference_id: ctx.user.id.toString(),
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "Job Post — Ultrasound Career Network",
            description: "Post one job listing for 30 days on the Ultrasound Career Network",
          },
          unit_amount: 3900, // $39.00
        },
        quantity: 1,
      }],
      metadata: {
        type: "employer_job_post",
        user_id: ctx.user.id.toString(),
        customer_email: ctx.user.email ?? "",
        customer_name: ctx.user.name ?? "",
      },
      success_url: `${origin}/employer/dashboard?success=job_post`,
      cancel_url: `${origin}/career-network`,
    });
    return { checkoutUrl: session.url };
  }),

  // ── Employer: create checkout for monthly subscription ($199/mo) ─────────────
  createEmployerSubscriptionCheckout: protectedProcedure.mutation(async ({ ctx }) => {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
    const origin = ctx.req.headers.origin || `https://${ctx.req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: ctx.user.email ?? undefined,
      client_reference_id: ctx.user.id.toString(),
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "Employer Subscription — Ultrasound Career Network",
            description: "Unlimited job posts + full candidate/resume database access",
          },
          unit_amount: 19900, // $199.00
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      metadata: {
        type: "employer_subscription",
        user_id: ctx.user.id.toString(),
        customer_email: ctx.user.email ?? "",
        customer_name: ctx.user.name ?? "",
      },
      success_url: `${origin}/employer/dashboard?success=subscription`,
      cancel_url: `${origin}/career-network`,
    });
    return { checkoutUrl: session.url };
  }),

  // ── Employer: get my employer profile ─────────────────────────────────────
  getMyEmployerProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const [profile] = await db.select().from(employerProfiles).where(eq(employerProfiles.userId, ctx.user.id)).limit(1);
    if (!profile) return null;
    // Check active unlimited subscription
    const [sub] = await db.select().from(employerSubscriptions)
      .where(and(eq(employerSubscriptions.employerId, profile.id), eq(employerSubscriptions.status, "active"), eq(employerSubscriptions.plan, "unlimited")))
      .limit(1);
    // Check job post credits
    const [creditSub] = await db.select().from(employerSubscriptions)
      .where(and(eq(employerSubscriptions.employerId, profile.id), eq(employerSubscriptions.plan, "job_post"), sql`${employerSubscriptions.jobCredits} > 0`))
      .limit(1);
    return { ...profile, hasActiveSubscription: !!sub, subscription: sub ?? null, jobPostCredits: creditSub?.jobCredits ?? 0 };
  }),

  // ── Employer: upsert employer profile ─────────────────────────────────────
  upsertEmployerProfile: protectedProcedure.input(z.object({
    companyName: z.string().min(1).max(200),
    companyWebsite: z.string().url().optional().or(z.literal("")),
    companyDescription: z.string().max(2000).optional(),
    companyLogoUrl: z.string().url().optional().or(z.literal("")),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactName: z.string().max(200).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const [existing] = await db.select().from(employerProfiles).where(eq(employerProfiles.userId, ctx.user.id)).limit(1);
    if (existing) {
      await db.update(employerProfiles).set({
        companyName: input.companyName,
        website: input.companyWebsite || null,
        description: input.companyDescription || null,
        companyLogoUrl: input.companyLogoUrl || null,
      }).where(eq(employerProfiles.id, existing.id));
      return { id: existing.id };
    }
    const [inserted] = await db.insert(employerProfiles).values({
      userId: ctx.user.id,
      companyName: input.companyName,
      website: input.companyWebsite || null,
      description: input.companyDescription || null,
      companyLogoUrl: input.companyLogoUrl || null,
    }).$returningId();
    return { id: inserted.id };
  }),

    // ── Employer: list my posted jobs ─────────────────────────────────────────
  getMyPostedJobs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const [profile] = await db.select().from(employerProfiles).where(eq(employerProfiles.userId, ctx.user.id)).limit(1);
    if (!profile) return [];
    return db.select().from(jobs).where(eq(jobs.employerId, profile.id)).orderBy(desc(jobs.createdAt));
  }),

  // ── Employer: browse candidate profiles (subscription required) ────────────
  listCandidates: protectedProcedure.input(z.object({
    page: z.number().default(1),
    pageSize: z.number().default(20),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    // Check if the user has an active employer subscription
    const [profile] = await db.select().from(employerProfiles).where(eq(employerProfiles.userId, ctx.user.id)).limit(1);
    if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Employer profile required" });
    const [sub] = await db.select().from(employerSubscriptions)
      .where(and(eq(employerSubscriptions.employerId, profile.id), eq(employerSubscriptions.status, "active")))
      .limit(1);
    if (!sub) throw new TRPCError({ code: "FORBIDDEN", message: "Active employer subscription required to browse candidates" });
    const offset = (input.page - 1) * input.pageSize;
    return db.select().from(candidateProfiles)
      .limit(input.pageSize).offset(offset)
      .orderBy(desc(candidateProfiles.updatedAt));
  }),

  // ── Employer: post a job (requires active subscription OR credits from single post) ───
  createJob: protectedProcedure.input(z.object({
    title: z.string().min(1).max(300),
    company: z.string().max(200).optional(),
    location: z.string().max(200).optional(),
    locationType: z.enum(["remote", "onsite", "hybrid"]).optional(),
    employmentType: z.enum(["full_time", "part_time", "contract", "per_diem", "travel", "prn"]).optional(),
    salary: z.string().max(200).optional(),
    description: z.string().min(1),
    applyUrl: z.string().url().optional(),
    applyEmail: z.string().email().optional(),
    categoryId: z.number().optional(),
    tags: z.string().max(500).optional(),
    isInternal: z.boolean().default(false),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const [profile] = await db.select().from(employerProfiles).where(eq(employerProfiles.userId, ctx.user.id)).limit(1);
    if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Please create an employer profile first" });
    // Check subscription or job post credits
    const [sub] = await db.select().from(employerSubscriptions)
      .where(and(eq(employerSubscriptions.employerId, profile.id), eq(employerSubscriptions.status, "active"), eq(employerSubscriptions.plan, "unlimited")))
      .limit(1);
    if (!sub) {
      // Check if they have a paid single-post credit (job_post plan with jobCredits > 0)
      const [creditSub] = await db.select().from(employerSubscriptions)
        .where(and(eq(employerSubscriptions.employerId, profile.id), eq(employerSubscriptions.plan, "job_post"), sql`${employerSubscriptions.jobCredits} > 0`))
        .limit(1);
      if (!creditSub) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Please purchase a job post or subscribe to post jobs" });
      }
      // Deduct one credit
      await db.update(employerSubscriptions).set({ jobCredits: (creditSub.jobCredits ?? 1) - 1 }).where(eq(employerSubscriptions.id, creditSub.id));
    }
    const [inserted] = await db.insert(jobs).values({
      title: input.title,
      company: input.company || profile.companyName,
      location: input.location || null,
      locationType: input.locationType || "onsite",
      employmentType: input.employmentType || "full_time",
      salary: input.salary || null,
      description: input.description,
      applyUrl: input.applyUrl || null,
      applyEmail: input.applyEmail || null,
      categoryId: input.categoryId || null,
      tags: input.tags || null,
      isInternal: input.isInternal,
      status: "active",
      postedById: ctx.user.id,
      employerId: profile.id,
      sourceId: null,
    }).$returningId();
    return { id: inserted.id };
  }),
});
// ─── Helper: build plain text resume from JSON ────────────────────────────────
function buildResumeText(r: { summary?: string; skills?: string[]; experience?: Array<{ title: string; company: string; dates: string; bullets: string[] }>; education?: Array<{ degree: string; institution: string; year: string }>; certifications?: Array<{ name: string; issuer: string; year: string }> }): string {
  const lines: string[] = [];
  if (r.summary) { lines.push("PROFESSIONAL SUMMARY", r.summary, ""); }
  if (r.skills?.length) { lines.push("SKILLS", r.skills.join(" • "), ""); }
  if (r.experience?.length) {
    lines.push("EXPERIENCE");
    for (const e of r.experience) {
      lines.push(`${e.title} — ${e.company} (${e.dates})`);
      for (const b of e.bullets) lines.push(`• ${b}`);
      lines.push("");
    }
  }
  if (r.education?.length) {
    lines.push("EDUCATION");
    for (const e of r.education) lines.push(`${e.degree}, ${e.institution} (${e.year})`);
    lines.push("");
  }
  if (r.certifications?.length) {
    lines.push("CERTIFICATIONS");
    for (const c of r.certifications) lines.push(`${c.name} — ${c.issuer} (${c.year})`);
  }
  return lines.join("\n");
}
