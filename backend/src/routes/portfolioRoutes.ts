import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireProvider, optionalAuth } from '../middleware/auth';
import * as portfolioController from '../controllers/portfolioController';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/portfolio');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

const router = Router();

// Public routes
router.get('/provider/:providerId', optionalAuth, asyncHandler(portfolioController.getProviderPortfolio));
router.post('/:itemId/like', authenticate, asyncHandler(portfolioController.toggleLikePortfolioItem));

// Provider routes
router.post('/', authenticate, requireProvider, upload.single('media'), asyncHandler(portfolioController.createPortfolioItem));
router.get('/me', authenticate, requireProvider, asyncHandler(portfolioController.getMyPortfolio));
router.put('/:itemId', authenticate, requireProvider, asyncHandler(portfolioController.updatePortfolioItem));
router.delete('/:itemId', authenticate, requireProvider, asyncHandler(portfolioController.deletePortfolioItem));
router.post('/featured', authenticate, requireProvider, asyncHandler(portfolioController.setFeaturedItems));
router.post('/reorder', authenticate, requireProvider, asyncHandler(portfolioController.reorderPortfolio));

// ── PortfolioPost feed routes (new social feed, separate from PortfolioItem) ──
router.get('/feed', authenticate, asyncHandler(portfolioController.getFeed));
router.get('/saved', authenticate, asyncHandler(portfolioController.getSavedPosts));
router.get('/users/:userId', authenticate, asyncHandler(portfolioController.getUserPosts));
router.post('/posts', authenticate, asyncHandler(portfolioController.createPost));
router.delete('/posts/:id', authenticate, asyncHandler(portfolioController.deletePost));
router.post('/posts/:id/like', authenticate, asyncHandler(portfolioController.toggleLike));
router.post('/posts/:id/save', authenticate, asyncHandler(portfolioController.toggleSave));

export default router;
