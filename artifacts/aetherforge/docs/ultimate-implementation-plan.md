# Ultimate Implementation Plan

How to implement the 31 proposals in `ultimate-ideas.md` efficiently. The core
insight: they look like 31 features but collapse onto **four shared helpers +
three subsystems** — build those first and ~20 of the ults become a few lines of
data-driven config on top.

---

## Per-unit ult descriptions (authoring requirement)

**Each unit's ult description lives in the unit definition, not in a single
kind-keyed dictionary — so the per-unit specifics are addressed.**

Today `ULT_DESC` (`ui-tooltips.js`) is keyed by ult *kind* (`k`), so every unit
sharing a kind shows the same generic string, blind to that unit's parameters. A
`nova` with `r:1` and one with `r:3` read identically; a `bombard` can't say
which direction it comes from; a `cone` can't say whether it burns or stuns.
That doesn't scale to these heavily-parameterized ults.

Mirror what passives already do — their flavor moved onto a per-unit `tip` field
on the template (see the note at `ui-tooltips.js` `abilityFor`). Do the same for
ultimates:

- **Add a per-unit ult description field** in the unit definition, carried
  through the `U()` / `EU()` constructors alongside `tip` — e.g. `ult.desc` (or
  an `ultTip` in the `{passive, tip, art}` bag). This is the authoritative,
  human-readable description of *that unit's* ultimate, written to match its
  actual `r`/`v`/`n`/`dir`/`order`/`dot`/`debuff` values.
- **Resolve descriptions by priority** in the tooltip (`ui-tooltips.js` lines
  ~88 and ~163): the unit's own `ult.desc` first → else a generic
  `ULT_DESC[k]` fallback → else a plain default. Authored specifics win;
  un-authored units still get a sensible generic line.
- **Optional templated fallback:** let the generic `ULT_DESC[k]` be a function of
  the ult params (interpolate `r`/`v`/`n`/…), so even an un-authored unit reads
  accurately. The per-unit field remains the override for anything the template
  can't phrase (flavor, conditional payloads).
- **Every new ult carrier** added in the phases below ships with its `ult.desc`
  written in the same commit — the description is part of the unit definition,
  not an afterthought.

Touch points: the `ULT_DESC` lookups in `ui-tooltips.js`; the `U()`/`EU()`
constructors in `data-units.js` / `data-enemies.js` to thread the field.

---

## Phase 0 — shared plumbing (build once, reused everywhere)

### 0.1 · DRY helpers
- `pickTarget(u, mode)` — `nearest` / `farthest` / `densest` / `lowhp` /
  `highthreat`. Nearly every ult repeats these selectors today.
- `placeNear(target)` / `pushUnit(u, dist, dir)` / `swapPos(a, b)` — one
  displacement core. Refactor existing `banish` / `blink` onto it.
- `applyPayload(tgt, {burn, poison, bleed, slow, stun, curse})` — one status
  applicator. `freeze` / `curse` already inline this; unify it.
- Route **all** randomness through `RNG()` (never `Math.random`) — the seeded sim
  and save/replay depend on it. Affects `bombard` random-order, `mirror`,
  `confuse`.

### 0.2 · Generalized field system (extend `b.zones`, ticked in `simTick`)
Today a zone carries only `dmg`. Add a typed payload and generalize the tick to
also iterate *own-side* units (currently `if(u.side===z.side)continue`):

| Field mode | Behavior | Ults |
|---|---|---|
| `damage` (exists) | DoT to enemies on tiles | `zone` |
| `buff:{…}` | apply-on-enter / revert-on-leave to allies | `buffzone`, `timewarp` (haste) |
| `debuff:{…}` | same, to enemies | `debuffzone`, `timewarp` (slow) |
| `wall:true` | tiles impassable → hook `occupied()` / `stepToward` | `wall` |
| `trap + oneShot` | fire payload once on enemy entry, remove tile | `trap` |

Design piece: buff/debuff are *stateful* (stat mods that revert when a unit
steps off or the field expires), unlike fire-and-forget damage — track "units
currently in field" per zone. **One subsystem → 6 ults.**

### 0.3 · Status registry + death hooks
- `applyStatus(u, {key, dur, onEnd})` decremented in the tick loop; `onEnd`
  reverts. Behavior hooks slot into existing blocks — targeting for `taunt` /
  `confuse` / `polymorph`, the cast gate (`if(u.mag>=100)`) for `silence`,
  attack/move for `warcry` / `whirlwind`. **→ 8 ults.**
- `onDeath` extensions + a `_recentDead` list: `redemption` (death → ally heal),
  `swallow` (caster death → restore hidden unit), `pyre` (raise last-fallen).
  **→ 3 ults.**

---

## Phase 1 — self-contained `castUlt` branches (ship first, parallelizable)
Each ~5–15 lines, no other file touched once 0.1 exists:

`vortex` · `rend` · `overload` · `hook` · `feast` · `siphon` · `selfdestruct` ·
`bombard` · `cone` · `knockback` · `doom` · `swap` · `throw` · `cleanse` **(14)**

## Phase 2 — status-based (needs 0.3)
`taunt` · `silence` · `phase` · `warcry` · `confuse` · `polymorph` ·
`whirlwind` · `bond` **(8)**

## Phase 3 — field-based (needs 0.2)
`buffzone` · `debuffzone` · `timewarp` · `trap` · `wall` **(5)**

## Phase 4 — data / summon
`mirror` (clone token sharing the caster's `art`) · `polymorph` critter form (a
`TRANSFORM_FORMS` entry, reusing the existing `transform` machinery) ·
`pyre` / `swallow` / `redemption` (wire the 0.3 death hooks) **(4)**

Total: **14 self-contained · 8 status · 5 field · 4 death/data = 31.**

---

## Rework existing ults onto the shared subsystems

Migrating the current 26 ults onto the Phase 0 plumbing is not a tax on top of
the new work — it is the **cheapest way to get the new ults**, because the shared
code then ships already proven against known-good behavior. It also collapses
duplicated logic and fixes two latent inconsistencies. Do each migration
*before* the phase that depends on it.

### Migration table

| Rework | Existing ults touched | Unblocks / shares with | Payoff |
|---|---|---|---|
| **Target selection → `pickTarget(u, mode)`** | 15 inline selectors: `densestTarget` (nova, freeze, curse, zone), lowhp (execute), nearest (drain, banish, chain), farthest (beam), highest-HP + backline (blink), `dmg*as` highthreat (charm) | `hook`, `overload`, `doom`, `rend`, `throw`, `vortex` | one definition of each mode instead of 15 subtly-varying copies |
| **Status revert → `applyStatus` registry (0.3)** | `charm` (tick-loop revert), `_cloakT` | `taunt`, `silence`, `phase`, `confuse`, `warcry`, `whirlwind`, `polymorph`, `bond` | tick loop stops accreting ~8 bespoke timer blocks; charm/cloak set the template |
| **Zone → generalized field (0.2)** | `zone`, spore clouds, `_deathPoisonCloud` | `buffzone`, `debuffzone`, `timewarp`, `trap`, `wall` | one zone codepath, not two in parallel; existing behavior is the regression check |
| **Displacement → `placeNear` / `pushUnit`** | `blink`, `banish` (each hand-rolls an occupancy search) | `hook`, `knockback`, `throw`, `swap`, `vortex` | collision-avoidance written and tested once |
| **Kill path → `slay(target, src)`** | `execute` (inlines `hp=0; alive=false; fx; onDeath`) | `doom`, `feast`, `selfdestruct`, `swallow` | one clean-kill-and-fire-onDeath for five callers |
| **`transform` → target-able + revertible** | `transform` (currently self-only, permanent) | `polymorph` (enemy → critter form → revert) | polymorph becomes nearly free |

### Two latent inconsistencies the centralization fixes (intended behavior changes)

- **Uneven CC immunity.** Basic-attack CC checks `!tgt.ccImmune` everywhere
  (`applyDamage`, the on-hit burn/slow/web/spore lines), but **ultimate CC does
  not** — `freeze`'s stun, `banish`'s stun, `curse`, and `quake`'s stun all
  ignore `ccImmune`. A CC-immune boss shrugs off an auto-attack slow yet eats an
  ult stun. **Decision: ultimate CC respects `ccImmune`, consistent with
  attacks.** Route all CC through `applyPayload`, which checks `ccImmune` in one
  place, so a CC-immune target ignores control from ults and attacks alike.
- **`charm` half-changes allegiance.** Charm flips `t.side` but leaves the unit
  in the `b.E` array. The engine has two notions of team — `.side` (used by
  `enemyOf`) and array membership (used by `living`, the foe lists, and the
  win check) — so they diverge: your own units still see the charmed unit in
  `living('E')` and attack it, it can target itself, its former allies ignore it,
  and the win check still counts it as an enemy. The revert (`u.side=_charmHome`)
  also only flips the property, and only runs in the tick loop for a *living*
  unit — so a unit that dies mid-charm fires `onDeath` on the wrong side
  (mis-crediting kill/death triggers) and side-gated revives bring it back
  permanently stolen. **Fix:** make charm move the unit between `b.P`/`b.E` (one
  source of truth), and route its expiry through the `applyStatus` registry so
  `onEnd` restores it on expiry, death, and battle-end alike.

### Determinism-check protocol (keeps migrations safe)

Every migration except the two fixes above must be **behavior-preserving**. Use
the seeded sim as the guard:

1. Pin a fixed battle (fixed seed, army, enemy line).
2. Record the full tick trace (per-unit HP / position / `mag`) **before** the
   migration.
3. Apply the migration, re-run the same seed, and diff the trace — it must be
   **byte-identical** tick-for-tick. If it diverges, the rework changed behavior.
4. The two intended fixes (ccImmune, charm) get their **own** before/after
   measurement (win-rate / death deltas) rather than an identical-trace check.

---

## Cross-cutting

- **Wiring is free:** every ult is `ult:{k, …, desc}` data on a unit / token /
  commander — no engine change to *assign* one. Add carrier units per faction
  after each phase, each with its `ult.desc` authored in the same commit.
- **FX:** reuse `fx` / `blastAt` / `spawnProjectile` / `beamLine` / `shockwave`;
  only ~3 need new visuals (cone fan, off-board projectile origin, wall tiles).
- **Testing:** extend the headless seeded-sim harness. Per ult, assert the
  mechanic (`silence` → enemy `mag` stays 0; `wall` → path blocked; `taunt` →
  enemy `tgt === caster`) across 12–16 seeds, and measure win-rate / death deltas
  *before* adding it to live drop tables.

## Recommended sequence
Each subsystem ships with its existing-ult migration in the same step, so the
shared code is proven against known-good behavior before the new ults ride on it.

1. **0.1 helpers** + migrate `pickTarget` / `placeNear` / `slay` selectors on the
   current ults (determinism-checked) → **Phase 1** (fastest value; exercises the
   helpers).
2. **0.3 registry** + migrate `charm` / `_cloakT` onto it → **Phase 2**.
3. **0.2 field system** + migrate `zone` / spore / `_deathPoisonCloud` onto it →
   **Phase 3**.
4. **`transform` rework** → **Phase 4** data / summon.
5. Apply the two intended fixes (ccImmune policy, charm revert) with their own
   before/after measurement.
6. Balance pass via sim, then wire into factions / commanders.
