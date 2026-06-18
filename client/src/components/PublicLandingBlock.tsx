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
}: {
  block: Block;
  context?: LandingBlockContext;
}) {
  if (block.type === "remaining_seats") {
    return <RemainingSeatsBlock data={resolveRemainingSeatsData(block.data, context) as any} />;
  }
  return <BlockPreview block={block} />;
}

export function PublicLandingBlocks({
  blocks,
  context,
}: {
  blocks: Block[];
  context?: LandingBlockContext;
}) {
  return (
    <>
      {blocks.map((block) => (
        <PublicLandingBlock key={block.id} block={block} context={context} />
      ))}
    </>
  );
}
