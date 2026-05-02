import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createPortfolioItemSchema } from '../utils/validators.js';
import { asyncHandler, NotFoundError, ForbiddenError, AppError } from '../middleware/errorHandler.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { z } from 'zod';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    ...config.upload.allowedImageTypes,
    ...config.upload.allowedVideoTypes,
    ...config.upload.allowedAudioTypes,
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
});

// Get media type from mimetype
const getMediaType = (mimetype: string): 'IMAGE' | 'VIDEO' | 'AUDIO' => {
  if (mimetype.startsWith('image/')) return 'IMAGE';
  if (mimetype.startsWith('video/')) return 'VIDEO';
  if (mimetype.startsWith('audio/')) return 'AUDIO';
  return 'IMAGE';
};

// Create portfolio item
export const createPortfolioItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const data = createPortfolioItemSchema.parse(req.body);
  const file = req.file;
  
  if (!file) {
    throw new AppError('Media file is required', 400);
  }
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  // Get current count for display order
  const count = await prisma.portfolioItem.count({
    where: { providerId: profile.id },
  });
  
  const mediaType = getMediaType(file.mimetype);
  const mediaUrl = `/uploads/${file.filename}`;
  
  // Handle tags
  const tagConnections = data.tags?.map(tagName => ({
    where: { name: tagName },
    create: { name: tagName },
  })) || [];
  
  const portfolioItem = await prisma.portfolioItem.create({
    data: {
      providerId: profile.id,
      title: data.title,
      description: data.description,
      mediaType,
      mediaUrl,
      thumbnailUrl: mediaType === 'IMAGE' ? mediaUrl : undefined,
      eventType: data.eventType,
      guestCount: data.guestCount,
      eventDate: data.eventDate,
      displayOrder: count,
      tags: tagConnections.length > 0 ? { connectOrCreate: tagConnections } : undefined,
    },
    include: {
      tags: true,
    },
  });
  
  res.status(201).json({
    success: true,
    data: portfolioItem,
    message: 'Portfolio item created successfully',
  });
});

// Get provider's portfolio items
export const getMyPortfolio = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { mediaType, page = 1, limit = 20 } = req.query;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  const where: any = { providerId: profile.id };
  
  if (mediaType) {
    where.mediaType = mediaType;
  }
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const [items, total] = await Promise.all([
    prisma.portfolioItem.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { displayOrder: 'asc' },
      ],
      skip,
      take: Number(limit),
      include: {
        tags: true,
      },
    }),
    prisma.portfolioItem.count({ where }),
  ]);
  
  res.json({
    success: true,
    data: items,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Get public portfolio for a provider
export const getProviderPortfolio = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { providerId } = req.params;
  const { mediaType, page = 1, limit = 20 } = req.query;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { id: providerId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider');
  }
  
  const where: any = {
    providerId,
    isPublic: true,
  };
  
  if (mediaType) {
    where.mediaType = mediaType;
  }
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const [items, total] = await Promise.all([
    prisma.portfolioItem.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { displayOrder: 'asc' },
      ],
      skip,
      take: Number(limit),
      include: {
        tags: true,
      },
    }),
    prisma.portfolioItem.count({ where }),
  ]);
  
  // Increment view counts
  await prisma.portfolioItem.updateMany({
    where: { id: { in: items.map(i => i.id) } },
    data: { viewCount: { increment: 1 } },
  });
  
  res.json({
    success: true,
    data: items,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Update portfolio item
export const updatePortfolioItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const updates = req.body;
  
  const item = await prisma.portfolioItem.findUnique({
    where: { id },
    include: { provider: true },
  });
  
  if (!item) {
    throw new NotFoundError('Portfolio item');
  }
  
  if (item.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to update this item');
  }
  
  // Handle tag updates
  let tagOperations = {};
  if (updates.tags) {
    tagOperations = {
      set: [], // Clear existing
      connectOrCreate: updates.tags.map((tagName: string) => ({
        where: { name: tagName },
        create: { name: tagName },
      })),
    };
    delete updates.tags;
  }
  
  const updatedItem = await prisma.portfolioItem.update({
    where: { id },
    data: {
      ...updates,
      tags: Object.keys(tagOperations).length > 0 ? tagOperations : undefined,
    },
    include: {
      tags: true,
    },
  });
  
  res.json({
    success: true,
    data: updatedItem,
    message: 'Portfolio item updated successfully',
  });
});

// Delete portfolio item
export const deletePortfolioItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const item = await prisma.portfolioItem.findUnique({
    where: { id },
    include: { provider: true },
  });
  
  if (!item) {
    throw new NotFoundError('Portfolio item');
  }
  
  if (item.provider.userId !== userId) {
    throw new ForbiddenError('Not authorized to delete this item');
  }
  
  await prisma.portfolioItem.delete({ where: { id } });
  
  // TODO: Delete associated file from storage
  
  res.json({
    success: true,
    message: 'Portfolio item deleted successfully',
  });
});

// Set featured items
export const setFeaturedItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { itemIds } = req.body;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  if (!Array.isArray(itemIds) || itemIds.length > 6) {
    throw new AppError('Please provide up to 6 item IDs', 400);
  }
  
  // Reset all featured
  await prisma.portfolioItem.updateMany({
    where: { providerId: profile.id },
    data: { isFeatured: false },
  });
  
  // Set new featured
  if (itemIds.length > 0) {
    await prisma.portfolioItem.updateMany({
      where: {
        id: { in: itemIds },
        providerId: profile.id,
      },
      data: { isFeatured: true },
    });
  }
  
  res.json({
    success: true,
    message: 'Featured items updated successfully',
  });
});

// Reorder portfolio items
export const reorderPortfolio = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { orderedIds } = req.body;
  
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  
  if (!profile) {
    throw new NotFoundError('Provider profile');
  }
  
  if (!Array.isArray(orderedIds)) {
    throw new AppError('Please provide ordered item IDs', 400);
  }
  
  // Update display order for each item
  const operations = orderedIds.map((id: string, index: number) =>
    prisma.portfolioItem.updateMany({
      where: { id, providerId: profile.id },
      data: { displayOrder: index },
    })
  );
  
  await prisma.$transaction(operations);
  
  res.json({
    success: true,
    message: 'Portfolio order updated successfully',
  });
});

// Like/unlike portfolio item
export const toggleLikePortfolioItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  const item = await prisma.portfolioItem.findUnique({
    where: { id },
  });
  
  if (!item) {
    throw new NotFoundError('Portfolio item');
  }
  
  // Simple increment for now - in production would track per-user likes
  await prisma.portfolioItem.update({
    where: { id },
    data: { likeCount: { increment: 1 } },
  });

  res.json({
    success: true,
    message: 'Liked successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PortfolioPost feed — new social feed model (separate from PortfolioItem)
// ─────────────────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  type: z.enum(['VENDOR_POST', 'PLANNER_POST']),
  caption: z.string().max(2000).optional(),
  imageUrls: z.array(z.string().url()).min(1).max(10),
  packageId: z.string().uuid().optional(),
  addOnIds: z.array(z.string()).optional(),
  eventId: z.string().uuid().optional(),
  vendorTags: z.array(z.object({
    providerId: z.string().uuid(),
    bookingId: z.string().uuid(),
  })).optional(),
});

const POST_INCLUDE = {
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true, providerProfile: { select: { businessName: true, logoUrl: true } } } },
  package: { select: { id: true, name: true } },
  event: { select: { id: true, name: true } },
  vendorTags: {
    select: {
      id: true,
      providerId: true,
      bookingId: true,
      provider: { select: { businessName: true, logoUrl: true } },
    },
  },
  _count: { select: { likes: true, saves: true } },
} as const;

async function attachUserFlags(posts: any[], userId: string) {
  if (posts.length === 0) return posts;
  const postIds = posts.map((p: any) => p.id);
  const [likes, saves] = await Promise.all([
    prisma.portfolioLike.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
    prisma.portfolioSave.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
  ]);
  const likedSet = new Set(likes.map((l: any) => l.postId));
  const savedSet = new Set(saves.map((s: any) => s.postId));
  return posts.map((p: any) => ({ ...p, likedByMe: likedSet.has(p.id), savedByMe: savedSet.has(p.id) }));
}

export const getFeed = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [posts, total] = await Promise.all([
    prisma.portfolioPost.findMany({
      include: POST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.portfolioPost.count(),
  ]);

  const result = await attachUserFlags(posts, userId);

  res.json({
    success: true,
    data: {
      posts: result,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    },
  });
});

export const getUserPosts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { userId: targetUserId } = req.params;

  const posts = await prisma.portfolioPost.findMany({
    where: { authorId: targetUserId },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  const result = await attachUserFlags(posts, userId);

  res.json({ success: true, data: { posts: result } });
});

export const createPost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const validation = createPostSchema.safeParse(req.body);
  if (!validation.success) throw new AppError(validation.error.errors[0].message, 400);

  const { type, caption, imageUrls, packageId, addOnIds, eventId, vendorTags } = validation.data;

  if (type === 'VENDOR_POST' && userRole !== 'PROVIDER') {
    throw new ForbiddenError('Only vendors can create vendor posts');
  }
  if (type === 'PLANNER_POST' && userRole !== 'CLIENT') {
    throw new ForbiddenError('Only planners can create planner posts');
  }

  // Verify vendor tags — each bookingId must belong to a booking where this planner is the client
  if (vendorTags && vendorTags.length > 0) {
    for (const tag of vendorTags) {
      const booking = await prisma.booking.findFirst({
        where: { id: tag.bookingId, clientId: userId, providerProfileId: tag.providerId },
      });
      if (!booking) {
        throw new ForbiddenError(`Cannot tag vendor — no verified booking found for bookingId ${tag.bookingId}`);
      }
    }
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.portfolioPost.create({
      data: {
        authorId: userId,
        type,
        caption,
        imageUrls,
        packageId,
        addOnIds: addOnIds ?? [],
        eventId,
      },
    });

    if (vendorTags && vendorTags.length > 0) {
      await tx.portfolioVendorTag.createMany({
        data: vendorTags.map((t) => ({ postId: created.id, providerId: t.providerId, bookingId: t.bookingId })),
      });
    }

    return tx.portfolioPost.findUniqueOrThrow({ where: { id: created.id }, include: POST_INCLUDE });
  });

  res.status(201).json({ success: true, data: post });
});

export const deletePost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const post = await prisma.portfolioPost.findUnique({ where: { id } });
  if (!post) throw new NotFoundError('Post');
  if (post.authorId !== userId) throw new ForbiddenError('You can only delete your own posts');

  await prisma.portfolioPost.delete({ where: { id } });

  res.json({ success: true, message: 'Post deleted' });
});

export const toggleLike = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id: postId } = req.params;

  const post = await prisma.portfolioPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new NotFoundError('Post');

  const existing = await prisma.portfolioLike.findUnique({ where: { userId_postId: { userId, postId } } });

  if (existing) {
    await prisma.portfolioLike.delete({ where: { userId_postId: { userId, postId } } });
  } else {
    await prisma.portfolioLike.create({ data: { userId, postId } });
  }

  const likeCount = await prisma.portfolioLike.count({ where: { postId } });
  res.json({ success: true, data: { liked: !existing, likeCount } });
});

export const toggleSave = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id: postId } = req.params;

  const post = await prisma.portfolioPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new NotFoundError('Post');

  const existing = await prisma.portfolioSave.findUnique({ where: { userId_postId: { userId, postId } } });

  if (existing) {
    await prisma.portfolioSave.delete({ where: { userId_postId: { userId, postId } } });
  } else {
    await prisma.portfolioSave.create({ data: { userId, postId } });
  }

  const saveCount = await prisma.portfolioSave.count({ where: { postId } });
  res.json({ success: true, data: { saved: !existing, saveCount } });
});

export const getSavedPosts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const saves = await prisma.portfolioSave.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { post: { include: POST_INCLUDE } },
  });

  const posts = saves.map((s) => s.post);
  const result = await attachUserFlags(posts, userId);

  res.json({ success: true, data: { posts: result } });
});
