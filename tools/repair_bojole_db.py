import json
import os
import shutil
import sys
import time
from typing import Any, Dict

BOJOLE_DB_PATH = "/opt/resturant-website/database.json"
OLD_ID = "rest_lauta_002"
NEW_ID = "rest_bojole_001"


def deep_replace_restaurant_id(obj: Any) -> Any:
    if isinstance(obj, str):
        return NEW_ID if obj == OLD_ID else obj

    if isinstance(obj, list):
        return [deep_replace_restaurant_id(x) for x in obj]

    if isinstance(obj, dict):
        new_obj: Dict[str, Any] = {}
        for k, v in obj.items():
            new_key = NEW_ID if k == OLD_ID else k
            new_val = deep_replace_restaurant_id(v)
            if new_key in new_obj and isinstance(new_obj[new_key], dict) and isinstance(new_val, dict):
                # Merge dicts (keep existing, fill missing)
                merged = dict(new_obj[new_key])
                for mk, mv in new_val.items():
                    if mk not in merged:
                        merged[mk] = mv
                new_obj[new_key] = merged
            else:
                new_obj[new_key] = new_val
        return new_obj

    return obj


def main() -> int:
    db_path = os.environ.get("DB_PATH", BOJOLE_DB_PATH)

    if not os.path.exists(db_path):
        print(f"ERROR: DB not found: {db_path}")
        return 2

    ts = time.strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.bakfix_{ts}"
    shutil.copy2(db_path, backup_path)

    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)

    # Replace all references of OLD_ID -> NEW_ID within this instance DB.
    db = deep_replace_restaurant_id(db)

    # Normalize restaurants array: remove any remaining OLD_ID and dedupe by id.
    restaurants = db.get("restaurants")
    if isinstance(restaurants, list):
        out = []
        seen = set()
        for r in restaurants:
            if not isinstance(r, dict):
                continue
            rid = str(r.get("id") or "").strip()
            if rid == OLD_ID:
                continue
            if rid in seen:
                continue
            seen.add(rid)
            out.append(r)
        db["restaurants"] = out

    # Users: remove lauta_admin from this Bojole instance.
    users = db.get("users")
    if isinstance(users, list):
        filtered = []
        removed = 0
        for u in users:
            if not isinstance(u, dict):
                continue
            username = str(u.get("username") or "").strip().lower()
            if username == "lauta_admin":
                removed += 1
                continue
            filtered.append(u)
        db["users"] = filtered
        if removed:
            print(f"Removed users: {removed} (lauta_admin)")

    # Tokens: force logout to prevent cross-tenant stale tokens.
    if isinstance(db.get("authTokens"), dict) and db.get("authTokens"):
        db["authTokens"] = {}
        print("Cleared authTokens")

    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("OK")
    print(f"Backup: {backup_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
