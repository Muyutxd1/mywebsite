"""
Convert translation todo shards (jsonl, one long line per unit) into plain-md
work files that an LLM agent can Read whole (the Read tool truncates single
lines at 2000 chars — a long proof on one JSON line would be silently cut).

Soft-wraps source text at spaces to <=160 chars/line. This is hash-safe: the
translation sidecar key normalizes all whitespace runs to single spaces, and
the merge validator counts $-pairs / environments / image refs, none of which
a space->newline swap can change.

  todo_0001.jsonl -> work_0001.md   (units delimited by <<<UNIT k>>> headers)

  py backend/scripts/prep_translation_shards.py
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
SHARDS_DIR = os.path.join(BACKEND, 'data', 'translations', 'shards')

WRAP = 160


def soft_wrap(text, width=WRAP):
    out_lines = []
    for line in text.split('\n'):
        while len(line) > width:
            cut = line.rfind(' ', width // 2, width)
            if cut == -1:
                cut = width  # no space to break at: hard cut (rare, safe for
                # hash — normalization collapses whitespace anyway, and we cut
                # between chars only when no space exists in a 80-160 window)
                # better: avoid splitting inside words if possible
                nxt = line.find(' ', width)
                if nxt != -1 and nxt - width < 40:
                    cut = nxt
                else:
                    out_lines.append(line)
                    line = ''
                    break
            out_lines.append(line[:cut])
            line = line[cut + 1:]
        if line:
            out_lines.append(line)
    return '\n'.join(out_lines)


def main():
    todos = sorted(glob.glob(os.path.join(SHARDS_DIR, 'todo_*.jsonl')))
    n_units = 0
    for todo in todos:
        num = re.search(r'todo_(\d+)\.jsonl$', todo).group(1)
        out_path = os.path.join(SHARDS_DIR, f'work_{num}.md')
        blocks = []
        with open(todo, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                u = json.loads(line)
                blocks.append(f'<<<UNIT {u["k"]}>>>\n{soft_wrap(u["src"])}')
                n_units += 1
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write('\n\n'.join(blocks) + '\n')
    print(f'{len(todos)} shards -> work_*.md ({n_units} units)')

    # sanity: no residual overlong lines
    worst = 0
    for w in glob.glob(os.path.join(SHARDS_DIR, 'work_*.md')):
        with open(w, encoding='utf-8') as f:
            for line in f:
                worst = max(worst, len(line))
    print(f'longest line after wrap: {worst} chars')


if __name__ == '__main__':
    main()
