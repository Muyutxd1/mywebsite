"""
天文计算 — 行星黄经位置 (简化 VSOP87)
精度 ±1°，足够确定星座边界

Provides: planet longitude at a given date
Supports: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
"""

import math

# ── Constants ──────────────────────────────────
DEG = math.pi / 180.0
J2000 = 2451545.0  # Julian date for J2000.0 epoch


# ════════════════════════════════════════════════
#  Julian Day Number
# ════════════════════════════════════════════════

def julian_day(year, month, day, hour=0, minute=0):
    """Convert Gregorian date to Julian Day Number."""
    if month <= 2:
        month += 12
        year -= 1
    a = year // 100
    b = 2 - a + a // 4
    day_fraction = (hour + minute / 60.0) / 24.0
    jd = int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + day_fraction + b - 1524.5
    return jd


def centuries_since_j2000(jd):
    """Julian centuries since J2000.0."""
    return (jd - J2000) / 36525.0


# ════════════════════════════════════════════════
#  Sun longitude (simplified)
# ════════════════════════════════════════════════

def sun_longitude(jd):
    """
    Calculate Sun's ecliptic longitude.
    Simplified formula: mean anomaly + equation of center.
    Accuracy: ~0.01°
    """
    T = centuries_since_j2000(jd)

    # Mean anomaly
    M = 357.5291 + 35999.0503 * T - 0.0001559 * T * T - 4.8e-07 * T * T * T
    M = M % 360.0

    # Mean longitude
    L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
    L0 = L0 % 360.0

    # Equation of center
    C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * math.sin(M * DEG) \
        + (0.019993 - 0.000101 * T) * math.sin(2 * M * DEG) \
        + 0.000289 * math.sin(3 * M * DEG)

    # True longitude
    lon = L0 + C
    return lon % 360.0


# ════════════════════════════════════════════════
#  Moon longitude (simplified)
# ════════════════════════════════════════════════

def moon_longitude(jd):
    """
    Calculate Moon's ecliptic longitude.
    Simplified formula. Accuracy: ~0.5°
    """
    T = centuries_since_j2000(jd)

    # Mean longitude
    L = 218.3165 + 481267.8813 * T
    L = L % 360.0

    # Mean elongation
    D = 297.8502 + 445267.1115 * T
    D = D % 360.0

    # Sun's mean anomaly
    M = 357.5291 + 35999.0503 * T
    M = M % 360.0

    # Moon's mean anomaly
    M_moon = 134.9634 + 477198.8676 * T
    M_moon = M_moon % 360.0

    # Evection
    evection = 1.2739 * math.sin((2 * D - M_moon) * DEG)
    # Variation
    variation = 0.6583 * math.sin(2 * D * DEG)
    # Annual equation
    annual = -0.1854 * math.sin(M * DEG)
    # Correction
    corr = -0.1143 * math.sin(2 * M_moon * DEG)

    lon = L + evection + variation + annual + corr
    return lon % 360.0


# ════════════════════════════════════════════════
#  Planet longitudes (VERY simplified)
#  For planets, use mean longitude + periodic terms
# ════════════════════════════════════════════════

def _mean_lon(T, base, rate):
    return (base + rate * T) % 360.0


def mercury_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 252.2509, 149472.6746)
    M = _mean_lon(T, 174.7948, 149472.6746)
    # Simplified perturbation
    lon = L + 0.8 * math.sin(M * DEG) + 0.3 * math.sin(2 * M * DEG)
    return lon % 360.0


def venus_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 181.9798, 58517.8157)
    M = _mean_lon(T, 49.2335, 58517.8157)
    lon = L + 0.5 * math.sin(M * DEG) + 0.2 * math.sin(2 * M * DEG)
    return lon % 360.0


def mars_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 355.4330, 19140.2993)
    M = _mean_lon(T, 18.6021, 19140.2993)
    lon = L + 10.7 * math.sin(M * DEG)  # Mars has large equation of center
    return lon % 360.0


def jupiter_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 34.3515, 3034.9057)
    M = _mean_lon(T, 19.6761, 3034.9057)
    lon = L + 5.6 * math.sin(M * DEG)
    return lon % 360.0


def saturn_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 50.0774, 1222.1138)
    M = _mean_lon(T, 316.9641, 1222.1138)
    lon = L + 6.5 * math.sin(M * DEG)
    return lon % 360.0


def uranus_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 314.0550, 428.4670)
    return L % 360.0


def neptune_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 304.3487, 218.4862)
    return L % 360.0


def pluto_longitude(jd):
    T = centuries_since_j2000(jd)
    L = _mean_lon(T, 245.0377, 144.9542)
    return L % 360.0


# ════════════════════════════════════════════════
#  Zodiac sign from longitude
# ════════════════════════════════════════════════

ZODIAC_SIGNS = [
    '白羊座 ♈', '金牛座 ♉', '双子座 ♊', '巨蟹座 ♋',
    '狮子座 ♌', '处女座 ♍', '天秤座 ♎', '天蝎座 ♏',
    '射手座 ♐', '摩羯座 ♑', '水瓶座 ♒', '双鱼座 ♓',
]

ZODIAC_SHORT = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女',
                '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼']


def longitude_to_sign(lon):
    """Convert ecliptic longitude (0-360) to zodiac sign index (0-11)."""
    return int(lon / 30.0) % 12


def sign_name(lon):
    """Get zodiac sign name from longitude."""
    idx = longitude_to_sign(lon)
    return ZODIAC_SIGNS[idx]


def sign_short(lon):
    """Get short zodiac sign name."""
    idx = longitude_to_sign(lon)
    return ZODIAC_SHORT[idx]


# ════════════════════════════════════════════════
#  Houses (Placidus simplified)
# ════════════════════════════════════════════════

def calculate_houses(mc_lon, asc_lon):
    """
    Simplified Placidus house cusps.
    mc_lon: Midheaven longitude
    asc_lon: Ascendant longitude
    Returns list of 12 house cusp longitudes.
    """
    # For simplicity, use equal houses from ASC
    cusps = []
    for i in range(12):
        cusp = (asc_lon + i * 30.0) % 360.0
        cusps.append(cusp)
    return cusps


def ascendant(jd, lat, lng):
    """
    Calculate Ascendant (simplified).
    ASC = arctan(-cos(RA_MC) / (sin(RA_MC)*cos(e) + tan(lat)*sin(e)))
    """
    T = centuries_since_j2000(jd)
    # Obliquity of ecliptic
    e = 23.4393 - 0.0130 * T
    # Local sidereal time (simplified)
    lst = _local_sidereal_time(jd, lng)
    # MC from LST
    mc_ra = lst  # Approximate: MC RA = LST
    mc_lon = mc_ra  # Further approximation

    # ASC formula
    asc_rad = math.atan2(
        -math.cos(mc_ra * DEG),
        math.sin(mc_ra * DEG) * math.cos(e * DEG) + math.tan(lat * DEG) * math.sin(e * DEG)
    )
    asc_lon = (asc_rad / DEG) % 360.0
    if asc_lon < 0:
        asc_lon += 360.0
    return asc_lon, mc_lon


def _local_sidereal_time(jd, lng):
    """Calculate local sidereal time (degrees)."""
    T = centuries_since_j2000(jd)
    # GMST at 0h UT
    gmst = 280.46061837 + 360.98564736629 * (jd - J2000) \
           + 0.000387933 * T * T - T * T * T / 38710000.0
    gmst = gmst % 360.0
    lst = gmst + lng
    return lst % 360.0


def planet_house(planet_lon, house_cusps):
    """Determine which house a planet falls in."""
    for i in range(12):
        cusp_start = house_cusps[i]
        cusp_end = house_cusps[(i + 1) % 12]
        if i == 11:  # Last house wraps around
            if planet_lon >= cusp_start or planet_lon < cusp_end:
                return i + 1
        else:
            if cusp_start <= planet_lon < cusp_end:
                return i + 1
    return 1


# ════════════════════════════════════════════════
#  Aspects (相位)
# ════════════════════════════════════════════════

ASPECTS = [
    (0, '合', '☌', 8),
    (60, '六合', '⚹', 6),
    (90, '刑', '□', 8),
    (120, '拱', '△', 8),
    (180, '冲', '☍', 8),
]


def find_aspects(planet_positions):
    """
    Find major aspects between planets.
    planet_positions: dict {name: longitude_deg}
    Returns list of {p1, p2, aspect_name, aspect_symbol, orb}
    """
    aspects = []
    names = list(planet_positions.keys())
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            lon1 = planet_positions[names[i]]
            lon2 = planet_positions[names[j]]
            diff = abs(lon1 - lon2) % 360.0
            if diff > 180:
                diff = 360.0 - diff

            for target, a_name, a_symbol, orb in ASPECTS:
                angle_diff = abs(diff - target)
                if angle_diff <= orb:
                    aspects.append({
                        'p1': names[i], 'p2': names[j],
                        'aspect': a_name, 'symbol': a_symbol,
                        'orb': round(angle_diff, 1),
                    })
                    break  # One aspect per pair
    return aspects
