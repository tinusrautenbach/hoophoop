import nodemailer from 'nodemailer';

// SMTP Transport configuration
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.mailersend.net',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseInt(process.env.SMTP_PORT || '587') === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create reusable transporter
const transporter = nodemailer.createTransport(smtpConfig);

// Verify connection on startup (optional, can be commented out in production)
if (process.env.NODE_ENV !== 'production') {
  transporter.verify((error: Error | null) => {
    if (error) {
      console.warn('SMTP connection not configured or invalid:', error.message);
    } else {
      console.log('SMTP server is ready to take messages');
    }
  });
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using SMTP
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Check if SMTP is configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured - email would be sent to:', options.to);
    console.warn('Subject:', options.subject);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Hoophoop Basketball'}" <${process.env.SMTP_FROM || 'noreply@hoophoop.net'}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send player invitation email
 */
export async function sendPlayerInvitationEmail(
  to: string,
  playerName: string,
  invitationLink: string,
  invitedByName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `You've been invited to join Hoophoop Basketball`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hoophoop Basketball Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f97316; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
    .link-box { background: #e5e7eb; padding: 15px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏀 Hoophoop Basketball</h1>
    </div>
    <div class="content">
      <h2>Hello ${playerName}!</h2>
      <p>You've been invited to claim your player profile on Hoophoop Basketball${invitedByName ? ` by ${invitedByName}` : ''}.</p>
      <p>Click the button below to set up your account and access your stats, game history, and more:</p>
      <a href="${invitationLink}" class="button">Claim Your Profile</a>
      <p>Or copy and paste this link into your browser:</p>
      <div class="link-box">${invitationLink}</div>
      <p>This invitation will expire in 7 days.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Hoophoop Basketball. All rights reserved.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hello ${playerName}!

You've been invited to claim your player profile on Hoophoop Basketball${invitedByName ? ` by ${invitedByName}` : ''}.

Click the link below to set up your account and access your stats, game history, and more:

${invitationLink}

This invitation will expire in 7 days.

© ${new Date().getFullYear()} Hoophoop Basketball
  `;

  return sendEmail({ to, subject, html, text });
}

/**
 * Send community invitation email
 */
export async function sendCommunityInvitationEmail(
  to: string,
  communityName: string,
  inviteLink: string,
  role: string,
  invitedByName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `You've been invited to join ${communityName} on Hoophoop Basketball`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Community Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f97316; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
    .link-box { background: #e5e7eb; padding: 15px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏀 Hoophoop Basketball</h1>
    </div>
    <div class="content">
      <h2>Hello!</h2>
      <p>You've been invited to join <strong>${communityName}</strong> as a <strong>${role}</strong>${invitedByName ? ` by ${invitedByName}` : ''}.</p>
      <p>Click the button below to join the community and start scoring games:</p>
      <a href="${inviteLink}" class="button">Join Community</a>
      <p>Or copy and paste this link into your browser:</p>
      <div class="link-box">${inviteLink}</div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Hoophoop Basketball. All rights reserved.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hello!

You've been invited to join ${communityName} as a ${role}${invitedByName ? ` by ${invitedByName}` : ''}.

Click the link below to join the community and start scoring games:

${inviteLink}

© ${new Date().getFullYear()} Hoophoop Basketball
  `;

  return sendEmail({ to, subject, html, text });
}
