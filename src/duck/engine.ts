import { content, type DuckIntent, type DuckTool } from '../content'

/**
 * The duck is a scripted guide: every question is a button, and every answer is written in advance
 * in content.json (`duck.intents`). There is no free text, no model and no network call.
 */
export type DuckAnswer = {
  /** Intent id from content.json. */
  intent: string
  /** The question as shown on its button. */
  question: string
  reply: string
  tools: DuckTool[]
}

/** Scene actions an answer may trigger. Anything else in content.json is ignored. */
export const TOOL_WHITELIST = new Set(['search_portfolio', 'fly_to', 'open', 'show_contact', 'quack', 'set_mode', 'set_lights', 'set_weather', 'set_audio'])

export function intentById(id: string): DuckIntent | undefined {
  return content.duck.intents.find((i) => i.id === id)
}

/** The button label right now: the lights question follows the room lights (on → "off", off → "on"). */
export function chipLabel(intent: DuckIntent, lightsOn: boolean): string {
  return !lightsOn && intent.chipOn ? intent.chipOn : intent.chip
}

/** A question that toggles something can be asked again, so it never counts as used. */
export const repeatable = (intent: DuckIntent) => !!intent.chipOn

export function answer(id: string, lightsOn = true): DuckAnswer | null {
  const intent = intentById(id)
  if (!intent) return null
  const off = !lightsOn && !!intent.chipOn
  return {
    intent: intent.id,
    question: chipLabel(intent, lightsOn),
    reply: off ? intent.replyOn ?? intent.reply : intent.reply,
    tools: intent.tools.filter((t) => TOOL_WHITELIST.has(t.name)),
  }
}

/**
 * Questions to offer under the latest turn. Before any answer: the greeting's three. After one:
 * up to `max` questions not asked yet (repeatable ones always count as unasked). With More open:
 * every question, asked ones included.
 */
export function nextChips(asked: Iterable<string | undefined>, opts: { answered: boolean; more: boolean; max?: number }): DuckIntent[] {
  const done = new Set(asked)
  const all = [...content.duck.greet.chips, ...content.duck.chips].map(intentById).filter((i): i is DuckIntent => !!i)
  if (opts.more) return all
  if (!opts.answered) return content.duck.greet.chips.map(intentById).filter((i): i is DuckIntent => !!i)
  return all.filter((i) => repeatable(i) || !done.has(i.id)).slice(0, opts.max ?? 3)
}
