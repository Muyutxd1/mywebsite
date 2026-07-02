import { Route, Routes } from 'react-router-dom'
import ProblemsHomePage from './pages/ProblemsHomePage'
import SearchPage from './pages/SearchPage'
import CompetitionPage from './pages/CompetitionPage'
import FavoritesPage from './pages/FavoritesPage'
import PracticeHomePage from './pages/PracticeHomePage'
import PracticeRunPage from './pages/PracticeRunPage'
import ProblemDetailPage from './pages/ProblemDetailPage'

/**
 * The problems feature owns everything under /problems/*. Static segments
 * (search/favorites/practice/c) outrank the :id catch-all, and the old
 * /problems/:id deep links keep working unchanged.
 */
export default function ProblemsRoutes() {
  return (
    <Routes>
      <Route index element={<ProblemsHomePage />} />
      <Route path="search" element={<SearchPage />} />
      <Route path="c/:compKey" element={<CompetitionPage />} />
      <Route path="favorites" element={<FavoritesPage />} />
      <Route path="practice" element={<PracticeHomePage />} />
      <Route path="practice/run" element={<PracticeRunPage />} />
      <Route path=":id" element={<ProblemDetailPage />} />
    </Routes>
  )
}
