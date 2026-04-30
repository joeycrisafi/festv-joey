# FESTV — In a Nutshell

---

## What FESTV is
A luxury event-planning marketplace. Planners browse verified vendors, see real package pricing with instant estimates, send requests, receive quotes, and book with a deposit. Vendors create structured packages with seasonal and day-of-week pricing rules. No "contact for pricing" — everything is transparent upfront.

---

## The Core Innovation
The pricing engine. Vendors define their rules once. The platform calculates real prices automatically. A planner picks a date, guest count, and add-ons — FESTV shows the exact price including tax and deposit before they ever contact the vendor. Auto-generated quotes mean vendors don't do math — they just approve.

---

## The Two Flows

**Flow A — Quick booking:**
Browse vendors → view profile → get price estimate (no login needed) → sign in / create account → send request → **quote auto-generated instantly** → accept → pay deposit → confirmed.

**Flow B — Full event planning:**
Sign in / create account → "Plan an Event" → name it, pick date/type/guests, select vendor categories needed → browse and add vendors for each category → all requests linked to the event → dashboard shows everything grouped under one event.

---

## Jess
AI event hostess powered by Claude (haiku). Lives as a floating widget on every page. Knows everything about FESTV — pricing models, vendor types, the full flow. Has 4 live tools that execute server-side:
- `search_vendors` — real Prisma query, returns verified vendors with prices and profile links. City filter queries the `User` model (not `ProviderProfile`).
- `get_price_estimate` — calls the actual pricing engine, returns full breakdown. packageId must be an exact UUID from search results — never guessed.
- `create_event_request` — creates the DB row, fires notifications and emails. For standard requests, the backend auto-generates a quote immediately so Jess can tell the planner their quote is ready.
- `create_event` — creates an Event and returns the planning hub URL

Jess can book vendors through conversation. Eventually she'll handle the entire planning flow through chat.

---

## Vendor Setup Flow
Register → 6-step wizard (business profile → event types → auto-generated packages → add-ons → availability calendar → preview & publish) → admin approves → VERIFIED → appears in search. Packages auto-generate based on vendor type + selected event types. No blank screens.

---

## Pricing Models
- `PER_PERSON` — price × guest count
- `FLAT_RATE` — fixed price
- `PER_HOUR` — price × hours
- `FLAT_PLUS_PER_PERSON` — room rental fee + per person rate

On top of base price: seasonal rules (date ranges with price overrides or multipliers) and day-of-week rules (weekends cost more). Minimum spend is a floor. Tax is 15%. Deposit is 10%.

---

## 5 Vendor Types
- `RESTO_VENUE` — restaurants, private dining, full venue buyouts
- `CATERER` — off-site catering, plated dinners, buffets
- `ENTERTAINMENT` — DJs, live bands, MCs, photo booths
- `PHOTO_VIDEO` — photography, videography, same-day edits
- `FLORIST_DECOR` — floral installations, centerpieces, styling

---

## What's Fully Built and Live at festv.org
- React frontend deployed (Landing, Browse, Vendor Profile, Login, Register, Vendor Setup, Vendor Dashboard, Client Dashboard, Admin Approval, Quote Detail, Booking Detail, Create Event, Event Detail, Event Request Detail, Vendor Packages, Vendor Availability)
- Full pricing engine with seasonal + DOW rules (proven: Estelle Saturday July = $52,152.50 ✅)
- **Auto-quote generation** — standard requests instantly get a Quote (SENT, 7-day expiry), EventRequest moves to QUOTE_SENT, client emailed. Out-of-parameters stays PENDING for vendor.
- **API hardening** — reviews endpoint standardised to `{ data: [], meta: { stats, pagination } }`; EventRequest booking flattened onto all GET responses; pricingEngine UUID validation (400 before DB hit); CORS accepts both festv.org domains
- Cloudinary image uploads (logo, banner, package images)
- 6 transactional emails via Resend (vendor approved/rejected, new request, quote received, booking confirmed, deposit confirmed)
- Jess with conversational booking (4 live tools, city filter fixed, packageId hallucination prevented)
- 5 test vendors live and verified in production
- Framer Motion v10 animations on Landing (hero + scroll reveals). Root cause of past failures: `AnimatePresence initial={false}` kills all child animations — removed from Layout.tsx.
- Event grouping — "Plan an Event" as primary CTA

---

## What's Still to Build
1. **End-to-end flow test** — Jess → request → instant quote → accept → booking (verify on festv.org)
2. Stripe — deposit payments (currently "contact vendor to arrange")
3. Mobile responsiveness pass
4. rejectionReason field in schema
5. New production database before real launch (no test accounts)
6. OAuth (Google/Facebook login)
7. SMS verification

---

## Critical Gotchas
- Token key is `accessToken` in localStorage — NOT `token`
- `rounded-md` not `rounded-2xl` — editorial not bubbly
- Render deploys from `main` only — always merge dev → main. Build Filters must include `frontend/**` or frontend changes won't trigger a redeploy.
- `appliedPrice` is the displayed price — not `basePrice`
- `verificationStatus: 'VERIFIED'` filter is ACTIVE in production
- Quotes are immutable — never update, always create new version
- `EventRequest.booking` is flattened on all API responses — no need to traverse quotes
- Reviews API: `{ data: reviews[], meta: { stats, pagination } }` — parse as `data.data` for the array
- Both databases exist on Render — always use `caterease-db` not `festv_db`
- React build outputs to `backend/public/react-dist/` — Express serves it as catch-all
- **framer-motion must stay at v10** — v12 WAAPI bug skips `initial` state. Never upgrade.
- **`AnimatePresence initial={false}` kills all descendant animations** — Layout.tsx uses `<AnimatePresence mode="wait">` only, no `initial` prop.
- **Jess city filter** — `city` is on `User`, not `ProviderProfile`. Filter: `where: { user: { city: { contains: ... } } }`
- **pricingEngine rejects non-UUID packageIds** — throws 400 before any DB query. Pass real UUIDs from search results only.
- **CORS covers both festv.org and www.festv.org** — derived automatically from `CORS_ORIGIN` env var in `backend/src/index.ts`

---

## The Stack
Node/Express/TypeScript + Prisma/PostgreSQL backend. React 18/Vite/TailwindCSS frontend. Cloudinary for images. Resend for email. Anthropic SDK for Jess. Deployed on Render. GitHub: `festv-org/festv-joey`, deploys from `main`.

---

## Design System
- Colors: gold (#C4A06A), dark (#1A1714), charcoal (#3A3530), muted (#7A7068), bg (#F5F3EF)
- Fonts: Cormorant Garamond (headings/prices) + Montserrat (UI/labels)
- Cards: `border border-border rounded-md` — no shadows by default
- Page body: `bg-bg` with white cards floating — no alternating section backgrounds
- Philosophy: luxury, editorial, breathing not performing
