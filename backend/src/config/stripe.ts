import Stripe from 'stripe';

let _stripe: InstanceType<typeof Stripe> | null = null;

export function getStripe(): InstanceType<typeof Stripe> {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return _stripe;
}
