import { config } from 'dotenv';
config();

const key = process.env.THINKIFIC_API_KEY;
const sub = process.env.THINKIFIC_SUBDOMAIN || 'member';
const COURSE_ID = 571677;

// Ground truth from CSV export
const CSV_EMAILS = new Set([
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
].map(e => e.toLowerCase()));

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

function isActiveEnrollment(e) {
  if (e.expired) return false;
  // Paid/activated enrollment
  if (e.activated_at) return true;
  // Free trial but has actually engaged (started + some progress)
  if (e.is_free_trial && e.started_at && parseFloat(e.percentage_completed) > 0) return true;
  return false;
}

async function main() {
  const all = await fetchAllPages(`/enrollments?query[course_id]=${COURSE_ID}`);

  const filtered = all.filter(isActiveEnrollment);
  const filteredEmails = new Set(filtered.map(e => e.user_email.toLowerCase()));

  console.log(`Filter result: ${filtered.length}`);
  console.log(`CSV emails: ${CSV_EMAILS.size}`);

  // Check overlap
  const inBoth = [...CSV_EMAILS].filter(e => filteredEmails.has(e));
  const inCsvOnly = [...CSV_EMAILS].filter(e => !filteredEmails.has(e));
  const inFilterOnly = [...filteredEmails].filter(e => !CSV_EMAILS.has(e));

  console.log(`\nIn both: ${inBoth.length}`);
  console.log(`In CSV only (missed by filter): ${inCsvOnly.length}`);
  inCsvOnly.forEach(e => {
    const enrollment = all.find(x => x.user_email.toLowerCase() === e);
    console.log(`  ${e}: ${JSON.stringify({ expired: enrollment?.expired, activated_at: enrollment?.activated_at, is_free_trial: enrollment?.is_free_trial, progress: enrollment?.percentage_completed, started: enrollment?.started_at?.slice(0,10) })}`);
  });
  console.log(`\nIn filter only (false positives): ${inFilterOnly.length}`);
  inFilterOnly.slice(0, 5).forEach(e => {
    const enrollment = all.find(x => x.user_email.toLowerCase() === e);
    console.log(`  ${e}: progress=${enrollment?.percentage_completed}, started=${enrollment?.started_at?.slice(0,10)}`);
  });
}

main().catch(e => console.error(e.message));
