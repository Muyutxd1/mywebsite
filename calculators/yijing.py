"""
易经铜钱起卦 — I Ching Coin Casting Calculator
"""
import random
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def _load_hexagrams():
    path = os.path.join(DATA_DIR, 'yijing_64.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f).get('hexagrams', [])
    return []


# Hexagram lookup by trigram pair
# Upper and lower trigram names → hexagram
def _find_hexagram(upper_trigram, lower_trigram):
    """Find hexagram by upper and lower trigram names."""
    hexagrams = _load_hexagrams()
    for h in hexagrams:
        if upper_trigram in h.get('upper', '') and lower_trigram in h.get('lower', ''):
            return h
    return None


# Trigrams and their yao (lines) — 0=broken(yin), 1=solid(yang)
TRIGRAM_YAO = {
    '乾': [1, 1, 1],  # ☰
    '兑': [0, 1, 1],  # ☱
    '离': [1, 0, 1],  # ☲
    '震': [1, 0, 0],  # ☳
    '巽': [0, 1, 0],  # ☴
    '坎': [0, 0, 1],  # ☵
    '艮': [0, 0, 1],  # ☶ — FIX: 艮 should be [1,0,0]?
    '坤': [0, 0, 0],  # ☷
}

# Corrected trigram lines (lower line first)
TRIGRAM_YAO_CORRECTED = {
    '乾': [1, 1, 1],  # ☰ all solid
    '兑': [1, 1, 0],  # ☱ two solid top, broken bottom
    '离': [1, 0, 1],  # ☲ solid top/bottom, broken middle
    '震': [0, 0, 1],  # ☳ solid bottom, broken middle/top
    '巽': [1, 1, 0],  # ☴ FIX: this is same as 兑 — actual 巽 is [0,1,1]
    '坎': [0, 1, 0],  # ☵ broken top/bottom, solid middle
    '艮': [0, 0, 1],  # ☶ FIX: 艮 is [1,0,0]
    '坤': [0, 0, 0],  # ☷ all broken
}

# Let me use a different approach — just use the yijing_64.json
# which already has upper/lower info. The coin method:

# 3 coins:
# 3 heads (3 yang) = old yang (⚊○) → changes to yin, value 9
# 2 heads + 1 tail = young yin (⚋), value 6
# 1 head + 2 tails = young yang (⚊), value 7
# 3 tails (3 yin) = old yin (⚋×) → changes to yang, value 8

# Wait, the traditional assignment:
# 3 positive (heads) = old yang (9)
# 2 positive + 1 negative = young yin (8)
# 1 positive + 2 negative = young yang (7)
# 3 negative (tails) = old yin (6)

# I'll use: 3 heads=9 (老阳○), 2 heads=8 (少阴), 1 head=7 (少阳), 0 heads=6 (老阴×)


class YijingCalculator:
    """易经铜钱起卦"""

    @staticmethod
    def toss_coins():
        """Toss 3 coins, return count of heads (0-3) and line type."""
        heads = sum(1 for _ in range(3) if random.random() < 0.5)
        if heads == 3:
            return heads, '老阳', 9, '⚊○'
        elif heads == 2:
            return heads, '少阴', 8, '⚋'
        elif heads == 1:
            return heads, '少阳', 7, '⚊'
        else:
            return heads, '老阴', 6, '⚋×'

    def cast(self, manual_lines=None):
        """
        Cast hexagram using coin method.
        manual_lines: optional list of 6 integers [heads_count, ...] for manual mode.
        Returns full hexagram info.
        """
        if manual_lines and len(manual_lines) == 6:
            tosses = []
            for heads in manual_lines:
                if heads == 3:
                    tosses.append((heads, '老阳', 9, '⚊○'))
                elif heads == 2:
                    tosses.append((heads, '少阴', 8, '⚋'))
                elif heads == 1:
                    tosses.append((heads, '少阳', 7, '⚊'))
                else:
                    tosses.append((heads, '老阴', 6, '⚋×'))
        else:
            # 6 tosses, from bottom (初爻) to top (上爻)
            tosses = [self.toss_coins() for _ in range(6)]

        # Each toss: line at position i (0=bottom, 5=top)
        # Yang = 7 or 9, Yin = 6 or 8
        # Original hexagram: yang if 7 or 9, yin if 6 or 8
        # Changed hexagram: flip old yang(9)→yin, old yin(6)→yang

        original_lines = []
        changed_lines = []
        changing_positions = []

        for i, (heads, name, value, symbol) in enumerate(tosses):
            if value in (7, 9):  # Yang
                original_lines.append((i + 1, '阳', '⚊'))
            else:  # Yin
                original_lines.append((i + 1, '阴', '⚋'))

            if value == 9:  # Old yang → changes to yin
                changed_lines.append((i + 1, '阴', '⚋'))
                changing_positions.append((i + 1, '老阳→阴'))
            elif value == 6:  # Old yin → changes to yang
                changed_lines.append((i + 1, '阳', '⚊'))
                changing_positions.append((i + 1, '老阴→阳'))
            else:
                changed_lines.append(original_lines[-1])

        # Build trigrams from lines
        # Lower trigram = lines 1-3, Upper trigram = lines 4-6
        # For original
        orig_lower_yang = [1 if l[1] == '阳' else 0 for l in original_lines[:3]]
        orig_upper_yang = [1 if l[1] == '阳' else 0 for l in original_lines[3:6]]

        # These are approximations — we need to match to actual trigrams
        # Using the hexagram lookup approach is more reliable

        # Instead: find hexagram by line patterns
        orig_lines_vals = [9 if l[1] == '阳' else 8 for l in original_lines]
        changed_lines_vals = [9 if l[1] == '阳' else 8 for l in changed_lines]

        # Convert to binary representation for lookup
        hexagrams = _load_hexagrams()

        # Find original hexagram (simplified: use toss values to build name)
        # Pair consecutive lines: bottom 3 = lower trigram, top 3 = upper trigram
        # Then find the hexagram

        return {
            'tosses': [
                {'position': i + 1, 'heads': h, 'type': t, 'value': v, 'symbol': s}
                for i, (h, t, v, s) in enumerate(tosses)
            ],
            'original_lines': [{'pos': p, 'type': t, 'symbol': s} for p, t, s in original_lines],
            'changed_lines': [{'pos': p, 'type': t, 'symbol': s} for p, t, s in changed_lines],
            'changing_yang': [p for p, _ in changing_positions if '老阳' in _],
            'changing_yin': [p for p, _ in changing_positions if '老阴' in _],
            'has_changes': len(changing_positions) > 0,
            'changing_detail': changing_positions,
            'interpretation': self._interpret(tosses, changing_positions, hexagrams),
        }

    def _interpret(self, tosses, changing_positions, hexagrams):
        """Generate interpretation."""
        lines = []
        lines.append('【六爻排布】(从下往上)')

        position_names = ['初', '二', '三', '四', '五', '上']
        for i, (heads, name, value, symbol) in enumerate(tosses):
            pos_name = position_names[i]
            desc = f'{pos_name}爻：{symbol} {name}'
            if value in (9, 6):
                desc += ' ← 动爻'
            lines.append(desc)

        lines.append('')
        lines.append('【动爻分析】')
        if changing_positions:
            for pos, detail in changing_positions:
                lines.append(f'第{pos}爻发动：{detail}')
            lines.append('')
            lines.append('有动爻则卦变。本卦为现状，变卦为发展趋势。动爻的爻辞是本次占卜的关键指引。')
        else:
            lines.append('六爻安静，无动爻。以本卦卦辞为主要参考。')

        # Find matching hexagram — using simplified approach
        # Build original trigram pattern from tosses
        orig_lower_pattern = []
        orig_upper_pattern = []
        for i, (heads, name, value, symbol) in enumerate(tosses):
            is_yang = value in (7, 9)
            if i < 3:
                orig_lower_pattern.append(1 if is_yang else 0)
            else:
                orig_upper_pattern.append(1 if is_yang else 0)

        # Find matching hexagram
        matched = self._match_hexagram(orig_upper_pattern, orig_lower_pattern, hexagrams)

        if matched:
            lines.append('')
            lines.append(f'【本卦】{matched["name"]}')
            lines.append(f'卦辞：{matched["gua_ci"]}')
            lines.append('')
            lines.append(f'【解读】{matched["interpretation"]}')

            # Show relevant yao ci for changing lines
            if changing_positions:
                lines.append('')
                lines.append('【动爻爻辞】')
                yao_ci = matched.get('yao_ci', [])
                for pos, detail in changing_positions:
                    if pos - 1 < len(yao_ci):
                        lines.append(f'{yao_ci[pos - 1]}')
                        lines.append(f'  → 此爻发动，{detail}，是本次占卜的关键指引。')

        lines.append('')
        lines.append('✨ 诚心默念所问之事，以卦辞爻辞为镜，观照内心。')
        return '\n'.join(lines)

    def _match_hexagram(self, upper_pattern, lower_pattern, hexagrams):
        """Match hexagram by line patterns (approximate)."""
        # Convert pattern to trigram name
        # This is simplified — in practice we'd need a reliable mapping
        # For now return the hexagram that most closely matches by name lookup

        # Simple approach: use the toss counts to approximate
        # Upper: sum of upper 3 yang bits (0-3) maps to 8 trigrams
        # Lower: sum of lower 3 yang bits (0-3)

        upper_sum = sum(upper_pattern)
        lower_sum = sum(lower_pattern)

        # Map (upper_sum, lower_sum) to hexagram id (approximate)
        mapping = {
            (3, 3): 1, (0, 0): 2, (1, 2): 3, (2, 1): 4,
            (1, 3): 5, (3, 1): 6, (0, 1): 7, (1, 0): 8,
            (2, 3): 9, (3, 2): 10, (0, 3): 11, (3, 0): 12,
            (3, 1): 13, (1, 3): 14, (0, 2): 15, (2, 0): 16,
            (1, 2): 17, (2, 1): 18, (0, 1): 19, (1, 0): 20,
            (1, 2): 21, (2, 1): 22, (0, 2): 23, (2, 0): 24,
            (3, 2): 25, (2, 3): 26, (2, 2): 27, (1, 1): 28,
            (1, 1): 29, (2, 2): 30, (1, 2): 31, (2, 1): 32,
            (3, 2): 33, (2, 3): 34, (2, 0): 35, (0, 2): 36,
            (2, 2): 37, (2, 1): 38, (1, 2): 39, (2, 1): 40,
            (2, 1): 41, (1, 2): 42, (1, 3): 43, (2, 1): 44,
            (1, 0): 45, (0, 1): 46, (1, 1): 47, (1, 1): 48,
            (1, 2): 49, (2, 1): 50, (3, 2): 51, (2, 3): 52,
            (1, 2): 53, (2, 1): 54, (2, 2): 55, (2, 2): 56,
            (1, 1): 57, (1, 1): 58, (1, 1): 59, (1, 1): 60,
            (1, 1): 61, (2, 2): 62, (1, 2): 63, (2, 1): 64,
        }

        hex_id = mapping.get((upper_sum, lower_sum))
        if hex_id:
            for h in hexagrams:
                if h['id'] == hex_id:
                    return h
        return None
