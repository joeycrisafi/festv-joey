# FESTV — Project Context (Claude Quick-Start)

> Read this file at the start of any new session to get up to speed fast.

---

## What is FESTV?

FESTV is a luxury event-planning marketplace that connects event planners (clients) with vendors — restaurants, caterers, entertainment, photographers, and florists. Planners browse vendors, create event requests, receive quotes, and book vendors with a deposit. Vendors manage their profile, incoming requests, and bookings through a dedicated dashboard. There is also an AI assistant named **Jess** embedded site-wide as a chat widget.

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
| Multer + Sharp | — | File uploads + image processing |
| Socket.io | 4.7.4 | Real-time (configured, partially used) |
| pdf-parse | 1.1.1 | PDF text extraction |

### Frontend
There are **two** frontends. The active one is the static HTML frontend:

- **`/backend/public/`** — The real FESTV UI. Plain HTML + CSS + vanilla JS pages served by Express. All active development happens here.
- **`/frontend/`** — A legacy React/Vite/TailwindCSS SPA (React 18, React Router v6, Recharts). Still in the repo but **not the primary UI**. Treat it as a reference/scaffold.

### Deployment
- Deployed on **Render** (single web service)
- Render blueprint: `render.yaml` at both root and `/backend/`
- Build command: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
- Start: `npm start` (runs `tsx src/index.ts`)
- Database: PostgreSQL on Render free tier
- Live URL: `festv.org`

---

## Folder Structure

```
festv-joey/
├── backend/
│   ├── public/              ← ACTIVE UI — all HTML pages live here
│   │   ├── festv-index.html
│   │   ├── signin.html
│   │   ├── accounttype.html
│   │   ├── vendorsetup.html
│   │   ├── vendordashboard.html
│   │   ├── vendorprofile.html
│   │   ├── plannerdashboard.html
│   │   ├── plannerquote.html
│   │   ├── browsevendors.html
│   │   ├── createevent.html
│   │   ├── admindashboard.html
│   │   ├── forgotpassword.html
│   │   ├── friends.html
│   │   ├── *approval.html (6 files — vendor-type-specific booking approval pages)
│   │   ├── jess-widget.js   ← Shared: Jess AI FAB chat widget
│   │   ├── profile-menu.js  ← Shared: profile dropdown + auth state
│   │   └── auth-chip.js     ← Shared: auth token utilities
│   ├── src/
│   │   ├── index.ts         ← Server entry, middleware, static file serving
│   │   ├── config/
│   │   │   ├── index.ts     ← All env config (JWT, DB, uploads, CORS, Stripe)
│   │   │   └── database.ts  ← Prisma client singleton
│   │   ├── controllers/     ← Business logic (16 controllers)
│   │   ├── routes/          ← Express routers (17 files), all mounted at /api/v1
│   │   ├── middleware/
│   │   │   ├── auth.ts      ← authenticate, requireProvider, requireClient, requireAdmin
│   │   │   └── errorHandler.ts
│   │   ├── services/        ← Service layer (email, notifications, etc.)
│   │   ├── utils/
│   │   │   └── validators.ts ← All Zod schemas
│   │   └── types/index.ts   ← TypeScript interfaces
│   ├── prisma/
│   │   ├── schema.prisma    ← Full DB schema (all models + enums)
│   │   ├── seed.ts          ← DB seed script
│   │   └── migrations/      ← Migration history
│   └── package.json
├── frontend/                ← Legacy React SPA (not the active UI)
├── roadMap.txt              ← Project roadmap and completed task log
├── FESTV_CONTEXT.md         ← This file
└── README.md                ← Outdated (says "CaterEase") — ignore
```

---

## Pages & Routes

All pages are in `/backend/public/`. They use vanilla JS with `fetch()` calls to `/api/v1`.

| File | What it does |
|------|-------------|
| `festv-index.html` | Landing page — hero, how it works, sign in / get started CTAs |
| `signin.html` | Login form. Stores `accessToken`, `refreshToken`, `user` in localStorage |
| `accounttype.html` | Registration — choose Planner or Vendor, select vendor type, fill basic details (name, email, phone, city, password). No document uploads here — those are collected in vendorsetup Step 3. Submit button is gold, redirects to vendorsetup.html on success. |
| `vendorsetup.html` | Vendor onboarding — **3 steps total:** Step 1: business profile + primary/secondary vendor type. Step 2: services, pricing, and menu (PDF import or manual). Step 3: review & confirm + verification doc uploads + submit for approval. |
| `vendordashboard.html` | Vendor's main dashboard — Booked Events, Incoming Requests, Analytics, Messages, Services & Pricing, Portfolio. Shows a pending approval banner if `verificationStatus` is not `VERIFIED`. |
| `vendorprofile.html` | Public vendor profile — hero, About+Contact strip, services, menu, reviews. Also doubles as the request-sending page when `fromEvent=1` is in the URL |
| `plannerdashboard.html` | Planner's main dashboard — Quotes Received, Saved Requests, Messages, Favorites, Quick Actions, Pending/Upcoming/Completed events |
| `plannerquote.html` | Quote detail page for planners — shows itemized pricing, 15% tax, estimated total, 10% deposit card, Book Vendor & Pay Deposit button |
| `browsevendors.html` | Search and filter vendors — category pills (enum values), price range, date availability. Cards link to vendorprofile |
| `createevent.html` | Multi-step event creator — pick vendor categories, choose vendors, fill event details, submit request |
| `admindashboard.html` | Admin controls — vendor verification, user management (not yet fully wired) |
| `forgotpassword.html` | Password reset request form |
| `friends.html` | Friends/guestlist page (placeholder, not wired to API) |
| `vendorapproval.html` | Vendor receives and reviews a quote request |
| `*approval.html` (5 more) | Vendor-type-specific approval pages (bartender, caterer, DJ, photographer, venue) |
| `planner.html` | **DEV-only.** Monte Carlo simulator (24mo financial projections). Sliders for growth/revenue/personnel params, fan charts (users / rev+cost / profit), summary cards. Auth-gated via `/auth/dev-access`. |
| `database.html` | **DEV-only.** Two tabs: Schema (interactive ERD of all 24 Prisma models, click a node to highlight relationships) + Event Feed (live DB events from `/admin/events`, filterable by model, auto-refresh 15s). Auth-gated. |

---

## API Routes (`/api/v1`)

| Prefix | Controller | Notes |
|--------|-----------|-------|
| `/auth` | authController | register, login, refresh, forgot/reset password, me, add-role, switch-role |
| `/users` | userController | profile GET/PUT |
| `/providers` | providerController | profile CRUD, services CRUD, menu-items CRUD, search, availability |
| `/event-requests` | eventRequestController | client creates requests, vendor views them |
| `/quotes` | quoteController | vendor creates quotes, client accepts/declines |
| `/bookings` | bookingController | booking lifecycle, deposit tracking |
| `/favorites` | favoriteController | save/unsave vendors |
| `/reviews` | reviewController | post and fetch reviews |
| `/portfolio` | portfolioController | vendor photo/video portfolio |
| `/notifications` | notificationController | user notification feed |
| `/jess` | jessController | Jess AI chat + PDF import via Claude API |
| `/pdf-import` | pdfImportController | Upload vendor PDF → Claude extracts services/menu |
| `/admin` | adminController | Admin-only operations |
| `/admin/events`, `/admin/events/stats` | adminRoutes | Live DB event feed for `database.html`. Gated by `requireAdminEmail` (which now ALSO accepts test users). |
| `/admin/users` | adminRoutes | All CLIENT-role users (id, name, email, city, status). Used by `database.html` Provider Graph tab to populate the planner column. |
| `/admin/providers` | adminRoutes | All ProviderProfiles with services, menu items, portfolio, counts. Used by Provider Graph tab. |
| `/admin/event-requests` | adminRoutes | All EventRequests with full pipeline (client, quotes, booking). Used by Provider Graph tab. |
| `/auth/dev-access` | authController | Returns `{ canAccessDev, isAdmin, email }`. Used by `profile-menu.js` to decide whether to render the DEV section. |
| `/auth/seed-test-accounts` | authController | Dev-only. Gated by `ENABLE_TEST_ACCOUNTS=true`. Creates/refreshes the 5 test accounts and returns plaintext credentials so `signin.html`'s picker can autofill. 404s in prod. |
| `/verification` | verificationController | Email/phone verification codes |

---

## Database Models (Prisma)

Key models to know:

- **User** — `role` (primary) + `roles[]` (all). Status: ACTIVE, PENDING_VERIFICATION, SUSPENDED
- **ProviderProfile** — linked to User via `userId`. Has `primaryType`, `providerTypes[]`, `verificationStatus`, pricing fields. New columns added: `languages`, `travelOutsideRegion`, `tagline`, `websiteUrl`, `instagramHandle`, `yearsInBusiness`, `serviceRadius`, `minBudget`, `maxBudget`
- **Service** — packages offered by a vendor (name, description, priceType, basePrice, features[])
- **MenuItem** — food/drink items (name, category, price, dietaryInfo[])
- **EventRequest** — a planner's request (eventType, date, guestCount, budget, selectedServices)
- **Quote** — vendor's response to a request (lineItems, totalAmount, depositRequired, status)
- **Booking** — confirmed engagement (status: PENDING_DEPOSIT → DEPOSIT_PAID → CONFIRMED → COMPLETED)

**Key Enums:**
```
ProviderType:  RESTO_VENUE | CATERER | ENTERTAINMENT | PHOTO_VIDEO | FLORIST_DECOR
BookingStatus: PENDING_DEPOSIT | DEPOSIT_PAID | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED
QuoteStatus:   DRAFT | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED
PriceType:     FLAT_RATE | PER_PERSON | PER_HOUR | CUSTOM
EventType:     WEDDING | CORPORATE | BIRTHDAY | ANNIVERSARY | ...
```

> ⚠️ The 5 ProviderType enums are canonical across the entire codebase. Never use old names (DJ, Photographer, Bartender, Restaurant, Venue) anywhere.

---

## Design System

All pages share these CSS variables and fonts (defined inline in each HTML `<style>` block):

```css
:root {
  --gold:       #C4A06A;   /* Primary brand — buttons, accents, highlights */
  --gold-light: #D9BF8C;   /* Lighter gold */
  --gold-dark:  #9C7A45;   /* Hover states */
  --bg:         #F5F3EF;   /* Page background — warm off-white/beige */
  --white:      #FFFFFF;
  --dark:       #1A1714;   /* Near-black — headings, dark sections */
  --charcoal:   #3A3530;   /* Body text */
  --muted:      #7A7068;   /* Secondary text, labels */
  --border:     rgba(0,0,0,0.09);
  --green:      #3A8A55;   /* Success states */
  --red:        #B84040;   /* Error states */
}
```

**Fonts** (loaded from Google Fonts):
- `'Cormorant Garamond'` — serif, for display text, headings, vendor names (weights 300–700)
- `'Montserrat'` — sans-serif, for body, labels, UI elements (weights 300–700)

**Visual language:** Luxury, editorial, warm neutrals. Gold accents throughout. Cards have `border-radius: 16px`, subtle borders, no hard shadows.

---

## Auth Flow (Frontend)

Every HTML page reads auth from `localStorage`:
```javascript
const token = localStorage.getItem('accessToken');
const user  = JSON.parse(localStorage.getItem('user') || '{}');
```

All authenticated API calls use:
```javascript
fetch('/api/v1/...', {
  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
})
```

Token is set at page load — not refreshed mid-session in most pages. If a call returns 401/403, the page typically redirects to `signin.html`.

**Roles:**
- `CLIENT` — planners
- `PROVIDER` — vendors
- `ADMIN` — full access

**User status flow:**
- `PENDING_VERIFICATION` — set at registration. User must verify email before accessing any routes except: `POST /verification/send-email-code`, `POST /verification/verify-email`, `GET /auth/me`, `POST /auth/refresh`. All other authenticated routes return 403 with "Please verify your email address to continue."
- `ACTIVE` — set after successful email verification. Full API access based on role.
- `SUSPENDED` — admin action. No access.

> ⚠️ `User.status` (email verification) and `ProviderProfile.verificationStatus` (admin approval) are two separate things. Never conflate them.

**Dev access (Planner + Database admin pages):**
Backend helper `isDevAccess(email)` in `routes/adminRoutes.ts` returns `true` for:
1. Any email in `ADMIN_EMAILS` env var (comma-separated)
2. Any email matching `/^test-.*@festv\.app$/i` (the seeded test accounts)

The `requireAdminEmail` middleware uses this for `/admin/*` routes. The frontend dropdown calls `GET /api/v1/auth/dev-access` to know whether to render the DEV section. Test users get DEV access automatically — they're for internal testing only and never see real customers.

---

## Vendor Onboarding Flow

### `accounttype.html` — Account Creation
- Choose role: Event Planner or Vendor
- If Vendor: select primary vendor type (one of 5 ProviderType enums)
- Fill: business name, contact name, email, phone, city, password
- No document uploads here — moved to vendorsetup Step 3
- Submit button is gold → creates account with status `PENDING_VERIFICATION` → email verification modal → on verify redirects to `vendorsetup.html`

### `vendorsetup.html` — 3-Step Profile Setup
Vendors can complete all 3 steps while `PENDING_VERIFICATION`. Nothing goes live until admin approves.

**Step 1 of 3 — Business Profile**
- Business identity: name, phone, email, website, Instagram, years in business, tagline
- Location: street address, city, province, country, service radius, travel toggle
- Vendor type: primary type (radio card selector) + secondary types (multi-select chips, excludes primary)
- About your business (min 50 chars)
- Languages spoken (chips: French, English, Spanish, Portuguese, Arabic, Mandarin, Italian, Other)
- Budget range: min/max event budget
- Media: placeholder cards for logo, cover image, portfolio (Cloudinary not yet set up)
- API: `POST /api/v1/providers/profile` (first time) or `PUT /api/v1/providers/profile` (returning)
- `providerTypes[]` always includes `primaryType`

**Step 2 of 3 — Services & Pricing**
- Fetches `primaryType` and `providerTypes[]` from `GET /api/v1/providers/profile` — never from localStorage
- PDF import banner (universal — all vendor types) → `POST /api/v1/pdf-import`
- Special fields section — adapts per vendor type (capacity, dietary options, style tags, etc.)
- Multi-type vendors: primary type fields first, secondary type fields below in labeled subsections
- Services: repeatable cards with quick-add suggestion chips per type. At least 1 required.
- Menu section: only shown if `providerTypes[]` includes `RESTO_VENUE` or `CATERER`
- Collapsed card state: summary row with edit/delete after filling
- API: `PUT /api/v1/providers/profile` + `POST /api/v1/providers/services` + `POST /api/v1/providers/menu-items`

**Step 3 of 3 — Review & Submit**
- Fetches all data from API: profile, services, menu items
- Shows read-only summary cards for each section with "Edit" buttons back to Step 1 or 2
- Verification documents section (above submit button):
  - Business license / registration (required — PDF, JPG, PNG, max 10MB)
  - Government-issued ID (required — PDF, JPG, PNG, max 10MB)
  - Proof of address (optional)
  - Insurance certificate (optional)
  - Note: "Your documents are kept private and used only for verification purposes."
- Gold "Submit for Approval" button
- After submit: confirmation screen → "Your profile is under review. We'll notify you by email once you're approved." → "Go to Dashboard" button → `vendordashboard.html`

### `vendordashboard.html` — Pending State
- On load fetches `verificationStatus` from `GET /api/v1/providers/profile`
- If not `VERIFIED`: shows gold-tinted banner — "Your profile is under review. We'll notify you by email once you're approved and live on FESTV. This usually takes 1–2 business days."
- If `VERIFIED`: banner hidden, dashboard renders normally
- Vendor does not appear in `browsevendors.html` until admin flips `verificationStatus` to `VERIFIED`

---

## Data & State Management

- **No global state framework** — each HTML page is self-contained
- **localStorage** — `accessToken`, `refreshToken`, `user` (JSON), event drafts (`eventDraft_*`), favorites cache
- **In-memory JS vars** — page-level state (e.g. `pendingServices[]`, `window._bookingsMap`, `window._vendorPriceMap`)
- **API-first** — all real data comes from `/api/v1`. Mocked/fallback data is used only when API returns empty
- **`window._vendorDataReady`** — flag used on `vendorprofile.html` so draft restore waits for vendor API to load before trying to re-select services
- **Never read vendorType or verificationStatus from localStorage** — always fetch from the API

---

## Shared JS Files

| File | Purpose |
|------|---------|
| `jess-widget.js` | Floating Jess AI chat button (bottom-right). Included on every page via `<script src="/jess-widget.js">`. Calls `/api/v1/jess/chat`. Has full inline CSS. |
| `profile-menu.js` | Top-right profile dropdown. Shows user name, role, sign out. Reads from localStorage. **Now also fetches `/api/v1/auth/dev-access` and adds a DEV section (Planner + Database links) for admin emails and test users.** Also calls `GET /api/v1/providers/profile/me` on vendor pages to hydrate profile state. |
| `auth-chip.js` | Small auth utility helpers |

---

## Business Logic Notes

**Deposit calculation:** `Math.round(totalAmount * 1.15 * 0.10 * 100) / 100`
= 10% of (subtotal + 15% tax). Calculated in `quoteController.ts` and displayed in `plannerquote.html`.

**Quote flow:**
1. Planner creates EventRequest → vendor sees it in Incoming Requests
2. Vendor accepts + sends quote → quote appears in planner's dashboard
3. Planner views quote on `plannerquote.html` → clicks "Book Vendor & Pay Deposit"
4. Booking is created with status `PENDING_DEPOSIT`
5. Deposit payment → `DEPOSIT_PAID` → `CONFIRMED` (Stripe not yet wired)

**Vendor search:** Currently returns ALL providers (not VERIFIED only). Flip `verificationStatus` filter before launch.

**Multi-type vendors:** A vendor can have one `primaryType` and multiple entries in `providerTypes[]`. The `providerTypes[]` array always includes `primaryType`. Step 2 of vendorsetup renders fields and service suggestions for all types in `providerTypes[]`, with primary type first. Menu section appears if `providerTypes[]` includes `RESTO_VENUE` or `CATERER`.

**`getMyProfile` behavior:** Returns `{ success: true, data: { providerProfile: null } }` when no profile exists yet (new vendor). Does not throw 404. vendorsetup.html Step 1 handles null by rendering an empty form.

---

## Current State

### ✅ Working end-to-end
- Full auth flow (register → verify email → login → dashboard)
- Planner flow: browse → vendor profile → create event → send request → receive quote → book
- Vendor flow: setup profile → receive requests → accept/send quote → manage bookings
- Jess AI widget (claude-haiku-4-5)
- PDF import (Claude AI extracts services/menu from vendor PDFs)
- Favorites (saved vendors, API-backed)
- Deposit calculation and display
- About + Contact strip on vendor profile and dashboard
- Vendor account creation flow (accounttype.html) — role select, type select, basic info, email verification, redirect to vendorsetup
- Vendor setup Step 1 — business profile + multi-type vendor selection
- Vendor setup Step 3 — review & confirm + verification doc uploads
- Pending approval banner on vendordashboard.html
- User status correctly set to PENDING_VERIFICATION at registration, flips to ACTIVE after email verify
- Password validation aligned between frontend and backend (uppercase + lowercase + number all required)
- Zod error detail messages surfaced to user on frontend
- **Test-account picker on `signin.html`** — 5 dev accounts (planner, photographer, caterer, bartender, DJ), shared password `Test1234!`. Click to autofill. Gated server-side by `ENABLE_TEST_ACCOUNTS=true` (set on Render dev), so picker is invisible in prod.
- **Test accounts have full ProviderProfiles** — services, portfolio photos (picsum.photos with stable seeds), menu items (caterer + bartender), 3 pricing tiers (caterer), cuisine/theme links.
- **DEV section in profile dropdown** — admin emails + test users get "Planner" + "Database" links between Account Settings and Sign Out.
- **`planner.html`** — Monte Carlo simulator with parameter sliders, 3 fan charts, 4 summary cards. Chart.js via CDN. Mobile-responsive.
- **`database.html`** — Schema ERD (24 nodes, click to highlight relationships) + live Event Feed tab (filter by model, 15s auto-refresh) + **Provider Graph tab** (see below).

### 🟡 Placeholder / Partial
- **Vendor setup Step 2** — built and 400 error fixed (all ProviderProfile columns now in production DB, confirmed live on festv.org). Functional but untested end-to-end with a real vendor account.
- **Admin dashboard** — `admindashboard.html` exists but vendor approval flow not yet wired. Admin cannot yet flip `verificationStatus` to `VERIFIED`. This is the next critical thing to build.
- **Messages** — card UI exists on both dashboards, not wired to real conversations
- **Analytics** — card placeholder on vendor dashboard, no real data
- **Portfolio** — card UI exists with placeholder Unsplash images, Cloudinary not set up
- **Friends/Guestlist** — page exists, not wired to API
- **Stripe / payments** — deposit UI is built, actual payment not connected
- **`planner.html` ported tabs** — Monte Carlo only. Growth Strategy / Cost Model / Architecture / Roadmap tabs not yet ported.
- **`database.html` Provider Graph tab** — built and wired to live DB (planners left, vendors right grouped by type, color-coded connections). Client flow graph and Settings tabs not yet ported. Provider Graph uses `/admin/users`, `/admin/providers`, `/admin/event-requests` — untested against a full production dataset.

### ❌ Not started
- Admin dashboard vendor approval flow (flip verificationStatus to VERIFIED)
- Cloudinary image uploads
- Stripe deposit payment
- SMS verification (Twilio keys exist in old .env)
- OAuth (Google/Facebook sign-in)
- Mobile responsiveness pass
- `isAvailable` toggle for menu items

---

## Required Env Vars

Backend (`/backend/.env` or Render dashboard):

| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection | Auto-set by Render via blueprint |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | JWT signing | Auto-generated by Render |
| `CORS_ORIGIN` | Allowed frontend origins | Currently `*`; tighten before scaling |
| `RESEND_API_KEY` | Email delivery | For verification emails, password reset |
| `ANTHROPIC_API_KEY` | Jess + PDF import | Claude API |
| `ADMIN_EMAILS` | Comma-separated emails | Real admins (full `/admin/*` access). Test users `test-*@festv.app` get DEV access automatically without being listed here. |
| `ENABLE_TEST_ACCOUNTS` | `true` to enable seed endpoint + signin picker | Dev only. NEVER set to `true` in prod. |
| `ADMIN_NOTIFICATION_EMAIL`, `DISCORD_WEBHOOK_URL` | Optional event alerting | Used by `eventNotifier` service |

---

## Key Gotchas for New Devs

1. **Two frontends exist** — only `/backend/public/*.html` is the real UI. The `/frontend/` React app is legacy/unused.
2. **README says "CaterEase"** — the project was renamed to FESTV. Ignore the README.
3. **Two databases on Render** — `festv_db` (`dpg-d7lro0u47okc73cd0h6g-a`) is an orphaned DB no longer connected to any service. The live service uses `caterease-db` (`dpg-d7ij6d0sfn5c73e9n790-a`). Always connect to `caterease-db` for production queries.
3. **Safari caching** — all HTML pages need a `pageshow` bfcache listener in `<head>` and `Cache-Control: no-store` headers (already set in `index.ts`).
4. **UTC date bug** — always parse event dates as local midnight: `new Date(dateStr.split('T')[0] + 'T00:00:00')` not `new Date(dateStr)`.
5. **ProviderType enums** — only these 5 are valid everywhere: `RESTO_VENUE`, `CATERER`, `ENTERTAINMENT`, `PHOTO_VIDEO`, `FLORIST_DECOR`. Never use old names.
6. **`requireProvider` middleware** — checks role is `PROVIDER` or `ADMIN`. New vendor accounts need a provider profile created via `POST /providers/profile` before services can be saved.
7. **Git workflow** — always commit to `dev`, then merge to `main`, push both. Both branches should stay in sync.
8. **Render auto-deploys from `main` branch** — pushing to `dev` alone does NOT trigger a deploy. Always merge dev → main and push main before expecting Render to pick up changes.
9. **Custom slash commands need the Claude Code CLI** — `/start`, `/end-session`, `/debug`, `/audit` only work when running `claude` in the terminal (not in the Claude Code desktop/web app). Install with `npm install -g @anthropic-ai/claude-code`.
9. **DEV pages auth-gating** — `planner.html` and `database.html` both call `GET /api/v1/auth/dev-access` on load. If `canAccessDev: false`, they show a "Dev access required" panel.
10. **Test-account seeder is idempotent at two levels** — the `User` row is refreshed on every seed run (password + status), but the `ProviderProfile` and all its children are created ONCE and skipped on subsequent runs. Delete the `ProviderProfile` row and re-run seeder to fully reset a test profile.
11. **Two roadmap files** — `roadMap.txt` is the northstar. `FESTV_CONTEXT.md` is the structural quick-start. Update BOTH after every meaningful change.
12. **Never read vendorType or verificationStatus from localStorage** — always fetch from `GET /api/v1/providers/profile`. localStorage is only for auth tokens and event drafts.
13. **Two separate statuses** — `User.status` (PENDING_VERIFICATION → ACTIVE, controlled by email verification) and `ProviderProfile.verificationStatus` (controlled by admin approval). Never conflate them.
14. **`providerTypes[]` always includes `primaryType`** — never send one without the other. Step 2 of vendorsetup reads `providerTypes[]` to determine which fields and menu sections to show.
15. **`getMyProfile` returns null not 404** — for new vendors with no profile yet, `GET /api/v1/providers/profile/me` returns `{ success: true, data: { providerProfile: null } }`. vendorsetup.html handles this by rendering an empty form.
16. **`database.html` Provider Graph tab** — Loads data from three admin endpoints in parallel (`/admin/users`, `/admin/providers`, `/admin/event-requests`). Only vendor types with at least one vendor are rendered as dotted group boxes — empty types are hidden. Planner nodes include clients extracted from event-requests that may not be in the `/admin/users` response. Click a node to highlight its connections and open the detail panel; click again to deselect. Vendor detail has two sub-graph tabs: **Services** (fan of service cards) and **History** (bookings + quotes). Planner detail has **History** only.
17. **`/admin/*` routes return all providers regardless of verificationStatus** — including UNVERIFIED and REJECTED. The Provider Graph shows a status dot (green/amber/gray) on each vendor node to indicate this. The public `/providers/search` endpoint still returns ALL providers and needs the VERIFIED-only filter applied before launch.
