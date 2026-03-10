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


def merge_suffix_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge columns that are the same metric but with suffixes such as:
    base, base_off, base_def, base_pass, base_xg.

    Preference order:
    - base (unsuffixed)
    - base_off
    - base_def
    - base_pass
    - base_xg
    """

    suffixes = ["_off", "_def", "_pass", "_xg"]

    # Map from base name to all columns belonging to that base
    groups: dict[str, list[str]] = {}

    for col in df.columns:
        match_suffix = None
        for s in suffixes:
            if col.endswith(s):
                match_suffix = s
                break

        if match_suffix is None:
            # Unsuffixed base name; will be used if suffixed variants exist
            base = col
        else:
            base = col[: -len(match_suffix)]

        groups.setdefault(base, set()).add(col)

    for base, cols in groups.items():
        # Only merge when there is at least one suffixed variant in addition to base
        if len(cols) <= 1:
            continue

        # Establish preference order
        ordered = []
        if base in cols:
            ordered.append(base)
        for s in suffixes:
            candidate = base + s
            if candidate in cols and candidate not in ordered:
                ordered.append(candidate)

        # If some columns were not captured by the fixed suffix list,
        # append them at the end (stable order)
        for c in sorted(cols):
            if c not in ordered:
                ordered.append(c)

        # Combine using first non-null across the group
        combined = df[ordered].bfill(axis=1).iloc[:, 0]

        # Ensure base column exists and assign the merged values
        df[base] = combined

        # Drop all other variants except the base
        drop_cols = [c for c in cols if c != base]
        df = df.drop(columns=drop_cols)

    return df


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

    # Merge duplicated metrics that only differ by suffix (off/def/pass/xg)
    df = merge_suffix_columns(df)

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

    # -----------------------------------------
    # FINAL COLUMN ORDER / SELECTION
    # -----------------------------------------

    desired_order = [
        # --- IDENTIFIERS ---
        "player_season_id",
        "player_id",
        # --- PLAYER INFO ---
        "name",
        "first_name",
        "last_name",
        "age",
        "height",
        "weight",
        # --- TEAM / COMPETITION CONTEXT ---
        "team_id",
        "team_name",
        "team_region_name",
        "league",
        "season",
        "season_id",
        "season_name",
        "tournament_id",
        "tournament_name",
        "tournament_region_code",
        "tournament_region_id",
        "tournament_region_name",
        "tournament_short_name",
        # --- POSITION ---
        "position_text",
        "played_positions",
        "played_positions_short",
        # --- PLAYING TIME ---
        "apps",
        "minutes_played",
        "sub_on",
        # --- DISCIPLINE ---
        "yellow_card",
        "red_card",
        # --- PERFORMANCE: ATTACKING ---
        "goal",
        "assists",
        "shots_per_game",
        "total_shots",
        "xg",
        "xg_per_90",
        "xg_diff",
        "xg_per_shot",
        "key_passes_per_game",
        "dribbles_won_per_game",
        # --- PERFORMANCE: PASSING ---
        "pass_success",
        "total_passes_per_game",
        "accurate_crosses_per_game",
        "accurate_long_passes_per_game",
        "accurate_through_balls_per_game",
        # --- PERFORMANCE: DEFENSIVE ---
        "tackles_per_game",
        "interceptions_per_game",
        "clearances_per_game",
        "outfielder_block_per_game",
        "offside_won_per_game",
        "was_dribbled_per_game",
        "goal_own",
        # --- PHYSICAL / DUELS ---
        "aerial_won_per_game",
        # --- NEGATIVE ACTIONS ---
        "fouls_per_game",
        "foul_given_per_game",
        "dispossessed_per_game",
        "turnover_per_game",
        "offside_given_per_game",
        # --- RATINGS / FLAGS ---
        "rating",
    ]

    existing_cols = [c for c in desired_order if c in df.columns]
    missing_cols = [c for c in desired_order if c not in df.columns]

    if missing_cols:
        print("Warning - missing expected columns (will be skipped):")
        for c in missing_cols:
            print(f"  - {c}")

    df = df[existing_cols]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Rows: {len(df)}")
    print(f"Columns: {df.shape[1]}")
    print(f"Saved cleaned dataset to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

