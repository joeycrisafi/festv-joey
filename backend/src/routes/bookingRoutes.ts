/**
 * Booking Routes
 *
 * Static segments registered before /:id to prevent Express capture.
 *
 * Auth matrix:
 *   GET   /me/client        → getMyBookingsAsClient        (CLIENT)
 *   GET   /me/vendor        → getMyBookingsAsVendor        (PROVIDER)
 *   GET   /upcoming         → getUpcomingBookings          (PROVIDER)
 *   GET   /stats            → getBookingStats              (PROVIDER)
 *   GET   /:id              → getBookingById               (CLIENT or VENDOR who owns it)
 *   PATCH /:id/deposit-paid → markDepositPaid              (PROVIDER)
 *   PATCH /:id/confirm      → confirmBooking               (PROVIDER)
 *   PATCH /:id/complete     → completeBooking              (PROVIDER)
 *   PATCH /:id/cancel       → cancelBooking                (CLIENT or PROVIDER)
 *   PATCH /:id/approve      → approveOutOfParametersBooking (PROVIDER)
 */

import { Router } from 'express';
import { authenticate, requireClient, requireProvider } from '../middleware/auth.js';
import {
  getBookingById,
  getMyBookingsAsClient,
  getMyBookingsAsVendor,
  markDepositPaid,
  confirmBooking,
  completeBooking,
  cancelBooking,
  approveOutOfParametersBooking,
  getUpcomingBookings,
  getBookingStats,
  downloadBookingPdf,
} from '../controllers/bookingController.js';

const router = Router();

// ── Static segments (must precede /:id) ──────────────────────────────────────
router.get('/me/client',  authenticate, requireClient,   getMyBookingsAsClient);
router.get('/me/vendor',  authenticate, requireProvider, getMyBookingsAsVendor);
router.get('/upcoming',   authenticate, requireProvider, getUpcomingBookings);
router.get('/stats',      authenticate, requireProvider, getBookingStats);

// ── Single resource ───────────────────────────────────────────────────────────
router.get('/:id',                    authenticate,             getBookingById);
router.get('/:id/confirmation-pdf',   authenticate,             downloadBookingPdf);
router.patch('/:id/deposit-paid', authenticate, requireProvider, markDepositPaid);
router.patch('/:id/confirm',    authenticate, requireProvider, confirmBooking);
router.patch('/:id/complete',   authenticate, requireProvider, completeBooking);
router.patch('/:id/cancel',     authenticate,             cancelBooking);
router.patch('/:id/approve',    authenticate, requireProvider, approveOutOfParametersBooking);

export default router;
