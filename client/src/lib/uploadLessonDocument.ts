export type UploadedLessonDocument = {
  url: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export async function uploadLessonDocument(
  file: File,
  lessonId: number,
  onProgress?: (pct: number) => void,
): Promise<UploadedLessonDocument> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("lessonId", String(lessonId));

  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload-lesson-document");
      xhr.withCredentials = true;
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      xhr.addEventListener("load", () => {
        try {
          const data = JSON.parse(xhr.responseText) as UploadedLessonDocument & { error?: string };
          if (xhr.status >= 200 && xhr.status < 300 && !data.error) {
            resolve(data);
            return;
          }
          reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(xhr.status === 413
            ? "The file is too large for the server upload limit."
            : "Upload failed — the server returned an invalid response."));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.send(fd);
    });
  }

  const res = await fetch("/api/upload-lesson-document", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  let data: UploadedLessonDocument & { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(res.status === 413
      ? "The file is too large for the server upload limit."
      : "Upload failed — the server returned an invalid response.");
  }
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return data;
}

function formatConversionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/unexpected token|is not valid json|failed to fetch|payload too large|request entity too large|413/i.test(message)) {
    return "Upload failed — the file may be too large for the server, or the connection was interrupted. Try a smaller file or retry.";
  }
  return message || "The document could not be converted.";
}

export { formatConversionError };
