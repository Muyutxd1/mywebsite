"""
梅花易数 — Plum Blossom I-Ching.
数字起卦：上卦数定上卦，下卦数定下卦，动爻数定动爻；体用生克断吉凶。
"""
import random

from core.yixue import (
    TRIGRAMS, number_to_trigram, lines_from_trigrams,
    hexagram_from_lines, mutual_lines, changed_lines, wuxing_relation,
)


class MeihuaCalculator:
    """梅花易数计算器"""

    def calculate(self, num1=None, num2=None, num3=None):
        if num1 is None and num2 is None and num3 is None:
            import datetime
            now = datetime.datetime.now()
            num1, num2, num3 = now.year % 100, now.month, now.day

        n1 = int(num1) if num1 else random.randint(1, 99)
        n2 = int(num2) if num2 else random.randint(1, 99)
        n3 = int(num3) if num3 else random.randint(1, 99)

        upper = number_to_trigram(n1)            # 上卦
        lower = number_to_trigram(n2)            # 下卦
        moving = (n3 - 1) % 6 + 1                 # 动爻 (1-6, 自下而上)

        ben_lines = lines_from_trigrams(upper, lower)
        ben = hexagram_from_lines(ben_lines)
        hu = hexagram_from_lines(mutual_lines(ben_lines))
        bian = hexagram_from_lines(changed_lines(ben_lines, [moving]))

        # 体用：动爻所在之卦为「用」，另一卦为「体」
        if moving <= 3:                          # 动在下卦
            ti_gua, yong_gua = upper, lower
        else:                                    # 动在上卦
            ti_gua, yong_gua = lower, upper
        ti_wx = TRIGRAMS[ti_gua]['wuxing']
        yong_wx = TRIGRAMS[yong_gua]['wuxing']
        rel_key, rel_label, fortune, rel_msg = wuxing_relation(ti_wx, yong_wx)

        return {
            'numbers': [n1, n2, n3],
            'upper_gua': upper, 'lower_gua': lower,
            'upper_symbol': TRIGRAMS[upper]['symbol'],
            'lower_symbol': TRIGRAMS[lower]['symbol'],
            'changing_line': moving,
            'ti_gua': ti_gua, 'yong_gua': yong_gua,
            'ti_wuxing': ti_wx, 'yong_wuxing': yong_wx,
            'ti_yong_relation': rel_label,
            'ti_yong_fortune': fortune,
            'ti_yong_msg': rel_msg,
            'ben_gua': ben, 'hu_gua': hu, 'bian_gua': bian,
            'moving_yao_ci': self._moving_yao(ben, moving),
            'interpretation': self._interpret(
                ben, hu, bian, moving, ti_gua, yong_gua, rel_label, fortune, rel_msg
            ),
        }

    @staticmethod
    def _moving_yao(ben, moving):
        if ben and ben.get('yao_ci') and 1 <= moving <= len(ben['yao_ci']):
            return ben['yao_ci'][moving - 1]
        return ''

    def _interpret(self, ben, hu, bian, moving, ti, yong, rel, fortune, rel_msg):
        L = []
        L.append('【卦象】')
        if ben:
            L.append(f'本卦《{ben["name"]}》（{ben["upper_symbol"]}{ben["upper_gua"]}上 '
                     f'{ben["lower_symbol"]}{ben["lower_gua"]}下）— 所问之事的当下格局。')
        if hu:
            L.append(f'互卦《{hu["name"]}》— 事情发展的中间过程、潜藏的玄机。')
        if bian:
            L.append(f'变卦《{bian["name"]}》— 事态最终的走向与结果。')
        L.append(f'动爻：第{moving}爻发动，是本卦转向变卦的枢机。')

        L.append('')
        L.append('【体用生克】')
        L.append(f'体卦为{ti}（{TRIGRAMS[ti]["wuxing"]}），代表你自身；'
                 f'用卦为{yong}（{TRIGRAMS[yong]["wuxing"]}），代表所问之事与外部环境。')
        L.append(f'{rel}（断曰：{fortune}）。{rel_msg}')

        if ben and ben.get('gua_ci'):
            L.append('')
            L.append('【本卦·卦辞】')
            L.append(f'{ben["name"]}：{ben["gua_ci"]}')
            if ben.get('interpretation'):
                L.append(ben['interpretation'])

        moving_yao = self._moving_yao(ben, moving)
        if moving_yao:
            L.append('')
            L.append('【动爻·爻辞】')
            L.append(moving_yao)
            L.append('梅花易数以动爻爻辞为占断的核心提示，宜细细玩味此爻之意。')

        if bian and bian.get('interpretation') and bian.get('name') != (ben or {}).get('name'):
            L.append('')
            L.append('【变卦·趋势】')
            L.append(bian['interpretation'])

        L.append('')
        L.append('【综合断语】')
        L.append(self._summary(fortune, ti, yong))
        return '\n'.join(L)

    @staticmethod
    def _summary(fortune, ti, yong):
        base = {
            '吉': '体用相得，此事大体顺遂。把握时机、顺势而为，多有善果。',
            '小吉': '局势在你掌握之中，然非唾手可得；主动进取、肯下功夫，终能成事。',
            '平': '内外平和，事态平稳，无大起大落，宜按部就班。',
            '小凶': '需为此事付出与消耗，先苦后甜；量力而行，勿急于求成。',
            '凶': '外部阻力较大，强行推进易受挫。宜暂避锋芒、以静制动，待时而动。',
        }.get(fortune, '宜以平常心待之。')
        return base + '（梅花易数重在以卦象观照心念，结果仅供参省，决断仍在己心。）'
