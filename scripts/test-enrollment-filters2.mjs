import { config } from 'dotenv';
config();

const key = process.env.THINKIFIC_API_KEY;
const sub = process.env.THINKIFIC_SUBDOMAIN || 'member';
const COURSE_ID = 571677;

async function thinkificFetch(path) {
  const res = await fetch(`https://api.thinkific.com/api/public/v1${path}`, {
    headers: {
      'X-Auth-API-Key': key,
      'X-Auth-Subdomain': sub,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 200) }; }
}

async function main() {
  // Test query[expired]=false
  const r1 = await thinkificFetch(`/enrollments?query[course_id]=${COURSE_ID}&query[expired]=false&page=1&limit=5`);
  console.log('expired=false meta:', JSON.stringify(r1.meta?.pagination));
  console.log('first item expired:', r1.items?.[0]?.expired, 'is_free_trial:', r1.items?.[0]?.is_free_trial);

  // Test query[is_free_trial]=false
  const r2 = await thinkificFetch(`/enrollments?query[course_id]=${COURSE_ID}&query[is_free_trial]=false&page=1&limit=5`);
  console.log('\nis_free_trial=false meta:', JSON.stringify(r2.meta?.pagination));
  console.log('first item expired:', r2.items?.[0]?.expired, 'is_free_trial:', r2.items?.[0]?.is_free_trial);

  // Test both
  const r3 = await thinkificFetch(`/enrollments?query[course_id]=${COURSE_ID}&query[expired]=false&query[is_free_trial]=false&page=1&limit=5`);
  console.log('\nboth false meta:', JSON.stringify(r3.meta?.pagination));

  // Raw response check for expired=false
  console.log('\nRaw r1 keys:', Object.keys(r1));
}

main().catch(e => console.error(e.message));
