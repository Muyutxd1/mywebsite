"""
Export the per-problem inputs the LLM enrichment pass needs, one JSON object
per line, ordered by id (stable, so a workflow can address slices by offset).

Output: backend/data/enrichment/input.jsonl

Fields kept small: the problem statement is truncated and the solution is
reduced to a length signal (a strong difficulty proxy) rather than full text.

  py backend/scripts/export_enrichment_input.py                  # all rows
  py backend/scripts/export_enrichment_input.py --missing-only   # only rows
      with no difficulty yet (top-up pass for newly added configs)
"""
import argparse
import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
DB = os.path.join(BACKEND, 'data', 'problems.db')
OUT_DIR = os.path.join(BACKEND, 'data', 'enrichment')
OUT = os.path.join(OUT_DIR, 'input.jsonl')

PROBLEM_TRUNC = 900


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--missing-only', action='store_true',
                    help='only problems with no difficulty yet')
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    where = ' WHERE p.difficulty IS NULL' if args.missing_only else ''
    rows = con.execute(
        "SELECT p.id, p.country_zh, p.competition_raw, c.name_zh comp_zh, "
        "c.name_en comp_en, c.tier, p.round_key, p.year, p.problem_type, "
        "p.problem_md, p.has_solution, p.categories_json "
        f"FROM problems p JOIN competitions c ON c.comp_key = p.comp_key{where} "
        "ORDER BY p.id").fetchall()

    n = 0
    with open(OUT, 'w', encoding='utf-8') as f:
        for r in rows:
            d = dict(r)
            sol_len = con.execute(
                "SELECT COALESCE(MAX(LENGTH(solution_md)), 0) m FROM solutions "
                "WHERE problem_id = ?", (d['id'],)).fetchone()['m']
            cats = json.loads(d['categories_json'] or '[]')
            l1 = sorted({c.split('>')[0].strip() for c in cats})
            pm = d['problem_md'] or ''
            obj = {
                'id': d['id'],
                'country_zh': d['country_zh'],
                'competition': d['comp_zh'],
                'competition_en': d['comp_en'],
                'competition_raw': d['competition_raw'],
                'tier': d['tier'],
                'round': d['round_key'],
                'year': d['year'],
                'year_known': bool(d['year']),
                'problem_type': d['problem_type'],
                'topics': l1,
                'solution_len': sol_len,
                'has_solution': bool(d['has_solution']),
                'problem': pm[:PROBLEM_TRUNC] + ('…' if len(pm) > PROBLEM_TRUNC else ''),
            }
            f.write(json.dumps(obj, ensure_ascii=False) + '\n')
            n += 1
    con.close()
    print(f'wrote {n} rows -> {OUT}')


if __name__ == '__main__':
    main()
