import { z } from "zod";
import { normalizeAuthEmail } from "./normalizeAuthEmail";

/** Auth email input — trims, lowercases, and strips zero-width chars before validation. */
export const authEmailField = z.preprocess(
  (val) => (typeof val === "string" ? normalizeAuthEmail(val) : val),
  z.string().email("Please enter a valid email address").max(320),
);
