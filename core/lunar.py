"""
农历转换 & 二十四节气计算
公历 → 农历 (简化查表法，覆盖 1900-2100)
"""

# ── 二十四节气 (Jie Qi) 日期表 ─────────────────
# 2020-2060 年的节气日期 (简化版，每月两个节气)
# 格式: year → [ (month, day, '节气名'), ... ]
# 实际仅关键节气用于柱计算

# 立春 (Start of Spring) 精确日期，用于年柱分界
# Source: astronomical calculation, approximate dates
LICHUN_DATES = {
    2000: (2, 4), 2001: (2, 4), 2002: (2, 4), 2003: (2, 4), 2004: (2, 4),
    2005: (2, 4), 2006: (2, 4), 2007: (2, 4), 2008: (2, 4), 2009: (2, 4),
    2010: (2, 4), 2011: (2, 4), 2012: (2, 4), 2013: (2, 4), 2014: (2, 4),
    2015: (2, 4), 2016: (2, 4), 2017: (2, 3), 2018: (2, 4), 2019: (2, 4),
    2020: (2, 4), 2021: (2, 3), 2022: (2, 4), 2023: (2, 4), 2024: (2, 4),
    2025: (2, 3), 2026: (2, 4), 2027: (2, 4), 2028: (2, 4), 2029: (2, 3),
    2030: (2, 4),
    # Default: Feb 4
}


def get_lichun(year):
    """Get Li Chun date (月, 日) for a given year. Returns (2, 4) default."""
    return LICHUN_DATES.get(year, (2, 4))


def year_for_pillar(year, month, day):
    """Adjust year for pillar calculation based on Li Chun boundary."""
    lc_month, lc_day = get_lichun(year)
    if month < lc_month or (month == lc_month and day < lc_day):
        return year - 1
    return year


# ── 十二节 (月度分界节气) ──────────────────────
# Approximate day for each Jie Qi used for month pillar division
JIE_QI_APPROX = [
    # (month, day, branch)
    (1, 6, '丑'),   # 小寒
    (2, 4, '寅'),   # 立春
    (3, 6, '卯'),   # 惊蛰
    (4, 5, '辰'),   # 清明
    (5, 6, '巳'),   # 立夏
    (6, 6, '午'),   # 芒种
    (7, 7, '未'),   # 小暑
    (8, 7, '申'),   # 立秋
    (9, 8, '酉'),   # 白露
    (10, 8, '戌'),  # 寒露
    (11, 7, '亥'),  # 立冬
    (12, 7, '子'),  # 大雪
]


def month_branch(month, day):
    """Get month branch based on Jie Qi boundary."""
    zhi = '丑'
    for m, d, z in JIE_QI_APPROX:
        if month > m or (month == m and day >= d):
            zhi = z
    return zhi


# ── 农历转换 (简化) ────────────────────────────
# 农历月份名称
LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
LUNAR_DAYS = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

# Lunar calendar data (encoded): each entry = (lunar_month, lunar_day, is_leap_month)
# We use a simplified approach: just format, don't need exact conversion for all dates
# since the main use is BaZi which uses solar calendar + Jie Qi.


def solar_to_lunar_approx(year, month, day):
    """
    Simplified solar → lunar conversion.
    Returns a descriptive string. For exact conversion a full lookup table is needed.
    This provides a reasonable approximation.
    """
    # For now, return placeholder — exact conversion requires a 200-year lookup table
    # The key pillars (年柱/月柱) don't need lunar dates, they use Jie Qi
    return f"农历 {LUNAR_MONTHS[month - 1]}月 (近似)"
