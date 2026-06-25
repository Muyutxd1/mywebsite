"""
易学核心 — Trigram / Hexagram engine shared by 梅花易数 and 易经.

Lines are always represented bottom→top as a tuple/list of 6 ints,
1 = 阳爻 (solid), 0 = 阴爻 (broken).
Lower trigram = lines[0:3], Upper trigram = lines[3:6].
"""
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

# 八卦. lines are bottom→top, 1=阳 0=阴. Verified against the Unicode trigrams.
TRIGRAMS = {
    '乾': {'lines': (1, 1, 1), 'symbol': '☰', 'wuxing': '金', 'nature': '天'},
    '兑': {'lines': (1, 1, 0), 'symbol': '☱', 'wuxing': '金', 'nature': '泽'},
    '离': {'lines': (1, 0, 1), 'symbol': '☲', 'wuxing': '火', 'nature': '火'},
    '震': {'lines': (1, 0, 0), 'symbol': '☳', 'wuxing': '木', 'nature': '雷'},
    '巽': {'lines': (0, 1, 1), 'symbol': '☴', 'wuxing': '木', 'nature': '风'},
    '坎': {'lines': (0, 1, 0), 'symbol': '☵', 'wuxing': '水', 'nature': '水'},
    '艮': {'lines': (0, 0, 1), 'symbol': '☶', 'wuxing': '土', 'nature': '山'},
    '坤': {'lines': (0, 0, 0), 'symbol': '☷', 'wuxing': '土', 'nature': '地'},
}
_LINES_TO_NAME = {v['lines']: k for k, v in TRIGRAMS.items()}

# 后天八卦数 (梅花易数起卦用): 乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
GUA_NUMBER = {'乾': 1, '兑': 2, '离': 3, '震': 4, '巽': 5, '坎': 6, '艮': 7, '坤': 8}
NUMBER_GUA = {v: k for k, v in GUA_NUMBER.items()}

# 五行相生相克
_SHENG = {'木': '火', '火': '土', '土': '金', '金': '水', '水': '木'}  # a 生 b
_KE = {'木': '土', '土': '水', '水': '火', '火': '金', '金': '木'}     # a 克 b


def number_to_trigram(n):
    """数字 → 卦名 (1-8 循环，0/8→坤)。"""
    idx = (int(n) - 1) % 8 + 1
    return NUMBER_GUA[idx]


def trigram_from_lines(three):
    """三爻 (bottom→top) → 卦名。"""
    return _LINES_TO_NAME[tuple(three)]


def _hex_index():
    """Build {(upper_name, lower_name): hexagram} from yijing_64.json."""
    path = os.path.join(DATA_DIR, 'yijing_64.json')
    with open(path, 'r', encoding='utf-8') as f:
        hexagrams = json.load(f).get('hexagrams', [])
    index = {}
    for h in hexagrams:
        up = _trigram_name(h.get('upper', ''))
        lo = _trigram_name(h.get('lower', ''))
        if up and lo:
            index[(up, lo)] = h
    return hexagrams, index


def _trigram_name(s):
    """Extract the 卦名 char from strings like '☰乾' or '乾'."""
    for ch in s:
        if ch in TRIGRAMS:
            return ch
    return ''


_HEXAGRAMS, _HEX_INDEX = _hex_index()


def hexagram_from_lines(six):
    """六爻 (bottom→top, 1/0) → hexagram dict (含 lines/卦名/卦辞/爻辞 等)。"""
    six = tuple(int(x) for x in six)
    lower = trigram_from_lines(six[0:3])
    upper = trigram_from_lines(six[3:6])
    hexagram = _HEX_INDEX.get((upper, lower))
    if hexagram is None:
        return None
    out = dict(hexagram)
    out['lines'] = list(six)
    out['upper_gua'] = upper
    out['lower_gua'] = lower
    out['upper_symbol'] = TRIGRAMS[upper]['symbol']
    out['lower_symbol'] = TRIGRAMS[lower]['symbol']
    return out


def lines_from_trigrams(upper, lower):
    """上卦名 + 下卦名 → 六爻 (bottom→top)。"""
    return list(TRIGRAMS[lower]['lines']) + list(TRIGRAMS[upper]['lines'])


def mutual_lines(six):
    """互卦六爻：下互取 2·3·4 爻，上互取 3·4·5 爻 (1-indexed)。"""
    six = list(six)
    lower_hu = six[1:4]   # 2,3,4 爻
    upper_hu = six[2:5]   # 3,4,5 爻
    return lower_hu + upper_hu


def changed_lines(six, moving_positions):
    """变卦：翻转给定动爻位 (1-indexed list)。"""
    six = list(six)
    for pos in moving_positions:
        i = pos - 1
        six[i] = 1 - six[i]
    return six


def wuxing_relation(ti_wx, yong_wx):
    """
    体用生克。返回 (key, label, fortune, message)。
    fortune ∈ {'吉','小吉','平','小凶','凶'}。
    """
    if ti_wx == yong_wx:
        return ('比和', '体用比和', '吉',
                f'体用同为{ti_wx}，比和。内外同心，事情顺遂平稳，所求多能如愿。')
    if _SHENG.get(yong_wx) == ti_wx:
        return ('用生体', '用生体', '吉',
                f'用卦{yong_wx}生体卦{ti_wx}，大吉。外部环境主动滋养你，贵人相助，水到渠成。')
    if _KE.get(yong_wx) == ti_wx:
        return ('用克体', '用克体', '凶',
                f'用卦{yong_wx}克体卦{ti_wx}，凶。外力压制，阻碍重重，宜守不宜进，谨慎为上。')
    if _SHENG.get(ti_wx) == yong_wx:
        return ('体生用', '体生用', '小凶',
                f'体卦{ti_wx}生用卦{yong_wx}，小凶。你需付出、消耗精力去成全此事，先劳后得。')
    if _KE.get(ti_wx) == yong_wx:
        return ('体克用', '体克用', '小吉',
                f'体卦{ti_wx}克用卦{yong_wx}，小吉。你能掌控局面、克服阻力，但须主动出击方成。')
    return ('', '体用关系', '平', '体用关系平和。')
