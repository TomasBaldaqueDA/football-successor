import json
import pandas as pd
from pathlib import Path

# -----------------------------------------
# PATHS
# -----------------------------------------

# project root
BASE_PATH = Path(__file__).resolve().parents[2]

RAW_DATA_PATH = BASE_PATH / "data" / "data_raw"
OUTPUT_PATH = BASE_PATH / "data" / "staging" / "player_season_raw.csv"

print("Football Successor - Player Season Builder")

# -----------------------------------------
# FUNCTION TO LOAD JSON
# -----------------------------------------

def load_json(file_path):

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return pd.DataFrame(data["playerTableStats"])


print("Setup complete.")

# -----------------------------------------
# DISCOVER LEAGUES AND SEASONS
# -----------------------------------------

league_folders = [p for p in RAW_DATA_PATH.iterdir() if p.is_dir()]

print(f"Found {len(league_folders)} leagues")

for league_path in league_folders:

    league_name = league_path.name
    print(f"\nProcessing league: {league_name}")

    season_folders = [p for p in league_path.iterdir() if p.is_dir()]

    for season_path in season_folders:

        season_name = season_path.name
        print(f"  Season: {season_name}")

        players_path = season_path / "players"

        if not players_path.exists():
            print("    No players folder found")
            continue

        summary_path = players_path / "summary.json"
        offensive_path = players_path / "offensive.json"
        defensive_path = players_path / "defensive.json"
        passing_path = players_path / "passing.json"
        xg_path = players_path / "xg.json"

        summary_df = load_json(summary_path)
        offensive_df = load_json(offensive_path)
        defensive_df = load_json(defensive_path)
        passing_df = load_json(passing_path)
        xg_df = load_json(xg_path)

        print(f"    Players loaded: {len(summary_df)}")