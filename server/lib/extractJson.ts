/**
 * Robustly extract and parse JSON from an LLM response string.
 * Handles cases where the model wraps the JSON in markdown code fences
 * (```json ... ```) or returns extra text before/after the JSON.
 */
export function extractJson(raw: string): any {
  if (!raw || typeof raw !== "string") throw new Error("Empty response");

  // 1. Strip markdown code fences: ```json ... ``` or ``` ... ```
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // 2. Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // 3. Try to find the first { or [ and extract from there
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");
    let start = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
    }
    if (start !== -1) {
      const lastBrace = text.lastIndexOf("}");
      const lastBracket = text.lastIndexOf("]");
      const end = Math.max(lastBrace, lastBracket);
      if (end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          // fall through
        }
      }
    }
    throw new Error(`Could not parse JSON from LLM response: ${text.slice(0, 200)}`);
  }
}

/** All valid landing page block types */
export const VALID_BLOCK_TYPES = new Set([
  "hero","text","image","video","audio","bullets","testimonial","pricing_cta",
  "divider","two_column","divided_columns","spacer","faq","image_text","gallery",
  "icon_grid","countdown","instructor","logos","reviews","embed","cta_standalone",
  "lead_capture","cta_optin","numbered_list","checklist","alert","flip_cards",
  "curriculum_auto","pricing_options_auto","funnel_workflow","product_offer_stack",
  "order_bump_checkout","price_stack","urgency_offer","checkout_form","footer",
  "logo_strip","three_column","related_products","embedded_checkout","inline_checkout",
  "lesson_quiz","lesson_flashcard","file_download","scorm_embed","url_embed",
  "column_layout","carousel","ticker","countdown_v2","live_session","comparison_table",
  "pricing_cards","form_embed","upgrade_prompt",
]);

/**
 * Map of LLM-invented block type names → valid block types.
 * When the LLM returns a non-standard type, we remap it rather than dropping the block.
 */
const BLOCK_TYPE_ALIASES: Record<string, string> = {
  rich_text: "text",
  richtext: "text",
  content: "text",
  paragraph: "text",
  body: "text",
  testimonials: "reviews",
  testimonial_list: "reviews",
  cta_button: "cta_standalone",
  cta: "cta_standalone",
  call_to_action: "cta_standalone",
  pricing: "pricing_options_auto",
  pricing_table: "pricing_options_auto",
  curriculum: "curriculum_auto",
  course_curriculum: "curriculum_auto",
  bullet_list: "bullets",
  bullet_points: "bullets",
  list: "bullets",
  accordion: "faq",
  faqs: "faq",
  image_with_text: "image_text",
  text_with_image: "image_text",
  features: "icon_grid",
  feature_list: "icon_grid",
  banner: "hero",
  header: "hero",
};

/**
 * Normalize an array of raw LLM blocks into valid { id, type, data } block objects.
 * - Remaps unknown types via BLOCK_TYPE_ALIASES
 * - Falls back to "text" for completely unknown types
 * - Promotes top-level fields into data if no data object present
 */
export function normalizeLandingBlocks(rawBlocks: any[]): any[] {
  return rawBlocks
    .filter((b: any) => b && typeof b === "object")
    .map((b: any, i: number) => {
      const { id, type, data, ...rest } = b;
      // Resolve type: check valid types, then aliases, then fallback to "text"
      let resolvedType: string = type ?? "text";
      if (!VALID_BLOCK_TYPES.has(resolvedType)) {
        const lower = resolvedType.toLowerCase();
        resolvedType = BLOCK_TYPE_ALIASES[resolvedType] ?? BLOCK_TYPE_ALIASES[lower] ?? "text";
      }
      return {
        id: id ?? `ai_block_${i}_${Date.now()}`,
        type: resolvedType,
        data: (data && typeof data === "object" && !Array.isArray(data)) ? data : rest,
      };
    });
}

/**
 * Parse and normalize landing page blocks from an LLM response.
 * Returns a non-empty array or throws with a descriptive error.
 */
export function parseLandingBlocks(raw: string): any[] {
  const parsed = extractJson(raw);
  const rawBlocks: any[] = Array.isArray(parsed)
    ? parsed
    : (parsed?.blocks ?? parsed?.data?.blocks ?? []);
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
    throw new Error(`LLM response did not contain a blocks array. Got: ${JSON.stringify(parsed).slice(0, 300)}`);
  }
  const blocks = normalizeLandingBlocks(rawBlocks);
  if (blocks.length === 0) {
    throw new Error("No valid blocks after normalization");
  }
  return blocks;
}
