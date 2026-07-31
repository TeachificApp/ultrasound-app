/**
 * POST /api/reconstruct-math
 *
 * Takes plain text pasted from ChatGPT (which strips MathML and leaves
 * fragmented equation text) and uses an LLM to reconstruct the proper
 * LaTeX equations, returning HTML with TipTap-compatible math nodes.
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { sdk } from "../_core/sdk";
import { invokeLLM } from "../_core/llm";

const router = Router();

const bodySchema = z.object({
  text: z.string().min(1).max(100_000),
});

const SYSTEM_PROMPT = `You are a LaTeX math reconstruction assistant. The user will paste plain text copied from ChatGPT that contains echocardiography or medical equations. ChatGPT's copy function strips MathML and leaves equations as fragmented plain text (e.g. fractions appear as numerator on one line, denominator on another, with a ​ character between them).

Your job is to reconstruct the full document as clean HTML that:
1. Preserves all headings (use <h2> for numbered sections, <h3> for subsection headings like "Cross-Sectional Area (CSA)")
2. Preserves all paragraph text, bullet lists, and tables
3. Replaces every equation with a TipTap math node:
   - Block/display equations (centered, standalone): <div data-type="block-math" data-latex="LATEX_HERE"></div>
   - Inline equations within text: <span data-type="inline-math" data-latex="LATEX_HERE"></span>
4. For "Where:" lists, keep them as <ul><li><strong>X</strong> = Description</li></ul>
5. Use <hr> for horizontal dividers between sections

Rules for LaTeX reconstruction:
- The ​ character (zero-width space) indicates a subscript/fraction separator in ChatGPT's plain text
- Lines that are just numbers after an equation variable are usually superscripts (e.g. "V" then "2" = V^2)
- Fractions: numerator appears above, then ​, then denominator below
- Common patterns:
  - "A₁V₁ = A₂V₂" → A_1 V_1 = A_2 V_2
  - "CSA=π(D/2)²" → CSA = \\pi \\left(\\frac{D}{2}\\right)^2
  - "SV=CSA×VTI" → SV = CSA \\times VTI
  - "ΔP=4V²" → \\Delta P = 4V^2
  - Fraction with numerator X and denominator Y → \\frac{X}{Y}
  - Subscripts: V_alias, V_max, VTI_LVOT, etc.

Return ONLY the HTML, no markdown code fences, no explanation.`;

router.post("/api/reconstruct-math", async (req: Request, res: Response) => {
  try {
    let user: any = null;
    try { user = await sdk.authenticateRequest(req); } catch {}
    if (!user || user.role !== "admin") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: parsed.data.text },
      ],
    });

    const html = response.choices?.[0]?.message?.content ?? "";
    // Strip any accidental markdown code fences
    const cleaned = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
    res.json({ html: cleaned });
  } catch (err: any) {
    console.error("[reconstruct-math]", err);
    res.status(500).json({ error: err?.message ?? "Reconstruction failed" });
  }
});

export function registerReconstructMathRoute(app: import("express").Application) {
  app.use(router);
}
