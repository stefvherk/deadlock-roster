import DOMPurify from 'dompurify'

export interface TermMatcher {
  /** Glossary id for an inline attribute like "Sleep" or "SpiritDamage". */
  attr: (name: string) => string | null
  /** Glossary id for a highlighted word like "sleeps" or "Immobilized". */
  word: (text: string) => string | null
}

/**
 * Game text arrives as HTML: highlighted spans, inline stat icons, key bindings.
 * Keep that markup, strip anything active, and mark glossary terms so they get a definition on hover/focus.
 */
export function sanitizeGameHtml(html: string, terms?: TermMatcher): string {
  if (!html) return ''
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['span', 'img', 'br', 'kbd', 'b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: ['class', 'src', 'alt', 'style', 'data-attr'],
  })
  if (!terms) return clean

  const tpl = document.createElement('template')
  tpl.innerHTML = clean
  const mark = (el: Element, id: string) => {
    el.setAttribute('data-term', id)
    el.setAttribute('tabindex', '0')
    el.classList.add('term')
  }
  tpl.content.querySelectorAll('.inline-attr[data-attr]').forEach((el) => {
    const id = terms.attr(el.getAttribute('data-attr')!)
    if (id) mark(el, id)
  })
  tpl.content.querySelectorAll('.highlight, .highlight_spirit').forEach((el) => {
    const id = terms.word(el.textContent ?? '')
    if (id && !el.closest('[data-term]')) mark(el, id)
  })
  return tpl.innerHTML
}
