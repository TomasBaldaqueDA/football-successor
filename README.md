# Football Successor

**Internal analytics & scouting studio for football data** — Next.js app, PostgreSQL marts (`mart.*`), and supporting SQL / Python tooling.

> PT: Ferramenta para explorar perfis de jogadores, substitutos “like-for-like”, rankings por liga/métrica e conteúdo de scouting, sobre dados agregados na base de dados.

---

## Why this repo exists

This project bundles:

- A **Next.js 16** web app with multiple **studios** (L4L, Role, Development, Budget, Upgrade, Top Stats, Control Score, Team Ranking, Big‑5 season leaderboard, Scouting, etc.).
- **Server routes** that query **PostgreSQL** (e.g. Supabase pooler) against curated tables such as `mart.player_dim`, `mart.player_pool_clean_tbl`, `mart.player_profile_merged_v1`, `mart.player_position_membership`, and SQL functions for replacements / neighbours.
- **`sql/`** — mart definitions and diagnostics you can run in the SQL editor.
- **`scripts/`** — Python utilities (e.g. exports, charts).
- **`data_raw/`** — raw league / season JSON (large; cloned with the repo).

It is suitable to **link from a CV**: reviewers can browse code, structure, and commit history. Add screenshots under [`docs/screenshots/`](docs/screenshots/) to show the UI (see section below).

---

## Tech stack

| Area | Stack |
|------|--------|
| Web | Next.js (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Data | `pg` (connection pool), JSON metrics from marts |
| Viz | ECharts (where used), PapaParse (CSV scouting) |
| Other | Python scripts, Power BI–adjacent exports where applicable |

---

## Repository layout

```
Football_Successor_2026/
├── web/                 # Next.js application (npm project)
│   ├── app/             # Routes & API route handlers
│   ├── components/      # Studio UI components
│   └── lib/             # DB pool, metric helpers, scouting logic
├── sql/                 # Mart SQL & maintenance scripts
├── scripts/             # Python & automation
├── data_raw/            # Raw competition JSON (large)
├── artifacts/           # Generated dashboards / exports (when present)
└── docs/screenshots/    # Put CV / README screenshots here
```

---

## Quick start (local)

### 1. Prerequisites

- Node.js **20+** (LTS recommended)
- A **PostgreSQL** connection string with access to your `mart.*` objects (e.g. Supabase).

### 2. Environment

```bash
cd web
cp .env.example .env.local
```

Edit **`.env.local`** and set either:

- `DATABASE_URL=...` **or**
- `SUPABASE_DB_URL=...`

(use the pooler URI your provider gives you; the app enables TLS for managed Postgres).

**Never commit `.env.local`** — it is gitignored.

### 3. Install & run

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). From the home page you can open each studio route under `/studio/...`.

### 4. Lint (optional)

```bash
cd web
npm run lint
```

---

## Highlights (for recruiters)

- **Like-for-like & role workflows** — search players, buckets from `mart.player_position_membership`, weighted metrics from `mart.l4l_metric_weights`, neighbour SQL functions.
- **Big 5 season leaderboard** — latest season from `mart.player_pool_clean_tbl`, minimum minutes, top five leagues (incl. TM-style codes), optional **strict dim token** filter so expanded L4L membership does not mix positions (e.g. CB into AM).
- **League strength** — season metrics can be scaled with `league_strength_coefficient` and normalised to a **0–1** cohort score for transparent ranking.
- **Scouting module** — CSV-driven exploration with filters and charts where implemented.
- **SQL transparency** — mart definitions live in `sql/` for reproducible analytics engineering.

---

## Screenshots (recommended for your CV)

Add PNG/WebP files under **`docs/screenshots/`**, then uncomment or add lines like:

```markdown
![Home — Football Successor](docs/screenshots/home.png)
![Studio — example](docs/screenshots/studio-example.png)
```

If you **send images** (or drop files into that folder), wire them in the same way — GitHub renders them on the repo homepage.

---

## Deployment (optional)

The app is a standard Next.js project: you can deploy to **Vercel**, **Railway**, or any Node host. Set the same env vars in the host’s dashboard. For serverless, ensure the DB pooler allows enough connections for your plan.

---

## License & data

- Code in this repository is provided **as-is** for portfolio / internal use unless you add a formal `LICENSE` file.
- **Player and competition data** may be subject to third-party terms from your data provider — do not assume redistribution rights beyond what your contract allows.

---

## Author

Maintained by **[TomasBaldaqueDA](https://github.com/TomasBaldaqueDA)** — repository: [`football-successor`](https://github.com/TomasBaldaqueDA/football-successor).
