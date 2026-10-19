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

export function answer(id: string): DuckAnswer | null {
  const intent = intentById(id)
  if (!intent) return null
  return { intent: intent.id, question: intent.chip, reply: intent.reply, tools: intent.tools.filter((t) => TOOL_WHITELIST.has(t.name)) }
}
