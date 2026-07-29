/**
 * Shared request authentication helper.
 * Uses Manus OAuth (app_session_id) cookie.
 */
import type { Request } from "express";
import type { User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";

/**
 * Authenticate an Express request using Manus OAuth.
 * Returns the authenticated User or null if authentication fails.
 */
export async function authenticateRequest(req: Request): Promise<(User & { impersonatedBy?: string }) | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user;
  } catch {
    return null;
  }
}
