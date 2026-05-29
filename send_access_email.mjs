import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const email = 'beltranamador@ymail.com';
const name = 'Amador Beltran';
const firstName = 'Amador';
const productTitle = 'From Sonographer to CEO eBook';
const loginUrl = 'https://learn.allaboutultrasound.com/auth/magic?token=00d745f2d5f1ee1b65bd352f44864517eca03037005f93b67ac4753a0447f4c7';
const downloadsUrl = 'https://learn.allaboutultrasound.com/downloads';
const directFileUrl = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/digital-downloads/1/7m8ea0-From Sonographer to CEO.pdf';
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'admin@allaboutultrasound.com';
const fromName = process.env.SENDGRID_FROM_NAME || 'All About Ultrasound';

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#189aa1;padding:30px 40px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus-logo-white.png" alt="All About Ultrasound" height="50" style="max-height:50px;" onerror="this.style.display='none'">
              <h1 style="color:#ffffff;margin:10px 0 0;font-size:22px;font-weight:700;">Your Purchase is Ready!</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#333;font-size:16px;margin:0 0 16px;">Hi ${firstName},</p>
              <p style="color:#333;font-size:16px;margin:0 0 16px;">
                Thank you for your purchase of <strong>${productTitle}</strong>! Your account has been created and your download is ready.
              </p>
              
              <!-- Product box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fafa;border:1px solid #b2e4e6;border-radius:8px;margin:24px 0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:1px;">YOUR PURCHASE</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:#189aa1;">${productTitle}</p>
                  </td>
                </tr>
              </table>

              <p style="color:#333;font-size:16px;margin:0 0 24px;">
                Click the button below to sign in to your account and access your download:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${loginUrl}" style="display:inline-block;background:#189aa1;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 36px;border-radius:6px;">
                      Sign In &amp; Access Your Download →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#666;font-size:14px;margin:0 0 8px;">
                This sign-in link will take you directly to your account. Once signed in, go to <strong>My Downloads</strong> to access your file anytime.
              </p>
              <p style="color:#666;font-size:14px;margin:0 0 24px;">
                You can also access your downloads directly at: <a href="${downloadsUrl}" style="color:#189aa1;">${downloadsUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
              
              <p style="color:#666;font-size:13px;margin:0 0 8px;">
                <strong>Having trouble with the button?</strong> Copy and paste this link into your browser:
              </p>
              <p style="color:#189aa1;font-size:12px;word-break:break-all;margin:0 0 24px;">
                ${loginUrl}
              </p>

              <p style="color:#333;font-size:15px;margin:0 0 8px;">
                If you have any questions, reply to this email or contact us at <a href="mailto:admin@allaboutultrasound.com" style="color:#189aa1;">admin@allaboutultrasound.com</a>.
              </p>

              <p style="color:#333;font-size:15px;margin:24px 0 0;">
                Thank you for being part of the All About Ultrasound community!
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="color:#999;font-size:12px;margin:0;">
                © 2026 All About Ultrasound, Inc. · <a href="https://learn.allaboutultrasound.com" style="color:#189aa1;">learn.allaboutultrasound.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const msg = {
  to: { email, name },
  from: { email: fromEmail, name: fromName },
  subject: `Your "${productTitle}" Download is Ready — Sign In to Access It`,
  html,
  text: `Hi ${firstName},\n\nThank you for purchasing ${productTitle}!\n\nYour account has been created. Click this link to sign in and access your download:\n${loginUrl}\n\nOnce signed in, visit: ${downloadsUrl}\n\nIf you have questions, contact us at admin@allaboutultrasound.com.\n\nThank you!\nAll About Ultrasound`,
};

try {
  const result = await sgMail.send(msg);
  console.log("Email sent successfully!", result[0].statusCode);
} catch (err) {
  console.error("Email send error:", err.response?.body || err.message);
}
