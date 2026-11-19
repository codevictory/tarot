#!/usr/bin/env python3
"""Regenerate klapi's api/Database/reset-tarot-cards.sql from data/cards.json
(English) + data/cards.fi.json (Finnish) in this repo.

Run from the tarot repo root:

    npm run generate-reset-sql

The generated file resets the TarotCards table to exactly the 78 cards and
fills TarotCardTranslations with both the 'en' and 'fi' texts. Apply it with
`just reset-tarot-cards` from the klapi repo root.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS_JSON = os.path.join(ROOT, "data", "cards.json")
FI_JSON = os.path.join(ROOT, "data", "cards.fi.json")
OUT_SQL = os.path.join(ROOT, "..", "klapi", "api", "Database", "reset-tarot-cards.sql")

# Languages written to TarotCardTranslations, in insertion order. English is
# always derived from the base card fields; the rest come from data/cards.<lang>.json.
EXTRA_LANGS = ["fi"]


def sql_str(value):
    return "'" + str(value).replace("'", "''") + "'"


def main():
    with open(CARDS_JSON, encoding="utf-8") as f:
        cards = json.load(f)
    if not isinstance(cards, list) or len(cards) != 78:
        raise SystemExit(f"{CARDS_JSON} must contain exactly 78 cards")

    translations = {}
    for lang in EXTRA_LANGS:
        path = os.path.join(ROOT, "data", f"cards.{lang}.json")
        with open(path, encoding="utf-8") as f:
            translations[lang] = json.load(f)

    lines = [
        "-- Resets the TarotCards table to exactly the 78 cards from this repo",
        "-- (data/cards.json + data/cards.fi.json) and fills TarotCardTranslations",
        "-- with the English ('en') and Finnish ('fi') texts. Generated file;",
        "-- regenerate instead of editing by hand:",
        "--   npm run generate-reset-sql   (from the tarot repo root)",
        "-- Run via: just reset-tarot-cards   (from the klapi repo root)",
        "-- Or manually: sqlite3 api/Database/klapi.db < api/Database/reset-tarot-cards.sql",
        "",
        "PRAGMA foreign_keys = ON;",
        "",
        "BEGIN TRANSACTION;",
        "",
        "DELETE FROM TarotCardTranslations;",
        "DELETE FROM TarotCards;",
        "",
        "INSERT INTO TarotCards (id, title, arcana, image, description, sortOrder, lastUpdated) VALUES",
    ]
    for i, c in enumerate(cards):
        comma = "," if i < len(cards) - 1 else ";"
        lines.append(
            "  ({}, {}, {}, {}, {}, {}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')){}".format(
                sql_str(c["id"]), sql_str(c["title"]), sql_str(c["arcana"]),
                sql_str(c["image"]), sql_str(c["description"]), int(c.get("sortOrder", i)), comma,
            )
        )
    lines.append("")
    lines.append("INSERT INTO TarotCardTranslations (cardId, language, title, arcana, description) VALUES")
    rows = []
    for c in cards:
        rows.append((c["id"], "en", c["title"], c["arcana"], c["description"]))
        for lang in EXTRA_LANGS:
            t = translations[lang].get(c["id"])
            if t is None:
                raise SystemExit(f"missing {lang} translation for card {c['id']!r}")
            rows.append((c["id"], lang, t["title"], t["arcana"], t["description"]))
    for i, (cid, lang, title, arcana, desc) in enumerate(rows):
        comma = "," if i < len(rows) - 1 else ";"
        lines.append("  ({}, {}, {}, {}, {}){}".format(
            sql_str(cid), sql_str(lang), sql_str(title), sql_str(arcana), sql_str(desc), comma,
        ))
    lines.append("")
    lines.append("COMMIT;")
    lines.append("")

    with open(OUT_SQL, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {OUT_SQL}: {len(cards)} cards, {len(rows)} translation rows")


if __name__ == "__main__":
    main()
