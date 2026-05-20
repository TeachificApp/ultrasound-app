import { config } from 'dotenv';
config();

const key = process.env.THINKIFIC_API_KEY;
const sub = process.env.THINKIFIC_SUBDOMAIN || 'member';
const COURSE_ID = 571677;

// The 21 emails from the CSV export (Thinkific admin "Enrolled in Course" filter)
const CSV_EMAILS = [
  'abdul1abdul@yahoo.com',
  'alefeya@gmail.com',
  'doug-angie@comcast.net',
  'elizabethamoore2011@gmail.com',
  'ernstmm07@yahoo.com',
  'glammertin@gmail.com',
  'hrmnheather@yahoo.com',
  'jaynel_dunlap@yahoo.com',
  'jessica.powershall@asante.org',
  'jesusoballing@gmail.com',
  'lauren22castro@gmail.com',
  'mahtab_abbasi@yahoo.com',
  'pkevp@icloud.com',
  'rastremaria@gmail.com',
  'rmbarrentine@gmail.com',
  'rose.meredith.lee@gmail.com',
  'sfarris676@gmail.com',
  'sylvia.faith316@gmail.com',
  'tonya.matthis@wvumedicine.org',
  'twiedner@kumc.edu',
].map(e => e.toLowerCase());

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
  console.log(`CSV has ${CSV_EMAILS.length} emails`);

  const all = await fetchAllPages(`/enrollments?query[course_id]=${COURSE_ID}`);
  console.log(`API has ${all.length} total enrollments`);

  // Check each CSV email against API
  console.log('\n--- CSV email vs API enrollment data ---');
  for (const email of CSV_EMAILS) {
    const e = all.find(x => x.user_email?.toLowerCase() === email);
    if (e) {
      console.log(`  ${email}: expired=${e.expired}, activated_at=${e.activated_at ? 'SET' : 'null'}, is_free_trial=${e.is_free_trial}`);
    } else {
      console.log(`  ${email}: NOT IN API`);
    }
  }

  // Find the common pattern for the 7 that have activated_at=null
  const missing = CSV_EMAILS.filter(email => {
    const e = all.find(x => x.user_email?.toLowerCase() === email);
    return e && !e.activated_at;
  });
  console.log(`\nCSV emails with activated_at=null: ${missing.length}`);
  missing.forEach(email => {
    const e = all.find(x => x.user_email?.toLowerCase() === email);
    console.log(`  ${email}: is_free_trial=${e.is_free_trial}, started=${e.started_at?.slice(0,10)}, progress=${e.percentage_completed}`);
  });
}

main().catch(e => console.error(e.message));
