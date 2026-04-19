# Contributing

Small set of rules so the repo stays easy to review (for you or for collaborators).

---

## Branches

- Default remote branches: **`main`** and **`master`** are kept in sync for this project — work from **`master`** locally if that is your habit, then push; mirror to `main` when needed (`git push origin master:main`).
- Prefer **short-lived feature branches** if you collaborate: `feat/scouting-filter`, `fix/api-timeout`.

---

## Commits

- Use **clear subjects** (English is fine): `feat(web): …`, `fix(api): …`, `docs: …`, `sql: …`.
- One logical change per commit when possible — easier to bisect and to show in a portfolio review.

---

## Web app

- Run **`npm run lint`** from `web/` before opening a PR or tagging a release.
- Match existing **patterns**: Route Handlers in `web/app/api/`, shared logic in `web/lib/`, UI in `web/components/`.
- Do not add secrets; use `.env.local` only.

---

## SQL

- Put new mart definitions / function changes in **`sql/`** with a name that reflects the object (`mart_*.sql`).
- If you change a function signature, update **every** API route that calls it (search for the function name).

---

## Data

- Avoid committing **multi‑GB** dumps unless the team agrees; document large assets in `docs/DATA.md` instead.
- If you add new screenshot assets for the README, place them under **`docs/screenshots/`** and reference from the root `README.md`.
