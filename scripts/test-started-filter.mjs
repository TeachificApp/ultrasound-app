import { config } from 'dotenv';
config();

const key = process.env.THINKIFIC_API_KEY;
const sub = process.env.THINKIFIC_SUBDOMAIN || 'member';
const COURSE_ID = 571677;

async function thinkificFetch(path) {
  const res = await fetch(`https://api.thinkific.com/api/public/v1${path}`, {
    headers: { 'X-Auth-API-Key': key, 'X-Auth-Subdomain': sub, 'Content-Type': 'application/json' },
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
  const all = await fetchAllPages(`/enrollments?query[course_id]=${COURSE_ID}`);
  console.log(`Total: ${all.length}`);

  // Various filter combinations
  const filters = {
    '!expired': all.filter(e => !e.expired).length,
    '!expired && activated_at': all.filter(e => !e.expired && e.activated_at).length,
    '!expired && started_at': all.filter(e => !e.expired && e.started_at).length,
    '!expired && (activated_at || started_at)': all.filter(e => !e.expired && (e.activated_at || e.started_at)).length,
    '!expired && !is_free_trial': all.filter(e => !e.expired && !e.is_free_trial).length,
    '!expired && (activated_at || !is_free_trial)': all.filter(e => !e.expired && (e.activated_at || !e.is_free_trial)).length,
    '!expired && activated_at && !is_free_trial': all.filter(e => !e.expired && e.activated_at && !e.is_free_trial).length,
    // Check if the 7 missing have started_at
    'trial && !expired && started_at': all.filter(e => !e.expired && e.is_free_trial && e.started_at).length,
    'trial && !expired && !activated_at && started_at': all.filter(e => !e.expired && e.is_free_trial && !e.activated_at && e.started_at).length,
  };

  for (const [label, count] of Object.entries(filters)) {
    console.log(`  ${label}: ${count}`);
  }

  // The 7 missing: free trial, not expired, no activated_at
  const missing7 = all.filter(e => !e.expired && e.is_free_trial && !e.activated_at);
  console.log(`\nFree trial, not expired, no activated_at: ${missing7.length}`);
  // How many have started_at?
  const withStarted = missing7.filter(e => e.started_at);
  console.log(`  ...of which have started_at: ${withStarted.length}`);
  
  // Show the 7 that Thinkific admin counts (the ones with started_at recently)
  // Sort by started_at desc and show top 10
  const recentlyStarted = missing7.filter(e => e.started_at).sort((a,b) => 
    new Date(b.started_at) - new Date(a.started_at)
  );
  console.log('\nRecently started free trials (top 10):');
  recentlyStarted.slice(0, 10).forEach(e => {
    console.log(`  ${e.user_email} | started: ${e.started_at?.slice(0,10)} | progress: ${(parseFloat(e.percentage_completed)*100).toFixed(0)}%`);
  });
}

main().catch(e => console.error(e.message));
