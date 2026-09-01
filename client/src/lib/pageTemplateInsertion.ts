type TemplateBlock = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
};

function cloneValue(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Copies page-template blocks for a new page. Only content-block identities are
 * refreshed; question, link, and other author-entered data retain their values.
 */
export function copyPageTemplateBlocks<T extends TemplateBlock>(
  blocks: T[],
  createId: () => string,
): T[] {
  const copyBlock = (block: TemplateBlock): TemplateBlock => {
    const copiedId = createId();
    const copiedData = cloneValue(block.data ?? {}) as Record<string, unknown>;
    for (const key of ["leftBlocks", "rightBlocks", "blocks", "children"]) {
      if (Array.isArray(copiedData[key])) {
        copiedData[key] = copyPageTemplateBlocks(copiedData[key] as TemplateBlock[], createId);
      }
    }
    if (Array.isArray(copiedData.columns)) {
      copiedData.columns = copiedData.columns.map((column: any) => ({
        ...column,
        blocks: Array.isArray(column?.blocks)
          ? copyPageTemplateBlocks(column.blocks as TemplateBlock[], createId)
          : column?.blocks,
      }));
    }
    return { ...block, id: copiedId, data: copiedData } as T;
  };

  return blocks.map(copyBlock);
}
