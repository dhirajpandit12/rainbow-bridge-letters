const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendRainbowBridgeEmail({ toEmail, ownerName, petName, pdfBuffer }) {
  const firstName = ownerName ? ownerName.split(' ')[0] : 'there';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#fdf8f4;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

          <tr>
            <td style="background:#fff7f2;border-radius:16px 16px 0 0;padding:36px 40px 28px;text-align:center;border-bottom:2px solid #f0d5c8;">
              <p style="color:#c47d7d;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 10px 0;font-family:Arial,sans-serif;">A Final Message From Your Pet</p>
              <h1 style="color:#3a2e2a;font-size:26px;margin:0 0 6px 0;font-weight:normal;">Rainbow Bridge Letter</h1>
              <p style="color:#a08070;font-size:13px;margin:0;letter-spacing:1px;font-family:Arial,sans-serif;">For ${firstName}, from ${petName} 🐾</p>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:36px 40px;border-left:1px solid #f0d5c8;border-right:1px solid #f0d5c8;">
              <p style="color:#5a4a42;font-size:15px;line-height:1.8;margin:0 0 18px 0;">Dear ${firstName},</p>
              <p style="color:#5a4a42;font-size:15px;line-height:1.8;margin:0 0 18px 0;">
                Your Rainbow Bridge Letter from <strong>${petName}</strong> is attached to this email as a PDF.
              </p>
              <p style="color:#5a4a42;font-size:15px;line-height:1.8;margin:0 0 18px 0;">
                This letter was written from ${petName}'s perspective, carrying all the love they had for you. We hope it brings you some comfort and peace.
              </p>
              <p style="color:#5a4a42;font-size:15px;line-height:1.8;margin:0 0 18px 0;">
                You can print it, frame it, or simply keep it somewhere special.
              </p>
              <p style="color:#a08070;font-size:14px;line-height:1.8;margin:24px 0 0 0;font-style:italic;">
                Forever loved. Never gone. 🌈
              </p>
              <p style="color:#c0a898;font-size:12px;line-height:1.6;margin:16px 0 0 0;">
                If this email landed in your Promotions tab, please move it to your inbox so you never miss a letter from a beloved pet.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#fff7f2;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border-top:2px solid #f0d5c8;border-left:1px solid #f0d5c8;border-right:1px solid #f0d5c8;border-bottom:1px solid #f0d5c8;">
              <p style="color:#c47d7d;font-size:15px;margin:0;font-family:Georgia,serif;">Rainbow Bridge Letters</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const emailPayload = {
      from: process.env.FROM_EMAIL,
      to: toEmail,
      subject: `${petName}'s letter is ready for you`,
      html,
      attachments: [
        {
          filename: `${petName}-rainbow-bridge-letter.pdf`,
          content: Buffer.from(pdfBuffer).toString('base64'),
        },
      ],
    };

    if (process.env.ADMIN_BCC_EMAIL) {
      emailPayload.bcc = process.env.ADMIN_BCC_EMAIL;
    }

    await resend.emails.send(emailPayload);
    console.log(`[Email] Rainbow Bridge letter sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email] Failed to send Rainbow Bridge email:', err.message);
    throw err;
  }
}

module.exports = { sendRainbowBridgeEmail };
