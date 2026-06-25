"""
天干地支系统 — Heavenly Stems & Earthly Branches
年柱 (立春分界)、月柱 (五虎遁)、日柱 (儒略日取模)、时柱 (五鼠遁)
"""

# ── 基础表 ────────────────────────────────────
TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
DI_ZHI   = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

# 天干五行
GAN_WUXING = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水',
}

# 天干阴阳
GAN_YINYANG = {
    '甲': '阳', '丙': '阳', '戊': '阳', '庚': '阳', '壬': '阳',
    '乙': '阴', '丁': '阴', '己': '阴', '辛': '阴', '癸': '阴',
}

# 地支五行
ZHI_WUXING = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水',
}

# 地支藏干 (本气 / 中气 / 余气)
ZHI_CANGGAN = {
    '子': ['癸'],
    '丑': ['己', '癸', '辛'],
    '寅': ['甲', '丙', '戊'],
    '卯': ['乙'],
    '辰': ['戊', '乙', '癸'],
    '巳': ['丙', '庚', '戊'],
    '午': ['丁', '己'],
    '未': ['己', '丁', '乙'],
    '申': ['庚', '壬', '戊'],
    '酉': ['辛'],
    '戌': ['戊', '辛', '丁'],
    '亥': ['壬', '甲'],
}

# 纳音六十甲子表
NAYIN = [
    '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火',
    '涧下水', '城头土', '白蜡金', '杨柳木', '泉中水', '屋上土',
    '霹雳火', '松柏木', '流年水', '砂中金', '山下火', '平地木',
    '壁上土', '金箔金', '覆灯火', '天河水', '大驿土', '钗钏金',
    '桑柘木', '柘榴水', '大海水', '石榴木', '大海水', '海中金',
]


def ganzhi_index(gan, zhi):
    """Get the 0-59 index of a Gan-Zhi pair."""
    gi = TIAN_GAN.index(gan)
    zi = DI_ZHI.index(zhi)
    # They increment together: index where gan%10==gi and zhi%12==zi
    for i in range(60):
        if i % 10 == gi and i % 12 == zi:
            return i
    return -1


def ganzhi_from_index(idx):
    """Get (gan, zhi) from 0-59 index."""
    return TIAN_GAN[idx % 10], DI_ZHI[idx % 12]


# ══════════════════════════════════════════════════
#  年柱 — 以立春为界
# ══════════════════════════════════════════════════

def year_ganzhi(year, solar_term_day=None, solar_term_month=None):
    """
    Calculate year pillar (年柱).
    Year changes at Li Chun (立春, ~Feb 3-5).
    solar_term_day, solar_term_month: the exact Li Chun date for that year.
    If not provided, use a lookup table.
    """
    # Base: 1984 is 甲子 year (index 0)
    base_year = 1984

    # Adjust for Li Chun boundary (approximate: Feb 4)
    # If birth is before Feb 4, use previous year
    if solar_term_month and solar_term_day:
        if solar_term_month < 2 or (solar_term_month == 2 and solar_term_day < 4):
            year -= 1
    # Without exact Li Chun date, approximate
    # User should pass adjusted year

    diff = year - base_year
    idx = diff % 60
    if idx < 0:
        idx += 60
    return ganzhi_from_index(idx)


def year_ganzhi_simple(year):
    """Simple year pillar (no Li Chun adjustment)."""
    base_year = 1984  # 甲子
    idx = (year - base_year) % 60
    return ganzhi_from_index(idx)


# ══════════════════════════════════════════════════
#  月柱 — 五虎遁 (以节气为界)
# ══════════════════════════════════════════════════

# Month branch is fixed by solar term (节气)
# 寅月=1 (Start of spring ~Feb 4), 卯月=2, ..., 丑月=12
SOLAR_TERM_MONTHS = {
    # (month_start_day range) → 节气月
    1: '寅', 2: '卯', 3: '辰', 4: '巳', 5: '午', 6: '未',
    7: '申', 8: '酉', 9: '戌', 10: '亥', 11: '子', 12: '丑',
}

# Jie Qi (节气) to month branch mapping (approximate days)
# 立春≈2/4, 惊蛰≈3/6, 清明≈4/5, 立夏≈5/6, 芒种≈6/6,
# 小暑≈7/7, 立秋≈8/7, 白露≈9/8, 寒露≈10/8, 立冬≈11/7,
# 大雪≈12/7, 小寒≈1/6
JIE_QI_DAYS = [
    (1, 6, '丑'),   # 小寒 ~Jan 6
    (2, 4, '寅'),   # 立春 ~Feb 4
    (3, 6, '卯'),   # 惊蛰 ~Mar 6
    (4, 5, '辰'),   # 清明 ~Apr 5
    (5, 6, '巳'),   # 立夏 ~May 6
    (6, 6, '午'),   # 芒种 ~Jun 6
    (7, 7, '未'),   # 小暑 ~Jul 7
    (8, 7, '申'),   # 立秋 ~Aug 7
    (9, 8, '酉'),   # 白露 ~Sep 8
    (10, 8, '戌'),  # 寒露 ~Oct 8
    (11, 7, '亥'),  # 立冬 ~Nov 7
    (12, 7, '子'),  # 大雪 ~Dec 7
]


def month_zhi(month, day):
    """Determine month branch (月支) based on Jie Qi boundary."""
    # Find which Jie Qi bracket this date falls into
    zhi = '丑'  # default for Jan 1-5
    for m, d, z in JIE_QI_DAYS:
        if (month > m) or (month == m and day >= d):
            zhi = z
    return zhi


def month_gan(year_gan, month_zhi):
    """
    Month stem (月干) via 五虎遁 (Five Tiger Escape).
    year_gan: 甲/乙/丙/丁/戊/己/庚/辛/壬/癸
    """
    zhi_order = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
    month_idx = zhi_order.index(month_zhi)

    # Starting gan for 寅月 based on year gan
    start_gan = {
        '甲': '丙', '己': '丙',  # 甲己之年丙作首
        '乙': '戊', '庚': '戊',  # 乙庚之年戊为头
        '丙': '庚', '辛': '庚',  # 丙辛之年庚寅起
        '丁': '壬', '壬': '壬',  # 丁壬之年壬寅始
        '戊': '甲', '癸': '甲',  # 戊癸之年甲寅求
    }[year_gan]

    gan_order = TIAN_GAN[TIAN_GAN.index(start_gan):] + TIAN_GAN[:TIAN_GAN.index(start_gan)]
    return gan_order[month_idx % 10]


def month_ganzhi(year_gan, month, day):
    """Full month pillar (月柱)."""
    mz = month_zhi(month, day)
    mg = month_gan(year_gan, mz)
    return mg, mz


# ══════════════════════════════════════════════════
#  日柱 — 儒略日公式
# ══════════════════════════════════════════════════

def day_ganzhi(year, month, day):
    """
    Calculate day pillar (日柱) using a standard formula.
    Based on known base: 2000-01-01 = 甲子? No — we use a reference.
    Reference: 1900-01-01 = 甲戌 (index 10)
    """
    # Julian Day Number (simplified)
    if month <= 2:
        month += 12
        year -= 1
    a = year // 100
    b = 2 - a + a // 4
    jd = int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + b - 1524

    # Known reference: 2000-01-01 JD 2451545 → find ganzhi
    # Let's use: 1900-01-01 = 甲戌 (index 10) JD 2415020
    ref_jd = 2415021  # JD for 1900-01-01
    ref_idx = 10      # 甲戌
    day_diff = jd - ref_jd
    idx = (ref_idx + day_diff) % 60
    if idx < 0:
        idx += 60
    return ganzhi_from_index(idx)


# ══════════════════════════════════════════════════
#  时柱 — 五鼠遁
# ══════════════════════════════════════════════════

def hour_zhi(hour):
    """Hour → hour branch (时辰). Each 时辰 = 2 hours."""
    # 子时 23:00-01:00, 丑时 01:00-03:00, ...
    zhi_order = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    idx = ((hour + 1) // 2) % 12
    return zhi_order[idx]


def hour_gan(day_gan, hour_zhi):
    """
    Hour stem (时干) via 五鼠遁 (Five Rat Escape).
    day_gan: 甲/乙/.../癸
    """
    zhi_order = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    hour_idx = zhi_order.index(hour_zhi)

    # Starting gan for 子时 based on day gan
    start_gan = {
        '甲': '甲', '己': '甲',  # 甲己还加甲
        '乙': '丙', '庚': '丙',  # 乙庚丙作初
        '丙': '戊', '辛': '戊',  # 丙辛从戊起
        '丁': '庚', '壬': '庚',  # 丁壬庚子居
        '戊': '壬', '癸': '壬',  # 戊癸何方发，壬子是真途
    }[day_gan]

    gan_order = TIAN_GAN[TIAN_GAN.index(start_gan):] + TIAN_GAN[:TIAN_GAN.index(start_gan)]
    return gan_order[hour_idx]


def hour_ganzhi(day_gan, hour):
    """Full hour pillar (时柱)."""
    hz = hour_zhi(hour)
    hg = hour_gan(day_gan, hz)
    return hg, hz


# ══════════════════════════════════════════════════
#  十神 (Ten Gods)
# ══════════════════════════════════════════════════

SHI_SHEN_TABLE = {
    # day_gan → { gan: shishen_name }
    # 同我：比肩/劫财 (same element, yang/yin vs yin/yang)
    # 生我：正印/偏印 (generates me)
    # 我生：食神/伤官 (I generate)
    # 克我：正官/七杀 (controls me)
    # 我克：正财/偏财 (I control)
    '甲': {'甲': '比肩', '乙': '劫财', '丙': '食神', '丁': '伤官',
           '戊': '偏财', '己': '正财', '庚': '七杀', '辛': '正官',
           '壬': '偏印', '癸': '正印'},
    '乙': {'甲': '劫财', '乙': '比肩', '丙': '伤官', '丁': '食神',
           '戊': '正财', '己': '偏财', '庚': '正官', '辛': '七杀',
           '壬': '正印', '癸': '偏印'},
    '丙': {'甲': '偏印', '乙': '正印', '丙': '比肩', '丁': '劫财',
           '戊': '食神', '己': '伤官', '庚': '偏财', '辛': '正财',
           '壬': '七杀', '癸': '正官'},
    '丁': {'甲': '正印', '乙': '偏印', '丙': '劫财', '丁': '比肩',
           '戊': '伤官', '己': '食神', '庚': '正财', '辛': '偏财',
           '壬': '正官', '癸': '七杀'},
    '戊': {'甲': '七杀', '乙': '正官', '丙': '偏印', '丁': '正印',
           '戊': '比肩', '己': '劫财', '庚': '食神', '辛': '伤官',
           '壬': '偏财', '癸': '正财'},
    '己': {'甲': '正官', '乙': '七杀', '丙': '正印', '丁': '偏印',
           '戊': '劫财', '己': '比肩', '庚': '伤官', '辛': '食神',
           '壬': '正财', '癸': '偏财'},
    '庚': {'甲': '偏财', '乙': '正财', '丙': '七杀', '丁': '正官',
           '戊': '偏印', '己': '正印', '庚': '比肩', '辛': '劫财',
           '壬': '食神', '癸': '伤官'},
    '辛': {'甲': '正财', '乙': '偏财', '丙': '正官', '丁': '七杀',
           '戊': '正印', '己': '偏印', '庚': '劫财', '辛': '比肩',
           '壬': '伤官', '癸': '食神'},
    '壬': {'甲': '食神', '乙': '伤官', '丙': '偏财', '丁': '正财',
           '戊': '七杀', '己': '正官', '庚': '偏印', '辛': '正印',
           '壬': '比肩', '癸': '劫财'},
    '癸': {'甲': '伤官', '乙': '食神', '丙': '正财', '丁': '偏财',
           '戊': '正官', '己': '七杀', '庚': '正印', '辛': '偏印',
           '壬': '劫财', '癸': '比肩'},
}


def shi_shen(day_gan, other_gan):
    """Get 十神 name for other_gan relative to day_gan."""
    return SHI_SHEN_TABLE.get(day_gan, {}).get(other_gan, '?')


# ══════════════════════════════════════════════════
#  纳音
# ══════════════════════════════════════════════════

def nayin(gan, zhi):
    """Get 纳音 for a Gan-Zhi pair."""
    idx = ganzhi_index(gan, zhi)
    if idx < 0:
        return ''
    return NAYIN[idx // 2]  # Each nayin covers 2 consecutive pairs


# ══════════════════════════════════════════════════
#  综合排盘
# ══════════════════════════════════════════════════

def full_pillars(year, month, day, hour):
    """
    Calculate all four pillars.
    Returns dict with keys: year, month, day, hour
    Each value: {gan, zhi, gan_wuxing, gan_yinyang, zhi_wuxing, zhi_canggan, shishen?, nayin}
    """
    # Year
    y_gan, y_zhi = year_ganzhi_simple(year)
    y_wx = GAN_WUXING[y_gan]
    y_yy = GAN_YINYANG[y_gan]
    y_zhi_wx = ZHI_WUXING[y_zhi]
    y_nayin = nayin(y_gan, y_zhi)

    # Month
    m_zhi = month_zhi(month, day)
    m_gan = month_gan(y_gan, m_zhi)
    m_wx = GAN_WUXING[m_gan]
    m_zhi_wx = ZHI_WUXING[m_zhi]
    m_nayin = nayin(m_gan, m_zhi)

    # Day
    d_gan, d_zhi = day_ganzhi(year, month, day)
    d_wx = GAN_WUXING[d_gan]
    d_yy = GAN_YINYANG[d_gan]
    d_zhi_wx = ZHI_WUXING[d_zhi]
    d_nayin = nayin(d_gan, d_zhi)

    # Hour
    h_zhi = hour_zhi(hour)
    h_gan = hour_gan(d_gan, h_zhi)
    h_wx = GAN_WUXING[h_gan]
    h_zhi_wx = ZHI_WUXING[h_zhi]
    h_nayin = nayin(h_gan, h_zhi)

    # Shi Shen (relative to day gan)
    y_ss = shi_shen(d_gan, y_gan)
    m_ss = shi_shen(d_gan, m_gan)
    h_ss = shi_shen(d_gan, h_gan)

    pillars = {
        'year': {
            'gan': y_gan, 'zhi': y_zhi,
            'gan_wuxing': y_wx, 'gan_yinyang': y_yy,
            'zhi_wuxing': y_zhi_wx, 'zhi_canggan': ZHI_CANGGAN.get(y_zhi, []),
            'shishen': y_ss, 'nayin': y_nayin,
            'full': f'{y_gan}{y_zhi}',
        },
        'month': {
            'gan': m_gan, 'zhi': m_zhi,
            'gan_wuxing': m_wx,
            'zhi_wuxing': m_zhi_wx, 'zhi_canggan': ZHI_CANGGAN.get(m_zhi, []),
            'shishen': m_ss, 'nayin': m_nayin,
            'full': f'{m_gan}{m_zhi}',
        },
        'day': {
            'gan': d_gan, 'zhi': d_zhi,
            'gan_wuxing': d_wx, 'gan_yinyang': d_yy,
            'zhi_wuxing': d_zhi_wx, 'zhi_canggan': ZHI_CANGGAN.get(d_zhi, []),
            'shishen': '日主', 'nayin': d_nayin,
            'full': f'{d_gan}{d_zhi}',
        },
        'hour': {
            'gan': h_gan, 'zhi': h_zhi,
            'gan_wuxing': h_wx,
            'zhi_wuxing': h_zhi_wx, 'zhi_canggan': ZHI_CANGGAN.get(h_zhi, []),
            'shishen': h_ss, 'nayin': h_nayin,
            'full': f'{h_gan}{h_zhi}',
        },
    }

    # Count wuxing
    wuxing_count = {'木': 0, '火': 0, '土': 0, '金': 0, '水': 0}
    for p in pillars.values():
        wuxing_count[p['gan_wuxing']] += 1
        wuxing_count[p['zhi_wuxing']] += 1
    pillars['wuxing_count'] = wuxing_count
    pillars['day_master'] = d_gan  # 日主

    return pillars
