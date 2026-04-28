/**
 * FESTV Pricing Engine
 *
 * Core service for calculating package prices from first principles.
 * Used by the auto-quote generator and the quote preview endpoint.
 *
 * Calculation order (must not be changed without updating tests):
 *   1. Fetch package + add-ons
 *   2. Validate parameters (out-of-parameter checks)
 *   3. Determine base price and minimum spend from package defaults
 *   4. Apply day-of-week pricing rule (if any)
 *   5. Apply seasonal pricing rule (if any — multiplier applies to post-DOW price)
 *   6. Apply pricing model (PER_PERSON / FLAT_RATE / PER_HOUR)
 *   7. Enforce minimum spend
 *   8. Calculate add-on line items
 *   9. Subtotal → 15% tax → total → 10% deposit
 */

import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { AddOnPricingType, DayOfWeek, PricingModel, BookingStatus } from '@prisma/client';

// ─────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────

export interface AddOnLineItem {
  addOnId: string;
  name: string;
  pricingType: AddOnPricingType;
  /** Unit price of the add-on */
  price: number;
  /** Number of units (1, guestCount, or durationHours depending on pricingType) */
  quantity: number;
  /** price × quantity, rounded to 2 dp */
  total: number;
  /** True if the add-on's isRequired flag is set */
  isRequired: boolean;
  /** True if required but NOT in selectedAddOnIds — system added it automatically */
  isAutoIncluded: boolean;
}

export interface PricingResult {
  /** Package price before minimum spend enforcement */
  packagePrice: number;
  /** Effective minimum spend after rule overrides */
  minimumSpend: number;
  /** max(packagePrice, minimumSpend) */
  appliedPrice: number;
  /** All included add-ons (required + explicitly selected) */
  addOns: AddOnLineItem[];
  addOnsTotal: number;
  /** Subset of addOns where isRequired = true */
  requiredAddOns: AddOnLineItem[];
  subtotal: number;
  /** 15% tax on subtotal */
  tax: number;
  /** subtotal + tax */
  total: number;
  /** 10% of total */
  depositAmount: number;
  isOutOfParameters: boolean;
  outOfParameterReasons: string[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Round a number to 2 decimal places using banker-safe arithmetic. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Map JS Date.getDay() (0 = Sunday) to Prisma DayOfWeek enum values.
 * Index 0 → SUNDAY, 1 → MONDAY, …, 6 → SATURDAY.
 */
const JS_DAY_MAP: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

/**
 * Returns true if the event date falls within the seasonal rule's date range.
 * Handles year-wrap ranges (e.g. Nov 1 → Mar 31).
 *
 * Comparison is done on MMDD integers (no year) so a rule defined as
 * startMonth=11, startDay=1, endMonth=3, endDay=31 correctly wraps across
 * the December/January boundary.
 */
function isInSeasonalRange(
  eventDate: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
): boolean {
  const month    = eventDate.getMonth() + 1; // 1–12
  const day      = eventDate.getDate();      // 1–31
  const eventMD  = month * 100 + day;
  const startMD  = startMonth * 100 + startDay;
  const endMD    = endMonth   * 100 + endDay;

  if (startMD <= endMD) {
    // Same-year range — e.g. Jun 15 → Aug 31
    return eventMD >= startMD && eventMD <= endMD;
  } else {
    // Year-wrap range — e.g. Nov 1 → Mar 31
    return eventMD >= startMD || eventMD <= endMD;
  }
}

// ─────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────

export async function calculatePackagePrice(input: {
  packageId: string;
  eventDate: Date;
  guestCount: number;
  durationHours?: number;
  selectedAddOnIds: string[];
}): Promise<PricingResult> {
  const { packageId, eventDate, guestCount, durationHours, selectedAddOnIds } = input;

  // ── Step 1: Fetch package ────────────────────────────────────────────────

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      seasonalRules:  true,
      dayOfWeekRules: true,
      // Add-ons explicitly linked to this package via the PackageAddOns join table
      addOns: {
        where: { isActive: true },
      },
    },
  });

  if (!pkg) {
    throw new AppError('Package not found', 404);
  }

  // Universal add-ons: active, belong to this provider, and carry no
  // applicablePackages restriction (i.e. they apply to every package).
  const universalAddOns = await prisma.addOn.findMany({
    where: {
      providerProfileId: pkg.providerProfileId,
      isActive: true,
      applicablePackages: { none: {} },
    },
  });

  // ── Step 2: Out-of-parameter checks ─────────────────────────────────────

  const outOfParameterReasons: string[] = [];

  if (pkg.minGuests != null && guestCount < pkg.minGuests) {
    outOfParameterReasons.push(`Guest count below minimum (${pkg.minGuests})`);
  }
  if (pkg.maxGuests != null && guestCount > pkg.maxGuests) {
    outOfParameterReasons.push(`Guest count exceeds maximum capacity (${pkg.maxGuests})`);
  }

  // Availability block check — any block whose range covers eventDate
  const availBlock = await prisma.availabilityBlock.findFirst({
    where: {
      providerProfileId: pkg.providerProfileId,
      startDate: { lte: eventDate },
      endDate:   { gte: eventDate },
    },
  });
  if (availBlock) {
    outOfParameterReasons.push('Date is blocked by vendor');
  }

  // Existing confirmed booking check — same provider, same calendar day, not CANCELLED
  const dayStart = new Date(eventDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(eventDate);
  dayEnd.setHours(23, 59, 59, 999);

  const existingBooking = await prisma.booking.findFirst({
    where: {
      providerProfileId: pkg.providerProfileId,
      status:    { not: BookingStatus.CANCELLED },
      eventDate: { gte: dayStart, lte: dayEnd },
    },
  });
  if (existingBooking) {
    outOfParameterReasons.push('Date is already booked');
  }

  const isOutOfParameters = outOfParameterReasons.length > 0;

  // ── Step 3: Base price and minimum spend ────────────────────────────────

  let basePrice     = pkg.basePrice;
  let minimumSpend  = pkg.minimumSpend ?? 0;

  // ── Step 4: Day-of-week rule ─────────────────────────────────────────────

  const eventDayOfWeek = JS_DAY_MAP[eventDate.getDay()];
  const dowRule = pkg.dayOfWeekRules.find(rule =>
    rule.days.includes(eventDayOfWeek),
  );

  if (dowRule) {
    if (dowRule.priceOverride != null) {
      basePrice = dowRule.priceOverride;
    }
    if (dowRule.minimumSpendOverride != null) {
      minimumSpend = dowRule.minimumSpendOverride;
    }
  }

  // ── Step 5: Seasonal rule ────────────────────────────────────────────────
  // Note: multiplier is applied to the post-DOW basePrice, not the original.

  const seasonalRule = pkg.seasonalRules.find(rule =>
    isInSeasonalRange(eventDate, rule.startMonth, rule.startDay, rule.endMonth, rule.endDay),
  );

  if (seasonalRule) {
    if (seasonalRule.priceOverride != null) {
      // A hard price override takes precedence — multiplier is ignored if both set.
      basePrice = seasonalRule.priceOverride;
    } else if (seasonalRule.multiplier != null) {
      basePrice = basePrice * seasonalRule.multiplier;
    }
    if (seasonalRule.minimumSpendOverride != null) {
      minimumSpend = seasonalRule.minimumSpendOverride;
    }
  }

  // ── Step 6: Pricing model ────────────────────────────────────────────────

  const effectiveDuration = durationHours ?? pkg.durationHours ?? 1;
  let packagePrice: number;

  switch (pkg.pricingModel) {
    case PricingModel.PER_PERSON:
      packagePrice = r2(basePrice * guestCount);
      break;
    case PricingModel.FLAT_RATE:
      packagePrice = r2(basePrice);
      break;
    case PricingModel.PER_HOUR:
      packagePrice = r2(basePrice * effectiveDuration);
      break;
    case PricingModel.FLAT_PLUS_PER_PERSON:
      // flatFee = room/base charge; basePrice = per-person food & beverage rate
      packagePrice = r2((pkg.flatFee ?? 0) + (basePrice * guestCount));
      break;
    default:
      packagePrice = r2(basePrice);
  }

  // ── Step 7: Minimum spend ────────────────────────────────────────────────

  const appliedPrice = r2(Math.max(packagePrice, minimumSpend));

  // ── Step 8: Add-on line items ────────────────────────────────────────────
  // Merge package-specific and universal add-ons; deduplicate by id.

  const addOnMap = new Map<string, (typeof pkg.addOns)[0]>();
  for (const a of pkg.addOns)      addOnMap.set(a.id, a);
  for (const a of universalAddOns) if (!addOnMap.has(a.id)) addOnMap.set(a.id, a);

  const includedAddOns: AddOnLineItem[] = [];

  for (const addOn of addOnMap.values()) {
    const isUserSelected = selectedAddOnIds.includes(addOn.id);
    const shouldInclude  = isUserSelected || addOn.isRequired;
    if (!shouldInclude) continue;

    // isAutoIncluded = system pulled it in because it's required; user didn't ask for it
    const isAutoIncluded = addOn.isRequired && !isUserSelected;

    let quantity: number;
    switch (addOn.pricingType) {
      case AddOnPricingType.PER_PERSON: quantity = guestCount;          break;
      case AddOnPricingType.PER_HOUR:   quantity = effectiveDuration;   break;
      case AddOnPricingType.FLAT:
      default:                          quantity = 1;
    }

    includedAddOns.push({
      addOnId:       addOn.id,
      name:          addOn.name,
      pricingType:   addOn.pricingType,
      price:         addOn.price,
      quantity,
      total:         r2(addOn.price * quantity),
      isRequired:    addOn.isRequired,
      isAutoIncluded,
    });
  }

  // ── Step 9: Final totals ─────────────────────────────────────────────────

  const addOnsTotal   = r2(includedAddOns.reduce((s, a) => s + a.total, 0));
  const subtotal      = r2(appliedPrice + addOnsTotal);
  const tax           = r2(subtotal * 0.15);
  const total         = r2(subtotal + tax);
  const depositAmount = r2(total * 0.10);

  const requiredAddOns = includedAddOns.filter(a => a.isRequired);

  return {
    packagePrice,
    minimumSpend,
    appliedPrice,
    addOns: includedAddOns,
    addOnsTotal,
    requiredAddOns,
    subtotal,
    tax,
    total,
    depositAmount,
    isOutOfParameters,
    outOfParameterReasons,
  };
}
