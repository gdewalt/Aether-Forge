# Aetherforge

A hex-grid auto-battler / roguelike deckbuilder game — "Banners of the Broken Realm." Players pick a commander/faction, recruit and equip an army, deploy it on a hex grid, and watch battles auto-resolve while climbing a branching map across acts.

## Run & Operate

- `pnpm --filter @workspace/aetherforge run dev` — run the game (Vite dev server)
- `pnpm --filter @workspace/aetherforge run typecheck` — typecheck the artifact
- `pnpm --filter @workspace/api-server run dev` — run the API server (unused by the game currently; scaffold artifact only)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Game artifact: React + Vite shell (`artifacts/aetherforge`) hosting a vanilla-JS game engine
- API: Express 5 (scaffold artifact, not used by the game)
- DB: PostgreSQL + Drizzle ORM (scaffold, not used by the game)

## Where things live

- `artifacts/aetherforge/src/game/*.js` — the entire game engine/logic/UI, split into ~19 vanilla ES modules (no React). This is a faithful multi-file port of an original single-file HTML game; logic was preserved as-is (imperative DOM manipulation, `innerHTML` string templates, module-level mutable state), not rewritten into React idioms.
- `artifacts/aetherforge/src/game/boot.js` — entry point; imports every module, exposes ~41 functions on `window` (required because game UI is built via `innerHTML` strings with inline `onclick`/`onmouseenter`/etc. handlers), then boots the title screen.
- `artifacts/aetherforge/src/App.tsx` — thin React shell: renders the static `#hud`/`#screen`/`#tooltip` containers the vanilla game code targets, and dynamically imports `boot.js` once on mount. No game state lives in React.
- `artifacts/aetherforge/src/game/aetherforge.css` — game's original stylesheet, imported directly (not Tailwind).

## Architecture decisions

- Game logic is intentionally vanilla JS/DOM, not React — the split preserved the original single-file game's imperative style exactly. React is only a mounting shell.
- `artifacts/aetherforge/tsconfig.json` sets `allowJs: true, checkJs: false` so the vanilla `.js` modules bundle via Vite without being type-checked (they also carry `// @ts-nocheck`).
- Module-level mutable state that's reassigned (not just mutated) from outside its owning file must go through an explicit setter function (e.g. `setG`, `setRNG`, `setHOVU`) — ES module imports are read-only bindings, so direct cross-file reassignment fails at build time with an esbuild error.
- See `.agents/memory/aetherforge-split.md` for the mechanics of how the split was performed and verified, in case similar work is needed again.

## Product

- Title screen → pick a commander/faction → branching map with shop/event/rest/elite/boss nodes → recruit & equip units → deploy on a hex grid → auto-resolving combat with abilities, synergies, and ultimates → climb acts until victory or defeat, banking meta-progression (essence/lore) between runs.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- If you add new inline `onclick`/`onmouseenter`/etc. handler strings referencing a game function, you must also add that function to the `window` exposure list in `boot.js`, or the handler will silently no-op (function not defined) at runtime.
- Any new module-level `let` that ends up reassigned from a different file than the one it's declared in needs a paired `setX()` exported function — plain `import { x }` bindings can't be reassigned by importers.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.agents/memory/aetherforge-split.md` for lessons from splitting the original monolithic HTML file into this module structure
