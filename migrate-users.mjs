/**
 * migrate-users.mjs — iHeartEcho → UltrasoundAssist user migration
 * Uses only columns that exist in the iHeartEcho users table.
 * Maps isPremium → membershipTier. Skips duplicates by email.
 */
import { createPool } from "mysql2/promise";

const IHE_URL = "mysql://2mhhtxpXA9Esras.root:HJkw07mdx3Eeg9V5P9cK@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/etVPnUidWNWG8W4GHnRqzv";
const AAUS_URL = process.env.DATABASE_URL;
if (!AAUS_URL) { console.error("ERROR: DATABASE_URL not set"); process.exit(1); }

const ihePool = createPool({ uri: IHE_URL, ssl: { rejectUnauthorized: false }, connectionLimit: 3 });
const aausPool = createPool({ uri: AAUS_URL, ssl: { rejectUnauthorized: false }, connectionLimit: 3 });

async function main() {
  const iheConn = await ihePool.getConnection();
  const aausConn = await aausPool.getConnection();
  try {
    console.log("Fetching users from iHeartEcho...");
    const [iheUsers] = await iheConn.query(`
      SELECT name, email, loginMethod, role,
        displayName, avatarUrl, bio, credentials, coverUrl,
        specialty, yearsExperience, location, website,
        isPublicProfile, followersCount, followingCount,
        isPremium, premiumGrantedAt, premiumSource,
        thinkificEnrolledAt, isPending, pendingCreatedAt,
        emailVerified, notificationPrefs, timezone, lastChallengeNotifDate,
        isDemo, challengeCategoryPrefs, interestPrefs,
        unsubscribedAt, unsubscribeToken, createdAt, lastSignedIn
      FROM users ORDER BY id ASC
    `);
    console.log(`Found ${iheUsers.length} users in iHeartEcho.`);

    const [existingRows] = await aausConn.query("SELECT email FROM users WHERE email IS NOT NULL");
    const existingEmails = new Set(existingRows.map(r => (r.email || "").toLowerCase()));
    console.log(`UltrasoundAssist already has ${existingEmails.size} users.`);

    let inserted = 0, skipped = 0, errors = 0;

    for (let i = 0; i < iheUsers.length; i++) {
      const user = iheUsers[i];
      const email = (user.email || "").toLowerCase().trim();
      if (!email || existingEmails.has(email)) { skipped++; continue; }

      try {
        await aausConn.query(`
          INSERT INTO users (
            name, email, loginMethod, role,
            displayName, avatarUrl, bio, credentials, coverUrl,
            specialty, yearsExperience, location, website,
            isPublicProfile, followersCount, followingCount,
            isPremium, membershipTier, premiumGrantedAt, premiumSource,
            thinkificEnrolledAt, isPending, pendingCreatedAt,
            emailVerified, notificationPrefs, timezone, lastChallengeNotifDate,
            isDemo, challengeCategoryPrefs, interestPrefs,
            unsubscribedAt, unsubscribeToken, createdAt, lastSignedIn,
            streakCount, totalPoints
          ) VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, 0,0)
        `, [
          user.name||null, email, user.loginMethod||"email", user.role||"user",
          user.displayName||null, user.avatarUrl||null, user.bio||null, user.credentials||null, user.coverUrl||null,
          user.specialty||null, user.yearsExperience||null, user.location||null, user.website||null,
          user.isPublicProfile!=null?(user.isPublicProfile?1:0):1, user.followersCount||0, user.followingCount||0,
          user.isPremium?1:0, user.isPremium?"premium":"free", user.premiumGrantedAt||null, user.premiumSource||null,
          user.thinkificEnrolledAt||null, user.isPending?1:0, user.pendingCreatedAt||null,
          user.emailVerified?1:0, user.notificationPrefs||null, user.timezone||null, user.lastChallengeNotifDate||null,
          user.isDemo?1:0, user.challengeCategoryPrefs||null, user.interestPrefs||null,
          user.unsubscribedAt||null, user.unsubscribeToken||null, user.createdAt||null, user.lastSignedIn||null,
        ]);
        existingEmails.add(email);
        inserted++;
        if (inserted % 500 === 0) console.log(`  ...${inserted} inserted so far`);
      } catch (err) {
        console.error(`  ERROR ${email}: ${err.message}`);
        errors++;
      }
    }

    console.log("\n=== Migration Complete ===");
    console.log(`  Inserted:  ${inserted}`);
    console.log(`  Skipped:   ${skipped}`);
    console.log(`  Errors:    ${errors}`);
    const [[{ total }]] = await aausConn.query("SELECT COUNT(*) as total FROM users");
    console.log(`  Total users in UltrasoundAssist: ${total}`);
  } finally {
    iheConn.release(); aausConn.release();
    await ihePool.end(); await aausPool.end();
  }
}
main().catch(err => { console.error("Migration failed:", err); process.exit(1); });
