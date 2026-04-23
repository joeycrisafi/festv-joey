import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireClient, requireProvider } from '../middleware/auth';
import * as eventRequestController from '../controllers/eventRequestController';

const router = Router();

// Client routes
router.post('/', authenticate, requireClient, asyncHandler(eventRequestController.createEventRequest));
router.get('/my-requests', authenticate, requireClient, asyncHandler(eventRequestController.getMyEventRequests));
router.get('/:id', authenticate, asyncHandler(eventRequestController.getEventRequest));
router.put('/:id', authenticate, requireClient, asyncHandler(eventRequestController.updateEventRequest));
router.post('/:id/submit', authenticate, requireClient, asyncHandler(eventRequestController.submitEventRequest));
router.post('/:id/cancel', authenticate, requireClient, asyncHandler(eventRequestController.cancelEventRequest));
router.delete('/:id', authenticate, requireClient, asyncHandler(eventRequestController.deleteEventRequest));

// Provider routes
router.get('/available/for-providers', authenticate, requireProvider, asyncHandler(eventRequestController.getAvailableEventRequests));
router.post('/:id/decline', authenticate, requireProvider, asyncHandler(eventRequestController.declineEventRequest));
router.post('/:id/vendor-confirm', authenticate, requireProvider, asyncHandler(eventRequestController.vendorConfirmRequest));

export default router;
