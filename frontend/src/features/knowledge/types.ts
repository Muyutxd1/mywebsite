export interface KbEntry {
  id: number
  title: string
  statement?: string
  formula?: string
  detail?: string
  tags?: string[]
}

export interface KbChapter {
  num: number
  title: string
  entries: KbEntry[]
}

export interface KnowledgeBase {
  kb: string
  title: string
  subtitle: string
  description?: string
  chapters: KbChapter[]
}

/** Entry decorated with its parent chapter info, for flat search. */
export interface FlatEntry extends KbEntry {
  _chapterNum: number
  _chapterTitle: string
}
