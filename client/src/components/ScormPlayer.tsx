/**
 * ScormPlayer — client-side SCORM ZIP extractor (iSpring-style).
 *
 * Fetches the SCORM ZIP from S3 directly in the browser, extracts it with
 * JSZip, creates blob URLs for every file, then loads the entry point in an
 * iframe.  No server-side extraction job is needed — the content is always
 * available immediately.
 *
 * The SCORM API (API_1484_11 / API) is injected into the iframe via
 * postMessage / window.name so progress can be tracked.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import JSZip from "jszip";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ScormPlayerProps {
  /** Signed S3 URL for the SCORM ZIP file */
  zipUrl: string;
  /** Optional title shown while loading */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Called when the learner's completion status changes */
  onComplete?: (status: string) => void;
}

type LoadState =
  | { phase: "idle" }
  | { phase: "downloading"; progress: number }
  | { phase: "extracting" }
  | { phase: "ready"; iframeSrc: string }
  | { phase: "error"; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse imsmanifest.xml and return the href of the first SCO resource */
function findLaunchFileFromManifest(xmlText: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    // SCORM 2004 / 1.2: <resource type="webcontent" adlcp:scormType="sco" href="...">
    const resources = Array.from(doc.querySelectorAll("resource"));
    // Prefer SCO type
    const sco = resources.find(
      (r) =>
        (r.getAttribute("adlcp:scormtype") || r.getAttribute("adlcp:scormType") || "").toLowerCase() === "sco"
    );
    if (sco) {
      const href = sco.getAttribute("href");
      if (href) return href;
    }
    // Fall back to first webcontent resource
    const web = resources.find(
      (r) =>
        (r.getAttribute("type") || "").toLowerCase().includes("webcontent") ||
        (r.getAttribute("type") || "").toLowerCase().includes("web content")
    );
    if (web) {
      const href = web.getAttribute("href");
      if (href) return href;
    }
    // Last resort: first resource with an href
    for (const r of resources) {
      const href = r.getAttribute("href");
      if (href) return href;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/** Guess MIME type from file extension */
function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    js: "application/javascript",
    mjs: "application/javascript",
    css: "text/css",
    json: "application/json",
    xml: "application/xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    swf: "application/x-shockwave-flash",
    txt: "text/plain",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * Rewrite HTML/JS content so that relative paths resolve against blob URLs.
 * We inject a <base> tag pointing to a virtual base so relative imports work.
 * For HTML files we also inject the SCORM API shim.
 */
function rewriteHtmlForBlob(
  html: string,
  blobMap: Map<string, string>,
  launchDir: string
): string {
  // Inject SCORM API shim before </head> or at top
  const scormShim = `<script>
(function(){
  // Minimal SCORM 1.2 / 2004 API shim so content doesn't crash
  var _data = {};
  function noop(){ return "true"; }
  window.API = {
    LMSInitialize: noop, LMSFinish: noop, LMSGetValue: function(k){ return _data[k]||""; },
    LMSSetValue: function(k,v){ _data[k]=v;
      if(k==="cmi.core.lesson_status"||k==="cmi.completion_status"||k==="cmi.success_status"){
        try{ window.parent.postMessage({type:"scorm-status",key:k,value:v},"*"); }catch(e){}
      }
      return "true";
    },
    LMSCommit: noop, LMSGetLastError: function(){ return "0"; },
    LMSGetErrorString: function(){ return "No error"; },
    LMSGetDiagnostic: function(){ return ""; }
  };
  window.API_1484_11 = {
    Initialize: noop, Terminate: noop,
    GetValue: function(k){ return _data[k]||""; },
    SetValue: function(k,v){ _data[k]=v;
      if(k==="cmi.completion_status"||k==="cmi.success_status"){
        try{ window.parent.postMessage({type:"scorm-status",key:k,value:v},"*"); }catch(e){}
      }
      return "true";
    },
    Commit: noop, GetLastError: function(){ return "0"; },
    GetErrorString: function(){ return "No error"; },
    GetDiagnostic: function(){ return ""; }
  };
})();
</script>`;

  // Replace relative src/href references with blob URLs where we have them
  // This handles the most common cases; complex module bundlers may need the base tag
  const rewritten = html.replace(
    /(src|href|action)=["']([^"'#?]+)["']/gi,
    (match, attr, relPath) => {
      if (relPath.startsWith("http") || relPath.startsWith("//") || relPath.startsWith("blob:") || relPath.startsWith("data:")) {
        return match;
      }
      // Resolve relative to launchDir
      const resolved = launchDir ? `${launchDir}/${relPath}`.replace(/\/\.\//g, "/") : relPath;
      const blobUrl = blobMap.get(resolved.toLowerCase()) || blobMap.get(relPath.toLowerCase());
      if (blobUrl) {
        return `${attr}="${blobUrl}"`;
      }
      return match;
    }
  );

  // Inject SCORM shim
  if (rewritten.includes("</head>")) {
    return rewritten.replace("</head>", `${scormShim}</head>`);
  }
  return scormShim + rewritten;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScormPlayer({ zipUrl, title = "SCORM Content", className, style, onComplete }: ScormPlayerProps) {
  const [state, setState] = useState<LoadState>({ phase: "idle" });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlsRef = useRef<string[]>([]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Listen for SCORM status messages from the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "scorm-status" && onComplete) {
        onComplete(e.data.value);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onComplete]);

  const load = useCallback(async () => {
    if (!zipUrl) return;
    setState({ phase: "downloading", progress: 0 });

    try {
      // 1. Download the ZIP with progress tracking
      const fetchUrl = zipUrl.startsWith("/") ? `${window.location.origin}${zipUrl}` : zipUrl;
      const response = await fetch(fetchUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Failed to fetch ZIP: ${response.status} ${response.statusText}`);

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (contentType.includes("text/html") || contentType.includes("application/json")) {
        throw new Error(
          "Server returned an error page instead of a ZIP file. The package may need to be re-uploaded or served via server extraction."
        );
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      let loaded = 0;
      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (contentLength > 0) {
          setState({ phase: "downloading", progress: Math.round((loaded / contentLength) * 100) });
        }
      }

      const buffer = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Reject HTML/JSON masquerading as ZIP (common when s3Url points at index.html)
      if (buffer.length >= 2) {
        const isZipMagic = buffer[0] === 0x50 && buffer[1] === 0x4b; // PK
        const looksLikeHtml =
          buffer[0] === 0x3c ||
          (buffer.length >= 5 &&
            buffer[0] === 0xef &&
            buffer[1] === 0xbb &&
            buffer[2] === 0xbf &&
            buffer[3] === 0x3c);
        if (!isZipMagic && looksLikeHtml) {
          throw new Error(
            "Downloaded file is not a ZIP archive (received HTML). Ask an admin to re-upload the SCORM package or use Re-extract in the media library."
          );
        }
      }

      // 2. Extract the ZIP
      setState({ phase: "extracting" });
      let zip;
      try {
        zip = await JSZip.loadAsync(buffer);
      } catch (zipErr: any) {
        const msg = zipErr?.message ?? "";
        if (msg.includes("end of central directory")) {
          throw new Error(
            "Invalid or incomplete ZIP file. The stored file may be an extracted HTML page — try Re-extract in the media library or re-upload the package."
          );
        }
        throw zipErr;
      }

      // 3. Build a blob URL map for all files
      const blobMap = new Map<string, string>(); // normalised path → blob URL
      const fileEntries = Object.entries(zip.files).filter(([, f]) => !f.dir);

      await Promise.all(
        fileEntries.map(async ([zipPath, file]) => {
          const data = await file.async("uint8array");
          const mime = guessMime(zipPath);
          const blob = new Blob([data], { type: mime });
          const url = URL.createObjectURL(blob);
          blobUrlsRef.current.push(url);
          blobMap.set(zipPath.toLowerCase(), url);
          // Also store without leading folder if nested
          const parts = zipPath.split("/");
          if (parts.length > 1) {
            blobMap.set(parts.slice(1).join("/").toLowerCase(), url);
          }
        })
      );

      // 4. Find the launch file
      let launchFile: string | null = null;
      let launchDir = "";

      // Try imsmanifest.xml first
      const manifestEntry = Object.keys(zip.files).find(
        (k) => k.toLowerCase().endsWith("imsmanifest.xml") && !zip.files[k].dir
      );
      if (manifestEntry) {
        const manifestText = await zip.files[manifestEntry].async("text");
        const manifestHref = findLaunchFileFromManifest(manifestText);
        if (manifestHref) {
          // Resolve relative to manifest location
          const manifestDir = manifestEntry.includes("/")
            ? manifestEntry.substring(0, manifestEntry.lastIndexOf("/"))
            : "";
          launchFile = manifestDir ? `${manifestDir}/${manifestHref}` : manifestHref;
          launchDir = launchFile.includes("/")
            ? launchFile.substring(0, launchFile.lastIndexOf("/"))
            : "";
        }
      }

      // Fallback: look for index.html
      if (!launchFile) {
        const htmlFiles = Object.keys(zip.files).filter(
          (k) => (k.toLowerCase().endsWith("index.html") || k.toLowerCase().endsWith("index.htm")) && !zip.files[k].dir
        );
        // Prefer shallowest
        htmlFiles.sort((a, b) => a.split("/").length - b.split("/").length);
        launchFile = htmlFiles[0] ?? null;
        if (launchFile) {
          launchDir = launchFile.includes("/")
            ? launchFile.substring(0, launchFile.lastIndexOf("/"))
            : "";
        }
      }

      if (!launchFile) {
        throw new Error("Could not find SCORM entry point (imsmanifest.xml or index.html) in ZIP");
      }

      // 5. Rewrite the launch HTML to inject the SCORM API shim and resolve blob URLs
      const launchFileEntry = zip.files[launchFile] || zip.files[Object.keys(zip.files).find(k => k.toLowerCase() === launchFile!.toLowerCase())!];
      if (!launchFileEntry) throw new Error(`Launch file not found in ZIP: ${launchFile}`);

      const htmlText = await launchFileEntry.async("text");
      const rewrittenHtml = rewriteHtmlForBlob(htmlText, blobMap, launchDir);
      const htmlBlob = new Blob([rewrittenHtml], { type: "text/html" });
      const iframeSrc = URL.createObjectURL(htmlBlob);
      blobUrlsRef.current.push(iframeSrc);

      setState({ phase: "ready", iframeSrc });
    } catch (err: any) {
      console.error("[ScormPlayer] Load error:", err);
      setState({ phase: "error", message: err.message ?? "Unknown error loading SCORM content" });
    }
  }, [zipUrl]);

  useEffect(() => {
    if (zipUrl) {
      load();
    }
  }, [zipUrl, load]);

  // ── Render ────────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#f9fafb",
    ...style,
  };

  if (state.phase === "idle") return null;

  if (state.phase === "downloading" || state.phase === "extracting") {
    return (
      <div className={className} style={containerStyle}>
        <div style={{ textAlign: "center", padding: "32px", maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <p style={{ fontWeight: 600, fontSize: 16, color: "#111827", margin: "0 0 8px" }}>
            {state.phase === "downloading" ? "Loading Content…" : "Preparing Content…"}
          </p>
          {state.phase === "downloading" && (
            <>
              <div style={{
                width: "100%", height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden", margin: "12px 0"
              }}>
                <div style={{
                  height: "100%", background: "#189aa1", borderRadius: 3,
                  width: `${state.progress}%`, transition: "width 0.2s ease"
                }} />
              </div>
              {state.progress > 0 && (
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{state.progress}%</p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className={className} style={{ ...containerStyle, background: "#fef2f2" }}>
        <div style={{ textAlign: "center", padding: "32px", maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <p style={{ fontWeight: 600, fontSize: 16, color: "#991b1b", margin: "0 0 8px" }}>
            Unable to load content
          </p>
          <p style={{ fontSize: 13, color: "#b91c1c", margin: "0 0 16px" }}>{state.message}</p>
          <button
            onClick={load}
            style={{
              padding: "8px 20px", background: "#189aa1", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // phase === "ready"
  return (
    <iframe
      ref={iframeRef}
      src={state.iframeSrc}
      className={className}
      style={{ width: "100%", height: "100%", border: "none", ...style }}
      title={title}
      allow="autoplay; fullscreen"
      allowFullScreen
    />
  );
}
