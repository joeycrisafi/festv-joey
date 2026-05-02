/**
 * Event Request Controller
 *
 * Vendor-direct model: a planner (CLIENT) sends a request to a specific
 * ProviderProfile, optionally pinned to a Package. The pricing engine runs
 * immediately at creation time so the vendor already sees an estimate when
 * the request lands in their inbox.
 *
 * Status machine (EventRequestStatus enum):
 *   PENDING → QUOTE_SENT   (vendor sends a quote)
 *   PENDING → DECLINED     (vendor declines)
 *   PENDING → EXPIRED      (client cancels before quote is sent)
 *   QUOTE_SENT → ACCEPTED  (client books)
 *   QUOTE_SENT → DECLINED  (vendor withdraws quote)
 */

import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { calculatePackagePrice } from '../services/pricingEngine.js';
import { sendNewRequest, sendQuoteReceived } from '../services/emailService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the caller's first ProviderProfile (or a specific one via query param). */
async function getProviderProfile(userId: string, profileId?: string) {
  const where: any = { userId };
  if (profileId) where.id = profileId;
  const profile = await prisma.providerProfile.findFirst({ where });
  if (!profile) throw new AppError('Provider profile not found', 404);
  return profile;
}

/** Standard include shape used across all GET endpoints. */
const REQUEST_INCLUDE_FULL = {
  package: true,
  providerProfile: {
    select: {
      id: true,
      businessName: true,
      primaryType: true,
      providerTypes: true,
      logoUrl: true,
      averageRating: true,
      verificationStatus: true,
    },
  },
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      city: true,
      state: true,
    },
  },
  quotes: {
    select: {
      id: true,
      status: true,
      total: true,
      version: true,
      createdAt: true,
      booking: { select: { id: true, status: true } },
    },
    orderBy: { version: 'desc' as const },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. createEventRequest
// POST /event-requests
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const createEventRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    providerProfileId,
    packageId,
    eventId,
    eventType,
    eventDate,
    guestCount,
    durationHours,
    selectedAddOnIds = [],
    specialRequests,
  } = req.body;

  // Required field validation
  if (!providerProfileId) throw new AppError('providerProfileId is required', 400);
  if (!eventType)         throw new AppError('eventType is required', 400);
  if (!eventDate)         throw new AppError('eventDate is required', 400);
  if (guestCount == null) throw new AppError('guestCount is required', 400);

  const parsedDate = new Date(eventDate);
  if (isNaN(parsedDate.getTime())) throw new AppError('Invalid eventDate', 400);

  // Confirm the target provider exists (include email for notification)
  const vendor = await prisma.providerProfile.findUnique({
    where:   { id: providerProfileId },
    include: { user: { select: { email: true } } },
  });
  if (!vendor) throw new NotFoundError('Provider profile');

  // Run pricing engine if a package was selected
  let calculatedEstimate: number | null = null;
  let isOutOfParameters = false;
  let pricing: Awaited<ReturnType<typeof calculatePackagePrice>> | null = null;

  if (packageId) {
    try {
      pricing = await calculatePackagePrice({
        packageId:        String(packageId),
        eventDate:        parsedDate,
        guestCount:       parseInt(guestCount),
        durationHours:    durationHours != null ? parseFloat(durationHours) : undefined,
        selectedAddOnIds: Array.isArray(selectedAddOnIds) ? selectedAddOnIds : [],
      });
      calculatedEstimate = pricing.total;
      isOutOfParameters  = pricing.isOutOfParameters;
    } catch (err: any) {
      // If the package doesn't exist just proceed without an estimate
      if (err.statusCode !== 404) throw err;
    }
  }

  // Create the event request
  const request = await prisma.eventRequest.create({
    data: {
      clientId:          req.user!.id,
      providerProfileId,
      packageId:         packageId ? String(packageId) : undefined,
      eventId:           eventId   ? String(eventId)   : undefined,
      eventType,
      eventDate:         parsedDate,
      guestCount:        parseInt(guestCount),
      durationHours:     durationHours != null ? parseFloat(durationHours) : undefined,
      selectedAddOnIds:  Array.isArray(selectedAddOnIds) ? selectedAddOnIds : [],
      specialRequests:   specialRequests ? String(specialRequests) : undefined,
      calculatedEstimate,
      isOutOfParameters,
      status:            'PENDING',
    },
    include: REQUEST_INCLUDE_FULL,
  });

  // Auto-create a conversation between planner and vendor if one doesn't exist
  const clientId = req.user!.id;
  const vendorUserId = vendor.userId;
  const existingConversation = await prisma.conversation.findFirst({
    where: { participants: { hasEvery: [clientId, vendorUserId] } },
  });
  if (!existingConversation) {
    await prisma.conversation.create({
      data: { participants: [clientId, vendorUserId] },
    });
  }

  // Notify the vendor
  const clientName = `${req.user!.firstName} ${req.user!.lastName}`.trim();
  const dateLabel  = parsedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  await prisma.notification.create({
    data: {
      userId:  vendor.userId,
      type:    'NEW_REQUEST',
      title:   'New event request',
      message: `${clientName} sent you a request for ${eventType.toLowerCase().replace('_', ' ')} on ${dateLabel}`,
      data:    { eventRequestId: request.id },
    },
  });

  // Fire-and-forget email to vendor
  sendNewRequest(
    vendor.user.email,
    vendor.businessName,
    clientName,
    eventType,
    parsedDate,
    calculatedEstimate,
  ).catch(() => {});

  // Auto-generate a quote for standard (in-parameters) requests
  if (packageId && pricing && !isOutOfParameters) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.quote.create({
      data: {
        eventRequestId:    request.id,
        providerProfileId,
        packageId:         String(packageId),
        version:           1,
        eventDate:         parsedDate,
        guestCount:        parseInt(guestCount),
        durationHours:     durationHours != null ? parseFloat(durationHours) : undefined,
        packagePrice:      pricing.packagePrice,
        minimumSpend:      pricing.minimumSpend,
        addOns:            pricing.addOns as any,
        addOnsTotal:       pricing.addOnsTotal,
        adjustments:       [],
        adjustmentsTotal:  0,
        subtotal:          pricing.subtotal,
        tax:               pricing.tax,
        total:             pricing.total,
        depositAmount:     pricing.depositAmount,
        isAutoGenerated:   true,
        isOutOfParameters: false,
        status:            'SENT',
        expiresAt,
      },
    });

    await prisma.eventRequest.update({
      where: { id: request.id },
      data:  { status: 'QUOTE_SENT' },
    });

    // Notify the client in-app
    await prisma.notification.create({
      data: {
        userId:  req.user!.id,
        type:    'NEW_QUOTE',
        title:   'Quote ready',
        message: `${vendor.businessName} has sent you a quote for your ${eventType.toLowerCase().replace('_', ' ')} on ${dateLabel}`,
        data:    { eventRequestId: request.id },
      },
    });

    // Fire-and-forget email to client
    sendQuoteReceived(
      req.user!.email,
      clientName,
      vendor.businessName,
      eventType,
      pricing.total,
      expiresAt,
    ).catch(() => {});
  }

  res.status(201).json({ success: true, data: request });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getMyRequestsAsClient
// GET /event-requests/me/client
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const getMyRequestsAsClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const requests = await prisma.eventRequest.findMany({
    where:   { clientId: req.user!.id },
    include: {
      package: {
        select: { id: true, name: true, category: true, pricingModel: true, basePrice: true },
      },
      providerProfile: {
        select: { id: true, businessName: true, primaryType: true, logoUrl: true, averageRating: true },
      },
      quotes: {
        select: { id: true, status: true, total: true, version: true, booking: { select: { id: true, status: true } } },
        orderBy: { version: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: requests.map(r => ({ ...r, booking: r.quotes?.[0]?.booking ?? null })) });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. getMyRequestsAsVendor
// GET /event-requests/me/vendor
// Auth: requireProvider
// ─────────────────────────────────────────────────────────────────────────────
export const getMyRequestsAsVendor = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const requests = await prisma.eventRequest.findMany({
    where:   { providerProfileId: profile.id },
    include: {
      package: {
        select: { id: true, name: true, category: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true, city: true, avatarUrl: true },
      },
      quotes: {
        select: { id: true, status: true, total: true, version: true, booking: { select: { id: true, status: true } } },
        orderBy: { version: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: requests.map(r => ({ ...r, booking: r.quotes?.[0]?.booking ?? null })) });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. getEventRequestById
// GET /event-requests/:id
// Auth: authenticate — must be the client or the vendor
// ─────────────────────────────────────────────────────────────────────────────
export const getEventRequestById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const request = await prisma.eventRequest.findUnique({
    where:   { id: req.params.id },
    include: REQUEST_INCLUDE_FULL,
  });

  if (!request) throw new NotFoundError('Event request');

  // Ownership check: caller must be client OR vendor for this request
  const userId = req.user!.id;
  const isClient = request.clientId === userId;
  const isVendor = request.providerProfile && await prisma.providerProfile.findFirst({
    where: { id: request.providerProfileId, userId },
  });

  if (!isClient && !isVendor) {
    throw new ForbiddenError('You do not have access to this event request');
  }

  const booking = (request as any).quotes?.[0]?.booking ?? null;
  res.json({ success: true, data: { ...request, booking } });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. updateEventRequestStatus
// PATCH /event-requests/:id/status
// Auth: requireProvider (DECLINED) or requireClient (EXPIRED)
// ─────────────────────────────────────────────────────────────────────────────
export const updateEventRequestStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;

  if (!status) throw new AppError('status is required', 400);

  const request = await prisma.eventRequest.findUnique({ where: { id: req.params.id } });
  if (!request) throw new NotFoundError('Event request');

  const userId = req.user!.id;
  const userRoles = req.user!.roles;
  const isClientRole   = userRoles.includes('CLIENT');
  const isProviderRole = userRoles.includes('PROVIDER') || userRoles.includes('ADMIN');

  // Determine who this user is relative to the request
  const isOwnerClient = request.clientId === userId;
  const vendorProfile = isProviderRole
    ? await prisma.providerProfile.findFirst({ where: { id: request.providerProfileId, userId } })
    : null;
  const isOwnerVendor = !!vendorProfile;

  // Validate transitions
  if (status === 'DECLINED') {
    if (!isOwnerVendor) throw new ForbiddenError('Only the vendor can decline a request');
    if (!['PENDING', 'QUOTE_SENT'].includes(request.status)) {
      throw new AppError(`Cannot decline a request with status ${request.status}`, 400);
    }
  } else if (status === 'EXPIRED') {
    if (!isOwnerClient) throw new ForbiddenError('Only the client can cancel a request');
    if (request.status !== 'PENDING') {
      throw new AppError('Can only cancel a request while it is still PENDING', 400);
    }
  } else {
    throw new AppError(`Invalid status transition. Allowed: DECLINED (vendor), EXPIRED (client)`, 400);
  }

  const updated = await prisma.eventRequest.update({
    where:   { id: req.params.id },
    data:    { status: status as any },
    include: REQUEST_INCLUDE_FULL,
  });

  res.json({ success: true, data: updated });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. getIncomingRequests
// GET /event-requests/incoming
// Auth: requireProvider
// Query: { status?, page?, limit? }
// ─────────────────────────────────────────────────────────────────────────────
export const getIncomingRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const page    = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit   = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip    = (page - 1) * limit;
  const status  = req.query.status as string | undefined;

  const VALID_STATUSES = ['PENDING', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'];
  const where: any = { providerProfileId: profile.id };
  if (status) {
    if (!VALID_STATUSES.includes(status.toUpperCase())) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    where.status = status.toUpperCase();
  }

  const [requests, total] = await prisma.$transaction([
    prisma.eventRequest.findMany({
      where,
      include: {
        package: {
          select: { id: true, name: true, category: true, basePrice: true, pricingModel: true },
        },
        client: {
          select: { id: true, firstName: true, lastName: true, city: true, avatarUrl: true },
        },
        quotes: {
          select: { id: true, status: true, total: true, version: true, booking: { select: { id: true, status: true } } },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take:  limit,
    }),
    prisma.eventRequest.count({ where }),
  ]);

  res.json({
    success: true,
    data:    requests.map(r => ({ ...r, booking: r.quotes?.[0]?.booking ?? null })),
    meta:    {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
