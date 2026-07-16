# Unit sprites

Drop unit art here as `<artKey>.png` (or `.webp`). At build time Vite content-hashes
every file in this folder and `ui-render-core.js` (`import.meta.glob`) turns them into a
static `{ artKey -> hashed URL }` map — no runtime server, no object storage, no per-unit
network probing. Files are served as immutable, CDN-cacheable static assets.

- **`artKey`** is a unit's `art` field, which defaults to its display name. See `artOf()` in
  `ui-render-core.js` and the `art:"…"` entries in `data-units.js` / `data-enemies.js`.
  Example: a Footman looks for `Footman.png`; a boss for `Balor the Black Brand.png`.
- Names with spaces, commas, or apostrophes are fine — match the `art` string exactly
  (e.g. `X'thuul, the Sleeping Deep.png`).
- Tokens, transform forms, and bosses also have `art` keys (e.g. `Skeleton.png`,
  `Grizzly Bear.png`, `Drake Lieutenant.png`).
- A unit with no matching file falls back to its emoji glyph — nothing breaks.

To add or change art, drop the file here and rebuild. No code changes needed.
