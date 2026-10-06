import { useEffect, useMemo, useRef, useState } from "react";

const AUTO_SIZING_EMBED_BRIDGE = `<script>
(() => {
  let frameId;
  const renderedContentHeight = () => {
    const body = document.body;
    if (!body) return 0;
    const children = Array.from(body.children).filter(child => child.tagName !== "SCRIPT");
    const bottom = children.reduce((max, child) => Math.max(max, child.offsetTop + child.offsetHeight), 0);
    const style = window.getComputedStyle(body);
    return Math.ceil(bottom + (parseFloat(style.paddingBottom) || 0));
  };
  const reportHeight = () => {
    const height = renderedContentHeight();
    window.parent.postMessage({ type: "ultrasound-embed-resize", height }, "*");
  };
  const scheduleHeightReport = () => {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(reportHeight);
  };
  window.addEventListener("message", event => {
    const reportedHeight = Number(event.data && event.data.height);
    if (!event.data || !Number.isFinite(reportedHeight) || reportedHeight <= 0) return;
    if (event.data.type === "ultrasound-widget-resize" || event.data.type === "included-items-resize") {
      document.querySelectorAll("iframe").forEach(frame => {
        if (frame.contentWindow === event.source) {
          const nextHeight = Math.max(200, Math.ceil(reportedHeight) + 24);
          frame.style.height = nextHeight + "px";
          frame.setAttribute("height", String(nextHeight));
        }
      });
      scheduleHeightReport();
    }
  });
  if (window.ResizeObserver && document.body) {
    new ResizeObserver(scheduleHeightReport).observe(document.body);
  }
  window.addEventListener("load", scheduleHeightReport);
  scheduleHeightReport();
  setTimeout(scheduleHeightReport, 150);
  setTimeout(scheduleHeightReport, 750);
})();
<\/script>`;

function attachAutoSizingBridge(html: string) {
  return /<\/body\s*>/i.test(html)
    ? html.replace(/<\/body\s*>/i, `${AUTO_SIZING_EMBED_BRIDGE}</body>`)
    : `${html}${AUTO_SIZING_EMBED_BRIDGE}`;
}

export function AutoSizingHtmlEmbed({
  html,
  title,
  requestedHeight = 400,
}: {
  html: string;
  title: string;
  requestedHeight?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const expandsToContent = /ultrasound-widget-resize|included-items-resize|\/widget\/|\/embed\/included-items/i.test(html);
  const minimumHeight = Math.max(200, requestedHeight);
  const initialHeight = Math.max(expandsToContent ? 800 : minimumHeight, minimumHeight);
  const [height, setHeight] = useState(initialHeight);
  const srcDoc = useMemo(() => attachAutoSizingBridge(html), [html]);

  useEffect(() => {
    setHeight(initialHeight);
  }, [initialHeight, html]);

  useEffect(() => {
    const receiveHeight = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      const reportedHeight = Number(event.data?.height);
      if (
        event.data?.type !== "ultrasound-embed-resize" ||
        event.source !== iframe?.contentWindow ||
        !Number.isFinite(reportedHeight) ||
        reportedHeight <= 0
      ) return;
      setHeight(Math.max(minimumHeight, Math.ceil(reportedHeight) + 24));
    };
    window.addEventListener("message", receiveHeight);
    return () => window.removeEventListener("message", receiveHeight);
  }, [minimumHeight]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      scrolling="no"
      style={{ width: "100%", height, minHeight: minimumHeight, border: "none", display: "block", overflow: "hidden" }}
      title={title}
    />
  );
}
