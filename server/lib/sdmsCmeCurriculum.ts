/**
 * Auto-insert SDMS CME as a dedicated curriculum section + lesson (LMS courses/cohorts).
 */
import { and, asc, eq, max } from "drizzle-orm";
import {
  lmsLessons,
  lmsSections,
  sdmsCmeConfigs,
  type SdmsCmeActivityType,
  type SdmsCmeConfig,
} from "../../drizzle/schema";
import { getDb } from "../db";

export const CME_SECTION_TITLE = "SDMS CME Credit";
export const CME_LESSON_TITLE = "CME Post-Test & SDMS Submission";

export type CmeContentBlock = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

const LMS_CURRICULUM_TYPES: SdmsCmeActivityType[] = ["course", "cohort", "standalone_cme"];

export function isLmsCurriculumActivity(activityType: SdmsCmeActivityType): boolean {
  return LMS_CURRICULUM_TYPES.includes(activityType);
}

export function lessonTitleForFormKind(formKind: string | null | undefined): string {
  switch (formKind) {
    case "post_test":
      return "CME Post-Test";
    case "evaluation":
      return "CME Evaluation";
    case "attestation":
      return "CME Attestation";
    default:
      return CME_LESSON_TITLE;
  }
}

/** Build page-builder blocks for the dedicated CME lesson */
export function buildCmeLessonBlocks(config: Pick<
  SdmsCmeConfig,
  "id" | "activityType" | "activityId" | "activityTitle" | "cmeInstructions" | "moduleBlocks"
>): CmeContentBlock[] {
  if (config.moduleBlocks) {
    try {
      const custom = JSON.parse(config.moduleBlocks) as CmeContentBlock[];
      if (Array.isArray(custom) && custom.length > 0) {
        const hasCme = custom.some((b) => b.type === "sdms_cme_module");
        if (hasCme) return custom;
        return [...custom, buildSdmsCmeModuleBlock(config)];
      }
    } catch {
      /* fall through to default */
    }
  }

  const headline = config.activityTitle?.trim() || CME_SECTION_TITLE;
  const blocks: CmeContentBlock[] = [
    {
      id: `sdms-cme-hero-${config.id}`,
      type: "hero",
      data: {
        headline,
        headline2: "",
        subheadline: "Complete the required form to receive SDMS CME credit.",
        hideButtons: true,
        buttons: [],
        bgType: "color",
        bgColor: "#0d9488",
        textColor: "#ffffff",
        align: "left",
        heroMinHeight: 140,
      },
    },
  ];

  if (config.cmeInstructions?.trim()) {
    blocks.push({
      id: `sdms-cme-instructions-${config.id}`,
      type: "text",
      data: {
        content: config.cmeInstructions.trim(),
        bgColor: "#f0fdfa",
        textColor: "#134e4a",
      },
    });
  }

  blocks.push(buildSdmsCmeModuleBlock(config));
  return blocks;
}

export function buildSdmsCmeModuleBlock(config: Pick<SdmsCmeConfig, "id" | "activityType" | "activityId" | "activityTitle">): CmeContentBlock {
  return {
    id: `sdms-cme-module-${config.id}`,
    type: "sdms_cme_module",
    data: {
      activityType: config.activityType,
      activityId: config.activityId,
      headline: config.activityTitle?.trim() || CME_SECTION_TITLE,
    },
  };
}

function parseBlocks(raw: string | null | undefined): CmeContentBlock[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type EnsureCmeCurriculumResult = {
  sectionId: number;
  lessonId: number;
  createdSection: boolean;
  createdLesson: boolean;
};

/** Create or update dedicated section + lesson at end of course curriculum */
export async function ensureCmeCurriculumModule(config: SdmsCmeConfig): Promise<EnsureCmeCurriculumResult | null> {
  if (!config.enabled || !isLmsCurriculumActivity(config.activityType)) {
    return null;
  }

  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const courseId = config.activityId;
  const lessonTitle = lessonTitleForFormKind(config.formKind);
  const contentBlocks = JSON.stringify(buildCmeLessonBlocks(config));

  let sectionId = config.cmeSectionId ?? null;
  let lessonId = config.cmeLessonId ?? null;
  let createdSection = false;
  let createdLesson = false;

  if (sectionId) {
    const [section] = await db.select({ id: lmsSections.id }).from(lmsSections).where(eq(lmsSections.id, sectionId)).limit(1);
    if (!section) sectionId = null;
  }

  if (lessonId) {
    const [lesson] = await db
      .select({ id: lmsLessons.id, sectionId: lmsLessons.sectionId })
      .from(lmsLessons)
      .where(eq(lmsLessons.id, lessonId))
      .limit(1);
    if (!lesson) {
      lessonId = null;
    } else if (lesson.sectionId && lesson.sectionId !== sectionId) {
      sectionId = lesson.sectionId;
    }
  }

  if (!sectionId) {
    const existing = await findExistingCmeSection(db, courseId, config.id);
    sectionId = existing?.sectionId ?? null;
    lessonId = existing?.lessonId ?? lessonId;
  }

  if (!sectionId) {
    const posResult = await db
      .select({ maxPos: max(lmsSections.position) })
      .from(lmsSections)
      .where(eq(lmsSections.courseId, courseId));
    const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
    const [sectionResult] = await db
      .insert(lmsSections)
      .values({ courseId, title: CME_SECTION_TITLE, position: nextPosition })
      .$returningId();
    sectionId = sectionResult.id;
    createdSection = true;
  } else {
    await db.update(lmsSections).set({ title: CME_SECTION_TITLE }).where(eq(lmsSections.id, sectionId));
  }

  if (!lessonId) {
    const posResult = await db
      .select({ maxPos: max(lmsLessons.position) })
      .from(lmsLessons)
      .where(eq(lmsLessons.sectionId, sectionId));
    const nextPosition = (posResult[0]?.maxPos ?? -1) + 1;
    const [lessonResult] = await db
      .insert(lmsLessons)
      .values({
        courseId,
        sectionId,
        title: lessonTitle,
        type: "text",
        position: nextPosition,
        requireManualComplete: 1,
        contentBlocks,
        lessonStatus: "published",
      })
      .$returningId();
    lessonId = lessonResult.id;
    createdLesson = true;
  } else {
    await db
      .update(lmsLessons)
      .set({
        title: lessonTitle,
        sectionId,
        courseId,
        contentBlocks,
        lessonStatus: "published",
        requireManualComplete: 1,
      })
      .where(eq(lmsLessons.id, lessonId));
  }

  await db
    .update(sdmsCmeConfigs)
    .set({
      cmeSectionId: sectionId,
      cmeLessonId: lessonId,
      moduleBlocks: contentBlocks,
    })
    .where(eq(sdmsCmeConfigs.id, config.id));

  return { sectionId, lessonId, createdSection, createdLesson };
}

/** Hide CME lesson from learners when SDMS CME is disabled */
export async function hideCmeCurriculumModule(config: SdmsCmeConfig): Promise<void> {
  if (!config.cmeLessonId) return;
  const db = await getDb();
  if (!db) return;
  await db
    .update(lmsLessons)
    .set({ lessonStatus: "draft" })
    .where(eq(lmsLessons.id, config.cmeLessonId));
}

async function findExistingCmeSection(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  courseId: number,
  configId: number
): Promise<{ sectionId: number; lessonId: number } | null> {
  const lessons = await db
    .select({
      id: lmsLessons.id,
      sectionId: lmsLessons.sectionId,
      contentBlocks: lmsLessons.contentBlocks,
    })
    .from(lmsLessons)
    .where(eq(lmsLessons.courseId, courseId));

  for (const lesson of lessons) {
    const blocks = parseBlocks(lesson.contentBlocks);
    const cmeBlock = blocks.find((b) => b.type === "sdms_cme_module");
    if (cmeBlock) {
      const data = cmeBlock.data ?? {};
      if (data.activityId === courseId || cmeBlock.id === `sdms-cme-module-${configId}`) {
        return { sectionId: lesson.sectionId!, lessonId: lesson.id };
      }
    }
  }

  const [section] = await db
    .select({ id: lmsSections.id })
    .from(lmsSections)
    .where(and(eq(lmsSections.courseId, courseId), eq(lmsSections.title, CME_SECTION_TITLE)))
    .orderBy(asc(lmsSections.position))
    .limit(1);

  if (!section) return null;

  const [lesson] = await db
    .select({ id: lmsLessons.id })
    .from(lmsLessons)
    .where(eq(lmsLessons.sectionId, section.id))
    .orderBy(asc(lmsLessons.position))
    .limit(1);

  if (!lesson) return null;
  return { sectionId: section.id, lessonId: lesson.id };
}
