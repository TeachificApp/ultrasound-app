import { drizzle } from "drizzle-orm/mysql2";
import { users } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const url = process.env.DATABASE_URL;
console.log("Testing drizzle connection...");
try {
  const db = drizzle(url);
  // Test a simple query similar to what magic link uses
  const result = await db.select().from(users).where(eq(users.email, "test@example.com")).limit(1);
  console.log("Drizzle query OK, rows:", result.length);
} catch(e) {
  console.error("Drizzle FAILED:", e.message);
  console.error("Error code:", e.code);
  console.error("Cause:", e.cause?.message);
}
