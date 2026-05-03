/**
 * Quote Routes
 *
 * Static segments registered before /:id to prevent Express capture.
 *
 * Auth matrix:
 *   POST  /auto-generate              → autoGenerateQuote      (PROVIDER)
 *   POST  /manual                     → createManualQuote       (PROVIDER)
 *   GET   /me/vendor                  → getMyQuotesAsVendor     (PROVIDER)
 *   GET   /me/client                  → getMyQuotesAsClient     (CLIENT)
 *   POST  /requests/:id/vendor-decline → vendorDeclineRequest   (PROVIDER)
 *   GET   /:id                        → getQuoteById            (CLIENT or VENDOR who owns it)
 *   POST  /:id/accept                 → acceptQuote             (CLIENT)
 *   POST  /:id/reject                 → rejectQuote             (CLIENT)
 *   POST  /:id/revise                 → reviseQuote             (PROVIDER)
 *   POST  /:id/vendor-approve         → vendorApproveQuote      (PROVIDER)
 */

import { Router } from 'express';
import { authenticate, requireClient, requireProvider } from '../middleware/auth.js';
import {
  autoGenerateQuote,
  createManualQuote,
  getQuoteById,
  getMyQuotesAsVendor,
  getMyQuotesAsClient,
  acceptQuote,
  rejectQuote,
  reviseQuote,
  vendorApproveQuote,
  vendorDeclineRequest,
} from '../controllers/quoteController.js';

const router = Router();

// ── Static segments (must precede /:id) ──────────────────────────────────────
router.post('/auto-generate',                authenticate, requireProvider, autoGenerateQuote);
router.post('/manual',                       authenticate, requireProvider, createManualQuote);
router.get('/me/vendor',                     authenticate, requireProvider, getMyQuotesAsVendor);
router.get('/me/client',                     authenticate, requireClient,   getMyQuotesAsClient);
router.post('/requests/:id/vendor-decline',  authenticate, requireProvider, vendorDeclineRequest);

// ── Single resource ───────────────────────────────────────────────────────────
router.get('/:id',                           authenticate,                  getQuoteById);
router.post('/:id/accept',                   authenticate, requireClient,   acceptQuote);
router.post('/:id/reject',                   authenticate, requireClient,   rejectQuote);
router.post('/:id/revise',                   authenticate, requireProvider, reviseQuote);
router.post('/:id/vendor-approve',           authenticate, requireProvider, vendorApproveQuote);

export default router;
