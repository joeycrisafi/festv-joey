import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { AppError, NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler';
import { createReviewSchema, updateReviewSchema } from '../utils/validators';

// Create a review for a completed booking
export const createReview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const validation = createReviewSchema.safeParse(req.body);

  if (!validation.success) {
    throw new AppError(validation.error.errors[0].message, 400);
  }

  const { bookingId, overallRating, foodQuality, presentation,
          punctuality, communication, valueForMoney, title,
          content } = validation.data;

  // Verify the booking exists and belongs to this client
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      providerProfile: { select: { userId: true } },
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking');
  }

  if (booking.clientId !== userId) {
    throw new ForbiddenError('You can only review your own bookings');
  }

  if (booking.status !== 'COMPLETED') {
    throw new AppError('You can only review completed bookings', 400);
  }

  // Check if already reviewed
  const existingReview = await prisma.review.findUnique({
    where: { bookingId },
  });

  if (existingReview) {
    throw new ConflictError('You have already reviewed this booking');
  }

  // Create the review
  const review = await prisma.review.create({
    data: {
      bookingId,
      authorId: userId,
      subjectId: booking.providerProfile.userId, // TODO: rewire to new schema (subjectId should be vendor User.id)
      overallRating,
      foodQuality,
      presentation,
      punctuality,
      communication,
      valueForMoney,
      title,
      content,
      isVerified: true, // Verified because it's linked to a real booking
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Update provider's average rating
  const providerReviews = await prisma.review.findMany({
    where: { subjectId: booking.providerProfile.userId, isPublic: true },
  });

  const avgRating = providerReviews.reduce((sum, r) => sum + r.overallRating, 0) / providerReviews.length;

  await prisma.providerProfile.update({
    where: { id: booking.providerProfileId },
    data: {
      averageRating: avgRating,
      totalReviews: providerReviews.length,
    },
  });

  // Create notification for provider
  // TODO: rewire to new schema — notify booking.providerProfile.userId
  await prisma.notification.create({
    data: {
      userId: booking.providerProfile.userId,
      type: 'NEW_REVIEW',
      title: 'New Review Received',
      message: `You received a ${overallRating}-star review!`,
      data: { reviewId: review.id, bookingId },
    },
  });

  res.status(201).json({
    success: true,
    data: review,
  });
};

// Get reviews for a provider (public)
export const getProviderReviews = async (req: AuthenticatedRequest, res: Response) => {
  const { providerId } = req.params;
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', minRating } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  // TODO: rewire to new schema — subjectId is User.id, need to resolve from ProviderProfile.userId
  const where: any = {
    subjectId: providerId,
    isPublic: true,
  };

  if (minRating) {
    where.overallRating = { gte: Number(minRating) };
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { [sortBy as string]: sortOrder },
      skip,
      take: Number(limit),
    }),
    prisma.review.count({ where }),
  ]);

  // Calculate rating distribution
  const ratingDistribution = await prisma.review.groupBy({
    by: ['overallRating'],
    where: { subjectId: providerId, isPublic: true },
    _count: true,
  });

  // Calculate average for each category
  const categoryAverages = await prisma.review.aggregate({
    where: { subjectId: providerId, isPublic: true },
    _avg: {
      overallRating: true,
      foodQuality: true,
      presentation: true,
      punctuality: true,
      communication: true,
      valueForMoney: true,
    },
  });

  res.json({
    success: true,
    data: reviews,
    meta: {
      stats: {
        ratingDistribution: ratingDistribution.reduce((acc, curr) => {
          acc[curr.overallRating] = curr._count;
          return acc;
        }, {} as Record<number, number>),
        categoryAverages: categoryAverages._avg,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// Get a single review
export const getReview = async (req: AuthenticatedRequest, res: Response) => {
  const { reviewId } = req.params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      subject: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!review) {
    throw new NotFoundError('Review');
  }

  if (!review.isPublic && req.user?.id !== review.authorId) {
    throw new ForbiddenError('This review is private');
  }

  res.json({
    success: true,
    data: review,
  });
};

// Update a review (client only, within edit window)
export const updateReview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { reviewId } = req.params;
  const validation = updateReviewSchema.safeParse(req.body);

  if (!validation.success) {
    throw new AppError(validation.error.errors[0].message, 400);
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError('Review');
  }

  if (review.authorId !== userId) {
    throw new ForbiddenError('You can only update your own reviews');
  }

  // Check if within edit window (e.g., 48 hours)
  const editWindow = 48 * 60 * 60 * 1000; // 48 hours in ms
  if (Date.now() - review.createdAt.getTime() > editWindow) {
    throw new AppError('Review can only be edited within 48 hours of creation', 400);
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: validation.data,
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Update provider's average rating if rating changed
  if (validation.data.overallRating) {
    const providerReviews = await prisma.review.findMany({
      where: { subjectId: review.subjectId, isPublic: true },
    });
    const avgRating = providerReviews.reduce((sum, r) => sum + r.overallRating, 0) / providerReviews.length;
    // TODO: rewire to new schema — need to resolve ProviderProfile from subjectId (User.id)
    await prisma.providerProfile.updateMany({
      where: { userId: review.subjectId },
      data: { averageRating: avgRating },
    });
  }

  res.json({
    success: true,
    data: updatedReview,
  });
};

// Delete a review (client only, or admin)
export const deleteReview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { reviewId } = req.params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError('Review');
  }

  if (review.authorId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You can only delete your own reviews');
  }

  await prisma.review.delete({
    where: { id: reviewId },
  });

  // Update provider's stats
  const providerReviews = await prisma.review.findMany({
    where: { subjectId: review.subjectId, isPublic: true },
  });

  const avgRating = providerReviews.length > 0
    ? providerReviews.reduce((sum, r) => sum + r.overallRating, 0) / providerReviews.length
    : 0;

  // TODO: rewire to new schema — need to resolve ProviderProfile from subjectId (User.id)
  await prisma.providerProfile.updateMany({
    where: { userId: review.subjectId },
    data: {
      averageRating: avgRating,
      totalReviews: providerReviews.length,
    },
  });

  res.json({
    success: true,
    message: 'Review deleted successfully',
  });
};

// Provider responds to a review
export const respondToReview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { reviewId } = req.params;
  const { response } = req.body;

  if (!response || response.length < 10) {
    throw new AppError('Response must be at least 10 characters', 400);
  }

  if (response.length > 1000) {
    throw new AppError('Response cannot exceed 1000 characters', 400);
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError('Review');
  }

  // TODO: rewire to new schema — subjectId is User.id; check if current user is the subject
  if (review.subjectId !== userId) {
    throw new ForbiddenError('You can only respond to reviews for your business');
  }

  if (review.providerResponse) {
    throw new ConflictError('You have already responded to this review');
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: {
      providerResponse: response,
      providerRespondedAt: new Date(),
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: updatedReview,
  });
};

// Get my reviews (as a client)
export const getMyReviews = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 10 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { authorId: userId },
      include: {
        subject: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.review.count({ where: { authorId: userId } }),
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// Report a review
export const reportReview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { reviewId } = req.params;
  const { reason } = req.body;

  if (!reason || reason.length < 10) {
    throw new AppError('Please provide a reason for reporting (at least 10 characters)', 400);
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError('Review');
  }

  // TODO: rewire to new schema — isFlagged / moderationNotes removed from Review; add to new schema when needed
  console.warn(`Review ${reviewId} reported by user ${userId}: ${reason}`);

  res.json({
    success: true,
    message: 'Review has been reported and will be reviewed by our team',
  });
};

// Toggle review visibility (client)
export const toggleReviewVisibility = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { reviewId } = req.params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError('Review');
  }

  if (review.authorId !== userId) {
    throw new ForbiddenError('You can only modify your own reviews');
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: { isPublic: !review.isPublic },
  });

  res.json({
    success: true,
    data: updatedReview,
    message: `Review is now ${updatedReview.isPublic ? 'public' : 'private'}`,
  });
};
