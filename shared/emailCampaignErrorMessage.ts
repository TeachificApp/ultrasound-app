type ErrorLike = {
  message?: unknown;
  data?: {
    zodError?: {
      issues?: unknown;
    };
  };
};

type ValidationIssue = {
  path?: unknown;
  message?: unknown;
};

const fieldMessages: Record<string, string> = {
  toEmail: "Enter a valid recipient email address before sending the test email.",
  subject: "Enter a subject line before sending this campaign.",
  htmlBody: "Add email content before sending this campaign.",
  scheduledAt: "Choose a valid future date and time before scheduling this campaign.",
  audienceFilter: "Select a valid recipient audience before sending this campaign.",
  previewText: "Shorten the preview text to 300 characters or fewer.",
};

function getValidationIssues(error: ErrorLike): ValidationIssue[] {
  const structuredIssues = error.data?.zodError?.issues;
  if (Array.isArray(structuredIssues)) return structuredIssues as ValidationIssue[];

  if (typeof error.message !== "string") return [];
  try {
    const parsed = JSON.parse(error.message);
    return Array.isArray(parsed) ? parsed as ValidationIssue[] : [];
  } catch {
    return [];
  }
}

/**
 * Converts tRPC/Zod input-validation payloads into a concise, usable toast.
 * Non-validation errors retain their server-provided explanation.
 */
export function getEmailCampaignErrorMessage(error: ErrorLike, fallback: string): string {
  const issue = getValidationIssues(error)[0];
  const field = Array.isArray(issue?.path) && typeof issue.path[0] === "string"
    ? issue.path[0]
    : undefined;

  if (field && fieldMessages[field]) return fieldMessages[field];
  if (issue) return "Check the email details and try again. One or more fields need attention.";

  const message = typeof error.message === "string" ? error.message.trim() : "";
  if (message && !message.startsWith("[") && !message.startsWith("{")) return message;
  return fallback;
}
