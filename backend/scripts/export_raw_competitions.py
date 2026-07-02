"""
Export every distinct (config, competition) raw name across ALL 18 MathNet
configs, with counts and sample problems, for the competition-normalization
pass (Fable 5 -> backend/data/competitions/{registry,assignments}.json).

Output: backend/data/competitions/raw_names.json

  py backend/scripts/export_raw_competitions.py
"""
import glob
import json
import os
import re
from collections import defaultdict

import pyarrow.parquet as pa_pq
from huggingface_hub import snapshot_download

REPO = 'ShadenA/MathNet'
CONFIGS = [
    'Asia_Pacific_Mathematics_Olympiad_APMO',
    'Balkan_Mathematical_Olympiad',
    'Canada',
    'China',
    "European_Girls'_Mathematical_Olympiad_EGMO",
    'Hong_Kong',
    'IMO',
    'India',
    'Iran',
    'Japan',
    'Romania',
    'Romanian_Master_of_Mathematics_RMM',
    'Russia',
    'Singapore',
    'South_Korea',
    'Taiwan',
    'United_States',
    'Vietnam',
]

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
OUT_DIR = os.path.join(BACKEND, 'data', 'competitions')
OUT_PATH = os.path.join(OUT_DIR, 'raw_names.json')

YEAR_RE = re.compile(r'\b(19[5-9]\d|20[0-4]\d)\b')
ORD_RE = re.compile(r'\b(\d{1,3})\s*(?:st|nd|rd|th)\b', re.I)
ROC_RE = re.compile(r'[一二三四五六七八九十〇零百]{2,4}學年度|[一二三四五六七八九十〇零百]{2,4}学年度')
ROMAN_RE = re.compile(r'\b[IVXLC]{2,}\b')


def main():
    snap = snapshot_download(
        REPO, repo_type='dataset',
        allow_patterns=[f'data/{c}/*.parquet' for c in CONFIGS])

    groups = defaultdict(lambda: {'count': 0, 'sample_ids': [], 'sample_texts': []})
    total = 0
    for config in CONFIGS:
        pqs = sorted(glob.glob(os.path.join(snap, 'data', config, '*.parquet')))
        for pqf in pqs:
            table = pa_pq.read_table(pqf, columns=['id', 'competition', 'problem_markdown'])
            for r in table.to_pylist():
                total += 1
                comp = (r.get('competition') or '').strip()
                g = groups[(config, comp)]
                g['count'] += 1
                if len(g['sample_ids']) < 3:
                    g['sample_ids'].append(r['id'])
                if len(g['sample_texts']) < 1:
                    txt = re.sub(r'\s+', ' ', (r.get('problem_markdown') or ''))[:150]
                    g['sample_texts'].append(txt)
        print(f'  {config}: rows so far {total}', flush=True)

    entries = []
    for (config, comp), g in sorted(groups.items(),
                                    key=lambda kv: (kv[0][0], -kv[1]['count'])):
        entries.append({
            'config': config,
            'competition': comp,
            'count': g['count'],
            'year_explicit': bool(YEAR_RE.search(comp)),
            'ordinal': bool(ORD_RE.search(comp)),
            'roc_year': bool(ROC_RE.search(comp)),
            'roman': bool(ROMAN_RE.search(comp)),
            'sample_ids': g['sample_ids'],
            'sample_text': g['sample_texts'][0] if g['sample_texts'] else '',
        })

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'total_rows': total, 'distinct': len(entries),
                   'entries': entries}, f, ensure_ascii=False, indent=1)
    print(f'\nDONE: {total} rows, {len(entries)} distinct (config, competition)')
    print(f'-> {OUT_PATH}')

    per_cfg = defaultdict(int)
    for e in entries:
        per_cfg[e['config']] += 1
    for cfg, n in sorted(per_cfg.items()):
        print(f'  {cfg}: {n} distinct names')


if __name__ == '__main__':
    main()
