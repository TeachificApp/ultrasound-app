import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
if (!url) { console.log('No DB URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

const userId = 30462;   // Daniel Galindo - psndiddle@hotmail.com
const courseId = 180001; // Advanced Cardiac Sonographer (ACS) - Registry Review Quiz
const amountCents = 9997; // $99.97 as shown in Stripe email
const stripePaymentIntentId = 'pi_3TeDTjBj9HgnkZLK086ylOZ1'; // from the Stripe email

// Check for existing enrollment
const [existingEnrollments] = await conn.execute(
  'SELECT id FROM lms_enrollments WHERE user_id = ? AND course_id = ?',
  [userId, courseId]
);
console.log('Existing enrollments:', JSON.stringify(existingEnrollments));

if (existingEnrollments.length > 0) {
  console.log('User is already enrolled! No action needed.');
  await conn.end();
  process.exit(0);
}

// Check for existing order
const [existingOrders] = await conn.execute(
  'SELECT id, status FROM lms_orders WHERE user_id = ? AND course_id = ?',
  [userId, courseId]
);
console.log('Existing orders:', JSON.stringify(existingOrders));

let orderId;

if (existingOrders.length > 0) {
  // Update existing order to paid
  orderId = existingOrders[0].id;
  await conn.execute(
    'UPDATE lms_orders SET status = ?, stripe_payment_intent_id = ? WHERE id = ?',
    ['paid', stripePaymentIntentId, orderId]
  );
  console.log(`Updated existing order ${orderId} to paid`);
} else {
  // Create a new paid order
  const [result] = await conn.execute(
    'INSERT INTO lms_orders (user_id, course_id, amount, currency, stripe_payment_intent_id, status, seats, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [userId, courseId, amountCents, 'usd', stripePaymentIntentId, 'paid', 1]
  );
  orderId = result.insertId;
  console.log(`Created new order ${orderId}`);
}

// Create the enrollment
const [enrollResult] = await conn.execute(
  'INSERT INTO lms_enrollments (user_id, course_id, order_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
  [userId, courseId, orderId]
);
console.log(`Created enrollment ${enrollResult.insertId} for user ${userId} in course ${courseId}`);

// Verify
const [verify] = await conn.execute(
  'SELECT e.id, e.user_id, e.course_id, e.order_id, e.created_at, o.status as order_status, o.amount FROM lms_enrollments e JOIN lms_orders o ON e.order_id = o.id WHERE e.user_id = ? AND e.course_id = ?',
  [userId, courseId]
);
console.log('Verification:', JSON.stringify(verify, null, 2));

await conn.end();
console.log('Done!');
