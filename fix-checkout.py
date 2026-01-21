from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable


BAD_TOKENS = [
    # Newer observed mojibake pattern (UTF-8 bytes decoded with a Cyrillic single-byte codec)
    # Shows up as sequences like: "тХи╨Б..."
    "тХ",
    "ТХ",
    "тХи",
    "ТХИ",

    "╨",
    "╤",
    "Ð",
    "Ñ",
    "в‚¬",
    "Р»РІ",
    "â€",
    "â€™",
    "â€œ",
    "â€�",
    "â€“",
    "â€”",
    "Â",
    "џ",
    "ѓ",
    "ќ",
    "њ",
    "љ",
    "ѕ",
    "ј",
    "ў",
]


def bad_score(text: str) -> int:
    score = 0
    for token in BAD_TOKENS:
        score += text.count(token)
    return score


def try_redecode(text: str, assumed_wrong_decode: str) -> str | None:
    """Attempt to undo mojibake.

    If original bytes were UTF-8 but were decoded as `assumed_wrong_decode`,
    re-encode using that encoding and decode as UTF-8.
    """
    try:
        raw = text.encode(assumed_wrong_decode)
        return raw.decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError, LookupError):
        return None


def fix_text_once(text: str) -> str:
    candidates: list[str] = [text]

    # Common mojibake patterns observed:
    # - cp1251-decoded UTF-8: "РџР»РѕРІРґРёРІ" -> "Пловдив"
    # - cp866-decoded UTF-8:  "╨б╨░╨»..." -> "Сал..."
    # - latin1-decoded UTF-8: "ÐÐ»Ð¾..." -> "Пло..."
    # Extra encodings seen in the wild when mojibake is introduced by decoding UTF-8
    # bytes with a Cyrillic single-byte codec.
    for enc in ("cp1251", "cp866", "latin1", "koi8_r", "koi8_u", "mac_cyrillic", "cp855"):
        recoded = try_redecode(text, enc)
        if recoded is not None:
            candidates.append(recoded)

    return min(candidates, key=bad_score)


def fix_text(text: str, max_passes: int = 4) -> str:
    prev = text
    for _ in range(max_passes):
        cur = fix_text_once(prev)
        if cur == prev:
            break
        prev = cur
    return prev


def walk_and_fix_json(value: Any) -> Any:
    if isinstance(value, str):
        return fix_text(value)
    if isinstance(value, list):
        return [walk_and_fix_json(v) for v in value]
    if isinstance(value, dict):
        fixed: dict[Any, Any] = {}
        for k, v in value.items():
            new_key = fix_text(k) if isinstance(k, str) else k
            new_value = walk_and_fix_json(v)
            if new_key in fixed and new_key != k:
                # Extremely unlikely, but avoid silently dropping data.
                print(f"WARN: key collision after fix: {k!r} -> {new_key!r}")
                continue
            fixed[new_key] = new_value
        return fixed
    return value


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def read_text_json(path: Path) -> str:
    # Some exports (and Windows tools) prepend a UTF-8 BOM which breaks json.loads
    # unless we decode as utf-8-sig.
    return path.read_bytes().decode("utf-8-sig", errors="replace")


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8", newline="\n")


def ensure_backup(path: Path) -> Path:
    backup_path = path.with_suffix(path.suffix + ".bak")
    if not backup_path.exists():
        backup_path.write_bytes(path.read_bytes())
    return backup_path


def fix_file(path: Path) -> bool:
    if not path.exists():
        print(f"SKIP missing: {path}")
        return False

    ensure_backup(path)

    if path.suffix.lower() == ".json":
        raw = read_text_json(path)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise SystemExit(f"ERROR: {path} is not valid JSON: {e}")

        fixed = walk_and_fix_json(data)
        out = json.dumps(fixed, ensure_ascii=False, indent=2) + "\n"
        if out == raw:
            print(f"OK no-change: {path}")
            return False

        write_text(path, out)
        print(f"FIXED: {path}")
        return True

    raw = read_text(path)
    fixed = fix_text(raw)
    if fixed == raw:
        print(f"OK no-change: {path}")
        return False

    write_text(path, fixed)
    print(f"FIXED: {path}")
    return True


def default_files() -> list[Path]:
    candidates = [
        Path("public/checkout.js"),
        Path("public/app.js"),
        Path("database_server.json"),
    ]
    return [p for p in candidates if p.exists()]


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Fix common Cyrillic mojibake in checkout/app JS and database JSON "
            "(creates .bak backups)."
        )
    )
    parser.add_argument(
        "--files",
        nargs="*",
        help=(
            "Files to fix (defaults to public/checkout.js, public/app.js, "
            "database_server.json if present)"
        ),
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    files = [Path(p) for p in args.files] if args.files else default_files()
    if not files:
        print("No target files found. Use --files to specify paths.")
        return 2

    changed_any = False
    for f in files:
        changed_any = fix_file(f) or changed_any

    print("Done: changes applied." if changed_any else "Done: no changes needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
