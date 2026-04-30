import { Router } from 'express';
import { authenticate, requireProvider, requireClient } from '../middleware/auth.js';
import {
  createConnectAccount,
  getConnectStatus,
  createDepositCheckout,
  handleWebhook,
} from '../controllers/stripeController.js';

const router = Router();

// Webhook — raw body, no auth
router.post('/webhook', handleWebhook);

// Vendor Connect Express onboarding
router.post('/connect/onboard', authenticate, requireProvider, createConnectAccount);
router.get('/connect/status', authenticate, requireProvider, getConnectStatus);

// Client deposit payment
router.post('/checkout/deposit', authenticate, requireClient, createDepositCheckout);

export default router;
