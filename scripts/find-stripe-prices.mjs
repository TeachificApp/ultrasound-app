/**
 * find-stripe-prices.mjs
 * Searches Stripe for products matching the course names that are missing price IDs.
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const require = createRequire(import.meta.url);
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const targetCourses = [
  "Ultrasound Physics SPI Review Quiz",
  "From Sonographer to CEO",
  "Fetal Echo Quiz",
  "Abdomen Quiz",
  // Ergonomics CME is free - no price ID needed
];

console.log("Searching Stripe products...\n");

// List all products and find matches
const products = [];
let hasMore = true;
let startingAfter = undefined;

while (hasMore) {
  const page = await stripe.products.list({ limit: 100, starting_after: startingAfter });
  products.push(...page.data);
  hasMore = page.has_more;
  if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id;
}

console.log(`Total Stripe products: ${products.length}\n`);

for (const courseName of targetCourses) {
  const keywords = courseName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const matches = products.filter(p => {
    const name = p.name.toLowerCase();
    return keywords.some(kw => name.includes(kw));
  });
  
  console.log(`\n=== ${courseName} ===`);
  if (matches.length === 0) {
    console.log("  No matching Stripe products found");
  } else {
    for (const product of matches) {
      console.log(`  Product: "${product.name}" (${product.id}) - active: ${product.active}`);
      // Get prices for this product
      const prices = await stripe.prices.list({ product: product.id, limit: 10 });
      for (const price of prices.data) {
        const amount = price.unit_amount ? `$${(price.unit_amount / 100).toFixed(2)}` : "custom";
        const interval = price.recurring ? `/${price.recurring.interval}` : " one-time";
        console.log(`    Price: ${price.id} — ${amount}${interval} — active: ${price.active}`);
      }
    }
  }
}

console.log("\nDone.");
