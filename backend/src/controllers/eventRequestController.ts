import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createEventRequestSchema, updateEventRequestSchema } from '../utils/validators.js';
import { asyncHandler, NotFoundError, ForbiddenError, AppError } from '../middleware/errorHandler.js';

// Create event request
export const createEventRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user!.id;
  const data = createEventRequestSchema.parse(req.body);
  
  // Validate event date is in the future
  const eventDate = new Date(data.eventDate);
  if (eventDate <= new Date()) {
    throw new AppError('Event date must be in the future', 400);
  }
  
  // Build create data
  const createData: any = {
    clientId,
    title: data.title,
    eventType: data.eventType,
    description: data.description,
    guestCount: data.guestCount,
    budgetMin: data.budgetMin,
    budgetMax: data.budgetMax,
    eventDate: data.eventDate,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime,
    venueName: data.venueName,
    venueAddress: data.venueAddress,
    venueCity: data.venueCity,
    venueState: data.venueState,
    venueZipCode: data.venueZipCode,
    venueNotes: data.venueNotes,
    dietaryRestrictions: data.dietaryRestrictions || [],
    allergies: data.allergies || [],
    serviceStyle: data.serviceStyle,
    needsStaffing: data.needsStaffing,
    staffCount: data.staffCount,
    needsCleanup: data.needsCleanup,
    needsSetup: data.needsSetup,
    servicesWanted: data.servicesWanted || [],
    status: 'DRAFT',
  };
  
  // Connect relations if provided
  if (data.cuisineTypeIds && data.cuisineTypeIds.length > 0) {
    createData.cuisineTypes = {
      connect: data.cuisineTypeIds.map(id => ({ id })),
    };
  }
  
  if (data.eventThemeIds && data.eventThemeIds.length > 0) {
    createData.eventThemes = {
      connect: data.eventThemeIds.map(id => ({ id })),
    };
  }
  
  if (data.equipmentIds && data.equipmentIds.length > 0) {
    createData.equipmentNeeded = {
      connect: data.equipmentIds.map(id => ({ id })),
    };
  }
  
  const eventRequest = await prisma.eventRequest.create({
    data: createData,
    include: {
      cuisineTypes: true,
      eventThemes: true,
      equipmentNeeded: true,
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
  
  res.status(201).json({
    success: true,
    data: eventRequest,
    message: 'Event request created successfully',
  });
});

// Get client's event requests
export const getMyEventRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user!.id;
  const { status, page = 1, limit = 10 } = req.query;
  
  const where: any = { clientId };
  
  if (status) {
    where.status = status;
  }
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const [requests, total] = await Promise.all([
    prisma.eventRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
      include: {
        cuisineTypes: true,
        eventThemes: true,
        _count: {
          select: { quotes: true },
        },
      },
    }),
    prisma.eventRequest.count({ where }),
  ]);
  
  res.json({
    success: true,
    data: requests,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Get single event request
export const getEventRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;
  
  const eventRequest = await prisma.eventRequest.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          avatarUrl: true,
        },
      },
      cuisineTypes: true,
      eventThemes: true,
      equipmentNeeded: true,
      quotes: {
        include: {
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
          items: true,
        },
      },
      booking: true,
    },
  });
  
  if (!eventRequest) {
    throw new NotFoundError('Event request');
  }
  
  // Check access: client can see their own, provider can see if they have a quote
  if (userRole === 'CLIENT' && eventRequest.clientId !== userId) {
    throw new ForbiddenError('Not authorized to view this event request');
  }
  
  if (userRole === 'PROVIDER') {
    const providerProfile = await prisma.providerProfile.findUnique({
      where: { userId },
    });
    
    const hasQuote = eventRequest.quotes.some(q => q.providerId === providerProfile?.id);
    
    if (!hasQuote && eventRequest.status !== 'SUBMITTED' && eventRequest.status !== 'MATCHING') {
      throw new ForbiddenError('Not authorized to view this event request');
    }
  }
  
  res.json({
    success: true,
    data: eventRequest,
  });
});

// Update event request
export const updateEventRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const clientId = req.user!.id;
  const data = updateEventRequestSchema.parse(req.body);
  
  const eventRequest = await prisma.eventRequest.findUnique({
    where: { id },
  });
  
  if (!eventRequest) {
    throw new NotFoundError('Event request');
  }
  
  if (eventRequest.clientId !== clientId) {
    throw new ForbiddenError('Not authorized to update this event request');
  }
  
  if (!['DRAFT', 'SUBMITTED'].includes(eventRequest.status)) {
    throw new AppError('Cannot update event request in current status', 400);
  }
  
  // Build update data
  const updateData: any = { ...data };
  
  // Handle relation updates
  if (data.cuisineTypeIds) {
    updateData.cuisineTypes = {
      set: data.cuisineTypeIds.map(id => ({ id })),
    };
    delete updateData.cuisineTypeIds;
  }
  
  if (data.eventThemeIds) {
    updateData.eventThemes = {
      set: data.eventThemeIds.map(id => ({ id })),
    };
    delete updateData.eventThemeIds;
  }
  
  if (data.equipmentIds) {
    updateData.equipmentNeeded = {
      set: data.equipmentIds.map(id => ({ id })),
    };
    delete updateData.equipmentIds;
  }
  
  const updatedRequest = await prisma.eventRequest.update({
    where: { id },
    data: updateData,
    include: {
      cuisineTypes: true,
      eventThemes: true,
      equipmentNeeded: true,
    },
  });
  
  res.json({
    success: true,
    data: updatedRequest,
    message: 'Event request updated successfully',
  });
});

// Submit event request (make it visible to providers)
export const submitEventRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const clientId = req.user!.id;
  
  const eventRequest = await prisma.eventRequest.findUnique({
    where: { id },
  });
  
  if (!eventRequest) {
    throw new NotFoundError('Event request');
  }
  
  if (eventRequest.clientId !== clientId) {
    throw new ForbiddenError('Not authorized to submit this event request');
  }
  
  if (eventRequest.status !== 'DRAFT') {
    throw new AppError('Event request has already been submitted', 400);
  }
  
  const updatedRequest = await prisma.eventRequest.update({
    where: { id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
    include: {
      cuisineTypes: true,
      eventThemes: true,
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  
  // TODO: Notify matching providers
  
  res.json({
    success: true,
    data: updatedRequest,
    message: 'Event request submitted successfully. Providers will be notified.',
  });
});

// Cancel event request
export const cancelEventRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const clientId = req.user!.id;
  
  const eventRequest = await prisma.eventRequest.findUnique({
    where: { id },
    include: { booking: true },
  });
  
  if (!eventRequest) {
    throw new NotFoundError('Event request');
  }
  
  if (eventRequest.clientId !== clientId) {
    throw new ForbiddenError('Not authorized to cancel this event request');
  }
  
  if (eventRequest.status === 'BOOKED' || eventRequest.status === 'COMPLETED') {
    throw new AppError('Cannot cancel event request in current status. Please cancel the booking instead.', 400);
  }
  
  await prisma.eventRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
  
  res.json({
    success: true,
    message: 'Event request cancelled successfully',
  });
});

// Get event requests for providers (matching)
export const getAvailableEventRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 10, eventType, minBudget, maxBudget, minGuests, maxGuests, city, state } = req.query;
  
  // Get provider profile
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    include: {
      cuisineTypes: true,
      eventThemes: true,
    },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  // Build filters
  const where: any = {
    status: { in: ['SUBMITTED', 'MATCHING'] },
    eventDate: { gt: new Date() },
  };

  // Only apply guest count filter if profile has meaningful limits set
  if (profile.minGuestCount > 0 || profile.maxGuestCount < 10000) {
    where.guestCount = {
      gte: profile.minGuestCount,
      lte: profile.maxGuestCount,
    };
  }
  
  // Filter by event type
  if (eventType) {
    where.eventType = eventType;
  }
  
  // Filter by budget
  if (minBudget) {
    where.budgetMax = { gte: Number(minBudget) };
  }
  if (maxBudget) {
    where.budgetMin = { lte: Number(maxBudget) };
  }
  
  // Filter by guest count
  if (minGuests) {
    where.guestCount = { ...where.guestCount, gte: Number(minGuests) };
  }
  if (maxGuests) {
    where.guestCount = { ...where.guestCount, lte: Number(maxGuests) };
  }
  
  // Filter by location
  if (city) {
    where.venueCity = { contains: city, mode: 'insensitive' };
  }
  if (state) {
    where.venueState = { contains: state, mode: 'insensitive' };
  }
  
  // Filter by service type wanted
  if (profile.providerTypes.length > 0) {
    where.OR = [
      { servicesWanted: { isEmpty: true } },
      { servicesWanted: { hasSome: profile.providerTypes } },
    ];
  }
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const [requests, total] = await Promise.all([
    prisma.eventRequest.findMany({
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
            city: true,
            state: true,
          },
        },
        cuisineTypes: true,
        eventThemes: true,
        _count: {
          select: { quotes: true },
        },
        quotes: {
          where: { providerId: profile.id },
          select: { id: true, status: true },
        },
      },
    }),
    prisma.eventRequest.count({ where }),
  ]);
  
  // Add flag for whether provider has already quoted
  const requestsWithQuoteStatus = requests.map(req => ({
    ...req,
    hasQuoted: req.quotes.length > 0,
    myQuoteStatus: req.quotes[0]?.status || null,
    quotes: undefined, // Remove quotes from response
  }));
  
  res.json({
    success: true,
    data: requestsWithQuoteStatus,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Delete event request (only drafts)
export const deleteEventRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const clientId = req.user!.id;
  
  const eventRequest = await prisma.eventRequest.findUnique({
    where: { id },
  });
  
  if (!eventRequest) {
    throw new NotFoundError('Event request');
  }
  
  if (eventRequest.clientId !== clientId) {
    throw new ForbiddenError('Not authorized to delete this event request');
  }
  
  if (eventRequest.status !== 'DRAFT') {
    throw new AppError('Can only delete draft event requests', 400);
  }
  
  await prisma.eventRequest.delete({ where: { id } });
  
  res.json({
    success: true,
    message: 'Event request deleted successfully',
  });
});
