import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { STOPS, content } from '../content'
import { openChat, openPanel } from '../nav'
import { getUI, setUI, subscribe, useUI, type DuckEntry, type SheetState } from '../store'
import { markerTargetFor } from '../targets'
import { askDuck } from './run'
import { chipLabel, intentById, nextChips, repeatable } from './engine'
import { CHAT_SHEET_QUERY } from '../useMedia'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches ?? false

/** Same breakpoint as the chat sheet in index.css: phones are <900px wide or portrait. */
export { CHAT_SHEET_QUERY } from '../useMedia'
/** Docked column width on desktop: clamp(380px, 32vw, 520px). Also used by the camera offset. */
export const chatWidth = (w: number) => Math.min(520, Math.max(380, 0.32 * w))
export const CHAT_INSET = 24
export const PEEK_PX = 88

function useSheetLayout() {
  const [m, setM] = useState(() => window.matchMedia?.(CHAT_SHEET_QUERY).matches ?? false)
  useEffect(() => {
    const q = window.matchMedia?.(CHAT_SHEET_QUERY)
    const on = () => setM(q.matches)
    q?.addEventListener('change', on)
    return () => q?.removeEventListener('change', on)
  }, [])
  return m
}

/** Plain text with any https:// URL turned into a link (the duck's LinkedIn answers). */
function Linked({ text }: { text: string }) {
  const bits = text.split(/(https:\/\/[^\s)]+)/)
  return (
    <>
      {bits.map((b, i) =>
        i % 2 ? (
          <a key={i} href={b} target="_blank" rel="noopener noreferrer">
            {b.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ) : (
          b
        ),
      )}
    </>
  )
}

function FadeIn({ text }: { text: string }) {
  const parts = text.split(/\n+/).filter(Boolean)
  if (reduced()) return <Linked text={text} />
  return (
    <>
      {parts.map((para, i) => (
        <span key={i} className="duck-fade" style={{ animationDelay: `${i * 180}ms`, display: parts.length > 1 ? 'block' : 'inline' }}>
          <Linked text={para} />
        </span>
      ))}
    </>
  )
}


/** Still of the scene duck; a 2-frame blink every ~6 s is the only motion in the panel. */
function Avatar({ size }: { size: number }) {
  return (
    <span className="duck-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}duck-avatar.webp`} alt="" width={size} height={size} draggable={false} />
    </span>
  )
}

/** Station icons (inline SVG, inherit the accent): no letter tiles, no AI art. */
const ICONS: Record<string, string> = {
  projects: 'M3 5h18v11H3zM9 20h6M12 16v4',
  pitch: 'M4 6h16v10H4zM2 19h20',
  skills: 'M5 4v16M10 4v16M15 5l4 15M3 20h18',
  garden: 'M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5zM7 21h10',
  career: 'M3 5h18v14H3zM7 9h6M7 13h10M15 9h2',
  contact: 'M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h2a2 2 0 0 1 0 4h-2',
  note: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
}
function StationIcon({ kind }: { kind: string }) {
  return (
    <span className="duck-card-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" focusable="false">
        <path d={ICONS[kind] ?? ICONS.note} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function StationCard({ e }: { e: DuckEntry }) {
  // Visitors can use the guide before the room has loaded; "Take me there" waits for the room.
  const ready = useUI((s) => s.stage === 'ready')
  const c = e.card!
  const stop = STOPS.find((s) => s.id === c.open.id)
  if (!ready) return null
  return (
    <div className="duck-card">
      <StationIcon kind={stop?.kind ?? 'note'} />
      <span className="duck-card-title">{c.title}</span>
      <button type="button" className="duck-go" onClick={() => openPanel(c.open)}>
        {content.duck.go} <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}

function Turn({ e }: { e: DuckEntry }) {
  return (
    <div className="duck-turn">
      {!e.greet && (
        <p className="visitor-line">
          <span className="you">you · </span>
          {e.question}
        </p>
      )}
      <p className="duck-answer">
        <FadeIn text={e.reply} />
      </p>
      {e.card && <StationCard e={e} />}
    </div>
  )
}

/**
 * The log. Sticks to the bottom while the visitor is at the bottom; if they scrolled up, new
 * content shows a "New message ↓" pill instead of yanking the view.
 */
/**
 * Pinned = the bottom: the latest card sits just above the chips and never gets clipped. If the
 * answer + card are taller than the half sheet (already content-sized up to 62vh), the sheet goes
 * to full; with a station open (full is off then) the answer's top fades under the header instead.
 */
function pin(el: HTMLElement) {
  el.scrollTop = el.scrollHeight - el.clientHeight
  const turns = el.querySelectorAll<HTMLElement>('.duck-turn')
  const last = turns[turns.length - 1]
  const u = getUI()
  if (last?.querySelector('.duck-card') && u.sheet === 'half' && !u.open && last.offsetHeight + 16 > el.clientHeight && el.closest('.chat.sheet'))
    setUI({ sheet: 'full' })
}

function Log() {
  const log = useUI((s) => s.duckLog)
  const box = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const userAt = useRef(0)
  const [pill, setPill] = useState(false)
  const [faded, setFaded] = useState(false)
  const toBottom = (smooth: boolean) => {
    const el = box.current
    if (!el) return
    if (smooth && !reduced()) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else pin(el)
    setPill(false)
  }
  // Content grows while it types: keep pinned with a ResizeObserver on the inner log.
  useEffect(() => {
    const el = box.current
    const inner = el?.firstElementChild
    if (!el || !inner || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (atBottom.current) pin(el)
      else setPill(true)
    })
    ro.observe(inner)
    ro.observe(el)
    // The sheet animates its height; re-pin once it settles.
    const sheet = el.closest('.chat')
    const settle = () => { if (atBottom.current) pin(el) }
    sheet?.addEventListener('transitionend', settle)
    return () => { ro.disconnect(); sheet?.removeEventListener('transitionend', settle) }
  }, [])
  // Pinning is instant (a smooth scroll's in-between positions would read as "the visitor scrolled up").
  useEffect(() => {
    if (atBottom.current) toBottom(false)
    else setPill(true)
  }, [log])
  return (
    <div
      className={`chat-scroll${faded ? ' faded' : ''}`}
      ref={box}
      // Only the visitor's own scrolling (wheel / touch / keys) unpins; programmatic scrolls never do.
      onWheel={() => (userAt.current = performance.now())}
      onTouchMove={() => (userAt.current = performance.now())}
      onKeyDown={() => (userAt.current = performance.now())}
      onScroll={(ev) => {
        const el = ev.currentTarget
        setFaded(el.scrollTop > 4)
        const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        if (bottom || performance.now() - userAt.current >= 800) {
          if (!bottom) return
          atBottom.current = true
          setPill(false)
        } else atBottom.current = false
      }}
    >
      <div className="duck-log" role="log" aria-live="polite" aria-label={content.duck.expandChat}>
        {log.map((e, i) => (
          <Fragment key={e.id}>
            <Turn e={e} />
            {/* The questions follow the latest turn: the greeting's three at first, then the next unasked ones. */}
            {i === log.length - 1 && <Chips key={`chips-${e.id}`} />}
          </Fragment>
        ))}
      </div>
      {pill && (
        <button type="button" className="new-pill" onClick={() => { atBottom.current = true; toBottom(false) }}>
          {content.duck.newBelow} <span aria-hidden="true">↓</span>
        </button>
      )}
    </div>
  )
}

/**
 * The guide's questions, stacked full width under the latest turn. Before any answer: the greeting's
 * three. After an answer: up to three not asked yet. "More questions" opens every question, asked
 * ones quiet; on phones the sheet goes to full while More is open. Buttons only: no free text.
 */
function Chips() {
  const busy = useUI((s) => s.duckBusy)
  const log = useUI((s) => s.duckLog)
  const lightsOn = useUI((s) => s.lights.ambient)
  const phone = useSheetLayout()
  const [more, setMore] = useState(false)
  const askedIds = log.map((e) => e.intent)
  const asked = new Set(askedIds)
  const list = nextChips(askedIds, { answered: log.some((e) => !e.greet), more })
  const toggle = () => {
    const next = !more
    setMore(next)
    if (next && phone && !getUI().open) setUI({ sheet: 'full' })
    // Fewer: back to half, unless the visitor already moved the sheet.
    else if (!next && phone && getUI().sheet === 'full') setUI({ sheet: 'half' })
  }
  return (
    <div className="duck-chips-stack">
      {list.length > 0 && (
        <ul className="chip-stack" aria-label="Suggested questions">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" className={`chip-line${asked.has(c.id) && !repeatable(c) ? ' used' : ''}`} disabled={busy} onClick={() => void askDuck(c.id)}>
                {chipLabel(c, lightsOn)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="chip-more-link" aria-expanded={more} onClick={toggle}>
        {more ? content.duck.less : content.duck.more}
      </button>
    </div>
  )
}

/** The duck's first line, posted the moment the visitor enters the room (first sentence at once). */
function useGreeting() {
  // Visitors can enter before the room loads: the guide greets them right away.
  const entered = useUI((s) => s.entered)
  useEffect(() => {
    if (!entered) return
    setUI((s) =>
      s.duckLog.some((e) => e.greet)
        ? {}
        : { duckLog: [{ id: 0, question: '', reply: content.duck.greet.line, greet: true }, ...s.duckLog] },
    )
  }, [entered])
}

/** Handle cycle. While a station panel is open the sheet goes peek ↔ half only (full would cover the station). */
function nextSheet(sheet: SheetState, dir: 1 | -1 | 0): SheetState {
  const capped = !!getUI().open
  if (dir === 0) return sheet === 'peek' ? 'half' : sheet === 'half' && !capped ? 'full' : 'peek'
  if (dir > 0) return sheet === 'peek' ? 'half' : capped ? 'half' : 'full'
  return sheet === 'full' ? 'half' : 'peek'
}

function Handle({ sheet }: { sheet: SheetState }) {
  const y0 = useRef<number | null>(null)
  const moved = useRef(false)
  return (
    <button
      type="button"
      className="chat-handle"
      aria-label={sheet === 'full' ? content.duck.sheetDown : content.duck.sheetUp}
      aria-expanded={sheet !== 'peek'}
      onPointerDown={(e) => {
        y0.current = e.clientY
        moved.current = false
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (y0.current !== null && Math.abs(e.clientY - y0.current) > 8) moved.current = true
      }}
      onPointerUp={(e) => {
        if (y0.current === null) return
        const dy = e.clientY - y0.current
        y0.current = null
        if (!moved.current) return
        if (dy < -30) setUI({ sheet: dy < -220 && !getUI().open ? 'full' : nextSheet(sheet, 1) })
        else if (dy > 30) setUI({ sheet: dy > 220 ? 'peek' : nextSheet(sheet, -1) })
      }}
      onClick={() => {
        if (moved.current) return
        setUI({ sheet: nextSheet(sheet, 0) })
      }}
    >
      <span aria-hidden="true" />
    </button>
  )
}

/** Peek row: the guide's latest line (never hidden at peek). */
function PeekLine() {
  const log = useUI((s) => s.duckLog)
  const last = [...log].reverse().find((e) => e.reply)
  const text = last ? last.reply : content.duck.greet.line
  return (
    // Phones at peek: the log region is on the page too, so the first answer is announced.
    <p className="peek-last" role="log" aria-live="polite" aria-label={content.duck.expandChat} onClick={() => setUI({ sheet: 'half' })}>
      {text}
    </p>
  )
}

/** Keyboard path to the stations (Tab cycles them with the hover label, Enter opens). */
function StationKeys() {
  const targets = useUI((s) => s.targets)
  const stations = STOPS.filter((s) => s.kind !== 'duck')
    .map((s) => ({ s, t: markerTargetFor(targets, s.id) }))
    .filter((x) => x.t)
  if (!stations.length) return null
  return (
    <nav className="station-keys" aria-label={content.duck.stations}>
      {stations.map(({ s, t }) => (
        <button
          key={s.id}
          type="button"
          onFocus={() => setUI({ hovered: t!.key, hoverTouch: false })}
          onBlur={() => getUI().hovered === t!.key && setUI({ hovered: null })}
          onClick={() => openPanel({ id: s.id })}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}

/**
 * The scripted guide, the main surface. Desktop: a
 * docked right column, clamp(380px, 32vw, 520px), collapsible to a 64px duck bubble. Phones: a
 * bottom sheet: peek 88px / half (content-sized, 40–62vh) / full 92vh; peek on load and on a
 * fly-to. While the sheet is raised over a station, the station panel moves aside.
 * DOM order = focus order: chips/log → collapse (CSS `order` puts the header on top).
 */
export function DuckChat() {
  useGreeting()
  const ready = useUI((s) => s.entered)
  const chatOpen = useUI((s) => s.chatOpen)
  const unread = useUI((s) => s.chatUnread)
  const sheet = useUI((s) => s.sheet)
  const phone = useSheetLayout()
  const box = useRef<HTMLElement>(null)
  // Publish the space the chat takes so panels, the caption and the camera keep clear of it.
  useLayoutEffect(() => {
    const root = document.documentElement
    const el = box.current
    const set = () => {
      const r = el?.getBoundingClientRect()
      const docked = ready && !phone && chatOpen && r
      root.style.setProperty('--chat-w', docked ? `${Math.round(r.width + CHAT_INSET)}px` : '0px')
      root.style.setProperty('--chat-h', ready && phone ? `${Math.round(r?.height ?? PEEK_PX)}px` : '0px')
      root.classList.toggle('chat-docked', !!docked)
      root.classList.toggle('chat-sheet', ready && phone)
    }
    set()
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(el)
    window.addEventListener('resize', set)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', set)
    }
  }, [ready, phone, chatOpen])
  useEffect(() => {
    document.documentElement.classList.toggle('sheet-raised', ready && phone && sheet !== 'peek')
  }, [ready, phone, sheet])
  // Leaving full while a station opens would hide it: the sheet is capped at half then.
  useEffect(() => {
    const off = subscribe(() => {
      const s = getUI()
      if (s.open && s.sheet === 'full') setUI({ sheet: 'half' })
    })
    return () => void off()
  }, [])
  if (!ready) return null
  if (!phone && !chatOpen)
    return (
      <>
        <button type="button" className="chat-bubble" onClick={openChat} aria-label={content.duck.expandChat}>
          <Avatar size={56} />
          {unread && <span className="unread" aria-hidden="true" />}
        </button>
        <StationKeys />
      </>
    )
  const raised = !phone || sheet !== 'peek'
  return (
    <>
      <section
        ref={box}
        className={`chat ${phone ? `sheet ${sheet}` : 'docked'}`}
        aria-label={content.duck.expandChat}
        data-sheet={phone ? sheet : undefined}
      >
        {phone && <Handle sheet={sheet} />}
        {raised && (
          <>
            <Log />
          </>
        )}
        <header className="chat-head" onClick={phone && sheet === 'peek' ? () => setUI({ sheet: 'half' }) : undefined}>
          {!phone ? (
            <button type="button" className="duck-avatar-btn" onClick={collapseChat} aria-label={content.duck.collapse} title={content.duck.collapse}>
              <Avatar size={44} />
            </button>
          ) : (
            <Avatar size={40} />
          )}
          <div className="chat-id">
            <p className="chat-name">
              {content.duck.name} <span className="chat-label">{content.duck.label}</span>
            </p>
            {phone && sheet === 'peek' && <PeekLine />}
          </div>
        </header>
      </section>
      <StationKeys />
    </>
  )
}

/** Collapse the desktop column; focus lands on the duck bubble that replaces it. */
export function collapseChat() {
  setUI({ chatOpen: false })
  window.setTimeout(() => document.querySelector<HTMLButtonElement>('.chat-bubble')?.focus(), 0)
}

/** Every question the guide offers, in order: the greeting's three, then the rest. */
export function chipIntents() {
  return [...content.duck.greet.chips, ...content.duck.chips].map((id) => intentById(id)).filter((i): i is NonNullable<typeof i> => !!i)
}
