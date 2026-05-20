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
  // Find ACS course
  const courses = await thinkificFetch('/courses?limit=25');
  const acs = courses.items?.find(c => c.name?.includes('ACS') || c.name?.includes('Advanced Cardiac'));
  if (!acs) {
    console.log('Available courses:', courses.items?.map(c => `${c.id} ${c.name}`));
    return;
  }
  console.log('Course:', acs.id, acs.name);

  // Fetch all enrollments
  const all = await fetchAllPages(`/enrollments?query[course_id]=${acs.id}`);
  console.log(`\nTotal enrollments: ${all.length}`);

  // Categorize
  const expired = all.filter(e => e.expired);
  const freeTrial = all.filter(e => !e.expired && e.is_free_trial);
  const active = all.filter(e => !e.expired && !e.is_free_trial);
  
  console.log(`Expired: ${expired.length}`);
  console.log(`Free trial (non-expired): ${freeTrial.length}`);
  console.log(`Active paid (non-expired, non-trial): ${active.length}`);

  // Show all active paid enrollments
  console.log('\n--- Active paid enrollments ---');
  for (const e of active) {
    console.log(`  ${e.user_email} | activated_at: ${e.activated_at} | started: ${e.started_at} | progress: ${e.percentage_completed}`);
  }

  // Show a few free trial ones to understand them
  console.log('\n--- Sample free trial enrollments (first 5) ---');
  for (const e of freeTrial.slice(0, 5)) {
    console.log(`  ${e.user_email} | activated_at: ${e.activated_at} | started: ${e.started_at} | progress: ${e.percentage_completed}`);
  }

  // Check: are any free trials actually active/paying students?
  const trialWithProgress = freeTrial.filter(e => parseFloat(e.percentage_completed) > 0);
  console.log(`\nFree trials WITH progress > 0: ${trialWithProgress.length}`);
  for (const e of trialWithProgress.slice(0, 10)) {
    console.log(`  ${e.user_email} | progress: ${e.percentage_completed} | activated_at: ${e.activated_at}`);
  }
}

main().catch(e => console.error(e.message));
