# Data layout

What lives where, and how it is intended to be used.

---

## `data_raw/`

- **Content:** Competition / season **JSON** (per league folders, e.g. `bundesliga/`, `brasileirao/`, …).
- **Size:** Large — cloning the repo downloads this tree.
- **Role:** Source layer for ingestion / experiments. Not queried directly by the Next.js app at runtime (the app uses **Postgres marts**).

If you fork the repo for a portfolio-only clone, consider documenting which subsets you actually need, or keeping a smaller sample (your choice — not enforced here).

---

## Python & automation

| Location | Typical use |
|----------|-------------|
| Repo **root** `*.py` | Scraping Transfermarkt, loading raw or market refs to Supabase (`scrape_transfermarkt_market_values.py`, `load_raw_to_supabase.py`, `load_transfermarkt_market_to_supabase.py`, …) |
| `scripts/` | Standalone utilities (e.g. `powerbi_radar_chart.py`) |
| `artifacts/` | `import_data.py`, `build_dashboard.py` — closer to **Excel / dashboard** generation pipelines |

These scripts assume **credentials and paths** on the machine that runs them (not shipped in git).

---

## PostgreSQL (`mart.*`)

The web app expects (among others):

| Object | Purpose |
|--------|---------|
| `mart.player_dim` | Identity, club, age, market value, position text / tokens |
| `mart.player_pool_clean_tbl` | **Season-level** stat rows (wide columns + minutes + league metadata) |
| `mart.player_profile_merged_v1` | **Merged** profile (`*_merged` / p90 / pct) for stable cross-season views |
| `mart.player_position_membership` | Tactical **buckets** for modelling |
| `mart.l4l_metric_weights` | Metric columns + weights per bucket / version |

Functions and materialised logic are defined in **`sql/`** — treat that folder as the **contract** for what the API is allowed to assume.

---

## Generated outputs

| Path | Notes |
|------|------|
| `artifacts/` | Outputs from Python pipelines (dashboards, exports). May be empty in a fresh clone. |
| `web/public/scouting-players.csv` | Example / bundled CSV for scouting UI (if present in your branch) |

---

## Sensitive data

- **Never commit** database URLs, API keys, or private exports.  
- Use **`web/.env.local`** (gitignored) — see [LOCAL_SETUP.md](LOCAL_SETUP.md).
