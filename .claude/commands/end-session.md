Read FESTV_CONTEXT.md and roadMap.txt first. Do not change any application code. Documentation files only.

You are doing an end-of-session documentation update. Review the git log (`git log origin/dev..HEAD --oneline` and `git diff origin/dev` or `git show` on recent commits) to see exactly what changed in this session. Then do the following two tasks:

---

## Task 1 — Update FESTV_CONTEXT.md

Edit FESTV_CONTEXT.md in place. Rules:
- **Do not remove anything that is still accurate.**
- Add or update the **Pages & Routes** table for any HTML pages that were added or changed.
- Add or update the **API Routes** table for any routes that were added, removed, or changed.
- Add or update the **Database Models** section for any schema changes (new models, new fields, changed enums, new migrations).
- Update the **Current State** section:
  - Move items to ✅ Working end-to-end if they are now fully functional.
  - Update 🟡 Placeholder / Partial items if their status changed.
  - Add new ❌ Not started items for things discovered but not yet built.
- Add any new entries to **Key Gotchas for New Devs** if a non-obvious behaviour, bug, or constraint was discovered.
- Update **Required Env Vars** if any new environment variables were added.

---

## Task 2 — Update roadMap.txt

Edit roadMap.txt in place. Rules:
- Check off (mark as done) anything completed in this session.
- Add any new tasks or bugs discovered during the session that are not already listed.
- Keep the existing structure and ordering — add new items at the appropriate priority level, do not scramble the file.

---

## Task 3 — Commit

After both files are updated, run:

```
git add FESTV_CONTEXT.md roadMap.txt
git commit -m "docs: update context + roadmap $(date '+%Y-%m-%d')"
git push origin dev
```

Confirm when done.
