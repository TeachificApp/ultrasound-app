export type PasswordSetupSubmission = { token: string; newPassword: string };

export function buildPasswordSetupSubmission(token: string, password: string, confirmPassword: string): PasswordSetupSubmission | { error: string } {
  if (password !== confirmPassword) return { error: "Passwords do not match" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (!token) return { error: "Invalid reset link. Please request a new one." };
  return { token, newPassword: password };
}
