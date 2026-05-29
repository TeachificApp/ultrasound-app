/**
 * Grant download access for two affected customers and send them access emails.
 * - Crystal Ceri (Crystalceri25@gmail.com)
 * - Shahnoz (shahnoz1@hotmail.com)
 * Product: From Sonographer to CEO eBook (digital_products.id = 1)
 */
import { createConnection } from 'mysql2/promise';
import crypto from 'crypto';

const MYSQL_URL = process.env.RAILWAY_MYSQL_URL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'hello@allaboutultrasound.com';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'All About Ultrasound';
const PRODUCT_ID = 1;
const PRODUCT_NAME = 'From Sonographer to CEO eBook';
const BASE_URL = 'https://app.allaboutultrasound.com';

const CUSTOMERS = [
  { email: 'Crystalceri25@gmail.com', name: 'Crystal Ceri', firstName: 'Crystal', lastName: 'Ceri' },
  { email: 'shahnoz1@hotmail.com', name: 'Shahnoz Mamasalieva', firstName: 'Shahnoz', lastName: 'Mamasalieva' },
];

async function sendAccessEmail(email, name, firstName, isNew, resetToken) {
  const downloadUrl = `${BASE_URL}/my-downloads`;
  const setPasswordUrl = resetToken ? `${BASE_URL}/auth/reset-password?token=${resetToken}` : `${BASE_URL}/my-downloads`;

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #189aa1; padding: 32px 40px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">All About Ultrasound™</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">UltrasoundAssist™</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #0e4a50; margin: 0 0 16px;">Hi ${firstName}! Your eBook is ready 🎉</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
        Thank you for your purchase of <strong>${PRODUCT_NAME}</strong>.
        Your download access is now active.
      </p>
      <div style="background: #f0fbfc; border: 1px solid #b2e8eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #0e4a50;">Access your download:</p>
        <a href="${downloadUrl}" style="display: inline-block; background: #189aa1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px;">Download Your eBook →</a>
      </div>
      ${isNew && resetToken ? `
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #9a3412;">Set your password to access your account:</p>
        <p style="margin: 0 0 12px; color: #7c2d12; font-size: 14px;">We created your All About Ultrasound™ account. Set your password to sign in anytime.</p>
        <a href="${setPasswordUrl}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">Set Your Password</a>
      </div>` : ''}
      <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">Questions? Email us at support@allaboutultrasound.com</p>
    </div>
    <div style="background: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 All About Ultrasound™. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email, name }] }],
      from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
      subject: `Your ${PRODUCT_NAME} is ready — access it now`,
      content: [{ type: 'text/html', value: emailHtml }],
    }),
  });

  if (response.ok || response.status === 202) {
    console.log(`  ✅ Email sent to ${email}`);
  } else {
    const body = await response.text();
    console.error(`  ❌ Email failed for ${email}: ${response.status} ${body}`);
  }
}

async function processCustomer(conn, customer) {
  const { email, name, firstName, lastName } = customer;
  console.log(`\nProcessing: ${name} (${email})`);

  // Find or create user
  const [existing] = await conn.execute(
    'SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [email]
  );

  let userId;
  let isNew = false;
  let resetToken = null;

  if (existing.length > 0) {
    userId = existing[0].id;
    console.log(`  Found existing user: id=${userId}`);
  } else {
    resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await conn.execute(
      `INSERT INTO users (email, name, firstName, lastName, role, membershipTier, createdAt, updatedAt, passwordResetToken, passwordResetExpiry)
       VALUES (?, ?, ?, ?, 'user', 'free', NOW(), NOW(), ?, ?)`,
      [email.toLowerCase(), name, firstName, lastName, resetToken, resetExpiry]
    );
    const [newUser] = await conn.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    userId = newUser[0].id;
    isNew = true;
    console.log(`  Created new user: id=${userId}`);
  }

  // Grant digital purchase access
  const [existingPurchase] = await conn.execute(
    'SELECT id FROM digital_purchases WHERE user_id = ? AND product_id = ? LIMIT 1',
    [userId, PRODUCT_ID]
  );

  if (existingPurchase.length > 0) {
    console.log(`  Download access already exists — skipping insert`);
  } else {
    await conn.execute(
      'INSERT INTO digital_purchases (user_id, product_id, stripe_checkout_session_id, purchased_at) VALUES (?, ?, ?, NOW())',
      [userId, PRODUCT_ID, 'manual-grant-admin']
    );
    console.log(`  ✅ Granted download access: user ${userId}, product ${PRODUCT_ID}`);
  }

  // Link user_id in funnel_purchases
  const [fpUpdate] = await conn.execute(
    'UPDATE funnel_purchases SET user_id = ? WHERE LOWER(email) = LOWER(?) AND user_id IS NULL',
    [userId, email]
  );
  if (fpUpdate.affectedRows > 0) {
    console.log(`  Linked ${fpUpdate.affectedRows} funnel_purchase record(s) to user ${userId}`);
  }

  // Send email
  if (SENDGRID_API_KEY) {
    await sendAccessEmail(email, name, firstName, isNew, resetToken);
  } else {
    console.warn('  No SENDGRID_API_KEY — skipping email');
    console.log(`  Download URL: ${BASE_URL}/my-downloads`);
    if (resetToken) console.log(`  Set password URL: ${BASE_URL}/auth/reset-password?token=${resetToken}`);
  }
}

async function run() {
  if (!MYSQL_URL) { console.error('No RAILWAY_MYSQL_URL'); process.exit(1); }
  const u = new URL(MYSQL_URL);
  const conn = await createConnection({
    host: u.hostname, port: Number(u.port || 3306),
    user: u.username, password: u.password,
    database: u.pathname.slice(1), ssl: { rejectUnauthorized: false }
  });
  console.log('Connected to DB');

  for (const customer of CUSTOMERS) {
    await processCustomer(conn, customer);
  }

  await conn.end();
  console.log('\n✅ All done!');
}

run().catch(console.error);
