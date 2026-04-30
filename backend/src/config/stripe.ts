import Stripe from 'stripe';
import { config } from '../config';

export const stripe: InstanceType<typeof Stripe> = new Stripe(config.stripe.secretKey, {
  apiVersion: '2026-04-22.dahlia',
});

export default stripe;
