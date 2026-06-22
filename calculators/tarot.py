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
        """Generate interpretation."""
        lines = []

        for card in cards:
            pos = card['position']
            orient = card['orientation']
            lines.append(f'━━━ {pos} ━━━')
            lines.append(f'🃏 {card["name_cn"]} ({card["name_en"]})')
            lines.append(f'类型：{card["type"]}')
            lines.append(f'方位：{orient}')
            if card.get('keywords'):
                lines.append(f'关键词：{" · ".join(card["keywords"])}')
            lines.append(f'')
            lines.append(card['interpretation'])
            lines.append('')

        # Spread-specific summary
        if spread == 'single':
            lines.append('💫 这是今天宇宙给你的指引。带着这个讯息度过今天，观察生活中的共鸣。')
        elif spread == 'three':
            lines.append('💫 过去是因，现在是果，未来是你正在创造的可能性。三张牌连接成一条时间线，展示了事情的流动。')
        elif spread == 'celtic_cross':
            lines.append('💫 凯尔特十字牌阵展示了问题的全貌——从上到下的内在旅程，从左到右的时间流转。十张牌相互呼应，勾勒出完整的图景。')

        lines.append('')
        lines.append('✨ 牌意仅供参考，你才是自己命运的书写者。')

        return '\n'.join(lines)
