import { Request, Response } from 'express';
import stripe from '../config/stripe.js';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { createNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────────────
// Vendor onboarding — Connect Express
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/stripe/connect/onboard
 * Creates (or returns existing) a Stripe Connect Express account and returns
 * an account-link URL for the vendor to complete onboarding.
 */
export const createConnectAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { profileId } = req.body;

  const profile = await prisma.providerProfile.findFirst({
    where: { id: profileId, userId },
  });
  if (!profile) throw new NotFoundError('Provider profile not found');

  let stripeAccountId = (profile as any).stripeAccountId as string | null;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CA',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    stripeAccountId = account.id;

    await prisma.$executeRawUnsafe(
      `UPDATE "ProviderProfile" SET "stripeAccountId" = $1, "stripeAccountStatus" = 'PENDING' WHERE id = $2`,
      stripeAccountId,
      profile.id,
    );
  }

  const returnUrl = `${config.frontendUrl}/provider/dashboard?stripe=success`;
  const refreshUrl = `${config.frontendUrl}/provider/dashboard?stripe=refresh`;

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  res.json({ success: true, data: { url: accountLink.url } });
});

/**
 * GET /api/v1/stripe/connect/status?profileId=xxx
 * Returns the current Stripe Connect status for a provider profile.
 */
export const getConnectStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { profileId } = req.query as { profileId: string };

  const profile = await prisma.providerProfile.findFirst({
    where: { id: profileId, userId },
    select: { id: true } as any,
  });
  if (!profile) throw new NotFoundError('Provider profile not found');

  const rows = await prisma.$queryRaw<{ stripeAccountId: string | null; stripeAccountStatus: string | null }[]>`
    SELECT "stripeAccountId", "stripeAccountStatus" FROM "ProviderProfile" WHERE id = ${profileId}
  `;
  const row = rows[0];

  let chargesEnabled = false;
  if (row?.stripeAccountId) {
    try {
      const acct = await stripe.accounts.retrieve(row.stripeAccountId);
      chargesEnabled = acct.charges_enabled;
      if (chargesEnabled && row.stripeAccountStatus !== 'ACTIVE') {
        await prisma.$executeRawUnsafe(
          `UPDATE "ProviderProfile" SET "stripeAccountStatus" = 'ACTIVE' WHERE id = $1`,
          profileId,
        );
      }
    } catch {
      // Stripe account may not exist yet
    }
  }

  res.json({
    success: true,
    data: {
      stripeAccountId: row?.stripeAccountId ?? null,
      stripeAccountStatus: chargesEnabled ? 'ACTIVE' : (row?.stripeAccountStatus ?? null),
      chargesEnabled,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Deposit checkout session
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/stripe/checkout/deposit
 * Creates a Stripe Checkout Session for the deposit on a booking.
 * Body: { bookingId }
 */
export const createDepositCheckout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user!.id;
  const { bookingId } = req.body as { bookingId: string };

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, clientId },
    include: {
      providerProfile: {
        select: { id: true, businessName: true } as any,
      },
      quote: { select: { id: true } },
    },
  });
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.status !== 'PENDING_DEPOSIT') {
    throw new AppError('Deposit already paid or booking not in PENDING_DEPOSIT state', 400);
  }

  // Get provider's Stripe account
  const rows = await prisma.$queryRaw<{ stripeAccountId: string | null }[]>`
    SELECT "stripeAccountId" FROM "ProviderProfile" WHERE id = ${booking.providerProfileId}
  `;
  const providerStripeAccountId = rows[0]?.stripeAccountId;
  if (!providerStripeAccountId) {
    throw new AppError('This vendor has not connected their Stripe account yet.', 400);
  }

  const depositCents = Math.round(booking.depositAmount * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'cad',
    line_items: [
      {
        price_data: {
          currency: 'cad',
          unit_amount: depositCents,
          product_data: {
            name: `Deposit — ${(booking.providerProfile as any).businessName}`,
            description: `Event on ${booking.eventDate.toLocaleDateString('en-CA')}`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      transfer_data: {
        destination: providerStripeAccountId,
      },
    },
    success_url: `${config.frontendUrl}/bookings/${bookingId}?payment=success`,
    cancel_url: `${config.frontendUrl}/bookings/${bookingId}?payment=cancelled`,
    metadata: {
      bookingId,
      clientId,
    },
  });

  // Persist the session ID on the booking
  await prisma.$executeRawUnsafe(
    `UPDATE "Booking" SET "stripeSessionId" = $1 WHERE id = $2`,
    session.id,
    bookingId,
  );

  res.json({ success: true, data: { url: session.url, sessionId: session.id } });
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/stripe/webhook
 * Handles Stripe events. Must receive the raw body (no JSON middleware).
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const { bookingId, clientId } = session.metadata ?? {};
        if (!bookingId) break;

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.status !== 'PENDING_DEPOSIT') break;

        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: 'DEPOSIT_PAID',
            depositPaidAt: new Date(),
          } as any,
        });

        // Persist payment intent id
        const paymentIntentId = session.payment_intent;
        if (paymentIntentId) {
          await prisma.$executeRawUnsafe(
            `UPDATE "Booking" SET "stripePaymentIntentId" = $1 WHERE id = $2`,
            paymentIntentId,
            bookingId,
          );
        }

        // Notify provider
        const profileRows = await prisma.$queryRaw<{ userId: string; businessName: string }[]>`
          SELECT pp."userId", pp."businessName"
          FROM "ProviderProfile" pp
          JOIN "Booking" b ON b."providerProfileId" = pp.id
          WHERE b.id = ${bookingId}
        `;
        if (profileRows[0]) {
          await createNotification(
            profileRows[0].userId,
            'PAYMENT_RECEIVED',
            'Deposit received',
            `A deposit of $${booking.depositAmount.toFixed(2)} CAD has been paid for booking #${bookingId.slice(0, 8)}.`,
            { bookingId },
          );
        }

        // Notify client
        if (clientId) {
          await createNotification(
            clientId,
            'PAYMENT_RECEIVED',
            'Deposit confirmed',
            `Your deposit of $${booking.depositAmount.toFixed(2)} CAD has been processed. Your booking is confirmed!`,
            { bookingId },
          );
        }

        console.log(`✅ Deposit paid for booking ${bookingId}`);
        break;
      }

      case 'account.updated': {
        const account = event.data.object as any;
        if (account.charges_enabled) {
          await prisma.$executeRawUnsafe(
            `UPDATE "ProviderProfile" SET "stripeAccountStatus" = 'ACTIVE' WHERE "stripeAccountId" = $1`,
            account.id,
          );
          console.log(`✅ Stripe account ${account.id} is now active`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
    return;
  }

  res.json({ received: true });
};
