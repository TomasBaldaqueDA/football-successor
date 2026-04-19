# Local setup

Run the **Next.js** app against your **Postgres** (e.g. Supabase pooler).

---

## Requirements

- **Node.js 20+** (LTS recommended)
- **PostgreSQL** reachable from your machine, with **`mart.*`** objects deployed (from `sql/` + your migration process)

---

## 1. Environment

```bash
cd web
cp .env.example .env.local
```

Edit **`web/.env.local`** and set **one** of:

| Variable | When to use |
|----------|-------------|
| `DATABASE_URL` | Standard Postgres connection URI |
| `SUPABASE_DB_URL` | Alternative name supported by `web/lib/db.ts` |

The pool uses TLS with `rejectUnauthorized: false` (typical for managed providers). Adjust only if your org requires stricter TLS.

**Do not commit** `.env.local`.

---

## 2. Install & dev server

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 3. Lint

```bash
cd web
npm run lint
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `Set DATABASE_URL or SUPABASE_DB_URL` | Missing or empty env in `.env.local` |
| Connection timeout / `ECONNREFUSED` | Wrong host/port; firewall; pooler not accepting your IP |
| `relation "mart.xxx" does not exist` | Marts not created in that database / wrong schema |
| Empty studios / 400 from API | No rows for filters (bucket, season, minutes), or strict position filter excluding everyone |
| SSL errors | Provider-specific; check URI (`sslmode`) vs code in `db.ts` |

If the app boots but data is empty, confirm with a SQL client that `mart.player_dim` and `mart.player_pool_clean_tbl` have rows for the season you expect.

---

## Python pipelines (optional)

Scripts under **`pipelines/`** (see [`pipelines/README.md`](../pipelines/README.md)) and in **`artifacts/`** need their **own** env (e.g. Supabase URL, file paths). They are **not** started by `npm run dev` — run from the **repo root**, e.g. `python pipelines/supabase/load_raw_to_supabase.py`.
