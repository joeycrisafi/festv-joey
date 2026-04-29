# FESTV — Project Context (Claude Quick-Start)

> Read this file at the start of any new session to get up to speed fast.

---

## What is FESTV?

FESTV is a luxury event-planning marketplace that connects event planners (clients) with vendors — restaurants, caterers, entertainment, photographers, and florists. Planners browse vendors, see real package pricing, send requests, receive quotes, and book vendors with a deposit. Vendors manage their profile, packages, incoming requests, and bookings through a dedicated dashboard.

---

## Tech Stack

### Backend (`/backend/`)
| Tool | Version | Purpose |
|------|---------|---------|
| Node.js + Express | 4.18.3 | HTTP API server |
| TypeScript | 5.3.3 | Language |
| Prisma | 5.10.0 | ORM + migrations (PostgreSQL) |
| Zod | 3.22.4 | Request validation schemas |
| jsonwebtoken | 9.0.2 | JWT auth (access 7d + refresh 30d) |
| bcryptjs | 2.4.3 | Password hashing (12 rounds) |
| @anthropic-ai/sdk | 0.39.0 | Jess AI widget + PDF import |
| Resend | 6.9.3 | Email delivery |
| Multer + multer-storage-cloudinary | — | Multipart file uploads → Cloudinary |
| cloudinary | 1.x (NOT v2) | Image hosting — logo, banner, package images |
| Socket.io | 4.7.4 | Real-time (configured, partially used) |
| pdf-parse | 1.1.1 | PDF text extraction |

### Frontend — TWO frontends exist

**Active React frontend (`/frontend/`)** — This is the primary UI under active development.
- React 18 + Vite + TypeScript + TailwindCSS + React Router v6
- FESTV design system applied (gold palette, Cormorant Garamond + Montserrat)
- Dev server: `cd frontend && npm run dev` → http://localhost:3000
- API proxy: points to `festv.org` (live backend)
- Auth token key: `accessToken` in localStorage

**Legacy HTML frontend (`/backend/public/`)** — Old UI, still served by Express but being replaced by React.
- Plain HTML + CSS + vanilla JS
- Still live at festv.org until React build is deployed
- Do not add new features here

### Deployment
- Deployed on **Render** (`caterease-api` service, `prod` project)
- GitHub: `festv-org/festv-joey`, deploys from `main` branch
- Build command: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
- Start: `npm start` (runs `tsx src/index.ts`)
- Database: PostgreSQL (`caterease-db`) on Render
- Live URL: `festv.org`
- **CRITICAL: Render deploys from `main` only. Push to `dev` does NOT deploy. Always merge dev → main to deploy.**

---

## React Frontend Structure (`/frontend/src/`)

```
frontend/src/
├── main.tsx                 ← Entry point
├── App.tsx                  ← Routes
├── index.css                ← Google Fonts + FESTV component styles
├── context/
│   └── AuthContext.tsx      ← Auth state, login, logout, register
├── components/
│   ├── Layout.tsx           ← Nav shell (FESTV branded, dark footer)
│   ├── ProviderTypeBadge.tsx ← Vendor type badge (5 canonical types, FESTV colors)
│   └── ImageUpload.tsx      ← Reusable image uploader (full zone + compact pill mode; posts to /upload/logo|banner|package-image)
├── pages/
│   ├── Landing.tsx          ← ✅ Built — hero, why FESTV, how it works, vendor types + Framer Motion animations
│   ├── BrowseProviders.tsx  ← ✅ Built — filter sidebar + vendor cards grid; reads ?eventId= param, shows context banner
│   ├── ProviderProfile.tsx  ← ✅ Built — dark hero, packages, estimator, about, reviews; reads eventId from state/param
│   ├── Login.tsx            ← ✅ Built — FESTV branded login card
│   ├── Register.tsx         ← ✅ Built — role selector, vendor type pills, form
│   ├── VendorSetup.tsx      ← ✅ Built — 6-step wizard (see below); Step 1 includes logo + banner ImageUpload
│   ├── VendorPackages.tsx   ← ✅ Built — full package + add-on management; inline edit, active toggle, seasonal/DOW rules, ImageUpload
│   ├── VendorAvailability.tsx ← ✅ Built — 2-month calendar date-blocking; batch save (diff local vs API), bulk actions
│   ├── ProviderDashboard.tsx ← ✅ Built — vendor dashboard with requests, bookings, stats
│   ├── ProviderProfile.tsx  ← ✅ Built — owner can edit logo + banner via compact ImageUpload overlays
│   ├── ClientDashboard.tsx  ← ✅ Built — My Events section, vendor requests, quick actions
│   ├── CreateEvent.tsx      ← ✅ Built — form: name/type/date/guests/notes + vendor-type multi-select; saves to /events
│   ├── EventDetail.tsx      ← ✅ Built — event header, vendor rows (Browse CTA or status+link), total estimate, notes
│   └── [other pages]        ← scaffolded, need rewiring to new schema
└── utils/
    └── api.ts               ← All API endpoint wrappers (updated to new routes)
```

### React Routes (App.tsx)
```
/ → Landing
/login → Login
/register → Register
/providers → BrowseProviders (public)
/providers/:id → ProviderProfile (public)
/dashboard → ClientDashboard (CLIENT role)
/events/new → CreateEvent (CLIENT role)
/events/:id → EventDetail (CLIENT role)
/provider/dashboard → ProviderDashboard (PROVIDER role)
/vendor/setup → VendorSetup (PROVIDER role)
/vendor/packages → VendorPackages (PROVIDER role) ← full package + add-on manager
/vendor/availability → VendorAvailability (PROVIDER role) ← calendar date-blocking
/bookings/:id → BookingDetail
/event-requests/:id → EventRequestDetail
... (other routes scaffolded)
```

---

## Package-Based Pricing Engine

This is the core of FESTV. Everything revolves around structured packages.

### Key Models
- **Package** — the main bookable unit. Has `pricingModel`, `basePrice`, `minimumSpend`, `minGuests`, `maxGuests`, `durationHours`, `flatFee` (for FLAT_PLUS_PER_PERSON), `included[]`, `eventTypes[]`, `category`, `isActive`
- **SeasonalPricingRule** — date range overrides per package (startMonth/Day → endMonth/Day, priceOverride, minimumSpendOverride, multiplier)
- **DayOfWeekPricingRule** — day of week overrides per package (days[], priceOverride, minimumSpendOverride)
- **AddOn** — à la carte extras (pricingType: FLAT/PER_PERSON/PER_HOUR, isRequired, applicablePackageIds[])
- **AvailabilityBlock** — vendor-managed date blocking (startDate, endDate)
- **Package.imageUrl** — optional Cloudinary URL for package hero image (added in migration 20260429_add_package_image_url)
- **Event** — top-level planning object. Fields: id, clientId (FK→User), name, eventType (EventType enum), eventDate, guestCount, notes?, status (EventStatus: PLANNING|CONFIRMED|COMPLETED|CANCELLED, default PLANNING), requests[], createdAt, updatedAt. Indexes on clientId, eventDate, status.
- **EventRequest** — planner's request (packageId, eventType, eventDate, guestCount, selectedAddOnIds, calculatedEstimate, isOutOfParameters, eventId? FK→Event SET NULL on delete)
- **Quote** — auto-generated or manual, versioned (immutable history), addOns as JSON, adjustments as JSON
- **Booking** — created from accepted quote (status: PENDING_DEPOSIT → DEPOSIT_PAID → CONFIRMED → COMPLETED)

### Pricing Models
```
PricingModel: PER_PERSON | FLAT_RATE | PER_HOUR | FLAT_PLUS_PER_PERSON
```
- `FLAT_PLUS_PER_PERSON` → packagePrice = flatFee + (basePrice × guestCount) — for venues charging room rental + per person F&B minimum

### Pricing Engine (`backend/src/services/pricingEngine.ts`)
Core function: `calculatePackagePrice({ packageId, eventDate, guestCount, durationHours, selectedAddOnIds })`

Calculation order:
1. Fetch package + seasonal rules + DOW rules + add-ons
2. Check parameters (guest bounds, availability blocks, existing bookings) → sets isOutOfParameters
3. Start with basePrice + minimumSpend from package
4. Apply DOW rule (priceOverride or minimumSpendOverride)
5. Apply seasonal rule (stacks on top — seasonal minimumSpend wins over DOW)
6. Apply pricing model (PER_PERSON × guests, FLAT_RATE, PER_HOUR × hours, FLAT_PLUS_PER_PERSON)
7. appliedPrice = Math.max(packagePrice, minimumSpend)
8. Calculate add-ons (required ones auto-included)
9. subtotal → 15% tax → total → 10% deposit (all rounded to 2dp)

Returns `PricingResult` with: packagePrice, minimumSpend, appliedPrice, addOns[], addOnsTotal, subtotal, tax, total, depositAmount, isOutOfParameters, outOfParameterReasons[]

**Proven working:** Estelle Saturday July → $45k min spend → $52,152.50 total ✅ | Wednesday January → $30k min spend → $34,902.50 total ✅

### Flow
```
Planner browses /providers (public, package-aware search)
↓
Clicks vendor → /providers/:id (public)
↓
Picks package + date + guests + add-ons
↓
Sees real-time price estimate (POST /packages/estimate — public, no auth)
↓
Sends EventRequest (requires auth)
↓
Within parameters → vendor auto-generates Quote
Out of parameters → vendor creates manual Quote
↓
Planner accepts Quote → Booking created (PENDING_DEPOSIT)
↓
Vendor marks deposit paid → CONFIRMED
↓
Event → vendor marks COMPLETED
```

---

## API Routes (`/api/v1`)

| Prefix | Notes |
|--------|-------|
| `/auth` | register, login, refresh, forgot/reset password, me |
| `/providers` | profile CRUD, search (package-aware, VERIFIED-only — temporarily disabled for dev), `GET /providers/:id/packages` (public, grouped by category) |
| `/packages` | Package CRUD + seasonal/DOW rules + `POST /packages/estimate` (public) |
| `/addons` | AddOn CRUD |
| `/availability` | AvailabilityBlock CRUD + `GET /availability/check` (public) |
| `/events` | create (CLIENT), GET /me (CLIENT), GET /:id (CLIENT), PUT /:id (CLIENT) — top-level planning objects grouping vendor requests |
| `/event-requests` | create (accepts optional eventId to link to Event), incoming (vendor), me/client, me/vendor, status updates |
| `/quotes` | auto-generate, manual, accept (creates Booking), reject, revise |
| `/bookings` | full lifecycle + stats + upcoming |
| `/reviews` | `GET /reviews/provider/:id` returns `{ data: { reviews[], stats, pagination } }` |
| `/notifications` | user notification feed |
| `/jess` | Jess AI chat |
| `/pdf-import` | PDF → Claude extracts services/menu |
| `/upload` | `POST /upload/logo`, `/upload/banner`, `/upload/package-image` — Cloudinary uploads (requireProvider) |
| `/admin` | admin operations (verify/reject vendors) |
| `/verification` | email verification codes |

---

## Design System

### CSS Variables (apply in both React Tailwind config and HTML pages)
```css
--gold: #C4A06A      /* Primary brand */
--gold-light: #D9BF8C
--gold-dark: #9C7A45
--bg: #F5F3EF        /* Page background — warm off-white */
--dark: #1A1714      /* Near-black */
--charcoal: #3A3530  /* Body text */
--muted: #7A7068     /* Secondary text */
--border: rgba(0,0,0,0.09)
--green: #3A8A55
--red: #B84040
```

### Tailwind Config (React)
```js
colors: {
  gold: { DEFAULT: '#C4A06A', light: '#D9BF8C', dark: '#9C7A45' },
  bg: '#F5F3EF', dark: '#1A1714', charcoal: '#3A3530',
  muted: '#7A7068', green: '#3A8A55', red: '#B84040'
}
fontFamily: { sans: ['Montserrat'], serif: ['Cormorant Garamond'] }
```

### Visual Language
- Luxury, editorial, warm neutrals
- Cards: `border border-border rounded-md` (6px — tight, editorial) NOT rounded-2xl
- No hard shadows — `shadow-sm` only on hover
- Gold used sparingly as accent
- Dark hero sections (`bg-dark`) for vendor profiles and CTAs
- Page body: `bg-bg` with white cards floating on it (NOT alternating section backgrounds)
- Typography: Cormorant Garamond for headings/prices, Montserrat for UI/labels
- Section eyebrows: `font-sans text-xs font-bold tracking-widest uppercase text-charcoal`
- Prices: `font-serif text-xl text-gold-dark font-semibold` (restrained, not huge)

---

## Vendor Setup Wizard (`/vendor/setup`) — 6 Steps

The most important vendor-facing page. Guided, no blank screens, auto-saves to localStorage.

**Step 1 — Your Business:** Profile info, primary + secondary vendor types, languages, budget range. Fetches existing profile to pre-fill. POST/PUT `/providers/profile` on Continue.

**Step 2 — Your Events:** Multi-select event types (WEDDING, CORPORATE, BIRTHDAY etc.). Drives auto-generation in Step 3. No API call.

**Step 3 — Your Packages:** Auto-generates starter packages from template library based on primaryType + selected eventTypes. Packages are fully inline-editable with:
- Name, category, pricing model toggle (PER_PERSON / FLAT_RATE / PER_HOUR / FLAT_PLUS_PER_PERSON)
- Base price + flat fee (for FLAT_PLUS_PER_PERSON: shows two inputs — "Flat room fee" + "Per person rate")
- Minimum spend, guest range, duration, included items chip editor
- Type-specific expanded fields (▼ More details):
  - RESTO_VENUE: food service, drinks, staff count, venue type, AV toggle
  - CATERER: food service, dietary options, staff, equipment/setup toggles
  - ENTERTAINMENT: genre tags, equipment included, min hours, overtime rate
  - PHOTO_VIDEO: style tags, delivery timeline, edited photos count, RAW files, travel fee
  - FLORIST_DECOR: style tags, setup/breakdown, rental items, delivery toggles
- Seasonal pricing rules (name, date range, min spend override, price override, multiplier)
- Day-of-week pricing rules (day checkboxes, price override, min spend override)

**Step 4 — Add-ons:** Pre-suggested add-ons by vendor type (click chip to add). Each add-on: name, pricing type, price, isRequired toggle, "which packages" checkbox list. "Skip for now" available.

**Step 5 — Availability:** Click-to-block calendar (2 months shown). Bulk actions: block weekends, block next 30 days, clear all. "Skip for now" available.

**Step 6 — Preview & Publish:** Read-only preview of listing, example price simulation, checklist (profile complete, ≥1 package, prices set). Sequential API calls on submit: PUT profile → POST packages → POST seasonal rules → POST DOW rules → POST addons → POST availability blocks. Clears localStorage on success. Navigates to /provider/dashboard.

Auto-saves entire wizard state to localStorage key `festv_vendor_setup` on every change.

---

## Vendor Dashboard (`/provider/dashboard`)

- Pending approval banner (bg-dark) if verificationStatus !== VERIFIED
- "Good morning/afternoon/evening [firstName]" greeting + date
- Left (2/3): Incoming Requests feed + Upcoming Bookings
- Right (1/3): Overview stats (total/confirmed/completed/revenue) + Awaiting Response quotes + Quick Actions dark card
- Request cards show event type, client name, guest count, estimated value, auto-generate/decline actions
- Booking cards show date block (gold), event type, client, status badge, total

---

## Auth Flow (React)

AuthContext (`/frontend/src/context/AuthContext.tsx`):
- Token stored as `accessToken` in localStorage (NOT `token`)
- On mount: calls `GET /auth/me` to rehydrate
- Roles: CLIENT (planners), PROVIDER (vendors), ADMIN

User status flow:
- `PENDING_VERIFICATION` → email verified → `ACTIVE`
- `ProviderProfile.verificationStatus` → admin approves → `VERIFIED` (separate from User.status)

---

## Strategic Decisions Made

### Product Vision
- FESTV is "Airbnb for event planning" — structured packages, real pricing, instant estimates
- Planners can browse and get price estimates WITHOUT logging in (public endpoints)
- Sign-up wall only hits when they try to send a request
- This transparency IS the product differentiator — "no contact for pricing"

### Pricing Philosophy
- Packages are the primary unit, not services
- Auto-generated quotes based on pricing rules — no manual quote creation for standard requests
- Out-of-parameters requests (outside guest bounds, blocked dates) go to vendor for manual quote
- Minimum spend is a floor that overrides calculated price

### Vendor Setup UX Principles (from 3am brainstorm)
- Goal: vendor fully bookable in under 10 minutes
- No blank screens — everything pre-suggested, pre-filled, editable
- Auto-generate packages based on vendor type + event types selected
- Guided complexity — hide pricing rules behind expandable sections
- Type-specific guided inputs (not generic free text)
- Preview listing before publishing — builds vendor confidence

### Frontend Migration
- Moving from vanilla HTML to React (in progress)
- React frontend at `/frontend/` is now primary
- Old HTML pages at `/backend/public/` still serve festv.org until React build deployed
- Plan: finish core React pages → deploy React build → retire HTML pages

### Animations (✅ built on Landing.tsx)
- Library: Framer Motion
- Philosophy: breathing not performing — subtle, restrained, luxury feel
- Hero section: `animate` (on mount) — headline y:40/0.8s/delay:0.15, subheadline y:30/0.7s/delay:0.35, CTAs y:20/0.6s/delay:0.55, pills opacity/delay:0.7, gold rule delay:0.9
- All scroll sections: `whileInView` + `viewport={{ once: true, amount: 0.15 }}` — shared `inView` object: y:40, duration:0.7
- Feature cards stagger: delay 0.1 per card, vendor type cards same
- NOT planned: bouncing/spring physics, parallax, dramatic flying modals

### Service Categories (canonical per vendor type)
```
RESTO_VENUE: Venue Packages / Bar & Beverages / Food & Menu / Add-ons & Extras
CATERER: Bar & Beverages / Food & Menu / Add-ons & Extras
ENTERTAINMENT: Performance Packages / Equipment & Production / Add-ons & Extras
PHOTO_VIDEO: Coverage Packages / Production & Extras / Prints & Albums
FLORIST_DECOR: Design & Arrangements / Add-ons & Extras
```

---

## Current State

### ✅ React Pages Built
- Landing page — hero, why FESTV, how it works (tabbed), vendor type cards, vendor CTA; Framer Motion animations throughout (hero animate-on-mount, sections whileInView)
- Browse Vendors — filter sidebar, vendor cards, package-aware search; eventId context banner when browsing for a specific event
- Vendor Profile — dark hero, sticky nav, packages grouped by category, inline price estimator, about, reviews; passes eventId through to event request creation; owner can edit logo + banner via compact ImageUpload overlays
- Login — FESTV branded card
- Register — role selector, vendor type pills, password strength
- Vendor Setup — full 6-step wizard with auto-generated packages; Step 1 has logo + banner ImageUpload
- Vendor Packages (`/vendor/packages`) — full package manager: inline edit, active toggle, confirm delete, seasonal/DOW rule management, package ImageUpload, add-ons section
- Vendor Availability (`/vendor/availability`) — 2-month calendar date blocking, batch save, bulk actions (block weekends, block next 30 days, clear all), blocked ranges list
- Vendor Dashboard — requests, bookings, stats, quick actions
- Client Dashboard — My Events section (event cards with vendor booked count), quick actions, Plan a New Event CTA
- CreateEvent — name/type/date/guests/notes form + vendor-type multi-select grid; POSTs to /events, saves vendor types to localStorage, navigates to EventDetail
- EventDetail — event header with status badge, VendorRow components per vendor type (Browse CTA or request status + quote/booking links), total estimate, notes

### ✅ Backend Working
- Full package pricing engine with seasonal + DOW rules
- All 6 backend phases: packages, pricing engine, event requests, quotes, bookings, provider search
- FLAT_PLUS_PER_PERSON pricing model added
- Event model — top-level planning object: createEvent, getMyEvents, getEventById, updateEvent (all requireClient)
- verificationStatus filter re-enabled in search (VERIFIED only — commit 4c36388)
- Cloudinary image uploads — logo, banner, package-image endpoints (`/upload/*`); `backend/src/middleware/upload.ts` + `uploadController.ts`
- Transactional emails via Resend — `backend/src/services/emailService.ts`; 6 fire-and-forget functions wired into adminRoutes, eventRequestController, quoteController, bookingController

### 🟡 React Pages Partially Built / Scaffolded
- EventRequestDetail — scaffolded
- BookingDetail — scaffolded
- AdminProviderVerification — scaffolded

### ❌ Not Yet Built (React)
- Admin approval flow UI (backend routes exist: POST /admin/providers/:id/verify and /reject)
- Quote detail page
- Jess AI widget (React component — backend route still works)

### ❌ Not Started (Backend/Infra)
- Stripe deposit payment
- SMS verification
- OAuth (Google/Facebook)
- Mobile responsiveness pass
- rejectionReason field in ProviderProfile schema

---

## Key Gotchas

1. **React is now primary frontend** — `/frontend/` not `/backend/public/`. HTML pages are legacy.
2. **Render deploys from `main` only** — push to dev does NOT deploy. Always merge dev → main.
3. **Token key is `accessToken`** — NOT `token`. AuthContext uses `accessToken`.
4. **verificationStatus filter temporarily removed** from searchProviders for dev testing. Must re-enable before launch: uncomment `verificationStatus: 'VERIFIED'` in providerController.ts searchProviders.
5. **`EventRequest` has no direct `booking` relation** — traverse via `eventRequest.quotes[0].booking`.
6. **`ProviderProfile` has no `reviews` relation** — use `profile.totalReviews` (Int). Never `_count: { reviews }`.
7. **Reviews API response shape**: `GET /reviews/provider/:id` returns `{ data: { reviews[], stats, pagination } }` — parse as `data.reviews`.
8. **Package estimate response**: use `result.appliedPrice` (not `basePrice` or `packagePrice`) for the displayed price.
9. **providerTypes[] always includes primaryType** — never send one without the other.
10. **`getMyProfile` returns null not 404** for new vendors — handle gracefully.
11. **Two databases on Render** — always use `caterease-db`, not the orphaned `festv_db`.
12. **FLAT_PLUS_PER_PERSON** — new pricing model. flatFee + (basePrice × guestCount). Show two price inputs in UI.
13. **ProviderTypeBadge colors** — RESTO_VENUE: gold, CATERER: green, ENTERTAINMENT: charcoal, PHOTO_VIDEO: gold-light, FLORIST_DECOR: muted.
14. **Card border radius** — use `rounded-md` (6px) NOT `rounded-2xl` (16px). Editorial not bubbly.
15. **Section backgrounds** — page body is `bg-bg`, white cards float on it. Do NOT alternate full-width section backgrounds.
16. **localStorage key for vendor setup** — `festv_vendor_setup` stores the full wizard state for auto-save/restore.
17. **localStorage key for event vendor types** — `festv_event_vendors_needed_${eventId}` stores the array of vendor type strings selected in CreateEvent. EventDetail reads this to render VendorRow components. Not stored in DB — client-side only.
18. **eventId passthrough** — travels from BrowseProviders (`?eventId=` search param) → VendorCard → ProviderProfile via `location.state.eventId`. Also accepted as `?eventId=` fallback on ProviderProfile. Injected into `POST /event-requests` body to link the request to the Event.
19. **Event route ordering** — `GET /events/me` must be registered BEFORE `GET /events/:id` in eventRoutes.ts or the static segment is swallowed by the wildcard.
20. **`www.festv.org` vs `festv.org`** — always use `www.festv.org` for direct API calls. `festv.org` (no www) hits a CDN redirect that strips Authorization headers, causing 401s on protected routes.
21. **Cloudinary URL is on `req.file.path`** — NOT `.location` (S3) or `.url`. Cast as `(req.file as any).path`.
22. **`multer-storage-cloudinary@4.0.0` requires `cloudinary@^1.x`** — NOT v2. Import as `{ v2 as cloudinary } from 'cloudinary'`. `CloudinaryStorage` params must be typed as `any` to avoid TS conflicts.
23. **`ImageUpload` component has a `compact` prop** — `compact={true}` renders a small backdrop-blur pill button (no upload zone, no preview). Used for inline hero edits (e.g. "Edit Cover Photo" on ProviderProfile). Default is full drag-and-drop zone.
24. **Fire-and-forget email pattern** — all `emailService.ts` functions log on failure but never throw. Call as `sendXxx(...).catch(() => {})` and do NOT await. Email failure must never break an API response.
25. **Email vendor lookup in `createEventRequest`** — the vendor `providerProfile.findUnique` now includes `{ user: { select: { email: true } } }` so the vendor's email is available for `sendNewRequest`. Client email lookups in quoteController use a separate `prisma.user.findUnique` inside a `.then()` chain to stay fire-and-forget.

---

## Required Env Vars (Render → caterease-api)

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | Prisma |
| `JWT_SECRET` | Access token signing |
| `JWT_REFRESH_SECRET` | Refresh token signing |
| `RESEND_API_KEY` | Email (verification + transactional) |
| `ANTHROPIC_API_KEY` | Jess AI + PDF import |
| `CLOUDINARY_CLOUD_NAME` | Image uploads |
| `CLOUDINARY_API_KEY` | Image uploads |
| `CLOUDINARY_API_SECRET` | Image uploads |
| `CORS_ORIGIN` | CORS (set to `https://www.festv.org`) |
| `ADMIN_EMAILS` | Comma-separated admin email list |
| `ENABLE_TEST_ACCOUNTS` | `true` on dev service only — enables test account seeder |
| `TWILIO_ACCOUNT_SID` | SMS verification (not yet active) |
| `TWILIO_AUTH_TOKEN` | SMS verification (not yet active) |
| `TWILIO_PHONE_NUMBER` | SMS verification (not yet active) |
