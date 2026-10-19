import { HUD_FOLD_QUERY } from '../useMedia'
import { setLights, setRain, startAgentic } from '../actions'
import { audio } from '../audio'
import type { DuckTool } from '../content'
import { getUI, setMuted, setUI, type DuckCard, type DuckEntry, type Open } from '../store'
import { TARGET_DEFS, targetByKey } from '../targets'
import { content } from '../content'
import { answer } from './engine'

/**
 * Runs a scripted answer: performs its whitelisted scene actions (beams to sources, lights, rain,
 * mode, audio), posts the reply, then a station card the visitor can follow.
 */
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
let busy = false
let nextId = 1

export function quack() {
  setUI({ quackAt: performance.now() })
  audio.play('quack', { rate: 0.95 + Math.random() * 0.1, gain: 0.55 })
}

function patchEntry(id: number, p: Partial<DuckEntry>) {
  setUI((s) => ({ duckLog: s.duckLog.map((e) => (e.id === id ? { ...e, ...p } : e)) }))
}

const onOff = (v: string | undefined): boolean | 'toggle' => (v === 'on' ? true : v === 'off' ? false : 'toggle')

/**
 * Where fly_to / open lead. `open` wins (project slug or panel id); else fly_to's target panel.
 * A fly_to target that carries a skill (a book: `book-claude-code`) keeps it when it lands on
 * the same panel, so the stack panel highlights that skill and the camera frames that book.
 */
export function destination(flyTo?: string, open?: string): Open {
  const def = flyTo ? (targetByKey(getUI().targets, flyTo)?.def ?? TARGET_DEFS.find((d) => d.key === flyTo)) : undefined
  // Only a key that names the book itself carries its skill ("bookshelf" aliases to the marker book).
  const skill = def && def.key === flyTo ? def.skill : undefined
  if (open) {
    if (content.projects.some((p) => p.slug === open)) return { id: 'stop-1', project: open }
    if (content.stops.some((s) => s.id === open) || content.bonus.some((b) => b.id === open))
      return skill && def?.id === open ? { id: open, skill } : { id: open }
  }
  if (def && !def.id.startsWith('action-')) return skill ? { id: def.id, skill } : { id: def.id }
  return null
}

/** `fly_to("unvisited")` (the roam intent): the first station the visitor hasn't opened yet. */
const ROAM_ORDER = ['terrarium', 'laptop', 'bookshelf', 'career', 'sticky', 'mug', 'monitor']
export function pickUnvisited(visited: string[]): string {
  return ROAM_ORDER.find((k) => { const d = destination(k); return !!d && !visited.includes(d.id) }) ?? ROAM_ORDER[0]
}

function perform(t: DuckTool, nav: { flyTo?: string; open?: string }) {
  switch (t.name) {
    case 'search_portfolio':
    case 'show_contact':
      if (t.sources?.length) setUI({ sources: { keys: t.sources, at: performance.now() } })
      break
    case 'fly_to':
      nav.flyTo = t.args[0] === 'unvisited' ? pickUnvisited(getUI().visited) : t.args[0]
      break
    case 'open':
      nav.open = t.args[0]
      break
    case 'quack':
      quack()
      break
    case 'set_lights': {
      const g = t.args[0]
      setLights(g === 'desk' || g === 'floor' || g === 'ambient' ? g : 'all', onOff(t.args[1]))
      break
    }
    case 'set_weather':
      setRain(onOff(t.args[0]))
      break
    case 'set_mode':
      startAgentic()
      break
    case 'set_audio': {
      const on = onOff(t.args[0])
      const next = on === 'toggle' ? !getUI().music || getUI().muted : on
      audio.unlock()
      setUI({ music: next })
      if (next) setMuted(false)
      break
    }
  }
}

/** Test hook: with `?debug`, `window.__desk3dHoldDuck = true` pauses before the station card is posted. */
async function hold() {
  const w = window as unknown as { __desk3dHoldDuck?: boolean }
  while (w.__desk3dHoldDuck) await sleep(200)
}

/**
 * Where Quick version lives depends on the screen: top right on desktop, inside ⋯ when the HUD folds.
 * Replies are written for desktop; this swaps the phrase on folded screens.
 */
export function placeReply(reply: string, folded: boolean): string {
  return folded ? reply.split(content.site.quickWhere).join(content.site.quickWherePhone) : reply
}

/** Answer one preset question (by intent id): run its scene actions, post the reply and a station card. */
export async function askDuck(id: string) {
  const a = answer(id)
  if (busy || !a) return
  busy = true
  try {
    const entry = nextId++
    setUI((s) => ({
      duckLog: [...s.duckLog.filter((e) => e.greet), ...s.duckLog.filter((e) => !e.greet).slice(-5), { id: entry, intent: a.intent, question: a.question, reply: placeReply(a.reply, window.matchMedia?.(HUD_FOLD_QUERY).matches ?? false) }],
      duckBusy: true,
      duckPointing: null,
    }))
    quack()
    const nav: { flyTo?: string; open?: string } = {}
    for (const tool of a.tools) perform(tool, nav)
    // Let the beam to the source show before the card appears.
    if (a.tools.some((t) => t.sources?.length)) await sleep(600)
    setUI({ duckBusy: false })
    const dest = destination(nav.flyTo, nav.open)
    // The duck doesn't drag you along: it posts a station card ("Take me there") in the chat.
    if (dest && dest.id !== 'stop-7') {
      await hold()
      const card = cardFor(dest)
      if (card) {
        patchEntry(entry, { card })
        setUI({ duckPointing: card.label.toLowerCase(), duckPointed: true })
      }
    }
    if (!getUI().chatOpen) setUI({ chatUnread: true })
  } finally {
    busy = false
    if (getUI().duckBusy) setUI({ duckBusy: false })
  }
}

/** Card for a station / project / bonus panel the duck is pointing at. */
export function cardFor(o: NonNullable<Open>): DuckCard | null {
  const stop = content.stops.find((x) => x.id === o.id)
  const note = stop ? undefined : content.bonus.find((b) => b.id === o.id) ?? content.asides.find((a) => a.id === o.id)
  const proj = o.project ? content.projects.find((p) => p.slug === o.project) : undefined
  // Cards name the object the way its label and What's here row do ("Projects"), not the panel headline.
  const label = content.guide.rows.find((r) => r.id === o.id)?.label
  const title = proj?.name ?? label ?? stop?.title ?? note?.title
  if (!title) return null
  return { open: o, title, label: (stop?.label ?? note?.title ?? title).split(' · ')[0] }
}

export function duckBusy() {
  return busy
}
