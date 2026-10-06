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

/**
 * Saved page-builder blocks commonly store the direct iframe snippet generated
 * for Included Items. Rendering that snippet inside srcDoc creates two nested
 * frames. Each frame can report a height, which is prone to feedback loops as
 * a parent becomes taller than its content. Extract the known, trusted widget
 * source and render one direct frame instead.
 */
function extractIncludedItemsSrc(html: string): string | null {
  const match = html.match(/<iframe\b[^>]*?\bsrc\s*=\s*(["'])([^"']*\/embed\/included-items[^"']*)\1[^>]*>/i);
  return match?.[2]?.replace(/&amp;/gi, "&") ?? null;
}

function DirectIncludedItemsEmbed({
  src,
  title,
  requestedHeight,
}: {
  src: string;
  title: string;
  requestedHeight: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const minimumHeight = 200;
  // A short initial frame avoids a flash of a tall empty block; the widget
  // reports its intrinsic content height immediately after it loads.
  const initialHeight = Math.max(280, Math.min(Math.max(requestedHeight, minimumHeight), 420));
  const [height, setHeight] = useState(initialHeight);

  useEffect(() => {
    setHeight(initialHeight);
  }, [initialHeight, src]);

  useEffect(() => {
    const receiveHeight = (event: MessageEvent) => {
      const reportedHeight = Number(event.data?.height);
      if (
        event.data?.type !== "included-items-resize" ||
        event.source !== iframeRef.current?.contentWindow ||
        !Number.isFinite(reportedHeight) ||
        reportedHeight <= 0
      ) return;
      setHeight(Math.max(minimumHeight, Math.ceil(reportedHeight) + 24));
    };
    window.addEventListener("message", receiveHeight);
    return () => window.removeEventListener("message", receiveHeight);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      scrolling="no"
      style={{ width: "100%", height, minHeight: minimumHeight, border: "none", display: "block", overflow: "hidden" }}
      title={title}
    />
  );
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
  const includedItemsSrc = useMemo(() => extractIncludedItemsSrc(html), [html]);
  const minimumHeight = Math.max(200, requestedHeight);
  const [height, setHeight] = useState(minimumHeight);
  const srcDoc = useMemo(() => attachAutoSizingBridge(html), [html]);

  useEffect(() => {
    setHeight(minimumHeight);
  }, [minimumHeight, html]);

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

  if (includedItemsSrc) {
    return <DirectIncludedItemsEmbed src={includedItemsSrc} title={title} requestedHeight={requestedHeight} />;
  }

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
