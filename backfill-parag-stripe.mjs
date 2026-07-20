import { createConnection } from 'mysql2/promise';
import Stripe from 'stripe';

const db = await createConnection(process.env.DATABASE_URL);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Look up Parag's Stripe customer by email
const customers = await stripe.customers.list({ email: 'tipnis@wisc.edu', limit: 5 });
console.log('Stripe customers found:', customers.data.length);
for (const c of customers.data) {
  console.log(`  id=${c.id} name=${c.name} email=${c.email} created=${new Date(c.created * 1000).toISOString()}`);
}

if (customers.data.length === 0) {
  console.log('No Stripe customer found for tipnis@wisc.edu');
  await db.end();
  process.exit(0);
}

// Use the most recent customer
const customer = customers.data[0];
console.log('\nUsing customer:', customer.id);

// Check their invoices
const invoices = await stripe.invoices.list({ customer: customer.id, status: 'paid', limit: 10 });
console.log('Paid invoices:', invoices.data.length);
for (const inv of invoices.data) {
  console.log(`  id=${inv.id} amount=${inv.amount_paid} date=${new Date(inv.created * 1000).toISOString()} desc=${inv.description ?? inv.lines?.data?.[0]?.description}`);
}

// Backfill stripeCustomerId in brandMemberships for Parag's iHeartEcho lifetime membership
const [result] = await db.execute(
  'UPDATE brandMemberships SET stripeCustomerId = ? WHERE userId = 12120277 AND brand = ? AND tier = ?',
  [customer.id, 'iheartecho', 'lifetime']
);
console.log('\nUpdated brandMemberships rows:', result.affectedRows);

await db.end();
console.log('Done.');
process.exit(0);
