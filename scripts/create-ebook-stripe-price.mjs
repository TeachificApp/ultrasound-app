/**
 * Creates a Stripe product + price for "From Sonographer to CEO eBook" at $97,
 * links it to digital_products.id=1, and creates a membership plan with the
 * digital product as an access item.
 */

import Stripe from "stripe";
import mysql from "mysql2/promise";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== Create Stripe Price: From Sonographer to CEO eBook ===\n");

// 1. Get the digital product
const [products] = await db.execute(
  "SELECT id, title, stripe_price_id FROM digital_products WHERE id = 1"
);
const product = products[0];
if (!product) throw new Error("Digital product id=1 not found");

console.log(`Product: [${product.id}] ${product.title}`);
console.log(`Current stripe_price_id: ${product.stripe_price_id || "(none)"}\n`);

if (product.stripe_price_id) {
  console.log("Already has a Stripe price ID — skipping Stripe creation.");
  console.log("Price ID:", product.stripe_price_id);
} else {
  // 2. Create Stripe product
  console.log("Creating Stripe product...");
  const stripeProduct = await stripe.products.create({
    name: "From Sonographer to CEO eBook",
    description: "Complete guide to starting and running an ultrasound business",
    metadata: { digital_product_id: "1", platform: "allaboutultrasound" },
  });
  console.log("Stripe product created:", stripeProduct.id);

  // 3. Create Stripe price ($97 one-time)
  console.log("Creating Stripe price ($97 one-time)...");
  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: 9700, // $97.00
    currency: "usd",
    metadata: { digital_product_id: "1" },
  });
  console.log("Stripe price created:", stripePrice.id);

  // 4. Update digital_products with stripe IDs
  await db.execute(
    "UPDATE digital_products SET stripe_price_id = ?, stripe_product_id = ? WHERE id = 1",
    [stripePrice.id, stripeProduct.id]
  );
  console.log("Updated digital_products.stripe_price_id =", stripePrice.id);

  // 5. Check if membership plan already exists for this price
  const [existingPlans] = await db.execute(
    "SELECT id, title FROM membership_plans WHERE stripe_price_id = ?",
    [stripePrice.id]
  );

  if (existingPlans.length > 0) {
    console.log(`\nMembership plan already exists: [${existingPlans[0].id}] ${existingPlans[0].title}`);
  } else {
    // 6. Create membership plan
    console.log("\nCreating membership plan...");
    const slug = "from-sonographer-to-ceo-ebook";
    const [result] = await db.execute(
      `INSERT INTO membership_plans
        (title, slug, status, billing_interval, price, currency, stripe_price_id, stripe_product_id, sort_order)
       VALUES (?, ?, 'published', 'one_time', 97.00, 'usd', ?, ?, 0)`,
      ["From Sonographer to CEO eBook", slug, stripePrice.id, stripeProduct.id]
    );
    const planId = result.insertId;
    console.log("Membership plan created: id =", planId);

    // 7. Add digital product as access item
    await db.execute(
      "INSERT INTO membership_plan_access (plan_id, item_type, item_id, label, sort_order) VALUES (?, 'download', 1, 'From Sonographer to CEO eBook', 0)",
      [planId]
    );
    console.log("Access item added: download id=1");
  }
}

await db.end();
console.log("\nDone.");
