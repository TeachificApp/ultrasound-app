import xml2js from "xml2js";

export interface ScormManifest {
  version: "1.2" | "2004" | null;
  title: string;
  description: string;
  entryPoint: string;
  organizations: ScormOrg[];
  resources: ScormResource[];
  raw: Record<string, unknown>;
}

export interface ScormOrg {
  identifier: string;
  title: string;
  items: ScormItem[];
}

export interface ScormItem {
  identifier: string;
  title: string;
  resourceRef?: string;
  children: ScormItem[];
}

export interface ScormResource {
  identifier: string;
  type: string;
  href?: string;
  files: string[];
}

const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: false });

function safeGet(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const key of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function safeStr(obj: unknown, ...keys: string[]): string {
  const val = safeGet(obj, ...keys);
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val ?? "");
}

function parseItems(items: unknown[]): ScormItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const attrs = safeGet(item, "$") as Record<string, string> | undefined;
    const title = safeStr(item, "title", "0") || safeStr(item, "adlcp:title", "0") || "";
    const children = safeGet(item, "item") as unknown[] | undefined;
    return {
      identifier: attrs?.identifier ?? "",
      title,
      resourceRef: attrs?.identifierref,
      children: children ? parseItems(children) : [],
    };
  });
}

export async function parseScormManifest(xmlContent: string): Promise<ScormManifest | null> {
  try {
    const result = await parser.parseStringPromise(xmlContent);
    const manifest = result?.manifest;
    if (!manifest) return null;

    // Detect SCORM version from schema
    const metadata = safeGet(manifest, "metadata", "0");
    const schemaVersion = safeStr(metadata, "schemaversion", "0").toLowerCase();
    const schema = safeStr(metadata, "schema", "0").toLowerCase();

    let version: "1.2" | "2004" | null = null;
    if (schema.includes("1.2") || schemaVersion.includes("1.2")) {
      version = "1.2";
    } else if (schema.includes("2004") || schemaVersion.includes("2004") || schemaVersion.includes("cam 1.3")) {
      version = "2004";
    } else {
      // Try namespace detection
      const nsAttrs = safeGet(manifest, "$") as Record<string, string> | undefined;
      const nsStr = JSON.stringify(nsAttrs ?? {}).toLowerCase();
      if (nsStr.includes("2004")) version = "2004";
      else if (nsStr.includes("1.2") || nsStr.includes("adlcp")) version = "1.2";
    }

    // Parse organizations
    const orgsRaw = safeGet(manifest, "organizations", "0", "organization") as unknown[] | undefined;
    const parsedOrgs: ScormOrg[] = (orgsRaw ?? []).map((org) => {
      const attrs = safeGet(org, "$") as Record<string, string> | undefined;
      const title = safeStr(org, "title", "0");
      const items = safeGet(org, "item") as unknown[] | undefined;
      return {
        identifier: attrs?.identifier ?? "",
        title,
        items: items ? parseItems(items) : [],
      };
    });

    // Parse resources
    const resourcesRaw = safeGet(manifest, "resources", "0", "resource") as unknown[] | undefined;
    const parsedResources: ScormResource[] = (resourcesRaw ?? []).map((res) => {
      const attrs = safeGet(res, "$") as Record<string, string> | undefined;
      const filesRaw = safeGet(res, "file") as unknown[] | undefined;
      const files = (filesRaw ?? []).map((f) => {
        const fa = safeGet(f, "$") as Record<string, string> | undefined;
        return fa?.href ?? "";
      }).filter(Boolean);
      return {
        identifier: attrs?.identifier ?? "",
        type: attrs?.type ?? "",
        href: attrs?.href,
        files,
      };
    });

    // Find entry point: first resource with an href that is a launch file
    let entryPoint = "";
    const defaultOrgId = safeStr(safeGet(manifest, "organizations", "0"), "$.default");
    const defaultOrg = parsedOrgs.find((o) => o.identifier === defaultOrgId) ?? parsedOrgs[0];
    if (defaultOrg?.items[0]?.resourceRef) {
      const res = parsedResources.find((r) => r.identifier === defaultOrg.items[0].resourceRef);
      if (res?.href) entryPoint = res.href;
    }
    if (!entryPoint) {
      const launchRes = parsedResources.find((r) => r.href && (r.href.endsWith(".html") || r.href.endsWith(".htm")));
      if (launchRes?.href) entryPoint = launchRes.href;
    }

    // Title from first org
    const title = defaultOrg?.title || parsedOrgs[0]?.title || "Untitled SCORM Package";

    return {
      version,
      title,
      description: "",
      entryPoint,
      organizations: parsedOrgs,
      resources: parsedResources,
      raw: result as Record<string, unknown>,
    };
  } catch (err) {
    console.error("[SCORM Parser] Failed to parse manifest:", err);
    return null;
  }
}

export function detectContentType(fileList: string[]): "scorm" | "html" | "articulate" | "ispring" | "unknown" {
  const lower = fileList.map((f) => f.toLowerCase());

  // SCORM
  if (lower.some((f) => f.endsWith("imsmanifest.xml"))) return "scorm";

  // Articulate Storyline / Rise signatures
  if (lower.some((f) => f.includes("story_content") || f.includes("story.html") || f.includes("rise/"))) {
    return "articulate";
  }

  // iSpring signatures
  if (lower.some((f) => f.includes("ispring") || f.endsWith(".swf") || f.includes("res/index.html"))) {
    return "ispring";
  }

  // Generic HTML
  if (lower.some((f) => f.endsWith(".html") || f.endsWith(".htm"))) return "html";

  return "unknown";
}

export function findEntryPoint(fileList: string[]): string | null {
  const lower = fileList.map((f) => f.toLowerCase());

  // Common entry point names in priority order
  const candidates = [
    "index.html",
    "index.htm",
    "story.html",
    "story_html5.html",
    "launch.html",
    "default.html",
    "start.html",
    "main.html",
  ];

  for (const candidate of candidates) {
    const match = fileList.find((f) => f.toLowerCase().endsWith("/" + candidate) || f.toLowerCase() === candidate);
    if (match) return match;
  }

  // Fall back to any .html at root level
  const rootHtml = fileList.find((f) => {
    const parts = f.split("/");
    return parts.length <= 2 && (f.endsWith(".html") || f.endsWith(".htm"));
  });

  return rootHtml ?? null;
}
