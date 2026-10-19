import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('../src/audio', () => ({ audio: { unlock: () => {}, play: () => {} } }))
const loc = { pathname: '/', search: '', hash: '' }
vi.stubGlobal('window', { location: loc })
vi.stubGlobal('history', { replaceState: (_: unknown, __: string, url: string) => (loc.hash = url.slice(url.indexOf('#') >= 0 ? url.indexOf('#') : url.length)) })
const { getUI, setUI } = await import('../src/store')
const { closePanel, openPanel } = await import('../src/nav')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const overlay = readFileSync(new URL('../src/Overlay.tsx', import.meta.url), 'utf8')
const rule = (sel: string) => {
  const i = css.indexOf(`\n${sel} {`)
  expect(i, sel).toBeGreaterThan(-1)
  return css.slice(i + sel.length + 3, css.indexOf('}', i))
}
const z = (sel: string) => Number(rule(sel).match(/z-index:\s*(\d+)/)![1])

describe('desktop: a station panel opens over the docked chat', () => {
  it('the panel sits in the chat column, above the chat', () => {
    expect(rule('.chat-docked .panel')).toMatch(/left: auto; right: 24px; top: 24px; bottom: 24px; width: clamp\(380px, 32vw, 520px\)/)
    expect(z('.chat-docked .panel')).toBeGreaterThan(z('.chat'))
  })
  it('the HUD moves left of the chat, the close × and backdrop give way to Back', () => {
    expect(rule('.chat-docked .hud')).toMatch(/right: calc\(var\(--chat-w\) \+ 12px\)/)
    expect(rule('.chat-docked .panel .panel-close')).toMatch(/display: none/)
    expect(rule('.chat-docked .backdrop')).toMatch(/display: none/)
    expect(rule('.panel-back')).toMatch(/display: none/)
    expect(rule('.chat-docked .panel .panel-back')).toMatch(/display: inline-flex/)
    expect(css).toMatch(/\.chat-docked \.hint,\n\.chat-docked \.toast \{ right: var\(--chat-w\); \}/)
  })
  it('the chat column hugs its content and scrolls past the viewport', () => {
    const r = rule('.chat.docked')
    expect(r).toMatch(/bottom: auto;/)
    expect(r).toMatch(/height: auto;/)
    expect(r).toMatch(/max-height: calc\(100dvh - 48px\);/)
    expect(css).toMatch(/\n\.chat-scroll \{\n[^}]*min-height: 0;[^}]*overflow-y: auto;/)
  })
  it('Back and Esc close the panel and leave the chat open', () => {
    setUI({ entered: true, stage: 'ready', chatOpen: true, open: null })
    openPanel({ id: 'stop-5' })
    expect(getUI()).toMatchObject({ open: { id: 'stop-5' }, chatOpen: true })
    closePanel()
    expect(getUI()).toMatchObject({ open: null, chatOpen: true })
    // Back is closePanel; Esc closes the open panel first and only collapses the chat when no panel is open.
    expect(overlay).toMatch(/className="panel-back" onClick=\{closePanel\}/)
    expect(overlay).toMatch(/if \(e\.key === 'Escape'\) \{\s*if \(s\.open\) \{\s*closePanel\(\)/)
  })
})
