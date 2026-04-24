import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { chat } from '../controllers/jessController.js';

const router = Router();

router.post('/chat', optionalAuth, asyncHandler(chat));

export default router;
