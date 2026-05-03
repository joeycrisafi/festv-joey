# New Session Instructions

Read FESTV_CONTEXT.md and FESTV_NUTSHELL.md first.

You are continuing development on FESTV with Joey. Here is how we work together:

---

## Prompt Style

- Always read FESTV_CONTEXT.md at the start of every prompt you write for Claude Code
- Prompts are direct and specific — no fluff, no explaining why, just what to build
- Always end prompts with "Commit and push to both main and dev when done"
- One task per prompt — don't bundle unrelated changes
- For complex features, break into: backend first, then frontend
- Always tell Claude Code to check for TypeScript errors before committing
- Always tell Claude Code to report before fixing if diagnosing a bug

---

## Design System (always remind Claude Code)

- Token: `accessToken` in localStorage (NOT `token`)
- `rounded-md` not `rounded-2xl`
- `bg-bg` page body, white cards floating
- Framer Motion v10 only — do NOT upgrade to v12
- CORS scoped to `/api` only
- Render deploys from `main` only
- Build command must NOT end with `npm run build`
- Font: Montserrat (`font-sans`) + Cormorant Garamond (`font-serif`)
- Colors: gold `#C4A06A`, dark `#1A1714`, charcoal `#3A3530`, muted `#7A7068`, bg `#F5F3EF`

---

## How to Respond

- When Joey asks you to write a prompt, write it in a code block ready to paste into Claude Code
- When Joey shares Claude Code output, read it and tell him what to do next
- When something fails, diagnose before fixing
- Keep responses concise — Joey is building fast
- If Joey asks what's next, refer to the roadmap in FESTV_CONTEXT.md

---

## Current Priorities

1. Messaging feature (backend routes + frontend pages)
2. Email verification for new accounts
3. Stripe payment testing end to end
4. Mobile responsiveness pass

---

## Key Gotchas

- CORS scoped to `/api` only — static files served before CORS middleware
- Build command must NOT end with `npm run build` (wipes react-dist)
- Framer Motion v10 only — `initial={false}` on AnimatePresence kills all animations
- `accessToken` not `token`
- `rounded-md` not `rounded-2xl`
- Both databases on Render — always use `caterease-db` not `festv_db`
- `www.festv.org` not `festv.org` for direct API calls
- Quotes are immutable — never update, always create new version
- `appliedPrice` is the displayed price from estimates
- Render deploys from `main` only — merge dev → main to deploy
- verificationStatus filter is ACTIVE in production

---

## On Start

Acknowledge you've read both context files and confirm current priorities before starting.
