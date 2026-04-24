import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createQuoteSchema } from '../utils/validators.js';
import { asyncHandler, NotFoundError, ForbiddenError, AppError, ConflictError } from '../middleware/errorHandler.js';

// Create a quote for an event request
export const createQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const data = createQuoteSchema.parse(req.body);
  
  // Get provider profile
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  // Check event request exists and is open for quotes
  const eventRequest = await prisma.eventRequest.findUnique({
    where: { id: data.eventRequestId },
  });
  
  if (!eventRequest) {
    throw new NotFoundError('Event request');
  }
  
  if (!['SUBMITTED', 'MATCHING', 'QUOTED'].includes(eventRequest.status)) {
    throw new AppError('This event request is not accepting quotes', 400);
  }
  
  // Check if provider already quoted
  const existingQuote = await prisma.quote.findUnique({
    where: {
      eventRequestId_providerId: {
        eventRequestId: data.eventRequestId,
        providerId: profile.id,
      },
    },
  });
  
  if (existingQuote) {
    throw new ConflictError('You have already submitted a quote for this event');
  }
  
  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = subtotal * ((data.taxRate || 0) / 100);
  const totalAmount = subtotal + taxAmount + (data.serviceFee || 0) + (data.gratuity || 0) - (data.discount || 0);
  const depositRequired = totalAmount * (profile.depositPercentage / 100);
  
  // Calculate valid until date
  const validDays = data.validDays || 14;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validDays);
  
  // Create quote with items
  const quote = await prisma.quote.create({
    data: {
      eventRequestId: data.eventRequestId,
      providerId: profile.id,
      message: data.message,
      subtotal,
      taxRate: data.taxRate || 0,
      taxAmount,
      serviceFee: data.serviceFee || 0,
      gratuity: data.gratuity || 0,
      discount: data.discount || 0,
      totalAmount,
      depositRequired,
      validUntil,
      status: 'DRAFT',
      items: {
        create: data.items.map(item => ({
          serviceId: item.serviceId,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        })),
      },
    },
    include: {
      items: true,
      provider: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
  
  res.status(201).json({
    success: true,
    data: quote,
    message: 'Quote created successfully',
  });
});

// Send quote to client
export const sendQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      provider: true,
      eventRequest: {
        include: {
          client: true,
        },
      },
    },
  });
  
  if (!quote) {
    throw new NotFoundError('Quote');
  }
  
  if (quote.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to send this quote');
  }
  
  if (quote.status !== 'DRAFT') {
    throw new AppError('Quote has already been sent', 400);
  }
  
  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
    },
    include: {
      items: true,
      provider: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
  
  // Update event request status if first quote
  await prisma.eventRequest.update({
    where: { id: quote.eventRequestId },
    data: { status: 'QUOTED' },
  });
  
  const vendorDisplayName = quote.provider.businessName
    || [quote.provider.user?.firstName, quote.provider.user?.lastName].filter(Boolean).join(' ')
    || 'A vendor';
  const isCounter = !!(req.body && req.body.isCounter);
  await prisma.notification.create({
    data: {
      userId: quote.eventRequest.clientId,
      type: 'NEW_QUOTE',
      title: isCounter
        ? `${vendorDisplayName} Sent a Counter Proposal`
        : `Quote Received from ${vendorDisplayName}`,
      message: isCounter
        ? `${vendorDisplayName} has proposed revised terms for "${quote.eventRequest.title}". Review and accept or decline.`
        : `${vendorDisplayName} has sent you a quote for "${quote.eventRequest.title}". Review the details and accept to confirm your booking.`,
      data: { quoteId: quote.id, eventRequestId: quote.eventRequestId, isCounter },
    },
  });
  
  res.json({
    success: true,
    data: updatedQuote,
    message: 'Quote sent to client successfully',
  });
});

// Get provider's quotes
export const getMyQuotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { status, page = 1, limit = 10 } = req.query;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const where: any = { providerId: profile.id };
  
  if (status) {
    where.status = status;
  }
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
      include: {
        eventRequest: {
          include: {
            client: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        items: true,
      },
    }),
    prisma.quote.count({ where }),
  ]);
  
  res.json({
    success: true,
    data: quotes,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Get single quote
export const getQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { id } = req.params;
  
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: true,
      provider: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
              phoneNumber: true,
              email: true,
            },
          },
          portfolioItems: {
            where: { isPublic: true, isFeatured: true },
            take: 5,
          },
        },
      },
      eventRequest: {
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
  
  if (!quote) {
    throw new NotFoundError('Quote');
  }
  
  // Check access
  if (userRole === 'CLIENT' && quote.eventRequest.client.id !== userId) {
    throw new ForbiddenError('Not authorized to view this quote');
  }
  
  if (userRole === 'PROVIDER' && quote.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to view this quote');
  }
  
  // Mark as viewed if client is viewing
  if (userRole === 'CLIENT' && !quote.viewedAt) {
    await prisma.quote.update({
      where: { id },
      data: { viewedAt: new Date() },
    });
  }
  
  res.json({
    success: true,
    data: quote,
  });
});

// Client accepts quote
export const acceptQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      eventRequest: true,
      provider: {
        include: {
          user: { select: { city: true, state: true } },
        },
      },
    },
  });
  
  if (!quote) {
    throw new NotFoundError('Quote');
  }
  
  if (quote.eventRequest.clientId !== userId) {
    throw new ForbiddenError('Not authorized to accept this quote');
  }
  
  if (quote.status !== 'SENT' && quote.status !== 'VIEWED') {
    throw new AppError('This quote cannot be accepted', 400);
  }
  
  if (quote.validUntil < new Date()) {
    throw new AppError('This quote has expired', 400);
  }
  
  // Check if event already has a booking
  const existingBooking = await prisma.booking.findUnique({
    where: { eventRequestId: quote.eventRequestId },
  });
  
  if (existingBooking) {
    throw new AppError('This event already has a confirmed booking', 400);
  }
  
  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update quote status
    const updatedQuote = await tx.quote.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    });
    
    // Create booking
    const booking = await tx.booking.create({
      data: {
        eventRequestId: quote.eventRequestId,
        quoteId: quote.id,
        clientId: userId,
        providerId: quote.providerId,
        totalAmount: quote.totalAmount,
        depositAmount: quote.depositRequired,
        balanceAmount: quote.totalAmount - quote.depositRequired,
        eventDate: quote.eventRequest.eventDate,
        eventStartTime: quote.eventRequest.eventStartTime,
        eventEndTime: quote.eventRequest.eventEndTime,
        guestCount: quote.eventRequest.guestCount,
        status: 'PENDING_DEPOSIT',
      },
    });
    
    // Update event request status
    // If this is a venue/restaurant booking, auto-fill venue address on the event
    const isVenueProvider = quote.provider.primaryType === 'RESTO_VENUE' ||
      (quote.provider.providerTypes && quote.provider.providerTypes.includes('RESTO_VENUE' as any));

    const venueUpdate: Record<string, any> = { status: 'BOOKED' };
    if (isVenueProvider && !quote.eventRequest.venueProviderId) {
      // Pull city/state from provider's user profile; use serviceAreas as fallback
      const city = (quote.provider as any).user?.city
        || (quote.provider.serviceAreas && quote.provider.serviceAreas[0]?.split(',')[0].trim())
        || undefined;
      const state = (quote.provider as any).user?.state
        || (quote.provider.serviceAreas && quote.provider.serviceAreas[0]?.split(',')[1]?.trim())
        || undefined;

      venueUpdate.venueName        = quote.eventRequest.venueName || quote.provider.businessName;
      if (city)  venueUpdate.venueCity  = city;
      if (state) venueUpdate.venueState = state;
      venueUpdate.venueProviderId  = quote.providerId;
    }

    await tx.eventRequest.update({
      where: { id: quote.eventRequestId },
      data: venueUpdate,
    });
    
    // Reject other quotes
    await tx.quote.updateMany({
      where: {
        eventRequestId: quote.eventRequestId,
        id: { not: quote.id },
        status: { in: ['SENT', 'VIEWED'] },
      },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    });
    
    // Update provider stats
    await tx.providerProfile.update({
      where: { id: quote.providerId },
      data: {
        totalBookings: { increment: 1 },
      },
    });
    
    return { quote: updatedQuote, booking };
  });
  
  // Create notification for provider
  await prisma.notification.create({
    data: {
      userId: quote.provider.userId,
      type: 'QUOTE_ACCEPTED',
      title: 'Quote Accepted!',
      message: `Your quote for "${quote.eventRequest.title}" has been accepted!`,
      data: { quoteId: quote.id, bookingId: result.booking.id },
    },
  });
  
  res.json({
    success: true,
    data: result,
    message: 'Quote accepted! A booking has been created.',
  });
});

// Client rejects quote
export const rejectQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { reason } = req.body;
  
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      eventRequest: true,
      provider: true,
    },
  });
  
  if (!quote) {
    throw new NotFoundError('Quote');
  }
  
  if (quote.eventRequest.clientId !== userId) {
    throw new ForbiddenError('Not authorized to reject this quote');
  }
  
  if (quote.status !== 'SENT' && quote.status !== 'VIEWED') {
    throw new AppError('This quote cannot be rejected', 400);
  }
  
  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: 'REJECTED',
      respondedAt: new Date(),
    },
  });
  
  // Notify provider
  await prisma.notification.create({
    data: {
      userId: quote.provider.userId,
      type: 'QUOTE_REJECTED',
      title: 'Quote Not Selected',
      message: `Your quote for "${quote.eventRequest.title}" was not selected${reason ? ': ' + reason : ''}`,
      data: { quoteId: quote.id },
    },
  });
  
  res.json({
    success: true,
    data: updatedQuote,
    message: 'Quote rejected',
  });
});

// Provider withdraws quote
export const withdrawQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      provider: true,
      eventRequest: true,
    },
  });
  
  if (!quote) {
    throw new NotFoundError('Quote');
  }
  
  if (quote.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to withdraw this quote');
  }
  
  if (!['DRAFT', 'SENT', 'VIEWED'].includes(quote.status)) {
    throw new AppError('This quote cannot be withdrawn', 400);
  }
  
  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: { status: 'WITHDRAWN' },
  });
  
  res.json({
    success: true,
    data: updatedQuote,
    message: 'Quote withdrawn successfully',
  });
});

// Update quote (only drafts)
export const updateQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const data = createQuoteSchema.partial().parse(req.body);
  
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { provider: true },
  });
  
  if (!quote) {
    throw new NotFoundError('Quote');
  }
  
  if (quote.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to update this quote');
  }
  
  if (quote.status !== 'DRAFT') {
    throw new AppError('Can only update draft quotes', 400);
  }
  
  // Update items if provided
  if (data.items) {
    // Delete existing items
    await prisma.quoteItem.deleteMany({
      where: { quoteId: id },
    });
    
    // Calculate new totals
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = subtotal * ((data.taxRate || quote.taxRate) / 100);
    const totalAmount = subtotal + taxAmount + (data.serviceFee || quote.serviceFee) + (data.gratuity || quote.gratuity) - (data.discount || quote.discount);
    const depositRequired = totalAmount * (quote.provider.depositPercentage / 100);
    
    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: {
        message: data.message,
        subtotal,
        taxRate: data.taxRate || quote.taxRate,
        taxAmount,
        serviceFee: data.serviceFee ?? quote.serviceFee,
        gratuity: data.gratuity ?? quote.gratuity,
        discount: data.discount ?? quote.discount,
        totalAmount,
        depositRequired,
        items: {
          create: data.items.map(item => ({
            serviceId: item.serviceId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        items: true,
      },
    });
    
    return res.json({
      success: true,
      data: updatedQuote,
      message: 'Quote updated successfully',
    });
  }
  
  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: { message: data.message },
    include: { items: true },
  });
  
  res.json({
    success: true,
    data: updatedQuote,
    message: 'Quote updated successfully',
  });
});

// Get quotes for an event request (client view)
export const getQuotesForEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { eventRequestId } = req.params;
  
  const eventRequest = await prisma.eventRequest.findUnique({
    where: { id: eventRequestId },
  });
  
  if (!eventRequest) {
    throw new NotFoundError('Event request');
  }
  
  if (eventRequest.clientId !== userId) {
    throw new ForbiddenError('Not authorized to view quotes for this event');
  }
  
  const quotes = await prisma.quote.findMany({
    where: {
      eventRequestId,
      status: { in: ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED'] },
    },
    orderBy: { totalAmount: 'asc' },
    include: {
      items: true,
      provider: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          portfolioItems: {
            where: { isPublic: true, isFeatured: true },
            take: 3,
          },
        },
      },
    },
  });
  
  res.json({
    success: true,
    data: quotes,
  });
});
