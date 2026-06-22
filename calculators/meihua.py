"""
梅花易数 — Plum Blossom I-Ching Calculator
数字起卦法：三数定上卦/下卦/动爻
"""
import random
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

# Ba gua mapping (number 1-8 → name)
# 1=乾☰, 2=兑☱, 3=离☲, 4=震☳, 5=巽☴, 6=坎☵, 7=艮☶, 8=坤☷
BAGUA_NUM = {
    1: '乾', 2: '兑', 3: '离', 4: '震',
    5: '巽', 6: '坎', 7: '艮', 8: '坤',
}

# Wuxing of each gua
GUA_WUXING = {
    '乾': '金', '兑': '金', '离': '火', '震': '木',
    '巽': '木', '坎': '水', '艮': '土', '坤': '土',
}

# Wuxing interaction
WUXING_RELATION = {
    ('金', '木'): '克', ('金', '土'): '生', ('金', '水'): '生', ('金', '火'): '被克',
    ('木', '土'): '克', ('木', '火'): '生', ('木', '水'): '生', ('木', '金'): '被克',
    ('水', '火'): '克', ('水', '木'): '生', ('水', '金'): '生', ('水', '土'): '被克',
    ('火', '金'): '克', ('火', '土'): '生', ('火', '木'): '生', ('火', '水'): '被克',
    ('土', '水'): '克', ('土', '金'): '生', ('土', '火'): '生', ('土', '木'): '被克',
}


def _num_to_gua(n):
    """Convert number to trigram (1-8 → 乾/兑/离/震/巽/坎/艮/坤)."""
    remainder = (n - 1) % 8 + 1 if n else 8
    return BAGUA_NUM[remainder]


def _num_to_line(n):
    """Convert number to changing line (1-6)."""
    remainder = (n - 1) % 6 + 1 if n else 6
    return remainder


def _load_json(name):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


class MeihuaCalculator:
    """梅花易数计算器"""

    @staticmethod
    def _gua_to_hexagram_id(upper, lower):
        """Find hexagram id from upper and lower trigram names."""
        data = _load_json('yijing_64.json')
        hexagrams = data.get('hexagrams', [])
        upper_short = upper  # e.g. '乾'
        lower_short = lower  # e.g. '兑'
        for h in hexagrams:
            # h['upper'] is like '☰乾', h['lower'] like '☱兑'
            if upper_short in h['upper'] and lower_short in h['lower']:
                return h
        return None

    def calculate(self, num1=None, num2=None, num3=None):
        """
        Calculate Meihua Yishu hexagram from three numbers.
        If numbers are None, generate random ones.
        """
        # Use date-based numbers if not provided
        if num1 is None and num2 is None and num3 is None:
            import datetime
            now = datetime.datetime.now()
            num1 = now.year % 100
            num2 = now.month
            num3 = now.day

        # Ensure numbers are reasonable
        n1 = int(num1) if num1 else random.randint(1, 99)
        n2 = int(num2) if num2 else random.randint(1, 99)
        n3 = int(num3) if num3 else random.randint(1, 99)

        # Determine trigrams
        upper_gua = _num_to_gua(n1)  # 上卦
        lower_gua = _num_to_gua(n2)  # 下卦
        changing_line = _num_to_line(n3)  # 动爻

        # Original hexagram (本卦)
        ben_gua = self._gua_to_hexagram_id(upper_gua, lower_gua)

        # Mutual hexagram (互卦) — lines 2,3,4 → lower; 3,4,5 → upper
        # We approximate by taking the middle trigrams
        # For simplicity, we derive from the hexagram structure
        # This is a simplification — proper mutual hexagram requires line knowledge

        # Changed hexagram (变卦) — flip the changing line
        # Since we don't have per-line yin/yang, we approximate by changing the lower trigram
        # if line ≤ 3, or upper trigram if line > 3
        if changing_line <= 3:
            changed_lower = _num_to_gua((n2 + changing_line) % 8 or 8)
            changed_upper = upper_gua
        else:
            changed_upper = _num_to_gua((n1 + changing_line) % 8 or 8)
            changed_lower = lower_gua
        bian_gua = self._gua_to_hexagram_id(changed_upper, changed_lower)

        # Mutual hexagram
        # Middle lines form new trigrams
        hu_lower = _num_to_gua((n1 + n2 + n3) % 8 or 8)
        hu_upper = _num_to_gua((n2 + n3 + changing_line) % 8 or 8)
        hu_gua = self._gua_to_hexagram_id(hu_upper, hu_lower)

        # Ti-Yong analysis (体用生克)
        # Ti gua (体卦) = the unchanging trigram
        # Yong gua (用卦) = the changing trigram
        if changing_line <= 3:
            ti_gua = upper_gua   # upper doesn't change
            yong_gua = lower_gua  # lower changes
        else:
            ti_gua = lower_gua   # lower doesn't change
            yong_gua = upper_gua  # upper changes

        ti_wx = GUA_WUXING[ti_gua]
        yong_wx = GUA_WUXING[yong_gua]

        relation = WUXING_RELATION.get((ti_wx, yong_wx), '')
        if relation == '生':
            ti_yong_msg = f'用生体（{yong_wx}生{ti_wx}），大吉。外部环境滋养你，万事顺利。'
        elif relation == '克':
            ti_yong_msg = f'用克体（{yong_wx}克{ti_wx}），凶。外部环境压制你，需谨慎行事。'
        elif relation == '被克':
            ti_yong_msg = f'体克用（{ti_wx}克{yong_wx}），小吉。你能掌控局面，但需付出努力。'
        else:
            ti_yong_msg = f'体用同气（同为{ti_wx}），平和。内外部和谐，事情进展平稳。'

        return {
            'numbers': [n1, n2, n3],
            'upper_gua': upper_gua,
            'lower_gua': lower_gua,
            'changing_line': changing_line,
            'ti_gua': ti_gua,
            'yong_gua': yong_gua,
            'ti_wuxing': ti_wx,
            'yong_wuxing': yong_wx,
            'ti_yong_relation': relation,
            'ti_yong_msg': ti_yong_msg,
            'ben_gua': ben_gua,
            'hu_gua': hu_gua,
            'bian_gua': bian_gua,
            'interpretation': self._interpret(
                ben_gua, hu_gua, bian_gua, changing_line, ti_yong_msg
            ),
        }

    def _interpret(self, ben_gua, hu_gua, bian_gua, yao, ti_yong_msg):
        """Generate comprehensive interpretation."""
        lines = []
        lines.append('【起卦】')
        if ben_gua:
            lines.append(f'本卦：{ben_gua["name"]}（{ben_gua["upper"]}上{ben_gua["lower"]}下）')
        if hu_gua:
            lines.append(f'互卦：{hu_gua["name"]}')
        if bian_gua:
            lines.append(f'变卦：{bian_gua["name"]}')
        lines.append(f'动爻：第{yao}爻')

        lines.append('')
        lines.append('【体用生克】')
        lines.append(ti_yong_msg)

        if ben_gua and ben_gua.get('interpretation'):
            lines.append('')
            lines.append('【本卦解读】')
            lines.append(ben_gua['interpretation'])

        if bian_gua and bian_gua != ben_gua and bian_gua.get('interpretation'):
            lines.append('')
            lines.append('【变卦解读】')
            lines.append(bian_gua['interpretation'])

        return '\n'.join(lines)
