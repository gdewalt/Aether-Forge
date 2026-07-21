# Ultimate Ability Ideas

Design proposals for new ultimate `k` kinds, ranked by the size of the gap each
fills. The current roster (in `castUlt`, `src/game/engine-combat.js`) already
covers 26 kinds — these are chosen to fill **mechanical gaps** rather than
reskin existing damage ults like `nova`/`burst`.

Each entry gives the data shape (`ult:{k, v, r, n, ...}`, the same schema every
unit already uses) and the existing engine primitive it would reuse, so the
implementation cost stays low.

## Current roster (for reference)

| Category | Kinds |
|---|---|
| Damage | `nova`, `burst`, `doubleaxe` (barrage), `execute`, `chain`, `beam`, `quake`, `drain`, `blink`, `zone` |
| Control / debuff | `freeze`, `curse`, `banish`, `charm` |
| Support / buff | `heal`, `shield`, `bulwark`, `rally`, `berserk`, `summon`, `transform` |

---

## Missing pillars (whole roles with no ultimate)

### 1. `taunt` — Provoke
Force every enemy within `r` to target the caster for `v` seconds; the caster
gains a shield / damage-reduction while taunting.

- **Gap:** the single biggest hole. Guardians have armor and a `bulwark`
  team-shield, but there is **zero aggro control**. Enemy AI targets by
  archetype, not position, so a tank can't actually protect the backline it
  stands in front of. Taunt makes "hold the line" a real build and gives
  Ironhold / Aldric an identity.
- **Reuses:** `tgt` / `retgt` reassignment (as `charm` does) + `applyShield`.
- **Shape:** `ult:{k:'taunt', v:2.5, r:3, name:'Provoke'}`

### 2. `cleanse` — Purify
Strip all debuffs (bleed, burn, poison, slow, stun, curse, `_shred`) from allies
within `r` and grant ~1.5s debuff-immunity.

- **Gap:** the game has **seven** stacking debuff types and no counterplay to
  any of them — a Curse + freeze combo is currently unanswerable. This is the
  defensive answer and a natural Gilded / Cleric capstone.
- **Reuses:** the existing debuff fields; it just zeroes them and sets a short
  immunity timer.
- **Shape:** `ult:{k:'cleanse', r:3, v:1.5, name:'Purify'}`

---

## Combo enablers (set up your other ultimates)

### 3. `vortex` — Gravity Well
Yank all enemies within `r` toward a point and briefly slow them.

- **Gap:** `banish` scatters one enemy *away*; nothing **clumps** enemies. Half
  the damage ults (`nova`, `burst`, `zone`, `curse`) key off `densestTarget`, so
  a vortex → nova sequence is real combo play.
- **Reuses:** position-setting + `slowT` (a mirror of `banish`, inverted).
- **Shape:** `ult:{k:'vortex', r:2, v:2, name:'Gravity Well'}`

### 4. `rend` — Mortal Strike
Heavy single hit that applies grievous wounds (`_healCut`) plus a burst of bleed.

- **Gap:** the anti-sustain tool. Lifesteal carries (Voidtouched),
  `phoenixRevive`, and `_regenIdle` bosses currently have no counter.
- **Reuses:** `_healCut` **already exists** (used by one passive today), so this
  is nearly free; plus `bleedStacks`.
- **Shape:** `ult:{k:'rend', v:2.8, r:1, name:'Mortal Strike'}`

---

## Flavor with a distinct mechanic

### 5. `overload` — Focus Fire
Lock the highest-HP foe and hammer it with `n` rapid staggered hits.

- **Gap:** `doubleaxe` (barrage) *spreads* across enemies; this is its
  opposite — a dedicated **boss-melter** for single big targets, which the
  roster lacks.
- **Reuses:** `queueImpact` staggering (as `beam` does).
- **Shape:** `ult:{k:'overload', v:1.4, n:6, name:'Focus Fire'}`

### 6. `warcry` — Fear
Enemies within `r` flee (move away from the caster) and can't attack for `v`
seconds.

- **Gap:** stun (`freeze`), displacement (`banish`), and charm exist — but no
  **fear / disruption** that resets an enemy advance without hard-stunning.
- **Reuses:** movement + a new `_noAtkT` flag.
- **Shape:** `ult:{k:'warcry', r:3, v:1.5, name:'Terrify'}`

### 7. `pyre` — Rekindle
Resurrect the most-recently-fallen ally at `v`% HP beside the caster.

- **Gap:** `summon` makes fodder tokens and `phoenixRevive` is a passive
  self-rez, but there's no **active battlefield resurrection** of a real unit —
  a huge swing moment and a Phoenix-faction capstone.
- **Reuses:** `onDeath` bookkeeping + token/unit spawn.
- **Shape:** `ult:{k:'pyre', v:0.5, name:'Rekindle'}`

---

## Recommended build order

Start with **`taunt`** and **`cleanse`**. They aren't just new ults — they're
missing *answers* (aggro control and debuff counterplay) that deepen every
fight, not just the unit that carries them.
