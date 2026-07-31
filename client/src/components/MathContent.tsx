/**
 * MathContent — lightweight HTML renderer with KaTeX math support.
 *
 * Renders saved rich-text HTML that may contain TipTap Mathematics extension nodes:
 *   <div data-type="block-math" data-latex="..."></div>
 *   <span data-type="inline-math" data-latex="..."></span>
 *
 * IMPORTANT: We set innerHTML manually inside useLayoutEffect (NOT via
 * dangerouslySetInnerHTML) so that KaTeX always runs *after* the HTML is
 * injected into the DOM. Using dangerouslySetInnerHTML would cause React to
 * reset the DOM on re-renders, destroying previously rendered KaTeX output
 * without re-triggering the effect (since [html] hasn't changed).
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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Step 1: set the raw HTML (this resets any previously rendered KaTeX)
    el.innerHTML = html ?? "";

    // Step 2: immediately render KaTeX on all math nodes
    el.querySelectorAll<HTMLElement>('[data-type="block-math"], [data-type="inline-math"]').forEach((node) => {
      const latex = node.getAttribute("data-latex") ?? node.textContent ?? "";
      if (!latex.trim()) return;
      const isBlock = node.getAttribute("data-type") === "block-math";
      try {
        katex.render(latex, node, {
          displayMode: isBlock,
          throwOnError: false,
          output: "html",
        });
      } catch {
        // Fallback: show raw LaTeX so content is never invisible
        node.textContent = latex;
      }
    });
  }, [html]);

  if (!html) return null;

  // Render an empty div — innerHTML is managed entirely by the effect above
  return (
    <div
      ref={ref}
      className={cn(className)}
      style={style}
    />
  );
}
