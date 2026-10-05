import JSZip from "jszip";

export type FlashcardTemplateUpload = {
  name: string;
  source: "pptx";
  sourcePptxUrl: string;
  frontBackgroundUrl: string;
  answerBackgroundUrl: string;
};

type UploadFile = (file: File, context: string) => Promise<string>;

type Candidate = {
  name: string;
  blob: Blob;
  width: number;
  height: number;
};

function mimeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/png";
}

function loadImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("One of the PowerPoint design images could not be read."));
    };
    image.src = url;
  });
}

/**
 * A PPTX is a ZIP package. For flashcard artwork, the reusable surface is an
 * embedded portrait image rather than a flattened slide: this keeps the card
 * copy, question, and answer editable in the visual builder.
 */
export async function createPptxFlashcardTemplate(
  file: File,
  uploadFile: UploadFile,
): Promise<FlashcardTemplateUpload> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("PowerPoint templates must be smaller than 20 MB.");
  }
  if (!/\.pptx$/i.test(file.name)) {
    throw new Error("Choose a .pptx PowerPoint design template.");
  }

  const zip = await JSZip.loadAsync(file);
  const mediaEntries = Object.keys(zip.files)
    .filter((path) => /^ppt\/media\/.*\.(png|jpe?g|webp|gif)$/i.test(path));
  if (mediaEntries.length === 0) {
    throw new Error("This PowerPoint has no embedded image artwork to use as a flashcard design.");
  }

  const candidates = (await Promise.all(mediaEntries.map(async (name): Promise<Candidate | null> => {
    const blob = await zip.file(name)?.async("blob");
    if (!blob) return null;
    try {
      const size = await loadImageSize(blob);
      return { name, blob, ...size };
    } catch {
      return null;
    }
  }))).filter((candidate): candidate is Candidate => candidate !== null);

  const portraitCandidates = candidates
    .filter((candidate) => candidate.height >= candidate.width * 1.15)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const frame = portraitCandidates[0];
  if (!frame) {
    throw new Error("Add a portrait card-frame image to the PowerPoint, then upload the .pptx again.");
  }

  const stem = file.name.replace(/\.pptx$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "flashcard-template";
  const designImage = new File([frame.blob], `${stem}-card-frame.${frame.name.split(".").pop() ?? "png"}`, {
    type: frame.blob.type || mimeFromPath(frame.name),
  });
  const [sourcePptxUrl, frameUrl] = await Promise.all([
    uploadFile(file, "flashcard-pptx-template"),
    uploadFile(designImage, "flashcard-pptx-card-frame"),
  ]);

  return {
    name: file.name.replace(/\.pptx$/i, ""),
    source: "pptx",
    sourcePptxUrl,
    // A single portrait frame is intentionally used on both sides until a
    // distinct answer-side frame is supplied in the deck artwork.
    frontBackgroundUrl: frameUrl,
    answerBackgroundUrl: frameUrl,
  };
}
