import type { Hero } from '../data/types'

const cache = new Map<string, Promise<void>>()

/** Resolves once the image is in the browser cache (or failed — never blocks forever on a bad URL). */
export function preloadImage(src: string): Promise<void> {
  if (!src) return Promise.resolve()
  let p = cache.get(src)
  if (!p) {
    p = new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = img.onerror = () => resolve()
      img.src = src
    })
    cache.set(src, p)
  }
  return p
}

/** The images a hero page needs before it can be revealed without pop-in. */
export const heroPageImages = (h: Hero) =>
  [h.images.render, h.images.name, h.images.card].filter((s): s is string => !!s)
