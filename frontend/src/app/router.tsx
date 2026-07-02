import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import HomePage from '@/pages/HomePage'
import ProjectsPage from '@/pages/ProjectsPage'
import NotFound from '@/pages/NotFound'

const FortunePage = lazy(() => import('@/features/fortune/FortunePage'))
const MbtiPage = lazy(() => import('@/features/mbti/MbtiPage'))
const DailyPage = lazy(() => import('@/features/daily/DailyPage'))
const FactorizePage = lazy(() => import('@/features/factorize/FactorizePage'))
const KnowledgeBasePage = lazy(() => import('@/features/knowledge/KnowledgeBasePage'))
const MdRenderPage = lazy(() => import('@/features/mdrender/MdRenderPage'))
const SharePage = lazy(() => import('@/features/mdrender/SharePage'))
const ProblemsPage = lazy(() => import('@/features/problems/ProblemsPage'))
const ProblemDetailPage = lazy(() => import('@/features/problems/ProblemDetailPage'))
const PolyominoPage = lazy(() => import('@/features/polyomino/PolyominoPage'))
const PolycubePage = lazy(() => import('@/features/polycube/PolycubePage'))
const AffinePage = lazy(() => import('@/features/affine/AffinePage'))
const InversionPage = lazy(() => import('@/features/inversion/InversionPage'))
const ChessPage = lazy(() => import('@/features/chess/ChessPage'))
const XiangqiPage = lazy(() => import('@/features/xiangqi/XiangqiPage'))
const DarkRoomPage = lazy(() => import('@/features/darkroom/DarkRoomPage'))

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="fortune" element={<FortunePage />} />
        <Route path="mbti" element={<MbtiPage />} />
        <Route path="daily" element={<DailyPage />} />
        <Route path="factorize" element={<FactorizePage />} />
        <Route path="knowledge/:kb" element={<KnowledgeBasePage />} />
        <Route path="mdrender" element={<MdRenderPage />} />
        <Route path="share/:id" element={<SharePage />} />
        <Route path="problems" element={<ProblemsPage />} />
        <Route path="problems/:id" element={<ProblemDetailPage />} />
        <Route path="polyomino" element={<PolyominoPage />} />
        <Route path="polycube" element={<PolycubePage />} />
        <Route path="affine" element={<AffinePage />} />
        <Route path="inversion" element={<InversionPage />} />
        <Route path="chess" element={<ChessPage />} />
        <Route path="xiangqi" element={<XiangqiPage />} />
        <Route path="darkroom" element={<DarkRoomPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
