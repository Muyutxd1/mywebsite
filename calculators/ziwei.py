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


class ZiweiCalculator:
    """紫微斗数排盘"""

    PALACE_NAMES = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫',
                    '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫',
                    '福德宫', '父母宫']

    MAJOR_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞',
                   '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']

    AUX_STARS = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺',
                 '禄存', '擎羊', '陀罗', '火星', '铃星', '天马']

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

        # Lunar month number for Ziwei (use solar term-based month branch index)
        zhi_order = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
        lunar_month = zhi_order.index(m_zhi) + 1  # 1=寅月, 2=卯月, ...

        # Hour branch index
        hour_branch_idx = zhi_order.index(h_zhi)  # 0=寅, 1=卯, ...

        # ── Step 1: 安命宫 & 身宫 ──
        # 命宫 = (lunar_month, hour_branch) → offset
        ming_offset = (lunar_month - 1 + hour_branch_idx) % 12
        # Actually, the formula is more complex:
        # 命宫地支 = (寅月起数 + 时支) → count from 寅
        # Simplified: ming_zhi_index = (lunar_month + hour_branch) mod 12

        # Traditional formula:
        # Count from 寅: month + hour → offset
        ming_idx = (lunar_month + hour_branch_idx) % 12  # 0-based from 寅

        # 身宫 = (lunar_month + hour) mod 12 but counted differently
        shen_idx = (lunar_month + hour_branch_idx + 1) % 12

        # ── Step 2: 定十二宫 ──
        # Ming palace determines the order of all 12 palaces
        palaces = self._layout_palaces(ming_idx, shen_idx)

        # ── Step 3: 安十四主星 ──
        palace_stars = {p: [] for p in self.PALACE_NAMES}

        # Determine Ziwei star position based on 五行局 (from nayin)
        # Ziwei position = f(五行局, 农历日)
        wuxing_ju = self._get_wuxing_ju(nayin_idx=ganzhi_index(y_gan, y_zhi) // 2)
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
                palaces, palace_stars, ming_idx, shen_idx, sihua, lunar_month, hour_branch_idx
            ),
        }

    def _layout_palaces(self, ming_idx, shen_idx):
        """Layout 12 palaces starting from Ming position."""
        palaces = {}
        for i in range(12):
            idx = (ming_idx + i) % 12
            palaces[idx] = self.PALACE_NAMES[i]
        return palaces

    def _get_wuxing_ju(self, nayin_idx):
        """Get 五行局 (Water 2, Wood 3, Metal 4, Earth 5, Fire 6)."""
        # Simplified: based on nayin
        nayin_wuxing = ['水', '火', '木', '土', '金', '火',
                        '水', '土', '金', '木', '水', '土',
                        '火', '木', '水', '金', '火', '木',
                        '土', '金', '火', '水', '土', '金',
                        '木', '水', '水', '木', '水', '金']
        wx = nayin_wuxing[nayin_idx % 30]
        wuxing_numbers = {'水': 2, '木': 3, '金': 4, '土': 5, '火': 6}
        return wuxing_numbers.get(wx, 2)

    def _get_ziwei_position(self, ju, day):
        """Calculate Ziwei star position based on 五行局 and day of month."""
        # Ziwei position table (simplified)
        table = {
            2: [2, 3, 4, 5, 6, 7, 8, 9, 10,11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,11, 0, 1, 2, 3, 4, 5, 6, 7, 8],
            3: [3, 5, 7, 9, 11,1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3, 5, 7, 9, 11, 1, 3],
            4: [4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4, 8, 0, 4],
            5: [5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5],
            6: [6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6, 2, 8, 4, 0, 6],
        }
        positions = table.get(ju, table[2])
        d = min(max(day, 1), 30)
        ziwei_idx = positions[d - 1]  # value from table
        return ziwei_idx % 12  # 0-based

    def _get_sihua(self, year_gan):
        """Get 四化 for the year stem."""
        data = _load_json('stars.json')
        sihua_data = data.get('sihua', {}).get('year_gan_map', {}).get(year_gan, {})
        return sihua_data

    # ═══════════════════════════════════════════════════════════════════
    #  解读引擎 — 详细、详细、再详细
    # ═══════════════════════════════════════════════════════════════════

    def _interpret(self, palaces, palace_stars, ming_idx, shen_idx, sihua,
                   lunar_month, hour_branch_idx):
        """Generate comprehensive Zi Wei Dou Shu interpretation."""
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

        # ═══ 壹 · 命宫详解 ═══
        lines.append('─' * 32)
        lines.append('【壹 · 命宫详解】')
        lines.append(f'命宫坐「{ming_name}」，此乃整个命盘的枢纽，')
        lines.append(f'代表你的核心性格、天赋禀性与人生大方向。')
        lines.append('')

        if maj_ming:
            lines.append(f'命宫主星：{"、".join(maj_ming)}')
        else:
            lines.append('命宫主星：无（借对宫迁移宫之星曜来看）')
        if aux_ming:
            lines.append(f'命宫辅星：{"、".join(aux_ming)}')
        lines.append('')

        # 主星入命详细解读
        if maj_ming:
            lines.append('【主星入命 · 逐一详析】')
            for star in maj_ming:
                info = major_info.get(star, {})
                desc = info.get('desc', '')
                wuxing = info.get('wuxing', '')
                nature = info.get('nature', '')
                star_type = info.get('type', '')
                lines.append('')
                lines.append(f'▸ {star}（五行：{wuxing} | 类型：{star_type} | {nature}星）')
                lines.append(f'  {desc}')
                self._write_star_traits(lines, star)
        else:
            lines.append('【借对宫论命】')
            lines.append('命宫无主星之人，性格随环境变化较大，适应力强，')
            lines.append('但自我定位有时模糊。需参照对宫（迁移宫）之星曜——')
            dui_idx = (ming_idx + 6) % 12
            dui_name = palaces[dui_idx]
            dui_stars = [s for s in palace_stars.get(dui_name, []) if s in major_info]
            if dui_stars:
                lines.append(f'对宫「{dui_name}」坐{"、".join(dui_stars)}，')
                lines.append(f'意味着你的性格底色受迁移宫影响更深——')
                lines.append(f'在外表现活跃、适合在流动变化的环境中绽放自我。')
            else:
                lines.append('对宫亦无主星——性格洒脱随性、不拘一格，')
                lines.append('适合发展多元兴趣、走非传统路线。')

        # 辅星加持
        if aux_ming:
            lines.append('')
            lines.append('【辅星加持 · 锦上添花】')
            for star in aux_ming:
                info = aux_info.get(star, {})
                desc = info.get('desc', '')
                lines.append(f'▸ {star}：{desc}')

        # 星曜格局
        self._write_star_combos(lines, maj_ming, aux_ming)

        # ═══ 贰 · 身宫 ═══
        lines.append('')
        lines.append('─' * 32)
        lines.append('【贰 · 身宫分析】')
        lines.append(f'身宫坐「{shen_name}」——身宫代表后半生的重心所在，')
        lines.append('也是你灵魂深处最关切的领域。')
        shen_stars = palace_stars.get(shen_name, [])
        shen_maj = [s for s in shen_stars if s in major_info]
        desc = palace_desc.get(shen_name, '')
        lines.append(f'宫义：{desc}')
        if shen_maj:
            lines.append(f'身宫主星：{"、".join(shen_maj)}')
        if shen_name == ming_name:
            lines.append('命宫与身宫同宫——一生内外一致，人格统一，')
            lines.append('早年确立的方向会贯穿终身。')
        else:
            lines.append(f'命宫在{ming_name}而身宫在{shen_name}——')
            lines.append(f'早年性格与后半生的关注重点有所不同，')
            lines.append(f'随着阅历增长，你会越来越关注{shen_name}所代表的领域。')

        # ═══ 叁 · 三方四正 ═══
        lines.append('')
        lines.append('─' * 32)
        lines.append('【叁 · 三方四正】')
        lines.append('命宫的三方（财帛、官禄）与对宫（迁移）构成「三方四正」，')
        lines.append('是判断人生格局最重要的四个宫位。')
        lines.append('')

        triples = [
            ('财帛宫', (ming_idx + 4) % 12, '财富来源与理财能力'),
            ('官禄宫', (ming_idx - 4) % 12, '事业发展与社会地位'),
            ('迁移宫', (ming_idx + 6) % 12, '外出发展与人生舞台'),
        ]
        for pname, pidx, pdesc in triples:
            pname_real = palaces[pidx]
            pstars = [s for s in palace_stars.get(pname_real, []) if s in major_info]
            paux = [s for s in palace_stars.get(pname_real, []) if s in aux_info]
            lines.append(f'▎{pname}（{pname_real}）— {pdesc}')
            if pstars:
                lines.append(f'  主星：{"、".join(pstars)}')
                for s in pstars:
                    lines.append(f'    · {self._star_in_palace(s, pname, major_info)}')
            else:
                lines.append(f'  无主星——此领域随大运触发')
            if paux:
                lines.append(f'  辅星：{"、".join(paux)}')
            lines.append('')

        # ═══ 肆 · 十二宫全览 ═══
        lines.append('─' * 32)
        lines.append('【肆 · 十二宫全览】')
        for pn in self.PALACE_NAMES:
            if pn == ming_name:
                continue
            stars = palace_stars.get(pn, [])
            maj = [s for s in stars if s in major_info]
            aux = [s for s in stars if s in aux_info]
            pdesc = palace_desc.get(pn, '')
            lines.append('')
            lines.append(f'▎{pn}')
            lines.append(f'  含义：{pdesc}')
            if maj:
                lines.append(f'  主星：{"、".join(maj)}')
                for s in maj:
                    info = major_info.get(s, {})
                    lines.append(f'    · {s}：{self._star_in_palace(s, pn, info)}')
            if aux:
                lines.append(f'  辅星：{"、".join(aux)}')
            if not maj:
                lines.append(f'  无主星——此领域较为平淡，待大运流年激活。')

        # ═══ 伍 · 四化飞星 ═══
        if sihua:
            lines.append('')
            lines.append('─' * 32)
            lines.append('【伍 · 四化飞星详解】')
            lines.append('四化是斗数中最灵动的机制——天干引动星曜变化，')
            lines.append('化禄/化权/化科/化忌四象流转，揭示人生福祸消长的轨迹。')
            lines.append('')

            hua_meta = {
                '禄': {'icon': '✨', 'title': '化禄 · 福德之门',
                       'meaning': sihua_rules.get('化禄', {}).get('meaning', '福气、财富、好事发生'),
                       'desc': sihua_rules.get('化禄', {}).get('desc', ''),
                       'advice': '此处是你天生的福报所在。顺势而为、不可强求，'
                                '化禄之处常有意想不到的好运。'},
                '权': {'icon': '👑', 'title': '化权 · 掌权之路',
                       'meaning': sihua_rules.get('化权', {}).get('meaning', '权力、掌控、上升'),
                       'desc': sihua_rules.get('化权', {}).get('desc', ''),
                       'advice': '此处需你主动争取、掌握主导。化权是激励成长的'
                                '力量，宜迎难而上。'},
                '科': {'icon': '📚', 'title': '化科 · 名声之阶',
                       'meaning': sihua_rules.get('化科', {}).get('meaning', '名声、考试、贵人'),
                       'desc': sihua_rules.get('化科', {}).get('desc', ''),
                       'advice': '此处是你扬名立万的领域。化科之处宜学习、考试、'
                                '展示才华，贵人自会相助。'},
                '忌': {'icon': '⚠️', 'title': '化忌 · 修行之课',
                       'meaning': sihua_rules.get('化忌', {}).get('meaning', '困扰、阻碍、需警惕'),
                       'desc': sihua_rules.get('化忌', {}).get('desc', ''),
                       'advice': '此处是今生需要修行的功课。化忌不是厄运，而是提醒'
                                '你在此处多花心思、修身养性、转障碍为助力。'},
            }

            for star, hua in sihua.items():
                hm = hua_meta.get(hua, {})
                lines.append(f'{hm.get("icon","")} {hm.get("title","")}')
                lines.append(f'  星曜：{star} 化{hua}')
                lines.append(f'  含义：{hm.get("meaning","")} {hm.get("desc","")}')
                # Find the palace this star sits in
                for pn, slist in palace_stars.items():
                    if star in slist:
                        pdesc = palace_desc.get(pn, '')
                        lines.append(f'  落宫：{pn}（{pdesc}）')
                        break
                lines.append(f'  启示：{hm.get("advice","")}')
                lines.append('')

        # ═══ 陆 · 综合批语 ═══
        lines.append('─' * 32)
        lines.append('【陆 · 综合批语】')
        self._write_summary(lines, ming_name, maj_ming, aux_ming,
                           palace_stars, sihua, major_info, aux_info,
                           palace_desc, palaces, ming_idx)

        lines.append('')
        lines.append('─' * 20)
        lines.append('（注：此排盘为简化版紫微斗数，完整命盘需结合大运流年、')
        lines.append('       小限、庙旺利陷、各星亮度及诸多辅星综合判断。')
        lines.append('       以上解读仅供娱乐参考，愿你洞察自我、活出精彩。）')

        return '\n'.join(lines)

    # ── 辅助解读方法 ───────────────────────────────────

    def _write_star_traits(self, lines, star):
        """Detailed personality traits for each major star."""
        d = {
            '紫微': ('北斗帝星，化气为尊。坐命者天生贵气，自尊心强、不服输，'
                     '有领导风范和大局观。渴望被尊重和认可，做事稳重有魄力。'
                     '但有时面子观念过重，需学会放下身段、与人为善。'),
            '天机': ('南斗善星，化气为善。坐命者头脑灵活、思维敏捷，'
                     '善于谋划运筹，是绝佳的军师参谋型人才。学习力强、'
                     '适应力佳，但心思多变易纠结，需培养专注和耐心。'),
            '太阳': ('中天星主，化气为贵。坐命者热情开朗、光明磊落，'
                     '天生有感染力，喜欢帮助他人。庙旺则光芒四射、事业有成；'
                     '落陷则易力不从心，需注意身心平衡。'),
            '武曲': ('北斗将星，化气为财。坐命者刚毅果断、执行力强，'
                     '对金钱有天然敏感，擅长理财积累。但性格偏刚硬，'
                     '需以柔克刚、注意人际圆融。适合金融、工程等行业。'),
            '天同': ('南斗福星，化气为福。坐命者性情温和、知足常乐，'
                     '天生带福、人缘好、不喜争斗。但容易安于现状、'
                     '缺乏进取，需有良师益友激励方能发挥潜能。'),
            '廉贞': ('北斗次桃花星，化气为囚。坐命者个性鲜明、爱憎分明，'
                     '做事执着认真。但情绪波动大，需防范感情纠葛和人际纷争。'
                     '自制力是廉贞一生的修行课题。'),
            '天府': ('南斗库星，化气为贤能。坐命者稳重宽厚、包容力强，'
                     '天生善于管理和理财，一生物质生活无忧。但偏保守、'
                     '不喜冒险，需在稳定中求突破。'),
            '太阴': ('中天星主，化气为富。坐命者情感细腻、直觉敏锐，'
                     '注重家庭和内在感受，有艺术天赋。庙旺则富足安康，'
                     '落陷则多愁善感、容易内耗。情绪管理是关键。'),
            '贪狼': ('北斗大桃花星，化气为桃花。坐命者多才多艺、'
                     '社交手腕一流，人缘极佳。对美好事物有强烈追求欲，'
                     '但需克制欲望、避免沉迷酒色。才华用在正途则成大器。'),
            '巨门': ('北斗暗星，化气为暗。坐命者口才出众、观察力敏锐，'
                     '善于发现问题和分析事理。但易招惹口舌是非，'
                     '需谨言慎行，将犀利口才用于正向沟通。'),
            '天相': ('南斗印星，化气为印。坐命者公正无私、善解人意，'
                     '是天生的协调者。做事稳重、值得信赖，'
                     '但有时缺乏主见，需培养独立决策的魄力。'),
            '天梁': ('南斗寿星，化气为荫。坐命者慈悲为怀、清高正直，'
                     '有长者之风。天生带长寿之相，喜帮助弱小，'
                     '但有时过于理想主义，需脚踏实地行事。'),
            '七杀': ('南斗大杀将星，化气为将。坐命者威严刚毅、敢作敢为，'
                     '天生将才，适合开创性事业。一生波澜起伏、大起大落——'
                     '成大事者必历大难，这正是七杀的宿命与荣耀。'),
            '破军': ('北斗耗星，化气为耗。坐命者冲动激进、不惧改变，'
                     '具有破旧立新的勇气和魄力。人生多变、常有转折，'
                     '但破军的本质是"破而后立"——毁灭之后即是新生。'),
        }
        if star in d:
            lines.append(f'')
            lines.append(f'  命格详析：{d[star]}')

    def _write_star_combos(self, lines, maj_ming, aux_ming):
        """Analyze important star combinations."""
        combos = []
        if '紫微' in maj_ming and '天府' in maj_ming:
            combos.append('「紫府同宫」——帝王配库星，贵气与财气兼具，'
                         '一生衣食无忧且社会地位较高，是难得的上等格局。'
                         '但需防过于安逸而失进取之心。')
        if '紫微' in maj_ming and '七杀' in maj_ming:
            combos.append('「紫杀」格局——帝星遇将星，威权极重。'
                         '一生多在大机构或体制内担当重任，但孤克较重，'
                         '内心易感孤独，需学会与人分享权力。')
        if '紫微' in maj_ming and '破军' in maj_ming:
            combos.append('「紫破」格局——帝星遇耗星，开创力极强。'
                         '适合创业和改革，一生多次大转折，'
                         '成败皆系于自己的决断力。')
        if '天府' in maj_ming and '天相' in maj_ming:
            combos.append('「府相」格局——库星配印星，稳重公正兼备。'
                         '最适合管理、行政、法律等工作，是天然的二把手。')
        if '武曲' in maj_ming and '天府' in maj_ming:
            combos.append('「武府」格局——将星配库星，刚毅且善理财。'
                         '求财能力强且守得住，适合金融实业。但性格刚硬，'
                         '需注意人际和谐。')
        if '太阳' in maj_ming and '太阴' in maj_ming:
            combos.append('「日月同宫」——阴阳调和，性格平衡。'
                         '既有太阳的热情外放，又有太阴的细腻内敛，'
                         '处事圆融、人际关系佳。')
        if '天同' in maj_ming and '太阴' in maj_ming:
            combos.append('「同阴」格局——福星遇财星，福气绵长。'
                         '天性乐观、不争不抢却常得福报。一生安逸但需防懒散。')
        if '廉贞' in maj_ming and '贪狼' in maj_ming:
            combos.append('「廉贪」格局——两大桃花星同宫，魅力四射。'
                         '才华横溢但情感世界复杂，需在感情与理智间找平衡。')
        if '文昌' in aux_ming and '文曲' in aux_ming:
            combos.append('「昌曲同宫」——两大文星齐聚，才学出众。'
                         '文笔口才俱佳，考试运强，利科甲功名。')

        if combos:
            lines.append('')
            lines.append('【星曜格局 · 锦囊妙语】')
            for c in combos:
                lines.append(f'▸ {c}')

    def _star_in_palace(self, star, palace, info):
        """What a star means when placed in a specific palace."""
        wuxing = info.get('wuxing', '')
        nature = info.get('nature', '')
        specific = {
            '财帛宫': {
                '紫微': '财运由地位带动，靠名声和资源赚钱',
                '武曲': '正财运极强，善存钱和投资，理财高手',
                '天府': '财运稳定丰厚，有库房之福，一生不愁钱',
                '太阴': '财来自田宅或女性贵人，偏财运佳',
                '贪狼': '财运来自人脉和才艺，但花销大需节制',
                '破军': '财运大起大落，来快去快，需守财',
                '七杀': '求财辛苦，需拼搏方能得财',
                '天同': '财运平淡但知足，不愁吃穿',
                '天机': '财运靠脑力，多变但总有来源',
                '太阳': '财运靠名气和影响力，慷慨大方',
                '巨门': '财运靠口才，但需防因口舌破财',
                '天相': '收入稳定，善于规划财务',
                '天梁': '财运平淡但晚年无忧',
                '廉贞': '财运波动，需防因感情破财',
            },
            '夫妻宫': {
                '紫微': '配偶有领导气质，婚姻需互相尊重',
                '天府': '婚姻稳定，配偶稳重可靠',
                '贪狼': '桃花运强，配偶有魅力，需防第三者',
                '太阴': '配偶温柔体贴，感情细腻',
                '七杀': '感情激烈，婚姻多有波折考验',
                '破军': '感情多变，需经历磨合方能稳定',
                '武曲': '配偶务实，但感情表达较为生硬',
                '天同': '婚姻和谐甜蜜，如知己般相处',
                '天机': '配偶聪明灵活，但感情易有变动',
                '太阳': '配偶开朗大方，但男方需注意大男子主义',
                '巨门': '沟通是关键，口舌之争多',
                '天相': '配偶公正体贴，婚姻和谐',
                '天梁': '配偶成熟稳重，但年龄差可能较大',
                '廉贞': '感情浓烈但易有风波，需克制情绪',
            },
            '官禄宫': {
                '紫微': '事业有成，适合管理岗或自主创业',
                '武曲': '适合金融、工程、军警等刚毅行业',
                '天机': '适合策划、咨询、技术等脑力工作',
                '太阳': '适合公众人物、教育、公益事业',
                '天府': '适合大型机构、稳定行业',
                '七杀': '适合开拓性行业、创业或军警',
                '破军': '事业多变，适合创新或自由职业',
                '天同': '适合服务业、创意工作，不喜高压',
                '贪狼': '适合娱乐、艺术、社交型行业',
                '巨门': '适合法律、咨询、口才型行业',
                '天相': '适合行政、管理、协调型工作',
                '天梁': '适合教育、医疗、公益行业',
                '太阴': '适合艺术、设计、女性相关行业',
                '廉贞': '适合纪律部队、研究型工作',
            },
            '迁移宫': {
                '紫微': '在外有贵人，适合到更大舞台发展',
                '天机': '喜旅行变动，外出常有新机会',
                '太阳': '在外受欢迎，适合海外发展',
                '七杀': '外出需谨慎，但动荡中亦有机遇',
                '天府': '在外财运好，适合异地置业',
                '贪狼': '外出桃花旺，交际场中如鱼得水',
                '破军': '漂洋过海之命，适合远行发展',
            },
            '福德宫': {
                '天同': '天生享福，内心世界丰富快乐',
                '天府': '精神富足，享受高品质生活',
                '太阳': '乐善好施，从助人中得快乐',
                '贪狼': '爱好广泛、享受人生，但需节制',
                '紫微': '精神层面追求高，喜高雅享受',
                '太阴': '内心世界丰富细腻，精神享受型',
                '天梁': '晚年福厚，清闲自在',
            },
            '疾厄宫': {
                '七杀': '体质偏刚，需注意外伤和手术',
                '破军': '需注意肠胃和生殖系统',
                '贪狼': '需注意肾脏和内分泌',
                '巨门': '需注意口腔和消化系统',
                '天机': '需注意神经系统和睡眠',
                '太阳': '需注意心血管和眼睛',
                '太阴': '需注意妇科和情绪健康',
                '廉贞': '需注意血液和免疫系统',
            },
        }
        ps = specific.get(palace, {})
        if star in ps:
            return ps[star]
        return f'{star}（{wuxing}{nature}星）在此宫，其{wuxing}之气影响该领域事务。'

    def _write_summary(self, lines, ming_name, maj_ming, aux_ming,
                       palace_stars, sihua, major_info, aux_info,
                       palace_desc, palaces, ming_idx):
        """Overall life reading."""

        # — 性格总论 —
        lines.append('')
        lines.append('【性格总论】')
        if maj_ming:
            lines.append(f'命宫坐{ming_name}，主星{"、".join(maj_ming)}，')
        else:
            lines.append(f'命宫坐{ming_name}，无主星，')
        lines.append('形成了你独特的性格底色。')

        traits = []
        for s in maj_ming:
            m = {
                '紫微': '稳重有担当', '天府': '宽厚善管理',
                '七杀': '果敢坚毅', '武曲': '刚毅果断',
                '天机': '聪慧敏捷', '天同': '温和知足',
                '贪狼': '热情有魅力', '廉贞': '执着认真',
                '太阳': '正直热心', '天梁': '慈悲清高',
                '太阴': '细腻内敛', '天相': '周到公正',
                '巨门': '敏锐善辩', '破军': '勇敢创新',
            }
            if s in m:
                traits.append(m[s])
        if traits:
            lines.append(f'核心特质：{"、".join(traits)}。')

        # 昌曲才学
        all_stars = []
        for sl in palace_stars.values():
            all_stars.extend(sl)
        if '文昌' in all_stars or '文曲' in all_stars:
            lines.append('昌曲入命或三方，才学出众，在文化、学术或创意领域有天然优势。')

        lines.append('')
        # — 事业财运 —
        lines.append('【事业财运】')
        caibo_name = palaces[(ming_idx + 4) % 12]
        guanlu_name = palaces[(ming_idx - 4) % 12]
        cb_s = [s for s in palace_stars.get(caibo_name, []) if s in major_info]
        gl_s = [s for s in palace_stars.get(guanlu_name, []) if s in major_info]

        lines.append(f'财帛宫（{caibo_name}）与官禄宫（{guanlu_name}）是事业财运的命脉。')
        if cb_s:
            lines.append(f'财帛宫有{"、".join(cb_s)}，理财能力与生俱来。')
        else:
            lines.append('财帛宫无主星，财运靠后天努力和大运推动。')
        if gl_s:
            lines.append(f'官禄宫有{"、".join(gl_s)}，事业方向较为明确。')
        else:
            lines.append('官禄宫无主星，事业不拘一格、随机遇而变。')

        # 四化影响财运事业
        if sihua:
            for star, hua in sihua.items():
                for pn, slist in palace_stars.items():
                    if star in slist and pn in (caibo_name, guanlu_name):
                        if hua == '禄':
                            lines.append(f'{star}化禄在{pn}——财运事业自带福气，此处大有可为！')
                        elif hua == '忌':
                            lines.append(f'{star}化忌在{pn}——此处需多花心思，但未必是坏事，修行的功课。')

        lines.append('')
        # — 感情婚姻 —
        lines.append('【感情婚姻】')
        fuqi_name = palaces[(ming_idx + 2) % 12]
        fq_s = [s for s in palace_stars.get(fuqi_name, []) if s in major_info]
        fq_aux = [s for s in palace_stars.get(fuqi_name, []) if s in aux_info]
        lines.append(f'夫妻宫坐「{fuqi_name}」，')

        love_types = {
            '贪狼': '桃花较重，感情丰富但也易招烂桃花，需学会分辨真心。',
            '廉贞': '感情浓烈执着，爱恨分明，需克制情绪化的一面。',
            '天府': '感情稳定踏实，适合长久经营，婚后生活安逸。',
            '天相': '配偶公正体贴，婚姻如细水长流般温馨。',
            '太阴': '感情细腻温柔，需要安全感，配偶会是温暖的港湾。',
            '七杀': '感情道路多有波折，需经历风雨才能见彩虹。',
            '破军': '感情多变，可能经历大的转折才最终稳定。',
            '紫微': '配偶能力强或有社会地位，婚姻需平等相待。',
            '武曲': '配偶务实可靠，但感情表达偏理性，少浪漫。',
            '天同': '感情甜蜜，婚姻如知己般轻松愉快。',
            '天梁': '配偶可能年长，但稳重可靠，如父如兄。',
            '天机': '配偶聪明灵活，但感情易因思虑过多而生变。',
            '太阳': '配偶热情开朗，注意给彼此留空间。',
            '巨门': '沟通是婚姻关键，口舌之争需用心化解。',
        }
        if fq_s:
            for s in fq_s:
                if s in love_types:
                    lines.append(love_types[s])
        else:
            lines.append('无主星——感情随缘而安，大运流年触发姻缘。')
        if '左辅' in fq_aux or '右弼' in fq_aux:
            lines.append('辅弼入夫妻宫——婚姻有贵人庇护，得道多助。')
        if '擎羊' in fq_aux or '陀罗' in fq_aux:
            lines.append('擎陀入夫妻宫——需注意沟通，避免误会积累。')

        lines.append('')
        # — 健康 —
        lines.append('【健康提示】')
        jihe_name = palaces[(ming_idx + 5) % 12]
        jh_s = palace_stars.get(jihe_name, [])
        jh_maj = [s for s in jh_s if s in major_info]
        wx_health = {
            '金': '注意呼吸系统和骨骼关节',
            '木': '注意肝胆和神经系统',
            '水': '注意肾脏和泌尿系统',
            '火': '注意心血管和眼睛',
            '土': '注意脾胃消化系统',
        }
        tips_given = False
        if jh_maj:
            wx_set = set()
            for s in jh_maj:
                info = major_info.get(s, {})
                w = info.get('wuxing', '')
                if w and len(w) == 1:
                    wx_set.add(w)
            for w in wx_set:
                if w in wx_health:
                    lines.append(f'· {wx_health[w]}')
                    tips_given = True
        if '火星' in jh_s or '铃星' in jh_s:
            lines.append('· 火铃入疾厄，需防急症和炎症')
            tips_given = True
        if not tips_given:
            lines.append('· 疾厄宫先天尚可，注意后天保养即可。')

        lines.append('')
        # — 人生建议 —
        lines.append('【人生锦囊】')
        advices = {
            '紫微': '发挥与生俱来的领导力，但别忘了倾听他人的声音。',
            '天府': '你的稳重是最大的资本，但偶尔冒险也未尝不可。',
            '七杀': '波澜起伏是你的命运，但不是你的敌人——拥抱它。',
            '破军': '破旧立新是你的使命，不惧改变，重建总比固守更精彩。',
            '武曲': '刚毅是你的力量，柔和是你的修行，刚柔并济方成大事。',
            '天机': '头脑是你的最佳武器，但别让过度思考消耗你。',
            '太阳': '像太阳一样照耀他人，但也给自己留一片阴凉。',
            '太阴': '你的细腻是天赋，但别让它变成内耗。',
            '贪狼': '才华横溢是福也是考验，用在正途则光芒万丈。',
            '巨门': '口才是双刃剑——用在正道，所向披靡。',
            '天同': '知足常乐是福，但偶尔也需要一点野心。',
            '廉贞': '你的执着让人敬佩，但学会放下也是一种智慧。',
            '天相': '善解人意的你，也别忘了为自己发声。',
            '天梁': '慈悲济世是你的天性，但也记得照顾好自己。',
        }
        for s in maj_ming:
            if s in advices:
                lines.append(f'· {advices[s]}')
        if not maj_ming:
            lines.append('· 命无主星，不被定义就是你的天赋——活出自己的路。')
