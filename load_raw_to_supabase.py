from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Iterator, Tuple

import psycopg


ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data_raw"


def iter_raw_json_files(base_dir: Path) -> Iterator[Tuple[Path, str, str, str, str]]:
    for file_path in base_dir.rglob("*.json"):
        rel = file_path.relative_to(base_dir)
        # Expected: <league_slug>/<season_slug>/<entity_type>/<source_file>.json
        if len(rel.parts) != 4:
            continue
        league_slug, season_slug, entity_type, file_name = rel.parts
        if entity_type not in {"players", "teams"}:
            continue
        source_file = Path(file_name).stem
        yield file_path, league_slug, season_slug, entity_type, source_file


def main() -> None:
    parser = argparse.ArgumentParser(description="Load raw JSON files into Supabase raw.raw_files.")
    parser.add_argument("--dry-run", action="store_true", help="Scan files but do not write to database.")
    args = parser.parse_args()

    database_url = os.getenv("SUPABASE_DB_URL")
    if not database_url:
        raise RuntimeError("Missing SUPABASE_DB_URL environment variable.")

    if not RAW_DIR.exists():
        raise RuntimeError(f"Folder not found: {RAW_DIR}")

    sql = """
    INSERT INTO raw.raw_files (
        league_slug,
        season_slug,
        entity_type,
        source_file,
        source_path,
        payload
    )
    VALUES (%s, %s, %s, %s, %s, %s::jsonb)
    ON CONFLICT (league_slug, season_slug, entity_type, source_file)
    DO UPDATE SET
        source_path = EXCLUDED.source_path,
        payload = EXCLUDED.payload,
        ingested_at = now();
    """

    scanned = 0
    written = 0
    skipped = 0

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for file_path, league_slug, season_slug, entity_type, source_file in iter_raw_json_files(RAW_DIR):
                scanned += 1
                try:
                    raw_text = file_path.read_text(encoding="utf-8").strip()
                    if not raw_text:
                        skipped += 1
                        print(f"SKIP empty file: {file_path}")
                        continue
                    payload = json.loads(raw_text)
                except json.JSONDecodeError as exc:
                    skipped += 1
                    print(f"SKIP invalid json: {file_path} ({exc})")
                    continue
                if args.dry_run:
                    continue
                cur.execute(
                    sql,
                    (
                        league_slug,
                        season_slug,
                        entity_type,
                        source_file,
                        str(file_path.relative_to(ROOT)).replace("\\", "/"),
                        json.dumps(payload, ensure_ascii=False),
                    ),
                )
                written += 1
        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()

    print(f"Scanned files: {scanned}")
    print(f"Skipped files: {skipped}")
    if args.dry_run:
        print("Dry run complete. No rows written.")
    else:
        print(f"Rows upserted: {written}")


if __name__ == "__main__":
    main()
