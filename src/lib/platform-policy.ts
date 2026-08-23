// Flat, published platform policy figures that don't need admin
// editing (contrast with platform_settings, migration 0043, which
// holds the ones that genuinely do — the insurance waiver rate isn't
// known yet, this deposit figure is a decision already made).
export const PLATFORM_DEPOSIT_USD = 300;

// Card-network holds and PayPal authorizations both eventually expire
// if never captured or voided — Stripe tops out around 7 days on most
// networks, PayPal around 29 (extendable to 175 via re-authorization).
// Neither path in this codebase re-authorizes yet, so this is a stated
// limit, not something enforced in code: fine for a typical rental,
// not for a long-term one.
export const DEPOSIT_HOLD_TYPICAL_LIMIT_DAYS = 7;
