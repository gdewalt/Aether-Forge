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

### 8. `swallow` — Swallow
Devour a target unit, removing it from the field entirely until the caster
dies — at which point the swallowed unit is regurgitated back into the fight.

- **Gap:** removal with a **condition tied to the caster's life**. `banish`
  only displaces one enemy temporarily and `charm` flips allegiance for a fixed
  duration; nothing takes a unit *off the board* for a variable, caster-linked
  window. Eating the enemy carry can neutralize it for most of a fight — but the
  caster becomes a priority target, and killing the caster brings the threat
  right back, so it's a high-risk swing rather than a permanent delete.
- **Reuses:** the `alive` / `living()` filter to hide the unit from targeting
  and the sim loop, a stored reference on the caster (e.g. `caster._swallowed`),
  and an `onDeath` hook that restores the unit beside the caster's corpse.
- **Notes:** default to the highest-threat non-boss enemy (bosses should resist,
  like `charm` already excludes them). If the caster survives to the end of the
  battle, the swallowed unit stays gone for that battle.
- **Shape:** `ult:{k:'swallow', name:'Swallow'}`

---

# Batch 2 — auto-battler inspirations (Auto Chess / Teamfight Tactics)

Each pulls from a signature auto-battler ability and is chosen to *not* overlap
the eight above. Two engine facts these lean on: ults gate on `if(u.mag>=100)`
(so charge / cast denial is a real lever), and `_cloakT` already grants full
untargetability (decrement in the tick loop, filtered in target acquisition).

## Denial & disruption

### 9. `silence` — Disrupt
*(TFT mana-reave / Shroud of Stillness; Auto Chess Doom & Silencer)*
Drain enemy `mag` in an area and lock them out of casting for `v` seconds.

- **Gap — the biggest one here:** there is *zero* counterplay to enemy
  ultimates today. Every fight is a race of who charges first; nothing lets you
  deny the enemy carry's cast. A whole new axis of counter-comp.
- **Reuses:** the `mag` field + one `_silenceT` flag added to the cast gate.
- **Shape:** `ult:{k:'silence', r:2, v:2.5, name:'Disrupt'}`

## Displacement (single-target, distinct from AoE `vortex`)

### 10. `hook` — Harpoon
*(Blitzcrank / Pyke; Auto Chess Pudge)*
Yank the **farthest** enemy — the backline carry — into melee beside the caster
and briefly stun it.

- **Gap:** `banish` shoves one enemy *away*, `vortex` clumps a group; nothing
  *extracts* the enemy carry out of its protected backline and drops it in front
  of your bruisers to be focused. The iconic auto-battler grab.
- **Reuses:** position-set + `stun` (mirror of `banish`, inverted target pick).
- **Shape:** `ult:{k:'hook', v:1.2, name:'Harpoon'}`

## Scaling bruiser payoff

### 11. `feast` — Devour
*(Cho'Gath, in both League/TFT and Auto Chess)*
Execute an adjacent low-HP enemy and gain **permanent** max-HP + damage for the
rest of the battle, stacking every cast.

- **Gap:** distinct from `swallow` (which *removes-until-death*) — `feast` kills
  and *grows*. The roster has no snowballing bruiser scaler; rewards a durable
  frontliner that keeps landing its casts.
- **Reuses:** `onDeath` + a stat bump (like `berserk`, but kill-gated and
  stacking).
- **Shape:** `ult:{k:'feast', v:0.35, name:'Devour'}` *(execute threshold `v`)*

## Carry survival

### 12. `phase` — Stasis
*(Zhonya's Hourglass / Fiora W / Kayn)*
Caster (or your lowest-HP ally) becomes untargetable and damage-immune for `v`
seconds to dodge a burst window.

- **Gap:** rogues now get a cloak *passively at battle start*, but no one can
  trigger untargetability *on demand* to survive a spike. Classic carry
  protection.
- **Reuses:** `_cloakT` **already does exactly this** — near-free; add a
  damage-immunity check for the fuller Zhonya's version.
- **Shape:** `ult:{k:'phase', v:1.5, name:'Stasis'}`

## Two-sided swing

### 13. `siphon` — Plunder
*(Trundle / Tahm Kench; TFT Shred/Sunder as an active)*
Steal a slice of the target's damage (and armor) and add it to the caster for
the fight — weakening them while strengthening you.

- **Gap:** no stat *theft*. `rend` cuts healing and `curse` amps damage taken,
  but nothing transfers power. A double swing that scales off the enemy's carry.
- **Reuses:** the `dmg` / `dr` fields on both units.
- **Shape:** `ult:{k:'siphon', v:0.3, name:'Plunder'}`

## Death-triggered

### 14. `redemption` — Martyr's Boon
*(TFT Redemption item / Guardian Angel)*
When the caster dies, detonate a large heal over nearby allies.

- **Gap:** `onDeath` today only fires the dying unit's *own* effects (raise a
  skeleton, etc.); nothing turns a death into an *ally* payoff. Makes a
  sacrificial frontliner's death a comeback beat instead of a loss.
- **Reuses:** the `onDeath` hook + a `heal` blast.
- **Shape:** `ult:{k:'redemption', v:180, r:2, name:"Martyr's Boon"}`

## Field control

### 15. `timewarp` — Chronofield
*(Zilean / TFT Chrono & Time Knife)*
Drop a zone that slows enemy attack speed + movement inside it while allies
inside gain attack speed.

- **Gap:** `zone` only *damages*; there's no tempo-control field. Turns
  positioning into a lever — stand your team in it, bait theirs through it.
- **Reuses:** the `zones` system (already ticks) + `slowT` / `as` modifiers.
- **Shape:** `ult:{k:'timewarp', r:2, v:0.4, dur:4, name:'Chronofield'}`

---

## Recommended build order

Start with **`taunt`** and **`cleanse`** — they aren't just new ults, they're
missing *answers* (aggro control and debuff counterplay) that deepen every
fight, not just the unit that carries them.

From Batch 2, the highest impact on how the game *plays* are **`silence`**
(kills the "whoever ults first wins" problem), **`hook`** (positioning suddenly
matters for the enemy too), and **`phase`** (nearly free — reuses `_cloakT`).
