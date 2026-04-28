/**
 * Event routes — mounted at /events in routes/index.ts
 *
 * Auth matrix:
 *   All routes require CLIENT or ADMIN role (requireClient middleware)
 *
 * POST   /events        createEvent
 * GET    /events/me     getMyEvents
 * GET    /events/:id    getEventById
 * PUT    /events/:id    updateEvent
 */

import { Router } from 'express';
import { authenticate, requireClient } from '../middleware/auth.js';
import { createEvent, getMyEvents, getEventById, updateEvent } from '../controllers/eventController.js';

const router = Router();

// Static segments before /:id to avoid Express swallowing them
router.get('/me',   authenticate, requireClient, getMyEvents);

router.post('/',    authenticate, requireClient, createEvent);
router.get('/:id',  authenticate, requireClient, getEventById);
router.put('/:id',  authenticate, requireClient, updateEvent);

export default router;
