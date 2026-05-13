/**
 * uploadFile — generic multipart file upload helper
 *
 * Sends a file to /api/upload via multipart/form-data.
 * Returns the public S3 URL and file key.
 *
 * @param file        - The File object to upload
 * @param folder      - S3 path prefix, e.g. "avatars", "soundbytes", "tee-media"
 * @param options     - Optional: maxMB (default 100), allowedTypes (default "image,video,audio")
 * @param onProgress  - Optional progress callback (0–100). Note: fetch does not support upload progress natively;
 *                      this is a best-effort approximation via XHR when provided.
 */
export async function uploadFile(
  file: File,
  folder: string,
  options?: {
    maxMB?: number;
    allowedTypes?: string;
  },
  onProgress?: (pct: number) => void
): Promise<{ url: string; fileKey: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  if (options?.maxMB != null) fd.append("maxMB", String(options.maxMB));
  if (options?.allowedTypes) fd.append("allowedTypes", options.allowedTypes);

  if (onProgress) {
    // Use XHR for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.withCredentials = true;
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.error) reject(new Error(data.error));
            else resolve(data);
          } catch {
            reject(new Error("Invalid server response"));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.send(fd);
    });
  }

  // Standard fetch (no progress)
  const res = await fetch("/api/upload", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return data as { url: string; fileKey: string };
}
