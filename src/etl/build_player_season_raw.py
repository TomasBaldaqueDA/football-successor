import json
import pandas as pd
from pathlib import Path

# -----------------------------------------
# PATHS
# -----------------------------------------

RAW_DATA_PATH = Path("data_raw")
OUTPUT_PATH = Path("data/staging/player_season_raw.csv")

print("Football Successor - Player Season Builder")

# -----------------------------------------
# FUNCTION TO LOAD JSON
# -----------------------------------------

def load_json(file_path):

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return pd.DataFrame(data["playerTableStats"])


print("Setup complete.")