/**
 * Rewrite SCORM launch HTML so folder-prefixed packages (e.g. iSpring flashcard
 * decks like "ACS Flashcards/index.html") resolve assets correctly when served
 * from /api/media/:slug/scorm/ rather than opened as a local file.
 */

export function scormLaunchBaseHref(scormBaseUrl: string, launchFile: string): string | null {
  const launchDir = launchFile.includes("/")
    ? launchFile.substring(0, launchFile.lastIndexOf("/") + 1)
    : "";
  if (!launchDir) return null;

  let parsed: URL;
  try {
    parsed = new URL(scormBaseUrl);
  } catch {
    return null;
  }

  const pathname = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  const encodedDir = launchDir
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${parsed.origin}${pathname}${encodedDir}/`;
}

export function injectScormLaunchHtml(
  html: string,
  options: { scormBaseUrl: string; launchFile: string },
): string {
  let output = html;

  const baseHref = scormLaunchBaseHref(options.scormBaseUrl, options.launchFile);
  if (baseHref && !/<base\b/i.test(output)) {
    const baseTag = `<base href="${baseHref}">`;
    if (/<head\b/i.test(output)) {
      output = output.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    } else {
      output = `${baseTag}${output}`;
    }
  }

  // iSpring flashcard / presentation decks expect a SCORM API on the parent frame.
  if (!/\bAPI_1484_11\b/.test(output) && !/\bwindow\.API\b/.test(output)) {
    const shim = `<script>(function(){function n(){return"true";}var d={};window.API={LMSInitialize:n,LMSFinish:n,LMSGetValue:function(k){return d[k]||"";},LMSSetValue:function(k,v){d[k]=v;return"true";},LMSCommit:n,LMSGetLastError:function(){return"0";},LMSGetErrorString:function(){return"No error";},LMSGetDiagnostic:function(){return"";}};window.API_1484_11={Initialize:n,Terminate:n,GetValue:function(k){return d[k]||"";},SetValue:function(k,v){d[k]=v;return"true";},Commit:n,GetLastError:function(){return"0";},GetErrorString:function(){return"No error";},GetDiagnostic:function(){return"";}};})();</script>`;
    if (/<\/head>/i.test(output)) {
      output = output.replace(/<\/head>/i, `${shim}</head>`);
    } else {
      output = `${shim}${output}`;
    }
  }

  return output;
}
