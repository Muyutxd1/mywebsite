"""
Validate backend/data/competitions/{registry,assignments}.json against
raw_names.json before a build.

Checks:
  * every distinct (config, competition) raw name has exactly one assignment
  * every assignment points to a comp_key defined in the registry
  * round_key values exist in the competition's rounds list
  * fixed_year is in a sane range
  * fixed_year vs. an explicit 4-digit year in the raw name must agree
  * registry keys/regions/tiers are well-formed; comp_keys unique

Exit 0 = clean; exit 1 = problems printed.

  py backend/scripts/validate_competitions.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
COMP_DIR = os.path.join(BACKEND, 'data', 'competitions')

YEAR_RE = re.compile(r'\b(19[5-9]\d|20[0-4]\d)\b')
KEY_RE = re.compile(r'^[a-z0-9_]+$')
REGIONS = {'intl', 'china', 'na', 'asia', 'europe'}


def load(name):
    with open(os.path.join(COMP_DIR, name), encoding='utf-8') as f:
        return json.load(f)


def main():
    raw = load('raw_names.json')
    registry = load('registry.json')
    assigns = load('assignments.json')['assignments']
    errors, warnings = [], []

    # --- registry shape ---
    comp_keys = set()
    rounds_by_comp = {}
    region_keys = {r['key'] for r in registry['regions']}
    if region_keys != REGIONS:
        warnings.append(f'region keys {sorted(region_keys)} != expected {sorted(REGIONS)}')
    for c in registry['competitions']:
        ck = c['comp_key']
        if ck in comp_keys:
            errors.append(f'duplicate comp_key {ck}')
        comp_keys.add(ck)
        if not KEY_RE.match(ck):
            errors.append(f'bad comp_key format: {ck}')
        if c['region'] not in region_keys:
            errors.append(f'{ck}: unknown region {c["region"]}')
        if c['tier'] not in (1, 2, 3, 4):
            errors.append(f'{ck}: bad tier {c["tier"]}')
        if not c.get('name_zh') or not c.get('name_en'):
            errors.append(f'{ck}: missing name_zh/name_en')
        rks = set()
        for r in c.get('rounds') or []:
            if not KEY_RE.match(r['round_key']):
                errors.append(f'{ck}: bad round_key {r["round_key"]}')
            if r['round_key'] in rks:
                errors.append(f'{ck}: duplicate round_key {r["round_key"]}')
            rks.add(r['round_key'])
        rounds_by_comp[ck] = rks
        rule = c.get('edition_rule') or {}
        fy = rule.get('first_edition_year')
        if fy and not (1890 <= fy <= 2026):
            errors.append(f'{ck}: implausible first_edition_year {fy}')

    # --- assignment coverage ---
    raw_pairs = {(e['config'], e['competition']): e['count']
                 for e in raw['entries']}
    seen_pairs = set()
    for a in assigns:
        pair = (a['config'], a['competition'])
        if pair in seen_pairs:
            errors.append(f'duplicate assignment for {pair}')
        seen_pairs.add(pair)
        if pair not in raw_pairs:
            warnings.append(f'assignment for unknown raw name {pair}')
        ck = a['comp_key']
        if ck not in comp_keys:
            errors.append(f'{pair}: unknown comp_key {ck}')
            continue
        rk = a.get('round_key')
        if rk and rk not in rounds_by_comp[ck]:
            errors.append(f'{pair}: round_key {rk!r} not in {ck}.rounds')
        fy = a.get('fixed_year')
        if fy is not None:
            if not (1950 <= fy <= 2026):
                errors.append(f'{pair}: implausible fixed_year {fy}')
            explicit = YEAR_RE.search(a['competition'])
            if explicit and int(explicit.group(1)) != fy:
                # ROC-year strings may legitimately contain a Gregorian year
                # elsewhere; flag as warning, not error.
                warnings.append(
                    f'{pair}: fixed_year {fy} != explicit {explicit.group(1)} in name')

    missing = set(raw_pairs) - seen_pairs
    for pair in sorted(missing):
        errors.append(f'raw name with NO assignment: {pair} [{raw_pairs[pair]} problems]')

    # --- report ---
    n_probs = sum(raw_pairs.values())
    covered = sum(raw_pairs.get(p, 0) for p in seen_pairs if p in raw_pairs)
    fy_probs = sum(raw_pairs.get((a['config'], a['competition']), 0)
                   for a in assigns if a.get('fixed_year'))
    print(f'registry: {len(comp_keys)} competitions, {len(registry["regions"])} regions')
    print(f'assignments: {len(assigns)} (raw distinct: {len(raw_pairs)})')
    print(f'problem coverage: {covered}/{n_probs}')
    print(f'fixed_year coverage: {fy_probs}/{n_probs} problems '
          f'({100 * fy_probs // max(n_probs, 1)}%)')

    for w in warnings:
        print(f'WARN: {w}')
    if errors:
        print(f'\n{len(errors)} ERRORS:')
        for e in errors:
            print(f'  {e}')
        sys.exit(1)
    print('\nOK: validation clean' + (f' ({len(warnings)} warnings)' if warnings else ''))


if __name__ == '__main__':
    main()
