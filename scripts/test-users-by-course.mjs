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
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; }
}

async function fetchAllPages(basePath, limit = 250) {
  const results = [];
  let page = 1;
  while (true) {
    const sep = basePath.includes('?') ? '&' : '?';
    const data = await thinkificFetch(`${basePath}${sep}page=${page}&limit=${limit}`);
    results.push(...(data.items || []));
    if (!data.meta?.pagination?.next_page) break;
    page++;
    if (page > 50) break;
  }
  return results;
}

async function main() {
  // Try /users?query[course_id]=X — this is what Thinkific admin uses
  const r1 = await thinkificFetch(`/users?query[course_id]=${COURSE_ID}&page=1&limit=5`);
  console.log('Users by course_id meta:', JSON.stringify(r1.meta?.pagination));
  console.log('Sample user:', JSON.stringify(r1.items?.[0]));

  // Try with enrolled_in filter
  const r2 = await thinkificFetch(`/users?query[enrolled_in_course_id]=${COURSE_ID}&page=1&limit=5`);
  console.log('\nUsers by enrolled_in_course_id meta:', JSON.stringify(r2.meta?.pagination));

  // Check the 7 missing users - are they in the users API by course?
  const knownMissing = [
    'rose.meredith.lee@gmail.com',
  ];
  
  // Get all users enrolled in this course via the users API
  console.log('\nFetching all users enrolled in course via /users API...');
  const allUsers = await fetchAllPages(`/users?query[course_id]=${COURSE_ID}`);
  console.log(`Total users from /users API: ${allUsers.length}`);
  
  // Check if Meredith Rose is in there
  const meredith = allUsers.find(u => u.email?.toLowerCase().includes('rose.meredith'));
  console.log('Meredith Rose in users API:', meredith ? JSON.stringify(meredith) : 'NOT FOUND');
  
  // Show all user emails
  console.log('\nAll enrolled user emails:');
  allUsers.forEach(u => console.log(' ', u.email));
}

main().catch(e => console.error(e.message));
