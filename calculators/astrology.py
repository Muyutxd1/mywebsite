"""
西洋占星 — Western Astrology Natal Chart Calculator
行星落座、落宫、相位分析
"""
from core.astronomy import (
    julian_day, sun_longitude, moon_longitude,
    mercury_longitude, venus_longitude, mars_longitude,
    jupiter_longitude, saturn_longitude,
    uranus_longitude, neptune_longitude, pluto_longitude,
    sign_name, sign_short, longitude_to_sign,
    ascendant, calculate_houses, planet_house, find_aspects,
    ZODIAC_SHORT
)


class AstrologyCalculator:
    """西洋占星本命盘计算器"""

    PLANETS = ['太阳', '月亮', '水星', '金星', '火星',
               '木星', '土星', '天王星', '海王星', '冥王星']

    SIGNS = ZODIAC_SHORT

    SIGN_MEANINGS = {
        0: '白羊座是黄道第一宫，火象的开创者。白羊能量强的人勇敢、直率、行动力超群，但有时也显得急躁和自我。',
        1: '金牛座是土象的固定宫，重视物质安全和感官享受。金牛能量强的人稳重、可靠、有艺术品味，但可能固执。',
        2: '双子座是风象的变动宫，好奇心旺盛的信息收集者。双子能量强的人聪明、健谈、适应力好，但可能三心二意。',
        3: '巨蟹座是水象的开创宫，敏感而富有保护欲。巨蟹能量强的人温柔、顾家、重情重义，但可能情绪化。',
        4: '狮子座是火象的固定宫，天生的领袖和表演者。狮子能量强的人自信、慷慨、充满创造力，但可能自负。',
        5: '处女座是土象的变动宫，追求完美的分析者。处女能量强的人细致、务实、服务意识强，但可能过于挑剔。',
        6: '天秤座是风象的开创宫，和平与美的追求者。天秤能量强的人优雅、公正、善于合作，但可能优柔寡断。',
        7: '天蝎座是水象的固定宫，深邃而具有转化力的洞察者。天蝎能量强的人意志坚定、直觉敏锐，但可能过于极端。',
        8: '射手座是火象的变动宫，乐观的探险家和哲学家。射手能量强的人热爱自由、真诚坦率，但可能不够细致。',
        9: '摩羯座是土象的开创宫，坚韧不拔的事业攀登者。摩羯能量强的人自律、有责任感、脚踏实地，但可能过于严肃。',
        10: '水瓶座是风象的固定宫，独立创新的改革者。水瓶能量强的人智慧、人道主义、特立独行，但可能疏离冷漠。',
        11: '双鱼座是水象的变动宫，富有灵性和同理心的梦想家。双鱼能量强的人善良、有艺术天赋、直觉力强，但可能逃避现实。',
    }

    def calculate(self, year, month, day, hour=0, minute=0,
                  lat=39.9, lng=116.4, tz_offset=8):
        """Calculate full natal chart."""
        year = int(year)
        month = int(month)
        day = int(day)
        hour = int(hour)
        minute = int(minute)
        lat = float(lat)
        lng = float(lng)
        tz_offset = int(tz_offset)

        # Convert to UT for calculations
        ut_hour = hour - tz_offset
        jd = julian_day(year, month, day, ut_hour, minute)

        # Planet positions
        planet_funcs = {
            '太阳': sun_longitude,
            '月亮': moon_longitude,
            '水星': mercury_longitude,
            '金星': venus_longitude,
            '火星': mars_longitude,
            '木星': jupiter_longitude,
            '土星': saturn_longitude,
            '天王星': uranus_longitude,
            '海王星': neptune_longitude,
            '冥王星': pluto_longitude,
        }

        planet_lons = {}
        planet_signs = {}
        for name, func in planet_funcs.items():
            lon = func(jd)
            planet_lons[name] = lon
            planet_signs[name] = sign_short(lon)

        # Ascendant and MC
        asc_lon, mc_lon = ascendant(jd, lat, lng)

        # Houses
        house_cusps = calculate_houses(mc_lon, asc_lon)

        # Planet houses
        planet_houses = {}
        for name in planet_lons:
            planet_houses[name] = planet_house(planet_lons[name], house_cusps)

        # Aspects
        aspects = find_aspects(planet_lons)

        # Sign distribution
        sign_count = [0] * 12
        for name in planet_lons:
            sign_count[longitude_to_sign(planet_lons[name])] += 1

        # Element distribution
        element_map = {
            '火': [0, 4, 8],   # Aries, Leo, Sagittarius
            '土': [1, 5, 9],   # Taurus, Virgo, Capricorn
            '风': [2, 6, 10],  # Gemini, Libra, Aquarius
            '水': [3, 7, 11],  # Cancer, Scorpio, Pisces
        }
        element_count = {el: sum(sign_count[i] for i in idxs)
                         for el, idxs in element_map.items()}

        # Dominant sign
        dominant_sign_idx = sign_count.index(max(sign_count))

        return {
            'birth_info': {'year': year, 'month': month, 'day': day,
                           'hour': hour, 'minute': minute, 'lat': lat, 'lng': lng},
            'planets': [
                {
                    'name': name,
                    'longitude': round(planet_lons[name], 2),
                    'sign': planet_signs[name],
                    'house': planet_houses[name],
                }
                for name in self.PLANETS
            ],
            'ascendant': {'longitude': round(asc_lon, 2), 'sign': sign_short(asc_lon)},
            'mc': {'longitude': round(mc_lon, 2), 'sign': sign_short(mc_lon)},
            'aspects': aspects,
            'element_count': element_count,
            'dominant_sign': self.SIGNS[dominant_sign_idx],
            'interpretation': self._interpret(
                planet_signs, planet_houses, aspects,
                asc_lon, element_count, dominant_sign_idx
            ),
        }

    def _interpret(self, planet_signs, planet_houses, aspects,
                   asc_lon, element_count, dominant_sign):
        """Generate deeply detailed natal chart interpretation."""
        lines = []
        sun_sign = planet_signs['太阳']
        moon_sign = planet_signs['月亮']
        asc_sign = sign_short(asc_lon)
        sign_idx = {'白羊':0,'金牛':1,'双子':2,'巨蟹':3,'狮子':4,'处女':5,
                    '天秤':6,'天蝎':7,'射手':8,'摩羯':9,'水瓶':10,'双鱼':11}

        # ═══ 壹 · 三巨头详解 ═══
        lines.append('─' * 32)
        lines.append('【壹 · 三巨头详解】')
        lines.append('太阳、月亮、上升——占星学中最重要的三个要素，')
        lines.append('分别代表"我是谁""我需要什么""世界如何看我"。')
        lines.append('')

        # 太阳
        si = sign_idx.get(sun_sign, 0)
        sign_desc = self.SIGN_MEANINGS.get(si, '')
        lines.append(f'☀ 太阳 · {sun_sign}座')
        lines.append(f'  太阳代表你的核心自我、人生目标与意志力。太阳落在{sun_sign}座，')
        lines.append(f'  意味着你的本质是——')
        lines.append(f'  {sign_desc}')
        lines.append(f'  太阳在{sun_sign}座的人，人生的根本动力来自于{sun_sign}座')
        lines.append(f'  所代表的领域，在此发光发热是你与生俱来的使命。')
        lines.append('')

        # 月亮
        mi = sign_idx.get(moon_sign, 0)
        moon_desc = self.SIGN_MEANINGS.get(mi, '')
        lines.append(f'☽ 月亮 · {moon_sign}座')
        lines.append(f'  月亮代表你的情感模式、内心需求与潜意识。月亮落在{moon_sign}座，')
        lines.append(f'  说明你的情感底色是——')
        lines.append(f'  {moon_desc}')
        lines.append(f'  月亮在{moon_sign}座的人，需要用{moon_sign}座的方式获得安全感。')
        lines.append(f'  你最容易在亲密关系和独处时刻感受到月亮的影响。')
        lines.append('')

        # 上升
        ai = sign_idx.get(asc_sign, 0)
        asc_desc = self.SIGN_MEANINGS.get(ai, '')
        lines.append(f'↑ 上升 · {asc_sign}座')
        lines.append(f'  上升星座是你出生时东方地平线上的星座，代表你的外在面具、')
        lines.append(f'  第一印象和与世界互动的方式。上升在{asc_sign}座——')
        lines.append(f'  {asc_desc}')
        lines.append(f'  别人眼中的你是一个{asc_sign}座人，这是你进入新环境时')
        lines.append(f'  自然而然的"出厂设定"。')

        lines.append('')
        # ═══ 贰 · 元素分布 ═══
        lines.append('─' * 32)
        lines.append('【贰 · 元素分布】')
        lines.append(f'火 {element_count["火"]}颗 | 土 {element_count["土"]}颗 | '
                     f'风 {element_count["风"]}颗 | 水 {element_count["水"]}颗')
        lines.append('')
        most_el = max(element_count, key=element_count.get)
        least_el = min(element_count, key=element_count.get)
        el_analysis = {
            '火': ('🔥 火象强盛——你充满热情、行动力和自信。敢想敢做、'
                   '不畏挑战，是天生的开拓者和鼓舞者。但火过旺可能急躁冲动，'
                   '需学会三思而后行。'),
            '土': ('🏔 土象强盛——你务实稳重、脚踏实地。注重物质安全和现实成果，'
                   '做事有计划、有耐力。但土过旺可能固执保守，需保持开放心态。'),
            '风': ('💨 风象强盛——你思维活跃、善于沟通。好奇心旺盛、'
                   '适应力强，喜欢探索新事物和结交新朋友。但风过旺可能三心二意，'
                   '需培养专注和深度。'),
            '水': ('💧 水象强盛——你情感丰富、直觉敏锐。富有同理心和创造力，'
                   '对人的情绪变化极为敏感。但水过旺可能情绪化、多愁善感，'
                   '需学会在情感与理智间平衡。'),
        }
        el_missing = {
            '火': '火象弱——你可能缺乏自信和冲劲，需要刻意培养行动力。',
            '土': '土象弱——你不太在意物质世界，需注意财务规划和日常务实。',
            '风': '风象弱——你偏内敛，需锻炼表达和社交能力。',
            '水': '水象弱——你比较理智，但需更多关注自己的情感需求。',
        }
        lines.append(el_analysis.get(most_el, ''))
        lines.append(el_missing.get(least_el, ''))
        lines.append('')

        # ═══ 叁 · 行星落座详解 ═══
        lines.append('─' * 32)
        lines.append('【叁 · 行星落座详解】')
        lines.append('每一颗行星落在不同星座，展现出独特的能量色彩。')
        lines.append('以下逐一解读你的行星配置——')
        lines.append('')

        planet_keywords = {
            '太阳': '核心自我、意志',
            '月亮': '情感、潜意识',
            '水星': '思维、沟通',
            '金星': '爱情、审美、价值观',
            '火星': '行动力、欲望、愤怒',
            '木星': '幸运、成长、信念',
            '土星': '责任、限制、成熟',
            '天王星': '独立、创新、突变',
            '海王星': '梦想、灵性、幻灭',
            '冥王星': '蜕变、权力、深层力量',
        }

        for name in self.PLANETS:
            sign = planet_signs[name]
            house = planet_houses[name]
            kw = planet_keywords.get(name, '')
            si = sign_idx.get(sign, 0)
            sdesc = self.SIGN_MEANINGS.get(si, '')
            lines.append(f'▸ {name} 在 {sign}座 · 第{house}宫')
            lines.append(f'  {name}掌管{kw}。')
            lines.append(f'  · 落座含义：{self._planet_in_sign(name, sign)}')
            lines.append(f'  · 落宫含义：{self._planet_in_house(name, house)}')
            lines.append('')

        # ═══ 肆 · 相位详解 ═══
        if aspects:
            lines.append('─' * 32)
            lines.append('【肆 · 相位详解】')
            lines.append('行星之间的角度关系（相位）揭示了内在能量的互动——')
            lines.append('哪些力量相互支持，哪些力量产生张力。')
            lines.append('')
            seen = set()
            for a in aspects[:12]:
                key = (a['p1'], a['p2'], a['aspect'])
                if key in seen:
                    continue
                seen.add(key)
                aspect_type = a['aspect']
                type_desc, type_advice = self._aspect_type_info(aspect_type)
                lines.append(f'▸ {a["p1"]} {a["symbol"]} {a["p2"]}（{aspect_type}，{a["orb"]}°）')
                lines.append(f'  相位类型：{type_desc}')
                lines.append(f'  解读：{self._aspect_meaning(a["p1"], a["p2"], aspect_type)}')
                lines.append(f'  {type_advice}')
                lines.append('')

        # ═══ 伍 · 综合解读 ═══
        lines.append('─' * 32)
        lines.append('【伍 · 综合解读】')
        self._astrology_synthesis(lines, sun_sign, moon_sign, asc_sign,
                                  planet_signs, planet_houses, element_count,
                                  dominant_sign, sign_idx)

        lines.append('')
        lines.append('─' * 20)
        lines.append('（注：此星盘使用简化天文计算，行星位置精确到度但未考虑')
        lines.append('       逆行、宫位分宫制差异等细节。以上解读仅供娱乐参考。）')

        return '\n'.join(lines)

    # ── 占星辅助解读 ───────────────────────────────────

    def _planet_in_sign(self, planet, sign):
        """Detailed meaning of planet in zodiac sign."""
        # Sign keywords
        sk = {
            '白羊': '勇敢、直接、冲动', '金牛': '稳重、务实、执着',
            '双子': '灵活、好奇、多变', '巨蟹': '敏感、顾家、温柔',
            '狮子': '自信、慷慨、戏剧化', '处女': '细致、严谨、完美主义',
            '天秤': '优雅、平衡、犹豫', '天蝎': '深刻、激情、洞察',
            '射手': '乐观、自由、率真', '摩羯': '自律、坚韧、严肃',
            '水瓶': '独立、创新、疏离', '双鱼': '善良、梦幻、敏感',
        }
        skw = sk.get(sign, '')

        data = {
            '太阳': {
                '白羊': '你是天生的开拓者，行动力一流。人生信条是"先做再说"，但需学会耐心。',
                '金牛': '你追求稳定和质感。慢而稳是你的节奏，物质安全感对你很重要。',
                '双子': '好奇心驱动你的人生。博学多闻、善于交流，但需深耕某一领域。',
                '巨蟹': '家庭和情感是你的核心。温柔而有保护欲，人生意义来自亲密关系。',
                '狮子': '你天生是主角。渴望被认可和欣赏，创造力强，慷慨大方。',
                '处女': '追求完美是你的本能。细心周到、服务意识强，但别对自己太苛刻。',
                '天秤': '和谐与美是你的追求。公正优雅，善于合作，但优柔寡断是硬伤。',
                '天蝎': '你拥有惊人的洞察力和意志力。不轻易表露真心，但一旦认定便全力以赴。',
                '射手': '自由是你的信仰。热爱探索和冒险，乐观豁达，人生就是一场旅程。',
                '摩羯': '你有着超乎常人的耐心和责任感。事业心强，大器晚成型。',
                '水瓶': '你独立思考、特立独行。追求真理和进步，是天生的改革者。',
                '双鱼': '你敏感而富有同理心。艺术感知力强，灵魂深处连接着更大的世界。',
            },
            '月亮': {
                '白羊': '情绪来得快去得快。内心像个小孩，需要立即满足，但也很容易开心。',
                '金牛': '情绪稳定但固执。需要物质和感官上的舒适来获得内心平静。',
                '双子': '情绪多变但善于用语言表达。需要不断的新鲜刺激来保持心情愉快。',
                '巨蟹': '月亮入庙！情感深沉而敏感，极度需要归属感和家的温暖。',
                '狮子': '内心渴望被关注和赞美。慷慨温暖，但情感上需要"主角感"。',
                '处女': '情绪被理性过滤。用分析和解决问题来处理压力，内心追求秩序。',
                '天秤': '情绪平和但依赖关系。需要和谐的人际环境，厌恶冲突。',
                '天蝎': '月亮落陷。情感极端而深刻，爱恨分明，内心世界波涛汹涌。',
                '射手': '乐观是情感底色。用幽默和哲学化解负面情绪，需要自由空间。',
                '摩羯': '情感内敛不轻易外露。内心有强烈责任感，用成就来获得安全感。',
                '水瓶': '情感理智而疏离。需要独立空间，用理性分析而非直觉感受。',
                '双鱼': '极度敏感和富有同理心。吸收周围人的情绪，需要独处恢复能量。',
            },
            '水星': {
                '白羊': '思维直接快速，说话不拐弯。决策果断但有时欠考虑。',
                '金牛': '学习慢但扎实。思维务实，一旦学会就永远不会忘。',
                '双子': '水星入庙！思维敏捷、好奇心爆棚，是天生的话匣子和信息收集者。',
                '巨蟹': '记忆力和直觉思维强。思维受情绪影响，善于理解他人感受。',
                '狮子': '表达富有戏剧性和感染力。思维宏大，善于说服和激励他人。',
                '处女': '水星入庙！分析力超群、关注细节，是天生的编辑和研究者。',
                '天秤': '思维平衡公正，善于从多角度看问题。表达优雅得体。',
                '天蝎': '思维深刻而有穿透力。喜欢探究本质和秘密，直觉惊人。',
                '射手': '关注宏观和大方向。思维开阔、热爱哲学，但容易忽略细节。',
                '摩羯': '思维严谨有条理。擅长长期规划，表达简洁务实。',
                '水瓶': '思维超前而不拘一格。充满原创想法，是天生的发明家。',
                '双鱼': '水星落陷。思维感性而跳跃，富有想象力，但逻辑性稍弱。',
            },
            '金星': {
                '白羊': '在爱情中主动热烈。喜欢征服的快感，爱得直接但可能来得快去得快。',
                '金牛': '金星入庙！重视感官享受和物质安全感。爱的表达是陪伴和给予。',
                '双子': '喜欢有趣有智慧的伴侣。爱情中需要持续的精神刺激和新鲜感。',
                '巨蟹': '在爱中温柔且保护欲强。家庭式的温情和安全感是爱的核心。',
                '狮子': '爱得热烈而大方。喜欢浪漫和仪式感，付出爱时毫不吝啬。',
                '处女': '金星落陷。爱的表达含蓄而务实，用行动而非言语示爱。',
                '天秤': '金星入庙！天生的恋爱高手。优雅迷人，追求和谐浪漫的关系。',
                '天蝎': '金星落陷。爱得深沉而执着。占有欲强，感情体验极端而难忘。',
                '射手': '爱得自由奔放。不喜欢被束缚，更喜欢精神层面的共鸣。',
                '摩羯': '在感情中务实而慎重。爱的承诺重于浪漫，经得起时间考验。',
                '水瓶': '爱是友谊的升华。需要独立空间，喜欢有智慧有思想的人。',
                '双鱼': '金星入庙！爱得浪漫而无私。充满幻想和牺牲精神，是灵魂之爱。',
            },
            '火星': {
                '白羊': '火星入庙！行动力爆表，竞争意识强。生气时直接爆发但很快过去。',
                '金牛': '行动缓慢但持久。脾气不容易上来，一旦发火就非常可怕。',
                '双子': '能量用脑不用力。辩论和智力竞争是你的战场，行动变化多端。',
                '巨蟹': '火星落陷。行动受情绪驱动，保护欲激发战斗力。生闷气多于爆发。',
                '狮子': '行动充满自信和领导力。喜欢掌控局面，竞争是为了荣耀而非利益。',
                '处女': '能量用在细节和完美上。做事精准，但容易因小事而烦躁。',
                '天秤': '火星落陷。行动优雅但不果断。厌恶正面冲突，更喜欢协商解决。',
                '天蝎': '火星入庙！意志力超强，爆发力惊人。不轻易出手，一旦出手必求必胜。',
                '射手': '行动热情奔放。喜欢探险和挑战，能量分散但乐观向上。',
                '摩羯': '火星入庙！行动有策略有耐力。是马拉松选手，不争一时争一世。',
                '水瓶': '行动方式非传统。反抗权威，为理念而战，行动往往出人意料。',
                '双鱼': '行动受直觉和灵感驱动。不太善于直接竞争，更适合创意性表达。',
            },
        }

        if planet in data and sign in data[planet]:
            return data[planet][sign]
        # Fallback
        return f'{planet}在{sign}座（{skw}），其能量以{sign}座的方式表达。'

    def _planet_in_house(self, planet, house):
        """Detailed meaning of planet in astrological house."""
        house_meanings = {
            1: '自我形象、外在表现', 2: '金钱、价值观、自我价值',
            3: '沟通、学习、兄弟姐妹', 4: '家庭、根基、内心安全感',
            5: '创造力、恋爱、子女', 6: '工作、健康、日常习惯',
            7: '伴侣关系、合作、公开敌人', 8: '深层转化、共有资源、性',
            9: '高等教育、长途旅行、哲学', 10: '事业、社会地位、公众形象',
            11: '友谊、社群、理想', 12: '潜意识、灵性、隐秘之事',
        }
        hdesc = house_meanings.get(house, '')
        specific = {
            '太阳': {
                1: '自我意识极强，天生有存在感，适合做自己而非跟随他人。',
                4: '家庭和根源是人生重心，内心需要稳固的根基。',
                5: '创造力丰富，热爱生活和恋爱，是天生的表演者。',
                10: '事业心强，渴望社会认可，容易在公众领域崭露头角。',
            },
            '月亮': {
                4: '月亮入庙！家庭和内心深处最舒适。极度需要温馨的私人空间。',
                10: '情感和事业深度绑定，公众形象带有温暖感。',
            },
            '水星': {
                3: '水星入庙！沟通学习的天才位置。思维活跃，表达流畅。',
                6: '工作和日常中的分析能力卓越，适合需要细节的职业。',
            },
            '金星': {
                2: '通过金钱和物质表达爱。对美和价值的感知力强。',
                5: '浪漫而富有创造力。恋爱是人生大乐事。',
                7: '适合长期伴侣关系的配置。在关系中寻求和谐与美。',
            },
            '火星': {
                1: '行动力直接，给人精力充沛的印象。做事果断利落。',
                10: '事业上进取心强，渴望在职场证明自己。',
            },
            '木星': {
                9: '木星入庙！天生的哲学家和探索者。高等教育和旅行带来幸运。',
                12: '最深层的幸运来自灵性和独处时的洞察。',
            },
            '土星': {
                10: '事业大器晚成。责任带来地位，但成名前需经磨炼。',
            },
        }
        if planet in specific and house in specific[planet]:
            return specific[planet][house]
        return f'{planet}在第{house}宫（{hdesc}），该生活领域被{planet}的能量所影响和激活。'

    def _aspect_type_info(self, aspect_type):
        """Return description and advice for aspect type."""
        info = {
            '合': ('合相（0°）——两颗行星能量融合，互相加强。'
                   '是你星盘中最强大的连接，代表天赋所在。',
                   '融合这两股能量，它们在互相成就。'),
            '冲': ('对分相（180°）——两股能量对立拉扯，产生内在张力。'
                   '这是需要平衡的功课，也是成长的动力。',
                   '在两极之间寻找平衡点，这是你的人生课题。'),
            '刑': ('四分相（90°）——内在矛盾和摩擦，带来挑战和行动力。'
                   '刑相位虽然不舒服，但往往是最有创造力的相位。',
                   '正视冲突，它会推动你前进——安逸不会让人成长。'),
            '拱': ('三分相（120°）——和谐顺畅的能量流动。'
                   '是你的天赋所在，事情在此处自然成真。',
                   '善用这个天赋，它来得太自然以至于你可能意识不到它的珍贵。'),
            '六合': ('六分相（60°）——温和的互助关系。'
                    '需要你稍微主动去激活的潜在机会。',
                    '主动一点，这个相位的机会在等你敲门。'),
        }
        return info.get(aspect_type, (f'{aspect_type}相——两颗行星之间存在角度关系。', ''))

    def _aspect_meaning(self, p1, p2, aspect_type):
        """Interpret a specific aspect between two planets."""
        pair = tuple(sorted([p1, p2]))
        meanings = {
            ('太阳', '月亮'): ('合' if aspect_type == '合' else ''),
            ('太阳', '火星'): '意志力与行动力的结合——你充满能量和领导力，是天生的行动派。',
            ('太阳', '木星'): '自信乐观、好运常伴。你天生有贵人运，心态积极是最大的财富。',
            ('太阳', '土星'): '自我表达受到一定限制。你比同龄人更早成熟，责任感强但需防自我否定。',
            ('月亮', '金星'): '情感与爱美的和谐对话。你温柔讨喜、人缘好，擅长营造舒适的氛围。',
            ('月亮', '火星'): '情绪与行动力纠缠。情感强烈直接，喜怒形于色但真实可爱。',
            ('月亮', '木星'): '内心富足、乐观豁达。慷慨大方，从帮助他人中获得满足感。',
            ('水星', '金星'): '沟通优雅有魅力。善于用语言化解矛盾，写作和表达有艺术感。',
            ('水星', '火星'): '思维犀利、说话直接。反应快但有时过于尖锐，是极佳的辩手。',
            ('水星', '木星'): '思维开阔、好奇心强。学习能力强，喜欢宏观思考但需注意细节。',
            ('水星', '土星'): '思维严谨、表达慎重。深度思考者，适合做研究和不急不躁的决策。',
            ('金星', '火星'): '激情与魅力的碰撞——感情生活丰富多彩，创造力强但需平衡激情与理性。',
            ('金星', '木星'): '审美和社交天赋超群。慷慨有魅力，桃花运强但需防过度享乐。',
            ('金星', '土星'): '感情中责任感强。对爱认真但可能过于克制，晚婚或不轻易动心。',
            ('火星', '木星'): '行动力超强、勇于冒险。能量充沛，是开拓者也是冒险家。',
            ('火星', '土星'): '行动与克制的角力。你深知"欲速则不达"，但有时会压抑自己的愤怒。',
            ('木星', '土星'): '乐观与现实的平衡。你知道何时冲、何时守，是成熟的象征。',
            ('太阳', '冥王星'): '意志力超群，不惧改变。人生有几次重大蜕变，每次重生都更强大。',
        }
        if pair in meanings:
            m = meanings[pair]
            if isinstance(m, str) and m:
                return m
        # Generic fallback
        return f'{p1}与{p2}形成{aspect_type}相，两者代表的能量相互影响和互动。'

    def _astrology_synthesis(self, lines, sun_sign, moon_sign, asc_sign,
                             planet_signs, planet_houses, element_count,
                             dominant_sign, sign_idx):
        """Overall synthesis of the natal chart."""
        dsign = self.SIGNS[dominant_sign]

        lines.append('')
        lines.append('【整体画像】')
        lines.append(f'你的"大三角"是：太阳{sun_sign}座 + 月亮{moon_sign}座 + 上升{asc_sign}座。')
        lines.append(f'主导星座是{dsign}座，元素偏重{max(element_count, key=element_count.get)}象。')

        # Sun-Moon harmony
        sun_si = sign_idx.get(sun_sign, 0)
        moon_si = sign_idx.get(moon_sign, 0)
        diff = abs(sun_si - moon_si)
        if diff in (0, 1):
            lines.append('太阳与月亮同座或邻座——内外较为一致，自我认知清晰。')
        elif diff in (6, 7, 8):
            lines.append('太阳与月亮对立——内在存在深刻的张力，但这往往也是创造力的源泉。')
        else:
            lines.append('太阳与月亮有一定距离——内在需要在理性和感性之间找到平衡。')

        lines.append('')
        lines.append('【性格关键词】')
        # Generate keywords based on signs
        sun_kw = {
            '白羊':'勇敢', '金牛':'坚韧', '双子':'聪明', '巨蟹':'温柔',
            '狮子':'自信', '处女':'细腻', '天秤':'优雅', '天蝎':'深刻',
            '射手':'乐观', '摩羯':'成熟', '水瓶':'独立', '双鱼':'善良',
        }
        moon_kw = {
            '白羊':'激情', '金牛':'耐心', '双子':'好奇', '巨蟹':'深情',
            '狮子':'慷慨', '处女':'务实', '天秤':'平和', '天蝎':'强烈',
            '射手':'豁达', '摩羯':'自律', '水瓶':'理性', '双鱼':'梦幻',
        }
        asc_kw = {
            '白羊':'活力', '金牛':'稳重', '双子':'健谈', '巨蟹':'亲和',
            '狮子':'光芒', '处女':'整洁', '天秤':'迷人', '天蝎':'神秘',
            '射手':'开朗', '摩羯':'可靠', '水瓶':'独特', '双鱼':'柔软',
        }
        kw = []
        for d in [sun_kw, moon_kw, asc_kw]:
            for s, k in d.items():
                if s in [sun_sign, moon_sign, asc_sign]:
                    if k not in kw:
                        kw.append(k)
        lines.append(f'{" · ".join(kw)}')

        lines.append('')
        lines.append('【情感模式】')
        venus_sign = planet_signs.get('金星', '')
        mars_sign = planet_signs.get('火星', '')
        lines.append(f'金星{venus_sign}座——你在爱情中注重美与和谐，')
        venus_style = {
            '白羊':'主动追爱、不拖泥带水', '金牛':'慢热深情、用行动表达',
            '双子':'需要精神共鸣和趣味', '巨蟹':'温柔体贴、需要安全感',
            '狮子':'浪漫热烈、重视仪式感', '处女':'用细节关怀表达爱意',
            '天秤':'优雅浪漫、追求和谐关系', '天蝎':'深刻执着、灵肉合一',
            '射手':'自由奔放、讨厌束缚', '摩羯':'慎重认真、以承诺为爱',
            '水瓶':'独立自主、如友如侣', '双鱼':'全身心投入、为爱牺牲',
        }
        lines.append(f'{venus_style.get(venus_sign, "以自己的方式去爱和被爱。")}')
        mars_style = {
            '白羊':'主动出击、不畏挑战', '金牛':'稳扎稳打、不轻易放弃',
            '双子':'灵活多变、巧取胜', '巨蟹':'保护欲驱动你的行动',
            '狮子':'大方自信、以领袖姿态行事', '处女':'精密计划后行动',
            '天秤':'优雅地争取、讨厌正面冲突', '天蝎':'暗中布局、一击必中',
            '射手':'随性而为、目标宏大', '摩羯':'步步为营、长期规划',
            '水瓶':'不按常理出牌、创新行动', '双鱼':'跟着直觉走、灵活应变',
        }
        lines.append(f'火星{mars_sign}座——{mars_style.get(mars_sign, "以自己独特的方式行动。")}')

        lines.append('')
        lines.append('【人生提示】')
        # Advice based on sun sign
        sun_advice = {
            '白羊': '跑得快不如跑得远——偶尔慢下来，你会看到更多风景。',
            '金牛': '安全区很舒服，但偶尔跨出去一步，惊喜在等你。',
            '双子': '你的广度是优势，但深度会带给你更大的满足感。',
            '巨蟹': '照顾好别人的同时，别忘了自己也需要被温柔对待。',
            '狮子': '你不必永远是太阳，偶尔做一颗星星也很美。',
            '处女': '完美是个方向，不是终点。不完美也是完整的一部分。',
            '天秤': '选择困难时，相信直觉——你的心知道答案。',
            '天蝎': '不是所有事情都需要深度——有时候简单就是答案。',
            '射手': '自由不是没有牵绊，而是有心安之处可以随时回来。',
            '摩羯': '山顶很重要，但爬山的过程才是真正的风景。',
            '水瓶': '你的独特是天赋，但也别忘了与人连接的温暖。',
            '双鱼': '边界不是墙，是保护你的花园。学会说"不"也是爱自己。',
        }
        lines.append(f'✨ {sun_advice.get(sun_sign, "做最真实的自己，宇宙会为你让路。")}')
