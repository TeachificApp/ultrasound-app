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
  console.log('Course:', acs.id, acs.name);

  const all = await fetchAllPages(`/enrollments?query[course_id]=${acs.id}`);
  
  // The 14 we currently import
  const activated = all.filter(e => !e.expired && e.activated_at !== null);
  // The 7 that are non-expired, no activated_at, but have some signal of being real
  const nonExpiredNoActivation = all.filter(e => !e.expired && e.activated_at === null);
  
  console.log(`\nActivated (current import): ${activated.length}`);
  console.log(`Non-expired, no activated_at: ${nonExpiredNoActivation.length}`);
  
  // Show ALL non-expired, no activated_at sorted by started_at desc
  console.log('\n--- All non-expired without activated_at (sorted by started_at desc) ---');
  const sorted = nonExpiredNoActivation.sort((a, b) => 
    new Date(b.started_at || 0) - new Date(a.started_at || 0)
  );
  for (const e of sorted.slice(0, 30)) {
    console.log(`  ${e.user_email} | trial:${e.is_free_trial} | started: ${e.started_at?.slice(0,10)} | progress: ${(parseFloat(e.percentage_completed)*100).toFixed(0)}% | expiry: ${e.expiry_date}`);
  }

  // Check the users from the screenshot: Turi Wiedner, Sylvia Nieto, Jessica Powers-Hall, Sloane Farris, Elizabeth Bolger-Linser, Meredith Rose
  const knownEmails = [
    'twiedner@kumc.edu',
    'sylvia.faith316@gmail.com', 
    'jessica.powershall@asante.org',
    'sfarris676@gmail.com',
    'elizabethamoore2011@gmail.com',
    'rose.meredith.lee@gmail.com',
  ];
  console.log('\n--- Checking known enrolled users from screenshot ---');
  for (const email of knownEmails) {
    const e = all.find(x => x.user_email.toLowerCase() === email.toLowerCase());
    if (e) {
      console.log(`  ${email}: expired=${e.expired}, activated_at=${e.activated_at}, is_free_trial=${e.is_free_trial}, started=${e.started_at?.slice(0,10)}`);
    } else {
      console.log(`  ${email}: NOT FOUND in enrollments API`);
    }
  }
}

main().catch(e => console.error(e.message));
