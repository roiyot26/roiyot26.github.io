import { useEffect } from 'react'
import raw from './content/content.json'
import { content } from './content'
import { plainPage } from './content/static'

/**
 * Plain HTML version (?view=list, and the automatic fallback when WebGL is missing or fails).
 * Same template as the <noscript> copy (src/content/static.ts), so the two never drift.
 */
export function ListView({ webglOk, fallback }: { webglOk: boolean; fallback: boolean; phone?: boolean }) {
  useEffect(() => {
    document.title = content.site.title
  }, [])
  return <main className="list" dangerouslySetInnerHTML={{ __html: plainPage(raw, { base: import.meta.env.BASE_URL, webglOk, fallback }) }} />
}
