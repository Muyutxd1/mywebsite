"""
紫微斗数排盘 — Zi Wei Dou Shu Chart Calculator
安命宫 → 定十二宫 → 安十四主星 → 安辅星 → 定四化
"""
from core.ganzhi import (
    TIAN_GAN, DI_ZHI, year_ganzhi_simple, month_zhi, month_gan,
    day_ganzhi, hour_zhi, ganzhi_from_index, ganzhi_index, nayin,
)
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def _load_json(name):
    path = os.path.join(DATA_DIR, name)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


class ZiweiCalculator:
    """紫微斗数排盘"""

    PALACE_NAMES = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫',
                    '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫',
                    '福德宫', '父母宫']

    MAJOR_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞',
                   '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']

    AUX_STARS = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺',
                 '禄存', '擎羊', '陀罗', '火星', '铃星', '天马']

    # 纳音五行 → 局数
    WUXING_JU_MAP = {'金': 4, '木': 3, '水': 2, '火': 6, '土': 5}

    def calculate(self, year, month, day, hour=0, minute=0, gender='male'):
        year = int(year)
        month = int(month)
        day = int(day)
        hour = int(hour)

        # Get Gan-Zhi pillars
        y_gan, y_zhi = year_ganzhi_simple(year)
        m_zhi = month_zhi(month, day)
        d_gan, d_zhi = day_ganzhi(year, month, day)
        h_zhi = hour_zhi(hour)

        # Ziwei uses 寅-based indexing: 寅=0, 卯=1, ..., 丑=11
        zhi_order = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
        lunar_month = zhi_order.index(m_zhi) + 1  # 1=寅月, 2=卯月, ...
        hour_branch_idx = zhi_order.index(h_zhi)  # 0=寅, 1=卯, ...

        # ── Step 1: 安命宫 & 身宫 ──
        # 命宫: 从寅宫起正月，顺数至生月，再顺数至生时
        ming_idx = (lunar_month + hour_branch_idx) % 12  # 0-based from 寅
        ming_zhi = zhi_order[ming_idx]

        # 命宫天干: 用五虎遁（同年干起月干）
        ming_gan = month_gan(y_gan, ming_zhi)

        # 身宫
        shen_idx = (lunar_month + hour_branch_idx + 1) % 12
        shen_zhi = zhi_order[shen_idx]

        # ── Step 2: 定十二宫 ──
        palaces = self._layout_palaces(ming_idx, shen_idx)

        # ── Step 3: 安十四主星 ──
        palace_stars = {p: [] for p in self.PALACE_NAMES}

        # 五行局 from 命宫干支纳音 (NOT year pillar!)
        ming_nayin = nayin(ming_gan, ming_zhi)
        wuxing_ju = self._get_wuxing_ju_from_nayin(ming_nayin)
        ziwei_pos = self._get_ziwei_position(wuxing_ju, day)

        if ziwei_pos is not None:
            palace_stars[palaces[ziwei_pos]].append('紫微')

        # Other major stars follow Ziwei in fixed relative positions
        star_offsets = {
            '紫微': 0, '天机': -1, '太阳': -3, '武曲': -4,
            '天同': -5, '廉贞': -8,
        }
        for star, offset in star_offsets.items():
            if star == '紫微':
                continue
            pos = (ziwei_pos + offset) % 12
            palace_stars[palaces[pos]].append(star)

        # Tian Fu aligns opposite to Ziwei
        tianfu_pos = (ziwei_pos + 6) % 12  # Opposite
        palace_stars[palaces[tianfu_pos]].append('天府')

        tianfu_stars = {
            '天府': 0, '太阴': 1, '贪狼': 2, '巨门': 3,
            '天相': 4, '天梁': 5, '七杀': 6, '破军': 10,
        }
        for star, offset in tianfu_stars.items():
            if star == '天府':
                continue
            pos = (tianfu_pos + offset) % 12
            palace_stars[palaces[pos]].append(star)

        # ── Step 4: 安辅星 ──
        # 文昌/文曲 based on hour
        wenchang_pos = (hour_branch_idx + 9) % 12
        wenqu_pos = (hour_branch_idx + 2) % 12
        palace_stars[palaces[wenchang_pos]].append('文昌')
        palace_stars[palaces[wenqu_pos]].append('文曲')

        # 左辅/右弼 based on month
        zuofu_pos = (lunar_month + 3) % 12
        youbi_pos = (lunar_month + 9) % 12
        palace_stars[palaces[zuofu_pos]].append('左辅')
        palace_stars[palaces[youbi_pos]].append('右弼')

        # ── Step 5: 四化 ──
        sihua = self._get_sihua(y_gan)

        return {
            'birth_info': {
                'year_gan': y_gan, 'year_zhi': y_zhi,
                'month_zhi': m_zhi, 'day_gan': d_gan, 'day_zhi': d_zhi,
                'hour_zhi': h_zhi, 'lunar_month': lunar_month,
                'ming_gan': ming_gan, 'ming_zhi': ming_zhi,
                'ming_nayin': ming_nayin, 'wuxing_ju': wuxing_ju,
            },
            'palaces': [
                {
                    'name': p,
                    'is_ming': p == palaces[ming_idx],
                    'is_shen': p == palaces[shen_idx],
                    'stars': palace_stars.get(p, []),
                }
                for p in self.PALACE_NAMES
            ],
            'ming_palace': palaces[ming_idx],
            'shen_palace': palaces[shen_idx],
            'sihua': sihua,
            'interpretation': self._interpret(palaces, palace_stars, ming_idx, sihua),
        }

    def _layout_palaces(self, ming_idx, shen_idx):
        """Layout 12 palaces starting from Ming position."""
        palaces = {}
        for i in range(12):
            idx = (ming_idx + i) % 12
            palaces[idx] = self.PALACE_NAMES[i]
        return palaces

    def _get_wuxing_ju_from_nayin(self, nayin_name):
        """
        Get 五行局 number from 纳音 name.
        纳音最后一个字即是五行: 金→4局, 木→3局, 水→2局, 火→6局, 土→5局
        """
        # Extract the wuxing element (last character of nayin)
        # e.g. '海中金' → '金', '杨柳木' → '木'
        wx = nayin_name[-1] if nayin_name else '水'
        return self.WUXING_JU_MAP.get(wx, 2)

    def _get_ziwei_position(self, ju, day):
        """Calculate Ziwei star position based on 五行局 and day of month."""
        # Ziwei position table: maps (五行局, day) → branch index (0-based from 寅)
        table = {
            2: [2, 3, 4, 5, 6, 7, 8, 9, 10,11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,11, 0, 1, 2, 3, 4, 5, 6, 7, 8],
            3: [3, 5, 7, 9, 11,1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3],
            4: [4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4],
            5: [5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5],
            6: [6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6],
        }
        positions = table.get(ju, table[2])
        d = min(max(day, 1), 30) - 1  # 0-based index
        ziwei_idx = positions[d]
        return ziwei_idx % 12

    def _get_sihua(self, year_gan):
        """Get 四化 for the year stem."""
        data = _load_json('stars.json')
        sihua_data = data.get('sihua', {}).get('year_gan_map', {}).get(year_gan, {})
        return sihua_data

    def _interpret(self, palaces, palace_stars, ming_idx, sihua):
        """Generate interpretation."""
        lines = []
        ming_palace_name = palaces[ming_idx]
        ming_stars = palace_stars.get(ming_palace_name, [])

        lines.append(f'【命宫】{ming_palace_name}')
        if ming_stars:
            lines.append(f'主星：{"、".join(ming_stars)}')
        else:
            lines.append('命宫无主星，借对宫迁移宫之星曜来看。')

        if '紫微' in ming_stars:
            lines.append('紫微坐命，帝王之姿，气质高贵，自尊心强，具领导才能。')
        if '天府' in ming_stars:
            lines.append('天府坐命，稳重包容，擅长理财，一生衣食无忧。')
        if '七杀' in ming_stars:
            lines.append('七杀坐命，将星之威，敢作敢为，一生多波澜起伏。')

        # Sihua analysis
        if sihua:
            lines.append('')
            lines.append('【四化飞星】')
            for star, hua in sihua.items():
                hua_desc = {
                    '禄': '化禄 — 福气、财富、好事发生 ✨',
                    '权': '化权 — 权力、掌控、上升趋势 📈',
                    '科': '化科 — 名声、科甲、贵人相助 📚',
                    '忌': '化忌 — 困扰、阻碍、需警惕 ⚠️',
                }
                lines.append(f'{star}{hua_desc.get(hua, hua)}')

        # All palaces
        lines.append('')
        lines.append('【十二宫分布】')
        for palace_name in self.PALACE_NAMES:
            stars = palace_stars.get(palace_name, [])
            marker = '📍' if palace_name == ming_palace_name else ''
            if stars:
                lines.append(f'{marker}{palace_name}：{"、".join(stars)}')
            else:
                lines.append(f'{marker}{palace_name}：——')

        lines.append('')
        lines.append('（注：此排盘为简化版紫微斗数，完整准确排盘需专业软件。仅供娱乐参考。）')

        return '\n'.join(lines)
