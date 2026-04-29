/**
 * Booking Controller
 *
 * Bookings are created by acceptQuote (quoteController) — this controller
 * handles everything that happens after a booking exists:
 *   deposit confirmation, booking confirmation, completion, cancellation,
 *   out-of-parameters approval, and read endpoints.
 *
 * Status machine (BookingStatus):
 *   PENDING_DEPOSIT  → CONFIRMED     (markDepositPaid — skips DEPOSIT_PAID since Stripe not wired)
 *   PENDING_REVIEW   → PENDING_DEPOSIT (approveOutOfParametersBooking)
 *   PENDING_REVIEW   → CANCELLED
 *   DEPOSIT_PAID     → CONFIRMED     (confirmBooking)
 *   DEPOSIT_PAID     → CANCELLED
 *   CONFIRMED        → IN_PROGRESS   (future)
 *   CONFIRMED        → COMPLETED
 *   IN_PROGRESS      → COMPLETED
 */

import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { sendDepositConfirmed } from '../services/emailService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the caller's ProviderProfile (or a pinned one via ?profileId=). */
async function getProviderProfile(userId: string, profileId?: string) {
  const where: any = { userId };
  if (profileId) where.id = profileId;
  const profile = await prisma.providerProfile.findFirst({ where });
  if (!profile) throw new AppError('Provider profile not found', 404);
  return profile;
}

/** Standard full include for single-resource GET endpoints. */
const BOOKING_INCLUDE_FULL = {
  client: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
  },
  providerProfile: {
    select: { id: true, userId: true, businessName: true, primaryType: true, logoUrl: true },
  },
  package: {
    select: { id: true, name: true, category: true, included: true, pricingModel: true },
  },
  quote: {
    select: { id: true, addOns: true, adjustments: true, vendorMessage: true, version: true },
  },
} as const;

/** Fire a notification. */
async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: object,
) {
  await prisma.notification.create({
    data: { userId, type: type as any, title, message, data: data ?? {} },
  });
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. getBookingById
// GET /bookings/:id
// Auth: authenticate (client or vendor who owns it)
// ─────────────────────────────────────────────────────────────────────────────
export const getBookingById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where:   { id: req.params.id },
    include: BOOKING_INCLUDE_FULL,
  });
  if (!booking) throw new NotFoundError('Booking');

  const userId   = req.user!.id;
  const isClient = booking.clientId === userId;
  const isVendor = !!(await prisma.providerProfile.findFirst({
    where: { id: booking.providerProfileId, userId },
  }));

  if (!isClient && !isVendor) throw new ForbiddenError('You do not have access to this booking');

  res.json({ success: true, data: booking });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getMyBookingsAsClient
// GET /bookings/me/client
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const getMyBookingsAsClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip   = (page - 1) * limit;
  const status = (req.query.status as string | undefined)?.toUpperCase();

  const where: any = { clientId: req.user!.id };
  if (status) where.status = status;

  const [bookings, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: {
        providerProfile: { select: { id: true, businessName: true, primaryType: true, logoUrl: true } },
        package:         { select: { id: true, name: true, category: true } },
      },
      orderBy: { eventDate: 'asc' },
      skip,
      take:  limit,
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    success: true,
    data:    bookings,
    meta:    { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. getMyBookingsAsVendor
// GET /bookings/me/vendor
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const getMyBookingsAsVendor = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip   = (page - 1) * limit;
  const status = (req.query.status as string | undefined)?.toUpperCase();

  const where: any = { providerProfileId: profile.id };
  if (status) where.status = status;

  const [bookings, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: {
        client:  { select: { id: true, firstName: true, lastName: true, city: true, avatarUrl: true } },
        package: { select: { id: true, name: true, category: true } },
      },
      orderBy: { eventDate: 'asc' },
      skip,
      take:  limit,
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    success: true,
    data:    bookings,
    meta:    { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. markDepositPaid
// PATCH /bookings/:id/deposit-paid
// Auth: requireProvider
// Note: goes straight to CONFIRMED — Stripe not yet wired
// ─────────────────────────────────────────────────────────────────────────────
export const markDepositPaid = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile  = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Booking');
  if (existing.providerProfileId !== profile.id) throw new ForbiddenError('You do not own this booking');
  if (!['PENDING_DEPOSIT', 'PENDING_REVIEW'].includes(existing.status)) {
    throw new AppError(`Cannot mark deposit paid for a booking with status ${existing.status}`, 400);
  }

  const booking = await prisma.booking.update({
    where:   { id: req.params.id },
    data:    { status: 'CONFIRMED', depositPaidAt: new Date() },
    include: BOOKING_INCLUDE_FULL,
  });

  await notify(
    booking.client.id,
    'PAYMENT_RECEIVED',
    'Deposit confirmed',
    `Your deposit of ${usd(booking.depositAmount)} has been confirmed by ${profile.businessName}. Your booking is confirmed!`,
    { bookingId: booking.id },
  );

  // Fire-and-forget deposit confirmation email to client
  sendDepositConfirmed(
    booking.client.email,
    `${booking.client.firstName} ${booking.client.lastName}`.trim(),
    profile.businessName,
    booking.eventType,
    booking.eventDate,
  ).catch(() => {});

  res.json({ success: true, data: booking });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. confirmBooking
// PATCH /bookings/:id/confirm
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const confirmBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile  = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Booking');
  if (existing.providerProfileId !== profile.id) throw new ForbiddenError('You do not own this booking');
  if (existing.status !== 'DEPOSIT_PAID') {
    throw new AppError(`Cannot confirm a booking with status ${existing.status}. Expected DEPOSIT_PAID`, 400);
  }

  const booking = await prisma.booking.update({
    where:   { id: req.params.id },
    data:    { status: 'CONFIRMED' },
    include: BOOKING_INCLUDE_FULL,
  });

  await notify(
    booking.client.id,
    'BOOKING_CONFIRMED',
    'Booking confirmed',
    `${profile.businessName} has confirmed your booking for ${booking.eventType.toLowerCase().replace(/_/g, ' ')} on ${dateLabel(booking.eventDate)}`,
    { bookingId: booking.id },
  );

  res.json({ success: true, data: booking });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. completeBooking
// PATCH /bookings/:id/complete
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const completeBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile  = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Booking');
  if (existing.providerProfileId !== profile.id) throw new ForbiddenError('You do not own this booking');
  if (!['CONFIRMED', 'IN_PROGRESS'].includes(existing.status)) {
    throw new AppError(`Cannot complete a booking with status ${existing.status}`, 400);
  }

  const booking = await prisma.booking.update({
    where:   { id: req.params.id },
    data:    { status: 'COMPLETED' },
    include: BOOKING_INCLUDE_FULL,
  });

  await notify(
    booking.client.id,
    'SYSTEM',
    'Event completed',
    `Your event with ${profile.businessName} is marked as complete. We'd love to hear how it went — leave a review!`,
    { bookingId: booking.id },
  );

  res.json({ success: true, data: booking });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. cancelBooking
// PATCH /bookings/:id/cancel
// Auth: authenticate (client or vendor)
// Body: { reason? }
// ─────────────────────────────────────────────────────────────────────────────
export const cancelBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where:   { id: req.params.id },
    include: {
      client:          { select: { id: true, firstName: true, lastName: true } },
      providerProfile: { select: { id: true, userId: true, businessName: true } },
    },
  });
  if (!booking) throw new NotFoundError('Booking');

  const userId   = req.user!.id;
  const isClient = booking.clientId === userId;
  const isVendor = booking.providerProfile.userId === userId;

  if (!isClient && !isVendor) throw new ForbiddenError('You do not have access to this booking');

  const CANCELLABLE = ['PENDING_DEPOSIT', 'PENDING_REVIEW', 'DEPOSIT_PAID'];
  if (!CANCELLABLE.includes(booking.status)) {
    throw new AppError(
      `Cannot cancel a booking with status ${booking.status}. Cancellation is only allowed for: ${CANCELLABLE.join(', ')}`,
      400,
    );
  }

  const updated = await prisma.booking.update({
    where:   { id: req.params.id },
    data:    { status: 'CANCELLED' },
    include: BOOKING_INCLUDE_FULL,
  });

  const dl         = dateLabel(booking.eventDate);
  const eventLabel = booking.eventType.toLowerCase().replace(/_/g, ' ');
  const vendorName = booking.providerProfile.businessName;
  const clientName = `${booking.client.firstName} ${booking.client.lastName}`.trim();

  if (isVendor) {
    await notify(
      booking.client.id,
      'BOOKING_CANCELLED',
      'Booking cancelled',
      `${vendorName} cancelled your booking for ${eventLabel} on ${dl}`,
      { bookingId: booking.id },
    );
  } else {
    await notify(
      booking.providerProfile.userId,
      'BOOKING_CANCELLED',
      'Booking cancelled',
      `${clientName} cancelled their booking for ${eventLabel} on ${dl}`,
      { bookingId: booking.id },
    );
  }

  res.json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. approveOutOfParametersBooking
// PATCH /bookings/:id/approve
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const approveOutOfParametersBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile  = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Booking');
  if (existing.providerProfileId !== profile.id) throw new ForbiddenError('You do not own this booking');
  if (existing.status !== 'PENDING_REVIEW') {
    throw new AppError(`Cannot approve a booking with status ${existing.status}. Expected PENDING_REVIEW`, 400);
  }

  const booking = await prisma.booking.update({
    where:   { id: req.params.id },
    data:    { status: 'PENDING_DEPOSIT' },
    include: BOOKING_INCLUDE_FULL,
  });

  await notify(
    booking.client.id,
    'BOOKING_CONFIRMED',
    'Booking approved',
    `${profile.businessName} approved your out-of-parameters request. Please pay the deposit of ${usd(booking.depositAmount)} to confirm.`,
    { bookingId: booking.id },
  );

  res.json({ success: true, data: booking });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. getUpcomingBookings
// GET /bookings/upcoming
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const getUpcomingBookings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const bookings = await prisma.booking.findMany({
    where: {
      providerProfileId: profile.id,
      status:    { in: ['CONFIRMED', 'DEPOSIT_PAID'] },
      eventDate: { gte: new Date() },
    },
    include: {
      client:  { select: { id: true, firstName: true, lastName: true } },
      package: { select: { id: true, name: true } },
    },
    orderBy: { eventDate: 'asc' },
    take:    10,
  });

  res.json({ success: true, data: bookings });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. getBookingStats
// GET /bookings/stats
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const getBookingStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const pid     = profile.id;
  const now     = new Date();

  const [
    totalBookings,
    confirmedBookings,
    completedBookings,
    pendingDeposit,
    pendingReview,
    upcomingCount,
    revenueAgg,
  ] = await prisma.$transaction([
    prisma.booking.count({ where: { providerProfileId: pid } }),
    prisma.booking.count({ where: { providerProfileId: pid, status: { in: ['CONFIRMED', 'DEPOSIT_PAID'] } } }),
    prisma.booking.count({ where: { providerProfileId: pid, status: 'COMPLETED' } }),
    prisma.booking.count({ where: { providerProfileId: pid, status: 'PENDING_DEPOSIT' } }),
    prisma.booking.count({ where: { providerProfileId: pid, status: 'PENDING_REVIEW' } }),
    prisma.booking.count({ where: { providerProfileId: pid, status: 'CONFIRMED', eventDate: { gte: now } } }),
    prisma.booking.aggregate({
      where: { providerProfileId: pid, status: 'COMPLETED' },
      _sum:  { total: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalBookings,
      confirmedBookings,
      completedBookings,
      pendingDeposit,
      pendingReview,
      totalRevenue: revenueAgg._sum.total ?? 0,
      upcomingCount,
    },
  });
});
