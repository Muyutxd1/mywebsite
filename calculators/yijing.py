"""
易经铜钱起卦 — I Ching coin casting.
三枚铜钱掷六次，自下而上成卦；老阳/老阴为动爻，本卦变出之卦。
"""
import random

from core.yixue import hexagram_from_lines


class YijingCalculator:
    """易经铜钱起卦"""

    # heads(正面)数 → (名, 爻值, 符号)。9老阳/6老阴为动爻。
    _TOSS = {
        3: ('老阳', 9, '⚊○'),
        2: ('少阴', 8, '⚋ '),
        1: ('少阳', 7, '⚊ '),
        0: ('老阴', 6, '⚋×'),
    }

    def cast(self, manual_lines=None):
        if manual_lines and len(manual_lines) == 6:
            heads_seq = [int(h) for h in manual_lines]
        else:
            heads_seq = [sum(1 for _ in range(3) if random.random() < 0.5) for _ in range(6)]

        tosses = []
        original = []     # 本卦六爻 bottom→top, 1=阳 0=阴
        changed = []      # 变卦六爻
        moving = []       # 动爻位 (1-indexed) 与说明
        for i, heads in enumerate(heads_seq):
            name, value, symbol = self._TOSS[heads]
            is_yang = value in (7, 9)
            original.append(1 if is_yang else 0)
            if value == 9:        # 老阳 → 阴
                changed.append(0)
                moving.append((i + 1, '老阳 → 阴'))
            elif value == 6:      # 老阴 → 阳
                changed.append(1)
                moving.append((i + 1, '老阴 → 阳'))
            else:
                changed.append(1 if is_yang else 0)
            tosses.append({'position': i + 1, 'heads': heads, 'type': name,
                           'value': value, 'symbol': symbol.strip(),
                           'is_yang': is_yang, 'is_moving': value in (9, 6)})

        ben = hexagram_from_lines(original)
        bian = hexagram_from_lines(changed) if moving else None
        moving_positions = [p for p, _ in moving]

        return {
            'tosses': tosses,
            'ben_gua': ben,
            'bian_gua': bian,
            'has_changes': bool(moving),
            'moving_positions': moving_positions,
            'changing_detail': moving,
            'interpretation': self._interpret(ben, bian, moving),
        }

    def _interpret(self, ben, bian, moving):
        L = []
        if ben:
            L.append('【本卦】')
            L.append(f'《{ben["name"]}》（{ben["upper_symbol"]}{ben["upper_gua"]}上 '
                     f'{ben["lower_symbol"]}{ben["lower_gua"]}下）')
            L.append(f'卦辞：{ben.get("gua_ci", "")}')
            if ben.get('xiang_zhuan'):
                L.append(f'象曰：{ben["xiang_zhuan"]}')
            if ben.get('interpretation'):
                L.append('')
                L.append(ben['interpretation'])

        L.append('')
        if moving:
            L.append('【动爻】')
            L.append('动爻乃此卦应机之处，是占问的核心提示——')
            yao_ci = (ben or {}).get('yao_ci', [])
            for pos, detail in moving:
                if pos - 1 < len(yao_ci):
                    L.append(f'第{pos}爻（{detail}）：{yao_ci[pos - 1]}')
            L.append('')
            L.append(self._moving_rule(len(moving)))
        else:
            L.append('【断法】')
            L.append('六爻安静，无动爻。以本卦卦辞、彖象为断，所问之事格局已定、暂无变数。')

        if bian:
            L.append('')
            L.append('【变卦】')
            L.append(f'《{bian["name"]}》— 事态发展、变化之后的结果。')
            L.append(f'卦辞：{bian.get("gua_ci", "")}')
            if bian.get('interpretation'):
                L.append(bian['interpretation'])

        L.append('')
        L.append('✨ 卦辞爻辞是照见处境的镜子，吉凶悔吝皆系于人的应对。诚心玩味，反求诸己。')
        return '\n'.join(L)

    @staticmethod
    def _moving_rule(count):
        """《周易》传统多爻断法（朱子占法）。"""
        rules = {
            1: '一爻动：以本卦该动爻的爻辞为占。',
            2: '二爻动：以本卦两动爻爻辞为占，而以上爻（位高者）之辞为主。',
            3: '三爻动：以本卦与变卦的卦辞参看，本卦为贞（现状）、变卦为悔（趋向）。',
            4: '四爻动：以变卦中两个不动爻的爻辞为占，下爻为主。',
            5: '五爻动：以变卦中唯一不动爻的爻辞为占。',
            6: '六爻全动：乾坤用九用六，余卦皆以变卦卦辞为占——事已彻底翻转。',
        }
        return '断法：' + rules.get(count, '以变卦卦辞为占。')
