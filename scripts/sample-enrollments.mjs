import { config } from 'dotenv';
config();

const key = process.env.THINKIFIC_API_KEY;
const sub = process.env.THINKIFIC_SUBDOMAIN || 'member';

async function thinkificFetch(path) {
  const res = await fetch(`https://api.thinkific.com/api/public/v1${path}`, {
    headers: {
      'X-Auth-API-Key': key,
      'X-Auth-Subdomain': sub,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

async function main() {
  // List courses
  const courses = await thinkificFetch('/courses?limit=25');
  const acs = courses.items?.find(c => c.name?.includes('ACS') || c.name?.includes('Advanced Cardiac'));
  if (!acs) {
    console.log('Available courses:');
    courses.items?.forEach(c => console.log(' ', c.id, c.name));
    return;
  }
  console.log('Found ACS course:', acs.id, acs.name);

  // Get first page of enrollments
  const enr = await thinkificFetch(`/enrollments?query[course_id]=${acs.id}&limit=5`);
  console.log('\nMeta:', JSON.stringify(enr.meta));
  console.log('\nSample enrollment (first item):');
  console.log(JSON.stringify(enr.items?.[0], null, 2));

  // Count expired vs active
  let page = 1;
  let total = 0, expired = 0, active = 0;
  let hasMore = true;
  while (hasMore) {
    const data = await thinkificFetch(`/enrollments?query[course_id]=${acs.id}&limit=250&page=${page}`);
    const items = data.items || [];
    total += items.length;
    for (const e of items) {
      if (e.expired) expired++;
      else active++;
    }
    hasMore = items.length === 250;
    page++;
    if (page > 20) break; // safety
  }
  console.log(`\nTotal: ${total}, Active: ${active}, Expired: ${expired}`);
}

main().catch(e => console.error(e.message));
