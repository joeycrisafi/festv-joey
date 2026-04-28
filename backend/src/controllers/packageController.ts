/**
 * Package Controller
 *
 * Handles all Package, SeasonalPricingRule, DayOfWeekPricingRule, AddOn,
 * AvailabilityBlock CRUD and the public pricing estimate endpoint.
 *
 * Ownership pattern: every mutating operation resolves the caller's
 * ProviderProfile via req.user.id and then confirms the target record's
 * providerProfileId matches before touching the database.
 */

import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler, AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { calculatePackagePrice } from '../services/pricingEngine.js';
import { DayOfWeek, PricingModel, AddOnPricingType } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the caller's ProviderProfile from their user id.
 * Throws 404 if no profile exists yet.
 * When a vendor has multiple profiles (multi-type), the optional `profileId`
 * query param can pin to a specific one.
 */
async function getProviderProfile(userId: string, profileId?: string) {
  const where: any = { userId };
  if (profileId) where.id = profileId;

  const profile = await prisma.providerProfile.findFirst({ where });
  if (!profile) throw new AppError('Provider profile not found. Complete your vendor setup first.', 404);
  return profile;
}

/**
 * Confirm a Package belongs to the given providerProfileId.
 * Throws 404 (not found) or 403 (wrong owner) as appropriate.
 */
async function requirePackageOwnership(packageId: string, providerProfileId: string) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) throw new NotFoundError('Package');
  if (pkg.providerProfileId !== providerProfileId) throw new ForbiddenError('You do not own this package');
  return pkg;
}

/**
 * Confirm an AddOn belongs to the given providerProfileId.
 */
async function requireAddOnOwnership(addOnId: string, providerProfileId: string) {
  const addOn = await prisma.addOn.findUnique({ where: { id: addOnId } });
  if (!addOn) throw new NotFoundError('Add-on');
  if (addOn.providerProfileId !== providerProfileId) throw new ForbiddenError('You do not own this add-on');
  return addOn;
}

/**
 * Confirm an AvailabilityBlock belongs to the given providerProfileId.
 */
async function requireBlockOwnership(blockId: string, providerProfileId: string) {
  const block = await prisma.availabilityBlock.findUnique({ where: { id: blockId } });
  if (!block) throw new NotFoundError('Availability block');
  if (block.providerProfileId !== providerProfileId) throw new ForbiddenError('You do not own this block');
  return block;
}

// ─────────────────────────────────────────────────────────────────────────────
// Package CRUD
// ─────────────────────────────────────────────────────────────────────────────

/** POST /packages */
export const createPackage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const {
    name, description, category, eventTypes = [],
    pricingModel, basePrice, flatFee, minimumSpend,
    minGuests, maxGuests, durationHours,
    weekdayPrice, weekendPrice, included = [], sortOrder,
  } = req.body;

  // Required field validation
  if (!name)         throw new AppError('name is required', 400);
  if (!category)     throw new AppError('category is required', 400);
  if (!pricingModel) throw new AppError('pricingModel is required', 400);
  if (basePrice == null) throw new AppError('basePrice is required', 400);
  if (!Object.values(PricingModel).includes(pricingModel)) {
    throw new AppError(`pricingModel must be one of: ${Object.values(PricingModel).join(', ')}`, 400);
  }

  const pkg = await prisma.package.create({
    data: {
      providerProfileId: profile.id,
      name:              String(name),
      description:       description ? String(description) : undefined,
      category:          String(category),
      eventTypes:        Array.isArray(eventTypes) ? eventTypes : [],
      pricingModel:      pricingModel as PricingModel,
      basePrice:         parseFloat(basePrice),
      flatFee:           flatFee != null ? parseFloat(flatFee) : undefined,
      minimumSpend:      minimumSpend != null ? parseFloat(minimumSpend) : undefined,
      minGuests:         minGuests != null ? parseInt(minGuests) : undefined,
      maxGuests:         maxGuests != null ? parseInt(maxGuests) : undefined,
      durationHours:     durationHours != null ? parseFloat(durationHours) : undefined,
      weekdayPrice:      weekdayPrice != null ? parseFloat(weekdayPrice) : undefined,
      weekendPrice:      weekendPrice != null ? parseFloat(weekendPrice) : undefined,
      included:          Array.isArray(included) ? included : [],
      sortOrder:         sortOrder != null ? parseInt(sortOrder) : 0,
    },
    include: {
      seasonalRules:  true,
      dayOfWeekRules: true,
      addOns:         true,
    },
  });

  res.status(201).json({ success: true, data: pkg });
});

/** GET /packages/me */
export const getMyPackages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const packages = await prisma.package.findMany({
    where:   { providerProfileId: profile.id },
    include: {
      seasonalRules:  true,
      dayOfWeekRules: true,
      addOns:         true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ success: true, data: packages });
});

/** GET /packages/:id  (public) */
export const getPackageById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pkg = await prisma.package.findUnique({
    where:   { id: req.params.id },
    include: {
      seasonalRules:  true,
      dayOfWeekRules: true,
      addOns:         { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      providerProfile: {
        select: {
          id: true, businessName: true, primaryType: true, providerTypes: true,
          averageRating: true, totalReviews: true, verificationStatus: true,
          minGuestCount: true, maxGuestCount: true,
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!pkg) throw new NotFoundError('Package');
  res.json({ success: true, data: pkg });
});

/** PUT /packages/:id */
export const updatePackage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  const {
    name, description, category, eventTypes,
    pricingModel, basePrice, flatFee, minimumSpend,
    minGuests, maxGuests, durationHours,
    weekdayPrice, weekendPrice, included, sortOrder, isActive,
  } = req.body;

  if (pricingModel && !Object.values(PricingModel).includes(pricingModel)) {
    throw new AppError(`pricingModel must be one of: ${Object.values(PricingModel).join(', ')}`, 400);
  }

  const data: any = {};
  if (name        != null) data.name         = String(name);
  if (description != null) data.description  = String(description);
  if (category    != null) data.category     = String(category);
  if (eventTypes  != null) data.eventTypes   = Array.isArray(eventTypes) ? eventTypes : [];
  if (pricingModel!= null) data.pricingModel = pricingModel as PricingModel;
  if (basePrice   != null) data.basePrice    = parseFloat(basePrice);
  if (flatFee     != null) data.flatFee      = parseFloat(flatFee);
  if (minimumSpend!= null) data.minimumSpend = parseFloat(minimumSpend);
  if (minGuests   != null) data.minGuests    = parseInt(minGuests);
  if (maxGuests   != null) data.maxGuests    = parseInt(maxGuests);
  if (durationHours  != null) data.durationHours  = parseFloat(durationHours);
  if (weekdayPrice   != null) data.weekdayPrice   = parseFloat(weekdayPrice);
  if (weekendPrice   != null) data.weekendPrice   = parseFloat(weekendPrice);
  if (included    != null) data.included     = Array.isArray(included) ? included : [];
  if (sortOrder   != null) data.sortOrder    = parseInt(sortOrder);
  if (isActive    != null) data.isActive     = Boolean(isActive);

  const pkg = await prisma.package.update({
    where:   { id: req.params.id },
    data,
    include: {
      seasonalRules:  true,
      dayOfWeekRules: true,
      addOns:         true,
    },
  });

  res.json({ success: true, data: pkg });
});

/** DELETE /packages/:id */
export const deletePackage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  await prisma.package.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Package deleted' });
});

/** PATCH /packages/:id/toggle */
export const togglePackageActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const existing = await requirePackageOwnership(req.params.id, profile.id);

  const pkg = await prisma.package.update({
    where: { id: req.params.id },
    data:  { isActive: !existing.isActive },
    include: {
      seasonalRules:  true,
      dayOfWeekRules: true,
      addOns:         true,
    },
  });

  res.json({ success: true, data: pkg });
});

/** PATCH /packages/reorder  — body: { packageIds: string[] } */
export const reorderPackages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  const { packageIds } = req.body;

  if (!Array.isArray(packageIds) || packageIds.length === 0) {
    throw new AppError('packageIds must be a non-empty array', 400);
  }

  // Verify all packages belong to this vendor
  const existing = await prisma.package.findMany({
    where: { id: { in: packageIds }, providerProfileId: profile.id },
    select: { id: true },
  });
  if (existing.length !== packageIds.length) {
    throw new ForbiddenError('One or more packages not found or not owned by you');
  }

  await prisma.$transaction(
    packageIds.map((id: string, index: number) =>
      prisma.package.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Seasonal Pricing Rules
// ─────────────────────────────────────────────────────────────────────────────

/** POST /packages/:id/seasonal-rules */
export const addSeasonalRule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  const { name, startMonth, startDay, endMonth, endDay, priceOverride, minimumSpendOverride, multiplier } = req.body;

  if (!name)       throw new AppError('name is required', 400);
  if (!startMonth) throw new AppError('startMonth is required', 400);
  if (!startDay)   throw new AppError('startDay is required', 400);
  if (!endMonth)   throw new AppError('endMonth is required', 400);
  if (!endDay)     throw new AppError('endDay is required', 400);

  const rule = await prisma.seasonalPricingRule.create({
    data: {
      packageId:            req.params.id,
      name:                 String(name),
      startMonth:           parseInt(startMonth),
      startDay:             parseInt(startDay),
      endMonth:             parseInt(endMonth),
      endDay:               parseInt(endDay),
      priceOverride:        priceOverride        != null ? parseFloat(priceOverride)        : undefined,
      minimumSpendOverride: minimumSpendOverride != null ? parseFloat(minimumSpendOverride) : undefined,
      multiplier:           multiplier           != null ? parseFloat(multiplier)           : undefined,
    },
  });

  res.status(201).json({ success: true, data: rule });
});

/** PUT /packages/:id/seasonal-rules/:ruleId */
export const updateSeasonalRule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  // Confirm rule belongs to this package
  const existing = await prisma.seasonalPricingRule.findUnique({ where: { id: req.params.ruleId } });
  if (!existing || existing.packageId !== req.params.id) throw new NotFoundError('Seasonal rule');

  const { name, startMonth, startDay, endMonth, endDay, priceOverride, minimumSpendOverride, multiplier } = req.body;
  const data: any = {};
  if (name        != null) data.name         = String(name);
  if (startMonth  != null) data.startMonth   = parseInt(startMonth);
  if (startDay    != null) data.startDay     = parseInt(startDay);
  if (endMonth    != null) data.endMonth     = parseInt(endMonth);
  if (endDay      != null) data.endDay       = parseInt(endDay);
  if (priceOverride        != null) data.priceOverride        = parseFloat(priceOverride);
  if (minimumSpendOverride != null) data.minimumSpendOverride = parseFloat(minimumSpendOverride);
  if (multiplier           != null) data.multiplier           = parseFloat(multiplier);

  const rule = await prisma.seasonalPricingRule.update({ where: { id: req.params.ruleId }, data });
  res.json({ success: true, data: rule });
});

/** DELETE /packages/:id/seasonal-rules/:ruleId */
export const deleteSeasonalRule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  const existing = await prisma.seasonalPricingRule.findUnique({ where: { id: req.params.ruleId } });
  if (!existing || existing.packageId !== req.params.id) throw new NotFoundError('Seasonal rule');

  await prisma.seasonalPricingRule.delete({ where: { id: req.params.ruleId } });
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Day-of-Week Pricing Rules
// ─────────────────────────────────────────────────────────────────────────────

/** POST /packages/:id/dow-rules */
export const addDayOfWeekRule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  const { days, priceOverride, minimumSpendOverride } = req.body;

  if (!Array.isArray(days) || days.length === 0) {
    throw new AppError('days must be a non-empty array of DayOfWeek values', 400);
  }

  const validDays = Object.values(DayOfWeek);
  for (const d of days) {
    if (!validDays.includes(d)) {
      throw new AppError(`Invalid day "${d}". Must be one of: ${validDays.join(', ')}`, 400);
    }
  }

  const rule = await prisma.dayOfWeekPricingRule.create({
    data: {
      packageId:            req.params.id,
      days:                 days as DayOfWeek[],
      priceOverride:        priceOverride        != null ? parseFloat(priceOverride)        : undefined,
      minimumSpendOverride: minimumSpendOverride != null ? parseFloat(minimumSpendOverride) : undefined,
    },
  });

  res.status(201).json({ success: true, data: rule });
});

/** PUT /packages/:id/dow-rules/:ruleId */
export const updateDayOfWeekRule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  const existing = await prisma.dayOfWeekPricingRule.findUnique({ where: { id: req.params.ruleId } });
  if (!existing || existing.packageId !== req.params.id) throw new NotFoundError('Day-of-week rule');

  const { days, priceOverride, minimumSpendOverride } = req.body;
  const data: any = {};

  if (days != null) {
    if (!Array.isArray(days)) throw new AppError('days must be an array', 400);
    const validDays = Object.values(DayOfWeek);
    for (const d of days) {
      if (!validDays.includes(d)) throw new AppError(`Invalid day "${d}"`, 400);
    }
    data.days = days as DayOfWeek[];
  }
  if (priceOverride        != null) data.priceOverride        = parseFloat(priceOverride);
  if (minimumSpendOverride != null) data.minimumSpendOverride = parseFloat(minimumSpendOverride);

  const rule = await prisma.dayOfWeekPricingRule.update({ where: { id: req.params.ruleId }, data });
  res.json({ success: true, data: rule });
});

/** DELETE /packages/:id/dow-rules/:ruleId */
export const deleteDayOfWeekRule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requirePackageOwnership(req.params.id, profile.id);

  const existing = await prisma.dayOfWeekPricingRule.findUnique({ where: { id: req.params.ruleId } });
  if (!existing || existing.packageId !== req.params.id) throw new NotFoundError('Day-of-week rule');

  await prisma.dayOfWeekPricingRule.delete({ where: { id: req.params.ruleId } });
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Add-Ons
// ─────────────────────────────────────────────────────────────────────────────

/** POST /addons */
export const createAddOn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const { name, description, pricingType, price, minimumSpend, isRequired, applicablePackageIds, sortOrder } = req.body;

  if (!name)        throw new AppError('name is required', 400);
  if (!pricingType) throw new AppError('pricingType is required', 400);
  if (price == null) throw new AppError('price is required', 400);

  if (!Object.values(AddOnPricingType).includes(pricingType)) {
    throw new AppError(`pricingType must be one of: ${Object.values(AddOnPricingType).join(', ')}`, 400);
  }

  // If packageIds provided, verify they all belong to this vendor
  let packageConnect: { id: string }[] | undefined;
  if (Array.isArray(applicablePackageIds) && applicablePackageIds.length > 0) {
    const ownedPkgs = await prisma.package.findMany({
      where: { id: { in: applicablePackageIds }, providerProfileId: profile.id },
      select: { id: true },
    });
    if (ownedPkgs.length !== applicablePackageIds.length) {
      throw new ForbiddenError('One or more package IDs not found or not owned by you');
    }
    packageConnect = ownedPkgs;
  }

  const addOn = await prisma.addOn.create({
    data: {
      providerProfileId:  profile.id,
      name:               String(name),
      description:        description ? String(description) : undefined,
      pricingType:        pricingType as AddOnPricingType,
      price:              parseFloat(price),
      minimumSpend:       minimumSpend != null ? parseFloat(minimumSpend) : undefined,
      isRequired:         isRequired != null ? Boolean(isRequired) : false,
      sortOrder:          sortOrder  != null ? parseInt(sortOrder) : 0,
      ...(packageConnect ? { applicablePackages: { connect: packageConnect } } : {}),
    },
    include: {
      applicablePackages: { select: { id: true, name: true, category: true } },
    },
  });

  res.status(201).json({ success: true, data: addOn });
});

/** GET /addons/me */
export const getMyAddOns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const addOns = await prisma.addOn.findMany({
    where:   { providerProfileId: profile.id },
    include: { applicablePackages: { select: { id: true, name: true, category: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ success: true, data: addOns });
});

/** PUT /addons/:id */
export const updateAddOn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requireAddOnOwnership(req.params.id, profile.id);

  const { name, description, pricingType, price, minimumSpend, isRequired, applicablePackageIds, sortOrder, isActive } = req.body;

  if (pricingType && !Object.values(AddOnPricingType).includes(pricingType)) {
    throw new AppError(`pricingType must be one of: ${Object.values(AddOnPricingType).join(', ')}`, 400);
  }

  const data: any = {};
  if (name         != null) data.name         = String(name);
  if (description  != null) data.description  = String(description);
  if (pricingType  != null) data.pricingType  = pricingType as AddOnPricingType;
  if (price        != null) data.price        = parseFloat(price);
  if (minimumSpend != null) data.minimumSpend = parseFloat(minimumSpend);
  if (isRequired   != null) data.isRequired   = Boolean(isRequired);
  if (sortOrder    != null) data.sortOrder    = parseInt(sortOrder);
  if (isActive     != null) data.isActive     = Boolean(isActive);

  // Reconnect applicable packages if the caller provided a new set
  if (Array.isArray(applicablePackageIds)) {
    if (applicablePackageIds.length > 0) {
      const ownedPkgs = await prisma.package.findMany({
        where: { id: { in: applicablePackageIds }, providerProfileId: profile.id },
        select: { id: true },
      });
      if (ownedPkgs.length !== applicablePackageIds.length) {
        throw new ForbiddenError('One or more package IDs not found or not owned by you');
      }
      data.applicablePackages = { set: ownedPkgs };
    } else {
      // Empty array → remove all package restrictions (make universal)
      data.applicablePackages = { set: [] };
    }
  }

  const addOn = await prisma.addOn.update({
    where:   { id: req.params.id },
    data,
    include: { applicablePackages: { select: { id: true, name: true, category: true } } },
  });

  res.json({ success: true, data: addOn });
});

/** DELETE /addons/:id */
export const deleteAddOn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requireAddOnOwnership(req.params.id, profile.id);

  await prisma.addOn.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Estimate  (public — no auth)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /packages/estimate */
export const getEstimate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { packageId, eventDate, guestCount, durationHours, selectedAddOnIds = [] } = req.body;

  if (!packageId)  throw new AppError('packageId is required', 400);
  if (!eventDate)  throw new AppError('eventDate is required', 400);
  if (guestCount == null) throw new AppError('guestCount is required', 400);

  const parsedDate = new Date(eventDate);
  if (isNaN(parsedDate.getTime())) throw new AppError('Invalid eventDate', 400);

  const result = await calculatePackagePrice({
    packageId:        String(packageId),
    eventDate:        parsedDate,
    guestCount:       parseInt(guestCount),
    durationHours:    durationHours != null ? parseFloat(durationHours) : undefined,
    selectedAddOnIds: Array.isArray(selectedAddOnIds) ? selectedAddOnIds : [],
  });

  res.json({ success: true, data: result });
});

// ─────────────────────────────────────────────────────────────────────────────
// Availability Blocks
// ─────────────────────────────────────────────────────────────────────────────

/** POST /availability */
export const blockDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const { startDate, endDate, reason, note } = req.body;
  if (!startDate) throw new AppError('startDate is required', 400);
  if (!endDate)   throw new AppError('endDate is required', 400);
  if (!reason)    throw new AppError('reason is required', 400);

  const validReasons = ['BOOKED_EXTERNAL', 'CLOSED', 'PERSONAL', 'MAINTENANCE'];
  if (!validReasons.includes(reason)) {
    throw new AppError(`reason must be one of: ${validReasons.join(', ')}`, 400);
  }

  const parsedStart = new Date(startDate);
  const parsedEnd   = new Date(endDate);
  if (isNaN(parsedStart.getTime())) throw new AppError('Invalid startDate', 400);
  if (isNaN(parsedEnd.getTime()))   throw new AppError('Invalid endDate', 400);
  if (parsedEnd < parsedStart)      throw new AppError('endDate must be on or after startDate', 400);

  const block = await prisma.availabilityBlock.create({
    data: {
      providerProfileId: profile.id,
      startDate:         parsedStart,
      endDate:           parsedEnd,
      reason:            reason as any,
      note:              note ? String(note) : undefined,
    },
  });

  res.status(201).json({ success: true, data: block });
});

/** GET /availability/me */
export const getMyBlocks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);

  const blocks = await prisma.availabilityBlock.findMany({
    where:   { providerProfileId: profile.id },
    orderBy: { startDate: 'asc' },
  });

  res.json({ success: true, data: blocks });
});

/** DELETE /availability/:id */
export const deleteBlock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await getProviderProfile(req.user!.id, req.query.profileId as string);
  await requireBlockOwnership(req.params.id, profile.id);

  await prisma.availabilityBlock.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

/**
 * GET /availability/check
 * Query: providerProfileId, date
 * Returns { available: boolean, reason?: string }
 */
export const checkAvailability = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { providerProfileId, date } = req.query as { providerProfileId?: string; date?: string };

  if (!providerProfileId) throw new AppError('providerProfileId is required', 400);
  if (!date)              throw new AppError('date is required', 400);

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) throw new AppError('Invalid date', 400);

  // Check availability blocks
  const block = await prisma.availabilityBlock.findFirst({
    where: {
      providerProfileId,
      startDate: { lte: parsedDate },
      endDate:   { gte: parsedDate },
    },
  });
  if (block) {
    return res.json({ success: true, data: { available: false, reason: `Date is blocked (${block.reason})` } });
  }

  // Check confirmed bookings on this day
  const dayStart = new Date(parsedDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(parsedDate); dayEnd.setHours(23, 59, 59, 999);

  const booking = await prisma.booking.findFirst({
    where: {
      providerProfileId,
      status:    { not: 'CANCELLED' },
      eventDate: { gte: dayStart, lte: dayEnd },
    },
  });
  if (booking) {
    return res.json({ success: true, data: { available: false, reason: 'Date is already booked' } });
  }

  res.json({ success: true, data: { available: true } });
});
