import { createConnection } from 'mysql2/promise';
import { overlayLearnerData } from './server/lib/certificatePdfOverlay';
import { storagePut } from './server/storage';
import { sendCertificateEmail } from './server/lib/certificateEmail';
import { randomBytes } from 'crypto';

const conn = await createConnection(process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL!);

// Get the JOINT CME template
const [templates] = await conn.execute('SELECT * FROM lms_certificate_templates WHERE id = 30001') as any;
const template = templates[0];
console.log('Template:', template.name, '| PDF URL:', template.pdf_template_url ? 'set' : 'NOT SET');

if (!template.pdf_template_url) {
  console.error('ERROR: JOINT CME template has no pdf_template_url. Cannot reissue.');
  await conn.end();
  process.exit(1);
}

// Get the Echo Kahoot course
const [courses] = await conn.execute('SELECT * FROM lms_courses WHERE id = 810001') as any;
const course = courses[0];
console.log('Course:', course.title, '| Credit hours:', course.credit_hours, '| Template ID:', course.certificate_template_id);

// Get all existing certificates for this course
const [certs] = await conn.execute(`
  SELECT c.id, c.user_id, c.enrollment_id, u.name, u.firstName, u.lastName, u.email, u.displayName
  FROM lms_certificates c
  JOIN users u ON u.id = c.user_id
  WHERE c.course_id = 810001
`) as any;

console.log(`Found ${certs.length} certificates to reissue`);

// Fetch the PDF template once
const res = await fetch(template.pdf_template_url);
if (!res.ok) throw new Error(`Failed to fetch PDF template: ${res.status}`);
const rawBuffer = Buffer.from(await res.arrayBuffer());
console.log('PDF template fetched, size:', rawBuffer.length, 'bytes');

let successCount = 0;
let errorCount = 0;

for (const cert of certs) {
  try {
    const legalName = [cert.firstName, cert.lastName].filter(Boolean).join(' ');
    const learnerName = legalName || cert.displayName || cert.name || 'Learner';
    const issuedAt = new Date();

    // Overlay learner data onto the PDF
    const pdfBuffer = await overlayLearnerData(rawBuffer, {
      learnerName,
      courseTitle: course.title,
      issuedAt,
      creditHours: course.credit_hours ?? '1.0',
    });

    // Upload to S3
    const suffix = randomBytes(6).toString('hex');
    const fileKey = `certificates/cert-${cert.user_id}-810001-${suffix}.pdf`;
    const { url: certificateUrl } = await storagePut(fileKey, pdfBuffer, 'application/pdf');

    // Update the certificate record
    await conn.execute(
      'UPDATE lms_certificates SET certificate_url = ?, template_id = ?, issued_at = ? WHERE id = ?',
      [certificateUrl, 30001, issuedAt, cert.id]
    );

    // Send email
    await sendCertificateEmail({
      to: { name: learnerName, email: cert.email },
      courseTitle: course.title,
      certificateUrl,
      pdfBuffer,
      issuedAt,
    });

    console.log(`✓ Reissued for ${learnerName} (${cert.email})`);
    successCount++;
  } catch (err: any) {
    console.error(`✗ Failed for ${cert.name} (${cert.email}):`, err.message);
    errorCount++;
  }
}

console.log(`\nDone: ${successCount} reissued, ${errorCount} errors`);
await conn.end();
