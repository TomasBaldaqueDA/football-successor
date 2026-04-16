"""Carrega CSV Transfermarkt (ex.: transfermarkt_12leagues_full_2025.csv) para mart.transfermarkt_market_value_ref.

Requer: SUPABASE_DB_URL (pooler) no ambiente.
Depois no SQL: select mart.apply_transfermarkt_market_to_player_dim(2025);
"""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path

import psycopg


def parse_opt_int(s: str | None) -> int | None:
    if s is None or str(s).strip() == "":
        return None
    try:
        return int(str(s).strip())
    except ValueError:
        return None


def parse_opt_bigint(s: str | None) -> int | None:
    if s is None or str(s).strip() == "":
        return None
    try:
        return int(str(s).strip())
    except ValueError:
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parent / "data_raw" / "transfermarkt_12leagues_full_2025.csv",
        help="CSV com colunas do scrape (inclui player_id = TM id)",
    )
    parser.add_argument(
        "--clear-season",
        type=int,
        default=None,
        help="Antes de inserir, apaga ref com este season_id (ex.: 2025)",
    )
    args = parser.parse_args()

    database_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Define SUPABASE_DB_URL ou DATABASE_URL.")

    if not args.csv.exists():
        raise RuntimeError(f"CSV não encontrado: {args.csv}")

    insert_sql = """
    insert into mart.transfermarkt_market_value_ref (
      competition_code, competition_name, season_id, club_id, club_name,
      tm_player_id, player_name, profile_url, position_detail, age,
      nationalities, market_value_text, market_value_eur, source_url
    ) values (
      %(competition_code)s, %(competition_name)s, %(season_id)s, %(club_id)s, %(club_name)s,
      %(tm_player_id)s, %(player_name)s, %(profile_url)s, %(position_detail)s, %(age)s,
      %(nationalities)s, %(market_value_text)s, %(market_value_eur)s, %(source_url)s
    )
    on conflict (tm_player_id, club_id, season_id) do update set
      competition_name = excluded.competition_name,
      player_name = excluded.player_name,
      profile_url = excluded.profile_url,
      position_detail = excluded.position_detail,
      age = excluded.age,
      nationalities = excluded.nationalities,
      market_value_text = excluded.market_value_text,
      market_value_eur = excluded.market_value_eur,
      source_url = excluded.source_url,
      imported_at = now()
    """

    batch: list[dict] = []
    with args.csv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rec = {
                "competition_code": (row.get("competition_code") or "").strip(),
                "competition_name": (row.get("competition_name") or "").strip() or None,
                "season_id": parse_opt_int(row.get("season_id")),
                "club_id": (row.get("club_id") or "").strip(),
                "club_name": (row.get("club_name") or "").strip(),
                "tm_player_id": (row.get("tm_player_id") or row.get("player_id") or "").strip(),
                "player_name": (row.get("player_name") or row.get("name") or "").strip(),
                "profile_url": (row.get("profile_url") or "").strip() or None,
                "position_detail": (row.get("position_detail") or "").strip() or None,
                "age": parse_opt_int(row.get("age")),
                "nationalities": (row.get("nationalities") or "").strip() or None,
                "market_value_text": (row.get("market_value_text") or "").strip() or None,
                "market_value_eur": parse_opt_bigint(row.get("market_value_eur")),
                "source_url": (row.get("source_url") or "").strip() or None,
            }
            if not rec["tm_player_id"] or rec["season_id"] is None or not rec["competition_code"]:
                continue
            batch.append(rec)

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            if args.clear_season is not None:
                cur.execute(
                    "delete from mart.transfermarkt_market_value_ref where season_id = %s",
                    (args.clear_season,),
                )
                print(f"Deleted ref rows for season_id={args.clear_season}: {cur.rowcount}")

            for i in range(0, len(batch), 400):
                chunk = batch[i : i + 400]
                cur.executemany(insert_sql, chunk)

        conn.commit()

    print(f"Upserted {len(batch)} rows into mart.transfermarkt_market_value_ref")
    print("Seguinte no SQL (ordem sugerida, season 2025):")
    print("  1) select mart.apply_transfermarkt_market_to_player_dim(2025, 0.38, false);")
    print("  2) select mart.apply_transfermarkt_market_to_player_dim(2025, 0.32, true);  -- so nulos")
    print("  3) select mart.apply_transfermarkt_market_to_player_dim_nationality_fallback(2025, true);")
    print("  4) select mart.apply_transfermarkt_market_to_player_dim_name_unique_ref(2025, true);")
    print(
        "  5) select mart.apply_transfermarkt_market_to_player_dim_name_dim_unique(2025, true);  "
        "-- so nome: 1 jogador no dim e 1 perfil TM com esse nome"
    )


if __name__ == "__main__":
    main()
