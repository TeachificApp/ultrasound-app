import { useEffect, useRef, useState } from "react";

export function IncludedItemsEmbedFrame({
  src,
  title = "Included items preview",
  className,
}: {
  src: string;
  title?: string;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    setHeight(800);
    const receiveHeight = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      const reportedHeight = Number(event.data?.height);
      if (
        event.data?.type !== "included-items-resize" ||
        event.source !== iframe?.contentWindow ||
        !Number.isFinite(reportedHeight) ||
        reportedHeight <= 0
      ) return;
      setHeight(Math.max(200, Math.ceil(reportedHeight) + 24));
    };
    window.addEventListener("message", receiveHeight);
    return () => window.removeEventListener("message", receiveHeight);
  }, [src]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      className={className}
      style={{ width: "100%", border: "none", display: "block", height, minHeight: 200, overflow: "hidden" }}
      scrolling="no"
      frameBorder="0"
      title={title}
    />
  );
}
