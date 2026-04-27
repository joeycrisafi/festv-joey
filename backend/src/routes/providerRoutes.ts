import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireProvider, optionalAuth } from '../middleware/auth';
import * as providerController from '../controllers/providerController';

const router = Router();

// ─── Static / specific routes FIRST (before /:id catch-all) ───

// Search (public)
router.get('/search', optionalAuth, asyncHandler(providerController.searchProviders));

// Profile management (authenticated)
router.post('/profile', authenticate, asyncHandler(providerController.createProfile));
router.get('/profile/all', authenticate, asyncHandler(providerController.getMyProfiles));
router.get('/profile/me', authenticate, requireProvider, asyncHandler(providerController.getMyProfile));
router.get('/profile/stats', authenticate, requireProvider, asyncHandler(providerController.getProviderStats));
router.get('/profile/:profileId', authenticate, requireProvider, asyncHandler(providerController.getMyProfile));
router.put('/profile', authenticate, requireProvider, asyncHandler(providerController.updateProfile));

// Menu Items - provider management (authenticated)
router.post('/menu-items', authenticate, requireProvider, asyncHandler(providerController.createMenuItem));
router.put('/menu-items/:itemId', authenticate, requireProvider, asyncHandler(providerController.updateMenuItem));
router.delete('/menu-items/:itemId', authenticate, requireProvider, asyncHandler(providerController.deleteMenuItem));

// Services (authenticated)
router.post('/services', authenticate, requireProvider, asyncHandler(providerController.createService));
router.put('/services/:id', authenticate, requireProvider, asyncHandler(providerController.updateService));
router.delete('/services/:id', authenticate, requireProvider, asyncHandler(providerController.deleteService));

// Equipment (authenticated)
router.post('/equipment', authenticate, requireProvider, asyncHandler(providerController.createEquipment));
router.put('/equipment/:id', authenticate, requireProvider, asyncHandler(providerController.updateEquipment));
router.delete('/equipment/:id', authenticate, requireProvider, asyncHandler(providerController.deleteEquipment));

// Availability (authenticated)
router.post('/availability', authenticate, requireProvider, asyncHandler(providerController.setAvailability));

// ─── Parameterized routes LAST ───

// Public provider pages
router.get('/:id', optionalAuth, asyncHandler(providerController.getProviderById));
router.get('/:id/availability', asyncHandler(providerController.getAvailability));
router.get('/:providerId/menu-items', asyncHandler(providerController.getMenuItems));

export default router;
