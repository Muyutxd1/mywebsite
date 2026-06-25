"""
紫微斗数排盘 — Zi Wei Dou Shu Chart Calculator
安命宫 → 定十二宫 → 安十四主星 → 安辅星 → 定四化
"""
from core.ganzhi import (
    TIAN_GAN, DI_ZHI, year_ganzhi_simple, month_zhi,
    day_ganzhi, hour_zhi, ganzhi_from_index, ganzhi_index
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


# ═══════════════════════════════════════════════════════
#  庙旺利陷表 — 十四主星在十二地支的亮度
#  ═══════════════════════════════════════════════════════
#  0=寅,1=卯,2=辰,3=巳,4=午,5=未,6=申,7=酉,8=戌,9=亥,10=子,11=丑
#  庙=最亮(+2)  旺=亮(+1)  利=平(0)  陷=暗(-1)
MIAO_WANG_TABLE = {
    '紫微': {4: '庙', 5: '庙', 6: '旺', 7: '旺', 0: '利', 1: '利', 8: '利', 9: '利', 10: '利', 11: '利', 2: '陷', 3: '陷'},
    '天机': {0: '利', 1: '利', 2: '庙', 3: '旺', 4: '庙', 5: '利', 6: '陷', 7: '陷', 8: '利', 9: '陷', 10: '利', 11: '陷'},
    '太阳': {0: '旺', 1: '庙', 2: '旺', 3: '庙', 4: '庙', 5: '利', 6: '利', 7: '陷', 8: '陷', 9: '陷', 10: '陷', 11: '陷'},
    '武曲': {0: '利', 1: '利', 2: '利', 3: '庙', 4: '旺', 5: '利', 6: '旺', 7: '庙', 8: '利', 9: '利', 10: '陷', 11: '陷'},
    '天同': {0: '利', 1: '庙', 2: '利', 3: '庙', 4: '陷', 5: '利', 6: '旺', 7: '利', 8: '利', 9: '利', 10: '利', 11: '利'},
    '廉贞': {0: '庙', 1: '利', 2: '利', 3: '利', 4: '旺', 5: '庙', 6: '利', 7: '利', 8: '陷', 9: '陷', 10: '陷', 11: '陷'},
    '天府': {0: '庙', 1: '利', 2: '旺', 3: '庙', 4: '旺', 5: '利', 6: '利', 7: '利', 8: '陷', 9: '利', 10: '利', 11: '利'},
    '太阴': {0: '陷', 1: '陷', 2: '陷', 3: '陷', 4: '陷', 5: '利', 6: '利', 7: '旺', 8: '庙', 9: '庙', 10: '利', 11: '利'},
    '贪狼': {0: '利', 1: '利', 2: '庙', 3: '利', 4: '庙', 5: '利', 6: '旺', 7: '旺', 8: '利', 9: '陷', 10: '陷', 11: '庙'},
    '巨门': {0: '旺', 1: '庙', 2: '利', 3: '利', 4: '庙', 5: '利', 6: '利', 7: '利', 8: '陷', 9: '利', 10: '利', 11: '利'},
    '天相': {0: '庙', 1: '利', 2: '利', 3: '庙', 4: '庙', 5: '利', 6: '利', 7: '陷', 8: '利', 9: '陷', 10: '利', 11: '庙'},
    '天梁': {0: '利', 1: '利', 2: '旺', 3: '庙', 4: '庙', 5: '利', 6: '利', 7: '利', 8: '陷', 9: '利', 10: '庙', 11: '陷'},
    '七杀': {0: '旺', 1: '庙', 2: '利', 3: '利', 4: '旺', 5: '庙', 6: '利', 7: '利', 8: '利', 9: '利', 10: '陷', 11: '利'},
    '破军': {0: '利', 1: '利', 2: '旺', 3: '利', 4: '庙', 5: '利', 6: '利', 7: '旺', 8: '利', 9: '庙', 10: '陷', 11: '利'},
}


class ZiweiCalculator:
    """紫微斗数排盘"""

    PALACE_NAMES = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫',
                    '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫',
                    '福德宫', '父母宫']

    MAJOR_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞',
                   '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']

    AUX_STARS = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺',
                 '禄存', '擎羊', '陀罗', '火星', '铃星', '天马']

    # 地支到宫位索引的对照
    ZHI_ORDER = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']

    def calculate(self, year, month, day, hour=0, minute=0, gender='male'):
        year = int(year)
        month = int(month)
        day = int(day)
        hour = int(hour)

        y_gan, y_zhi = year_ganzhi_simple(year)
        m_zhi = month_zhi(month, day)
        d_gan, d_zhi = day_ganzhi(year, month, day)
        h_zhi = hour_zhi(hour)

        zhi_order = self.ZHI_ORDER
        lunar_month = zhi_order.index(m_zhi) + 1
        hour_branch_idx = zhi_order.index(h_zhi)

        ming_idx = (lunar_month + hour_branch_idx) % 12
        shen_idx = (lunar_month + hour_branch_idx + 1) % 12

        palaces = self._layout_palaces(ming_idx, shen_idx)
        palace_stars = {p: [] for p in self.PALACE_NAMES}

        wuxing_ju = self._get_wuxing_ju(nayin_idx=ganzhi_index(y_gan, y_zhi) // 2)
        ziwei_pos = self._get_ziwei_position(wuxing_ju, day)

        if ziwei_pos is not None:
            palace_stars[palaces[ziwei_pos]].append('紫微')

        star_offsets = {
            '紫微': 0, '天机': -1, '太阳': -3, '武曲': -4,
            '天同': -5, '廉贞': -8,
        }
        for star, offset in star_offsets.items():
            if star == '紫微':
                continue
            pos = (ziwei_pos + offset) % 12
            palace_stars[palaces[pos]].append(star)

        tianfu_pos = (ziwei_pos + 6) % 12
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

        wenchang_pos = (hour_branch_idx + 9) % 12
        wenqu_pos = (hour_branch_idx + 2) % 12
        palace_stars[palaces[wenchang_pos]].append('文昌')
        palace_stars[palaces[wenqu_pos]].append('文曲')

        zuofu_pos = (lunar_month + 3) % 12
        youbi_pos = (lunar_month + 9) % 12
        palace_stars[palaces[zuofu_pos]].append('左辅')
        palace_stars[palaces[youbi_pos]].append('右弼')

        sihua = self._get_sihua(y_gan)

        # Build palace-zhi index: which 地支 does each palace sit on
        palace_zhi = {}
        for idx, pname in palaces.items():
            palace_zhi[pname] = zhi_order[idx]

        return {
            'birth_info': {
                'year_gan': y_gan, 'year_zhi': y_zhi,
                'month_zhi': m_zhi, 'day_gan': d_gan, 'day_zhi': d_zhi,
                'hour_zhi': h_zhi, 'lunar_month': lunar_month,
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
            'interpretation': self._interpret(
                palaces, palace_stars, ming_idx, shen_idx, sihua, palace_zhi
            ),
        }

    def _layout_palaces(self, ming_idx, shen_idx):
        palaces = {}
        for i in range(12):
            idx = (ming_idx + i) % 12
            palaces[idx] = self.PALACE_NAMES[i]
        return palaces

    def _get_wuxing_ju(self, nayin_idx):
        nayin_wuxing = ['水', '火', '木', '土', '金', '火',
                        '水', '土', '金', '木', '水', '土',
                        '火', '木', '水', '金', '火', '木',
                        '土', '金', '火', '水', '土', '金',
                        '木', '水', '水', '木', '水', '金']
        wx = nayin_wuxing[nayin_idx % 30]
        wuxing_numbers = {'水': 2, '木': 3, '金': 4, '土': 5, '火': 6}
        return wuxing_numbers.get(wx, 2)

    def _get_ziwei_position(self, ju, day):
        table = {
            2: [2, 3, 4, 5, 6, 7, 8, 9, 10,11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,11, 0, 1, 2, 3, 4, 5, 6, 7, 8],
            3: [3, 5, 7, 9, 11,1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3],
            4: [4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4],
            5: [5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5],
            6: [6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6],
        }
        positions = table.get(ju, table[2])
        d = min(max(day, 1), 30)
        return positions[d - 1] % 12

    def _get_sihua(self, year_gan):
        data = _load_json('stars.json')
        return data.get('sihua', {}).get('year_gan_map', {}).get(year_gan, {})

    # ═══════════════════════════════════════════════════════
    #  解读引擎
    # ═══════════════════════════════════════════════════════

    def _interpret(self, palaces, palace_stars, ming_idx, shen_idx, sihua, palace_zhi):
        data = _load_json('stars.json')
        major_info = data.get('major_stars', {})
        aux_info = data.get('auxiliary_stars', {})
        palace_desc = data.get('palaces', {}).get('descriptions', {})
        sihua_rules = data.get('sihua', {}).get('rules', {})

        lines = []
        ming_name = palaces[ming_idx]
        shen_name = palaces[shen_idx]
        ming_stars = palace_stars.get(ming_name, [])
        maj_ming = [s for s in ming_stars if s in major_info]
        aux_ming = [s for s in ming_stars if s in aux_info]
        ming_zhi = palace_zhi.get(ming_name, '')

        # ═══ 壹·命宫 ═══
        lines.append('─' * 36)
        lines.append('【壹 · 命宫详解】')
        lines.append(f'命宫坐「{ming_name}」（地支{ming_zhi}），乃整个命盘枢纽，')
        lines.append(f'代表核心性格、天赋禀性与人生大方向。')
        lines.append('')

        if maj_ming:
            lines.append(f'命宫主星：{"、".join(maj_ming)}')
        else:
            lines.append('命宫主星：无（借对宫迁移宫论命）')
        if aux_ming:
            lines.append(f'命宫辅星：{"、".join(aux_ming)}')
        lines.append('')

        # 主星详解
        if maj_ming:
            lines.append('【主星入命 · 逐一详析】')
            for star in maj_ming:
                info = major_info.get(star, {})
                desc = info.get('desc', '')
                wuxing = info.get('wuxing', '')
                nature = info.get('nature', '')
                star_type = info.get('type', '')
                # 庙旺
                brightness = self._star_brightness(star, ming_zhi)
                lines.append('')
                lines.append(f'▸ {star}（{wuxing}·{star_type}·{nature}星 | 亮度：{brightness}）')
                lines.append(f'  {desc}')
                self._write_star_traits(lines, star)
                lines.append(f'  亮度说明：{self._brightness_meaning(star, brightness)}')
        else:
            lines.append('【借对宫论命】')
            dui_idx = (ming_idx + 6) % 12
            dui_name = palaces[dui_idx]
            dui_stars = [s for s in palace_stars.get(dui_name, []) if s in major_info]
            if dui_stars:
                lines.append(f'对宫「{dui_name}」坐{"、".join(dui_stars)}，性格受迁移宫影响——')
                lines.append(f'在外活跃绽放，适合流动变化中发挥自我。')
            else:
                lines.append('对宫亦无主星，性格洒脱随性不拘一格，适合多元发展。')

        # 辅星
        if aux_ming:
            lines.append('')
            lines.append('【辅星加持 · 锦上添花】')
            for star in aux_ming:
                info = aux_info.get(star, {})
                desc = info.get('desc', '')
                lines.append(f'▸ {star}：{desc}')

        # 格局
        self._write_star_combos(lines, maj_ming, aux_ming)

        # ═══ 贰·身宫 ═══
        lines.append('')
        lines.append('─' * 36)
        lines.append('【贰 · 身宫分析】')
        shen_zhi = palace_zhi.get(shen_name, '')
        lines.append(f'身宫坐「{shen_name}」（{shen_zhi}）——身宫代表后半生重心所在，')
        shen_stars = palace_stars.get(shen_name, [])
        shen_maj = [s for s in shen_stars if s in major_info]
        desc = palace_desc.get(shen_name, '')
        lines.append(f'宫义：{desc}')
        if shen_maj:
            lines.append(f'身宫主星：{"、".join(shen_maj)}')
            for s in shen_maj:
                b = self._star_brightness(s, shen_zhi)
                lines.append(f'  · {s}（亮度：{b}）→ {self._star_in_palace(s, shen_name, major_info.get(s, {}))}')
        else:
            lines.append('身宫无主星——中年后的重心随大运流转。')
        if shen_name == ming_name:
            lines.append('命宫与身宫同宫——内外一致，人格统一，早年确立的方向贯穿终身。')
        else:
            lines.append(f'命身不同宫：早年重在{ming_name}，后半生重心转向{shen_name}所代表的领域。')

        # ═══ 叁·三方四正 ═══
        lines.append('')
        lines.append('─' * 36)
        lines.append('【叁 · 三方四正 · 人生格局】')
        lines.append('命宫三方（财帛、官禄）与对宫（迁移）构成「三方四正」，')
        lines.append('是判断富贵贫贱、事业成败的四根支柱。')
        lines.append('')

        triples = [
            ('财帛宫', (ming_idx + 4) % 12, '财富多寡与理财能力'),
            ('官禄宫', (ming_idx - 4) % 12, '事业发展与社会地位'),
            ('迁移宫', (ming_idx + 6) % 12, '外出发展与人生舞台'),
        ]
        for pname, pidx, pdesc in triples:
            pn_real = palaces[pidx]
            pzhi = palace_zhi.get(pn_real, '')
            pstars = [s for s in palace_stars.get(pn_real, []) if s in major_info]
            paux = [s for s in palace_stars.get(pn_real, []) if s in aux_info]
            lines.append(f'▎{pname}（{pn_real}·{pzhi}）——{pdesc}')
            if pstars:
                lines.append(f'  主星：{"、".join(pstars)}')
                for s in pstars:
                    b = self._star_brightness(s, pzhi)
                    info = major_info.get(s, {})
                    lines.append(f'    · {s}（{b}）：{self._star_in_palace(s, pname, info)}')
            else:
                lines.append('  无主星——此领域随大运流年触发')
            if paux:
                lines.append(f'  辅星：{"、".join(paux)}')
            lines.append('')

        # ═══ 肆·十二宫全览 ═══
        lines.append('─' * 36)
        lines.append('【肆 · 十二宫全览】')
        for pn in self.PALACE_NAMES:
            if pn == ming_name:
                continue
            stars = palace_stars.get(pn, [])
            maj = [s for s in stars if s in major_info]
            aux = [s for s in stars if s in aux_info]
            pzhi = palace_zhi.get(pn, '')
            pdesc = palace_desc.get(pn, '')
            lines.append('')
            lines.append(f'▎{pn}（{pzhi}）')
            lines.append(f'  含义：{pdesc}')
            if maj:
                lines.append(f'  主星：{"、".join(maj)}')
                for s in maj:
                    b = self._star_brightness(s, pzhi)
                    info = major_info.get(s, {})
                    lines.append(f'    · {s}（{b}）：{self._star_in_palace(s, pn, info)}')
            if aux:
                lines.append(f'  辅星：{"、".join(aux)}')
            if not maj:
                lines.append('  无主星——此领域较为平淡，待大运流年激活。')
            if '擎羊' in aux or '陀罗' in aux:
                lines.append('  ⚠ 擎陀在此宫，需多加注意此领域中的波折和阻碍。')
            if '火星' in aux or '铃星' in aux:
                lines.append('  ⚡ 火铃在此宫，此领域易有突发变故，需保持灵活应变。')

        # ═══ 伍·四化飞星 ═══
        if sihua:
            lines.append('')
            lines.append('─' * 36)
            lines.append('【伍 · 四化飞星详解】')
            lines.append('四化是紫微斗数最灵动之机制——天干引动星曜变化，')
            lines.append('化禄/化权/化科/化忌四象流转，揭示福祸消长轨迹。')
            lines.append('')

            hua_meta = {
                '禄': {'icon': '✨', 'title': '化禄 · 福德之门',
                       'meaning': sihua_rules.get('化禄', {}).get('meaning', '福气、财富'),
                       'desc': sihua_rules.get('化禄', {}).get('desc', ''),
                       'advice': '此处是你天生福报所在。顺势而为、不可强求，化禄之处常有意想不到的好运。宜在此领域大胆投入、享受过程。'},
                '权': {'icon': '👑', 'title': '化权 · 掌权之路',
                       'meaning': sihua_rules.get('化权', {}).get('meaning', '权力、掌控'),
                       'desc': sihua_rules.get('化权', {}).get('desc', ''),
                       'advice': '此处需主动争取、掌握主导。化权是激励成长的力量，宜迎难而上。在此领域适合担任领导者角色、争取话语权。'},
                '科': {'icon': '📚', 'title': '化科 · 名声之阶',
                       'meaning': sihua_rules.get('化科', {}).get('meaning', '名声、考试、贵人'),
                       'desc': sihua_rules.get('化科', {}).get('desc', ''),
                       'advice': '此处是你扬名立万的领域。化科之处宜学习、考试、展示才华。在此投入精力最易获得外界认可和贵人相助。'},
                '忌': {'icon': '⚠️', 'title': '化忌 · 修行之课',
                       'meaning': sihua_rules.get('化忌', {}).get('meaning', '困扰、阻碍'),
                       'desc': sihua_rules.get('化忌', {}).get('desc', ''),
                       'advice': '此处是今生需修的课题。化忌非厄运，而是提醒你在此多花心思、修身养性、转障碍为助力。此领域宜低调谨慎、以退为进。'},
            }

            for star, hua in sihua.items():
                hm = hua_meta.get(hua, {})
                lines.append(f'{hm.get("icon","")} {hm.get("title","")}')
                lines.append(f'  星曜：{star} 化{hua}')
                lines.append(f'  含义：{hm.get("meaning","")}。{hm.get("desc","")}')
                for pn, slist in palace_stars.items():
                    if star in slist:
                        pzhi = palace_zhi.get(pn, '')
                        pdesc = palace_desc.get(pn, '')
                        b = self._star_brightness(star, pzhi)
                        lines.append(f'  落宫：{pn}（{pzhi}）——{pdesc}')
                        lines.append(f'  星曜亮度：{b}')
                        break
                lines.append(f'  启示：{hm.get("advice","")}')
                lines.append('')

        # ═══ 陆·综合批语 ═══
        lines.append('─' * 36)
        lines.append('【陆 · 综合批语】')
        self._write_summary(lines, ming_name, maj_ming, aux_ming,
                           palace_stars, sihua, major_info, aux_info,
                           palace_desc, palaces, ming_idx, palace_zhi)

        lines.append('')
        lines.append('─' * 20)
        lines.append('（注：此排盘为简化版紫微斗数。完整命盘需结合大运/流年/小限/庙旺利陷/')
        lines.append(' 各星亮度/多种辅星综合判断。以上解读仅供娱乐参考，愿你洞察自我、活出精彩。）')

        return '\n'.join(lines)

    # ── 十四主星性格详析 ──────────────────────────────────
    def _write_star_traits(self, lines, star):
        d = {
            '紫微': ('北斗帝星，化气为尊。坐命者天生贵气，自尊心强不服输，有领导风范和大局观。'
                     '渴望尊重认可，做事稳重有魄力。但面子观念过重，需学会放下身段。'
                     '适合管理岗位或自主创业，天生不适合被人指挥。'),
            '天机': ('南斗善星，化气为善。头脑灵活、思维敏捷，善于运筹谋划，'
                     '是绝佳军师参谋型人才。学习力强、适应力佳，但心思多变易纠结。'
                     '适合策划咨询技术类工作，不宜做重复性劳动。'),
            '太阳': ('中天星主，化气为贵。热情开朗、光明磊落，天生有感染力，'
                     '喜欢帮助他人。庙旺光芒四射事业有成，落陷力不从心需注意身心平衡。'
                     '适合公众人物、教育、公益事业，不宜长期幕后工作。'),
            '武曲': ('北斗将星，化气为财。刚毅果断执行力强，'
                     '对金钱有天然敏感，擅长理财积累。但性格偏刚硬，需以柔克刚。'
                     '适合金融、工程、军警等刚毅型行业。'),
            '天同': ('南斗福星，化气为福。性情温和知足常乐，天生带福人缘好。'
                     '不喜争斗但容易安于现状，需有良师益友激励。'
                     '适合服务创意工作，不宜高压竞争环境。'),
            '廉贞': ('北斗次桃花星，化气为囚。个性鲜明爱憎分明，做事执着认真。'
                     '情绪波动大，需防感情纠葛和人际纷争。自制力是修行课题。'
                     '适合纪律部队或研究型工作，不宜与人情复杂打交道。'),
            '天府': ('南斗库星，化气为贤能。稳重宽厚包容力强，天生善管理和理财。'
                     '一生物质无忧但偏保守不喜冒险，需在稳定中求突破。'
                     '适合大型机构、稳定行业，不宜高风险创业。'),
            '太阴': ('中天星主，化气为富。情感细腻、直觉敏锐，注重家庭和内在感受。'
                     '有艺术天赋，庙旺则富足安康，落陷则多愁善感容易内耗。'
                     '适合艺术设计等行业，情绪管理是一生功课。'),
            '贪狼': ('北斗大桃花星，化气为桃花。多才多艺、社交手腕一流，人缘极佳。'
                     '对美好事物有强烈追求欲，但需克制欲望避免沉迷酒色。'
                     '才华用在正途则成大器，适合娱乐艺术社交型行业。'),
            '巨门': ('北斗暗星，化气为暗。口才出众、观察敏锐，善发现问题分析事理。'
                     '但易招惹口舌是非，需谨言慎行。口才是双刃剑——'
                     '用在正道所向披靡，用在是非伤人伤己。'),
            '天相': ('南斗印星，化气为印。公正无私善解人意，是天生的协调者。'
                     '做事稳重值得信赖，但有时缺乏主见需培养独立决策魄力。'
                     '适合行政管理协调型工作，是优秀二把手。'),
            '天梁': ('南斗寿星，化气为荫。慈悲为怀清高正直，有长者之风。'
                     '天生带长寿之相喜帮助弱小，但有时过于理想主义。'
                     '适合教育医疗公益行业，晚年福厚清闲自在。'),
            '七杀': ('南斗大杀将星，化气为将。威严刚毅敢作敢为，天生将才。'
                     '一生波澜起伏大起大落——成大事者必历大难，正是七杀的宿命与荣耀。'
                     '适合开拓性行业创业或军警，不宜安逸平淡的生活。'),
            '破军': ('北斗耗星，化气为耗。冲动激进不惧改变，具有破旧立新的勇气。'
                     '人生多变常有转折，但破军本质是"破而后立"——毁灭之后即是新生。'
                     '适合创新或自由职业，不宜一成不变的体制内工作。'),
        }
        if star in d:
            lines.append(f'')
            lines.append(f'  命格详析：{d[star]}')

    # ── 星曜格局 ──────────────────────────────────
    def _write_star_combos(self, lines, maj_ming, aux_ming):
        combos = []
        if '紫微' in maj_ming and '天府' in maj_ming:
            combos.append('「紫府同宫」帝王配库星——贵气与财气兼具，上等格局。衣食无忧社会地位高，但需防安逸失进取之心。一生需平衡尊贵与务实。')
        if '紫微' in maj_ming and '七杀' in maj_ming:
            combos.append('「紫杀」帝星遇将星——威权极重。多在大机构担当重任，但孤克较重内心易感孤独。需学会授权和信任他人。')
        if '紫微' in maj_ming and '破军' in maj_ming:
            combos.append('「紫破」帝星遇耗星——开创力极强。适合创业和改革，一生多次大转折，成败皆系于自己的决断力。敢破敢立方能成就大事。')
        if '紫微' in maj_ming and '天相' in maj_ming:
            combos.append('「紫相」帝星配印星——尊贵中有公正之心。适合从政、法律、大型机构管理。为人正直有威信。')
        if '紫微' in maj_ming and '贪狼' in maj_ming:
            combos.append('「紫贪」帝星遇桃花——贵人运强且善交际。魅力与权力并存，但需在享乐与责任间找平衡。')
        if '天府' in maj_ming and '天相' in maj_ming:
            combos.append('「府相」库星配印星——稳重公正兼备。最适合管理行政法律工作，是天然优秀辅佐人才。')
        if '武曲' in maj_ming and '天府' in maj_ming:
            combos.append('「武府」将星配库星——刚毅且善理财。求财能力强且守得住，适合金融实业。性格刚硬需注意人际和谐。')
        if '武曲' in maj_ming and '七杀' in maj_ming:
            combos.append('「武杀」双将星同宫——事业心极强，执行力无人能敌。但劳碌奔波，需注意劳逸结合。')
        if '武曲' in maj_ming and '破军' in maj_ming:
            combos.append('「武破」将星遇耗星——事业中大起大落的格局。敢闯敢拼但需防冲动破财。起伏中积累的经验是最宝贵的财富。')
        if '太阳' in maj_ming and '太阴' in maj_ming:
            combos.append('「日月同宫」阴阳调和——既有太阳的热情外放又有太阴的细腻内敛。处事圆融人际关系佳，是天生的外交家。')
        if '太阳' in maj_ming and '天梁' in maj_ming:
            combos.append('「阳梁」太阳配寿星——热心公益、乐于助人。最适合教育医疗慈善事业，光明磊落广受尊敬。')
        if '天同' in maj_ming and '太阴' in maj_ming:
            combos.append('「同阴」福星遇财星——福气绵长。天性乐观不争不抢却常得福报。一生安逸但需防懒散懈怠。')
        if '天同' in maj_ming and '天梁' in maj_ming:
            combos.append('「同梁」福星配寿星——一生清闲自在少灾少难。适合文化教育研究类工作，求名不求利。')
        if '廉贞' in maj_ming and '贪狼' in maj_ming:
            combos.append('「廉贪」两大桃花星同宫——魅力四射才华横溢但情感世界复杂。需在感情与理智间找平衡，宜将才情投入艺术创作。')
        if '廉贞' in maj_ming and '七杀' in maj_ming:
            combos.append('「廉杀」——刚烈果决执行力强，但情绪波动大易走极端。需修心养性以柔克刚，方能化险为夷。')
        if '廉贞' in maj_ming and '破军' in maj_ming:
            combos.append('「廉破」——人生起伏跌宕，常在危机中发现转机。适应力惊人，是"乱世出英雄"的格局。')
        if '巨门' in maj_ming and '天机' in maj_ming:
            combos.append('「巨机」暗星遇善星——思辨力极强，适合法律哲学研究。口才思维俱佳，但需防陷入无休止的争论。')
        if '巨门' in maj_ming and '太阳' in maj_ming:
            combos.append('「巨阳」——以光明化解暗星之弊。适合律师、记者等需犀利口才又需正直品格的工作。')
        if '天机' in maj_ming and '天梁' in maj_ming:
            combos.append('「机梁」善星配寿星——智慧与慈悲并重。最适合咨询、策划、医疗等既有智慧又需善心的工作。')
        if '天相' in maj_ming and '天梁' in maj_ming:
            combos.append('「相梁」印星配寿星——公正慈悲，天生的裁判者。适合法官、仲裁、人事等裁决性工作。')
        if '文昌' in aux_ming and '文曲' in aux_ming and '七杀' in maj_ming:
            combos.append('「文星拱杀」昌曲同在——刚毅中带文采，文武双全之相。虽为杀星却有谋略，智勇兼备。')
        if '文昌' in aux_ming and '文曲' in aux_ming:
            if not any('七杀' in c for c in combos):
                combos.append('「昌曲同宫」两大文星齐聚——才学出众。文笔口才俱佳，考试运强。在文化学术创意领域有天然优势。')
        if '左辅' in aux_ming and '右弼' in aux_ming:
            combos.append('「辅弼拱命」左辅右弼同守——贵人运极旺。一生左右逢源，得道多助，做事事半功倍。')
        if '天魁' in aux_ming or '天钺' in aux_ming:
            combos.append('「魁钺照命」天乙贵人照临——考试运旺，关键时刻常有贵人出现。逢凶化吉遇难成祥。')
        if '禄存' in aux_ming:
            combos.append('「禄存守命」财星入命——一生财运稳定，正财旺。衣食不愁但需防为财所困。')
        if '火星' in aux_ming or '铃星' in aux_ming:
            if '擎羊' in aux_ming or '陀罗' in aux_ming:
                combos.append('「火铃擎陀」煞星汇聚——一生波折较大但往往愈挫愈勇、大器晚成。需以柔克刚、广结善缘。')

        if combos:
            lines.append('')
            lines.append('【星曜格局 · 锦囊妙语】')
            for c in combos:
                lines.append(f'▸ {c}')

    # ── 星曜亮度 ──────────────────────────────────
    def _star_brightness(self, star, zhi):
        """Get star brightness (庙旺利陷) in a given 地支."""
        zidx = self.ZHI_ORDER.index(zhi) if zhi in self.ZHI_ORDER else 0
        table = MIAO_WANG_TABLE.get(star, {})
        return table.get(zidx, '利')

    def _brightness_meaning(self, star, level):
        """Interpret what star brightness means."""
        meanings = {
            '庙': '星曜力量最强，所有正面特质充分展现。天赋在此最大化，是此星曜最理想的状态。',
            '旺': '星曜力量强盛，正面特质明显。虽略逊于庙但仍是极佳状态，才华能充分发挥。',
            '利': '星曜力量中等，正负面特质兼有。吉凶参半，需结合其他星曜综合判断。',
            '陷': '星曜力量较弱，正面特质受限。需要更多努力才能发挥此星的好的一面，但也因此让人更加努力。',
        }
        return meanings.get(level, '')

    # ── 十二宫全览——星曜落宫解读 ──────────────────────────────────
    def _star_in_palace(self, star, palace, info):
        """What a star means in a specific palace."""
        wuxing = info.get('wuxing', '')
        nature = info.get('nature', '')
        # Complete table: 14 stars × 12 palaces = 168 entries
        table = {
            '命宫': {
                '紫微': '帝王坐命——天生领袖。自尊心强有大局观，适合独当一面。一生贵气但孤独感较重，需学会合作。',
                '天机': '智多星坐命——思维敏捷足智多谋。好奇心强学习力佳，但易想太多。一生靠智慧吃饭。',
                '太阳': '太阳坐命——热情开朗大方无私。庙旺则光芒万丈，落陷则身心俱疲需注意节奏。',
                '武曲': '将星坐命——刚毅果断执行力强。对金钱敏锐，理财高手。性格刚硬需以柔调和。',
                '天同': '福星坐命——性情温和与世无争。天生带福人缘好，但需防懒散。适合轻松节奏的生活。',
                '廉贞': '次桃花坐命——个性鲜明执着认真。爱憎分明有艺术家气质，需注意情绪管理。',
                '天府': '库星坐命——稳重宽厚从容不迫。善管理理财，一生丰衣足食。内心强大无需外求。',
                '太阴': '太阴坐命——温柔细腻直觉敏锐。富艺术气质，重家庭内心。庙旺富足，落陷多愁。',
                '贪狼': '大桃花坐命——魅力四射多才多艺。社交手腕一流，人脉即财富。需节制欲望。',
                '巨门': '暗星坐命——口才卓著思维深刻。善分析发掘真相，但需谨防口舌是非。',
                '天相': '印星坐命——公正体贴善解人意。天生的和事佬，但需培养主见和决断力。',
                '天梁': '寿星坐命——慈悲正直有长者风。乐善好施福泽深厚，晚年清闲自在。',
                '七杀': '杀将坐命——威严刚毅敢闯敢拼。大起大落波澜壮阔。成大事者必历大难。',
                '破军': '耗星坐命——创新求变不惧打破。人生多次重大转折，破旧立新是使命。',
            },
            '兄弟宫': {
                '紫微': '兄弟姐妹中有出类拔萃者，或视你为尊长。手足关系较为严肃但不失关爱。',
                '天机': '手足聪明灵活，关系融洽多交流。兄弟姐妹可能较多。',
                '太阳': '手足关系温暖融洽，有困难时兄弟会相助。若落陷则助力稍弱。',
                '武曲': '手足性格刚硬独立，各自发展各自的事业。关系务实但不亲密。',
                '天同': '手足关系和谐愉快，相处轻松自在。兄弟姐妹是你的福气来源之一。',
                '廉贞': '手足关系中可能有竞争或摩擦，需注意沟通方式。但内心深处仍关心彼此。',
                '天府': '手足稳重可靠，是你坚实的后盾。兄弟姐妹间的互助关系良好。',
                '太阴': '手足关系细腻温情，姐妹缘分可能优于兄弟。家庭聚会时最温馨。',
                '贪狼': '手足中有人缘好或才艺出众者，社交圈互有重叠。关系轻松但有时不够深入。',
                '巨门': '手足间口舌争执较多，沟通需格外用心。但也可能因此更加了解彼此。',
                '天相': '手足关系和谐公正，互帮互助不偏不倚。有事时是彼此最好的商量对象。',
                '天梁': '手足中可能有人充当家长角色，照顾其他兄弟姐妹。关系中有长幼有序的传统美。',
                '七杀': '手足各自独立发展，可能竞争激烈但在关键时刻互相扶持。',
                '破军': '手足关系可能经历大的变化或分离。聚少离多但各自精彩。',
            },
            '夫妻宫': {
                '紫微': '配偶有领导气质或社会地位较高。婚姻需互相尊重和平等，一方过于强势不利和谐。',
                '天机': '配偶聪明灵活，但感情可能因思虑过多而多变。需保持新鲜感和精神交流。',
                '太阳': '配偶热情大方。男方可能偏大男子主义，女方温暖照人。婚姻光明磊落。',
                '武曲': '配偶务实可靠，对家庭负责。但感情表达偏理性少浪漫，需用心经营温情。',
                '天同': '婚姻和谐甜蜜，如知己好友般轻松愉快。是享福型的感情配置。',
                '廉贞': '感情浓烈执着爱恨分明。情绪波动大需克制，否则容易产生激烈冲突。',
                '天府': '婚姻稳定踏实，配偶可靠包容。适合长久经营，婚后生活安逸富足。',
                '太阴': '配偶温柔体贴细腻。感情如涓涓细流，温暖而不炙热。需多给对方安全感。',
                '贪狼': '桃花旺盛，配偶魅力强但也需防第三者。感情丰富多彩，需在自由与承诺间平衡。',
                '巨门': '沟通是婚姻关键。口舌之争多但若善加沟通则关系深刻。学会倾听比会说更重要。',
                '天相': '配偶公正体贴善解人意，婚姻如细水长流温馨稳定。是相敬如宾的理想型。',
                '天梁': '配偶可能较年长但稳重可靠，如父如兄般的保护。婚姻中有传统的扶持之义。',
                '七杀': '感情路多波折但最终坚定。经历风雨的感情更加深厚。是轰轰烈烈爱一场的配置。',
                '破军': '感情多重大变化，可能晚婚或经历大的转折才稳定。但破而后立的感情更懂珍惜。',
            },
            '子女宫': {
                '紫微': '子女有出息、自尊心强。亲子关系中需尊重孩子的独立性，不宜过度管教。',
                '天机': '子女聪明灵活好奇心强。教育宜多启发少灌输，亲子关系活跃多交流。',
                '太阳': '子女热情开朗，亲子关系温暖。男孩可能较多或更加亲近。',
                '武曲': '子女性格独立刚强，从小有主见。教育宜注重理财观念的培养。',
                '天同': '子女温和乖巧好带，亲子关系融洽。孩子是你的福气，带来很多欢乐。',
                '廉贞': '亲子关系中可能有情绪波动，需耐心沟通。孩子的个性较强，教育需注意方式。',
                '天府': '子女稳重可靠，让人省心。亲子关系和谐，孩子是你的骄傲。',
                '太阴': '子女细腻敏感，需要更多的情感呵护。女儿缘分较好，亲子关系温柔。',
                '贪狼': '子女人缘好才艺多，但需注意引导其兴趣不走偏。亲子关系轻松有趣。',
                '巨门': '亲子沟通需多注意，孩子可能口才好但也爱顶嘴。宜以理服人而非以威压人。',
                '天相': '子女公正懂事有礼貌，教育起来比较省心。亲子关系和谐有序。',
                '天梁': '子女中有较为成熟懂事者，或得长辈缘。孩子是你晚年的依靠。',
                '七杀': '子女个性强烈有主见，教育需刚柔并济。孩子长大后可能成就大业。',
                '破军': '子女教育中可能有大的变化或挑战。但也意味着孩子不循常规、有独特发展。',
            },
            '财帛宫': {
                '紫微': '财运由地位带动，靠名声和资源赚钱。消费有品位，不吝啬但也铺张。',
                '武曲': '正财运极强，善存钱和投资，理财高手。最适合金融实业等稳健型求财。',
                '天府': '财运稳定丰厚，有库房之福。一生不愁钱，是先天财运最佳的配置之一。',
                '太阴': '财来自田宅或女性贵人。偏财运佳，适合房地产和长期投资。',
                '贪狼': '财运来自人脉和才艺，社交即财富。但花销也大需节制，会赚也会花。',
                '破军': '财运大起大落来快去快，需守财防漏。横财往往伴随风险。',
                '七杀': '求财辛苦需拼搏，但拼搏之后的回报也大。适合创业型而非工资型收入。',
                '天同': '财运平淡但知足常乐。不刻意求财但也不短缺，是轻松型的财运。',
                '天机': '财运靠脑力和灵活性，多变但总有来源。适合咨询策划技术等智慧型收入。',
                '太阳': '财运靠名气和影响力，慷慨大方不斤斤计较。钱来得光明花得坦荡。',
                '巨门': '财运靠口才和专业能力，但需防因口舌纠纷破财。适合咨询法律等专业型收入。',
                '天相': '收入稳定善于规划财务。适合工薪阶层和稳定型理财，精打细算型。',
                '天梁': '财运平淡但晚年无忧。适合公益教育和稳定型工作，求名不求利。',
                '廉贞': '财运波动较大，需防因感情或情绪因素破财。宜做长期稳健投资。',
            },
            '疾厄宫': {
                '紫微': '先天体质尚可但需注意富贵病。宜保持运动习惯，不宜久坐不动。',
                '天机': '需注意神经系统和睡眠质量。操心过多易引发身心疲惫，宜学会放松。',
                '太阳': '需注意心血管和眼睛。不宜过度劳累和熬夜，保持规律作息。',
                '武曲': '需注意呼吸系统和骨骼关节。运动前充分热身，不宜逞强硬撑。',
                '天同': '体质偏平和但需注意代谢问题。不宜过度安逸缺乏运动，保持适度活动。',
                '廉贞': '需注意血液和免疫系统。情绪与健康密切相关，保持心情愉快是最好的良药。',
                '天府': '体质较强，但需注意脾胃消化。饮食规律不宜暴饮暴食。',
                '太阴': '需注意妇科和情绪健康。情绪波动直接影响身体状况，养护身心并重。',
                '贪狼': '需注意肾脏和内分泌。欲望过多消耗精气神，节制是最好的养生。',
                '巨门': '需注意口腔和消化系统。少食辛辣刺激，注意口腔卫生。',
                '天相': '体质较为均衡，但需注意皮肤和过敏问题。饮食清淡为宜。',
                '天梁': '先天体质较好，有长寿之相。但需注意骨骼关节的老化问题。',
                '七杀': '体质偏刚需注意外伤和手术。运动和工作中的安全问题需格外留心。',
                '破军': '需注意肠胃和生殖系统。生活不规律最容易引发健康问题，需保持良好习惯。',
            },
            '迁移宫': {
                '紫微': '在外有贵人，适合到更大舞台。外出发展比在家乡更有前途。',
                '天机': '喜旅行变动，外出常有新机会和灵感。适合需要经常出差的工作。',
                '太阳': '在外受欢迎，适合海外发展。走到哪里都能交到朋友，是国际化的配置。',
                '武曲': '外出求财有利，适合异地工作。在外的拼搏能换来丰厚回报。',
                '天同': '外出轻松愉快，适合旅行型的工作。在外常有舒适有福的际遇。',
                '廉贞': '外出需注意人际关系，但也是拓展人脉的好机会。在外需多留心眼。',
                '天府': '在外财运好，适合异地置业。换个地方生活反而更加富足安逸。',
                '太阴': '外出的体验细腻丰富，适合文化艺术的交流与学习。旅途中常有美好邂逅。',
                '贪狼': '外出桃花旺交际场中如鱼得水。适合需要广泛社交的工作，在外人缘比家乡更好。',
                '巨门': '外出需注意口舌是非，但也是开阔眼界增长见识的机会。谨言慎行则可趋吉避凶。',
                '天相': '在外公正可靠的形象帮你赢得信任。适合异地工作或外派，在外有贵人赏识。',
                '天梁': '外在形象稳重可靠，长辈缘好。适合去传统文化深厚的地方发展。',
                '七杀': '外出需谨慎但动荡中亦有机遇。适合开拓型的外出，而非被动调动。',
                '破军': '漂洋过海之命，适合远行发展。人生中可能有多次重大搬迁或出国机会。',
            },
            '交友宫': {
                '紫微': '朋友中有地位较高者，社交圈层次不错。但有时朋友间存在距离感。',
                '天机': '朋友多且各种类型都有，善于结交。朋友圈更新快但深交不多。',
                '太阳': '朋友多且热心，社交圈温暖积极。朋友是你的重要资源和支持系统。',
                '武曲': '朋友圈务实偏商务，朋友多是工作关系发展而来。交朋友重质不重量。',
                '天同': '朋友圈轻松愉快，朋友间相处自在。朋友是你的快乐源泉之一。',
                '廉贞': '朋友圈中难免有复杂的人际关系。需辨别真朋友和酒肉朋友。',
                '天府': '朋友稳重可靠，社交圈稳定。朋友虽不多但个个真心，关键时刻会帮忙。',
                '太阴': '朋友中女性偏多或关系较为细腻温润。社交圈小而精致，重情重义。',
                '贪狼': '社交圈广泛朋友遍天下。社交是你最大的资源，但需防酒肉朋友。',
                '巨门': '朋友圈中可能有口舌之争。交朋友需多听少说，保持适当距离最安全。',
                '天相': '朋友圈和谐公正，朋友间相处融洽。你是朋友圈中的和事佬和润滑剂。',
                '天梁': '朋友中有年长者或充当导师角色的人。你也会成为朋友们的依靠。',
                '七杀': '朋友圈竞争激烈但也催人奋进。朋友中有能者，互相砥砺共同成长。',
                '破军': '朋友圈变动大，朋友来来去去。但留下的都是经过时间考验的真朋友。',
            },
            '官禄宫': {
                '紫微': '事业有帝王之姿。适合管理岗位或自主创业当老板，天生不适合打工。',
                '武曲': '适合金融、工程、军警等刚毅型行业。执行力强，是实干型的职场精英。',
                '天机': '适合策划咨询技术等脑力工作。靠智慧和创意吃饭，不宜重复性劳动。',
                '太阳': '适合公众人物、教育、公益事业。在台前发光发热，是天然的发言人。',
                '天府': '适合大型机构稳定行业。稳扎稳打步步高升，在体制内也能发展很好。',
                '七杀': '适合开拓性行业和创业。有魄力有决断，是开疆拓土的将才。',
                '破军': '事业多变，适合创新或自由职业。不适合一成不变的工作，需要变化和挑战。',
                '天同': '适合服务业和创意工作，不喜高压。事业不必太大，开心最重要。',
                '贪狼': '适合娱乐、艺术、社交型行业。人脉即事业，交际能力是核心竞争力。',
                '巨门': '适合法律、咨询、口才型行业。靠专业能力和犀利表达赢得尊重。',
                '天相': '适合行政管理协调型工作。是优秀的二把手和中层管理者，执行力强。',
                '天梁': '适合教育医疗公益行业。以助人为事业，求名望甚于求利。',
                '太阴': '适合艺术设计和女性相关行业。审美能力和细腻感知是核心竞争力。',
                '廉贞': '适合纪律部队和研究型工作。执着专注的性格在需要精细和纪律的行业很吃香。',
            },
            '田宅宫': {
                '紫微': '家宅环境大气，可能住在地段好或面积大的房子。家庭地位较高。',
                '天机': '住所可能多次变动，或住在交通便利处。喜欢灵活多变的居家环境。',
                '太阳': '家宅明亮温暖，向阳而居。家庭氛围积极向上，是充满阳光的家。',
                '武曲': '房产运不错，有购房置业的眼光。家宅较为实用坚固，注重实用性。',
                '天同': '家宅舒适安逸，住得舒服自在。喜欢温馨不折腾的家庭生活。',
                '廉贞': '家宅中可能需要处理一些复杂问题。家庭内部的情绪管理很重要。',
                '天府': '房产运好，家宅宽敞。可能在好地段拥有产业，家庭物质基础扎实。',
                '太阴': '家宅环境优美雅致。注重家居美感和情调，家是心灵的避风港。',
                '贪狼': '家宅可能较为豪华或有设计感。喜欢在家招待朋友，家是社交空间。',
                '巨门': '家宅附近可能有吵闹之处，或邻里关系需注意。家庭内部的沟通很重要。',
                '天相': '家宅整洁有序，环境和谐。喜欢有秩序有美感的家庭生活。',
                '天梁': '家宅有底蕴，可能是老宅或传统住宅。家庭有传承感和安定感。',
                '七杀': '家宅可能经历较大变动，或住在有历史的地方。家中需要有独立空间。',
                '破军': '搬家次数较多，或住在正在发展的新区。家宅环境变化大但有新意。',
            },
            '福德宫': {
                '紫微': '精神层面追求高雅。喜欢高品质的精神享受，内心世界丰富有追求。',
                '天同': '天生享福之命。内心世界丰富快乐，知足常乐是最高的境界。',
                '天府': '精神富足内心充实。享受高品质生活，懂得犒赏自己的人生。',
                '太阳': '乐善好施，从助人中得快乐。精神世界的阳光比物质更让你满足。',
                '贪狼': '爱好广泛享受人生但需节制。精神追求丰富多彩，但需防纵欲过度。',
                '太阴': '内心世界丰富细腻。独处时最能享受精神之乐，是精神享受型的人。',
                '天机': '喜欢动脑筋思考。精神乐趣在于学习和探索，好奇心永不枯竭。',
                '武曲': '精神追求较为务实。享受通过努力获得成就的过程，踏实即是快乐。',
                '巨门': '喜欢深度思考和探究。精神世界的乐趣在于发现真相和深层意义。',
                '天相': '内心追求和谐美好。精神享受在于平衡和秩序的优雅。',
                '天梁': '晚年福厚清闲自在。精神世界以助人和长寿为乐，是越老越有福的配置。',
                '七杀': '精神世界充满斗志和挑战欲。享受奋斗的过程，不安逸即是快乐。',
                '破军': '内心充满变革的力量。精神世界丰富多彩且不断更新，不喜一成不变。',
                '廉贞': '精神世界丰富多彩但情绪波动。需要找到让内心平静的方法，艺术是好的出口。',
            },
            '父母宫': {
                '紫微': '父母中有权威形象或社会地位。受父母影响深，家教较严但受益终身。',
                '天机': '父母聪明灵活，教育方式开明。亲子间沟通多，关系平等。',
                '太阳': '父亲形象突出或影响较大。父母给予温暖正向的教育，亲子关系融洽。',
                '武曲': '父母务实刚毅，从小培养独立性格。家庭教育注重实际能力的培养。',
                '天同': '父母温和慈爱，童年幸福。家庭教育宽松自由，是幸福的亲子关系。',
                '廉贞': '亲子关系中可能有摩擦或严格要求。父母用心良苦但方式可能需要磨合。',
                '天府': '父母稳重可靠，是你坚实的后盾。家庭教育正统，培养良好的品德和习惯。',
                '太阴': '母亲影响深远，或父母关系温润和谐。家庭教育注重情感和审美的培养。',
                '贪狼': '父母中有好交际或才艺出众者。家庭教育较为开放，注重多元化发展。',
                '巨门': '亲子沟通中可能有口舌之争，但也是深度交流的机会。宜多倾听父母的心声。',
                '天相': '父母公正开明，家庭教育有秩序。从小培养了你公正和谐的人生观。',
                '天梁': '父母中有较年长或成熟者。家庭教育传统有底蕴，培养了你的责任感和慈悲心。',
                '七杀': '父母要求严格，可能从小经历挑战。但严格的教育造就了坚强的性格。',
                '破军': '父母或家运可能经历较大变化。这些变化塑造了你适应变化的能力。',
            },
        }

        ps = table.get(palace, {})
        if star in ps:
            return ps[star]
        return f'{star}（{wuxing}{nature}星）在此领域发挥其{wuxing}能量特质。'

    # ── 三方四正辅助 ──────────────────────────────────
    def _add_palace_stars_meaning(self, lines, palace_name, stars, palace_info, major_info):
        desc = palace_info.get(palace_name, '')
        if desc:
            lines.append(f'  {desc}')
        for s in stars:
            info = major_info.get(s, {})
            lines.append(f'  → {s}在此：{self._star_in_palace(s, palace_name, info)}')

    # ── 综合批语 ──────────────────────────────────
    def _write_summary(self, lines, ming_name, maj_ming, aux_ming,
                       palace_stars, sihua, major_info, aux_info,
                       palace_desc, palaces, ming_idx, palace_zhi):
        lines.append('')
        lines.append('【性格总论】')
        if maj_ming:
            lines.append(f'命宫坐{ming_name}，主星{"、".join(maj_ming)}，形成了独特的性格底色。')
        else:
            lines.append(f'命宫坐{ming_name}，无主星，性格随环境而变、适应力强。')

        traits = []
        for s in maj_ming:
            m = {
                '紫微': '稳重有担当', '天府': '宽厚善管理', '七杀': '果敢坚毅',
                '武曲': '刚毅果断', '天机': '聪慧敏捷', '天同': '温和知足',
                '贪狼': '热情有魅力', '廉贞': '执着认真', '太阳': '正直热心',
                '天梁': '慈悲清高', '太阴': '细腻内敛', '天相': '周到公正',
                '巨门': '敏锐善辩', '破军': '勇敢创新',
            }
            if s in m:
                traits.append(m[s])
        if traits:
            lines.append(f'核心特质：{"、".join(traits)}。')

        all_stars = []
        for sl in palace_stars.values():
            all_stars.extend(sl)
        if '文昌' in all_stars or '文曲' in all_stars:
            lines.append('昌曲入命或三方，才学出众，在文化学术创意领域有天然优势。')
        if '左辅' in all_stars and '右弼' in all_stars:
            lines.append('左右辅弼俱全——贵人运极旺，一生得道多助。')

        # 事业财运
        lines.append('')
        lines.append('【事业财运】')
        caibo_name = palaces[(ming_idx + 4) % 12]
        guanlu_name = palaces[(ming_idx - 4) % 12]
        cb_s = [s for s in palace_stars.get(caibo_name, []) if s in major_info]
        gl_s = [s for s in palace_stars.get(guanlu_name, []) if s in major_info]
        cb_zhi = palace_zhi.get(caibo_name, '')
        gl_zhi = palace_zhi.get(guanlu_name, '')

        lines.append(f'财帛宫（{caibo_name}·{cb_zhi}）与官禄宫（{guanlu_name}·{gl_zhi}）是事业财脉。')
        if cb_s:
            lines.append(f'财帛宫有{"、".join(cb_s)}——理财能力与生俱来。')
            for s in cb_s:
                b = self._star_brightness(s, cb_zhi)
                lines.append(f'  · {s}（{b}）守财帛：{self._star_in_palace(s, "财帛宫", major_info.get(s, {}))}')
        else:
            lines.append('财帛宫无主星，财运靠后天努力和大运推动。')
        if gl_s:
            lines.append(f'官禄宫有{"、".join(gl_s)}——事业方向较为明确。')
            for s in gl_s:
                b = self._star_brightness(s, gl_zhi)
                lines.append(f'  · {s}（{b}）守官禄：{self._star_in_palace(s, "官禄宫", major_info.get(s, {}))}')
        else:
            lines.append('官禄宫无主星，事业不拘一格随机遇而变。')

        # 四化对财运的影响
        if sihua:
            for star, hua in sihua.items():
                for pn, slist in palace_stars.items():
                    if star in slist and pn in (caibo_name, guanlu_name):
                        if hua == '禄':
                            lines.append(f'{star}化禄在{pn}——此处大有可为，天生的福报领域！')
                        elif hua == '忌':
                            lines.append(f'{star}化忌在{pn}——此处需多花心思但未必是坏事，是修行的功课。')
                        elif hua == '权':
                            lines.append(f'{star}化权在{pn}——此处宜主动争取、掌握主导。')
                        elif hua == '科':
                            lines.append(f'{star}化科在{pn}——此处扬名立万，宜学习考证展示才华。')

        # 感情婚姻
        lines.append('')
        lines.append('【感情婚姻】')
        fuqi_name = palaces[(ming_idx + 2) % 12]
        fuqi_zhi = palace_zhi.get(fuqi_name, '')
        fq_s = [s for s in palace_stars.get(fuqi_name, []) if s in major_info]
        fq_aux = [s for s in palace_stars.get(fuqi_name, []) if s in aux_info]
        lines.append(f'夫妻宫坐「{fuqi_name}·{fuqi_zhi}」')

        love_types = {
            '贪狼': '桃花较重，感情丰富但也易招烂桃花，需学会分辨真心。',
            '廉贞': '感情浓烈执着，爱恨分明。需克制情绪化的一面。',
            '天府': '感情稳定踏实，适合长久经营，婚后生活安逸富足。',
            '天相': '配偶公正体贴，婚姻如细水长流般温馨。',
            '太阴': '感情细腻温柔，需要安全感。配偶会是温暖的港湾。',
            '七杀': '感情道路多有波折，需经历风雨才能见彩虹。',
            '破军': '感情多变，可能经历大的转折才最终稳定。但破而后立的感情更懂珍惜。',
            '紫微': '配偶有能力或社会地位，婚姻需平等相待相互尊重。',
            '武曲': '配偶务实可靠，但感情表达偏理性少浪漫。宜主动创造温情时刻。',
            '天同': '感情甜蜜，婚姻如知己般轻松愉快。是享福型的感情配置。',
            '天梁': '配偶可能较年长，但稳重可靠如父如兄。',
            '天机': '配偶聪明灵活，但感情易因思虑过多而生变。保持新鲜感很重要。',
            '太阳': '配偶热情开朗。注意给彼此留足个人空间，婚姻更加长久。',
            '巨门': '沟通是婚姻关键。口舌之争需用心化解，学会倾听比会说更重要。',
        }
        if fq_s:
            for s in fq_s:
                b = self._star_brightness(s, fuqi_zhi)
                lt = love_types.get(s, '')
                lines.append(f'  · {s}（{b}）：{lt}')
        else:
            lines.append('无主星——感情随缘而安，大运流年触发姻缘。')
        if '左辅' in fq_aux or '右弼' in fq_aux:
            lines.append('辅弼入夫妻宫——婚姻有贵人庇护、得道多助。')
        if '擎羊' in fq_aux or '陀罗' in fq_aux:
            lines.append('擎陀入夫妻宫——需注意沟通避免误会积累，小的摩擦及时化解。')

        # 健康
        lines.append('')
        lines.append('【健康提示】')
        jihe_name = palaces[(ming_idx + 5) % 12]
        jihe_zhi = palace_zhi.get(jihe_name, '')
        jh_s = palace_stars.get(jihe_name, [])
        jh_maj = [s for s in jh_s if s in major_info]
        wx_health = {
            '金': '注意呼吸系统、骨骼关节', '木': '注意肝胆、神经系统',
            '水': '注意肾脏、泌尿系统', '火': '注意心血管、眼睛',
            '土': '注意脾胃、消化系统',
        }
        tips = []
        if jh_maj:
            wx_set = set()
            for s in jh_maj:
                info = major_info.get(s, {})
                w = info.get('wuxing', '')
                if w and len(w) == 1:
                    wx_set.add(w)
                # 星曜专属健康建议
                star_health = {
                    '七杀': '注意外伤和手术安全', '破军': '注意肠胃和作息规律',
                    '贪狼': '注意肾脏和节制欲望', '巨门': '注意口腔和消化',
                    '天机': '注意神经和睡眠', '太阳': '注意心血管和用眼',
                    '太阴': '注意妇科和情绪健康', '廉贞': '注意血液和免疫',
                }
                if s in star_health:
                    tips.append(star_health[s])
            for w in wx_set:
                if w in wx_health:
                    tips.append(wx_health[w])
        if '火星' in jh_s or '铃星' in jh_s:
            tips.append('火铃入疾厄——防急症炎症')
        if '擎羊' in jh_s:
            tips.append('擎羊在此——防外伤')
        if tips:
            for t in tips:
                lines.append(f'· {t}')
        else:
            lines.append('· 疾厄宫先天尚可，注意后天保养即可。')

        # 人生锦囊
        lines.append('')
        lines.append('【人生锦囊】')
        advices = {
            '紫微': '领袖气质是你最大的资本，但真正的领袖是那些懂得倾听的人。',
            '天府': '稳重是你的核心竞争力，但偶尔跨出舒适区会看到更大的丰收。',
            '七杀': '波澜起伏是你的命运曲线，不是敌人——拥抱变化、随势而动。',
            '破军': '破旧立新是你的使命。不惧改变，重建总比固守更精彩。',
            '武曲': '刚毅是你的力量，柔和是你的修行。刚柔并济方能无坚不摧。',
            '天机': '头脑是你的最佳武器，但别让过度思考消耗了你。行动胜过千思万虑。',
            '太阳': '像太阳一样照耀他人，但也给自己留一片阴凉。照亮世界需要先照顾好自己。',
            '太阴': '细腻是你的天赋，但别让它变成内耗。学会与自己的情绪和解。',
            '贪狼': '才华横溢是福也是考验。欲望用在正途光芒万丈，用在不归路自毁前程。',
            '巨门': '口才是双刃剑——用来揭示真相你是英雄，用来伤人你是反派。选择权在你。',
            '天同': '知足常乐是最高境界，但偶尔也需要一点野心去激发潜能。',
            '廉贞': '执着让你优秀，放下让你自由。两者都需要的智慧才是真正的成长。',
            '天相': '善解人意是你最大的优点，但也别忘了为自己发声。温柔不是软弱。',
            '天梁': '慈悲济世是你的天性。但先照顾好自己的健康和幸福，才有余力温暖他人。',
        }
        for s in maj_ming:
            if s in advices:
                lines.append(f'· {advices[s]}')
        if not maj_ming:
            lines.append('· 命无主星，不被定义就是你的天赋——活出独一无二的路。')
