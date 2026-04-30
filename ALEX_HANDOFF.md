# FESTV — Dev Handoff for Alex
**April 28, 2026**

---

## What happened today

We did a major architectural overhaul. The old flat `Service` model is gone. FESTV now runs on a **package-based pricing engine** — the foundation for auto-generated quotes and real-time price calculation.

---

## What got replaced

| Old | New |
|-----|-----|
| `Service` | `Package` + `AddOn` |
| `PricingLevel` | `SeasonalPricingRule` + `DayOfWeekPricingRule` |
| `Quote` (flat) | `Quote` (auto-generated or manual, versioned) |
| `Booking` (flat) | `Booking` (tied to a Package + Quote) |
| `EventRequest` (flat) | `EventRequest` (package-aware, with calculated estimate) |

---

## New schema — key models

**`Package`** — the main bookable unit per vendor
- Has `pricingModel` (PER_PERSON / FLAT_RATE / PER_HOUR)
- Has `basePrice`, `minimumSpend`, `minGuests`, `maxGuests`, `durationHours`
- Has `weekdayPrice` / `weekendPrice` overrides
- Linked to `SeasonalPricingRule[]` and `DayOfWeekPricingRule[]`
- Linked to `AddOn[]` via `_PackageAddOns` join table

**`SeasonalPricingRule`** — date range price overrides
- `startMonth/startDay → endMonth/endDay`
- Can override `priceOverride`, `minimumSpendOverride`, or apply a `multiplier`
- Handles year-wrap (e.g. Nov 1 → Mar 31)

**`DayOfWeekPricingRule`** — day of week price overrides
- `days: DayOfWeek[]` (MONDAY through SUNDAY)
- Can override `priceOverride` or `minimumSpendOverride`

**`AddOn`** — à la carte extras
- `pricingType`: FLAT / PER_PERSON / PER_HOUR
- `isRequired: true` → auto-included in every estimate
- Can be linked to specific packages or available with any package

**`AvailabilityBlock`** — vendor-managed date blocking
- `startDate / endDate`
- `reason`: BOOKED_EXTERNAL / CLOSED / PERSONAL / MAINTENANCE

---

## Pricing engine

`backend/src/services/pricingEngine.ts` — the core service.

Call it like this:
```typescript
import { calculatePackagePrice } from '../services/pricingEngine';

const result = await calculatePackagePrice({
  packageId: 'uuid',
  eventDate: new Date('2026-07-11'),
  guestCount: 150,
  durationHours: 5,
  selectedAddOnIds: []
});
```

Returns:
```typescript
{
  packagePrice,       // raw calculated price
  minimumSpend,       // floor that applies
  appliedPrice,       // Math.max(packagePrice, minimumSpend)
  addOns,             // all included add-ons (required ones auto-included)
  addOnsTotal,
  subtotal,
  tax,                // 15%
  total,
  depositAmount,      // 10% of total
  isOutOfParameters,  // true if guest count or date violated package rules
  outOfParameterReasons
}
```

**Calculation order:**
1. Load package + rules + add-ons
2. Check parameters (guest count bounds, availability blocks, existing bookings)
3. Apply day-of-week rule (price + minimum spend override)
4. Apply seasonal rule (stacks on top — seasonal minimum spend wins)
5. Apply pricing model (PER_PERSON × guests, FLAT_RATE as-is, PER_HOUR × hours)
6. Enforce minimum spend: `appliedPrice = Math.max(packagePrice, minimumSpend)`
7. Calculate add-ons (required ones auto-included regardless of selection)
8. Subtotal → 15% tax → total → 10% deposit

**Proven working** — tested against Estelle venue:
- Saturday July → DOW rule → $45k min spend → $52,152.50 total ✅
- Wednesday January → Seasonal rule → $30k min spend → $34,902.50 total ✅

---

## New API endpoints

### Packages
```
POST   /api/v1/packages                          — create package (vendor)
GET    /api/v1/packages/me                       — get my packages (vendor)
GET    /api/v1/packages/:id                      — get package (public)
PUT    /api/v1/packages/:id                      — update package (vendor)
DELETE /api/v1/packages/:id                      — delete package (vendor)
PATCH  /api/v1/packages/:id/toggle               — toggle isActive (vendor)
PATCH  /api/v1/packages/reorder                  — reorder packages (vendor)
POST   /api/v1/packages/:id/seasonal-rules       — add seasonal rule
PUT    /api/v1/packages/:id/seasonal-rules/:rid  — update seasonal rule
DELETE /api/v1/packages/:id/seasonal-rules/:rid  — delete seasonal rule
POST   /api/v1/packages/:id/dow-rules            — add day-of-week rule
PUT    /api/v1/packages/:id/dow-rules/:rid       — update day-of-week rule
DELETE /api/v1/packages/:id/dow-rules/:rid       — delete day-of-week rule
POST   /api/v1/packages/estimate                 — get price estimate (public)
```

### Add-ons
```
POST   /api/v1/addons                — create add-on (vendor)
GET    /api/v1/addons/me             — get my add-ons (vendor)
PUT    /api/v1/addons/:id            — update add-on (vendor)
DELETE /api/v1/addons/:id            — delete add-on (vendor)
```

### Availability
```
POST   /api/v1/availability          — block a date range (vendor)
GET    /api/v1/availability/me       — get my blocks (vendor)
DELETE /api/v1/availability/:id      — delete block (vendor)
GET    /api/v1/availability/check    — check if date is available (public)
```

### Event Requests
```
POST   /api/v1/event-requests                    — create request (planner)
GET    /api/v1/event-requests/me/client          — my requests as planner
GET    /api/v1/event-requests/me/vendor          — my requests as vendor
GET    /api/v1/event-requests/incoming           — vendor inbox (paginated)
GET    /api/v1/event-requests/:id                — get request (owner only)
PATCH  /api/v1/event-requests/:id/status         — decline / expire
```

### Quotes
```
POST   /api/v1/quotes/auto-generate  — auto-generate from pricing engine (vendor)
POST   /api/v1/quotes/manual         — create manual quote (vendor)
GET    /api/v1/quotes/me/vendor      — my quotes as vendor
GET    /api/v1/quotes/me/client      — my quotes as planner
GET    /api/v1/quotes/:id            — get quote (owner only)
POST   /api/v1/quotes/:id/accept     — accept quote → creates Booking (planner)
POST   /api/v1/quotes/:id/reject     — reject quote (planner)
POST   /api/v1/quotes/:id/revise     — create new version (vendor)
```

### Bookings
```
GET    /api/v1/bookings/me/client        — my bookings as planner
GET    /api/v1/bookings/me/vendor        — my bookings as vendor
GET    /api/v1/bookings/upcoming         — upcoming confirmed bookings (vendor)
GET    /api/v1/bookings/stats            — booking stats (vendor)
GET    /api/v1/bookings/:id              — get booking (owner only)
PATCH  /api/v1/bookings/:id/deposit-paid — mark deposit received (vendor)
PATCH  /api/v1/bookings/:id/confirm      — confirm booking (vendor)
PATCH  /api/v1/bookings/:id/complete     — mark completed (vendor)
PATCH  /api/v1/bookings/:id/cancel       — cancel (vendor or planner)
PATCH  /api/v1/bookings/:id/approve      — approve out-of-parameters (vendor)
```

---

## Flow

```
Planner browses vendors (GET /providers/search)
↓
Picks vendor → sees packages grouped by category (GET /providers/:id/packages)
↓
Picks package + date + guests + add-ons
↓
Gets real-time estimate (POST /packages/estimate)
↓
Sends request (POST /event-requests)
↓
Within parameters → vendor hits auto-generate (POST /quotes/auto-generate)
Out of parameters → vendor creates manual quote (POST /quotes/manual)
↓
Planner accepts quote (POST /quotes/:id/accept) → Booking created (PENDING_DEPOSIT)
↓
Vendor marks deposit paid (PATCH /bookings/:id/deposit-paid) → CONFIRMED
↓
Event happens → vendor marks complete (PATCH /bookings/:id/complete)
```

---

## What still needs to be built

- **Vendor setup UI** — `vendorsetup.html` needs full rebuild around packages (currently still wired to old Service model)
- **Vendor profile UI** — `vendorprofile.html` needs to display packages grouped by category
- **Browse vendors UI** — `browsevendors.html` needs package-aware search filters
- **Create event UI** — `createevent.html` needs to let planners pick packages + add-ons
- **Quote/booking dashboards** — both planner and vendor dashboards need rewiring
- **Admin approval flow** — `admindashboard.html` vendor verification not yet wired
- **Stripe** — deposit payment not connected
- **Cloudinary** — image uploads not set up

---

## Key gotchas

- `main` branch deploys to production (`festv.org` / `caterease-api` on Render). Always merge `dev → main` to deploy.
- Never read vendorType from localStorage — always fetch from `GET /api/v1/providers/profile/me`
- `providerTypes[]` always includes `primaryType` — never send one without the other
- Quotes are immutable — never update an existing quote, always create a new version
- `isOutOfParameters: true` on a booking → goes to `PENDING_REVIEW` status, vendor must approve manually
- Read `FESTV_CONTEXT.md` at the start of every session for full project context
