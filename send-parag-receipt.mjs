/**
 * One-time script: send membership confirmation email to Parag Tipnis
 * Run: node send-parag-receipt.mjs
 */
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.LMS_FROM_EMAIL || 'hello@allaboutultrasound.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || process.env.LMS_FROM_NAME || 'All About Ultrasound';

if (!SENDGRID_API_KEY) {
  console.error('No SENDGRID_API_KEY found');
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

const BRAND_COLOR = '#0d9488';
const BRAND_DARK = '#0e4a50';

const firstName = 'Parag';
const productName = 'EchoAssist™ Lifetime Premium Membership';
const toEmail = 'tipnis@wisc.edu';
const toName = 'Parag Tipnis';
const loginUrl = 'https://app.iheartecho.net/dashboard';

const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,${BRAND_COLOR},#4ad9e0);padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;">EchoAssist™</h1>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">by iHeartEcho</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND_DARK};font-family:Georgia,serif;">
        Thank you, ${firstName}!
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
        Your payment was successful and your <strong>${productName}</strong> is now active.
      </p>
      <div style="background:#f0fbfc;border:1px solid #d1f5f7;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND_COLOR};text-transform:uppercase;letter-spacing:0.05em;">Order Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;color:#0e1e2e;font-weight:600;padding:4px 0;">${productName}</td>
            <td style="font-size:14px;color:#0e1e2e;font-weight:600;text-align:right;padding:4px 0;">Lifetime Access</td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #d1f5f7;margin:12px 0;" />
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;color:#0e1e2e;font-weight:700;padding:4px 0;">Access Type</td>
            <td style="font-size:14px;color:${BRAND_COLOR};font-weight:700;text-align:right;padding:4px 0;">Lifetime — Never Expires</td>
          </tr>
        </table>
      </div>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
        Your lifetime access is now active. Log in to start using EchoAssist™ right away.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${loginUrl}"
          style="display:inline-block;background:linear-gradient(135deg,${BRAND_COLOR},#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Access EchoAssist™
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
        If you have any questions, reply to this email or contact us at hello@allaboutultrasound.com.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">© 2026 All About Ultrasound. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

const msg = {
  to: { name: toName, email: toEmail },
  from: { name: FROM_NAME, email: FROM_EMAIL },
  subject: `Your ${productName} is ready`,
  html: htmlBody,
  text: `Hi ${firstName},\n\nThank you for your purchase! Your ${productName} is now active.\n\nAccess your membership at: ${loginUrl}\n\nIf you have any questions, reply to this email.\n\n© 2026 All About Ultrasound`,
};

try {
  const [response] = await sgMail.send(msg);
  console.log(`Email sent successfully! Status: ${response.statusCode}`);
  console.log(`Sent to: ${toEmail}`);
} catch (error) {
  console.error('Failed to send email:', error.response?.body || error.message);
  process.exit(1);
}
