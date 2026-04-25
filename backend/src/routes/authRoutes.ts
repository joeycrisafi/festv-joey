import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import * as authController from '../controllers/authController';

const router = Router();

// Public routes
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/refresh-token', asyncHandler(authController.refreshToken));
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/reset-password', asyncHandler(authController.resetPassword));

// Dev-only: gated by ENABLE_TEST_ACCOUNTS=true on the backend.
// 404s when disabled so it looks non-existent in prod.
router.post('/seed-test-accounts', asyncHandler(authController.seedTestAccountsHandler));

// Protected routes
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.getMe));
router.put('/change-password', authenticate, asyncHandler(authController.changePassword));
router.post('/add-role', authenticate, asyncHandler(authController.addRole));
router.post('/switch-role', authenticate, asyncHandler(authController.switchRole));

export default router;
