Read FESTV_CONTEXT.md first. Do not change any code. This is a read-only health check.

You are performing a full health check on the live FESTV production environment at festv.org. Report findings only — no fixes.

---

## Check 1 — DATABASE

Connect to the production database using the external URL. The caterease-db external URL follows the pattern:
`postgresql://caterease:PASSWORD@dpg-d7ij6d0sfn5c73e9n790-a.oregon-postgres.render.com/caterease`

If you don't have the URL, ask the user: "Please paste the caterease-db external DATABASE_URL from Render dashboard → caterease-db → Connect → External tab."

Run these queries:

**1a. ProviderProfile columns:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ProviderProfile'
AND column_name IN (
  'tagline', 'websiteUrl', 'instagramHandle', 'yearsInBusiness',
  'languages', 'travelOutsideRegion', 'serviceRadius', 'minimumBudget', 'maximumBudget'
)
ORDER BY column_name;
```
Expected: all 9 columns present. Flag any missing ones as ❌ CRITICAL.

**1b. Stuck migrations:**
```sql
SELECT migration_name, applied_steps_count, logs
FROM _prisma_migrations
WHERE applied_steps_count = 0;
```
Expected: 0 rows. Any row returned is ❌ CRITICAL.

**1c. NotificationType enum values:**
```sql
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'NotificationType'
ORDER BY enumlabel;
```
Expected: NEW_REQUEST, NEW_QUOTE, QUOTE_ACCEPTED, QUOTE_REJECTED, BOOKING_CONFIRMED, BOOKING_CANCELLED, PAYMENT_RECEIVED, PAYMENT_FAILED, NEW_MESSAGE, NEW_REVIEW, REMINDER, SYSTEM (12 values). Flag any missing as ⚠️ WARNING.

---

## Check 2 — API HEALTH

Make these HTTP requests to `https://www.festv.org` and report the actual status codes returned:

```bash
# Server up check
curl -s -o /dev/null -w "%{http_code}" https://www.festv.org/api/v1/auth/me

# Route exists check
curl -s -o /dev/null -w "%{http_code}" https://www.festv.org/api/v1/providers/profile/me

# Auth working check
curl -s -o /dev/null -w "%{http_code}" -X POST https://www.festv.org/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"healthcheck@festv.org","password":"wrong"}'

# Health endpoint
curl -s https://www.festv.org/health
```

Expected status codes: 401, 401, 401. A 400 on the profile endpoint means a DB schema mismatch (❌ CRITICAL). A 500 means a server error (❌ CRITICAL). A non-200 on /health is ❌ CRITICAL.

---

## Check 3 — MIGRATION DRIFT

List all migration folder names from `backend/prisma/migrations/` and compare against the `migration_name` values in `_prisma_migrations`. Report:
- Migrations in repo but NOT in DB table → ❌ CRITICAL (unapplied)
- Migrations in DB table but NOT in repo → ⚠️ WARNING (orphaned)

---

## Check 4 — ENV VARS

Query the live server's health endpoint and infer which env vars are active. Then cross-reference against the required list from FESTV_CONTEXT.md:

Required vars to confirm exist (check indirectly — do NOT log values):
- DATABASE_URL (confirmed if DB queries succeed)
- JWT_SECRET, JWT_REFRESH_SECRET (confirmed if auth returns 401 not 500)
- RESEND_API_KEY (cannot confirm without sending email — mark as ⚠️ UNVERIFIABLE)
- ANTHROPIC_API_KEY (cannot confirm without calling Jess — mark as ⚠️ UNVERIFIABLE)
- CORS_ORIGIN (confirmed if API responds without CORS errors)

---

## Output Format

Produce the report in this exact format:

```
FESTV PRODUCTION HEALTH CHECK
==============================
Checked: [timestamp]

DATABASE
  ✅/⚠️/❌  ProviderProfile columns: [X/9 present] [list any missing]
  ✅/⚠️/❌  Stuck migrations: [X stuck]
  ✅/⚠️/❌  NotificationType enum: [X/12 values]

API HEALTH
  ✅/⚠️/❌  GET  /auth/me              → [status code]
  ✅/⚠️/❌  GET  /providers/profile/me → [status code]
  ✅/⚠️/❌  POST /auth/login           → [status code]
  ✅/⚠️/❌  GET  /health               → [status + environment]

MIGRATIONS
  ✅/⚠️/❌  [X migrations in repo, X applied, X unapplied]
  [list any unapplied migrations by name]

ENV VARS
  ✅/⚠️/❌  DATABASE_URL
  ✅/⚠️/❌  JWT_SECRET / JWT_REFRESH_SECRET
  ⚠️        RESEND_API_KEY — unverifiable without sending email
  ⚠️        ANTHROPIC_API_KEY — unverifiable without calling Jess

SUMMARY
  ✅ X checks healthy
  ⚠️ X warnings
  ❌ X critical issues
```

If there are any ❌ CRITICAL issues, list them again at the bottom under "ACTION REQUIRED:" with a one-line description of the fix needed.
