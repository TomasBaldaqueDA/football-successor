import pandas as pd
from pathlib import Path


BASE_PATH = Path(__file__).resolve().parents[2]
INPUT_PATH = BASE_PATH / "data" / "staging" / "player_season_raw.csv"
OUTPUT_PATH = BASE_PATH / "data" / "processed" / "player_season_clean.csv"


def to_snake_case(name: str) -> str:
    out = []
    prev_lower = False
    for ch in name:
        if ch.isupper() and prev_lower:
            out.append("_")
        out.append(ch.lower())
        prev_lower = ch.islower() or ch.isdigit()
    return "".join(out).replace("__", "_")


def main() -> None:
    print("Football Successor - Player Season Cleaner")

    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")

    # Read full dataset (keep all columns)
    df = pd.read_csv(INPUT_PATH, low_memory=False)

    # Remove goalkeepers based on positionText
    if "positionText" in df.columns:
        df = df[df["positionText"] != "Goalkeeper"].copy()
    elif "position_text" in df.columns:
        df = df[df["position_text"] != "Goalkeeper"].copy()

    rename_map = {
        "playerId": "player_id",
        "teamId": "team_id",
        "teamName": "team_name",
        "minsPlayed": "minutes_played",
        "assistTotal": "assists",
        "shotsPerGame": "shots_per_game",
        "keyPassPerGame": "key_passes_per_game",
        "dribbleWonPerGame": "dribbles_won_per_game",
        "tacklePerGame": "tackles_per_game",
        "interceptionPerGame": "interceptions_per_game",
        "clearancePerGame": "clearances_per_game",
        "passSuccess": "pass_success",
        "totalPassesPerGame": "total_passes_per_game",
        "accurateCrossesPerGame": "accurate_crosses_per_game",
        "accurateLongPassPerGame": "accurate_long_passes_per_game",
        "accurateThroughBallPerGame": "accurate_through_balls_per_game",
        "xG": "xg",
        "xGPerNinety": "xg_per_90",
        "xGDiff": "xg_diff",
        "totalShots": "total_shots",
    }

    df = df.rename(columns=rename_map)
    df.columns = [to_snake_case(c) for c in df.columns]

    df["league"] = df["league"].astype("string")
    df["season"] = df["season"].astype("string")

    id_cols = ["player_id", "team_id"]
    for c in id_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")

    metric_cols = [
        "age",
        "minutes_played",
        "apps",
        "goal",
        "assists",
        "shots_per_game",
        "key_passes_per_game",
        "dribbles_won_per_game",
        "tackles_per_game",
        "interceptions_per_game",
        "clearances_per_game",
        "pass_success",
        "total_passes_per_game",
        "accurate_crosses_per_game",
        "accurate_long_passes_per_game",
        "accurate_through_balls_per_game",
        "xg",
        "xg_per_90",
        "xg_diff",
        "total_shots",
    ]
    for c in metric_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    # Ensure keys exist before using them for de-duplication / IDs
    key_subset = [c for c in ["player_id", "league", "season"] if c in df.columns]
    if key_subset:
        df = df.dropna(subset=key_subset)
        df = df.drop_duplicates(subset=key_subset, keep="first")

        if "player_id" in df.columns:
            df["player_season_id"] = (
                df["player_id"].astype("Int64").astype("string")
                + "_"
                + df["league"].astype("string")
                + "_"
                + df["season"].astype("string")
            )

            df = df[
                ["player_season_id"]
                + [c for c in df.columns if c != "player_season_id"]
            ]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Rows: {len(df)}")
    print(f"Columns: {df.shape[1]}")
    print(f"Saved cleaned dataset to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

