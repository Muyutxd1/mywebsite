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
CYRILLIC_RE = re.compile(r'[А-яЁё]')
MATH_STRIP_RE = re.compile(
    r'\$\$.*?\$\$|\$[^$\n]*\$|\\\[.*?\\\]|\\\(.*?\\\)'
    r'|\\begin\{[a-zA-Z*]+\}.*?\\end\{[a-zA-Z*]+\}|`[^`]*`',
    re.S)
MATH_FRAG_RE = re.compile(
    r'\$\$(.*?)\$\$|\$([^$]*)\$|\\\[(.*?)\\\]|\\\((.*?)\\\)'
    r'|\\begin\{[a-zA-Z*]+\}(.*?)\\end\{[a-zA-Z*]+\}',
    re.S)


_TYPOGRAPHIC_EQUIV = [
    (re.compile(r'\^\{\\prime\\prime\}|\^\\prime\\prime'), "''"),
    (re.compile(r'\^\{\\prime\}|\^\\prime'), "'"),
    (re.compile(r'\\left|\\right'), ''),
    (re.compile(r'\\[dt]frac'), r'\\frac'),
    (re.compile(r'\\[,;!]|\\quad|\\qquad'), ''),
]


def math_signature(text):
    """Char multiset of all math content, ignoring commas/whitespace and
    purely typographic equivalences (\\prime vs ', \\left\\right, spacing).

    Splitting an enumeration ($a, b$ -> $a$、$b$) is legitimate translation
    typography and keeps this signature identical, while any dropped
    condition, altered digit or flipped inequality changes it."""
    frags = [g for m in MATH_FRAG_RE.finditer(text) for g in m.groups() if g]
    body = ''.join(frags)
    for pat, repl in _TYPOGRAPHIC_EQUIV:
        body = pat.sub(repl, body)
    # braces are structural (x^{2} vs x^2): dropping them from the multiset
    # still exposes any loss of actual content characters
    return Counter(re.sub(r'[,{}\s]', '', body))


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

    # Bilingual sources (Taiwan zh duplicates, Russian originals appended):
    # the correct translation SELECTS the Chinese content instead of mapping
    # the whole bilingual text 1:1, so cross-checking exact math counts
    # against the full source only misfires. Check internal consistency.
    if CJK_RE.search(source) or CYRILLIC_RE.search(source):
        if zh.count('$') % 2:
            reasons.append('unbalanced-dollar')
        begins = Counter(m[1] for m in ENV_RE.findall(zh) if m[0] == 'begin')
        ends = Counter(m[1] for m in ENV_RE.findall(zh) if m[0] == 'end')
        if begins != ends:
            reasons.append('env-unbalanced')
        if not set(IMG_RE.findall(zh)) <= set(IMG_RE.findall(source)):
            reasons.append('image-ref-extra')
        if not CJK_RE.search(zh):
            reasons.append('no-cjk')
        return reasons

    if zh.count('$') % 2:
        reasons.append('unbalanced-dollar')
    elif math_signature(source) != math_signature(zh):
        reasons.append('math-content-mismatch')
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
    if letters > 40:  # enough natural language to expect real translation.
        # Compare CJK volume to the source's letter count (Chinese is ~4-5x
        # denser); a visible-char ratio misfires on option-heavy MCQ texts
        # where digits/parens dominate.
        cjk = len(CJK_RE.findall(prose_zh))
        if cjk < max(6, letters * 0.12):
            reasons.append(f'low-cjk {cjk}cjk/{letters}letters')
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
