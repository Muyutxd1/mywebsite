"""
塔罗牌 — Tarot Card Calculator
支持三种牌阵：单张 / 三张(过去现在未来) / 凯尔特十字(10张)
"""
import random
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def _load_json(name):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


class TarotCalculator:
    """塔罗牌占卜"""

    SPREADS = {
        'single': {
            'name': '单张牌 · 每日指引',
            'count': 1,
            'positions': ['今日指引'],
        },
        'three': {
            'name': '三张牌 · 过去/现在/未来',
            'count': 3,
            'positions': ['过去', '现在', '未来'],
        },
        'celtic_cross': {
            'name': '凯尔特十字 · 全面解读',
            'count': 10,
            'positions': [
                '当下状况', '阻碍或助力', '根基/过去', '即将过去',
                '目标/显意识', '未来走向', '自我态度', '外部环境',
                '希望与恐惧', '最终结果',
            ],
        },
    }

    def __init__(self):
        self.deck = self._build_deck()

    def _build_deck(self):
        """Build full 78-card deck."""
        data = _load_json('tarot_78.json')
        deck = []
        for card in data.get('major_arcana', []):
            deck.append({
                'id': f'major_{card["id"]}',
                'name_cn': card['name_cn'],
                'name_en': card['name_en'],
                'type': '大阿卡纳',
                'keywords': card['keywords'],
                'upright': card['upright'],
                'reversed': card['reversed'],
            })
        for suit_key, suit_data in data.get('minor_arcana', {}).items():
            suit_name = suit_data.get('name_cn', suit_key)
            for card in suit_data.get('cards', []):
                deck.append({
                    'id': f'{suit_key}_{card["rank"]}',
                    'name_cn': card['name_cn'],
                    'name_en': f'{card["rank"]} of {suit_name}',
                    'type': f'小阿卡纳 · {suit_name}',
                    'keywords': [],
                    'upright': card['upright'],
                    'reversed': card['reversed'],
                })
        return deck

    def draw(self, spread='three'):
        """
        Draw cards for the specified spread.
        Returns cards with position info and interpretation.
        """
        spread_config = self.SPREADS.get(spread, self.SPREADS['three'])
        count = spread_config['count']
        positions = spread_config['positions']

        # Shuffle and draw
        deck_copy = list(self.deck)
        random.shuffle(deck_copy)
        drawn = deck_copy[:count]

        # Random upright/reversed
        results = []
        for i, card in enumerate(drawn):
            is_upright = random.random() < 0.6  # ~60% upright
            results.append({
                'position': positions[i],
                'position_index': i + 1,
                'name_cn': card['name_cn'],
                'name_en': card['name_en'],
                'type': card['type'],
                'is_upright': is_upright,
                'orientation': '正位' if is_upright else '逆位',
                'interpretation': card['upright'] if is_upright else card['reversed'],
                'keywords': card.get('keywords', []),
            })

        return {
            'spread_name': spread_config['name'],
            'cards': results,
            'interpretation': self._interpret(spread, results),
        }

    def _interpret(self, spread, cards):
        """Generate comprehensive interpretation with synthesis."""
        lines = []

        for i, card in enumerate(cards):
            pos = card['position']
            orient = card['orientation']
            lines.append(f'━━━ {pos} ━━━')
            lines.append(f'🃏 {card["name_cn"]}（{card["name_en"]}）')
            lines.append(f'类型：{card["type"]}')
            lines.append(f'方位：{orient}')
            if card.get('keywords'):
                lines.append(f'关键词：{" · ".join(card["keywords"])}')
            lines.append('')
            lines.append(f'解读：{card["interpretation"]}')
            lines.append('')

        # Spread-specific synthesis
        lines.append('─' * 24)
        lines.append('')
        if spread == 'single':
            lines.append('【每日指引】')
            lines.append('这张牌是今天宇宙给你的讯息。它不是一个预测，而是一面镜子——')
            lines.append('反映了你今天可能遇到的能量和心态。带着这个意象度过今天，')
            lines.append('观察生活中的共鸣和共时性。')
            c = cards[0]
            if c['is_upright']:
                lines.append(f'正位的{c["name_cn"]}是一个积极的信号——今天宜{c["keywords"][0] if c.get("keywords") else "保持开放心态"}。')
            else:
                lines.append(f'逆位的{c["name_cn"]}提醒你——今天需特别注意{c["name_cn"]}能量的阻塞或过度。')

        elif spread == 'three':
            lines.append('【三张牌时间线】')
            past = cards[0]
            now = cards[1]
            future = cards[2]
            lines.append(f'过去（{past["name_cn"]}，{past["orientation"]}）——{past["interpretation"][:60]}...')
            lines.append(f'现在（{now["name_cn"]}，{now["orientation"]}）——{now["interpretation"][:60]}...')
            lines.append(f'未来（{future["name_cn"]}，{future["orientation"]}）——{future["interpretation"][:60]}...')
            lines.append('')
            lines.append('三张牌连成一条时间线：过去是因，现在是果，未来是你正在创造的可能性。')

            # Check if all same suit
            types = [c['type'] for c in cards]
            if all('大阿卡纳' in t for t in types):
                lines.append('三张都是大阿卡纳——此事对你人生意义重大，非日常琐事。')
            elif all('小阿卡纳' in t for t in types):
                lines.append('三张小阿卡纳——此事关乎日常生活和人际关系，是实际而非抽象的问题。')

            # Compare past → future energy
            if past['is_upright'] and future['is_upright']:
                lines.append('过去和未来都是正位——能量在正向流动，顺势而为即可。')
            elif not past['is_upright'] and future['is_upright']:
                lines.append('过去的逆位转向未来的正位——困境正在化解，方向是光明的。')
            elif past['is_upright'] and not future['is_upright']:
                lines.append('过去正位而未来逆位——需要调整方向或心态，避免走入误区。')
            else:
                lines.append('两张逆位——当前阶段需要深度反思和内省，逆位不是坏牌，是提醒。')

        elif spread == 'celtic_cross':
            lines.append('【凯尔特十字牌阵 · 全景解读】')
            lines.append('此牌阵从十个维度剖析你的问题——')

            present = cards[0]  # 当下状况
            challenge = cards[1]  # 阻碍或助力
            past_root = cards[2]  # 根基/过去
            passing = cards[3]  # 即将过去
            goal = cards[4]  # 目标/显意识
            future = cards[5]  # 未来走向
            self_att = cards[6]  # 自我态度
            env = cards[7]  # 外部环境
            hopes = cards[8]  # 希望与恐惧
            outcome = cards[9]  # 最终结果

            lines.append('')
            lines.append(f'核心问题：{present["name_cn"]}（{present["orientation"]}）——{present["interpretation"][:80]}...')
            lines.append(f'关键因素：{challenge["name_cn"]}（{challenge["orientation"]}）——{challenge["interpretation"][:80]}...')
            lines.append('')
            lines.append(f'内在根基（过去）：{past_root["name_cn"]} | 意识目标：{goal["name_cn"]}')
            lines.append(f'即将过去：{passing["name_cn"]} | 未来走向：{future["name_cn"]}')
            lines.append('')
            lines.append(f'你的态度：{self_att["name_cn"]} | 外部环境：{env["name_cn"]}')
            lines.append(f'希望与恐惧：{hopes["name_cn"]} | 最终结果：{outcome["name_cn"]}')
            lines.append('')

            # Outcome analysis
            if outcome['is_upright']:
                lines.append(f'最终结果：{outcome["name_cn"]}正位——前景是积极的。')
            else:
                lines.append(f'最终结果：{outcome["name_cn"]}逆位——需要你做出调整才能改变结果。')
                lines.append('凯尔特十字的"最终结果"不是注定的命运，而是当前能量自然流动的趋向——你的选择可以改变它。')

            # Count majors vs minors
            major_count = sum(1 for c in cards if '大阿卡纳' in c['type'])
            if major_count >= 6:
                lines.append(f'牌阵中有{major_count}张大阿卡纳——此问题涉及你人生的重大课题和灵魂成长。')
            elif major_count <= 3:
                lines.append(f'牌阵中只有{major_count}张大阿卡纳——此事更多关乎日常生活层面，不必过于焦虑。')

        lines.append('')
        lines.append('─' * 20)
        lines.append('✨ 塔罗牌是内在智慧的镜子，不是命运的铁律。你才是自己生命的书写者。')

        return '\n'.join(lines)
