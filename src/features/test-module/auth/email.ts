interface SendOtpEmailInput {
  toEmail: string;
  otp: string;
  expiresInMinutes: number;
}

function getSender() {
  const email = process.env.BREVO_SENDER_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim() || 'no-reply@querycraft.local';
  const name = process.env.BREVO_SENDER_NAME?.trim() || 'QueryCraft';
  return { email, name };
}

function buildOtpEmailHtml({
  otp,
  expiresInMinutes,
  toEmail,
}: {
  otp: string;
  expiresInMinutes: number;
  toEmail: string;
}) {
  const year = new Date().getFullYear();
  const otpDigits = otp
    .split('')
    .map(
      (digit) =>
        `<td style="width:42px;height:52px;text-align:center;vertical-align:middle;font-size:24px;font-weight:700;letter-spacing:0;color:#0f172a;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">${digit}</td>`,
    )
    .join('<td style="width:8px;"></td>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QueryCraft verification code</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#0f766e 0%,#0e7490 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">
                    Query<span style="color:#99f6e4;">Craft</span>
                  </td>
                  <td align="right" style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);">
                    Faculty Access
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">
                Verification Code
              </p>
              <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:750;letter-spacing:-0.03em;color:#0f172a;">
                Confirm your faculty login
              </h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#475569;">
                Use the one-time code below to finish setting up your QueryCraft faculty account for
                <strong style="color:#0f172a;">${toEmail}</strong>.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
                <tr>
                  ${otpDigits}
                </tr>
              </table>

              <p style="margin:0 0 28px;text-align:center;font-size:13px;line-height:1.5;color:#64748b;">
                This code expires in <strong style="color:#0f172a;">${expiresInMinutes} minutes</strong>.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a;">
                      Security tip
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">
                      Never share this code with anyone. QueryCraft will never ask for your OTP over chat, phone, or social media.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                If you did not request this code, you can safely ignore this email. Your account will remain unchanged.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                © ${year} QueryCraft · Database Learning Studio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmailText({
  otp,
  expiresInMinutes,
  toEmail,
}: {
  otp: string;
  expiresInMinutes: number;
  toEmail: string;
}) {
  return [
    'QueryCraft Faculty Verification',
    '',
    `Confirm your faculty login for ${toEmail}.`,
    '',
    `Your one-time verification code is: ${otp}`,
    `This code expires in ${expiresInMinutes} minutes.`,
    '',
    'Never share this code with anyone.',
    'If you did not request this code, you can ignore this email.',
  ].join('\n');
}

export async function sendSetupOtpEmail({ toEmail, otp, expiresInMinutes }: SendOtpEmailInput) {
  const apiKey = process.env.BREVO_API_KEY?.trim();

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      return { sent: false, devOtp: otp };
    }
    throw new Error('BREVO_API_KEY is not configured.');
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: getSender(),
      to: [{ email: toEmail }],
      subject: 'Your QueryCraft faculty verification code',
      htmlContent: buildOtpEmailHtml({ otp, expiresInMinutes, toEmail }),
      textContent: buildOtpEmailText({ otp, expiresInMinutes, toEmail }),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || 'Brevo rejected the OTP email request.');
  }

  return {
    sent: true,
    devOtp: process.env.NODE_ENV !== 'production' ? otp : null,
  };
}
