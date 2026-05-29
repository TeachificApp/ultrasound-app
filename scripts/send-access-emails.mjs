/**
 * Send access emails to Crystal and Shahnoz for the "From Sonographer to CEO" eBook download.
 * Uses the same email flow as the webhook: generates an auto-login token and sends a
 * purchase confirmation email with a direct download link.
 */
import { createConnection } from "mysql2/promise";
import { createTransport } from "nodemailer";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const DB_URL = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@allaboutultrasound.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "All About Ultrasound";

const CUSTOMERS = [
  { email: "Crystalceri25@gmail.com", name: "Crystal Ceri" },
  { email: "shahnoz1@hotmail.com", name: "Shahnoz Mamasalieva" },
];

const PRODUCT_TITLE = "From Sonographer to CEO — Ultrasound Business Blueprint";
const PRODUCT_ID = 1;
const BASE_URL = "https://app.allaboutultrasound.com";

async function getConnection() {
  const url = new URL(DB_URL);
  return createConnection({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  });
}

async function sendEmail(to, subject, htmlBody) {
  const fetch = globalThis.fetch;
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to.email, name: to.name }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [{ type: "text/html", value: htmlBody }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${text}`);
  }
  console.log(`✅ Email sent to ${to.email}`);
}

async function main() {
  const conn = await getConnection();
  
  for (const customer of CUSTOMERS) {
    console.log(`\nProcessing ${customer.name} (${customer.email})...`);
    
    // Find user
    const [users] = await conn.execute(
      "SELECT id, name, firstName, email, accessToken FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [customer.email]
    );
    
    let userId = null;
    let firstName = customer.name.split(" ")[0];
    
    if (users.length > 0) {
      userId = users[0].id;
      firstName = users[0].firstName || firstName;
      console.log(`  Found user ID: ${userId}`);
    } else {
      console.log(`  No user found for ${customer.email} — will send email without account link`);
    }
    
    // Check if digital_purchase exists
    if (userId) {
      const [existing] = await conn.execute(
        "SELECT id FROM digital_purchases WHERE user_id = ? AND product_id = ? LIMIT 1",
        [userId, PRODUCT_ID]
      );
      
      if (existing.length === 0) {
        // Grant access
        await conn.execute(
          "INSERT INTO digital_purchases (user_id, product_id, created_at) VALUES (?, ?, NOW())",
          [userId, PRODUCT_ID]
        );
        console.log(`  ✅ Granted download access (digital_purchases inserted)`);
      } else {
        console.log(`  Access already granted (digital_purchases exists)`);
      }
    }
    
    // Generate access token if user exists
    let accessUrl = `${BASE_URL}/downloads`;
    if (userId) {
      // Use existing accessToken from users table or create one
      let token = users[0].accessToken;
      if (!token) {
        const crypto = await import("crypto");
        token = crypto.randomBytes(32).toString("hex");
        await conn.execute(
          "UPDATE users SET accessToken = ? WHERE id = ?",
          [token, userId]
        );
        console.log(`  Created new access token`);
      } else {
        console.log(`  Using existing access token`);
      }
      
      accessUrl = `${BASE_URL}/auth/access?token=${token}&next=${encodeURIComponent(`${BASE_URL}/downloads`)}`;
    }
    
    // Build the email HTML
    const downloadPageUrl = `${BASE_URL}/downloads/from-sonographer-to-ceo-ebook`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">All About Ultrasound</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Your purchase is ready</p>
      </div>
      <!-- Body -->
      <div style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Hi ${firstName}! 👋</h2>
        <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
          Thank you for your purchase of <strong>${PRODUCT_TITLE}</strong>. Your download is ready and waiting for you!
        </p>
        
        <!-- Product Card -->
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 4px;font-weight:600;color:#0f172a;font-size:15px;">📥 ${PRODUCT_TITLE}</p>
          <p style="margin:0;color:#475569;font-size:13px;">Digital Download — Instant Access</p>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align:center;margin:24px 0;">
          <a href="${accessUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">
            Access Your Download →
          </a>
        </div>
        
        <p style="margin:24px 0 0;color:#64748b;font-size:13px;text-align:center;">
          Or copy this link: <a href="${accessUrl}" style="color:#0d9488;">${accessUrl}</a>
        </p>
        
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        
        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
          Questions? Reply to this email or contact us at support@allaboutultrasound.com<br>
          © All About Ultrasound™
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
    
    // Send the email
    await sendEmail(
      { email: customer.email, name: customer.name },
      `Your download is ready: ${PRODUCT_TITLE}`,
      emailHtml
    );
  }
  
  await conn.end();
  console.log("\n✅ All done!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
