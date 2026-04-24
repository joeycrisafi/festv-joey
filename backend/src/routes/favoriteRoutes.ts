import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  addToFavorites,
  removeFromFavorites,
  getMyFavorites,
  checkFavorite,
  updateFavoriteNotes,
} from '../controllers/favoriteController.js';

const router = Router();

// All favorites routes require auth
router.use(authenticate);

router.get('/', asyncHandler(getMyFavorites));
router.post('/:providerId', asyncHandler(addToFavorites));
router.delete('/:providerId', asyncHandler(removeFromFavorites));
router.get('/:providerId/check', asyncHandler(checkFavorite));
router.patch('/:providerId/notes', asyncHandler(updateFavoriteNotes));

export default router;
