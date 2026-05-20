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
  return res.json();
}

async function countPages(basePath) {
  const data = await thinkificFetch(`${basePath}&page=1&limit=1`);
  return data.meta?.pagination?.total_items ?? '?';
}

async function main() {
  console.log('Testing different enrollment API filters for course', COURSE_ID);
  
  // Test various query params
  const filters = [
    `?query[course_id]=${COURSE_ID}`,
    `?query[course_id]=${COURSE_ID}&query[expired]=false`,
    `?query[course_id]=${COURSE_ID}&query[is_free_trial]=false`,
    `?query[course_id]=${COURSE_ID}&query[expired]=false&query[is_free_trial]=false`,
    `?query[course_id]=${COURSE_ID}&query[activated]=true`,
  ];

  for (const f of filters) {
    const count = await countPages(f);
    console.log(`  ${f.replace(`?query[course_id]=${COURSE_ID}`, '')}: ${count}`);
  }

  // Also check the users endpoint filtered by course
  const usersData = await thinkificFetch(`/users?query[course_id]=${COURSE_ID}&page=1&limit=1`);
  console.log(`\n  /users?query[course_id]: ${usersData.meta?.pagination?.total_items ?? JSON.stringify(usersData).slice(0,100)}`);
}

main().catch(e => console.error(e.message));
