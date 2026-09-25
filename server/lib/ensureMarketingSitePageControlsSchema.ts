import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * CMS page columns added by the public-site migrations. Railway can receive
 * application code before a prior additive migration is fully applied, so
 * both the blog sidebar fields (0082) and page-control fields (0083) are
 * assured at startup. Every statement is additive and existing public-site
 * content is never inserted, updated, or deleted here.
 */
const REQUIRED_COLUMNS: Record<string, string> = {
  parentId: "INT NULL",
  hideInNavigation: "TINYINT(1) NOT NULL DEFAULT 0",
  visibility: "ENUM('public','site_password','members_or_groups') NOT NULL DEFAULT 'public'",
  sitePasswordHash: "VARCHAR(128) NULL",
  headerType: "ENUM('standard','splash','no_header') NOT NULL DEFAULT 'standard'",
  seoKeywords: "TEXT NULL",
  headerCode: "LONGTEXT NULL",
  footerCode: "LONGTEXT NULL",
  hideFromSearch: "TINYINT(1) NOT NULL DEFAULT 0",
  blogSidebarMode: "ENUM('inherit','override') NOT NULL DEFAULT 'inherit'",
  blogSidebarBlocks: "LONGTEXT NULL",
};

const PAGE_TREE_INDEX = "marketing_site_pages_site_parent_order_idx";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAlreadyApplied(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return message.includes("duplicate column") || message.includes("duplicate key") || message.includes("already exists");
}

async function currentColumns(db: Db) {
  const result = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketingSitePages'
  `);
  return new Set(extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result)
    .map((row) => row.COLUMN_NAME ?? row.column_name).filter(Boolean) as string[]);
}

async function hasPageTreeIndex(db: Db) {
  const result = await db.execute(sql`
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketingSitePages' AND INDEX_NAME = ${PAGE_TREE_INDEX}
  `);
  return extractExecuteRows<{ INDEX_NAME?: string; index_name?: string }>(result)
    .some((row) => (row.INDEX_NAME ?? row.index_name) === PAGE_TREE_INDEX);
}

export async function ensureMarketingSitePageControlsSchema(db: Db | null | undefined): Promise<{
  applied: string[];
  missingBefore: string[];
  error?: string;
}> {
  if (!db) return { applied: [], missingBefore: [], error: "Database unavailable" };
  try {
    const columns = await currentColumns(db);
    const missingBefore = Object.keys(REQUIRED_COLUMNS).filter((column) => !columns.has(column));
    const applied: string[] = [];
    for (const column of missingBefore) {
      try {
        await db.execute(sql.raw(`ALTER TABLE \`marketingSitePages\` ADD COLUMN \`${column}\` ${REQUIRED_COLUMNS[column]}`));
        applied.push(column);
      } catch (error) {
        if (!isAlreadyApplied(error)) throw error;
      }
    }
    if (!await hasPageTreeIndex(db)) {
      try {
        await db.execute(sql.raw(`CREATE INDEX \`${PAGE_TREE_INDEX}\` ON \`marketingSitePages\` (\`siteKey\`, \`parentId\`, \`sortOrder\`)`));
        applied.push(PAGE_TREE_INDEX);
      } catch (error) {
        if (!isAlreadyApplied(error)) throw error;
      }
    }
    if (applied.length) console.log("[ensureMarketingSitePageControlsSchema] Applied", applied.join(", "));
    return { applied, missingBefore };
  } catch (error) {
    const message = errorMessage(error);
    console.error("[ensureMarketingSitePageControlsSchema]", message);
    return { applied: [], missingBefore: [], error: message };
  }
}
