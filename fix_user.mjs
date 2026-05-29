import mysql from 'mysql2/promise';
import crypto from 'crypto';

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL);

const email = 'beltranamador@ymail.com';
const name = 'Amador Beltran';
const productId = 1; // From Sonographer to CEO eBook

// Step 1: Check if user already exists
const [existing] = await conn.execute("SELECT id, email FROM users WHERE email = ? LIMIT 1", [email]);
let userId;

if (existing.length > 0) {
  userId = existing[0].id;
  console.log(`User already exists with id=${userId}`);
} else {
  // Create the user account
  const openId = `email:${email}`;
  const now = new Date();
  await conn.execute(`
    INSERT INTO users (email, name, displayName, openId, loginMethod, emailVerified, isPending, createdAt, updatedAt, lastSignedIn, membershipTier)
    VALUES (?, ?, ?, ?, 'stripe_purchase', 1, 0, ?, ?, ?, 'free')
  `, [email, name, name, openId, now, now, now]);
  
  const [newUser] = await conn.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  userId = newUser[0].id;
  console.log(`Created new user with id=${userId}`);
}

// Step 2: Check if purchase already exists
const [existingPurchase] = await conn.execute(
  "SELECT id FROM digital_purchases WHERE user_id = ? AND product_id = ? LIMIT 1",
  [userId, productId]
);

if (existingPurchase.length > 0) {
  console.log(`Purchase already exists for user ${userId}, product ${productId}`);
} else {
  // Grant download access
  await conn.execute(`
    INSERT INTO digital_purchases (user_id, product_id, stripe_payment_intent_id, stripe_checkout_session_id, purchased_at)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, productId, 'pi_manual_receipt_1148_8080', 'cs_manual_receipt_1148_8080', new Date('2026-05-27T20:43:42Z')]);
  console.log(`Granted download access for user ${userId}, product ${productId}`);
}

// Step 3: Get the product files
const [files] = await conn.execute("SELECT * FROM digital_product_files WHERE product_id = ?", [productId]);
console.log(`Product has ${files.length} file(s):`, files.map(f => f.file_name));

// Step 4: Generate a magic link token for login
const magicToken = crypto.randomBytes(32).toString('hex');
const magicExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
await conn.execute(
  "UPDATE users SET magicLinkToken = ?, magicLinkExpiry = ? WHERE id = ?",
  [magicToken, magicExpiry, userId]
);
console.log(`Magic link token set. Token: ${magicToken}`);
console.log(`Login URL: https://learn.allaboutultrasound.com/auth/magic?token=${magicToken}`);

// Step 5: Get product info for email
const [products] = await conn.execute("SELECT * FROM digital_products WHERE id = ?", [productId]);
const product = products[0];
console.log(`\nProduct: ${product.title}`);
console.log(`Files:`, files.map(f => `${f.file_name} -> ${f.file_url}`));

console.log(`\n=== SUMMARY ===`);
console.log(`User ID: ${userId}`);
console.log(`Email: ${email}`);
console.log(`Name: ${name}`);
console.log(`Product: ${product.title} (id=${productId})`);
console.log(`Magic login URL: https://learn.allaboutultrasound.com/auth/magic?token=${magicToken}`);
console.log(`Download URL: https://learn.allaboutultrasound.com/downloads`);

await conn.end();
