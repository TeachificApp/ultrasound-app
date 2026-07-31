/**
 * MathContent — lightweight HTML renderer with KaTeX math support.
 *
 * Renders saved rich-text HTML that may contain TipTap Mathematics extension nodes:
 *   <div data-type="block-math" data-latex="..."></div>
 *   <span data-type="inline-math" data-latex="..."></span>
 *
 * This component intentionally has NO dependency on RichTextEditor or TipTap to
 * avoid circular import issues (BlockPreview → CourseLanding → BlockPreview).
 * It only imports katex directly.
 */
import React, { useRef, useLayoutEffect } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface MathContentProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

export function MathContent({ html, className, style }: MathContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  // useLayoutEffect fires synchronously after DOM mutations, before paint.
  // This ensures KaTeX renders before the user sees the empty math nodes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('[data-type="block-math"], [data-type="inline-math"]').forEach((node) => {
      const latex = node.getAttribute("data-latex") ?? node.textContent ?? "";
      if (!latex) return;
      const isBlock = node.getAttribute("data-type") === "block-math";
      try {
        katex.render(latex, node, { displayMode: isBlock, throwOnError: false, output: "html" });
      } catch {
        node.textContent = latex;
      }
    });
  }, [html]);

  if (!html) return null;

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={style}
      // Block math: centered, full-width, scrollable for long equations
      // Inline math: inline display
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
