# Pipelines (ETL & loads)

Scripts that **ingest, clean, or load** data into Postgres — run from the **repository root** (so paths to `data_raw/` resolve correctly).

## Layout

| Folder | Purpose |
|--------|---------|
| [`transfermarkt/`](transfermarkt/) | Scrape TM market values, repair CSV encoding, load ref table into `mart.transfermarkt_market_value_ref` |
| [`supabase/`](supabase/) | Load raw JSON from `data_raw/` into `raw.raw_files` |

## Examples

From the repo root, with `SUPABASE_DB_URL` / `DATABASE_URL` set as each script expects:

```bash
# Raw JSON → raw.raw_files
python pipelines/supabase/load_raw_to_supabase.py --dry-run
python pipelines/supabase/load_raw_to_supabase.py

# Scrape → CSV (output path is your choice)
python pipelines/transfermarkt/scrape_transfermarkt_market_values.py --help

# CSV → mart.transfermarkt_market_value_ref (default CSV under data_raw/)
python pipelines/transfermarkt/load_transfermarkt_market_to_supabase.py

# Fix mojibake in a CSV
python pipelines/transfermarkt/repair_transfermarkt_csv_mojibake.py --in path/to/in.csv --out path/to/out.csv
```

Other Python utilities stay in [`../scripts/`](../scripts/) (e.g. Power BI helpers) unless they become part of this ingestion story.
