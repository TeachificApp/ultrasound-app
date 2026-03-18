import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns true if the URL points to a video file (mp4, wmv, webm, mov, avi).
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  return /\.(mp4|wmv|webm|mov|avi)(\?|$)/i.test(url) ||
    url.includes("question-videos/");
}

/**
 * Strip HTML tags from a string, returning plain text.
 * Safe to call with plain text (no-op if no tags present).
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  // Use a regex-based approach that works in both browser and SSR
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
