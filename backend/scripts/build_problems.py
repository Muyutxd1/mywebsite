"""
Build the math-problem-bank SQLite DB from the MathNet HuggingFace dataset.

Source of truth: the parquet files of ``ShadenA/MathNet`` (downloaded + cached
via huggingface_hub). This script reads the 6 selected country/competition
configs, normalizes them, extracts inline figures to static files, optionally
merges an LLM enrichment sidecar (year / problem_number / difficulty), and
writes a read-only ``problems.db`` with FTS5 (trigram) full-text search.

Re-runnable and deterministic: delete + rebuild from scratch every time.

  py backend/scripts/build_problems.py
  py backend/scripts/build_problems.py --enrichment backend/data/enrichment/enrichment.jsonl

The published MathNet parquet has NO year / problem_number / difficulty fields
(README-confirmed), so:
  * ``year`` is parsed here from the ``competition`` string (explicit 4-digit
    year, else ordinal "Nth" -> first-edition table) and otherwise left for the
    LLM pass (``year_source`` records provenance).
  * ``problem_number`` / ``difficulty`` come only from the enrichment sidecar.
"""
import argparse
import json
import os
import re
import sqlite3
import sys

import pyarrow.parquet as pa_pq
import pyarrow.compute as pc
from huggingface_hub import snapshot_download

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
REPO = 'ShadenA/MathNet'
CONFIGS = ['China', 'United_States', 'IMO', 'Iran', 'Romania',
           "European_Girls'_Mathematical_Olympiad_EGMO"]

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
ROOT = os.path.dirname(BACKEND)
DB_PATH = os.path.join(BACKEND, 'data', 'problems.db')
IMAGES_DIR = os.path.join(ROOT, 'frontend', 'public', 'problem-images')
IMAGE_URL_PREFIX = '/problem-images'

# config -> short id prefix (keeps ids globally unique + readable)
CONFIG_PREFIX = {
    'China': 'CN', 'United_States': 'US', 'IMO': 'IMO', 'Iran': 'IR',
    'Romania': 'RO', "European_Girls'_Mathematical_Olympiad_EGMO": 'EG',
}
# normalized country label (the parquet `country` strings vary) -> zh
COUNTRY_ZH = {
    'China': '中国', 'United States': '美国', 'United_States': '美国',
    'IMO': 'IMO', 'Iran': '伊朗', 'Romania': '罗马尼亚',
    "European Girls' Mathematical Olympiad (EGMO)": 'EGMO',
    "European Girls' Mathematical Olympiad": 'EGMO',
}
# config -> canonical zh country label (fallback when row.country is messy)
CONFIG_COUNTRY_ZH = {
    'China': '中国', 'United_States': '美国', 'IMO': 'IMO', 'Iran': '伊朗',
    'Romania': '罗马尼亚', "European_Girls'_Mathematical_Olympiad_EGMO": 'EGMO',
}

PROBLEM_TYPE_ZH = {
    'proof and answer': '证明与求值', 'proof only': '证明题',
    'final answer only': '填空/求值', 'MCQ': '选择题',
}

# topics_flat top level (L1) -> zh ; mirrors mo.yukicv's taxonomy
L1_ZH = {
    'Algebra': '代数', 'Geometry': '几何', 'Number Theory': '数论',
    'Discrete Mathematics': '离散数学', 'Calculus': '微积分',
    'Statistics': '统计', 'Precalculus': '预备微积分',
    'Math Word Problems': '应用题',
}
# selected L2 -> zh (rest stay English, like mo.yukicv)
L2_ZH = {
    'Combinatorics': '组合数学', 'Graph Theory': '图论', 'Probability': '概率',
    'Mathematical Statistics': '数理统计', 'Logic': '逻辑',
    'Algorithms': '算法', 'Other': '其他', 'Others': '其他',
}

# Ordinal "Nth <competition>" -> year, via first-edition year.
# IMO: 1st = 1959, held yearly except 1980 (cancelled) -> for N>=22 add one.
# Romanian MO: 1st = 1950, yearly. Iranian MO: 1st = 1983, yearly.
YEAR_RE = re.compile(r'\b(19[5-9]\d|20[0-4]\d)\b')
ORD_RE = re.compile(r'\b(\d{1,3})\s*(?:st|nd|rd|th)\b', re.I)


def ordinal_to_year(config, n):
    if config == 'IMO':
        if n < 1:
            return None
        # 1st=1959 .. 21st=1979, 1980 cancelled, 22nd=1981 .. so N>=22 adds one.
        return (1959 + n) if n >= 22 else (1958 + n)
    if config == 'Romania':
        return 1949 + n if 1 <= n <= 90 else None
    if config == 'Iran':
        return 1982 + n if 1 <= n <= 60 else None
    return None


def parse_year(config, competition):
    """Return (year|None, source) from the competition string."""
    c = competition or ''
    m = YEAR_RE.search(c)
    if m:
        return int(m.group(1)), 'explicit'
    mo = ORD_RE.search(c)
    if mo:
        y = ordinal_to_year(config, int(mo.group(1)))
        if y and 1950 <= y <= 2026:
            return y, 'ordinal'
    return None, None


def translate_path(path):
    """Translate a 'L1 > L2 > L3 > L4' topic path; returns dict of levels."""
    parts = [p.strip() for p in (path or '').split('>') if p.strip()]
    levels = {'l1': None, 'l2': None, 'l3': None, 'l4': None}
    zh = []
    for i, p in enumerate(parts[:4]):
        key = f'l{i + 1}'
        levels[key] = p
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


# --------------------------------------------------------------------------- #
# Schema
# --------------------------------------------------------------------------- #
SCHEMA = """
CREATE TABLE problems (
  id            TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL,
  config        TEXT NOT NULL,
  country       TEXT NOT NULL,
  country_zh    TEXT NOT NULL,
  competition   TEXT NOT NULL DEFAULT '',
  competition_raw TEXT NOT NULL DEFAULT '',
  year          INTEGER,
  year_source   TEXT,
  problem_number TEXT,
  problem_number_source TEXT,
  problem_md    TEXT NOT NULL,
  final_answer  TEXT,
  has_solution  INTEGER NOT NULL DEFAULT 0,
  num_solutions INTEGER NOT NULL DEFAULT 0,
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
  categories_json TEXT NOT NULL DEFAULT '[]',
  search_solutions TEXT NOT NULL DEFAULT '',
  search_categories TEXT NOT NULL DEFAULT ''
);
CREATE TABLE solutions (
  problem_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  solution_md TEXT NOT NULL,
  PRIMARY KEY (problem_id, idx)
);
CREATE TABLE problem_categories (
  problem_id TEXT NOT NULL,
  l1 TEXT, l2 TEXT, l3 TEXT, l4 TEXT,
  l1_zh TEXT, l2_zh TEXT, path_zh TEXT
);
CREATE TABLE build_meta (key TEXT PRIMARY KEY, value TEXT);

CREATE INDEX idx_p_config ON problems(config);
CREATE INDEX idx_p_country ON problems(country_zh);
CREATE INDEX idx_p_year ON problems(year);
CREATE INDEX idx_p_competition ON problems(competition);
CREATE INDEX idx_p_difficulty ON problems(difficulty);
CREATE INDEX idx_p_diffscore ON problems(difficulty_score);
CREATE INDEX idx_p_ptype ON problems(problem_type);
CREATE INDEX idx_p_hassol ON problems(has_solution);
CREATE INDEX idx_pc_pid ON problem_categories(problem_id);
CREATE INDEX idx_pc_l1 ON problem_categories(l1_zh);
CREATE INDEX idx_pc_l2 ON problem_categories(l2_zh);
CREATE INDEX idx_pc_l3 ON problem_categories(l3);
CREATE INDEX idx_pc_l4 ON problem_categories(l4);

CREATE VIRTUAL TABLE problems_fts USING fts5(
  competition, problem_md, search_solutions, search_categories, country_zh,
  content='problems', content_rowid='rowid', tokenize='trigram'
);
"""


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
    enrich = load_enrichment(args.enrichment)
    print(f'enrichment rows: {len(enrich)}', flush=True)

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    con = sqlite3.connect(DB_PATH)
    con.executescript('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;')
    con.executescript(SCHEMA)

    n_rows = n_img_files = n_year_parsed = 0
    seen_ids = set()
    import glob
    for config in CONFIGS:
        prefix = CONFIG_PREFIX[config]
        pqs = sorted(glob.glob(os.path.join(snap, 'data', config, '*.parquet')))
        for pqf in pqs:
            table = pa_pq.read_table(pqf)
            rows = table.to_pylist()
            for r in rows:
                sid = r['id']
                pid = f'{prefix}-{sid}'
                if pid in seen_ids:
                    pid = f'{prefix}-{sid}-{n_rows}'  # ultra-rare collision guard
                seen_ids.add(pid)

                config_zh = CONFIG_COUNTRY_ZH[config]
                country = (r.get('country') or config).strip()
                country_zh = COUNTRY_ZH.get(country, config_zh)
                competition = (r.get('competition') or '').strip()
                comp_display = competition or country_zh

                # ---- images: write files + prep ext for ref rewrite ----
                imgs = r.get('images') or []
                for i, im in enumerate(imgs):
                    b = im.get('bytes') or b''
                    im['_ext'] = sniff_ext(b) if b else 'png'
                if imgs and not args.no_images:
                    pdir = os.path.join(IMAGES_DIR, pid)
                    os.makedirs(pdir, exist_ok=True)
                    for i, im in enumerate(imgs):
                        b = im.get('bytes') or b''
                        if b:
                            with open(os.path.join(pdir, f'{i + 1}.{im["_ext"]}'), 'wb') as fh:
                                fh.write(b)
                            n_img_files += 1

                problem_md = rewrite_image_refs(r.get('problem_markdown') or '', pid, imgs)
                sols = [rewrite_image_refs(s or '', pid, imgs)
                        for s in (r.get('solutions_markdown') or []) if (s or '').strip()]

                # ---- year (parsed) then enrichment override ----
                year, ysrc = parse_year(config, competition)
                e = enrich.get(pid) or enrich.get(sid) or {}
                if e.get('year') and not year:
                    year, ysrc = int(e['year']), 'llm'
                elif e.get('year') and e.get('year_override'):
                    year, ysrc = int(e['year']), 'llm'
                if year:
                    n_year_parsed += 1

                pnum = e.get('problem_number')
                pnum_src = 'llm' if pnum else None

                # ---- categories ----
                cats = []
                cat_rows = []
                seen_paths = set()
                for path in (r.get('topics_flat') or []):
                    lv = translate_path(path)
                    if lv['path_zh'] and lv['path_zh'] not in seen_paths:
                        seen_paths.add(lv['path_zh'])
                        cats.append(lv['path_zh'])
                        cat_rows.append((pid, lv['l1'], lv['l2'], lv['l3'], lv['l4'],
                                         lv['l1_zh'], lv['l2_zh'], lv['path_zh']))

                ptype = r.get('problem_type')
                difficulty = e.get('difficulty')
                difficulty_zh = e.get('difficulty_zh')
                difficulty_score = e.get('difficulty_score')
                difficulty_source = e.get('difficulty_source') or ('llm' if difficulty else None)

                con.execute(
                    """INSERT INTO problems
                       (id, source_id, config, country, country_zh, competition,
                        competition_raw, year, year_source, problem_number,
                        problem_number_source, problem_md, final_answer,
                        has_solution, num_solutions, language, problem_type,
                        problem_type_zh, difficulty, difficulty_zh, difficulty_score,
                        difficulty_source, rationale_zh, has_images, num_images,
                        categories_json, search_solutions, search_categories)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (pid, sid, config, country, country_zh, comp_display, competition,
                     year, ysrc, pnum, pnum_src, problem_md, r.get('final_answer'),
                     1 if sols else 0, len(sols), r.get('language'), ptype,
                     PROBLEM_TYPE_ZH.get(ptype), difficulty, difficulty_zh,
                     difficulty_score, difficulty_source, e.get('rationale_zh'),
                     1 if imgs else 0, len(imgs), json.dumps(cats, ensure_ascii=False),
                     '\n'.join(sols), ' '.join(cats)))
                for i, s in enumerate(sols):
                    con.execute('INSERT INTO solutions VALUES (?,?,?)', (pid, i, s))
                con.executemany(
                    'INSERT INTO problem_categories VALUES (?,?,?,?,?,?,?,?)', cat_rows)
                n_rows += 1
        print(f'  {config}: cumulative rows={n_rows}', flush=True)

    # populate FTS from content table
    con.execute("""INSERT INTO problems_fts(rowid, competition, problem_md,
                   search_solutions, search_categories, country_zh)
                   SELECT rowid, competition, problem_md, search_solutions,
                          search_categories, country_zh FROM problems""")

    from datetime import datetime, timezone
    meta = {
        'schema_version': '1', 'source_total': str(n_rows),
        'image_files': str(n_img_files), 'year_filled': str(n_year_parsed),
        'enriched': str(len(enrich)), 'configs': ','.join(CONFIGS),
    }
    con.executemany('INSERT INTO build_meta VALUES (?,?)', list(meta.items()))
    con.commit()
    con.execute('ANALYZE')
    con.commit()
    con.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    con.close()

    print(f'\nDONE: {n_rows} problems, {n_img_files} image files, '
          f'{n_year_parsed} with year ({100 * n_year_parsed // max(n_rows, 1)}%)')
    print(f'DB: {DB_PATH}')


if __name__ == '__main__':
    main()
