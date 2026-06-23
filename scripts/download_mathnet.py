"""
Download MathNet problems from HuggingFace and convert to JSON for the website.
MathNet v2: fixed field mapping — uses topics_flat, extracts year from competition string.
"""
import json
import os
import re
from collections import defaultdict

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'data', 'problems')

# Config names must match EXACTLY what HuggingFace expects
COMPETITIONS = [
    "IMO",
    "China",
    "Asia_Pacific_Mathematics_Olympiad_APMO",
    "Romanian_Master_of_Mathematics_RMM",
    "United_States",
    "Russia",
    "Taiwan",
    "Hong_Kong",
    "Japan",
    "South_Korea",
    "Vietnam",
    "Singapore",
    "India",
    "Iran",
    "Balkan_Mathematical_Olympiad",
    "European_Girls'_Mathematical_Olympiad_EGMO",
    "Romania",
    "Canada",
    "United_Kingdom",   # might not exist, will SKIP gracefully
]

TOPIC_MAP = {
    "Algebra": "代数",
    "Number Theory": "数论",
    "Geometry": "几何",
    "Combinatorics": "组合",
}

# Friendly display names
COMPETITION_NAMES = {
    "IMO": "IMO",
    "China": "中国",
    "Asia_Pacific_Mathematics_Olympiad_APMO": "APMO",
    "Romanian_Master_of_Mathematics_RMM": "RMM",
    "United_States": "美国",
    "Russia": "俄罗斯",
    "Taiwan": "台湾",
    "Hong_Kong": "香港",
    "Japan": "日本",
    "South_Korea": "韩国",
    "Vietnam": "越南",
    "Singapore": "新加坡",
    "India": "印度",
    "Iran": "伊朗",
    "Balkan_Mathematical_Olympiad": "Balkan MO",
    "European_Girls'_Mathematical_Olympiad_EGMO": "EGMO",
    "Romania": "罗马尼亚",
    "Canada": "加拿大",
}


def extract_year(competition_str):
    """Extract 4-digit year from competition string like 'IMO 2006 Shortlisted Problems'."""
    m = re.search(r'\b(19\d{2}|20\d{2})\b', str(competition_str))
    if m:
        return int(m.group(1))
    return 0


def simplify_topics(topics_flat):
    """Extract top-level topic categories from hierarchical topic strings."""
    if not topics_flat:
        return ["未分类"]
    result = set()
    for t in topics_flat:
        if not isinstance(t, str):
            continue
        # "Algebra > Sequences > Recurrence" → "Algebra"
        top = t.split(">")[0].strip()
        for en, zh in TOPIC_MAP.items():
            if en.lower() in top.lower():
                result.add(zh)
                break
        else:
            result.add(top)
    return sorted(result) if result else ["未分类"]


def process_row(row, config_name, index):
    """Convert a MathNet row to our problem format."""
    problem_md = row.get("problem_markdown", "")
    if not problem_md:
        return None

    # Solutions
    solutions = row.get("solutions_markdown", "")
    if isinstance(solutions, list):
        solutions = "\n\n---\n\n".join(s for s in solutions if s)
    elif not isinstance(solutions, str):
        solutions = ""

    # Topics from topics_flat
    topics_flat = row.get("topics_flat", [])
    if isinstance(topics_flat, str):
        topics_flat = [topics_flat]
    topics = simplify_topics(topics_flat)

    # Year from competition string
    competition_str = row.get("competition", "")
    year = extract_year(competition_str)

    # Language
    language = row.get("language", "English")
    if language == "English":
        language = "en"
    elif language == "Chinese":
        language = "zh"
    else:
        language = language[:2].lower() if language else "en"

    # Problem type
    prob_type = row.get("problem_type", "")

    # Build descriptive ID: IMO-2006-001
    comp_short = COMPETITION_NAMES.get(config_name, config_name[:12])
    year_str = str(year) if year > 0 else "????"
    pid = f"{comp_short}-{year_str}-{index:03d}"

    # Build title
    title = f"{comp_short} {year_str} #{index}"

    return {
        "id": pid,
        "title": title,
        "competition": config_name,
        "competition_zh": COMPETITION_NAMES.get(config_name, config_name),
        "year": year,
        "language": language,
        "difficulty": "",
        "difficulty_zh": "",
        "topics": topics,
        "problem_type": prob_type,
        "problem_md": problem_md,
        "solution_md": solutions,
    }


def download_config(config_name):
    """Download a specific competition config from MathNet."""
    from datasets import load_dataset

    print(f"  Downloading {config_name}...", end=" ", flush=True)
    try:
        ds = load_dataset("ShadenA/MathNet", config_name, split="train")
    except Exception as e:
        print(f"SKIP: {e}")
        return []

    problems = []
    for i, row in enumerate(ds, 1):
        try:
            p = process_row(row, config_name, i)
            if p:
                problems.append(p)
        except Exception as e:
            print(f"\n    WARN row {i}: {e}")
            continue

    print(f"{len(problems)} problems")
    return problems


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Delete old data
    for f in os.listdir(OUT_DIR):
        if f.endswith('.json'):
            os.remove(os.path.join(OUT_DIR, f))

    all_problems = []
    index_entries = []
    stats = defaultdict(int)

    for comp in COMPETITIONS:
        problems = download_config(comp)
        if not problems:
            continue

        fname = f"{comp}.json"
        fpath = os.path.join(OUT_DIR, fname)
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(problems, f, ensure_ascii=False)

        size_kb = os.path.getsize(fpath) / 1024
        print(f"    Saved {fname} ({len(problems)} problems, {size_kb:.0f} KB)")

        for p in problems:
            index_entries.append({
                "id": p["id"],
                "title": p["title"],
                "competition": p["competition"],
                "competition_zh": p["competition_zh"],
                "year": p["year"],
                "difficulty": p["difficulty"],
                "difficulty_zh": p["difficulty_zh"],
                "topics": p["topics"],
                "language": p["language"],
            })
            stats[p["competition"]] += 1
            for t in p["topics"]:
                if t != "未分类":
                    stats[f"topic:{t}"] += 1

        all_problems.extend(problems)

    # Save master index
    index_path = os.path.join(OUT_DIR, "_index.json")
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump({
            "total": len(all_problems),
            "competitions": sorted([c for c in COMPETITIONS if stats.get(c)], key=lambda k: -stats[k]),
            "entries": index_entries,
        }, f, ensure_ascii=False)

    print(f"\n{'='*50}")
    print(f"Total: {len(all_problems)} problems from {sum(1 for c in COMPETITIONS if stats.get(c))} competitions")
    print(f"Index: {index_path} ({os.path.getsize(index_path)/1024:.0f} KB)")

    for comp in sorted(stats, key=lambda k: -stats[k]):
        if not comp.startswith("topic:"):
            print(f"  {comp}: {stats[comp]}")
    for comp in sorted(stats, key=lambda k: -stats[k]):
        if comp.startswith("topic:"):
            print(f"  {comp}: {stats[comp]}")

    print("\nDone!")


if __name__ == "__main__":
    main()
