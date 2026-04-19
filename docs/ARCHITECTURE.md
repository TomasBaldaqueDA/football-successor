# Architecture

This document is for anyone who opens the repo and wants a **map of the system** before reading code.

---

## High-level flow

```
data_raw/          JSON (leagues / seasons / players)
       │
       ▼
Python (pipelines/ + scripts/ + artifacts/)   scraping, cleaning, loads to Postgres
       │
       ▼
PostgreSQL mart.*   dimensions, pools, merged profiles, memberships, SQL functions
       │
       ▼
web/app/api/*       Next.js Route Handlers → getPool() → SQL
       │
       ▼
web/app/studio/*    “Studios” + player detail UI (React)
```

The product goal: **repeatable decisions** (compare, rank, replace) backed by the same marts the SQL layer defines.

---

## Backend (Next.js)

| Path | Role |
|------|------|
| `web/app/api/**/route.ts` | HTTP API: validation, query params/body, JSON responses |
| `web/lib/db.ts` | Singleton `pg` `Pool` from `DATABASE_URL` or `SUPABASE_DB_URL` |
| `web/lib/*.ts` | Metric labels, pool JSON helpers, scouting stores, studio nav |

Representative routes:

- **Players** — `players/search`, `players/buckets`, `position-buckets`
- **Studios** — `l4l`, `role`, `development`, `budget`, `upgrade`, `control-score`, `control-score/top`, `team-ranking`, `player-top-stats`
- **Season compare / rank** — `player-compare-season`, `player-season-leaderboard`

All of these assume **`mart.*`** tables and functions already exist in the database (created/maintained via `sql/` and your ops process).

---

## Frontend (Next.js App Router)

| Path | Role |
|------|------|
| `web/app/page.tsx` | Home: links into each studio |
| `web/app/studio/*/page.tsx` | Shell + breadcrumb; loads a `*Studio.tsx` client component |
| `web/components/*Studio.tsx` | UI + `fetch` to `/api/...` |
| `web/components/scouting/*` | Scouting dashboard, radar, filters (CSV + state) |
| `web/components/ui/*` | Shared layout primitives for studios |

Player detail: `web/app/studio/players/[playerId]/` (server data + client view).

---

## Data layer (PostgreSQL)

SQL artefacts live in **`sql/`** (versioned, runnable in Supabase / psql). Examples:

| File / area | Purpose |
|-------------|---------|
| `mart_l4l_neighbors.sql` | Like-for-like neighbour logic |
| `mart_role_neighbors.sql` | Role-style neighbours |
| `mart_*_replacements.sql` | Budget / development / upgrade replacement pipelines |
| `mart_player_profile_from_raw.sql` | Building merged profile from `player_pool_clean_tbl` |
| `mart_control_score.sql` | Control-score card model |
| `mart_membership_*.sql` | Position bucket expansion / rules |

**Important:** the web app does **not** migrate the database. It **consumes** the mart schema you deploy.

---

## Cross-cutting decisions

1. **Season vs merged** — Some features read **latest season** from `mart.player_pool_clean_tbl`; others read **`mart.player_profile_merged_v1`** for multi-season signals. APIs document which in code comments / README.
2. **Position buckets** — `mart.player_position_membership` drives L4L-style tools; some ranking APIs also filter on **`player_dim.played_positions_short`** to avoid cross-bucket expansion noise.
3. **League strength** — Pool rows carry `league_strength_coefficient`; leaderboard logic applies it where the metric is not pct/rate-style (aligned with mart SQL philosophy).

---

## Where to start reading code

1. `web/app/api/l4l/route.ts` — end-to-end “studio calls SQL function + enriches rows” pattern  
2. `web/app/api/player-season-leaderboard/route.ts` — cohort query + normalisation  
3. `sql/mart_l4l_neighbors.sql` — core analytics in the database  

Then open the matching `*Studio.tsx` to see how the UI consumes the JSON.
