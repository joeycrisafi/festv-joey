# Memory

## Me
Joey, building FESTV — a luxury event-planning marketplace.

## Project
**FESTV** — connects event planners (clients) with vendors. Planners browse vendors, send requests, receive quotes, pay deposit and book. Vendors manage profile, incoming requests, quotes, bookings via dashboard.

## Tech Stack
- Backend: Node/Express/TypeScript, Prisma (PostgreSQL), JWT auth, Claude AI (Jess widget + PDF import)
- Active frontend: `/backend/public/*.html` — plain HTML + CSS + vanilla JS (THIS IS THE REAL UI)
- React frontend: `/frontend/` — legacy React/Vite/Tailwind SPA (secondary, being brought up to par)
- Deployed on Render, live at festv.org

## Key Terms
| Term | Meaning |
|------|---------|
| FESTV | The product / marketplace |
| Jess | AI chat assistant widget embedded site-wide |
| VERIFIED | verificationStatus = admin-approved vendor (goes live in search) |
| verificationStatus | Admin approval status on ProviderProfile (separate from User.status) |
| User.status | Email verification status (PENDING_VERIFICATION → ACTIVE) |
| pricingEngine | `/backend/src/services/pricingEngine.ts` — core pricing calc |
| PKG_TEMPLATES | Template library for auto-generating starter packages in VendorSetup |
| FLAT_PLUS_PER_PERSON | New pricing model: flat room fee + per-person F&B rate |

## ProviderType Enums (canonical — never use old names)
| Value | Label |
|-------|-------|
| RESTO_VENUE | Restaurant / Venue |
| CATERER | Caterer |
| ENTERTAINMENT | Entertainment |
| PHOTO_VIDEO | Photo & Video |
| FLORIST_DECOR | Florist & Decor |

## Design System
- gold: #C4A06A · gold-dark: #9C7A45 · gold-light: #D9BF8C
- dark: #1A1714 · charcoal: #3A3530 · muted: #7A7068
- bg: #F5F3EF · border: rgba(0,0,0,0.09)
- green: #3A8A55 · red: #B84040
- Fonts: Cormorant Garamond (font-serif) + Montserrat (font-sans)
- Cards: bg-white border border-border rounded-md (no shadow by default)
- Inputs: border border-border rounded-md px-4 py-3 focus:outline-none focus:border-gold
- Labels: font-sans text-xs font-bold uppercase tracking-widest text-charcoal

## Key API Patterns
- Auth: `Authorization: Bearer ${token}` on all protected calls
- API base: `const API_BASE = import.meta.env.VITE_API_URL ? \`${...}/api/v1\` : '/api/v1'`
- Estimate endpoint returns `appliedPrice` (not `basePrice`) for package price
- searchProviders requires exactly one `type` param — parallel fetch for multi-type
- Reviews: `{ data: { reviews: [], stats: {}, pagination: {} } }` — data is object not array
- Profile GET: returns `{ data: { providerProfile: null } }` when no profile exists (not 404)

## Git Workflow
- Always commit to `dev`, push dev → main
- Both branches stay in sync
- Render auto-deploys from `main`

## Preferences
- Read FESTV_CONTEXT.md at start of every session
- Commit messages: imperative, descriptive, Co-Authored-By at bottom
- No TODOs left in code — implement fully or leave a clear comment
- TypeScript: verify zero new errors before committing
