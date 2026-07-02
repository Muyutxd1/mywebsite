"""
Convert agent-written zh_*.md translation files (same <<<UNIT k>>> block
format as work_*.md) into out_*.jsonl for merge_translations.py. Doing the
JSON encoding mechanically here removes the LLM-writes-escaped-JSON failure
mode entirely.

  py backend/scripts/harvest_translation_output.py
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
SHARDS_DIR = os.path.join(BACKEND, 'data', 'translations', 'shards')

UNIT_RE = re.compile(r'^<<<UNIT ([ps]:[0-9a-f]{16})>>>\s*$')


def parse_units(path):
    units = []
    k, buf = None, []
    with open(path, encoding='utf-8') as f:
        for line in f:
            m = UNIT_RE.match(line.strip())
            if m:
                if k and ''.join(buf).strip():
                    units.append((k, '\n'.join(buf).strip()))
                k, buf = m.group(1), []
            elif k is not None:
                buf.append(line.rstrip('\n'))
    if k and ''.join(buf).strip():
        units.append((k, '\n'.join(buf).strip()))
    return units


def main():
    n_files = n_units = 0
    for zh_md in sorted(glob.glob(os.path.join(SHARDS_DIR, 'zh_*.md'))):
        num = re.search(r'zh_(\d+)\.md$', zh_md).group(1)
        units = parse_units(zh_md)
        if not units:
            print(f'  WARN: {os.path.basename(zh_md)} parsed to 0 units')
            continue
        out_path = os.path.join(SHARDS_DIR, f'out_{num}.jsonl')
        with open(out_path, 'w', encoding='utf-8') as f:
            for k, zh in units:
                f.write(json.dumps({'k': k, 'zh': zh, 'model': 'sonnet-5'},
                                   ensure_ascii=False) + '\n')
        n_files += 1
        n_units += len(units)
    print(f'harvested {n_units} units from {n_files} zh_*.md -> out_*.jsonl')


if __name__ == '__main__':
    main()
