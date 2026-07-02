"""
Build the math-problem-bank SQLite DB (schema v2) from the MathNet HuggingFace
dataset — all 18 configs (~11,433 problems).

Source of truth: the parquet files of ``ShadenA/MathNet`` (downloaded + cached
via huggingface_hub). The build consumes three reviewed sidecar assets:

  * backend/data/competitions/registry.json     canonical competitions
                                                (comp_key/tier/rounds/region)
  * backend/data/competitions/assignments.json  (config, raw name) -> comp_key
                                                / round_key / fixed_year
  * backend/data/enrichment/enrichment.jsonl    per-problem difficulty / year /
                                                problem_number (LLM pass)
  * backend/data/translations/zh.jsonl          zh translations keyed by
                                                content hash (LLM pass)

Re-runnable and deterministic: delete + rebuild from scratch every time.

  py backend/scripts/build_problems.py
  py backend/scripts/build_problems.py --no-images   (faster dev builds)

Year priority chain: assignments.fixed_year > explicit 4-digit in raw name >
registry edition_rule (ordinal) > enrichment (llm) > NULL.

v2 schema highlights:
  * ``competitions`` table from the registry; problems carry comp_key/round_key
  * ``browse_rank``: weighted round-robin interleave across competitions
    (tier-1 comps deal 8 problems per cycle, HMMT/tier-4 deal 1) — the default
    listing order, so no single mega-competition floods page one
  * ``problem_zh`` / ``solution_zh`` translations; ``preview_en/zh`` are
    build-time plain-text excerpts so the list API never ships full markdown
  * contentless trigram FTS over problem text (EN+ZH) + competition + category
    names; solution bodies are NOT indexed (keeps the DB well under GitHub's
    100MB single-file limit)
"""
import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys

import pyarrow.parquet as pa_pq
from huggingface_hub import snapshot_download

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
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
ROOT = os.path.dirname(BACKEND)
DB_PATH = os.path.join(BACKEND, 'data', 'problems.db')
COMP_DIR = os.path.join(BACKEND, 'data', 'competitions')
REGISTRY_PATH = os.path.join(COMP_DIR, 'registry.json')
ASSIGN_PATH = os.path.join(COMP_DIR, 'assignments.json')
TRANSLATIONS_PATH = os.path.join(BACKEND, 'data', 'translations', 'zh.jsonl')
IMAGES_DIR = os.path.join(BACKEND, 'data', 'problem_images')
IMAGE_URL_PREFIX = '/problem-images'
SIZE_LIMIT_MB = 95  # GitHub hard limit is 100MB/file; keep a margin

# config -> short id prefix (keeps ids globally unique + readable)
CONFIG_PREFIX = {
    'Asia_Pacific_Mathematics_Olympiad_APMO': 'AP',
    'Balkan_Mathematical_Olympiad': 'BK',
    'Canada': 'CA',
    'China': 'CN',
    "European_Girls'_Mathematical_Olympiad_EGMO": 'EG',
    'Hong_Kong': 'HK',
    'IMO': 'IMO',
    'India': 'IN',
    'Iran': 'IR',
    'Japan': 'JP',
    'Romania': 'RO',
    'Romanian_Master_of_Mathematics_RMM': 'RM',
    'Russia': 'RU',
    'Singapore': 'SG',
    'South_Korea': 'KR',
    'Taiwan': 'TW',
    'United_States': 'US',
    'Vietnam': 'VN',
}
CONFIG_COUNTRY_ZH = {
    'Asia_Pacific_Mathematics_Olympiad_APMO': 'APMO',
    'Balkan_Mathematical_Olympiad': '巴尔干',
    'Canada': '加拿大',
    'China': '中国',
    "European_Girls'_Mathematical_Olympiad_EGMO": 'EGMO',
    'Hong_Kong': '中国香港',
    'IMO': 'IMO',
    'India': '印度',
    'Iran': '伊朗',
    'Japan': '日本',
    'Romania': '罗马尼亚',
    'Romanian_Master_of_Mathematics_RMM': 'RMM',
    'Russia': '俄罗斯',
    'Singapore': '新加坡',
    'South_Korea': '韩国',
    'Taiwan': '中国台湾',
    'United_States': '美国',
    'Vietnam': '越南',
}

PROBLEM_TYPE_ZH = {
    'proof and answer': '证明与求值', 'proof only': '证明题',
    'final answer only': '填空/求值', 'MCQ': '选择题',
}

# topics_flat top level (L1) -> zh
L1_ZH = {
    'Algebra': '代数', 'Geometry': '几何', 'Number Theory': '数论',
    'Discrete Mathematics': '离散数学', 'Calculus': '微积分',
    'Statistics': '统计', 'Precalculus': '预备微积分',
    'Math Word Problems': '应用题',
}
L2_ZH = {
    'Combinatorics': '组合数学', 'Graph Theory': '图论', 'Probability': '概率',
    'Mathematical Statistics': '数理统计', 'Logic': '逻辑',
    'Algorithms': '算法', 'Other': '其他', 'Others': '其他',
}

TIER_WEIGHT = {1: 8, 2: 6, 3: 3, 4: 1}

YEAR_RE = re.compile(r'\b(19[5-9]\d|20[0-4]\d)\b')
ORD_RE = re.compile(r'\b(\d{1,3})\s*(?:st|nd|rd|th)\b', re.I)


# --------------------------------------------------------------------------- #
# Sidecar loading
# --------------------------------------------------------------------------- #
def load_registry():
    with open(REGISTRY_PATH, encoding='utf-8') as f:
        reg = json.load(f)
    comps = {c['comp_key']: c for c in reg['competitions']}
    regions = {r['key']: r for r in reg['regions']}
    return reg, comps, regions


def load_assignments():
    with open(ASSIGN_PATH, encoding='utf-8') as f:
        data = json.load(f)
    out = {}
    for a in data['assignments']:
        out[(a['config'], a['competition'])] = a
    return out


def load_enrichment(path):
    out = {}
    if not path or not os.path.exists(path):
        return out
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            if o.get('id'):
                out[o['id']] = o  # last write wins
    return out


def content_key(kind, raw_md):
    """Translation-sidecar key: stable across rebuilds / id changes."""
    norm = re.sub(r'\s+', ' ', (raw_md or '').strip())
    h = hashlib.sha256(norm.encode('utf-8')).hexdigest()[:16]
    return f'{"p" if kind == "problem" else "s"}:{h}'


def load_translations():
    """zh.jsonl -> {content_key: zh_markdown}. Last write wins."""
    out = {}
    if not os.path.exists(TRANSLATIONS_PATH):
        return out
    with open(TRANSLATIONS_PATH, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            if o.get('k') and o.get('zh'):
                out[o['k']] = o['zh']
    return out


# --------------------------------------------------------------------------- #
# Text helpers
# --------------------------------------------------------------------------- #
def translate_path(path):
    """Translate a 'L1 > L2 > L3 > L4' topic path; returns dict of levels."""
    parts = [p.strip() for p in (path or '').split('>') if p.strip()]
    levels = {'l1': None, 'l2': None, 'l3': None, 'l4': None}
    zh = []
    for i, p in enumerate(parts[:4]):
        levels[f'l{i + 1}'] = p
        if i == 0:
            zh.append(L1_ZH.get(p, p))
        elif i == 1:
            zh.append(L2_ZH.get(p, p))
        else:
            zh.append(p)
    levels['l1_zh'] = L1_ZH.get(parts[0], parts[0]) if parts else None
    levels['l2_zh'] = (L2_ZH.get(parts[1], parts[1]) if len(parts) >= 2 else None)
    levels['path_zh'] = ' > '.join(zh) if zh else None
    return levels


def sniff_ext(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if b[:3] == b'\xff\xd8\xff':
        return 'jpg'
    if b[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    return 'png'


MAX_IMG_WIDTH = 1400


def save_optimized(b, path_noext):
    """Save an image as size-capped webp (diagrams compress ~3x vs raw PNG).
    Falls back to the raw bytes + sniffed ext when Pillow can't handle it.
    Returns the extension actually written."""
    try:
        from io import BytesIO
        from PIL import Image
        im = Image.open(BytesIO(b))
        if getattr(im, 'is_animated', False):
            raise ValueError('animated')
        if im.width > MAX_IMG_WIDTH:
            im = im.resize(
                (MAX_IMG_WIDTH, round(im.height * MAX_IMG_WIDTH / im.width)),
                Image.LANCZOS)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.mode or 'P' in im.mode else 'RGB')
        im.save(path_noext + '.webp', 'WEBP', quality=88, method=6)
        return 'webp'
    except Exception:
        ext = sniff_ext(b)
        with open(f'{path_noext}.{ext}', 'wb') as fh:
            fh.write(b)
        return ext


def rewrite_image_refs(text, pid, images):
    """Replace attached_image_N.png refs with served URLs. (no file IO here)"""
    if not text or not images:
        return text

    def repl(m):
        n = int(m.group(1))
        if 1 <= n <= len(images):
            ext = images[n - 1]['_ext']
            return f'![]({IMAGE_URL_PREFIX}/{pid}/{n}.{ext})'
        return m.group(0)

    return re.sub(r'!\[[^\]]*\]\(\s*attached_image_(\d+)\.[a-zA-Z]+\s*\)', repl, text)


_MD_IMG_RE = re.compile(r'!\[[^\]]*\]\([^)]*\)')
_DISPLAY_MATH_RE = re.compile(r'\$\$.*?\$\$|\\\[.*?\\\]', re.S)
_INLINE_MATH_RE = re.compile(r'\$([^$\n]+)\$|\\\((.+?)\\\)')
_ENV_RE = re.compile(r'\\begin\{[a-zA-Z*]+\}.*?\\end\{[a-zA-Z*]+\}', re.S)
_MD_MARK_RE = re.compile(r'[*_`#>|]+')


def make_preview(md, limit=240):
    """Plain-text excerpt for list rows. Short inline math is kept readable
    (dollar signs stripped); long/display math collapses to a placeholder."""
    if not md:
        return ''
    t = _MD_IMG_RE.sub(' [图] ', md)
    t = _ENV_RE.sub(' [公式] ', t)
    t = _DISPLAY_MATH_RE.sub(' [公式] ', t)

    def inline(m):
        body = (m.group(1) or m.group(2) or '').strip()
        return body if len(body) <= 24 else ' [公式] '

    t = _INLINE_MATH_RE.sub(inline, t)
    t = _MD_MARK_RE.sub(' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t[:limit]


def parse_year_explicit(competition):
    m = YEAR_RE.search(competition or '')
    return int(m.group(1)) if m else None


def parse_year_ordinal(competition, comp_def):
    rule = (comp_def or {}).get('edition_rule') or {}
    first = rule.get('first_edition_year')
    if not first:
        return None
    m = ORD_RE.search(competition or '')
    if not m:
        return None
    n = int(m.group(1))
    y = first + n - 1
    return y if 1950 <= y <= 2026 else None


def natural_pnum(pnum):
    """Sort key for problem_number strings like '5', 'A2', '10'."""
    if not pnum:
        return (2, 0, '')
    m = re.search(r'(\d+)', str(pnum))
    return (0 if m else 1, int(m.group(1)) if m else 0, str(pnum))


# --------------------------------------------------------------------------- #
# Schema v2
# --------------------------------------------------------------------------- #
SCHEMA = """
CREATE TABLE competitions (
  comp_key    TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_zh     TEXT NOT NULL,
  short       TEXT,
  region      TEXT NOT NULL,
  region_zh   TEXT NOT NULL,
  tier        INTEGER NOT NULL,
  weight      INTEGER NOT NULL,
  sort_rank   INTEGER NOT NULL DEFAULT 0,
  rounds_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE problems (
  id            TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL,
  config        TEXT NOT NULL,
  country_zh    TEXT NOT NULL,
  comp_key      TEXT NOT NULL REFERENCES competitions(comp_key),
  round_key     TEXT,
  competition_raw TEXT NOT NULL DEFAULT '',
  year          INTEGER,
  year_source   TEXT,
  problem_number TEXT,
  problem_number_source TEXT,
  problem_md    TEXT NOT NULL,
  problem_zh    TEXT,
  preview_en    TEXT NOT NULL DEFAULT '',
  preview_zh    TEXT,
  final_answer  TEXT,
  has_solution  INTEGER NOT NULL DEFAULT 0,
  num_solutions INTEGER NOT NULL DEFAULT 0,
  translated    INTEGER NOT NULL DEFAULT 0,
  language      TEXT,
  problem_type  TEXT,
  problem_type_zh TEXT,
  difficulty    TEXT,
  difficulty_zh TEXT,
  difficulty_score INTEGER,
  difficulty_source TEXT,
  rationale_zh  TEXT,
  has_images    INTEGER NOT NULL DEFAULT 0,
  num_images    INTEGER NOT NULL DEFAULT 0,
  tier          INTEGER NOT NULL,
  browse_rank   INTEGER NOT NULL DEFAULT 0,
  categories_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE solutions (
  problem_id  TEXT NOT NULL,
  idx         INTEGER NOT NULL,
  solution_md TEXT NOT NULL,
  solution_zh TEXT,
  PRIMARY KEY (problem_id, idx)
);

CREATE TABLE problem_categories (
  problem_id TEXT NOT NULL,
  l1 TEXT, l2 TEXT, l3 TEXT, l4 TEXT,
  l1_zh TEXT, l2_zh TEXT, path_zh TEXT
);

CREATE TABLE build_meta (key TEXT PRIMARY KEY, value TEXT);

CREATE INDEX idx_p_comp        ON problems(comp_key);
CREATE INDEX idx_p_comp_yr     ON problems(comp_key, year DESC);
CREATE INDEX idx_p_year        ON problems(year);
CREATE INDEX idx_p_tier        ON problems(tier);
CREATE INDEX idx_p_diffscore   ON problems(difficulty_score);
CREATE INDEX idx_p_difficulty  ON problems(difficulty);
CREATE INDEX idx_p_ptype       ON problems(problem_type);
CREATE INDEX idx_p_hassol      ON problems(has_solution);
CREATE INDEX idx_p_config      ON problems(config);
CREATE INDEX idx_pc_pid ON problem_categories(problem_id);
CREATE INDEX idx_pc_l1  ON problem_categories(l1_zh);
CREATE INDEX idx_pc_l2  ON problem_categories(l2_zh);
CREATE INDEX idx_pc_l3  ON problem_categories(l3);
CREATE INDEX idx_pc_l4  ON problem_categories(l4);

-- Contentless: index only, original text lives in `problems`. Solutions are
-- deliberately NOT indexed (trigram FTS inflates text ~3.3x; indexing 31MB of
-- solutions would push the DB past GitHub's 100MB single-file hard limit).
CREATE VIRTUAL TABLE problems_fts USING fts5(
  problem_md, problem_zh, comp_text, cat_text,
  content='', tokenize='trigram'
);
"""


# --------------------------------------------------------------------------- #
# browse_rank: weighted round-robin interleave
# --------------------------------------------------------------------------- #
def compute_browse_rank(rows_by_comp, comps):
    """rows_by_comp: {comp_key: [(sortkey, pid), ...]}  ->  {pid: rank}.

    Each competition deals `weight` problems per cycle (tier1=8 ... tier4=1),
    from its own (year DESC, problem_number, id) queue. Deterministic.
    """
    queues = {}
    for ck, items in rows_by_comp.items():
        items.sort(key=lambda x: x[0])
        queues[ck] = list(items)
    order = sorted(
        queues.keys(),
        key=lambda ck: (comps[ck]['tier'], comps[ck].get('sort_rank', 0), ck))
    ranks = {}
    rank = 0
    while any(queues[ck] for ck in order):
        for ck in order:
            w = TIER_WEIGHT.get(comps[ck]['tier'], 1)
            for _ in range(w):
                if not queues[ck]:
                    break
                _, pid = queues[ck].pop(0)
                ranks[pid] = rank
                rank += 1
    return ranks


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--enrichment', default=os.path.join(
        BACKEND, 'data', 'enrichment', 'enrichment.jsonl'))
    ap.add_argument('--no-images', action='store_true',
                    help='skip image extraction (faster dev builds)')
    args = ap.parse_args()

    print('downloading/locating snapshot...', flush=True)
    snap = snapshot_download(REPO, repo_type='dataset',
                             allow_patterns=[f'data/{c}/*.parquet' for c in CONFIGS])
    registry, comps, regions = load_registry()
    assignments = load_assignments()
    enrich = load_enrichment(args.enrichment)
    translations = load_translations()
    print(f'registry: {len(comps)} comps | assignments: {len(assignments)} | '
          f'enrichment: {len(enrich)} | translations: {len(translations)}', flush=True)

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    con = sqlite3.connect(DB_PATH)
    con.executescript('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;')
    con.executescript(SCHEMA)

    for c in registry['competitions']:
        region = regions[c['region']]
        con.execute(
            'INSERT INTO competitions VALUES (?,?,?,?,?,?,?,?,?,?)',
            (c['comp_key'], c['name_en'], c['name_zh'], c.get('short'),
             c['region'], region['zh'], c['tier'],
             TIER_WEIGHT.get(c['tier'], 1), c.get('sort_rank', 0),
             json.dumps(c.get('rounds') or [], ensure_ascii=False)))

    n_rows = n_img_files = n_year = n_zh_p = n_zh_s = 0
    unmapped = {}
    seen_ids = set()
    rows_by_comp = {}
    import glob as _glob
    for config in CONFIGS:
        prefix = CONFIG_PREFIX[config]
        pqs = sorted(_glob.glob(os.path.join(snap, 'data', config, '*.parquet')))
        for pqf in pqs:
            table = pa_pq.read_table(pqf)
            for r in table.to_pylist():
                sid = r['id']
                pid = f'{prefix}-{sid}'
                if pid in seen_ids:
                    pid = f'{prefix}-{sid}-{n_rows}'  # ultra-rare collision guard
                seen_ids.add(pid)

                country_zh = CONFIG_COUNTRY_ZH[config]
                competition_raw = (r.get('competition') or '').strip()
                a = assignments.get((config, competition_raw))
                if a is None:
                    unmapped[(config, competition_raw)] = \
                        unmapped.get((config, competition_raw), 0) + 1
                    a = {'comp_key': f'{prefix.lower()}_other',
                         'round_key': None, 'fixed_year': None}
                comp_key = a['comp_key']
                comp_def = comps.get(comp_key)
                if comp_def is None:
                    raise SystemExit(f'assignment points to unknown comp_key '
                                     f'{comp_key!r} for {(config, competition_raw)}')
                round_key = a.get('round_key')

                # ---- images (optimized webp; _ext drives the md ref rewrite) ----
                imgs = r.get('images') or []
                for im in imgs:
                    b = im.get('bytes') or b''
                    im['_ext'] = 'webp' if b else 'png'
                if imgs and not args.no_images:
                    pdir = os.path.join(IMAGES_DIR, pid)
                    os.makedirs(pdir, exist_ok=True)
                    for i, im in enumerate(imgs):
                        b = im.get('bytes') or b''
                        if b:
                            im['_ext'] = save_optimized(
                                b, os.path.join(pdir, str(i + 1)))
                            n_img_files += 1

                raw_problem = r.get('problem_markdown') or ''
                raw_sols = [s for s in (r.get('solutions_markdown') or [])
                            if (s or '').strip()]

                problem_md = rewrite_image_refs(raw_problem, pid, imgs)
                sols = [rewrite_image_refs(s, pid, imgs) for s in raw_sols]

                # ---- translations (content-hash keyed, from raw text) ----
                zh_raw = translations.get(content_key('problem', raw_problem))
                problem_zh = rewrite_image_refs(zh_raw, pid, imgs) if zh_raw else None
                sol_zh = []
                for s in raw_sols:
                    z = translations.get(content_key('solution', s))
                    sol_zh.append(rewrite_image_refs(z, pid, imgs) if z else None)
                if problem_zh:
                    n_zh_p += 1
                n_zh_s += sum(1 for z in sol_zh if z)
                translated = 1 if (problem_zh and all(sol_zh)) else 0

                # ---- year priority chain ----
                e = enrich.get(pid) or enrich.get(sid) or {}
                year, ysrc = a.get('fixed_year'), 'assign'
                if not year:
                    year, ysrc = parse_year_explicit(competition_raw), 'explicit'
                if not year:
                    year, ysrc = parse_year_ordinal(competition_raw, comp_def), 'ordinal'
                if not year and e.get('year'):
                    year, ysrc = int(e['year']), 'llm'
                if not year:
                    ysrc = None
                else:
                    n_year += 1

                pnum = e.get('problem_number')
                pnum_src = 'llm' if pnum else None

                # ---- categories ----
                cats, cat_rows, seen_paths = [], [], set()
                for path in (r.get('topics_flat') or []):
                    lv = translate_path(path)
                    if lv['path_zh'] and lv['path_zh'] not in seen_paths:
                        seen_paths.add(lv['path_zh'])
                        cats.append(lv['path_zh'])
                        cat_rows.append((pid, lv['l1'], lv['l2'], lv['l3'],
                                         lv['l4'], lv['l1_zh'], lv['l2_zh'],
                                         lv['path_zh']))

                ptype = r.get('problem_type')
                con.execute(
                    """INSERT INTO problems
                       (id, source_id, config, country_zh, comp_key, round_key,
                        competition_raw, year, year_source, problem_number,
                        problem_number_source, problem_md, problem_zh,
                        preview_en, preview_zh, final_answer, has_solution,
                        num_solutions, translated, language, problem_type,
                        problem_type_zh, difficulty, difficulty_zh,
                        difficulty_score, difficulty_source, rationale_zh,
                        has_images, num_images, tier, browse_rank,
                        categories_json)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
                               ?,?,?,?,?,?,?,?,?)""",
                    (pid, sid, config, country_zh, comp_key, round_key,
                     competition_raw, year, ysrc, pnum, pnum_src, problem_md,
                     problem_zh, make_preview(problem_md),
                     make_preview(problem_zh) if problem_zh else None,
                     r.get('final_answer'), 1 if sols else 0, len(sols),
                     translated, r.get('language'), ptype,
                     PROBLEM_TYPE_ZH.get(ptype), e.get('difficulty'),
                     e.get('difficulty_zh'), e.get('difficulty_score'),
                     e.get('difficulty_source') or ('llm' if e.get('difficulty') else None),
                     e.get('rationale_zh'), 1 if imgs else 0, len(imgs),
                     comp_def['tier'], 0,
                     json.dumps(cats, ensure_ascii=False)))
                for i, s in enumerate(sols):
                    con.execute('INSERT INTO solutions VALUES (?,?,?,?)',
                                (pid, i, s, sol_zh[i]))
                con.executemany(
                    'INSERT INTO problem_categories VALUES (?,?,?,?,?,?,?,?)',
                    cat_rows)

                sortkey = (-(year or 0), natural_pnum(pnum), pid)
                rows_by_comp.setdefault(comp_key, []).append((sortkey, pid))
                n_rows += 1
        print(f'  {config}: cumulative rows={n_rows}', flush=True)

    if unmapped:
        print('\nWARNING: unmapped raw competition names (fell back to *_other):')
        for (cfg, comp), cnt in sorted(unmapped.items()):
            print(f'  [{cnt}] {cfg} :: {comp!r}')

    # ---- browse_rank ----
    print('computing browse_rank...', flush=True)
    ranks = compute_browse_rank(rows_by_comp, comps)
    con.executemany('UPDATE problems SET browse_rank=? WHERE id=?',
                    [(rk, pid) for pid, rk in ranks.items()])
    con.execute('CREATE UNIQUE INDEX idx_p_browse ON problems(browse_rank)')

    # ---- FTS (contentless; explicit rowid mapping to problems.rowid) ----
    print('building FTS...', flush=True)
    con.execute("""
        INSERT INTO problems_fts(rowid, problem_md, problem_zh, comp_text, cat_text)
        SELECT p.rowid, p.problem_md, COALESCE(p.problem_zh, ''),
               c.name_en || ' ' || c.name_zh || ' ' || COALESCE(c.short, '')
                 || ' ' || p.competition_raw,
               p.categories_json
        FROM problems p JOIN competitions c ON c.comp_key = p.comp_key""")

    from datetime import datetime, timezone
    meta = {
        'schema_version': '2',
        'source_total': str(n_rows),
        'image_files': str(n_img_files),
        'year_filled': str(n_year),
        'enriched': str(len(enrich)),
        'translated_problems': str(n_zh_p),
        'translated_solutions': str(n_zh_s),
        'comp_count': str(len(comps)),
        'unmapped_raw': str(len(unmapped)),
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'configs': ','.join(CONFIGS),
    }
    con.executemany('INSERT INTO build_meta VALUES (?,?)', list(meta.items()))
    con.commit()
    con.execute('ANALYZE')
    con.commit()
    con.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    con.close()

    size_mb = os.path.getsize(DB_PATH) / 1024 / 1024
    print(f'\nDONE: {n_rows} problems | {n_year} with year '
          f'({100 * n_year // max(n_rows, 1)}%) | zh: {n_zh_p} problems / '
          f'{n_zh_s} solutions | {n_img_files} image files')
    print(f'DB: {DB_PATH} ({size_mb:.1f} MB)')
    if unmapped:
        print(f'UNMAPPED: {len(unmapped)} raw names — run the normalization '
              f'pass over these before shipping')
    if size_mb > SIZE_LIMIT_MB:
        print(f'ERROR: DB exceeds {SIZE_LIMIT_MB}MB safety line '
              f'(GitHub hard limit 100MB)', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
