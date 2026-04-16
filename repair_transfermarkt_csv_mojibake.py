"""Repara mojibake UTF-8/Latin-1 em CSVs Transfermarkt."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

TEXT_FIELDS = frozenset({
    "competition_code", "competition_name", "club_id", "club_name",
    "tm_player_id", "player_id", "player_name", "name",
    "profile_url", "position_detail", "nationalities",
    "market_value_text", "source_url",
})

def fix_mojibake_utf8(s: str) -> str:
    if not s:
        return s
    try:
        s = s.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    s = s.replace("\u00e2\u201a\u00ac", "€")
    return s

def sniff_dialect(sample: str):
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;")
    except csv.Error:
        class Semi(csv.Dialect):
            delimiter = ";"
            quotechar = '"'
            doublequote = True
            skipinitialspace = False
            lineterminator = "\n"
            quoting = csv.QUOTE_MINIMAL
        return Semi()

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="inp", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    raw_head = args.inp.read_text(encoding="utf-8", errors="replace")[:4096]
    first_nl = raw_head.find("\n")
    dialect = sniff_dialect(raw_head[: first_nl + 1] if first_nl != -1 else raw_head)
    rows = []
    with args.inp.open(newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, dialect=dialect)
        fields = reader.fieldnames
        if not fields:
            raise SystemExit("Sem cabecalho")
        for row in reader:
            o = {}
            for k, v in row.items():
                if k is None:
                    continue
                key = k.strip()
                val = (v or "").strip()
                if key in TEXT_FIELDS:
                    val = fix_mojibake_utf8(val)
                o[key] = val
            rows.append(o)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(fields), quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)
    print(f"OK: {len(rows)} linhas -> {args.out}")

if __name__ == "__main__":
    main()
