import raw from './content.json'

export type Link = { label: string; url: string }
export type Project = {
  slug: string
  name: string
  tagline: string
  serious: string
  joke: string
  tags: string[]
  repo: string
  live?: string
}
export type Skill = { id: string; book: string; name: string; line: string }
export type Stop = {
  id: string
  n: number
  aliases: string[]
  label: string
  kicker: string
  title: string
  kind: 'projects' | 'pitch' | 'skills' | 'garden' | 'career' | 'contact' | 'duck'
  project?: string
  body: string[]
  joke: string
}
export type Note = {
  id: string
  label: string
  title: string
  body: string[]
  joke: string
  kind?: 'duck'
}
export type DuckTool = { name: string; args: string[]; sources?: string[] }
/** `chipOn` / `replyOn`: the room-lights question, worded for when the lights are off. */
export type DuckIntent = { id: string; chip: string; reply: string; tools: DuckTool[]; chipOn?: string; replyOn?: string }

export const content = raw as unknown as {
  site: Record<string, string>
  tour: Record<string, string>
  contact: {
    github: Link & { handle: string }
    linkedin: Link & { handle: string }
  }
  about: { lead: string; ai: string; next: string; nextShort: string; practice: string; short: string; intro: string; stackLine: string }
  projects: Project[]
  skills: { intro: string; featured: Skill; items: Skill[]; joke: string }
  career: { title: string; experience: { years: string; role: string; summary: string }[]; teaching: string }
  stops: Stop[]
  bonus: Note[]
  asides: Note[]
  loader: { title: string; lines: { at: number; text: string; live?: boolean }[]; ready: string }
  audio: Record<string, string>
  /** HUD room-lights button (same circuit as CLICK_Switch_Lights). */
  lightsToggle: { on: string; off: string }
  labels: Record<string, string>
  toasts: Record<string, string>
  /** One-line versions of the status toasts. */
  toastShort: Record<string, string>
  hero: { headline: string; sub: string; enter: string; enterHint: string; ready: string }
  guide: {
    button: string
    title: string
    rows: { id: string; label: string; proof: string }[]
    visited: string
    also: string
    alsoItems: string[]
    sculpture: string
    close: string
  }
  duck: {
    /** Visible on desktop and phones: the duck is buttons and pre-written answers only. */
    label: string
    more: string
    less: string
    back: string
    whatsThis: string
    hideIntro: string
    /** The questions behind "More questions", in order (intent ids). */
    chips: string[]
    intents: DuckIntent[]
    name: string
    /** The greeting line and its three questions (intent ids). */
    greet: { line: string; chips: string[] }
    status: { around: string; at: string; pointing: string }
    go: string
    collapse: string
    expandChat: string
    sheetUp: string
    sheetDown: string
    backToChat: string
    newBelow: string
    stations: string
  }
}

/** "@about.lead" style references point at another field, so copy lives in one place. */
export function text(s: string): string {
  if (!s.startsWith('@')) return s
  let v: unknown = content
  for (const k of s.slice(1).split('.')) v = (v as Record<string, unknown>)?.[k]
  return typeof v === 'string' ? v : ''
}

export const STOPS = content.stops
export const STOP_IDS = STOPS.map((s) => s.id)
export const BONUS_IDS = content.bonus.map((b) => b.id)

export function contactLinks(): Link[] {
  const c = content.contact
  return [c.github, c.linkedin]
}

export function noteById(id: string): Note | undefined {
  return content.bonus.find((b) => b.id === id) ?? content.asides.find((a) => a.id === id)
}

export function labelFor(id: string): string {
  return STOPS.find((s) => s.id === id)?.label ?? noteById(id)?.label ?? content.labels[id] ?? id
}
