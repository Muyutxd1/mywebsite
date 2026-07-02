import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ProblemLang = 'zh' | 'en'

interface PrefsState {
  lang: ProblemLang
  setLang: (lang: ProblemLang) => void
}

/** Global display-language preference (statement/solution zh vs original). */
export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      lang: 'zh',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'mysite.problems.prefs.v1' },
  ),
)

export const useLang = () => usePrefsStore((s) => s.lang)
export const useSetLang = () => usePrefsStore((s) => s.setLang)
