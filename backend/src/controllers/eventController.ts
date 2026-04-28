/**
 * Event Controller
 *
 * Manages the top-level Event planning object — a named event (e.g. "Sarah &
 * John's Wedding") that groups multiple vendor EventRequests together.
 *
 * Routes:
 *   POST   /events          createEvent
 *   GET    /events/me       getMyEvents
 *   GET    /events/:id      getEventById
 *   PUT    /events/:id      updateEvent
 */

import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

// ─── Include shape for request children ──────────────────────────────────────

const REQUEST_INCLUDE = {
  package: {
    select: { id: true, name: true, category: true, pricingModel: true, basePrice: true },
  },
  providerProfile: {
    select: { id: true, businessName: true, primaryType: true, logoUrl: true },
  },
  quotes: {
    select: { id: true, status: true, total: true, version: true, createdAt: true },
    orderBy: { version: 'desc' as const },
    take: 1, // latest quote only in list views
  },
} as const;

// ─── 1. createEvent ───────────────────────────────────────────────────────────
// POST /events
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const createEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, eventType, eventDate, guestCount, notes } = req.body;

  if (!name)      throw new AppError('name is required', 400);
  if (!eventType) throw new AppError('eventType is required', 400);
  if (!eventDate) throw new AppError('eventDate is required', 400);
  if (guestCount == null) throw new AppError('guestCount is required', 400);

  const parsedDate = new Date(eventDate);
  if (isNaN(parsedDate.getTime())) throw new AppError('Invalid eventDate', 400);

  const event = await prisma.event.create({
    data: {
      clientId:   req.user!.id,
      name:       String(name),
      eventType,
      eventDate:  parsedDate,
      guestCount: parseInt(guestCount),
      notes:      notes ? String(notes) : undefined,
    },
    include: {
      _count: { select: { requests: true } },
    },
  });

  res.status(201).json({ success: true, data: event });
});

// ─── 2. getMyEvents ───────────────────────────────────────────────────────────
// GET /events/me
// Auth: requireClient
// ─────────────────────────────────────────────────────────────────────────────
export const getMyEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const events = await prisma.event.findMany({
    where: { clientId: req.user!.id },
    include: {
      requests: {
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' as const },
      },
      _count: { select: { requests: true } },
    },
    orderBy: { eventDate: 'asc' },
  });

  res.json({ success: true, data: events });
});

// ─── 3. getEventById ──────────────────────────────────────────────────────────
// GET /events/:id
// Auth: requireClient (ownership verified)
// ─────────────────────────────────────────────────────────────────────────────
export const getEventById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      requests: {
        include: {
          package: {
            select: { id: true, name: true, category: true, pricingModel: true, basePrice: true },
          },
          providerProfile: {
            select: { id: true, businessName: true, primaryType: true, logoUrl: true, averageRating: true },
          },
          quotes: {
            select: {
              id: true,
              status: true,
              total: true,
              depositAmount: true,
              version: true,
              expiresAt: true,
              createdAt: true,
            },
            orderBy: { version: 'desc' as const },
          },
        },
        orderBy: { createdAt: 'desc' as const },
      },
      _count: { select: { requests: true } },
    },
  });

  if (!event) throw new NotFoundError('Event');
  if (event.clientId !== req.user!.id) throw new ForbiddenError('You do not own this event');

  res.json({ success: true, data: event });
});

// ─── 4. updateEvent ───────────────────────────────────────────────────────────
// PUT /events/:id
// Auth: requireClient (ownership verified)
// Updatable: name, notes, guestCount, status
// ─────────────────────────────────────────────────────────────────────────────
export const updateEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Event');
  if (existing.clientId !== req.user!.id) throw new ForbiddenError('You do not own this event');

  const { name, notes, guestCount, status } = req.body;

  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...(name       != null && { name:       String(name) }),
      ...(notes      != null && { notes:      String(notes) }),
      ...(guestCount != null && { guestCount: parseInt(guestCount) }),
      ...(status     != null && { status }),
    },
    include: {
      _count: { select: { requests: true } },
    },
  });

  res.json({ success: true, data: updated });
});
