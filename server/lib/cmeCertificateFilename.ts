/**
 * Builds the public-storage filename for a CME certificate download. Course
 * titles are normalized for readability; learner details are deliberately not
 * included because certificate URLs may be shared outside the application.
 */
export function buildCmeCertificateFileKey(courseTitle: string, issuedAt: Date, uniqueSuffix: string): string {
  const readableCourse = courseTitle
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72) || "Certificate";
  const date = issuedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = uniqueSuffix.replace(/[^a-f0-9]/gi, "").slice(0, 16) || "unique";
  return `certificates/AllAboutUltrasound_CME_${readableCourse}_${date}_${suffix}.pdf`;
}
