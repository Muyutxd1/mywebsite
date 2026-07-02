"""
Export untranslated problem/solution units as translation work shards.

Reads all 18 MathNet configs, computes the content-hash key for every problem
statement and every solution, diffs against the merged translation sidecar
(backend/data/translations/zh.jsonl), and writes the *missing* units as input
shards under backend/data/translations/shards/todo_NNNN.jsonl.

Re-running after a partial translation run automatically produces only the
remaining gap — this is the resume mechanism.

  py backend/scripts/export_translation_input.py
  py backend/scripts/export_translation_input.py --shard-chars 30000
"""
import argparse
import glob
import hashlib
import json
import os
import re

import pyarrow.parquet as pa_pq
from huggingface_hub import snapshot_download

REPO = 'ShadenA/MathNet'
CONFIGS = [
    'Asia_Pacific_Mathematics_Olympiad_APMO', 'Balkan_Mathematical_Olympiad',
    'Canada', 'China', "European_Girls'_Mathematical_Olympiad_EGMO",
    'Hong_Kong', 'IMO', 'India', 'Iran', 'Japan', 'Romania',
    'Romanian_Master_of_Mathematics_RMM', 'Russia', 'Singapore',
    'South_Korea', 'Taiwan', 'United_States', 'Vietnam',
]
CONFIG_PREFIX = {
    'Asia_Pacific_Mathematics_Olympiad_APMO': 'AP',
    'Balkan_Mathematical_Olympiad': 'BK', 'Canada': 'CA', 'China': 'CN',
    "European_Girls'_Mathematical_Olympiad_EGMO": 'EG', 'Hong_Kong': 'HK',
    'IMO': 'IMO', 'India': 'IN', 'Iran': 'IR', 'Japan': 'JP', 'Romania': 'RO',
    'Romanian_Master_of_Mathematics_RMM': 'RM', 'Russia': 'RU',
    'Singapore': 'SG', 'South_Korea': 'KR', 'Taiwan': 'TW',
    'United_States': 'US', 'Vietnam': 'VN',
}

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
TR_DIR = os.path.join(BACKEND, 'data', 'translations')
ZH_PATH = os.path.join(TR_DIR, 'zh.jsonl')
SHARDS_DIR = os.path.join(TR_DIR, 'shards')


def content_key(kind, raw_md):
    norm = re.sub(r'\s+', ' ', (raw_md or '').strip())
    h = hashlib.sha256(norm.encode('utf-8')).hexdigest()[:16]
    return f'{"p" if kind == "problem" else "s"}:{h}'


def load_done_keys():
    done = set()
    if os.path.exists(ZH_PATH):
        with open(ZH_PATH, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if o.get('k') and o.get('zh'):
                    done.add(o['k'])
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shard-chars', type=int, default=30000)
    args = ap.parse_args()

    snap = snapshot_download(
        REPO, repo_type='dataset',
        allow_patterns=[f'data/{c}/*.parquet' for c in CONFIGS])
    done = load_done_keys()

    units = {}  # k -> unit (dedupe across configs)
    total_units = 0
    for config in CONFIGS:
        prefix = CONFIG_PREFIX[config]
        for pqf in sorted(glob.glob(os.path.join(snap, 'data', config, '*.parquet'))):
            table = pa_pq.read_table(
                pqf, columns=['id', 'problem_markdown', 'solutions_markdown'])
            for r in table.to_pylist():
                pid = f'{prefix}-{r["id"]}'
                pm = r.get('problem_markdown') or ''
                if pm.strip():
                    total_units += 1
                    k = content_key('problem', pm)
                    if k not in done and k not in units:
                        units[k] = {'k': k, 'kind': 'problem', 'id': pid,
                                    'sol_idx': None, 'src': pm}
                for i, s in enumerate(r.get('solutions_markdown') or []):
                    if (s or '').strip():
                        total_units += 1
                        k = content_key('solution', s)
                        if k not in done and k not in units:
                            units[k] = {'k': k, 'kind': 'solution', 'id': pid,
                                        'sol_idx': i, 'src': s}

    os.makedirs(SHARDS_DIR, exist_ok=True)
    for old in glob.glob(os.path.join(SHARDS_DIR, 'todo_*.jsonl')):
        os.remove(old)

    ordered = [units[k] for k in sorted(units)]
    shard_no, buf, buf_chars, written = 1, [], 0, 0
    def flush():
        nonlocal shard_no, buf, buf_chars, written
        if not buf:
            return
        path = os.path.join(SHARDS_DIR, f'todo_{shard_no:04d}.jsonl')
        with open(path, 'w', encoding='utf-8') as f:
            for u in buf:
                f.write(json.dumps(u, ensure_ascii=False) + '\n')
        written += len(buf)
        shard_no += 1
        buf, buf_chars = [], 0
    for u in ordered:
        if buf and buf_chars + len(u['src']) > args.shard_chars:
            flush()
        buf.append(u)
        buf_chars += len(u['src'])
    flush()

    print(f'total units in dataset: {total_units} '
          f'(unique by content: dedup applied)')
    print(f'already translated: {len(done)} keys')
    print(f'remaining unique units: {len(ordered)} -> {shard_no - 1} shards '
          f'in {SHARDS_DIR}')


if __name__ == '__main__':
    main()
