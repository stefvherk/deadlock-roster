# Deadlock — The Roster

An animated fan showcase of every released Deadlock hero: stories, weapons, full stats and every ability with all its upgrade tiers.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run snapshot   # rebuild public/data/roster.json + art from the Deadlock Wiki, then validate
npm run validate   # check roster.json for missing data, images or unrendered game text
```

`npm run snapshot -- --force` also re-downloads every image.

## Where the data comes from

Everything comes from the [Deadlock Wiki](https://deadlock.wiki) (CC BY-NC-SA 4.0), which extracts it from the game files every patch:

- **Heroes, stats, abilities, upgrades:** `Data:HeroData.json`, `Data:AbilityCards.json`, `Data:Lang en.json` (the game's English text), `Data:StatInfoboxOrder.json`, `Data:AttributeData.json`.
- **Which heroes are released:** the wiki's *Heroes by release* table.
- **Icons and how game text is rendered:** mirrors the wiki's `Module:Lang` and `Module:Icon/attr`.
- **Glossary tooltips:** the wiki's *Status Effects* page and damage-type pages.
- **Art:** hero renders, cards, name logos and ability icons from the wiki's files, converted to WebP.
- **Yamato's backstory** ships in Japanese in the game; the English translation is from the wiki's *Yamato/Lore* page.
- **Accent colours** are derived from each hero's own render.

The site is fully static: nothing is fetched from third parties at runtime. Re-run `npm run snapshot` after a patch.

## Routes

`/` is the landing page and roster, `/hero/:slug` is a hero's dossier. Use ← and → to move between heroes, and press `/` to search.

## Hosting

**GitHub Pages** (set up): every push to `main` runs `.github/workflows/deploy.yml`, which builds the site with the right base path (`/<repo>/`), checks the game data with `npm run validate`, and publishes it. The build also writes `dist/404.html` (a copy of the app) so deep links like `/<repo>/hero/haze` work on Pages.

To build for a sub-path locally: `BASE_PATH=/deadlock-roster/ npm run build` (in Git Bash on Windows, prefix with `MSYS_NO_PATHCONV=1`).

Other static hosts work too: `public/_redirects` handles deep links on Netlify.

Unofficial fan project, not affiliated with Valve.
