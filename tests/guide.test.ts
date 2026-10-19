import { describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { content } from '../src/content'
import { noscriptHtml } from '../src/content/static'
import raw from '../src/content/content.json'

vi.mock('../src/actions', () => ({ setLights: () => {}, setRain: () => {}, startAgentic: () => {} }))
vi.mock('../src/audio', () => ({ audio: { unlock: () => {}, play: () => {} } }))
vi.mock('../src/targets', () => ({ TARGET_DEFS: [], targetByKey: () => undefined }))
const { answer, TOOL_WHITELIST } = await import('../src/duck/engine')
const { chipIntents } = await import('../src/duck/DuckChat')

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const chat = read('src/duck/DuckChat.tsx')
const css = read('src/index.css')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]))
const srcText = files('src').filter((f) => /\.(tsx?|json|css)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
const strings = (o: unknown, out: string[] = []): string[] => {
  if (typeof o === 'string') out.push(o)
  else if (Array.isArray(o)) o.forEach((v) => strings(v, out))
  else if (o && typeof o === 'object') Object.values(o).forEach((v) => strings(v, out))
  return out
}
const copy = strings(raw)
const intents = content.duck.intents
const reply = (id: string) => intents.find((i) => i.id === id)!.reply

describe('the duck is a scripted guide with buttons only', () => {
  it('has no free-text input anywhere', () => {
    expect(chat).not.toMatch(/<input|<form|<textarea|contentEditable|onSubmit/)
    expect(read('src/ListView.tsx')).not.toMatch(/<input|<form|<textarea/)
    expect(noscriptHtml(raw)).not.toMatch(/<input|<form|<textarea/)
    expect(read('index.html')).not.toMatch(/<input|<form|<textarea/)
    expect(css).not.toMatch(/\.chat-form/)
    expect(JSON.stringify(content.duck)).not.toMatch(/"placeholder"|"send"/)
  })
  it('shows a visible "Scripted guide" label next to the name, on desktop and phones', () => {
    expect(content.duck.label).toBe('Scripted guide')
    // One header for both layouts: the label is not behind a phone or desktop branch.
    expect(chat).toMatch(/<p className="chat-name">\s*\{content\.duck\.name\} <span className="chat-label">\{content\.duck\.label\}<\/span>/)
    const rule = css.match(/\.chat-label \{([^}]*)\}/)![1]
    expect(rule).not.toMatch(/display:\s*none/)
    expect(css).not.toMatch(/\.chat-label[^{]*\{[^}]*display:\s*none/)
  })
  it('has no tool-step ticker, step count or "thinking" label', () => {
    expect(chat).not.toMatch(/duck-ticker|steps|thinking/i)
    expect(css).not.toMatch(/duck-ticker/)
    const { intents: all, ...ui } = content.duck
    for (const s of strings([ui, all.map(({ chip, reply }) => [chip, reply])])) {
      expect(s).not.toMatch(/\bsteps?\b|thinking|search_portfolio|tool call/i)
    }
  })
  it('every question is a button tied to one pre-written answer', () => {
    const ids = intents.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    const offered = [...content.duck.greet.chips, ...content.duck.chips]
    expect(new Set(offered).size).toBe(offered.length)
    expect([...offered].sort()).toEqual([...ids].sort())
    expect(content.duck.greet.chips).toHaveLength(3)
    expect(chipIntents().map((i) => i.id)).toEqual(offered)
    for (const id of offered) {
      const a = answer(id)!
      expect(a.question, id).toBeTruthy()
      expect(a.reply, id).toBeTruthy()
      for (const t of a.tools) expect(TOOL_WHITELIST.has(t.name), `${id} ${t.name}`).toBe(true)
    }
    expect(answer('not-a-question')).toBeNull()
  })
  it('the greeting says it is scripted', () => {
    expect(content.duck.greet.line).toMatch(/scripted guide/i)
    expect(content.stops.find((s) => s.kind === 'duck')!.body.join(' ')).toMatch(/no AI model/i)
  })
})

describe('answers match the CV', () => {
  const cv = [
    { years: '2026 – now', role: 'Full-stack developer' },
    { years: '2022 – 2026', role: 'Full-stack developer and coding instructor' },
    { years: '2021 – 2022', role: 'Full-stack developer bootcamp' },
  ]
  it('the experience list is the CV: years and roles', () => {
    expect(content.career.experience.map(({ years, role }) => ({ years, role }))).toEqual(cv)
  })
  it('the years question gets a direct answer', () => {
    const a = intents.find((i) => i.id === 'years')!
    expect(a.chip).toMatch(/years of experience/i)
    expect(a.reply).toMatch(/^He has worked as a developer since 2022\./)
    for (const x of cv) expect(a.reply).toContain(x.years)
  })
  it('never claims paid, production or client 3D work', () => {
    expect(reply('3d-client')).toMatch(/^No\. His 3D work is personal and side projects/)
    for (const s of copy) {
      if (!s.includes(' ') || !/3D|Blender|glTF|three|this room/i.test(s)) continue
      expect(s).not.toMatch(/\b(paid|production|customers?|your site|your product)\b/i)
      if (/\bclients?\b/i.test(s)) expect(s).toMatch(/not client work|client work is full-stack|for a client\?$/i)
    }
  })
  it('no company names, phone or email on any page', () => {
    const pages = [srcText, read('index.html'), noscriptHtml(raw)].join('\n')
    // Employer names and the email's local part, stored as SHA-256 so they never appear in the repo.
    const banned = new Set([
      'ed3f2bd211e38904a0fe9ecd1a4df026376ef6d028af408b27c3798f00cce084',
      'ba164f0bee03767a1a38da605c1d87525fedef31bc7bf9dd3b7671fab78a0763',
      'ac66e69f466305e864b2d8d365a7e4f7cb7bcc887e68b74316cf356287e85b26',
      '87d9bab300dfd9154b2a68f4872f29ce32e1235fb9f296b7e8c5d200e1e8afd5',
    ])
    const words = pages.toLowerCase().match(/[a-z0-9]+/g)!
    const grams = new Set(words.flatMap((w, i) => [w, `${w} ${words[i + 1] ?? ''}`]))
    const sha = (t: string) => createHash('sha256').update(t).digest('hex')
    expect([...grams].filter((g) => banned.has(sha(g)))).toEqual([])
    expect(pages).not.toMatch(/\b0\d{1,2}-?\d{3}-?\d{4}\b|\+972/)
    expect(pages).not.toMatch(/@gmail|mailto:/i)
    expect(JSON.stringify(content.contact)).not.toMatch(/email/i)
  })
  it('LinkedIn is the current profile, in the contact links and the contact answer', () => {
    const li = 'https://www.linkedin.com/in/roi-yotvat-874ba9209/'
    expect(content.contact.linkedin.url).toBe(li)
    expect(reply('hire')).toContain(li)
    expect(srcText.match(/linkedin\.com\/in\/[a-z0-9-]+/g)!.every((u) => u === 'linkedin.com/in/roi-yotvat-874ba9209')).toBe(true)
  })
})

describe('copy: two quips, the rest plain', () => {
  it('only one panel line is a joke, and the loader keeps the rain line', () => {
    const jokes = [...content.stops, ...content.bonus, ...content.asides, ...content.projects].map((x) => x.joke).filter(Boolean)
    expect(jokes).toEqual(['Air guitar, except the chords are correct.'])
    expect(content.skills.joke).toBe('')
    expect(content.loader.lines.map((l) => l.text)).toContain('convincing the rain to fall')
    const playful = content.loader.lines.filter((l) => !/^(loading|compiling|starting)\b/.test(l.text))
    expect(playful.map((l) => l.text)).toEqual(['convincing the rain to fall'])
  })
  it('no cute asides or filler words', () => {
    for (const s of copy) expect(s).not.toMatch(/\b(delve|obviously|psst|honestly|turtles|load-bearing|adhesive|quack-adjacent|has a contract|cozy|pay rent)\b/i)
  })
})
