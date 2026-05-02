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
- **Stripe deposit payments** — Stripe Connect Express for vendor bank onboarding; Stripe Checkout Sessions for planner deposits; webhook auto-confirms bookings on payment; lazy init so server starts without keys. BookingDetail has "Pay Deposit" button wired to Checkout Session. ProviderDashboard shows Connect banner until account active.
- **Favorites** — heart button on every vendor card (BrowseProviders + ProviderProfile hero/sticky nav); CLIENT only, optimistic toggle, toast for guests; Saved Vendors in ClientDashboard with real API, initials, city, unsave ×.
- **Portfolio & Inspiration Feed** — `/feed` page with masonry grid of shared posts. Vendors post photos linked to packages. Planners post photos and tag confirmed-booking vendors. Private-first: posts default to private, owners toggle `sharedToFeed`. Like, save (bookmark), vendor tag chips with vendor reply quotes (Cormorant italic, gold left border). `PortfolioCard` + `PostComposer` components. Full backend: `portfolioController.ts` with `POST_INCLUDE` shared constant, `PortfolioPost` + `PortfolioVendorTag` models, portfolio-image Cloudinary upload. Jess knows about the feed and messaging (system prompt updated).
- **API hardening** — reviews endpoint standardised to `{ data: [], meta: { stats, pagination } }`; EventRequest booking flattened onto all GET responses; pricingEngine UUID validation (400 before DB hit); CORS scoped to `/api` only (static assets served before CORS, fixes blank page).
- Cloudinary image uploads (logo, banner, package images)
- 6 transactional emails via Resend (vendor approved/rejected, new request, quote received, booking confirmed, deposit confirmed)
- Jess with conversational booking (4 live tools, city filter fixed, packageId hallucination prevented)
- 5 test vendors live and verified in production
- Framer Motion v10 animations on Landing (hero + scroll reveals). Root cause of past failures: `AnimatePresence initial={false}` kills all child animations — removed from Layout.tsx.
- Event grouping — "Plan an Event" as primary CTA
- **Polished post-acceptance moments** — BookingDetail: spring-animated CheckCircle, serif confirmed headline, "What Happens Next" 3-step timeline. QuoteDetail: gold shimmer bar, deposit card, "Go to Booking →".
- Zero TypeScript errors across all backend and frontend files.

---

## What's Still to Build
1. **Stripe end-to-end test** — keys added to Render; verify real deposit payment planner → vendor
2. **End-to-end flow test** — Jess → request → instant quote → accept → BookingDetail → Pay Deposit (verify on festv.org)
3. Mobile responsiveness pass
4. Messaging frontend (messageController + routes live; Jess knows about it; no UI yet)
5. rejectionReason field in schema
6. New production database before real launch (no test accounts)
7. OAuth (Google/Facebook login)
8. SMS verification

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
- **CORS must be scoped to `/api` only** — global CORS intercepts static asset requests and returns 500 with `application/json` MIME type → blank page. Static files must be registered before CORS middleware.
- **Render build command must NOT end with `npm run build`** — runs frontend Vite build twice; second pass uses `emptyOutDir:true` and can wipe `react-dist`.
- **Stripe is lazy-initialized** — `getStripe()` not `stripe`. Server starts without `STRIPE_SECRET_KEY`; endpoints throw 500 if called without it.
- **`favoritesApi` uses `providerId` in URL** — `DELETE /favorites/:providerId` not `/:favoriteId`.
- **`getMyFavorites` response**: parse as `d?.data?.favorites` — not `d?.data` (which is the pagination wrapper object).
- **`User.providerProfiles` is plural** — the relation is `providerProfiles ProviderProfile[]`. Use `take: 1` in Prisma nested select and `[0]` on the frontend. Selecting `providerProfile` (singular) silently returns nothing.
- **`POST_INCLUDE` in portfolioController is the single source of truth** — all portfolio responses share this constant. Add fields here or they will never be returned, even if correctly stored in DB.
- **Portfolio posts are private by default** — `sharedToFeed: false` on create. Public feed only returns `sharedToFeed: true` posts.

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
