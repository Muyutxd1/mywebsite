"""
Validate + merge translation output shards into the merged sidecar.

Reads backend/data/translations/shards/out_*.jsonl (lines: {k, zh, ...}),
validates each translation against its source text (recomputed from the
parquet source of truth), appends passing lines to zh.jsonl, and writes
failing lines with reasons to shards/rejects.jsonl.

Machine checks (hard gate — LaTeX fidelity):
  * inline `$` count parity and display `$$` pair count match the source
  * \\begin{X}/\\end{X} environment multiset identical to the source
  * image reference set (attached_image_N) identical
  * CJK ratio outside math > 0.35 when the source has enough natural language
  * length ratio within [0.2, 3.5]x

  py backend/scripts/merge_translations.py
  py backend/scripts/merge_translations.py --dry-run
"""
import argparse
import glob
import hashlib
import json
import os
import re
from collections import Counter

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

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
TR_DIR = os.path.join(BACKEND, 'data', 'translations')
ZH_PATH = os.path.join(TR_DIR, 'zh.jsonl')
SHARDS_DIR = os.path.join(TR_DIR, 'shards')
REJECTS_PATH = os.path.join(SHARDS_DIR, 'rejects.jsonl')

ENV_RE = re.compile(r'\\(begin|end)\{([a-zA-Z*]+)\}')
IMG_RE = re.compile(r'attached_image_(\d+)')
DISPLAY_RE = re.compile(r'\$\$')
CJK_RE = re.compile(r'[一-鿿]')
MATH_STRIP_RE = re.compile(
    r'\$\$.*?\$\$|\$[^$\n]*\$|\\\[.*?\\\]|\\\(.*?\\\)'
    r'|\\begin\{[a-zA-Z*]+\}.*?\\end\{[a-zA-Z*]+\}|`[^`]*`',
    re.S)


def content_key(kind, raw_md):
    norm = re.sub(r'\s+', ' ', (raw_md or '').strip())
    h = hashlib.sha256(norm.encode('utf-8')).hexdigest()[:16]
    return f'{"p" if kind == "problem" else "s"}:{h}'


def build_source_map():
    snap = snapshot_download(
        REPO, repo_type='dataset',
        allow_patterns=[f'data/{c}/*.parquet' for c in CONFIGS])
    src = {}
    for config in CONFIGS:
        for pqf in sorted(glob.glob(os.path.join(snap, 'data', config, '*.parquet'))):
            table = pa_pq.read_table(
                pqf, columns=['problem_markdown', 'solutions_markdown'])
            for r in table.to_pylist():
                pm = r.get('problem_markdown') or ''
                if pm.strip():
                    src[content_key('problem', pm)] = pm
                for s in (r.get('solutions_markdown') or []):
                    if (s or '').strip():
                        src[content_key('solution', s)] = s
    return src


def validate(source, zh):
    reasons = []
    if not (zh or '').strip():
        return ['empty']
    if source.count('$') != zh.count('$'):
        reasons.append(f'dollar-count {source.count("$")}->{zh.count("$")}')
    if len(DISPLAY_RE.findall(source)) != len(DISPLAY_RE.findall(zh)):
        reasons.append('display-math-count')
    if Counter(ENV_RE.findall(source)) != Counter(ENV_RE.findall(zh)):
        reasons.append('latex-env-mismatch')
    if Counter(IMG_RE.findall(source)) != Counter(IMG_RE.findall(zh)):
        reasons.append('image-ref-mismatch')
    ratio = len(zh) / max(len(source), 1)
    if not (0.2 <= ratio <= 3.5):
        reasons.append(f'length-ratio {ratio:.2f}')
    prose_src = MATH_STRIP_RE.sub(' ', source)
    prose_zh = MATH_STRIP_RE.sub(' ', zh)
    letters = len(re.findall(r'[a-zA-Z]', prose_src))
    if letters > 40:  # enough natural language to expect real translation
        cjk = len(CJK_RE.findall(prose_zh))
        visible = len(re.sub(r'\s', '', prose_zh))
        if visible and cjk / visible < 0.35:
            reasons.append(f'low-cjk {cjk}/{visible}')
    return reasons


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--pattern', default='out_*.jsonl')
    args = ap.parse_args()

    outs = sorted(glob.glob(os.path.join(SHARDS_DIR, args.pattern)))
    if not outs:
        print('no output shards found')
        return
    print(f'{len(outs)} output shards; rebuilding source map from parquet...')
    src = build_source_map()
    print(f'source map: {len(src)} units')

    existing = set()
    if os.path.exists(ZH_PATH):
        with open(ZH_PATH, encoding='utf-8') as f:
            for line in f:
                try:
                    o = json.loads(line)
                    if o.get('k'):
                        existing.add(o['k'])
                except json.JSONDecodeError:
                    continue

    accepted, rejected, dupes, unknown = [], [], 0, 0
    for path in outs:
        with open(path, encoding='utf-8') as f:
            for ln, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    rejected.append({'file': os.path.basename(path), 'line': ln,
                                     'reasons': ['bad-json']})
                    continue
                k = o.get('k')
                if not k or k not in src:
                    unknown += 1
                    rejected.append({'k': k, 'file': os.path.basename(path),
                                     'reasons': ['unknown-key']})
                    continue
                if k in existing:
                    dupes += 1
                    continue
                reasons = validate(src[k], o.get('zh') or '')
                if reasons:
                    rejected.append({'k': k, 'file': os.path.basename(path),
                                     'reasons': reasons})
                else:
                    existing.add(k)
                    accepted.append({
                        'k': k,
                        'kind': 'problem' if k.startswith('p:') else 'solution',
                        'zh': o['zh'],
                        'model': o.get('model', 'sonnet'),
                    })

    total_seen = len(accepted) + len(rejected) + dupes
    rate = 100 * len(accepted) / max(total_seen - dupes, 1)
    print(f'accepted: {len(accepted)} | rejected: {len(rejected)} '
          f'(unknown-key: {unknown}) | already-merged dupes: {dupes} '
          f'| pass rate: {rate:.1f}%')

    if args.dry_run:
        print('(dry run: nothing written)')
        return

    if accepted:
        with open(ZH_PATH, 'a', encoding='utf-8') as f:
            for o in accepted:
                f.write(json.dumps(o, ensure_ascii=False) + '\n')
        print(f'appended {len(accepted)} lines -> {ZH_PATH}')
    if rejected:
        with open(REJECTS_PATH, 'a', encoding='utf-8') as f:
            for o in rejected:
                f.write(json.dumps(o, ensure_ascii=False) + '\n')
        print(f'rejects logged -> {REJECTS_PATH}')
        by_reason = Counter(r for o in rejected for r in o['reasons'])
        for reason, n in by_reason.most_common(10):
            print(f'  {n:5d}  {reason}')


if __name__ == '__main__':
    main()
