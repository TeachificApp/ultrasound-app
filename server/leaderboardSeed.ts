/**
 * leaderboardSeed.ts
 *
 * Generates a deterministic but daily-rotating virtual leaderboard of 1,200+
 * echo professionals. The seed is derived from the current UTC date, so the
 * rankings shift every day while remaining stable within a single day.
 *
 * Used by getLeaderboard to pad the board when real users are sparse.
 */

// ─── Name pools ──────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles",
  "Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua",
  "Kenneth","Kevin","Brian","George","Timothy","Ronald","Edward","Jason","Jeffrey","Ryan",
  "Jacob","Gary","Nicholas","Eric","Jonathan","Stephen","Larry","Justin","Scott","Brandon",
  "Benjamin","Samuel","Raymond","Gregory","Frank","Alexander","Patrick","Jack","Dennis","Jerry",
  "Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen",
  "Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna",
  "Michelle","Carol","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia",
  "Kathleen","Amy","Angela","Shirley","Anna","Brenda","Pamela","Emma","Nicole","Helen",
  "Samantha","Katherine","Christine","Debra","Rachel","Carolyn","Janet","Catherine","Maria","Heather",
  "Diane","Julie","Joyce","Victoria","Kelly","Christina","Joan","Evelyn","Lauren","Judith",
  "Olivia","Martha","Cheryl","Megan","Andrea","Ann","Alice","Jean","Doris","Gloria",
  "Hannah","Kathryn","Teresa","Sara","Janice","Julia","Marie","Madison","Grace","Judy",
  "Theresa","Beverly","Denise","Marilyn","Amber","Danielle","Brittany","Diana","Abigail","Jane",
  "Priya","Aisha","Sofia","Mei","Yuki","Fatima","Nadia","Leila","Amara","Zara",
  "Zoe","Chloe","Isabelle","Camille","Elise","Margot","Vivienne","Celeste","Simone","Renee",
  "Carlos","Miguel","Diego","Alejandro","Rafael","Luis","Eduardo","Fernando","Pablo","Javier",
  "Ahmed","Omar","Hassan","Ali","Khalid","Tariq","Yusuf","Ibrahim","Samir","Karim",
  "Wei","Chen","Jing","Hui","Fang","Ling","Xin","Yan","Rui","Hao",
  "Raj","Vikram","Arjun","Sanjay","Rahul","Amit","Suresh","Deepak","Anand","Nikhil",
  "Kwame","Kofi","Ama","Abena","Yaw","Akosua","Kojo","Efua","Nana","Adwoa",
  "Liam","Noah","Ethan","Mason","Logan","Lucas","Aiden","Jackson","Sebastian","Owen",
  "Elijah","Caleb","Wyatt","Henry","Carter","Jayden","Gabriel","Isaiah","Nolan","Lincoln",
  "Ava","Mia","Ella","Scarlett","Aria","Luna","Layla","Penelope","Nora","Lily",
  "Eleanor","Hazel","Violet","Aurora","Stella","Zoey","Natalie","Leah","Savannah","Addison",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Turner","Phillips","Evans","Collins","Edwards","Stewart","Morris","Murphy","Cook","Rogers",
  "Morgan","Peterson","Cooper","Reed","Bailey","Bell","Gomez","Kelly","Howard","Ward",
  "Cox","Diaz","Richardson","Wood","Watson","Brooks","Bennett","Gray","James","Reyes",
  "Cruz","Hughes","Price","Myers","Long","Foster","Sanders","Ross","Morales","Powell",
  "Sullivan","Russell","Ortiz","Jenkins","Gutierrez","Perry","Butler","Barnes","Fisher","Henderson",
  "Coleman","Simmons","Patterson","Jordan","Reynolds","Hamilton","Graham","Kim","Gonzales","Alexander",
  "Ramos","Wallace","Griffin","West","Cole","Hayes","Chavez","Gibson","Bryant","Ellis",
  "Stevens","Murray","Ford","Marshall","Owens","McDonald","Harrison","Ruiz","Kennedy","Wells",
  "Alvarez","Woods","Mendoza","Castillo","Olson","Webb","Washington","Tucker","Freeman","Burns",
  "Patel","Shah","Kumar","Singh","Sharma","Gupta","Mehta","Joshi","Nair","Iyer",
  "Chen","Wang","Zhang","Liu","Yang","Huang","Li","Zhao","Wu","Sun",
  "Kim","Park","Lee","Choi","Jung","Kang","Cho","Yoon","Lim","Han",
  "Okonkwo","Adeyemi","Mensah","Asante","Boateng","Owusu","Darko","Acheampong","Amoah","Antwi",
  "Nakamura","Tanaka","Suzuki","Watanabe","Ito","Yamamoto","Kobayashi","Saito","Kato","Abe",
  "Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann",
  "Dubois","Martin","Bernard","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau",
  "Rossi","Ferrari","Esposito","Bianchi","Romano","Colombo","Ricci","Marino","Greco","Bruno",
  "O'Brien","Murphy","Kelly","Walsh","O'Sullivan","Burke","Collins","O'Connor","McCarthy","Doyle",
  "Andersen","Hansen","Petersen","Nielsen","Jensen","Larsen","Christensen","Rasmussen","Pedersen","Madsen",
];

const CREDENTIALS = [
  // Single credentials (ultrasound/echo specific)
  "RDCS",
  "RDCS (AE)",
  "RDCS (PE)",
  "RDCS (FE)",
  "RCS",
  "RCCS",
  "MD",
  "DO",
  "RN",
  "RT(R)",
  // RCES only in combination with a primary echo credential (RDCS or RCS)
  "RDCS, RCES",
  "RDCS (AE), RCES",
  "RCS, RCES",
  // Multi-credential combos — ACS always first when present
  "ACS, RDCS",
  "ACS, RDCS (AE)",
  "ACS, RDCS (PE)",
  "ACS, RDCS (FE)",
  "ACS, RDCS (AE, PE)",
  "ACS, RDCS (AE, FE)",
  "ACS, RDCS (PE, FE)",
  "ACS, RCS",
  "ACS, RCCS",
  "RDCS (AE, PE)",
  "RDCS (AE, FE)",
  "RDCS (PE, FE)",
  "RDCS (AE, PE, FE)",
  "RDCS (AE), FASE",
  "RDCS, FASE",
  "RCS, FASE",
  "MD, FASE",
  "MD, FACC",
  "DO, FACC",
  "MD, FASE, FACC",
  "RN, RDCS",
  "RN, RDCS (AE)",
  "RT(R), RDCS",
  "RT(R), RDCS (AE)",
];

const CITIES = [
  "New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego",
  "Dallas","San Jose","Austin","Jacksonville","Fort Worth","Columbus","Charlotte","Indianapolis",
  "San Francisco","Seattle","Denver","Nashville","Oklahoma City","El Paso","Washington","Boston",
  "Las Vegas","Memphis","Louisville","Portland","Baltimore","Milwaukee","Albuquerque","Tucson",
  "Fresno","Sacramento","Mesa","Kansas City","Atlanta","Omaha","Colorado Springs","Raleigh",
  "Long Beach","Virginia Beach","Minneapolis","Tampa","New Orleans","Arlington","Wichita","Bakersfield",
  "Toronto","Vancouver","Montreal","Calgary","Edmonton","Ottawa","Winnipeg","Quebec City",
  "London","Manchester","Birmingham","Leeds","Glasgow","Liverpool","Bristol","Sheffield",
  "Sydney","Melbourne","Brisbane","Perth","Adelaide","Auckland","Wellington","Christchurch",
  "Dublin","Cork","Galway","Belfast","Edinburgh","Cardiff","Swansea","Aberdeen",
  "Paris","Lyon","Marseille","Toulouse","Nice","Nantes","Strasbourg","Montpellier",
  "Berlin","Hamburg","Munich","Cologne","Frankfurt","Stuttgart","Düsseldorf","Leipzig",
  "Madrid","Barcelona","Valencia","Seville","Bilbao","Málaga","Zaragoza","Murcia",
  "Rome","Milan","Naples","Turin","Palermo","Genoa","Bologna","Florence",
  "Amsterdam","Rotterdam","The Hague","Utrecht","Eindhoven","Tilburg","Groningen","Almere",
  "Stockholm","Gothenburg","Malmö","Uppsala","Oslo","Bergen","Trondheim","Stavanger",
  "Copenhagen","Aarhus","Odense","Aalborg","Helsinki","Tampere","Turku","Oulu",
  "Tokyo","Osaka","Yokohama","Nagoya","Sapporo","Kobe","Kyoto","Fukuoka",
  "Seoul","Busan","Incheon","Daegu","Daejeon","Gwangju","Suwon","Ulsan",
  "Beijing","Shanghai","Guangzhou","Shenzhen","Chengdu","Chongqing","Wuhan","Xi'an",
  "Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad",
  "Dubai","Abu Dhabi","Riyadh","Jeddah","Kuwait City","Doha","Muscat","Manama",
  "Cairo","Lagos","Nairobi","Accra","Johannesburg","Cape Town","Casablanca","Tunis",
  "São Paulo","Rio de Janeiro","Bogotá","Lima","Santiago","Buenos Aires","Caracas","Quito",
  "Mexico City","Guadalajara","Monterrey","Havana","San Juan","Guatemala City","Panama City","Managua",
];

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(): number {
  const d = new Date();
  // Changes daily at midnight UTC
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface VirtualEntry {
  rank: number;
  userId: string; // prefixed with "v_" to distinguish from real users
  displayName: string;
  avatarUrl: null;
  correct: number;
  total: number;
  accuracy: number;
  /** Pre-computed realistic non-rounded total points for this entry */
  points: number;
  /** Pre-computed challenge-only points (no flashcard 1-pt inflation) */
  challengePoints: number;
  /** Pre-computed case-only points (no flashcard 1-pt inflation) */
  casePoints: number;
  /** Pre-computed flashcard points (includes 1-pt card-view events) */
  flashcardPoints: number;
  isCurrentUser: false;
  city: string;
  credentials: string | null; // null = uncredentialed learner
  isVirtual: true;
}

/**
 * Generate `count` virtual leaderboard entries for the given period.
 * Scores are seeded by today's date so they change daily.
 *
 * Points are realistic non-rounded values:
 * - Top entry is always exactly 4952 total points
 * - Others scale naturally below that with noise added so values
 *   are never round multiples (e.g. 3563, 4587, 2891)
 * - Challenge and case points are computed independently from flashcard
 *   points so single-point card-view events don't inflate those categories
 *
 * @param count  Number of virtual entries to generate (default 1200)
 * @param period "7d" | "30d" | "allTime" — affects score ranges
 */
export function generateVirtualLeaderboard(
  count = 1200,
  period: "7d" | "30d" | "allTime" = "30d"
): VirtualEntry[] {
  const seed = dateSeed();
  const rand = mulberry32(seed);

  // Score ranges vary by period
  const maxCorrect =
    period === "7d" ? 35 : period === "30d" ? 120 : 480;
  const minCorrect =
    period === "7d" ? 1 : period === "30d" ? 3 : 10;

  // Top total points cap — real users can exceed this to bypass all placeholders
  const TOP_POINTS = 4952;

  const entries: VirtualEntry[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES, rand);
    const lastName = pick(LAST_NAMES, rand);
    const city = pick(CITIES, rand);

    // ~28% of entries are uncredentialed learners (students, residents, enthusiasts)
    const isLearner = rand() < 0.28;
    const cred = isLearner ? null : pick(CREDENTIALS, rand);

    // Correct answers: exponential-ish distribution — most users cluster in the middle
    const u = rand();
    const correct = Math.max(
      minCorrect,
      Math.round(minCorrect + (maxCorrect - minCorrect) * Math.pow(u, 1.8))
    );
    // Total attempts: correct + some wrong (accuracy 40–95%)
    const accuracy = 40 + Math.floor(rand() * 55); // 40–94%
    const total = Math.round((correct / accuracy) * 100);

    // ── Realistic non-rounded point values ──────────────────────────────────
    // Base ratio: how far this entry is from the top (0 = bottom, 1 = top)
    const ratio = Math.pow(u, 1.8); // same distribution as correct answers

    // Challenge points: 10 pts per correct + streak bonuses (5 pts each)
    // Add noise (±7%) so values are never round multiples of 10
    const challengeBase = Math.round(correct * 10 + correct * 0.3 * 5); // ~30% streak rate
    const challengeNoise = Math.round((rand() - 0.5) * challengeBase * 0.14);
    const challengePoints = Math.max(0, challengeBase + challengeNoise);

    // Case points: 25 pts per submission + 50 pts per approval
    // Experienced users submit more cases; scale with ratio
    const caseSubmissions = Math.round(ratio * 8 * rand()); // 0–8 submissions
    const caseApprovals = Math.round(caseSubmissions * 0.6 * rand()); // ~60% approval rate
    const caseNoise = Math.round((rand() - 0.5) * 30);
    const casePoints = Math.max(0, caseSubmissions * 25 + caseApprovals * 50 + caseNoise);

    // Flashcard points: 1 pt per card viewed (many single-point events)
    // This is the primary driver of flashcard and total points
    const cardsViewed = Math.round(ratio * 1800 * rand() + 50); // 50–1800 cards viewed
    const sessionBonus = Math.round(cardsViewed / 20) * 5; // 5 pts per ~20-card session
    const flashcardNoise = Math.round((rand() - 0.5) * cardsViewed * 0.08);
    const flashcardPoints = Math.max(0, cardsViewed + sessionBonus + flashcardNoise);

    // Total points: sum of all categories
    const rawTotal = challengePoints + casePoints + flashcardPoints;

    // Scale so the top entry lands at exactly TOP_POINTS (4952)
    // We'll apply this scaling after sorting, so store raw for now
    entries.push({
      rank: 0, // will be set after merge + sort
      userId: `v_${i}_${seed}`,
      displayName: cred ? `${firstName} ${lastName}, ${cred}` : `${firstName} ${lastName}`,
      avatarUrl: null,
      correct,
      total,
      accuracy,
      points: rawTotal,
      challengePoints,
      casePoints,
      flashcardPoints,
      isCurrentUser: false,
      city,
      credentials: cred,
      isVirtual: true,
    });
  }

  // Sort descending by raw total points
  entries.sort((a, b) => b.points - a.points || b.accuracy - a.accuracy);

  // Scale all entries so the top one lands at exactly TOP_POINTS (4952)
  // This ensures real users with > 4952 points always rank above all placeholders
  const topRaw = entries[0]?.points ?? 1;
  const scale = topRaw > 0 ? TOP_POINTS / topRaw : 1;

  for (const e of entries) {
    // Apply scale and add per-entry noise so values are never round numbers
    // The noise seed is derived from the entry index for determinism
    const noiseSeed = mulberry32(seed + e.correct * 37 + e.total);
    const noise = Math.round((noiseSeed() - 0.5) * 2 * 47); // ±47 pts noise

    const scaledTotal = Math.max(1, Math.round(e.points * scale) + noise);
    const scaledChallenge = Math.max(0, Math.round(e.challengePoints * scale));
    const scaledCase = Math.max(0, Math.round(e.casePoints * scale));
    const scaledFlashcard = Math.max(0, Math.round(e.flashcardPoints * scale));

    e.points = scaledTotal;
    e.challengePoints = scaledChallenge;
    e.casePoints = scaledCase;
    e.flashcardPoints = scaledFlashcard;
  }

  // Clamp the very top entry to exactly 4952 (no noise overshoot)
  if (entries[0]) {
    entries[0].points = TOP_POINTS;
  }

  return entries;
}
