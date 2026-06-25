/** Response shapes for the Markdown share API (see backend/api/mdrender.py). */

export interface ShareCreateResponse {
  share_id: string
  /** Public relative url, e.g. "/share/ab12cd34". */
  url: string
  created_at: string
}

export interface ShareGetResponse {
  id: string
  content: string
  created_at: string
}
