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
        """Generate comprehensive interpretation."""
        lines = []

        # Sun/Moon/Rising
        sun_sign = planet_signs['太阳']
        moon_sign = planet_signs['月亮']
        asc_sign = sign_short(asc_lon)

        lines.append(f'【三巨头】')
        lines.append(f'☀ 太阳星座：{sun_sign}座 — 你的核心自我、人生目标')
        lines.append(f'☽ 月亮星座：{moon_sign}座 — 你的情感模式、内心需求')
        lines.append(f'↑ 上升星座：{asc_sign}座 — 你的外在面具、给人的第一印象')
        lines.append('')

        # Element balance
        lines.append(f'【元素分布】')
        lines.append(f'火象：{element_count["火"]}颗  |  土象：{element_count["土"]}颗  |  '
                     f'风象：{element_count["风"]}颗  |  水象：{element_count["水"]}颗')
        most_el = max(element_count, key=element_count.get)
        least_el = min(element_count, key=element_count.get)
        lines.append(f'元素偏重：{most_el}象最强，{least_el}象最弱')
        lines.append('')

        # Dominant sign
        lines.append(f'【主导星座】{self.SIGNS[dominant_sign]}座能量最强')
        if dominant_sign < len(self.SIGN_MEANINGS):
            lines.append(self.SIGN_MEANINGS[dominant_sign])
        lines.append('')

        # Planets in signs
        lines.append('【行星落座】')
        for name in ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星']:
            sign = planet_signs[name]
            house = planet_houses[name]
            lines.append(f'{name}：{sign}座 第{house}宫')
        lines.append('')

        # Key aspects
        if aspects:
            lines.append('【主要相位】')
            for a in aspects[:10]:  # Show top 10
                lines.append(f'{a["p1"]} {a["symbol"]} {a["p2"]}（{a["aspect"]}，容许度{a["orb"]}°）')

        lines.append('')
        lines.append('（注：此星盘使用简化天文计算，仅供娱乐参考。完整星盘分析需专业占星软件。）')

        return '\n'.join(lines)
