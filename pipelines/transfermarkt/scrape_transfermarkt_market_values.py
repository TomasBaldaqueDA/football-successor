from __future__ import annotations

import argparse
import csv
import re
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.transfermarkt.pt"
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8"}


def fix_mojibake_utf8(s: str | None) -> str | None:
    if s is None:
        return None
    s = s.strip()
    if not s:
        return s
    try:
        s = s.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    s = s.replace("\u00e2\u201a\u00ac", "€")
    return s


def response_html_utf8(resp) -> str:
    return resp.content.decode("utf-8", errors="replace")


@dataclass(frozen=True)
class CompetitionSpec:
    code: str
    label: str
    slug: str


def parse_market_value_eur(value_text: str) -> int | None:
    text = value_text.strip().replace("\xa0", " ")
    m = re.search(r"([\d.,]+)\s*(M|mil)\s*€", text, flags=re.IGNORECASE)
    if not m:
        return None
    number_part = m.group(1).replace(".", "").replace(",", ".")
    unit = m.group(2).lower()
    try:
        value = float(number_part)
    except ValueError:
        return None
    return int(round(value * 1_000_000 if unit == "m" else value * 1_000))


COMPETITIONS: dict[str, CompetitionSpec] = {
    "IT1": CompetitionSpec("IT1", "Serie A", "serie-a"),
    "ES1": CompetitionSpec("ES1", "La Liga", "laliga"),
    "L1": CompetitionSpec("L1", "Bundesliga", "bundesliga"),
    "FR1": CompetitionSpec("FR1", "Ligue 1", "ligue-1"),
    "PO1": CompetitionSpec("PO1", "Liga Portugal", "liga-portugal"),
    "NL1": CompetitionSpec("NL1", "Eredivisie", "eredivisie"),
    "GB2": CompetitionSpec("GB2", "Championship", "championship"),
    "BRA1": CompetitionSpec("BRA1", "Brasileirao", "campeonato-brasileiro-serie-a"),
    "SC1": CompetitionSpec("SC1", "Scottish Premiership", "scottish-premiership"),
    "BE1": CompetitionSpec("BE1", "Jupiler Pro League", "jupiler-pro-league"),
    "TR1": CompetitionSpec("TR1", "Turkish Super Lig", "super-lig"),
}


DEFAULT_11_CODES = ["IT1", "ES1", "L1", "FR1", "PO1", "NL1", "GB2", "BRA1", "SC1", "BE1", "TR1"]


def extract_club_entries_from_league_page(html: str, season_id: int) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    club_pattern = re.compile(r"^/([^/]+)/startseite/verein/(\d+)(?:/saison_id/(\d+))?")
    seen: set[tuple[str, str]] = set()
    clubs: list[dict] = []
    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        m = club_pattern.match(href)
        if not m:
            continue
        club_slug = m.group(1)
        club_id = m.group(2)
        href_season = m.group(3)
        if href_season and href_season != str(season_id):
            continue
        key = (club_slug, club_id)
        if key in seen:
            continue
        seen.add(key)
        clubs.append({"club_slug": club_slug, "club_id": club_id, "club_url": urljoin(BASE_URL, href)})
    return clubs


def discover_competition_clubs(
    session: requests.Session, spec: CompetitionSpec, season_id: int
) -> list[dict]:
    urls = [
        f"{BASE_URL}/{spec.slug}/startseite/wettbewerb/{spec.code}/saison_id/{season_id}",
        f"{BASE_URL}/{spec.slug}/tabelle/wettbewerb/{spec.code}/saison_id/{season_id}",
    ]
    merged: dict[str, dict] = {}
    for url in urls:
        resp = session.get(url, headers=HEADERS, timeout=(10, 30), allow_redirects=True)
        resp.raise_for_status()
        clubs = extract_club_entries_from_league_page(response_html_utf8(resp), season_id)
        for c in clubs:
            merged[c["club_id"]] = c
    return sorted(merged.values(), key=lambda x: int(x["club_id"]))


def parse_squad_rows(html: str, competition_code: str, season_id: int, club_id: str) -> tuple[str | None, list[dict]]:
    soup = BeautifulSoup(html, "html.parser")
    club_name = None
    h1 = soup.select_one("h1.data-header__headline-wrapper")
    if h1:
        club_name = fix_mojibake_utf8(h1.get_text(" ", strip=True))

    rows: list[dict] = []
    table_rows = soup.select("#yw1 table.items > tbody > tr")
    player_pattern = re.compile(r"/profil/spieler/(\d+)")
    for tr in table_rows:
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 5:
            continue

        player_anchor = tds[1].select_one("td.hauptlink a[href*='/profil/spieler/']")
        player_name = (fix_mojibake_utf8(player_anchor.get_text(" ", strip=True)) if player_anchor else None)
        player_href = player_anchor.get("href") if player_anchor else None
        player_url = urljoin(BASE_URL, player_href) if player_href else None
        player_id = None
        if player_href:
            pm = player_pattern.search(player_href)
            if pm:
                player_id = pm.group(1)

        inline_rows = tds[1].select("table.inline-table tr")
        position_detail = None
        if len(inline_rows) > 1:
            pos_cells = inline_rows[1].find_all("td")
            if pos_cells:
                position_detail = fix_mojibake_utf8(pos_cells[-1].get_text(" ", strip=True))

        age_text = tds[2].get_text(strip=True) if len(tds) > 2 else ""
        age = int(age_text) if age_text.isdigit() else None
        nat_cell = tds[3] if len(tds) > 3 else tds[-2]
        nationalities = [
            fix_mojibake_utf8(img.get("title", "").strip()) or ""
            for img in nat_cell.select("img[title]")
            if img.get("title")
        ]

        mv_anchor = tds[-1].select_one("a")
        market_value_text = (
            fix_mojibake_utf8(mv_anchor.get_text(" ", strip=True)) if mv_anchor else None
        )
        market_value_eur = parse_market_value_eur(market_value_text) if market_value_text else None

        rows.append(
            {
                "competition_code": competition_code,
                "season_id": season_id,
                "club_id": club_id,
                "club_name": club_name,
                "player_id": player_id,
                "name": player_name,
                "profile_url": player_url,
                "position_detail": position_detail,
                "age": age,
                "nationalities": "|".join(nationalities) if nationalities else "",
                "market_value_text": market_value_text,
                "market_value_eur": market_value_eur,
            }
        )
    return club_name, rows


def scrape_competition_squads(
    session: requests.Session, spec: CompetitionSpec, season_id: int, sleep_s: float = 0.8
) -> list[dict]:
    clubs = discover_competition_clubs(session, spec, season_id)
    if not clubs:
        raise RuntimeError(f"No clubs found for {spec.code} ({spec.label}).")

    all_rows: list[dict] = []
    for idx, club in enumerate(clubs, start=1):
        squad_url = f"{BASE_URL}/{club['club_slug']}/kader/verein/{club['club_id']}/saison_id/{season_id}"
        resp = session.get(squad_url, headers=HEADERS, timeout=(10, 30), allow_redirects=True)
        resp.raise_for_status()
        club_name, rows = parse_squad_rows(
            response_html_utf8(resp), spec.code, season_id, club["club_id"]
        )
        club_label = club_name or f"{club['club_slug']} ({club['club_id']})"
        print(f"[{spec.code} {idx}/{len(clubs)}] {club_label}: rows={len(rows)}", flush=True)
        for r in rows:
            r["source_url"] = squad_url
            r["competition_name"] = spec.label
        all_rows.extend(rows)
        time.sleep(sleep_s)

    deduped: dict[tuple[str | None, str, int], dict] = {}
    for row in all_rows:
        key = (row.get("player_id"), row["club_id"], row["season_id"])
        deduped[key] = row
    return list(deduped.values())


def write_csv(rows: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "competition_code",
        "competition_name",
        "season_id",
        "club_id",
        "club_name",
        "player_id",
        "name",
        "profile_url",
        "position_detail",
        "age",
        "nationalities",
        "market_value_text",
        "market_value_eur",
        "source_url",
    ]
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def resolve_competitions(codes: list[str] | None) -> list[CompetitionSpec]:
    selected = DEFAULT_11_CODES if not codes else [c.upper() for c in codes]
    unknown = [c for c in selected if c not in COMPETITIONS]
    if unknown:
        allowed = ", ".join(sorted(COMPETITIONS.keys()))
        raise ValueError(f"Unknown competition codes: {', '.join(unknown)}. Allowed: {allowed}")
    return [COMPETITIONS[c] for c in selected]


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape Transfermarkt market values by club squads.")
    parser.add_argument("--season-id", type=int, default=2025, help="Season id used by Transfermarkt (e.g. 2025)")
    parser.add_argument(
        "--competitions",
        nargs="*",
        help="Competition codes. Default: 11 requested leagues (without Premier League).",
    )
    parser.add_argument("--output", default="data_raw/transfermarkt_11leagues_full_2025.csv", help="Output CSV path")
    args = parser.parse_args()

    competitions = resolve_competitions(args.competitions)
    rows: list[dict] = []
    with requests.Session() as session:
        for spec in competitions:
            rows.extend(scrape_competition_squads(session, spec, season_id=args.season_id))
    write_csv(rows, Path(args.output))
    print(f"Done. Wrote {len(rows)} rows to {args.output}", flush=True)


if __name__ == "__main__":
    main()
