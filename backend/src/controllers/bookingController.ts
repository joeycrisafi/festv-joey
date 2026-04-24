import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, NotFoundError, ForbiddenError, AppError } from '../middleware/errorHandler.js';

// Get client's bookings
export const getClientBookings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user!.id;
  const { status, page = 1, limit = 10 } = req.query;
  
  const where: any = { clientId };
  
  if (status) {
    where.status = status;
  }
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { eventDate: 'asc' },
      skip,
      take: Number(limit),
      include: {
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
          },
        },
        eventRequest: {
          select: {
            title: true,
            eventType: true,
            venueAddress: true,
            venueCity: true,
            venueState: true,
          },
        },
        review: {
          select: { id: true, overallRating: true },
        },
      },
    }),
    prisma.booking.count({ where }),
  ]);
  
  res.json({
    success: true,
    data: bookings,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Get provider's bookings
export const getProviderBookings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
  
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { eventDate: 'asc' },
      skip,
      take: Number(limit),
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            phoneNumber: true,
            email: true,
          },
        },
        eventRequest: {
          include: {
            cuisineTypes: true,
            eventThemes: true,
          },
        },
        quote: {
          include: { items: true },
        },
        review: {
          select: { id: true, overallRating: true },
        },
      },
    }),
    prisma.booking.count({ where }),
  ]);
  
  res.json({
    success: true,
    data: bookings,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Get single booking
export const getBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { id } = req.params;
  
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          phoneNumber: true,
          email: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
        },
      },
      provider: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              phoneNumber: true,
              email: true,
            },
          },
        },
      },
      eventRequest: {
        include: {
          cuisineTypes: true,
          eventThemes: true,
          equipmentNeeded: true,
        },
      },
      quote: {
        include: { items: true },
      },
      payments: true,
      review: true,
    },
  });
  
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  
  // Check access
  if (userRole === 'CLIENT' && booking.clientId !== userId) {
    throw new ForbiddenError('Not authorized to view this booking');
  }
  
  if (userRole === 'PROVIDER') {
    const profile = await prisma.providerProfile.findFirst({
      where: { userId },
    });
    if (booking.providerId !== profile?.id) {
      throw new ForbiddenError('Not authorized to view this booking');
    }
  }
  
  res.json({
    success: true,
    data: booking,
  });
});

// Process deposit payment (simulated)
export const payDeposit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { paymentMethodId, cardLast4, cardBrand } = req.body;
  
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      provider: true,
      eventRequest: true,
    },
  });
  
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  
  if (booking.clientId !== userId) {
    throw new ForbiddenError('Not authorized to make payment for this booking');
  }
  
  if (booking.status !== 'PENDING_DEPOSIT') {
    throw new AppError('Deposit has already been paid or booking is in invalid state', 400);
  }
  
  // In production, integrate with Stripe here
  // For now, simulate successful payment
  
  const result = await prisma.$transaction(async (tx) => {
    // Create payment record
    const payment = await tx.payment.create({
      data: {
        bookingId: id,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        amount: booking.depositAmount,
        stripePaymentId: `sim_${Date.now()}`,
        cardLast4,
        cardBrand,
        completedAt: new Date(),
      },
    });
    
    // Update booking status
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        status: 'DEPOSIT_PAID',
        depositPaidAt: new Date(),
      },
    });
    
    return { booking: updatedBooking, payment };
  });
  
  // Notify provider
  await prisma.notification.create({
    data: {
      userId: booking.provider.userId,
      type: 'PAYMENT_RECEIVED',
      title: 'Deposit Received',
      message: `Deposit of $${booking.depositAmount.toFixed(2)} received for "${booking.eventRequest.title}"`,
      data: { bookingId: id, paymentId: result.payment.id },
    },
  });
  
  res.json({
    success: true,
    data: result,
    message: 'Deposit paid successfully',
  });
});

// Pay remaining balance
export const payBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { cardLast4, cardBrand } = req.body;
  
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      provider: true,
      eventRequest: true,
    },
  });
  
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  
  if (booking.clientId !== userId) {
    throw new ForbiddenError('Not authorized to make payment for this booking');
  }
  
  if (!['DEPOSIT_PAID', 'CONFIRMED'].includes(booking.status)) {
    throw new AppError('Cannot pay balance in current booking state', 400);
  }
  
  const result = await prisma.$transaction(async (tx) => {
    // Create payment record
    const payment = await tx.payment.create({
      data: {
        bookingId: id,
        type: 'BALANCE',
        status: 'COMPLETED',
        amount: booking.balanceAmount,
        stripePaymentId: `sim_${Date.now()}`,
        cardLast4,
        cardBrand,
        completedAt: new Date(),
      },
    });
    
    // Update booking status
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        balancePaidAt: new Date(),
      },
    });
    
    return { booking: updatedBooking, payment };
  });
  
  // Notify provider
  await prisma.notification.create({
    data: {
      userId: booking.provider.userId,
      type: 'PAYMENT_RECEIVED',
      title: 'Full Payment Received',
      message: `Final payment of $${booking.balanceAmount.toFixed(2)} received for "${booking.eventRequest.title}"`,
      data: { bookingId: id },
    },
  });
  
  res.json({
    success: true,
    data: result,
    message: 'Balance paid successfully',
  });
});

// Provider confirms booking
export const confirmBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { eventRequest: true },
  });
  
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  
  if (booking.providerId !== profile.id) {
    throw new ForbiddenError('Not authorized to confirm this booking');
  }
  
  if (booking.status !== 'DEPOSIT_PAID') {
    throw new AppError('Cannot confirm booking in current state', 400);
  }
  
  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: 'CONFIRMED' },
  });
  
  // Notify client
  await prisma.notification.create({
    data: {
      userId: booking.clientId,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking Confirmed!',
      message: `Your booking for "${booking.eventRequest.title}" has been confirmed by the provider.`,
      data: { bookingId: id },
    },
  });
  
  res.json({
    success: true,
    data: updatedBooking,
    message: 'Booking confirmed successfully',
  });
});

// Mark booking as in progress
export const startBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const booking = await prisma.booking.findUnique({
    where: { id },
  });
  
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  
  if (booking.providerId !== profile.id) {
    throw new ForbiddenError('Not authorized to update this booking');
  }
  
  if (booking.status !== 'CONFIRMED') {
    throw new AppError('Cannot start booking in current state', 400);
  }
  
  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
  });
  
  res.json({
    success: true,
    data: updatedBooking,
    message: 'Booking marked as in progress',
  });
});

// Complete booking
export const completeBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { eventRequest: true },
  });
  
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  
  if (booking.providerId !== profile.id) {
    throw new ForbiddenError('Not authorized to complete this booking');
  }
  
  if (booking.status !== 'IN_PROGRESS') {
    throw new AppError('Cannot complete booking in current state', 400);
  }
  
  const result = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    
    // Update event request
    await tx.eventRequest.update({
      where: { id: booking.eventRequestId },
      data: { status: 'COMPLETED' },
    });
    
    // Update provider stats
    await tx.providerProfile.update({
      where: { id: profile.id },
      data: {
        completedBookings: { increment: 1 },
      },
    });
    
    return updatedBooking;
  });
  
  // Notify client to leave review
  await prisma.notification.create({
    data: {
      userId: booking.clientId,
      type: 'BOOKING_CONFIRMED',
      title: 'Event Completed!',
      message: `Your event "${booking.eventRequest.title}" is complete. Please leave a review for the provider!`,
      data: { bookingId: id },
    },
  });
  
  res.json({
    success: true,
    data: result,
    message: 'Booking completed successfully',
  });
});

// Cancel booking
export const cancelBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { id } = req.params;
  const { reason } = req.body;
  
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      provider: true,
      eventRequest: true,
      payments: true,
    },
  });
  
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  
  // Check authorization
  let cancelledBy = '';
  if (userRole === 'CLIENT') {
    if (booking.clientId !== userId) {
      throw new ForbiddenError('Not authorized to cancel this booking');
    }
    cancelledBy = 'CLIENT';
  } else if (userRole === 'PROVIDER') {
    if (booking.provider.userId !== userId) {
      throw new ForbiddenError('Not authorized to cancel this booking');
    }
    cancelledBy = 'PROVIDER';
  }
  
  if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(booking.status)) {
    throw new AppError('Cannot cancel booking in current state', 400);
  }
  
  // Calculate refund (simplified logic - in production would be more complex)
  let refundAmount = 0;
  const totalPaid = booking.payments
    .filter(p => p.status === 'COMPLETED' && p.type !== 'REFUND')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const daysUntilEvent = Math.ceil((booking.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  if (cancelledBy === 'PROVIDER') {
    // Full refund if provider cancels
    refundAmount = totalPaid;
  } else if (daysUntilEvent > 14) {
    // Full refund if more than 14 days out
    refundAmount = totalPaid;
  } else if (daysUntilEvent > 7) {
    // 50% refund if 7-14 days out
    refundAmount = totalPaid * 0.5;
  } else {
    // No refund if less than 7 days out
    refundAmount = 0;
  }
  
  const result = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        status: refundAmount > 0 ? 'REFUNDED' : 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason,
        refundAmount,
      },
    });
    
    // Create refund payment record if applicable
    if (refundAmount > 0) {
      await tx.payment.create({
        data: {
          bookingId: id,
          type: 'REFUND',
          status: 'COMPLETED',
          amount: -refundAmount,
          stripePaymentId: `refund_${Date.now()}`,
          completedAt: new Date(),
        },
      });
    }
    
    // Update event request
    await tx.eventRequest.update({
      where: { id: booking.eventRequestId },
      data: { status: 'CANCELLED' },
    });
    
    // Update provider stats
    await tx.providerProfile.update({
      where: { id: booking.providerId },
      data: {
        totalBookings: { decrement: 1 },
      },
    });
    
    return updatedBooking;
  });
  
  // Notify the other party
  const notifyUserId = cancelledBy === 'CLIENT' ? booking.provider.userId : booking.clientId;
  await prisma.notification.create({
    data: {
      userId: notifyUserId,
      type: 'BOOKING_CANCELLED',
      title: 'Booking Cancelled',
      message: `Booking for "${booking.eventRequest.title}" has been cancelled${reason ? ': ' + reason : ''}`,
      data: { bookingId: id, refundAmount },
    },
  });
  
  res.json({
    success: true,
    data: result,
    message: refundAmount > 0 
      ? `Booking cancelled. Refund of $${refundAmount.toFixed(2)} will be processed.`
      : 'Booking cancelled.',
  });
});

// Get upcoming bookings (for dashboard)
export const getUpcomingBookings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  
  let where: any = {
    eventDate: { gte: new Date() },
    status: { in: ['DEPOSIT_PAID', 'CONFIRMED', 'IN_PROGRESS'] },
  };
  
  if (userRole === 'CLIENT') {
    where.clientId = userId;
  } else if (userRole === 'PROVIDER') {
    const profile = await prisma.providerProfile.findFirst({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundError('Provider profile');
    }
    where.providerId = profile.id;
  }
  
  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { eventDate: 'asc' },
    take: 5,
    include: {
      client: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
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
      eventRequest: {
        select: {
          title: true,
          eventType: true,
          venueCity: true,
          venueState: true,
        },
      },
    },
  });
  
  res.json({
    success: true,
    data: bookings,
  });
});
