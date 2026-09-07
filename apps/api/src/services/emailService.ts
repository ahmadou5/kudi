import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';

export interface SendOTPEmailParams {
  toEmail: string;
  otpCode: string;
}

export async function sendOTPEmail({ toEmail, otpCode }: SendOTPEmailParams): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background-color: #0d0e12; color: #ffffff; border-radius: 16px; border: 1px solid #1f222e;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">KUDI</h1>
        <p style="color: #8f92a1; font-size: 14px; margin-top: 4px;">Self-Custodial Local Payouts</p>
      </div>
      <div style="background-color: #151821; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #262938;">
        <p style="color: #a0a5b5; font-size: 14px; margin-top: 0;">Your 6-digit verification code is:</p>
        <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #3b82f6; margin: 16px 0; font-family: monospace;">${otpCode}</div>
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">Code expires in 10 minutes. Do not share this code with anyone.</p>
      </div>
    </div>
  `;

  // 1. Prioritize Resend if API Key present
  if (resendApiKey && resendApiKey.startsWith('re_')) {
    try {
      const resend = new Resend(resendApiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

      const data = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: `${otpCode} is your Kudi security code`,
        html: emailHtml
      });

      if (data.error) {
        console.error('[Resend Mail Error]', data.error);
      } else {
        console.log(`[Email Service] 🚀 OTP code successfully dispatched via Resend to ${toEmail} (ID: ${data.data?.id})`);
        return true;
      }
    } catch (err: any) {
      console.error('[Resend Exception Error]', err?.message || err);
    }
  }

  // 2. Try SendGrid if API Key present
  if (sendgridApiKey && sendgridApiKey.startsWith('SG.')) {
    try {
      sgMail.setApiKey(sendgridApiKey);
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'auth@kudi.app';
      await sgMail.send({
        to: toEmail,
        from: fromEmail,
        subject: `${otpCode} is your Kudi security code`,
        html: emailHtml
      });
      console.log(`[Email Service] ✉️ OTP code successfully dispatched via SendGrid to ${toEmail}`);
      return true;
    } catch (err: any) {
      console.error('[SendGrid Mail Error]', err?.response?.body || err?.message || err);
    }
  }

  // 3. Try Nodemailer / Standard SMTP if configured
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const fromEmail = process.env.SMTP_FROM || 'auth@kudi.app';
      await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: `${otpCode} is your Kudi security code`,
        text: `Your Kudi verification code is: ${otpCode}`,
        html: emailHtml
      });

      console.log(`[Email Service] ✉️ OTP code successfully dispatched via SMTP to ${toEmail}`);
      return true;
    } catch (err: any) {
      console.error('[SMTP Mail Error]', err?.message);
    }
  }

  console.warn('[Email Service] ⚠️ No active email provider API key found (RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_PASS). Logged code in console.');
  return false;
}
