// GitHub Pages has no URL rewrites: a deep link like /<repo>/hero/haze would 404.
// Pages serves 404.html for unknown paths, so make it a copy of the app and let the router take over.
import { copyFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
await copyFile(new URL('index.html', dist), new URL('404.html', dist))
console.log('dist/404.html written (SPA fallback for GitHub Pages)')
