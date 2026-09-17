export type MediaRepoUploadResult = { assetId: number; s3Url: string; slug?: string };

/** Reuses the existing authenticated Media Repository chunk-upload workflow. */
export async function uploadFileToMediaRepository(
  file: File,
  options: {
    access?: "public" | "private";
    folder?: string;
    notes?: string;
    brand?: "aaus" | "iheartecho";
    onProgress?: (progress: number) => void;
  } = {},
): Promise<MediaRepoUploadResult> {
  const chunkSize = 5 * 1024 * 1024;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  const initResponse = await fetch("/api/upload-media-repo/init", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.brand ? { "X-App-Brand": options.brand } : {}) },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      totalChunks,
      fileSize: file.size,
      title: file.name.replace(/\.[^.]+$/, ""),
      access: options.access ?? "private",
      folder: options.folder,
      notes: options.notes ?? "Uploaded for an administrator social quiz card",
    }),
  });
  const initBody = await initResponse.json().catch(() => null);
  if (!initResponse.ok || !initBody?.uploadId) throw new Error(initBody?.error ?? "Unable to start the Media Repository upload.");

  let result: MediaRepoUploadResult | null = null;
  for (let index = 0; index < totalChunks; index += 1) {
    const data = new FormData();
    data.append("chunk", file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)), file.name);
    data.append("uploadId", initBody.uploadId);
    data.append("chunkIndex", String(index));
    data.append("totalChunks", String(totalChunks));
    data.append("fileName", file.name);
    data.append("mimeType", file.type || "application/octet-stream");
    data.append("fileSize", String(file.size));
    data.append("title", file.name.replace(/\.[^.]+$/, ""));
    data.append("access", options.access ?? "private");
    if (options.folder) data.append("folder", options.folder);
    data.append("notes", options.notes ?? "Uploaded for an administrator social quiz card");

    const response = await fetch("/api/upload-media-repo/chunk", { method: "POST", credentials: "include", headers: options.brand ? { "X-App-Brand": options.brand } : undefined, body: data });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? `Media upload failed at chunk ${index + 1}.`);
    options.onProgress?.(Math.round(((index + 1) / totalChunks) * 100));
    if (body?.done && body.assetId && body.s3Url) result = { assetId: body.assetId, s3Url: body.s3Url, slug: body.slug };
  }
  if (!result) throw new Error("The Media Repository upload did not return an asset.");
  return result;
}
