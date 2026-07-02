"""
Merge per-batch enrichment shards into a single validated enrichment.jsonl that
``build_problems.py`` consumes. Idempotent; last-write-wins per id.

  seed:   backend/data/enrichment/enrichment.jsonl (existing merged output —
          shards are gitignored and may be gone, so never start from empty)
  shards: backend/data/enrichment/shards/shard_*.jsonl
  output: backend/data/enrichment/enrichment.jsonl

Each shard line: {id, difficulty, difficulty_score, year?, problem_number?, rationale_zh?}
We validate the band<->score consistency (clamp band to score), add difficulty_zh
and provenance, and drop anything malformed.
"""
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
ENR = os.path.join(BACKEND, 'data', 'enrichment')
SHARDS = os.path.join(ENR, 'shards')
OUT = os.path.join(ENR, 'enrichment.jsonl')

DIFF_ZH = {'easy': '易', 'medium': '中', 'hard': '难', 'elite': '极难'}


def band_for_score(score):
    if score <= 25:
        return 'easy'
    if score <= 55:
        return 'medium'
    if score <= 80:
        return 'hard'
    return 'elite'


def main():
    merged = {}
    # Seed from the existing merged sidecar so a shard-less rerun (fresh
    # worktree: shards are gitignored) never wipes prior enrichment.
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if o.get('id'):
                    merged[o['id']] = o
    n_seed = len(merged)
    n_files = 0
    for path in sorted(glob.glob(os.path.join(SHARDS, 'shard_*.jsonl'))):
        n_files += 1
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    continue
                pid = o.get('id')
                diff = o.get('difficulty')
                score = o.get('difficulty_score')
                if not pid or diff not in DIFF_ZH or not isinstance(score, int):
                    continue
                score = max(1, min(100, score))
                # keep score, but make the band consistent with it
                band = band_for_score(score)
                rec = {
                    'id': pid,
                    'difficulty': band,
                    'difficulty_zh': DIFF_ZH[band],
                    'difficulty_score': score,
                    'difficulty_source': 'llm',
                }
                yr = o.get('year')
                if isinstance(yr, int) and 1950 <= yr <= 2026:
                    rec['year'] = yr
                pn = o.get('problem_number')
                if isinstance(pn, str) and pn.strip():
                    rec['problem_number'] = pn.strip()[:16]
                rat = o.get('rationale_zh')
                if isinstance(rat, str) and rat.strip():
                    rec['rationale_zh'] = rat.strip()[:120]
                merged[pid] = rec  # last wins

    with open(OUT, 'w', encoding='utf-8') as f:
        for rec in merged.values():
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

    from collections import Counter
    dist = Counter(r['difficulty'] for r in merged.values())
    yrs = sum(1 for r in merged.values() if 'year' in r)
    pns = sum(1 for r in merged.values() if 'problem_number' in r)
    print(f'merged {len(merged)} ratings ({n_seed} seeded + shards from '
          f'{n_files} files) -> {OUT}')
    print(f'  difficulty: {dict(dist)}')
    print(f'  llm-filled years: {yrs} | problem_numbers: {pns}')


if __name__ == '__main__':
    main()
