import { Response } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createPortfolioItemSchema } from '../utils/validators.js';
import { asyncHandler, NotFoundError, ForbiddenError, AppError } from '../middleware/errorHandler.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

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
