import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../config/database.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_SELECT = {
  id: true,
  businessName: true,
  primaryType: true,
  providerTypes: true,
  averageRating: true,
  totalReviews: true,
  bannerImageUrl: true,
  logoUrl: true,
  serviceAreas: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      city: true,
      state: true,
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Add provider to favorites
// ─────────────────────────────────────────────────────────────────────────────

export const addToFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  const userRoles: string[] = req.user!.roles || (req.user!.role ? [req.user!.role] : []);
  if (!userRoles.includes('CLIENT')) {
    throw new ForbiddenError('Only clients can add favorites');
  }

  const provider = await prisma.providerProfile.findFirst({
    where: { id: providerId },
    select: PROVIDER_SELECT,
  });
  if (!provider) throw new NotFoundError('Provider');

  const existing = await prisma.favorite.findUnique({
    where: { userId_providerId: { userId, providerId } },
  });
  if (existing) throw new ConflictError('Provider is already in your favorites');

  const favorite = await prisma.favorite.create({
    data: { userId, providerId },
  });

  res.status(201).json({ success: true, data: { ...favorite, providerProfile: provider } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Remove provider from favorites
// ─────────────────────────────────────────────────────────────────────────────

export const removeFromFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  const favorite = await prisma.favorite.findUnique({
    where: { userId_providerId: { userId, providerId } },
  });
  if (!favorite) throw new NotFoundError('Favorite');
  if (favorite.userId !== userId) throw new ForbiddenError('You can only remove your own favorites');

  await prisma.favorite.delete({ where: { userId_providerId: { userId, providerId } } });

  res.json({ success: true, message: 'Provider removed from favorites' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get all favorites
// ─────────────────────────────────────────────────────────────────────────────

export const getMyFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 20, providerType } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.favorite.count({ where: { userId } }),
  ]);

  const providerIds = favorites.map(f => f.providerId);

  const providerWhere: any = { id: { in: providerIds } };
  if (providerType) {
    providerWhere.providerTypes = { has: providerType as string };
  }

  const providers = await prisma.providerProfile.findMany({
    where: providerWhere,
    select: {
      ...PROVIDER_SELECT,
      portfolioItems: {
        where: { isFeatured: true },
        take: 1,
        select: { id: true, mediaUrl: true, mediaType: true },
      },
    },
  });

  const providerMap = new Map(providers.map(p => [p.id, p]));

  const result = favorites.map(f => ({
    ...f,
    providerProfile: providerMap.get(f.providerId) ?? null,
  }));

  res.json({
    success: true,
    data: {
      favorites: result,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Check if provider is favorited
// ─────────────────────────────────────────────────────────────────────────────

export const checkFavorite = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  const favorite = await prisma.favorite.findUnique({
    where: { userId_providerId: { userId, providerId } },
  });

  res.json({ success: true, data: { isFavorited: !!favorite } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Update favorite notes — notes field not in schema; kept for API compat
// ─────────────────────────────────────────────────────────────────────────────

export const updateFavoriteNotes = async (req: AuthenticatedRequest, res: Response) => {
  res.status(400).json({
    success: false,
    error: 'Favorite notes are not supported in the current schema.',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get favorite details (full provider)
// ─────────────────────────────────────────────────────────────────────────────

export const getFavoriteDetails = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerId } = req.params;

  const favorite = await prisma.favorite.findUnique({
    where: { userId_providerId: { userId, providerId } },
  });
  if (!favorite) throw new NotFoundError('Favorite');

  const provider = await prisma.providerProfile.findFirst({
    where: { id: providerId },
    select: {
      ...PROVIDER_SELECT,
      cuisineTypes: { select: { id: true, name: true } },
      eventThemes: { select: { id: true, name: true } },
      portfolioItems: {
        where: { isFeatured: true },
        take: 6,
        select: { id: true, title: true, mediaType: true, mediaUrl: true },
      },
      _count: { select: { bookings: true } },
    },
  });

  res.json({ success: true, data: { ...favorite, providerProfile: provider } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk add to favorites
// ─────────────────────────────────────────────────────────────────────────────

export const bulkAddFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerIds } = req.body as { providerIds: string[] };

  if (!Array.isArray(providerIds) || providerIds.length === 0) {
    throw new Error('Provider IDs array is required');
  }
  if (providerIds.length > 20) {
    throw new Error('Cannot add more than 20 favorites at once');
  }

  const existing = await prisma.providerProfile.findMany({
    where: { id: { in: providerIds } },
    select: { id: true },
  });
  const existingProviderIds = existing.map(p => p.id);

  const alreadyFavorited = await prisma.favorite.findMany({
    where: { userId, providerId: { in: existingProviderIds } },
    select: { providerId: true },
  });
  const alreadyFavoritedIds = alreadyFavorited.map(f => f.providerId);
  const newProviderIds = existingProviderIds.filter(id => !alreadyFavoritedIds.includes(id));

  const result = await prisma.favorite.createMany({
    data: newProviderIds.map(pid => ({ userId, providerId: pid })),
    skipDuplicates: true,
  });

  res.status(201).json({
    success: true,
    data: {
      added: result.count,
      alreadyFavorited: alreadyFavoritedIds.length,
      notFound: providerIds.length - existingProviderIds.length,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk remove favorites
// ─────────────────────────────────────────────────────────────────────────────

export const bulkRemoveFavorites = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { providerIds } = req.body as { providerIds: string[] };

  if (!Array.isArray(providerIds) || providerIds.length === 0) {
    throw new Error('Provider IDs array is required');
  }

  const result = await prisma.favorite.deleteMany({
    where: { userId, providerId: { in: providerIds } },
  });

  res.json({ success: true, data: { removed: result.count } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get favorites count
// ─────────────────────────────────────────────────────────────────────────────

export const getFavoritesCount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const [count, favorites] = await Promise.all([
    prisma.favorite.count({ where: { userId } }),
    prisma.favorite.findMany({
      where: { userId },
      select: { providerId: true },
    }),
  ]);

  const providerIds = favorites.map(f => f.providerId);
  const providers = await prisma.providerProfile.findMany({
    where: { id: { in: providerIds } },
    select: { providerTypes: true },
  });

  const byType: Record<string, number> = {};
  providers.forEach(p => {
    p.providerTypes.forEach((type: string) => {
      byType[type] = (byType[type] || 0) + 1;
    });
  });

  res.json({ success: true, data: { total: count, byType } });
};
