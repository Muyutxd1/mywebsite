"""
Translate work shards to Chinese via the DeepSeek API (openai-compatible).

Reads backend/data/translations/shards/todo_*.jsonl (from
export_translation_input.py), calls deepseek-chat once per unit with hard
LaTeX-fidelity constraints + the glossary, and writes matching out_*.jsonl
lines {k, zh, model}. Resume-safe: units whose key already exists in any
out_*.jsonl (or in zh.jsonl) are skipped.

API key resolution order:
  1. env DEEPSEEK_API_KEY
  2. backend/data/translations/.deepseek_key (single line, gitignored)

  py backend/scripts/translate_deepseek.py                 # all todo shards
  py backend/scripts/translate_deepseek.py --shards 1-50   # shard number range
  py backend/scripts/translate_deepseek.py --workers 8
"""
import argparse
import glob
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
TR_DIR = os.path.join(BACKEND, 'data', 'translations')
SHARDS_DIR = os.path.join(TR_DIR, 'shards')
ZH_PATH = os.path.join(TR_DIR, 'zh.jsonl')
KEY_FILE = os.path.join(TR_DIR, '.deepseek_key')
GLOSSARY = os.path.join(TR_DIR, 'glossary.json')

API_URL = 'https://api.deepseek.com/chat/completions'
MODEL = 'deepseek-chat'

_print_lock = threading.Lock()


def log(msg):
    with _print_lock:
        print(msg, flush=True)


def api_key():
    k = os.environ.get('DEEPSEEK_API_KEY', '').strip()
    if k:
        return k
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, encoding='utf-8') as f:
            k = f.read().strip()
        if k:
            return k
    sys.exit('no DeepSeek key: set DEEPSEEK_API_KEY or write '
             'backend/data/translations/.deepseek_key')


def system_prompt():
    with open(GLOSSARY, encoding='utf-8') as f:
        terms = json.load(f)['terms']
    lines = '\n'.join(f'- {en} → {zh}' for en, zh in terms.items())
    return f"""你是奥数竞赛题目的专业译者。把用户给出的英文数学题面或解答翻译成简体中文，输出翻译结果本身，不要任何前后缀说明。

硬性规则（违反任何一条即废）：
1. 所有数学内容逐字节原样保留：$...$、$$...$$、\\[...\\]、\\(...\\)、\\begin{{...}}...\\end{{...}} 环境（含 align/asy 等）、`代码`、图片引用 ![](attached_image_N.png)。数学环境内部一个字符都不能动。
2. 只翻译数学环境之外的自然语言；不得增删或改动任何数学条件、数值、不等号方向、量词（至少/至多/存在/任意）。
3. Markdown 结构（标题/列表/换行段落）保持原有形态。
4. 人名保留原文（Euler 等惯用中文名可用中文），竞赛名保留原文。
5. 语言风格：规范的中文数学书面语，如「设 $n$ 为正整数」「证明：…」「求所有满足…的」。

术语表（务必遵循）：
{lines}"""


def existing_keys():
    done = set()
    for path in [ZH_PATH] + glob.glob(os.path.join(SHARDS_DIR, 'out_*.jsonl')):
        if not os.path.exists(path):
            continue
        with open(path, encoding='utf-8') as f:
            for line in f:
                try:
                    o = json.loads(line)
                    if o.get('k') and o.get('zh'):
                        done.add(o['k'])
                except json.JSONDecodeError:
                    continue
    return done


def call_deepseek(key, sys_prompt, text, max_retries=4):
    body = json.dumps({
        'model': MODEL,
        'messages': [
            {'role': 'system', 'content': sys_prompt},
            {'role': 'user', 'content': text},
        ],
        'temperature': 0.2,
        'max_tokens': 8000,
    }).encode('utf-8')
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                API_URL, data=body,
                headers={'Content-Type': 'application/json',
                         'Authorization': f'Bearer {key}'})
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read().decode('utf-8'))
            return data['choices'][0]['message']['content'].strip()
        except (urllib.error.HTTPError, urllib.error.URLError, OSError,
                KeyError, json.JSONDecodeError) as e:
            code = getattr(e, 'code', None)
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt * (4 if code == 429 else 1)
            time.sleep(wait)


def process_shard(key, sys_prompt, todo_path, done, workers):
    m = re.search(r'todo_(\d+)\.jsonl$', todo_path)
    out_path = os.path.join(SHARDS_DIR, f'out_{m.group(1)}.jsonl')
    units = []
    with open(todo_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            u = json.loads(line)
            if u['k'] not in done:
                units.append(u)
    if not units:
        return 0, 0

    lock = threading.Lock()
    n_ok = n_err = 0

    def work(u):
        nonlocal n_ok, n_err
        try:
            zh = call_deepseek(key, sys_prompt, u['src'])
            with lock:
                with open(out_path, 'a', encoding='utf-8') as f:
                    f.write(json.dumps({'k': u['k'], 'zh': zh, 'model': MODEL},
                                       ensure_ascii=False) + '\n')
                n_ok += 1
        except Exception as e:
            with lock:
                n_err += 1
            log(f'  ERR {u["k"]}: {type(e).__name__} {e}')

    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(work, units))
    return n_ok, n_err


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shards', default='',
                    help='shard number range like 1-50 (default: all)')
    ap.add_argument('--workers', type=int, default=8)
    args = ap.parse_args()

    key = api_key()
    sys_prompt = system_prompt()
    todos = sorted(glob.glob(os.path.join(SHARDS_DIR, 'todo_*.jsonl')))
    if args.shards:
        lo, hi = (int(x) for x in args.shards.split('-'))
        todos = [t for t in todos
                 if lo <= int(re.search(r'todo_(\d+)', t).group(1)) <= hi]
    if not todos:
        sys.exit('no todo shards (run export_translation_input.py first)')

    done = existing_keys()
    log(f'{len(todos)} shards | {len(done)} units already done | '
        f'{args.workers} workers')

    t0 = time.time()
    total_ok = total_err = 0
    for i, todo in enumerate(todos, 1):
        ok, err = process_shard(key, sys_prompt, todo, done, args.workers)
        total_ok += ok
        total_err += err
        if ok or err:
            el = time.time() - t0
            log(f'[{i}/{len(todos)}] {os.path.basename(todo)}: +{ok} ok '
                f'{err} err | cumulative {total_ok} in {el / 60:.1f} min')
    log(f'DONE: {total_ok} translated, {total_err} errors')
    log('next: py backend/scripts/merge_translations.py')


if __name__ == '__main__':
    main()
