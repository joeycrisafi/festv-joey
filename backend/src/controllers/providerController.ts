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
  
  // Extract pricing levels from the data (handled separately)
  const { pricingLevels, ...profileData } = data;
  
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
  
  // Create profile with pricing levels
  const profile = await prisma.providerProfile.create({
    data: {
      userId,
      ...profileData,
      pricingLevels: pricingLevels && pricingLevels.length > 0 ? {
        create: pricingLevels.map((level, index) => ({
          name: level.name,
          description: level.description,
          pricePerPerson: level.pricePerPerson,
          minimumGuests: level.minimumGuests,
          features: level.features || [],
          displayOrder: index,
        })),
      } : undefined,
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
      pricingLevels: {
        orderBy: { displayOrder: 'asc' },
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
      services: true,
      pricingLevels: {
        orderBy: { displayOrder: 'asc' },
      },
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
      cuisineTypes: true,
      eventThemes: true,
      equipmentOfferings: true,
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
          address: true,
        },
      },
      services: true,
      cuisineTypes: true,
      eventThemes: true,
      equipmentOfferings: true,
      portfolioItems: {
        orderBy: { displayOrder: 'asc' },
        take: 10,
      },
    },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
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
      services: {
        where: { isActive: true },
      },
      pricingLevels: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
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
      cuisineTypes: true,
      eventThemes: true,
      equipmentOfferings: true,
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

// Search providers
export const searchProviders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = providerSearchSchema.parse(req.query);
  const currentUserId = req.user?.id;
  
  // TODO: restrict to VERIFIED only in production
  const where: any = {};
  
  // Filter by provider types
  if (params.providerTypes && params.providerTypes.length > 0) {
    where.providerTypes = { hasSome: params.providerTypes };
  }
  
  // Filter by rating
  if (params.minRating) {
    where.averageRating = { gte: params.minRating };
  }
  
  // Filter by guest count
  if (params.guestCount) {
    where.AND = [
      ...(where.AND || []),
      { minGuestCount: { lte: params.guestCount } },
      { maxGuestCount: { gte: params.guestCount } },
    ];
  }
  
  // Filter by budget
  if (params.maxBudget) {
    where.minimumBudget = { lte: params.maxBudget };
  }
  
  // Filter by location
  if (params.city) {
    where.serviceAreas = { has: params.city };
  }
  
  // Filter by cuisine types
  if (params.cuisineTypes && params.cuisineTypes.length > 0) {
    where.cuisineTypes = {
      some: {
        name: { in: params.cuisineTypes },
      },
    };
  }
  
  // Filter by event themes
  if (params.eventThemes && params.eventThemes.length > 0) {
    where.eventThemes = {
      some: {
        name: { in: params.eventThemes },
      },
    };
  }
  
  // Sort options
  const orderBy: any = {};
  switch (params.sortBy) {
    case 'rating':
      orderBy.averageRating = params.sortOrder;
      break;
    case 'reviews':
      orderBy.totalReviews = params.sortOrder;
      break;
    case 'price':
      orderBy.pricePerPerson = params.sortOrder;
      break;
    default:
      orderBy.averageRating = 'desc';
  }
  
  const skip = (params.page - 1) * params.limit;
  
  const [providers, total] = await Promise.all([
    prisma.providerProfile.findMany({
      where,
      orderBy,
      skip,
      take: params.limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true,
            state: true,
          },
        },
        cuisineTypes: true,
        portfolioItems: {
          where: { isPublic: true, isFeatured: true },
          take: 3,
        },
      },
    }),
    prisma.providerProfile.count({ where }),
  ]);
  
  res.json({
    success: true,
    data: providers,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  });
});

// ============================================
// SERVICES
// ============================================

export const createService = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const data = createServiceSchema.parse(req.body);
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const service = await prisma.service.create({
    data: {
      providerId: profile.id,
      ...data,
    },
  });
  
  res.status(201).json({
    success: true,
    data: service,
    message: 'Service created successfully',
  });
});

export const updateService = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const data = updateServiceSchema.parse(req.body);
  
  const service = await prisma.service.findUnique({
    where: { id },
    include: { provider: true },
  });
  
  if (!service) {
    throw new NotFoundError('Service');
  }
  
  if (service.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to update this service');
  }
  
  const updatedService = await prisma.service.update({
    where: { id },
    data,
  });
  
  res.json({
    success: true,
    data: updatedService,
    message: 'Service updated successfully',
  });
});

export const deleteService = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const service = await prisma.service.findUnique({
    where: { id },
    include: { provider: true },
  });
  
  if (!service) {
    throw new NotFoundError('Service');
  }
  
  if (service.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to delete this service');
  }
  
  await prisma.service.delete({ where: { id } });
  
  res.json({
    success: true,
    message: 'Service deleted successfully',
  });
});

export const getServices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
    include: { services: true },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  res.json({
    success: true,
    data: profile.services,
  });
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
    select: { id: true, userId: true, businessName: true },
  });

  if (!profile) {
    throw new NotFoundError('Provider');
  }

  // Get all profile IDs for this user
  const profilesByUser = await prisma.providerProfile.findMany({
    where: { userId: profile.userId },
    select: { id: true },
  });

  // Also include profiles with the same business name — handles cases where a vendor
  // re-registered and ended up with two separate user accounts for the same business
  const profilesByName = profile.businessName
    ? await prisma.providerProfile.findMany({
        where: { businessName: profile.businessName },
        select: { id: true },
      })
    : [];

  const allProfileIds = [
    ...new Set([
      ...profilesByUser.map((p: { id: string }) => p.id),
      ...profilesByName.map((p: { id: string }) => p.id),
    ]),
  ];

  const menuItems = await prisma.menuItem.findMany({
    where: { providerId: { in: allProfileIds } },
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
          services: true,
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
        providerId: profile.id,
        status: 'SENT',
      },
    }),
    prisma.booking.count({
      where: {
        providerId: profile.id,
        status: { in: ['CONFIRMED', 'DEPOSIT_PAID', 'IN_PROGRESS'] },
      },
    }),
    prisma.review.findMany({
      where: {
        booking: { providerId: profile.id },
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
      services: profile._count.services,
      pendingQuotes,
      activeBookings,
      averageRating: profile.averageRating,
      totalReviews: profile.totalReviews,
      completedBookings: profile.completedBookings,
      recentReviews,
    },
  });
});
