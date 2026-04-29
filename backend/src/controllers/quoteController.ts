/**
 * Quote Controller
 *
 * Two paths to a quote:
 *   Auto-generate  — pricing engine runs against the event request's package;
 *                    only works when isOutOfParameters = false.
 *   Manual quote   — vendor supplies line items directly; supports out-of-
 *                    parameter requests and custom packages.
 *
 * Version history is immutable: revisions create a new Quote row with an
 * incremented version number. Old versions are never overwritten.
 *
 * Status machine (QuoteStatus):
 *   DRAFT → SENT → VIEWED → ACCEPTED | REJECTED | WITHDRAWN | EXPIRED
 *   SENT → WITHDRAWN  (vendor revises — old quote stays as record)
 */

import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { calculatePackagePrice } from '../services/pricingEngine.js';
import { sendQuoteReceived, sendBookingConfirmed } from '../services/emailService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Resolve the caller's ProviderProfile (or a pinned one via query param). */
async function getProviderProfile(userId: string, profileId?: string) {
  const where: any = { userId };
  if (profileId) where.id = profileId;
  const profile = await prisma.providerProfile.findFirst({ where });
  if (!profile) throw new AppError('Provider profile not found', 404);
  return profile;
}

/**
 * Confirm an EventRequest belongs to the given providerProfile and
 * optionally enforce an allowed-status list.
 */
async function requireRequestOwnership(
  eventRequestId: string,
  providerProfileId: string,
  allowedStatuses?: string[],
) {
  const request = await prisma.eventRequest.findUnique({
    where: { id: eventRequestId },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!request) throw new NotFoundError('Event request');
  if (request.providerProfileId !== providerProfileId) {
    throw new ForbiddenError('This event request does not belong to your profile');
  }
  if (allowedStatuses && !allowedStatuses.includes(request.status)) {
    throw new AppError(
      `Event request has status ${request.status}. Expected one of: ${allowedStatuses.join(', ')}`,
      400,
    );
  }
  return request;
}

/** Confirm a Quote belongs to the given providerProfileId. */
async function requireQuoteVendorOwnership(quoteId: string, providerProfileId: string) {
  const quote = await prisma.quote.findUnique({
    where:   { id: quoteId },
    include: {
      eventRequest: {
        include: { client: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  if (!quote) throw new NotFoundError('Quote');
  if (quote.providerProfileId !== providerProfileId) {
    throw new ForbiddenError('This quote does not belong to your profile');
  }
  return quote;
}

/** Confirm a Quote is accessible by the given clientId (via eventRequest). */
async function requireQuoteClientOwnership(quoteId: string, clientId: string) {
  const quote = await prisma.quote.findUnique({
    where:   { id: quoteId },
    include: {
      eventRequest: {
        include: { client: { select: { id: true, firstName: true, lastName: true } } },
      },
      providerProfile: { select: { id: true, businessName: true, userId: true } },
      package:         { select: { id: true, name: true, category: true } },
    },
  });
  if (!quote) throw new NotFoundError('Quote');
  if (quote.eventRequest.clientId !== clientId) {
    throw new ForbiddenError('You do not have access to this quote');
  }
  return quote;
}

/** Fire a notification without blocking the response on failure. */
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. autoGenerateQuote
// POST /quotes/auto-generate
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const autoGenerateQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { eventRequestId } = req.body;
  if (!eventRequestId) throw new AppError('eventRequestId is required', 400);

  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const request = await requireRequestOwnership(eventRequestId, profile.id, ['PENDING']);

  if (!request.packageId) {
    throw new AppError('Event request has no package selected — use manual quote instead', 400);
  }
  if (request.isOutOfParameters) {
    throw new AppError('This request is out of parameters and requires a manual quote', 400);
  }

  // Run pricing engine
  const result = await calculatePackagePrice({
    packageId:        request.packageId,
    eventDate:        request.eventDate,
    guestCount:       request.guestCount,
    durationHours:    request.durationHours ?? undefined,
    selectedAddOnIds: request.selectedAddOnIds,
  });

  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);

  const quote = await prisma.quote.create({
    data: {
      eventRequestId:    request.id,
      providerProfileId: profile.id,
      packageId:         request.packageId,
      version:           1,
      eventDate:         request.eventDate,
      guestCount:        request.guestCount,
      durationHours:     request.durationHours ?? undefined,
      packagePrice:      result.appliedPrice,
      minimumSpend:      result.minimumSpend,
      addOns:            result.addOns as any,
      addOnsTotal:       result.addOnsTotal,
      adjustments:       [] as any,
      adjustmentsTotal:  0,
      subtotal:          result.subtotal,
      tax:               result.tax,
      total:             result.total,
      depositAmount:     result.depositAmount,
      isAutoGenerated:   true,
      isOutOfParameters: false,
      status:            'SENT',
      expiresAt,
    },
    include: {
      eventRequest: { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
      package:      { select: { id: true, name: true, category: true } },
      providerProfile: { select: { id: true, businessName: true } },
    },
  });

  // Update request status
  await prisma.eventRequest.update({
    where: { id: request.id },
    data:  { status: 'QUOTE_SENT' },
  });

  // Notify client (in-app)
  const dateLabel = request.eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  await notify(
    request.client.id,
    'NEW_QUOTE',
    'You received a quote',
    `${profile.businessName} sent you a quote for ${request.eventType.toLowerCase().replace(/_/g, ' ')} on ${dateLabel} — $${result.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    { quoteId: quote.id, eventRequestId: request.id },
  );

  // Fire-and-forget email to client
  prisma.user.findUnique({ where: { id: request.client.id }, select: { email: true } })
    .then((u) => {
      if (u) {
        sendQuoteReceived(
          u.email,
          `${request.client.firstName} ${request.client.lastName}`.trim(),
          profile.businessName,
          request.eventType,
          result.total,
          expiresAt,
        ).catch(() => {});
      }
    })
    .catch(() => {});

  res.status(201).json({ success: true, data: quote });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. createManualQuote
// POST /quotes/manual
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const createManualQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    eventRequestId,
    packagePrice,
    minimumSpend,
    addOns        = [],
    adjustments   = [],
    vendorMessage,
    expiresAt: expiresAtInput,
  } = req.body;

  if (!eventRequestId)   throw new AppError('eventRequestId is required', 400);
  if (packagePrice == null) throw new AppError('packagePrice is required', 400);

  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const request = await requireRequestOwnership(eventRequestId, profile.id, ['PENDING', 'QUOTE_SENT']);

  // Calculate totals from supplied line items
  const addOnsTotal      = r2(addOns.reduce((s: number, a: any) => s + (Number(a.total) || 0), 0));
  const adjustmentsTotal = r2(adjustments.reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0));
  const subtotal         = r2(parseFloat(packagePrice) + addOnsTotal + adjustmentsTotal);
  const tax              = r2(subtotal * 0.15);
  const total            = r2(subtotal + tax);
  const depositAmount    = r2(total * 0.10);

  // Version: one higher than the current max for this event request
  const latest = await prisma.quote.findFirst({
    where:   { eventRequestId },
    orderBy: { version: 'desc' },
    select:  { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  const expiresAt = expiresAtInput ? new Date(expiresAtInput) : new Date(Date.now() + SEVEN_DAYS_MS);

  const quote = await prisma.quote.create({
    data: {
      eventRequestId,
      providerProfileId: profile.id,
      packageId:         request.packageId ?? undefined,
      version,
      eventDate:         request.eventDate,
      guestCount:        request.guestCount,
      durationHours:     request.durationHours ?? undefined,
      packagePrice:      r2(parseFloat(packagePrice)),
      minimumSpend:      minimumSpend != null ? r2(parseFloat(minimumSpend)) : undefined,
      addOns:            addOns as any,
      addOnsTotal,
      adjustments:       adjustments as any,
      adjustmentsTotal,
      subtotal,
      tax,
      total,
      depositAmount,
      isAutoGenerated:   false,
      isOutOfParameters: request.isOutOfParameters,
      vendorMessage:     vendorMessage ? String(vendorMessage) : undefined,
      status:            'SENT',
      expiresAt,
    },
    include: {
      eventRequest: { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
      package:      { select: { id: true, name: true, category: true } },
      providerProfile: { select: { id: true, businessName: true } },
    },
  });

  await prisma.eventRequest.update({
    where: { id: eventRequestId },
    data:  { status: 'QUOTE_SENT' },
  });

  const dateLabel = request.eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  await notify(
    request.client.id,
    'NEW_QUOTE',
    'You received a quote',
    `${profile.businessName} sent you a quote for ${request.eventType.toLowerCase().replace(/_/g, ' ')} on ${dateLabel} — $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    { quoteId: quote.id, eventRequestId: request.id },
  );

  // Fire-and-forget email to client
  prisma.user.findUnique({ where: { id: request.client.id }, select: { email: true } })
    .then((u) => {
      if (u) {
        sendQuoteReceived(
          u.email,
          `${request.client.firstName} ${request.client.lastName}`.trim(),
          profile.businessName,
          request.eventType,
          total,
          expiresAt,
        ).catch(() => {});
      }
    })
    .catch(() => {});

  res.status(201).json({ success: true, data: quote });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. getQuoteById
// GET /quotes/:id
// Auth: authenticate (client or vendor who owns it)
// ─────────────────────────────────────────────────────────────────────────────
export const getQuoteById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const quote = await prisma.quote.findUnique({
    where:   { id: req.params.id },
    include: {
      eventRequest: {
        include: { client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      },
      package:         true,
      providerProfile: { select: { id: true, businessName: true, primaryType: true, logoUrl: true, averageRating: true } },
    },
  });
  if (!quote) throw new NotFoundError('Quote');

  const userId = req.user!.id;
  const isClient = quote.eventRequest.clientId === userId;
  const isVendor = !!(await prisma.providerProfile.findFirst({
    where: { id: quote.providerProfileId, userId },
  }));

  if (!isClient && !isVendor) {
    throw new ForbiddenError('You do not have access to this quote');
  }

  // Mark as VIEWED when client opens a SENT quote
  if (isClient && quote.status === 'SENT') {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: 'VIEWED' } });
    (quote as any).status = 'VIEWED';
  }

  res.json({ success: true, data: quote });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. getMyQuotesAsVendor
// GET /quotes/me/vendor
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const getMyQuotesAsVendor = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip  = (page - 1) * limit;
  const status = (req.query.status as string | undefined)?.toUpperCase();

  const where: any = { providerProfileId: profile.id };
  if (status) where.status = status;

  const [quotes, total] = await prisma.$transaction([
    prisma.quote.findMany({
      where,
      include: {
        eventRequest: {
          select: {
            id: true, eventType: true, eventDate: true, guestCount: true,
            client: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        package: { select: { id: true, name: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take:  limit,
    }),
    prisma.quote.count({ where }),
  ]);

  res.json({
    success: true,
    data:    quotes,
    meta:    { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. getMyQuotesAsClient
// GET /quotes/me/client
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const getMyQuotesAsClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip  = (page - 1) * limit;
  const status = (req.query.status as string | undefined)?.toUpperCase();

  const where: any = { eventRequest: { clientId: req.user!.id } };
  if (status) where.status = status;

  const [quotes, total] = await prisma.$transaction([
    prisma.quote.findMany({
      where,
      include: {
        eventRequest: {
          select: { id: true, eventType: true, eventDate: true, guestCount: true },
        },
        package:         { select: { id: true, name: true, category: true } },
        providerProfile: { select: { id: true, businessName: true, logoUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take:  limit,
    }),
    prisma.quote.count({ where }),
  ]);

  res.json({
    success: true,
    data:    quotes,
    meta:    { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. acceptQuote
// POST /quotes/:id/accept
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const acceptQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const quote = await requireQuoteClientOwnership(req.params.id, req.user!.id);

  if (!['SENT', 'VIEWED'].includes(quote.status)) {
    throw new AppError(`Cannot accept a quote with status ${quote.status}`, 400);
  }
  if (!quote.packageId) {
    throw new AppError('Cannot book: quote has no package associated', 400);
  }

  // Accept quote + event request in a transaction, then create booking
  const [updatedQuote, booking] = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.update({
      where: { id: quote.id },
      data:  { status: 'ACCEPTED' },
    });

    await tx.eventRequest.update({
      where: { id: quote.eventRequestId },
      data:  { status: 'ACCEPTED' },
    });

    const b = await tx.booking.create({
      data: {
        clientId:          quote.eventRequest.clientId,
        providerProfileId: quote.providerProfileId,
        packageId:         quote.packageId!,
        quoteId:           quote.id,
        eventType:         quote.eventRequest.eventType,
        eventDate:         quote.eventDate,
        guestCount:        quote.guestCount,
        durationHours:     quote.durationHours ?? undefined,
        packagePrice:      quote.packagePrice,
        addOnsTotal:       quote.addOnsTotal,
        adjustmentsTotal:  quote.adjustmentsTotal,
        subtotal:          quote.subtotal,
        tax:               quote.tax,
        total:             quote.total,
        depositAmount:     quote.depositAmount,
        specialRequests:   quote.eventRequest.specialRequests ?? undefined,
        status:            'PENDING_DEPOSIT',
      },
    });

    return [q, b];
  });

  // Notify vendor (in-app)
  const client     = quote.eventRequest.client;
  const clientName = `${client.firstName} ${client.lastName}`.trim();
  const dep        = `$${quote.depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  await notify(
    quote.providerProfile!.userId,
    'BOOKING_CONFIRMED',
    'Quote accepted',
    `${clientName} accepted your quote — deposit of ${dep} is pending`,
    { quoteId: quote.id, bookingId: booking.id },
  );

  // Fire-and-forget booking confirmation email to client
  prisma.user.findUnique({ where: { id: quote.eventRequest.clientId }, select: { email: true } })
    .then((u) => {
      if (u) {
        sendBookingConfirmed(
          u.email,
          clientName,
          quote.providerProfile!.businessName,
          quote.eventRequest.eventType,
          quote.eventDate,
          quote.depositAmount,
        ).catch(() => {});
      }
    })
    .catch(() => {});

  res.json({ success: true, data: { quote: updatedQuote, booking } });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. rejectQuote
// POST /quotes/:id/reject
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const rejectQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const quote = await requireQuoteClientOwnership(req.params.id, req.user!.id);

  if (!['SENT', 'VIEWED'].includes(quote.status)) {
    throw new AppError(`Cannot reject a quote with status ${quote.status}`, 400);
  }

  const updatedQuote = await prisma.quote.update({
    where: { id: quote.id },
    data:  { status: 'REJECTED' },
  });

  await prisma.eventRequest.update({
    where: { id: quote.eventRequestId },
    data:  { status: 'DECLINED' },
  });

  // Notify vendor
  const client     = quote.eventRequest.client;
  const clientName = `${client.firstName} ${client.lastName}`.trim();
  const dateLabel  = quote.eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  await notify(
    quote.providerProfile!.userId,
    'QUOTE_REJECTED',
    'Quote declined',
    `${clientName} declined your quote for ${quote.eventRequest.eventType.toLowerCase().replace(/_/g, ' ')} on ${dateLabel}`,
    { quoteId: quote.id, eventRequestId: quote.eventRequestId },
  );

  res.json({ success: true, data: updatedQuote });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. reviseQuote
// POST /quotes/:id/revise
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const reviseQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const original = await requireQuoteVendorOwnership(req.params.id, profile.id);

  if (!['SENT', 'VIEWED'].includes(original.status)) {
    throw new AppError(`Cannot revise a quote with status ${original.status}`, 400);
  }

  const {
    packagePrice,
    minimumSpend,
    addOns        = [],
    adjustments   = [],
    vendorMessage,
    expiresAt: expiresAtInput,
  } = req.body;

  if (packagePrice == null) throw new AppError('packagePrice is required', 400);

  const addOnsTotal      = r2(addOns.reduce((s: number, a: any) => s + (Number(a.total) || 0), 0));
  const adjustmentsTotal = r2(adjustments.reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0));
  const subtotal         = r2(parseFloat(packagePrice) + addOnsTotal + adjustmentsTotal);
  const tax              = r2(subtotal * 0.15);
  const total            = r2(subtotal + tax);
  const depositAmount    = r2(total * 0.10);
  const expiresAt        = expiresAtInput ? new Date(expiresAtInput) : new Date(Date.now() + SEVEN_DAYS_MS);

  const newQuote = await prisma.quote.create({
    data: {
      eventRequestId:    original.eventRequestId,
      providerProfileId: profile.id,
      packageId:         original.packageId ?? undefined,
      version:           original.version + 1,
      eventDate:         original.eventDate,
      guestCount:        original.guestCount,
      durationHours:     original.durationHours ?? undefined,
      packagePrice:      r2(parseFloat(packagePrice)),
      minimumSpend:      minimumSpend != null ? r2(parseFloat(minimumSpend)) : undefined,
      addOns:            addOns as any,
      addOnsTotal,
      adjustments:       adjustments as any,
      adjustmentsTotal,
      subtotal,
      tax,
      total,
      depositAmount,
      isAutoGenerated:   false,
      isOutOfParameters: original.isOutOfParameters,
      vendorMessage:     vendorMessage ? String(vendorMessage) : undefined,
      status:            'SENT',
      expiresAt,
    },
    include: {
      eventRequest: { include: { client: { select: { id: true, firstName: true, lastName: true } } } },
      package:      { select: { id: true, name: true, category: true } },
      providerProfile: { select: { id: true, businessName: true } },
    },
  });

  await prisma.eventRequest.update({
    where: { id: original.eventRequestId },
    data:  { status: 'QUOTE_SENT' },
  });

  const dateLabel = original.eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  await notify(
    newQuote.eventRequest.client.id,
    'NEW_QUOTE',
    'Revised quote received',
    `${profile.businessName} sent you a revised quote (v${newQuote.version}) for ${newQuote.eventRequest.eventType.toLowerCase().replace(/_/g, ' ')} on ${dateLabel} — $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    { quoteId: newQuote.id, eventRequestId: original.eventRequestId },
  );

  // Fire-and-forget email to client
  prisma.user.findUnique({ where: { id: newQuote.eventRequest.client.id }, select: { email: true } })
    .then((u) => {
      if (u) {
        sendQuoteReceived(
          u.email,
          `${newQuote.eventRequest.client.firstName} ${newQuote.eventRequest.client.lastName}`.trim(),
          profile.businessName,
          newQuote.eventRequest.eventType,
          total,
          expiresAt,
        ).catch(() => {});
      }
    })
    .catch(() => {});

  res.status(201).json({ success: true, data: newQuote });
});
