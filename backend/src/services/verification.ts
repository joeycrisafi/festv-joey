import { Resend } from 'resend';
import twilio from 'twilio';

// Lazy initialization - only create when needed
let resendInstance: Resend | null = null;
let twilioInstance: ReturnType<typeof twilio> | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

function getTwilio() {
  if (!twilioInstance) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    twilioInstance = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioInstance;
}

export async function sendEmailCode(email: string, code: string, firstName: string) {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: 'FESTV <onboarding@resend.dev>',
      to: email,
      subject: 'Verify your email - FESTV',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #F5F3EF;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-family: Georgia, serif; font-size: 2rem; font-weight: 600; letter-spacing: 0.35em; color: #1A1714; margin: 0;">FEST<span style="color: #C4A06A;">V</span></h1>
              </div>

              <div style="background: #FFFFFF; border: 1px solid rgba(0,0,0,0.09); border-radius: 16px; padding: 40px;">
                <h2 style="font-size: 20px; font-weight: 600; color: #1A1714; margin: 0 0 12px 0;">Hi ${firstName},</h2>
                <p style="font-size: 15px; color: #7A7068; line-height: 24px; margin: 0 0 28px 0;">
                  Thanks for joining FESTV! Enter the code below to verify your email address.
                </p>
                <div style="background: #F5F3EF; border: 2px solid #C4A06A; border-radius: 12px; padding: 28px; text-align: center; margin: 0 0 28px 0;">
                  <div style="font-size: 38px; font-weight: 700; color: #9C7A45; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                    ${code}
                  </div>
                </div>
                <p style="font-size: 13px; color: #7A7068; line-height: 20px; margin: 0;">
                  This code expires in <strong>15 minutes</strong>. If you didn't create a FESTV account, you can safely ignore this email.
                </p>
              </div>

              <div style="text-align: center; margin-top: 28px;">
                <p style="font-size: 12px; color: #A8A29E; margin: 0;">© ${new Date().getFullYear()} FESTV. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Failed to send verification email');
  }
}

export async function sendSMSCode(phoneNumber: string, code: string) {
  try {
    const twilioClient = getTwilio();
    await twilioClient.messages.create({
      body: `Your Fêtes verification code is: ${code}. Expires in 15 minutes.`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    throw new Error('Failed to send SMS verification code');
  }
}

export async function sendPasswordResetEmail(email: string, code: string, firstName: string) {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: 'FESTV <onboarding@resend.dev>',
      to: email,
      subject: 'Reset your password - FESTV',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #F5F3EF;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-family: Georgia, serif; font-size: 2rem; font-weight: 600; letter-spacing: 0.35em; color: #1A1714; margin: 0;">FEST<span style="color: #C4A06A;">V</span></h1>
              </div>

              <div style="background: #FFFFFF; border: 1px solid rgba(0,0,0,0.09); border-radius: 16px; padding: 40px;">
                <h2 style="font-size: 20px; font-weight: 600; color: #1A1714; margin: 0 0 12px 0;">Hi ${firstName},</h2>
                <p style="font-size: 15px; color: #7A7068; line-height: 24px; margin: 0 0 28px 0;">
                  We received a request to reset your FESTV password. Use the code below — it expires in <strong>1 hour</strong>.
                </p>
                <div style="background: #F5F3EF; border: 2px solid #C4A06A; border-radius: 12px; padding: 28px; text-align: center; margin: 0 0 28px 0;">
                  <div style="font-size: 38px; font-weight: 700; color: #9C7A45; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                    ${code}
                  </div>
                </div>
                <p style="font-size: 13px; color: #7A7068; line-height: 20px; margin: 0;">
                  If you didn't request a password reset, you can safely ignore this email. Your password will not change.
                </p>
              </div>

              <div style="text-align: center; margin-top: 28px;">
                <p style="font-size: 12px; color: #A8A29E; margin: 0;">© ${new Date().getFullYear()} FESTV. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    return true;
  } catch (error) {
    console.error('Password reset email error:', error);
    throw new Error('Failed to send password reset email');
  }
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
