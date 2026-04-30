# FESTV Tasks

_Last updated: 2026-04-28_

---

## 🔴 Next Up

- [ ] Admin dashboard vendor approval flow UI — flip verificationStatus to VERIFIED from admindashboard.html (backend routes POST /admin/providers/:id/verify and /reject exist and work)
- [ ] Rewire vendorsetup Step 2 (vendorsetup.html) to use /packages instead of deprecated /providers/services
- [ ] Add rejectionReason String? field to ProviderProfile schema + migration + surface in admin UI
- [ ] Uncomment verificationStatus: 'VERIFIED' filter in searchProviders before launch

## 🟡 In Progress / Partial

- [ ] Wire 24 existing page components (scaffolded with old CaterEase logic) to new schema/API endpoints
- [ ] VendorSetup Step 2 (vendorsetup.html HTML version) — functional but not end-to-end verified on production
- [ ] database.html Client Flow Graph + Settings tabs not yet ported

## ✅ Completed This Session (2026-04-28)

- [x] Fix $NaN in estimate result — EstimateResult.appliedPrice fallback chain (d22a5d4)
- [x] ProviderTypeBadge — replace blue/browser colors with FESTV design system (6aea8f8)
- [x] Login.tsx + Register.tsx — full FESTV visual rewrite, auth logic unchanged (a6bd6df)
- [x] VendorSetup.tsx — 6-step vendor onboarding wizard with localStorage auto-save (01902ff)
- [x] Add FLAT_PLUS_PER_PERSON pricing model — schema migration, pricingEngine, packageController, VendorSetup UI (eebd067)
- [x] ProviderDashboard.tsx — full rewrite with 5 parallel API fetches, real data (98c578e)

## 🔲 Backlog

- [ ] Cloudinary image uploads (logo, banner, portfolio)
- [ ] Stripe deposit payment integration
- [ ] Mobile responsiveness pass across all pages
- [ ] Admin dashboard full wire-up
- [ ] SMS verification (Twilio keys exist)
- [ ] OAuth (Google/Facebook sign-in)
- [ ] ClientDashboard.tsx rewrite
- [ ] CreateEventRequest.tsx rewrite
- [ ] Quote flow pages (planner side)
