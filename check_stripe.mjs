import Stripe from 'stripe';
import mysql from 'mysql2/promise';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const email = 'beltranamador@ymail.com';

// Search Stripe for this customer
console.log("=== Searching Stripe for customer ===");
const customers = await stripe.customers.list({ email, limit: 5 });
console.log("Customers found:", customers.data.length);
for (const c of customers.data) {
  console.log(`  Customer: ${c.id} | ${c.email} | created: ${new Date(c.created * 1000).toISOString()}`);
  
  // Get their payment intents
  const pis = await stripe.paymentIntents.list({ customer: c.id, limit: 10 });
  for (const pi of pis.data) {
    console.log(`  PaymentIntent: ${pi.id} | ${pi.status} | $${pi.amount/100} | ${new Date(pi.created * 1000).toISOString()}`);
  }
  
  // Get their checkout sessions
  const sessions = await stripe.checkout.sessions.list({ customer: c.id, limit: 10 });
  for (const s of sessions.data) {
    console.log(`  CheckoutSession: ${s.id} | ${s.status} | ${s.payment_status} | metadata: ${JSON.stringify(s.metadata)}`);
  }
}

// Also search by email in checkout sessions directly
console.log("\n=== Searching checkout sessions by email ===");
const sessions = await stripe.checkout.sessions.list({ 
  limit: 100,
});
const matchingSessions = sessions.data.filter(s => 
  s.customer_email === email || 
  s.metadata?.customer_email === email ||
  s.customer_details?.email === email
);
console.log(`Found ${matchingSessions.length} sessions matching email`);
for (const s of matchingSessions) {
  console.log(`  Session: ${s.id} | status: ${s.status} | payment_status: ${s.payment_status} | amount: $${(s.amount_total||0)/100} | created: ${new Date(s.created * 1000).toISOString()}`);
  console.log(`  metadata: ${JSON.stringify(s.metadata)}`);
  console.log(`  customer_details: ${JSON.stringify(s.customer_details)}`);
}

// Check webhook events in DB
console.log("\n=== Checking DB webhook events ===");
const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL);
try {
  const [rows] = await conn.execute("SELECT * FROM webhookEvents ORDER BY id DESC LIMIT 10");
  for (const r of rows) {
    const payload = r.payload ? r.payload.substring(0, 300) : '';
    if (payload.toLowerCase().includes('beltran') || payload.toLowerCase().includes('beltranamador')) {
      console.log("FOUND matching webhook event:", JSON.stringify({...r, payload: payload}));
    }
  }
  console.log("Recent webhook events (last 5):");
  for (const r of rows.slice(0, 5)) {
    console.log(`  id=${r.id} type=${r.type || r.event_type} status=${r.status} created=${r.created_at}`);
  }
} catch(e) { console.log("webhookEvents error:", e.message); }

await conn.end();
