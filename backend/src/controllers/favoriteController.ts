import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler';

// Add provider to favorites
export const addToFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;
  const { notes } = req.body;

  // Check if user is a client (handle both role string and roles array)
  const userRoles: string[] = req.user!.roles || (req.user!.role ? [req.user!.role] : []);
  if (!userRoles.includes('CLIENT')) {
    throw new ForbiddenError('Only clients can add favorites');
  }

  // Check if provider exists
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  if (!provider) {
    throw new NotFoundError('Provider');
  }

  // Check if already favorited
  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      userId_providerId: {
        userId,
        providerId
      }
    }
  });

  if (existingFavorite) {
    throw new ConflictError('Provider is already in your favorites');
  }

  const favorite = await prisma.favorite.create({
    data: {
      userId,
      providerId,
      notes
    },
    include: {
      provider: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true
            }
          }
        }
      }
    }
  });

  res.status(201).json({
    success: true,
    data: favorite
  });
};

// Remove provider from favorites
export const removeFromFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_providerId: {
        userId,
        providerId
      }
    }
  });

  if (!favorite) {
    throw new NotFoundError('Favorite');
  }

  if (favorite.userId !== userId) {
    throw new ForbiddenError('You can only remove your own favorites');
  }

  await prisma.favorite.delete({
    where: {
      userId_providerId: {
        userId,
        providerId
      }
    }
  });

  res.json({
    success: true,
    message: 'Provider removed from favorites'
  });
};

// Get all favorites
export const getMyFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { 
    page = 1, 
    limit = 20, 
    providerType, 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: any = { userId };

  // Build provider filter
  const providerWhere: any = {};
  if (providerType) {
    providerWhere.providerTypes = { has: providerType as string };
  }

  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      include: {
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                city: true,
                state: true
              }
            },
            services: {
              take: 3,
              select: {
                id: true,
                name: true,
                basePrice: true,
                priceType: true
              }
            },
            portfolioItems: {
              where: { isFeatured: true },
              take: 1,
              select: {
                id: true,
                mediaUrl: true,
                mediaType: true
              }
            }
          },
          where: Object.keys(providerWhere).length > 0 ? providerWhere : undefined
        }
      },
      orderBy: { [sortBy as string]: sortOrder },
      skip,
      take: Number(limit)
    }),
    prisma.favorite.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      favorites,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
};

// Check if provider is favorited
export const checkFavorite = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_providerId: {
        userId,
        providerId
      }
    }
  });

  res.json({
    success: true,
    data: { isFavorited: !!favorite }
  });
};

// Update favorite notes
export const updateFavoriteNotes = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;
  const { notes } = req.body;

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_providerId: {
        userId,
        providerId
      }
    }
  });

  if (!favorite) {
    throw new NotFoundError('Favorite');
  }

  if (favorite.userId !== userId) {
    throw new ForbiddenError('You can only update your own favorites');
  }

  const updatedFavorite = await prisma.favorite.update({
    where: {
      userId_providerId: {
        userId,
        providerId
      }
    },
    data: { notes },
    include: {
      provider: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true
            }
          }
        }
      }
    }
  });

  res.json({
    success: true,
    data: updatedFavorite
  });
};

// Get favorite by provider ID (with full details)
export const getFavoriteDetails = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_providerId: {
        userId,
        providerId
      }
    },
    include: {
      provider: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              profileImage: true,
              city: true,
              state: true
            }
          },
          services: true,
          cuisineTypes: true,
          eventThemes: true,
          portfolioItems: {
            where: { isFeatured: true },
            take: 6
          },
          _count: {
            select: {
              reviews: true,
              bookings: true
            }
          }
        }
      }
    }
  });

  if (!favorite) {
    throw new NotFoundError('Favorite');
  }

  res.json({
    success: true,
    data: favorite
  });
};

// Bulk add to favorites
export const bulkAddFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerIds } = req.body;

  if (!Array.isArray(providerIds) || providerIds.length === 0) {
    throw new Error('Provider IDs array is required');
  }

  if (providerIds.length > 20) {
    throw new Error('Cannot add more than 20 favorites at once');
  }

  // Check which providers exist
  const existingProviders = await prisma.providerProfile.findMany({
    where: { id: { in: providerIds } },
    select: { id: true }
  });

  const existingProviderIds = existingProviders.map(p => p.id);

  // Get existing favorites to avoid duplicates
  const existingFavorites = await prisma.favorite.findMany({
    where: {
      userId,
      providerId: { in: existingProviderIds }
    },
    select: { providerId: true }
  });

  const alreadyFavoritedIds = existingFavorites.map(f => f.providerId);
  const newProviderIds = existingProviderIds.filter(id => !alreadyFavoritedIds.includes(id));

  // Create new favorites
  const favorites = await prisma.favorite.createMany({
    data: newProviderIds.map(providerId => ({
      userId,
      providerId
    })),
    skipDuplicates: true
  });

  res.status(201).json({
    success: true,
    data: {
      added: favorites.count,
      alreadyFavorited: alreadyFavoritedIds.length,
      notFound: providerIds.length - existingProviderIds.length
    }
  });
};

// Bulk remove favorites
export const bulkRemoveFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerIds } = req.body;

  if (!Array.isArray(providerIds) || providerIds.length === 0) {
    throw new Error('Provider IDs array is required');
  }

  const result = await prisma.favorite.deleteMany({
    where: {
      userId,
      providerId: { in: providerIds }
    }
  });

  res.json({
    success: true,
    data: { removed: result.count }
  });
};

// Get favorites count
export const getFavoritesCount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const count = await prisma.favorite.count({
    where: { userId }
  });

  // Group by provider type
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      provider: {
        select: { providerTypes: true }
      }
    }
  });

  const byType: Record<string, number> = {};
  favorites.forEach(fav => {
    fav.provider.providerTypes.forEach(type => {
      byType[type] = (byType[type] || 0) + 1;
    });
  });

  res.json({
    success: true,
    data: {
      total: count,
      byType
    }
  });
};
