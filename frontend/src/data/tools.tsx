import type { JSX } from 'react'
import type { BadgeTone } from '@/components/ui/Badge'

export interface Tool {
  slug: string
  path: string
  titleZh: string
  titleEn?: string
  description: string
  cta: string
  Icon: (p: { className?: string }) => JSX.Element
  tone?: BadgeTone
}

export interface ProjectExtra {
  title: string
  description: string
  techStack: string
  href?: string
  desktopOnly?: boolean
  cta?: string
}

const S = (p: { className?: string }, children: JSX.Element) => (
  <svg
    className={p.className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
)

export const icons = {
  fortune: (p: { className?: string }) =>
    S(p, <polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" />),
  mbti: (p: { className?: string }) =>
    S(
      p,
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </>,
    ),
  daily: (p: { className?: string }) =>
    S(
      p,
      <>
        <path d="M8 6c0-1.1.9-2 2-2h4a2 2 0 012 2v1h2a1 1 0 011 1v11a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1h2V6z" />
        <rect x="9" y="10" width="6" height="5" rx="0.5" />
      </>,
    ),
  polyomino: (p: { className?: string }) =>
    S(
      p,
      <>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
        <rect x="13" y="13" width="8" height="8" rx="1" />
      </>,
    ),
  polycube: (p: { className?: string }) =>
    S(
      p,
      <>
        <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
        <path d="M12 11l8-4.5M12 11v9M4 6.5l8 4.5" />
      </>,
    ),
  factorize: (p: { className?: string }) =>
    S(
      p,
      <>
        <path d="M5 17L19 7M5 7h4v4M19 17h-4v-4" />
        <circle cx="12" cy="12" r="9" />
      </>,
    ),
  affine: (p: { className?: string }) =>
    S(
      p,
      <>
        <polygon points="12,3 20,9 17,21 7,21 4,9" />
        <line x1="12" y1="3" x2="12" y2="12" />
        <line x1="7" y1="21" x2="17" y2="21" />
      </>,
    ),
  inversion: (p: { className?: string }) =>
    S(
      p,
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2" />
        <line x1="12" y1="12" x2="18" y2="6" />
        <circle cx="18" cy="6" r="1.5" />
      </>,
    ),
  mdrender: (p: { className?: string }) =>
    S(
      p,
      <>
        <path d="M15.5 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V6.5L15.5 3z" />
        <path d="M15 3v4h4" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="16" x2="13" y2="16" />
      </>,
    ),
  problems: (p: { className?: string }) =>
    S(
      p,
      <>
        <path d="M6 9l-2 2 2 2M18 9l2 2-2 2" />
        <circle cx="12" cy="12" r="9" />
        <line x1="9" y1="15" x2="15" y2="9" />
      </>,
    ),
  combinatorics: (p: { className?: string }) =>
    S(
      p,
      <>
        <circle cx="12" cy="5" r="2" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
        <line x1="12" y1="7" x2="7.5" y2="17.5" />
        <line x1="12" y1="7" x2="16.5" y2="17.5" />
        <line x1="7.5" y1="18" x2="16" y2="18" />
      </>,
    ),
  numberTheory: (p: { className?: string }) =>
    S(
      p,
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="14" y2="14" />
        <line x1="8" y1="6" x2="10" y2="6" />
      </>,
    ),
  chess: (p: { className?: string }) =>
    S(
      p,
      <>
        <path d="M8 16l-2 5h12l-2-5" />
        <path d="M10 8c0-1 .5-2 2-2s2 1 2 2c0 2-1 3-2 4-1-1-2-2-2-4z" />
        <circle cx="12" cy="5" r="1.5" />
        <line x1="7" y1="12" x2="17" y2="12" />
      </>,
    ),
  xiangqi: (p: { className?: string }) =>
    S(
      p,
      <>
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <line x1="3" y1="11" x2="21" y2="11" />
        <line x1="3" y1="13" x2="21" y2="13" />
        <circle cx="8" cy="7.5" r="2" />
        <circle cx="16" cy="16.5" r="2" />
      </>,
    ),
  darkroom: (p: { className?: string }) =>
    S(
      p,
      <>
        <path d="M12 3c1.5 3-2.5 4.5-1 8 .8 1.8 2.6 2 3.5.5.6 1 .9 2 .9 3a5.4 5.4 0 01-10.8 0c0-4.5 4.9-6.5 7.4-11.5z" />
        <line x1="4" y1="21" x2="20" y2="21" />
      </>,
    ),
}

export const tools: Tool[] = [
  {
    slug: 'fortune',
    path: '/fortune',
    titleZh: '灵占',
    titleEn: 'Fortunetelling',
    description: '梅花易数 / 八字 / 紫微斗数 / 易经 / 塔罗 / 占星 — 六大玄学体系在线占卜',
    cta: '立即体验',
    Icon: icons.fortune,
    tone: 'gold',
  },
  {
    slug: 'problems',
    path: '/problems',
    titleZh: '奥赛习题集',
    titleEn: 'Olympiad',
    description: 'MathNet 开源题库 · IMO / 中国 / 美国 等 18 个赛事体系 11433 题 · 中英对照 · 刷题练习 · 难度分级',
    cta: '开始刷题',
    Icon: icons.problems,
    tone: 'accent',
  },
  {
    slug: 'mdrender',
    path: '/mdrender',
    titleZh: 'Markdown + LaTeX',
    titleEn: 'Writing',
    description: '实时预览 · 公式渲染 · 一键导出与分享',
    cta: '开始写作',
    Icon: icons.mdrender,
    tone: 'cyan',
  },
  {
    slug: 'combinatorics',
    path: '/knowledge/combinatorics',
    titleZh: '组合数学知识库',
    description: '竞赛组合完整体系 · 定理与方法总目录',
    cta: '开始学习',
    Icon: icons.combinatorics,
    tone: 'accent',
  },
  {
    slug: 'number-theory',
    path: '/knowledge/number-theory',
    titleZh: '初等数论知识库',
    description: '竞赛数论完整覆盖 · 定理与方法总目录',
    cta: '开始学习',
    Icon: icons.numberTheory,
    tone: 'accent',
  },
  {
    slug: 'mbti',
    path: '/mbti',
    titleZh: 'MBTI 性格测试',
    description: '48 题深度测试 · 16 型人格详细解读',
    cta: '开始测试',
    Icon: icons.mbti,
    tone: 'cyan',
  },
  {
    slug: 'daily',
    path: '/daily',
    titleZh: '每日一句',
    description: '歌词 · 电影 · 文学 · 251 条精选金句',
    cta: '今日金句',
    Icon: icons.daily,
    tone: 'gold',
  },
  {
    slug: 'factorize',
    path: '/factorize',
    titleZh: '因式分解',
    description: '多项式因式分解 · 逐步推导 · 十字相乘法',
    cta: '开始计算',
    Icon: icons.factorize,
    tone: 'accent',
  },
  {
    slug: 'affine',
    path: '/affine',
    titleZh: '仿射变换',
    description: '射影几何 · 坐标变换 · 交互可视化',
    cta: '开始探索',
    Icon: icons.affine,
    tone: 'cyan',
  },
  {
    slug: 'inversion',
    path: '/inversion',
    titleZh: '反演操作台',
    description: '圆反演变换 · 几何可视化 · 交互探索',
    cta: '开始探索',
    Icon: icons.inversion,
    tone: 'cyan',
  },
  {
    slug: 'polyomino',
    path: '/polyomino',
    titleZh: 'Polyomino 拼图',
    description: '自定义拼图形状 · N×N 棋盘铺砌 · 竞赛辅助',
    cta: '开始拼图',
    Icon: icons.polyomino,
    tone: 'accent',
  },
  {
    slug: 'polycube',
    path: '/polycube',
    titleZh: '3D Polycube 拼图',
    description: '三维立方体积木 · 24 种旋转 · 立体铺砌',
    cta: '进入 3D',
    Icon: icons.polycube,
    tone: 'accent',
  },
  {
    slug: 'chess',
    path: '/chess',
    titleZh: '国际象棋',
    description: '拖拽走子 · Stockfish 引擎 · FEN/PGN',
    cta: '开始对局',
    Icon: icons.chess,
    tone: 'neutral',
  },
  {
    slug: 'xiangqi',
    path: '/xiangqi',
    titleZh: '中国象棋',
    description: '楚河汉界 · 人机对弈 · 中文记谱',
    cta: '开始对局',
    Icon: icons.xiangqi,
    tone: 'gold',
  },
  {
    slug: 'darkroom',
    path: '/darkroom',
    titleZh: '小黑屋',
    titleEn: 'A Dark Room',
    description: '经典极简文字冒险 · 生火 → 村庄 → 世界 · 官方中文',
    cta: '生火',
    Icon: icons.darkroom,
    tone: 'neutral',
  },
]

export const toolsBySlug = Object.fromEntries(tools.map((t) => [t.slug, t]))

/** Top-nav links (a curated subset + a scroll-to-all-tools entry). */
export const navLinks: { label: string; to: string }[] = [
  { label: '首页', to: '/' },
  { label: '灵占', to: '/fortune' },
  { label: '题库', to: '/problems' },
  { label: '写作', to: '/mdrender' },
  { label: '拼图', to: '/polyomino' },
  { label: '知识库', to: '/knowledge/combinatorics' },
]

/** Extra non-tool entries shown only on the /projects page (incl. desktop apps). */
export const projectExtras: ProjectExtra[] = [
  {
    title: 'NCM 转 FLAC',
    description: '网易云 .ncm 加密音频批量解密为无损 FLAC / MP3，保留封面与标签。',
    techStack: 'Python · 桌面工具',
    desktopOnly: true,
  },
  {
    title: '音频标题重命名',
    description: '读取音频元数据，按「歌手 - 标题」批量规整文件名。',
    techStack: 'Python · 桌面工具',
    desktopOnly: true,
  },
]
