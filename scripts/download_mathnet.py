"""
Download MathNet problems from HuggingFace and convert to JSON for the website.
MathNet: MIT CSAIL ICLR 2026 — 30,676 Olympiad problems, CC BY 4.0
Repo: https://huggingface.co/datasets/ShadenA/MathNet
"""
import json
import os
import sys
from collections import defaultdict

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'data', 'problems')

# Competitions to download (most relevant for Chinese math competition users)
COMPETITIONS = [
    "IMO",                              # International Mathematical Olympiad
    "IMO_Shortlist",                    # IMO Shortlist
    "China",                            # All Chinese competitions
    "Asia_Pacific_Mathematics_Olympiad_APMO",
    "European_Girls_Mathematical_Olympiad_EGMO",
    "Romanian_Master_of_Mathematics_RMM",
    "Balkan_Mathematical_Olympiad_BMO",
    "USA",                              # USAMO, etc.
    "Russian_National_Olympiad",
]

TOPIC_MAP = {
    "Algebra": "代数",
    "Number Theory": "数论",
    "Geometry": "几何",
    "Combinatorics": "组合",
}

DIFFICULTY_MAP = {
    "easy": "易",
    "medium": "中",
    "hard": "难",
    "very_hard": "极难",
}


def simplify_topics(topics):
    """Extract top-level topic categories."""
    result = []
    if not topics:
        return ["未分类"]
    for t in topics:
        if isinstance(t, str):
            result.append(t)
        elif isinstance(t, list):
            result.append(t[0] if t else "未分类")
    # Map to Chinese
    mapped = []
    for r in result:
        for en, zh in TOPIC_MAP.items():
            if en.lower() in r.lower():
                mapped.append(zh)
                break
        else:
            mapped.append(r)
    return list(set(mapped)) if mapped else ["未分类"]


def safe_get(row, key, default=""):
    """Safely get a field from a dataset row."""
    val = row.get(key, default)
    if val is None:
        return default
    return val


def process_row(row, competition_name):
    """Convert a MathNet row to our problem format."""
    problem_md = safe_get(row, "problem_markdown")
    solutions = safe_get(row, "solutions_markdown")
    if isinstance(solutions, list):
        solutions = "\n\n---\n\n".join(s for s in solutions if s)
    elif not isinstance(solutions, str):
        solutions = ""

    topics = safe_get(row, "topics")
    if isinstance(topics, str):
        topics = [topics]

    year = safe_get(row, "year")
    try:
        year = int(year)
    except (ValueError, TypeError):
        year = 0

    difficulty = safe_get(row, "difficulty", "medium")
    if isinstance(difficulty, (int, float)):
        if difficulty <= 2:
            difficulty = "easy"
        elif difficulty <= 3:
            difficulty = "medium"
        else:
            difficulty = "hard"

    unique_id = safe_get(row, "unique_id", "")
    language = safe_get(row, "language", "en")

    # Build a readable title
    comp_short = competition_name.replace("_", " ")[:40]
    title = f"{comp_short} {year}"

    return {
        "id": unique_id or f"{competition_name}-{year}-{hash(problem_md) & 0xFFFF:04x}",
        "title": title,
        "competition": competition_name,
        "year": year,
        "language": language,
        "difficulty": difficulty,
        "difficulty_zh": DIFFICULTY_MAP.get(difficulty, "中"),
        "topics": simplify_topics(topics),
        "raw_topics": topics if isinstance(topics, list) else [topics],
        "problem_md": problem_md,
        "solution_md": solutions,
    }


def download_config(dataset_name, config, competition_name):
    """Download a specific competition config from MathNet."""
    from datasets import load_dataset

    print(f"  Downloading {competition_name}...", end=" ", flush=True)
    try:
        ds = load_dataset(dataset_name, config, split="train")
    except Exception as e:
        print(f"SKIP: {e}")
        return []

    problems = []
    for row in ds:
        try:
            p = process_row(row, competition_name)
            if p["problem_md"]:
                problems.append(p)
        except Exception as e:
            print(f"\n    WARN: error processing row: {e}")
            continue

    print(f"{len(problems)} problems")
    return problems


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    all_problems = []
    index_entries = []
    stats = defaultdict(int)

    for comp in COMPETITIONS:
        problems = download_config("ShadenA/MathNet", comp, comp)
        if not problems:
            continue

        # Save per-competition file
        fname = f"{comp}.json"
        fpath = os.path.join(OUT_DIR, fname)
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(problems, f, ensure_ascii=False)

        print(f"    Saved {fpath} ({len(problems)} problems, {os.path.getsize(fpath)/1024:.0f} KB)")

        # Build index entries (lightweight, no full problem text)
        for p in problems:
            index_entries.append({
                "id": p["id"],
                "title": p["title"],
                "competition": p["competition"],
                "year": p["year"],
                "difficulty": p["difficulty"],
                "difficulty_zh": p["difficulty_zh"],
                "topics": p["topics"],
                "language": p["language"],
            })
            stats[p["competition"]] += 1
            for t in p["topics"]:
                stats[f"topic:{t}"] += 1

        all_problems.extend(problems)

    # Save master index
    index_path = os.path.join(OUT_DIR, "_index.json")
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump({
            "total": len(all_problems),
            "competitions": sorted(stats.keys(), key=lambda k: (-stats[k], k)),
            "entries": index_entries,
        }, f, ensure_ascii=False)

    print(f"\n{'='*50}")
    print(f"Total: {len(all_problems)} problems from {len([c for c in COMPETITIONS if stats[c]])} competitions")
    print(f"Index: {index_path} ({os.path.getsize(index_path)/1024:.0f} KB)")

    # Print per-competition breakdown
    for comp in sorted(stats.keys(), key=lambda k: -stats[k]):
        if not comp.startswith("topic:"):
            print(f"  {comp}: {stats[comp]}")
    for comp in sorted(stats.keys(), key=lambda k: -stats[k]):
        if comp.startswith("topic:"):
            print(f"  {comp}: {stats[comp]}")

    print("\nDone!")


if __name__ == "__main__":
    main()
