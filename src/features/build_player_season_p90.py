"""
Build player-season dataset with all metrics normalized to per-90 minutes.

WhoScored "per game" metrics are per appearance (apps), not per 90.
This script converts them to per90 using minutes_played.
"""

import pandas as pd
from pathlib import Path


BASE_PATH = Path(__file__).resolve().parents[2]
INPUT_PATH = BASE_PATH / "data" / "processed" / "player_season_clean.csv"
OUTPUT_PATH = BASE_PATH / "data" / "processed" / "player_season_p90.csv"


# Columns to convert to numeric (STEP 2)
NUMERIC_COLUMNS = [
    "goal",
    "assists",
    "total_shots",
    "xg",
    "shots_per_game",
    "key_passes_per_game",
    "dribbles_won_per_game",
    "tackles_per_game",
    "interceptions_per_game",
    "clearances_per_game",
    "outfielder_block_per_game",
    "accurate_crosses_per_game",
    "accurate_long_passes_per_game",
    "accurate_through_balls_per_game",
    "fouls_per_game",
    "foul_given_per_game",
    "dispossessed_per_game",
    "turnover_per_game",
    "offside_given_per_game",
    "offside_won_per_game",
    "aerial_won_per_game",
    "minutes_played",
    "apps",
]

# Raw totals -> per90 (STEP 4): stat_p90 = (stat / minutes_played) * 90
TOTALS_TO_P90 = [
    ("goal", "goals_p90"),
    ("assists", "assists_p90"),
    ("total_shots", "shots_p90"),
    ("xg", "xg_p90_from_xg"),
]

# WhoScored per-game -> per90 (STEP 5): (stat_per_game * apps / minutes_played) * 90
PER_GAME_TO_P90 = [
    ("shots_per_game", "shots_p90_alt"),
    ("key_passes_per_game", "key_passes_p90"),
    ("dribbles_won_per_game", "dribbles_p90"),
    ("tackles_per_game", "tackles_p90"),
    ("interceptions_per_game", "interceptions_p90"),
    ("clearances_per_game", "clearances_p90"),
    ("outfielder_block_per_game", "blocks_p90"),
    ("accurate_crosses_per_game", "crosses_p90"),
    ("accurate_long_passes_per_game", "long_passes_p90"),
    ("accurate_through_balls_per_game", "through_balls_p90"),
    ("fouls_per_game", "fouls_p90"),
    ("foul_given_per_game", "fouled_p90"),
    ("dispossessed_per_game", "dispossessions_p90"),
    ("turnover_per_game", "turnovers_p90"),
    ("offside_given_per_game", "offsides_p90"),
    ("offside_won_per_game", "offsides_won_p90"),
    ("aerial_won_per_game", "aerials_won_p90"),
]

# Per-game columns to drop after per90 versions are created (no longer needed)
DROP_PER_GAME_COLUMNS = [
    "shots_per_game",
    "key_passes_per_game",
    "dribbles_won_per_game",
    "tackles_per_game",
    "interceptions_per_game",
    "clearances_per_game",
    "outfielder_block_per_game",
    "accurate_crosses_per_game",
    "accurate_long_passes_per_game",
    "accurate_through_balls_per_game",
    "fouls_per_game",
    "foul_given_per_game",
    "dispossessed_per_game",
    "turnover_per_game",
    "offside_given_per_game",
    "offside_won_per_game",
    "aerial_won_per_game",
]


def main() -> None:
    print("Football Successor - Player Season Per-90 Builder")

    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")

    df = pd.read_csv(INPUT_PATH)

    # STEP 2 — Ensure numeric types
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # STEP 3 — Avoid divide by zero
    if "minutes_played" in df.columns:
        df = df[df["minutes_played"] > 0].copy()

    mins = df["minutes_played"]

    # STEP 4 — Create per90 from raw totals: (stat / minutes_played) * 90
    for src, dst in TOTALS_TO_P90:
        if src in df.columns:
            df[dst] = (df[src] / mins) * 90

    # STEP 5 — Convert WhoScored per-game to per90: (stat_per_game * apps / minutes_played) * 90
    apps = df["apps"] if "apps" in df.columns else None
    if apps is not None:
        for src, dst in PER_GAME_TO_P90:
            if src in df.columns:
                df[dst] = (df[src] * apps / mins) * 90

    # STEP 6 — pass_success, rating, xg_per_90, xg_diff are left unchanged (no code needed)

    # Drop original per-game columns (replaced by per90 metrics)
    drop_cols = [c for c in DROP_PER_GAME_COLUMNS if c in df.columns]
    df = df.drop(columns=drop_cols)

    # STEP 7 — Save
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    # STEP 8 — Print summary
    print(f"Rows: {len(df)}")
    print(f"Columns: {df.shape[1]}")
    print(f"Saved per-90 dataset to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
