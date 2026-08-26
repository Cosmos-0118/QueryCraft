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
      subject: 'Your QueryCraft verification code',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h2>QueryCraft verification</h2>
          <p>Use this one-time code to finish setting up your account:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p>
          <p>This code expires in ${expiresInMinutes} minutes.</p>
        </div>
      `,
      textContent: `Your QueryCraft verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
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
