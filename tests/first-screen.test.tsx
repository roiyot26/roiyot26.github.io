import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { content } from '../src/content'

vi.mock('../src/actions', () => ({ setLights: () => {}, setRain: () => {}, startAgentic: () => {} }))
vi.mock('../src/audio', () => ({ audio: { unlock: () => {} } }))
vi.mock('../src/targets', () => ({ TARGET_DEFS: [], targetByKey: () => undefined }))
const { cardFor, placeReply } = await import('../src/duck/run')
const { setUI } = await import('../src/store')
const { Loader } = await import('../src/Loader')
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

describe("first screen and What's here", () => {
  it('first screen copy', () => {
    expect(content.hero.headline).toBe("Roi Yotvat's portfolio")
    expect(content.hero.sub).toBe('Full-stack developer, AI-driven development. This 3D room is a personal project.')
    expect(content.hero.enter).toBe('Enter the room')
    expect(content.hero.enterHint).toBe('Turns on sound')
    expect(content.site.resume).toBe('Quick version (1 page)')
  })
  it("What's here lists the eight objects in label priority order, with no count or score", () => {
    expect(content.guide.rows.map((r) => r.label)).toEqual(['Ask the duck', 'Projects', '3D for the web', 'Stack', 'Contact', 'Career', 'Virtual Garden', 'Now building'])
    expect(JSON.stringify(content.guide)).not.toMatch(/\d+\s*\/\s*\d+|score|progress|found/i)
    expect(content.guide.alsoItems).toHaveLength(4)
  })
  it('the menu label has no "features" word', () => expect(content.site.more).not.toMatch(/feature/i))
})

describe('station cards', () => {
  it('use the object label, not the panel headline', () => {
    expect(cardFor({ id: 'stop-1' })?.title).toBe('Projects')
    expect(cardFor({ id: 'stop-2' })?.title).toBe('3D for the web')
    expect(cardFor({ id: 'stop-3', skill: 'claude-code' })?.title).toBe('Stack')
    expect(cardFor({ id: 'stop-1', project: content.projects[0].slug })?.title).toBe(content.projects[0].name)
  })
  it('"What does Roi do?" points at Projects', () => {
    const a = content.duck.intents.find((i) => i.id === 'hire-for')!
    expect(a.tools.find((t) => t.name === 'open')?.args).toEqual(['stop-1'])
  })
})

describe('Quick version is named where it lives', () => {
  const s = `Hit ${content.site.quickWhere}.`
  it('desktop keeps "top-right corner"; folded HUD says the ⋯ menu', () => {
    expect(placeReply(s, false)).toBe('Hit Quick version (1 page) in the top-right corner.')
    expect(placeReply(s, true)).toBe('Hit Quick version in the ⋯ menu.')
  })
  it('replies without the phrase are untouched', () => {
    for (const i of content.duck.intents) expect(placeReply(i.reply, true)).toBe(i.reply)
  })
})

describe('the ⋯ fold', () => {
  it('folds under 430px only (429.98px), never at 430', () => {
    expect(css).not.toMatch(/max-width:\s*430px/)
    expect(css).toMatch(/@media \(max-width: 429\.98px\) \{\s*\.hud-more \{ display: inline-flex/)
  })
  it('⋯ is a 44×44 target in the narrow block', () => {
    const block = css.slice(css.indexOf('@media (max-width: 429.98px)'))
    expect(block.slice(0, block.indexOf('\n}'))).toMatch(/\.hud-btn\.icon\.hud-more \{ width: 44px; height: 44px; min-height: 44px; \}/)
  })
})

describe('slow load', () => {
  const visible = (html: string) => html.match(/<p class="hero-wait-line[^"]*" aria-hidden="true">(.*?)<\/p>/)![1].replace(/<[^>]+>/g, '')
  const sr = (html: string) => html.match(/<span class="sr-only" role="status">([^<]*)<\/span>/)![1]
  it('room code still loading: a quiet note plus Quick version', () => {
    setUI({ entered: true, stage: 'download', progress: 0 })
    const html = renderToStaticMarkup(<Loader fallback />)
    expect(html).toMatch(/<div class="hero-wait"><span class="sr-only" role="status">[^<]+<\/span><p class="hero-wait-line[^"]*" aria-hidden="true">.+?<\/p><a class="hero-wait-link" href="[^"]*view=list[^"]*">Quick version \(1 page\)<\/a><\/div>/)
  })
  it('room code loaded, room still loading: the note only (the HUD has Quick version)', () => {
    setUI({ entered: true, stage: 'compile' })
    const html = renderToStaticMarkup(<Loader />)
    expect(html).toContain('class="hero-wait"')
    expect(html).not.toContain('hero-wait-link')
  })
  it('gone once the room is ready, and never before Enter', () => {
    setUI({ entered: true, stage: 'ready' })
    expect(renderToStaticMarkup(<Loader fallback />)).not.toContain('hero-wait')
    setUI({ entered: false, stage: 'download' })
    expect(renderToStaticMarkup(<Loader fallback />)).not.toContain('hero-wait')
  })
  it('progress 0 shows no frozen "0%", plus a shimmer', () => {
    setUI({ entered: true, stage: 'download', progress: 0 })
    const html = renderToStaticMarkup(<Loader fallback />)
    expect(visible(html)).toBe('loading the room…')
    expect(html.slice(0, html.indexOf('class="loader')).match(/\d%/)).toBeNull()
    expect(html).toContain('<span class="hero-wait-shimmer"></span>')
  })
  it('real progress shows the number and drops the shimmer', () => {
    setUI({ entered: true, stage: 'download', progress: 0.3 })
    const html = renderToStaticMarkup(<Loader />)
    expect(visible(html)).toMatch(/^loading the room \d+%$/)
    expect(html).not.toContain('hero-wait-shimmer')
  })
  it('screen readers get one status per line, unchanged as the percent moves', () => {
    const at = (progress: number) => { setUI({ entered: true, stage: 'download', progress }); return sr(renderToStaticMarkup(<Loader />)) }
    expect(at(0)).toBe('loading the room…')
    expect(at(0.5)).toBe('loading the room…')
    expect(at(0.7)).toBe('loading textures…')
  })
  it('the project card focus ring is inset, so the panel body cannot clip it', () => {
    const rule = css.match(/\.carousel \.card:focus-visible \{([^}]*)\}/)![1]
    expect(rule).toMatch(/box-shadow: inset 0 0 0 2px #f0b273/)
    expect(rule).toMatch(/outline: none/)
  })
  it('the shimmer is slow and off for reduced motion', () => {
    expect(css).toMatch(/\.hero-wait-shimmer::after \{[^}]*animation: hero-wait-shimmer 2\.4s/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.hero-wait-shimmer::after \{ animation: none; display: none; \} \}/)
  })
})

describe('the loader once every file is in', () => {
  it('drops the frozen percent while the room decodes (progress is capped at 0.999)', () => {
    setUI({ entered: false, stage: 'download', progress: 0.999 })
    const before = renderToStaticMarkup(<Loader />)
    expect(before).toContain('convincing the rain to fall…')
    expect(before).not.toMatch(/convincing the rain to fall \d+%/)
    setUI({ entered: true, stage: 'download', progress: 0.999 })
    const html = renderToStaticMarkup(<Loader />)
    expect(html).toMatch(/<p class="hero-wait-line waiting" aria-hidden="true">convincing the rain to fall…<span class="hero-wait-shimmer"><\/span><\/p>/)
  })
  it('still counts while files are coming in', () => {
    setUI({ entered: false, stage: 'download', progress: 0.95 })
    expect(renderToStaticMarkup(<Loader />)).toMatch(/convincing the rain to fall \d+%/)
  })
})

describe('Quick version and the no-JS page share one template', () => {
  it('same markup, and the 3D section says personal project', async () => {
    const { ListView } = await import('../src/ListView')
    const { noscriptHtml } = await import('../src/content/static')
    const raw = (await import('../src/content/content.json')).default
    const inner = (h: string) => h.replace(/^<main class="list">/, '').replace(/<\/main>$/, '').trim()
    const list = renderToStaticMarkup(<ListView webglOk={false} fallback={false} />)
    expect(inner(list)).toBe(inner(noscriptHtml(raw)))
    expect(list).toContain('<h2 id="l-3d">3D for the web (personal project)</h2>')
    for (const p of raw.projects) expect(list).toContain(`<p class="tagline">${p.tagline.replace(/&/g, '&amp;')}</p>`)
  })
})
