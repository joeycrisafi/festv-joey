/**
 * Email Service — transactional emails via Resend
 *
 * All functions are fire-and-forget: call without await and they log on failure
 * but never throw, so email issues can never break an API response.
 *
 * Usage:
 *   sendVendorApproved(email, businessName).catch(() => {});
 */

import { Resend } from 'resend';

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM = 'FESTV <noreply@festv.org>';
const YEAR = new Date().getFullYear();

// ─── Shared layout helpers ────────────────────────────────────────────────────

function wrapper(body: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#F5F3EF;">
    <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-family:Georgia,serif;font-size:2rem;font-weight:600;letter-spacing:0.35em;color:#1A1714;margin:0;">
          FEST<span style="color:#C4A06A;">V</span>
        </h1>
      </div>
      <div style="background:#FFFFFF;border:1px solid rgba(0,0,0,0.09);border-radius:16px;padding:40px;">
        ${body}
      </div>
      <div style="text-align:center;margin-top:28px;">
        <p style="font-size:12px;color:#A8A29E;margin:0;">© ${YEAR} FESTV. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="font-size:20px;font-weight:600;color:#1A1714;margin:0 0 12px 0;">${text}</h2>`;
}

function para(text: string): string {
  return `<p style="font-size:15px;color:#7A7068;line-height:24px;margin:0 0 16px 0;">${text}</p>`;
}

function infoBox(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 16px;font-size:13px;color:#7A7068;font-weight:600;white-space:nowrap;vertical-align:top;">${label}</td>
          <td style="padding:8px 16px;font-size:13px;color:#1A1714;">${value}</td>
        </tr>`,
    )
    .join('');
  return `<table style="width:100%;background:#F5F3EF;border-radius:10px;border-collapse:collapse;margin:0 0 24px 0;">
    <tbody>${cells}</tbody>
  </table>`;
}

function goldBadge(text: string): string {
  return `<div style="display:inline-block;background:#C4A06A;color:#fff;font-size:13px;font-weight:700;letter-spacing:0.08em;padding:4px 14px;border-radius:20px;margin:0 0 24px 0;">${text}</div>`;
}

function greenBadge(text: string): string {
  return `<div style="display:inline-block;background:#3A8A55;color:#fff;font-size:13px;font-weight:700;letter-spacing:0.08em;padding:4px 14px;border-radius:20px;margin:0 0 24px 0;">${text}</div>`;
}

function small(text: string): string {
  return `<p style="font-size:13px;color:#7A7068;line-height:20px;margin:0;">${text}</p>`;
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtEventType(t: string): string {
  return t
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── 0. Email verification (new account) ─────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  verificationUrl: string,
): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Verify your email address',
      html: wrapper(`
        ${heading(`Welcome to FESTV, ${firstName}!`)}
        ${para('Please verify your email address to activate your account and get started.')}
        <div style="text-align:center;margin:32px 0;">
          <a href="${verificationUrl}"
            style="display:inline-block;background:#C4A06A;color:#1A1714;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:14px 32px;border-radius:4px;">
            Verify Email Address
          </a>
        </div>
        ${small('This link expires in 24 hours. If you didn\'t create an account, you can safely ignore this email.')}
        ${small('Or copy this link: <a href="${verificationUrl}" style="color:#C4A06A;">${verificationUrl}</a>')}
      `),
    });
  } catch (err) {
    console.error('[emailService] sendVerificationEmail failed:', err);
  }
}

// ─── 0b. New message notification (to recipient) ─────────────────────────────

export async function sendNewMessage(
  to: string,
  recipientName: string,
  senderName: string,
  messagePreview: string,
  conversationUrl: string,
): Promise<void> {
  try {
    const resend = getResend();
    const preview = messagePreview.length > 120 ? messagePreview.slice(0, 120) + '…' : messagePreview;
    await resend.emails.send({
      from: FROM,
      to,
      subject: `New message from ${senderName} — FESTV`,
      html: wrapper(
        goldBadge('New Message') +
        heading(`Hi ${recipientName},`) +
        para(`You have a new message from <strong>${senderName}</strong>:`) +
        para(`<em style="color:#1A1714;">"${preview}"</em>`) +
        `<div style="text-align:center;margin:32px 0;">` +
        `<a href="${conversationUrl}" style="display:inline-block;background:#C4A06A;color:#1A1714;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:14px 32px;border-radius:4px;">View Message</a>` +
        `</div>` +
        small('You are receiving this because someone sent you a message on FESTV.'),
      ),
    });
  } catch (err) {
    console.error('[emailService] sendNewMessage failed:', err);
  }
}

// ─── 1. Vendor approved ───────────────────────────────────────────────────────

export async function sendVendorApproved(to: string, vendorName: string): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to,
      subject: `You're approved on FESTV — ${vendorName}`,
      html: wrapper(`
        ${greenBadge('✓ Application Approved')}
        ${heading(`Welcome to FESTV, ${vendorName}!`)}
        ${para('Your vendor profile has been reviewed and approved. You are now live on the platform and can start receiving event requests from clients.')}
        ${para('Here\'s what happens next:')}
        <ul style="font-size:15px;color:#7A7068;line-height:28px;margin:0 0 24px 0;padding-left:20px;">
          <li>Your profile is now visible in search results</li>
          <li>Clients can browse your packages and send requests</li>
          <li>You will receive email notifications for new requests and bookings</li>
        </ul>
        ${small('Log in to your FESTV dashboard at any time to manage your profile, packages, and availability.')}
      `),
    });
  } catch (err) {
    console.error('[emailService] sendVendorApproved failed:', err);
  }
}

// ─── 2. Vendor rejected ───────────────────────────────────────────────────────

export async function sendVendorRejected(
  to: string,
  vendorName: string,
  reason?: string,
): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to,
      subject: `FESTV application update — ${vendorName}`,
      html: wrapper(`
        ${heading(`Application update for ${vendorName}`)}
        ${para('Thank you for applying to join FESTV. After reviewing your profile, we are unable to approve your application at this time.')}
        ${reason ? infoBox([['Reason', reason]]) : ''}
        ${para('You are welcome to update your profile and resubmit for review. If you believe this decision was made in error, please reach out to our support team.')}
        ${small('We appreciate your interest in FESTV and hope to work together in the future.')}
      `),
    });
  } catch (err) {
    console.error('[emailService] sendVendorRejected failed:', err);
  }
}

// ─── 3. New event request (to vendor) ────────────────────────────────────────

export async function sendNewRequest(
  to: string,
  vendorName: string,
  clientName: string,
  eventType: string,
  eventDate: Date,
  estimatedValue?: number | null,
): Promise<void> {
  try {
    const resend = getResend();
    const rows: [string, string][] = [
      ['Client',     clientName],
      ['Event type', fmtEventType(eventType)],
      ['Event date', fmtDate(eventDate)],
    ];
    if (estimatedValue != null) {
      rows.push(['Estimated value', usd(estimatedValue)]);
    }
    await resend.emails.send({
      from: FROM,
      to,
      subject: `New request from ${clientName} — FESTV`,
      html: wrapper(`
        ${goldBadge('New Request')}
        ${heading(`Hi ${vendorName},`)}
        ${para(`You have a new event request waiting for your response.`)}
        ${infoBox(rows)}
        ${para('Log in to your FESTV dashboard to review the full request details and send a quote.')}
        ${small('Respond within 48 hours to keep your response rate high and maintain priority placement in search results.')}
      `),
    });
  } catch (err) {
    console.error('[emailService] sendNewRequest failed:', err);
  }
}

// ─── 4. Quote received (to client) ───────────────────────────────────────────

export async function sendQuoteReceived(
  to: string,
  clientName: string,
  vendorName: string,
  eventType: string,
  total: number,
  expiresAt: Date,
): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to,
      subject: `You received a quote from ${vendorName} — FESTV`,
      html: wrapper(`
        ${goldBadge('Quote Received')}
        ${heading(`Hi ${clientName},`)}
        ${para(`${vendorName} has sent you a quote for your upcoming event.`)}
        ${infoBox([
          ['Vendor',      vendorName],
          ['Event',       fmtEventType(eventType)],
          ['Total',       usd(total)],
          ['Expires',     fmtDate(expiresAt)],
        ])}
        ${para('Log in to your FESTV dashboard to review the full quote breakdown and accept or decline.')}
        ${small('This quote expires on ' + fmtDate(expiresAt) + '. After that date the vendor may revise or withdraw it.')}
      `),
    });
  } catch (err) {
    console.error('[emailService] sendQuoteReceived failed:', err);
  }
}

// ─── 5. Booking confirmed (to client, when they accept a quote) ───────────────

export async function sendBookingConfirmed(
  to: string,
  clientName: string,
  vendorName: string,
  eventType: string,
  eventDate: Date,
  depositAmount: number,
): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Booking confirmed — ${vendorName} · FESTV`,
      html: wrapper(`
        ${greenBadge('✓ Booking Confirmed')}
        ${heading(`You're booked, ${clientName}!`)}
        ${para(`Your booking with ${vendorName} has been confirmed. Here's a summary:`)}
        ${infoBox([
          ['Vendor',     vendorName],
          ['Event',      fmtEventType(eventType)],
          ['Event date', fmtDate(eventDate)],
          ['Deposit due', usd(depositAmount)],
        ])}
        ${para('To secure your booking, please pay the deposit of <strong>' + usd(depositAmount) + '</strong> through your FESTV dashboard.')}
        ${small('Your booking is not fully secured until the deposit is received. Log in to pay and view your full booking details.')}
      `),
    });
  } catch (err) {
    console.error('[emailService] sendBookingConfirmed failed:', err);
  }
}

// ─── 6. Deposit confirmed (to client, when vendor marks deposit paid) ─────────

export async function sendDepositConfirmed(
  to: string,
  clientName: string,
  vendorName: string,
  eventType: string,
  eventDate: Date,
): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Deposit confirmed — you're all set! · FESTV`,
      html: wrapper(`
        ${greenBadge('✓ Deposit Confirmed')}
        ${heading(`You\'re all set, ${clientName}!`)}
        ${para(`Your deposit has been confirmed by ${vendorName}. Your booking is now fully secured.`)}
        ${infoBox([
          ['Vendor',     vendorName],
          ['Event',      fmtEventType(eventType)],
          ['Event date', fmtDate(eventDate)],
          ['Status',     'Confirmed ✓'],
        ])}
        ${para('We can\'t wait for your event! You can view your full booking details anytime in your FESTV dashboard.')}
        ${small('If you have any questions or need to make changes, please contact ' + vendorName + ' directly through your dashboard.')}
      `),
    });
  } catch (err) {
    console.error('[emailService] sendDepositConfirmed failed:', err);
  }
}
