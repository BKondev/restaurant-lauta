import json
import os
import shutil
import sys
import time

DB_PATH = os.environ.get("DB_PATH", "/opt/resturant-website/database.json")
RID = os.environ.get("RESTAURANT_ID", "rest_bojole_001")
USERNAME = os.environ.get("ADMIN_USERNAME", "bojole_admin")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "bojole123")


def main() -> int:
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Missing {DB_PATH}")
        return 2

    ts = time.strftime("%Y%m%d_%H%M%S")
    backup_path = f"{DB_PATH}.bakcreds_{ts}"
    shutil.copy2(DB_PATH, backup_path)

    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    restaurants = db.get("restaurants")
    if not isinstance(restaurants, list) or not restaurants:
        print("ERROR: db.restaurants missing")
        return 3

    r = next((x for x in restaurants if isinstance(x, dict) and str(x.get("id") or "").strip() == RID), None)
    if not isinstance(r, dict):
        print(f"ERROR: Restaurant not found: {RID}")
        return 4

    r["username"] = USERNAME
    r["password"] = PASSWORD

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("OK")
    print(f"Backup: {backup_path}")
    print(f"Set primary admin for {RID}: {USERNAME}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
