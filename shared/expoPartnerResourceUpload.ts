export const EXPO_RESOURCE_MAX_BYTES = 10 * 1024 * 1024;

// Deliberately exclude SVG, HTML, scripts, archives, and macro-enabled Office files.
export const EXPO_RESOURCE_MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
} as const;

export const EXPO_RESOURCE_FILE_ACCEPT = Object.keys(
  EXPO_RESOURCE_MIME_BY_EXTENSION
)
  .map(extension => `.${extension}`)
  .join(",");

export function expoResourceMimeType(fileName: string): string | undefined {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension &&
    Object.prototype.hasOwnProperty.call(
      EXPO_RESOURCE_MIME_BY_EXTENSION,
      extension
    )
    ? EXPO_RESOURCE_MIME_BY_EXTENSION[
        extension as keyof typeof EXPO_RESOURCE_MIME_BY_EXTENSION
      ]
    : undefined;
}

export function expoResourceFileError(
  fileName: string,
  mimeType: string,
  size: number
): string | null {
  const expectedMimeType = expoResourceMimeType(fileName);
  if (!expectedMimeType || mimeType !== expectedMimeType) {
    return "Choose a PDF, Word, Excel, PowerPoint, PNG, JPEG, or WebP file with a matching file type. SVG and macro-enabled files are not supported.";
  }
  if (!Number.isFinite(size) || size <= 0 || size > EXPO_RESOURCE_MAX_BYTES) {
    return "Choose a non-empty file no larger than 10 MB.";
  }
  return null;
}
