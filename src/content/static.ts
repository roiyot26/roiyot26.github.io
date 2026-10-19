// Build-time HTML from content.json (used by vite.config.ts): <title>, meta tags, and a <noscript>
// copy of the plain page so crawlers and no-JS visitors get the same content.
import raw from './content.json'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type C = typeof raw

export function headTags(c: C, siteUrl: string) {
  return [
    `<title>${esc(c.site.title)}</title>`,
    `<meta name="description" content="${esc(c.site.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(c.site.title)}" />`,
    `<meta property="og:description" content="${esc(c.site.description)}" />`,
    `<meta property="og:url" content="${siteUrl}" />`,
    `<meta property="og:image" content="${siteUrl}poster.jpg" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="canonical" href="${siteUrl}" />`,
  ].join('\n    ')
}

/** `@about.lead` style references, resolved against the same content (as `text()` does in the app). */
function ref(c: C, s: string): string {
  if (!s.startsWith('@')) return s
  let v: unknown = c
  for (const k of s.slice(1).split('.')) v = (v as Record<string, unknown>)?.[k]
  return typeof v === 'string' ? v : ''
}

export type PlainOpts = { base?: string; webglOk?: boolean; fallback?: boolean }

/**
 * The plain page, one template for both Quick version (?view=list, the WebGL fallback) and the
 * <noscript> copy. Order: full-stack work first, then the personal 3D project.
 */
export function plainPage(c: C, { base = '/', webglOk = false, fallback = false }: PlainOpts = {}) {
  const links = [c.contact.github, c.contact.linkedin]
  const pitch = c.stops.find((s) => s.kind === 'pitch')
  const strip = (u: string) => esc(u.replace(/^https?:\/\//, ''))
  return [
    fallback ? `<p class="list-note">${esc(c.site.webglFallback)}</p>` : '',
    `<header><h1>${esc(c.site.name)}</h1><p class="list-role">${esc(c.site.role)}</p>`,
    `<p class="list-links">${links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}</p></header>`,
    webglOk
      ? `<a class="list-hero" href="${base}?view=room"><img src="${base}poster.jpg" alt="A still of the 3D room: a desk with a monitor and lamps, rain on the window, a neon sign." loading="eager" /><span class="btn primary">${esc(c.site.enterRoom)} →</span></a>`
      : '',
    `<section class="list-bio" aria-label="About"><p>${esc(c.about.intro)}</p><p class="list-stack">${esc(c.about.stackLine)}</p><p>${esc(c.about.ai)}</p></section>`,
    `<section aria-labelledby="l-projects"><h2 id="l-projects">Projects</h2>${c.projects
      .map(
        (p) =>
          `<article id="project-${esc(p.slug)}"><h3>${esc(p.name)}</h3><p class="tagline">${esc(p.tagline)}</p><p>${esc(p.serious)}</p>` +
          (p.joke ? `<p class="joke">${esc(p.joke)}</p>` : '') +
          `<p class="links"><a href="${esc(p.repo)}">${strip(p.repo)}</a>${'live' in p && p.live ? ` · <a href="${esc(p.live)}">Live demo</a>` : ''}</p></article>`,
      )
      .join('')}</section>`,
    `<section aria-labelledby="l-stack"><h2 id="l-stack">Stack</h2><p>${esc(c.skills.intro)}</p><ul>${[c.skills.featured, ...c.skills.items]
      .map((s) => `<li><strong>${esc(s.name)}</strong>: ${esc(s.line)}</li>`)
      .join('')}</ul></section>`,
    pitch
      ? `<section aria-labelledby="l-3d"><h2 id="l-3d">3D for the web (personal project)</h2>${pitch.body.map((p) => `<p>${esc(ref(c, p))}</p>`).join('')}</section>`
      : '',
    `<section aria-labelledby="l-path"><h2 id="l-path">${esc(c.career.title)}</h2><ol class="career">${c.career.experience
      .map((x) => `<li><strong>${esc(x.years)}: ${esc(x.role)}</strong><span>${esc(x.summary)}</span></li>`)
      .join('')}</ol></section>`,
    `<section aria-labelledby="l-contact"><h2 id="l-contact">Contact</h2><ul>${links
      .map((l) => `<li>${esc(l.label)}: <a href="${esc(l.url)}">${strip(l.url)}</a></li>`)
      .join('')}</ul></section>`,
  ].join('\n')
}

/** The <noscript> copy: the plain page with no way into the room (it needs JS). */
export function noscriptHtml(c: C, base = '/') {
  return `<main class="list">\n${plainPage(c, { base })}\n</main>`
}
