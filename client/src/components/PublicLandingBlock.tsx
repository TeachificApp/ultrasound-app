/**
 * PublicLandingBlock.tsx
 * Renders landing page blocks on public-facing pages with live data.
 * BlockPreview is admin-only (remaining_seats uses preview mode there).
 */

import type { Block } from "./BlockPreview";
import { BlockPreview } from "./BlockPreview";
import { RemainingSeatsBlock } from "./RemainingSeatsBlock";
import { resolveRemainingSeatsData, type LandingBlockContext } from "@shared/remainingSeats";

export type { LandingBlockContext };
export { resolveRemainingSeatsData };

export function PublicLandingBlock({
  block,
  context,
  onEnroll,
  onCheckoutPage,
}: {
  block: Block;
  context?: LandingBlockContext;
  /** Fires for enroll / free-enrollment CTA actions inside embedded landing blocks */
  onEnroll?: () => void;
  /** Fires for direct_checkout / pricing_option CTA actions (preferred over onEnroll) */
  onCheckoutPage?: (pricingOptionId?: number) => void;
}) {
  if (block.type === "remaining_seats") {
    return <RemainingSeatsBlock data={resolveRemainingSeatsData(block.data, context) as any} />;
  }
  return (
    <BlockPreview
      block={block}
      onEnroll={onEnroll}
      onCheckoutPage={onCheckoutPage ?? onEnroll}
    />
  );
}

export function PublicLandingBlocks({
  blocks,
  context,
  onEnroll,
  onCheckoutPage,
}: {
  blocks: Block[];
  context?: LandingBlockContext;
  onEnroll?: () => void;
  onCheckoutPage?: (pricingOptionId?: number) => void;
}) {
  return (
    <>
      {blocks.map((block) => (
        <PublicLandingBlock
          key={block.id}
          block={block}
          context={context}
          onEnroll={onEnroll}
          onCheckoutPage={onCheckoutPage}
        />
      ))}
    </>
  );
}
