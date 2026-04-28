import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { 
  createProviderProfileSchema, 
  updateProviderProfileSchema, 
  createServiceSchema,
  updateServiceSchema,
  createEquipmentSchema,
  setAvailabilitySchema,
  providerSearchSchema 
} from '../utils/validators.js';
import { asyncHandler, AppError, NotFoundError, ConflictError, ForbiddenError } from '../middleware/errorHandler.js';

// Create provider profile (users can have multiple profiles)
export const createProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const data = createProviderProfileSchema.parse(req.body);
  
  // TODO: rewire to new schema — pricingLevels removed; use Package model instead
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pricingLevels: _pricingLevels, ...profileData } = data as any;

  // Check if user already has a profile with the same primary type
  if (data.primaryType) {
    const existingProfile = await prisma.providerProfile.findFirst({
      where: { 
        userId,
        primaryType: data.primaryType,
      },
    });
    
    if (existingProfile) {
      throw new ConflictError(`You already have a ${data.primaryType} profile`);
    }
  }
  
  // Create profile
  const profile = await prisma.providerProfile.create({
    data: {
      userId,
      ...profileData,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  
  // Add PROVIDER role if user doesn't have it
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  
  if (user && !user.roles.includes('PROVIDER')) {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        roles: { push: 'PROVIDER' },
      },
    });
  }
  
  res.status(201).json({
    success: true,
    data: profile,
    message: 'Provider profile created successfully',
  });
});

// Get all own profiles
export const getMyProfiles = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const profiles = await prisma.providerProfile.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          bannerUrl: true,
          phoneNumber: true,
        },
      },
      // TODO: rewire to new schema — services and pricingLevels removed; use Package model
      menuItems: {
        include: {
          pricingTiers: {
            orderBy: { minQuantity: 'asc' },
          },
        },
        orderBy: [
          { category: 'asc' },
          { displayOrder: 'asc' },
        ],
      },
      portfolioItems: {
        orderBy: { displayOrder: 'asc' },
        take: 10,
      },
    },
  });
  
  res.json({
    success: true,
    data: profiles,
  });
});

// Get single profile by ID
export const getMyProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { profileId } = req.params;
  
  const where: any = { userId };
  if (profileId) {
    where.id = profileId;
  }
  
  const profile = await prisma.providerProfile.findFirst({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          phoneNumber: true,
          city: true,
          state: true,
          country: true,
          address: true,
        },
      },
      // TODO: rewire to new schema — services removed; use Package model
      portfolioItems: {
        orderBy: { displayOrder: 'asc' },
        take: 10,
      },
    },
  });

  // A new vendor with no profile yet is a valid state — return null so the
  // frontend renders an empty setup form rather than treating this as an error.
  if (!profile) {
    res.json({ success: true, data: null });
    return;
  }

  res.json({
    success: true,
    data: profile,
  });
});

// Update profile
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const data = updateProviderProfileSchema.parse(req.body);
  
  // Find first profile (user can have multiple)
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const updatedProfile = await prisma.providerProfile.update({
    where: { id: profile.id },
    data,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  
  res.json({
    success: true,
    data: updatedProfile,
    message: 'Profile updated successfully',
  });
});

// Get provider by ID (public)
export const getProviderById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  const profile = await prisma.providerProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          bannerUrl: true,
          city: true,
          state: true,
        },
      },
      // TODO: rewire to new schema — services and pricingLevels removed; use Package model
      menuItems: {
        include: {
          pricingTiers: {
            orderBy: { minQuantity: 'asc' },
          },
        },
        orderBy: [
          { category: 'asc' },
          { displayOrder: 'asc' },
        ],
      },
      portfolioItems: {
        where: { isPublic: true },
        orderBy: [
          { isFeatured: 'desc' },
          { displayOrder: 'asc' },
        ],
      },
    },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider');
  }
  
  res.json({
    success: true,
    data: profile,
  });
});

// Search providers — package-aware
export const searchProviders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    type,
    eventDate,
    guestCount:   guestCountStr,
    eventType,
    minBudget:    minBudgetStr,
    maxBudget:    maxBudgetStr,
    city,
    page:         pageStr  = '1',
    limit:        limitStr = '20',
  } = req.query as Record<string, string>;

  if (!type) throw new AppError('type is required', 400);

  const page       = Math.max(1, parseInt(pageStr)  || 1);
  const limit      = Math.min(50, parseInt(limitStr) || 20);
  const skip       = (page - 1) * limit;
  const guestCount = guestCountStr ? parseInt(guestCountStr)   : undefined;
  const minBudget  = minBudgetStr  ? parseFloat(minBudgetStr)  : undefined;
  const maxBudget  = maxBudgetStr  ? parseFloat(maxBudgetStr)  : undefined;

  // ── Steps 3–5: Build package-level sub-filter ────────────────────────────
  const packageFilter: any = { isActive: true };

  // Step 3 — Guest count
  if (guestCount !== undefined) {
    packageFilter.AND = [
      { OR: [{ minGuests: null }, { minGuests: { lte: guestCount } }] },
      { OR: [{ maxGuests: null }, { maxGuests: { gte: guestCount } }] },
    ];
  }

  // Step 4 — Event type
  if (eventType) {
    packageFilter.eventTypes = { has: eventType };
  }

  // Step 5 — Budget (basePrice or minimumSpend within range)
  if (minBudget !== undefined || maxBudget !== undefined) {
    const budgetCond: any = {};
    if (minBudget !== undefined) budgetCond.gte = minBudget;
    if (maxBudget !== undefined) budgetCond.lte = maxBudget;
    packageFilter.OR = [
      { basePrice:    budgetCond },
      { minimumSpend: budgetCond },
    ];
  }

  // ── Step 1: Base filter ───────────────────────────────────────────────────
  const where: any = {
    verificationStatus: 'VERIFIED',
    packages: { some: packageFilter },
    OR: [
      { primaryType:    type },
      { providerTypes:  { has: type } },
    ],
  };

  // ── Step 2: Date availability filter ─────────────────────────────────────
  if (eventDate) {
    const parsedDate = new Date(eventDate);
    if (!isNaN(parsedDate.getTime())) {
      const startOfDay = new Date(parsedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(parsedDate);
      endOfDay.setHours(23, 59, 59, 999);

      where.NOT = {
        OR: [
          {
            availabilityBlocks: {
              some: {
                startDate: { lte: parsedDate },
                endDate:   { gte: parsedDate },
              },
            },
          },
          {
            bookings: {
              some: {
                AND: [
                  { eventDate: { gte: startOfDay } },
                  { eventDate: { lte: endOfDay   } },
                  { status:    { notIn: ['CANCELLED'] } },
                ],
              },
            },
          },
        ],
      };
    }
  }

  // ── Step 6: City filter (case-insensitive via user relation) ──────────────
  if (city) {
    where.user = { city: { contains: city, mode: 'insensitive' } };
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  const [providers, total] = await prisma.$transaction([
    prisma.providerProfile.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { averageRating: 'desc' },
      include: {
        user: {
          select: { id: true, city: true, state: true },
        },
        packages: {
          where:   { isActive: true },
          orderBy: [{ basePrice: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id:           true,
            name:         true,
            category:     true,
            pricingModel: true,
            basePrice:    true,
            minimumSpend: true,
            minGuests:    true,
            maxGuests:    true,
            included:     true,
          },
        },
      },
    }),
    prisma.providerProfile.count({ where }),
  ]);

  // ── Step 7: Calculate startingFrom + shape response ──────────────────────
  const results = providers.map(provider => {
    const pkgs = provider.packages;
    let startingFrom: number | null = null;
    let featuredPackage: any       = null;

    if (pkgs.length > 0) {
      // Cheapest package is first (sorted by basePrice ASC)
      const cheapest = pkgs[0];

      startingFrom = cheapest.pricingModel === 'PER_PERSON' && guestCount !== undefined
        ? cheapest.basePrice * guestCount
        : cheapest.basePrice;

      if (cheapest.minimumSpend != null && cheapest.minimumSpend > startingFrom) {
        startingFrom = cheapest.minimumSpend;
      }

      startingFrom = Math.round(startingFrom * 100) / 100;

      featuredPackage = {
        id:           cheapest.id,
        name:         cheapest.name,
        category:     cheapest.category,
        pricingModel: cheapest.pricingModel,
        basePrice:    cheapest.basePrice,
        minimumSpend: cheapest.minimumSpend,
        minGuests:    cheapest.minGuests,
        maxGuests:    cheapest.maxGuests,
        included:     cheapest.included,
      };
    }

    return {
      id:                 provider.id,
      businessName:       provider.businessName,
      primaryType:        provider.primaryType,
      providerTypes:      provider.providerTypes,
      tagline:            provider.tagline,
      city:               provider.user?.city ?? null,
      averageRating:      provider.averageRating,
      totalReviews:       provider.totalReviews,
      logoUrl:            provider.logoUrl,
      bannerImageUrl:     provider.bannerImageUrl,
      startingFrom,
      activePackageCount: pkgs.length,
      isAvailable:        true,   // passed the NOT filter (or no date was given)
      featuredPackage,
    };
  });

  res.json({
    success: true,
    data:    results,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ============================================
// SERVICES
// ============================================

// TODO: rewire to new schema — Service model removed; replaced by Package
export const createService = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ success: true, data: [], message: 'Coming soon' });
});

export const updateService = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ success: true, data: [], message: 'Coming soon' });
});

export const deleteService = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ success: true, data: [], message: 'Coming soon' });
});

export const getServices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ success: true, data: [], message: 'Coming soon' });
});

// ============================================
// EQUIPMENT
// ============================================

export const createEquipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const data = createEquipmentSchema.parse(req.body);
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const equipment = await prisma.equipment.create({
    data: {
      providerId: profile.id,
      ...data,
    },
  });
  
  res.status(201).json({
    success: true,
    data: equipment,
    message: 'Equipment added successfully',
  });
});

export const getEquipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
    include: { equipmentOfferings: true },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  res.json({
    success: true,
    data: profile.equipmentOfferings,
  });
});

export const updateEquipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // TODO: implement full equipment update once Equipment model is fully wired
  return res.json({ success: true, data: null, message: 'Coming soon' });
});

export const deleteEquipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: { provider: true },
  });
  
  if (!equipment) {
    throw new NotFoundError('Equipment');
  }
  
  if (equipment.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to delete this equipment');
  }
  
  await prisma.equipment.delete({ where: { id } });
  
  res.json({
    success: true,
    message: 'Equipment deleted successfully',
  });
});

// ============================================
// AVAILABILITY
// ============================================

export const setAvailability = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const data = setAvailabilitySchema.parse(req.body);
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  // Upsert availability records
  const operations = data.dates.map(item => 
    prisma.availability.upsert({
      where: {
        providerId_date: {
          providerId: profile.id,
          date: item.date,
        },
      },
      update: {
        isAvailable: item.isAvailable,
        notes: item.notes,
      },
      create: {
        providerId: profile.id,
        date: item.date,
        isAvailable: item.isAvailable,
        notes: item.notes,
      },
    })
  );
  
  await prisma.$transaction(operations);
  
  res.json({
    success: true,
    message: 'Availability updated successfully',
  });
});

export const getAvailability = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  
  const profile = await prisma.providerProfile.findUnique({
    where: { id },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider');
  }
  
  const where: any = { providerId: id };
  
  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string),
    };
  }
  
  const availability = await prisma.availability.findMany({
    where,
    orderBy: { date: 'asc' },
  });
  
  res.json({
    success: true,
    data: availability,
  });
});

// ============================================
// MENU ITEMS / SERVICE OFFERINGS
// ============================================

// Get menu items for a provider (public)
export const getMenuItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { providerId } = req.params;

  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: { id: true, userId: true },
  });

  if (!profile) {
    throw new NotFoundError('Provider');
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { providerId: providerId },
    include: {
      pricingTiers: {
        orderBy: { minQuantity: 'asc' },
      },
    },
    orderBy: [
      { category: 'asc' },
      { displayOrder: 'asc' },
      { name: 'asc' },
    ],
  });

  res.json({
    success: true,
    data: menuItems,
  });
});

// Create menu item
export const createMenuItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { name, description, category, price, pricingTiers, imageUrl, allergens, dietaryInfo, isAvailable, displayOrder } = req.body;
  
  if (!name || price === undefined) {
    throw new AppError('Name and price are required', 400);
  }
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const menuItem = await prisma.menuItem.create({
    data: {
      providerId: profile.id,
      name,
      description: description || null,
      category: category || 'General',
      price: parseFloat(price),
      imageUrl: imageUrl || null,
      allergens: allergens || [],
      dietaryInfo: dietaryInfo || [],
      isAvailable: isAvailable !== false,
      displayOrder: displayOrder || 0,
      pricingTiers: pricingTiers && pricingTiers.length > 0 ? {
        create: pricingTiers.map((tier: any) => ({
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
          pricePerUnit: parseFloat(tier.pricePerUnit),
        })),
      } : undefined,
    },
    include: {
      pricingTiers: {
        orderBy: { minQuantity: 'asc' },
      },
    },
  });
  
  res.status(201).json({
    success: true,
    data: menuItem,
    message: 'Menu item created successfully',
  });
});

// Update menu item
export const updateMenuItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { itemId } = req.params;
  const { name, description, category, price, pricingTiers, imageUrl, allergens, dietaryInfo, isAvailable, displayOrder } = req.body;
  
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: itemId },
    include: { provider: true },
  });
  
  if (!menuItem) {
    throw new NotFoundError('Menu item');
  }
  
  if (menuItem.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to update this menu item');
  }
  
  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (category !== undefined) updateData.category = category;
  if (price !== undefined) updateData.price = parseFloat(price);
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (allergens !== undefined) updateData.allergens = allergens;
  if (dietaryInfo !== undefined) updateData.dietaryInfo = dietaryInfo;
  if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
  if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
  
  // Handle pricing tiers update
  if (pricingTiers !== undefined) {
    // Delete existing tiers and create new ones
    await prisma.menuItemPricingTier.deleteMany({
      where: { menuItemId: itemId },
    });
    
    if (pricingTiers && pricingTiers.length > 0) {
      updateData.pricingTiers = {
        create: pricingTiers.map((tier: any) => ({
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
          pricePerUnit: parseFloat(tier.pricePerUnit),
        })),
      };
    }
  }
  
  const updated = await prisma.menuItem.update({
    where: { id: itemId },
    data: updateData,
    include: {
      pricingTiers: {
        orderBy: { minQuantity: 'asc' },
      },
    },
  });
  
  res.json({
    success: true,
    data: updated,
    message: 'Menu item updated successfully',
  });
});

// Delete menu item
export const deleteMenuItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { itemId } = req.params;
  
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: itemId },
    include: { provider: true },
  });
  
  if (!menuItem) {
    throw new NotFoundError('Menu item');
  }
  
  if (menuItem.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to delete this menu item');
  }
  
  await prisma.menuItem.delete({ where: { id: itemId } });
  
  res.json({
    success: true,
    message: 'Menu item deleted successfully',
  });
});

// ============================================
// STATS
// ============================================

// Get provider packages grouped by category (public)
// GET /providers/:id/packages
export const getProviderPackages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const profile = await prisma.providerProfile.findUnique({
    where:  { id },
    select: { id: true },
  });

  if (!profile) throw new NotFoundError('Provider');

  const packages = await prisma.package.findMany({
    where:   { providerProfileId: id, isActive: true },
    include: {
      seasonalRules:  true,
      dayOfWeekRules: true,
      addOns:         true,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { category:  'asc' },
    ],
  });

  // Group by category
  const grouped: Record<string, typeof packages> = {};
  for (const pkg of packages) {
    if (!grouped[pkg.category]) grouped[pkg.category] = [];
    grouped[pkg.category].push(pkg);
  }

  const result = Object.entries(grouped).map(([category, pkgs]) => ({
    category,
    packages: pkgs,
  }));

  res.json({ success: true, data: result });
});

export const getProviderStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
    include: {
      _count: {
        select: {
          quotes: true,
          bookings: true,
          portfolioItems: true,
          // TODO: rewire to new schema — services removed; use packages count instead
        },
      },
    },
  });

  if (!profile) {
    throw new NotFoundError('Provider profile');
  }

  // Get additional stats
  const [pendingQuotes, activeBookings, recentReviews] = await Promise.all([
    prisma.quote.count({
      where: {
        providerProfileId: profile.id,
        status: 'SENT',
      },
    }),
    prisma.booking.count({
      where: {
        providerProfileId: profile.id,
        status: { in: ['CONFIRMED', 'DEPOSIT_PAID', 'IN_PROGRESS'] },
      },
    }),
    prisma.review.findMany({
      where: {
        booking: { providerProfileId: profile.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalQuotes: profile._count.quotes,
      totalBookings: profile._count.bookings,
      portfolioItems: profile._count.portfolioItems,
      // TODO: rewire to new schema — services count removed
      pendingQuotes,
      activeBookings,
      averageRating: profile.averageRating,
      totalReviews: profile.totalReviews,
      completedBookings: profile.completedBookings,
      recentReviews,
    },
  });
});
