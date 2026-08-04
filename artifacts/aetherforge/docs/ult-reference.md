# Ultimate authoring reference

How to give a unit an ultimate, and the full catalog of every ult **kind** with the
variables it takes. Generated from the engine dispatch in
`src/game/engine-combat.js` → `castUlt()` (~line 983). If you change a branch's
parameters, update the matching row here **in the same commit** — a kind whose
variables changed but whose entry didn't is an incomplete change.

---

## 1. Where an ult lives

Every unit carries one ult object in its definition. No engine change is needed to
give a unit an existing kind — you just fill in the object.

**Player units** — `src/game/data-units.js`, via the `U(...)` constructor:

```js
U(name, faction, cls, t, rng, hp, dmg, as, mv, ico, ult, rar, ab)
//                                                    ^^^ the ult object
```

**Enemy units** — `src/game/data-enemies.js`, via `EU(...)` (normal), the `ELITES`
arrays, and the `BOSSES` map (a boss's ult is its `ult:` field):

```js
EU(name, cls, t, rng, hp, dmg, as, mv, ico, ult, ab)
//                                          ^^^ the ult object
```

## 2. The ult object

```js
ult: { k:'<kind>', /* …kind-specific params… */, name:'Display Name', desc:'…' }
```

| Field  | Required | Meaning |
|--------|----------|---------|
| `k`    | yes | The kind — selects the engine branch. Must match a case below (or `'none'` for no ult). |
| `name` | recommended | Shown in the cast banner and tooltips (uppercased on cast). |
| `desc` | recommended | Per-unit tooltip text. **Prefer this**: units sharing a `k` otherwise show the same generic `ULT_DESC` string, blind to this unit's params. Add `desc` whenever the params differ from the default. |
| params | per kind | See the catalog. Anything you omit falls back to the default in the table. |

`ULT_DESC` (`src/game/ui-tooltips.js`, ~line 9) holds the generic per-kind fallback
string used when a unit has no `desc`.

## 3. How ults charge & how damage scales

- **Charge:** the ult bar (`u.mag`) fills as the unit deals and takes damage; it
  fires at `mag >= 100`, then resets to 0. `passive:{chargeMul:1.2}` charges 20%
  faster.
- **Damage:** damage kinds deal `u.dmg × v × power × PACE`. `v` is the multiplier
  you set. `power` bundles ult-damage modifiers (`ultMul`, Stargazer ally-amp,
  a 25% chance of a 1.5× "ult crit" if the unit has `ultCrit`).
- **Wave escalation (`esc`):** most **AoE** kinds (nova, quake, beam, burst,
  freeze, selfdestruct, bombard, cone) also multiply by `esc`, which ramps up over
  a long fight. Most **single-target** kinds (execute, drain, blink, doom, rend,
  overload, throw, hook, siphon) do **not** — they stay at a flat multiple of `dmg`.
- **CC immunity:** every stun/fear/charm/displace effect checks `ccImmune`
  (the "cannot be knocked back / immovable" passive). CC ults skip immune units;
  this is intentional and must be preserved on any new CC kind.

## 4. Target modes (`pickTarget(u, mode)`)

Damage/control kinds pick their target through one of these modes. `foes` excludes
cloaked/untargetable (`_cloakT`) units.

| Mode | Picks |
|------|-------|
| `nearest` | closest foe (default) |
| `farthest` | most distant foe (backline) |
| `lowhp` | lowest current HP |
| `highhp` | highest current HP (tank) |
| `highthreat` | highest `dmg × as` (the carry) |
| `densest` | foe at the center of the tightest cluster |

---

## 5. Catalog

Legend: **param (default)** — a param with no default shown is **required** (the
engine reads it with no fallback; omitting it misfires or NaNs). `v` is the primary
scalar for most kinds.

### 5a. Single-target damage

| Kind | Effect | Target | Params (default) | Example |
|------|--------|--------|------------------|---------|
| `execute` | If target ≤ `v` HP fraction, instakill; else hit for 2.5×. | lowhp | `v` — HP% threshold (e.g. 0.3) | `{k:'execute',v:0.3,name:'Reaper Strike'}` |
| `drain` | Heavy hit, heals caster 60% of it. | nearest | `v` — dmg mult | `{k:'drain',v:2.0,name:'Harvest'}` |
| `blink` | Teleport behind target, big strike. Backline archetypes dive the far column. | highhp | `v` (3.2) — dmg mult | `{k:'blink',v:3.0,name:'Ambush'}` |
| `doom` | Brand a foe; after `v` s it takes `d`× damage if still alive. | highthreat | `v` (4) — fuse sec; `d` (6) — mult | `{k:'doom',v:3,d:6,name:'Doom Bolt'}` |
| `rend` | Heavy hit + grievous wounds (cuts healing) + bleed. Anti-sustain. | highthreat | `v` (2.8) — dmg; `bleed` (3); `heal` (0.75) — healing-cut frac; `hdur` (4) — cut duration | `{k:'rend',v:2.6,bleed:3,name:'Wyrmslayer'}` |
| `overload` | Lock the tankiest foe, hit it `n` rapid staggered times. | highhp | `n` (6) — hits; `v` (1.4) — per-hit mult | `{k:'overload',v:1.4,n:7,name:'Focus Fire'}` |
| `siphon` | Steal a fraction of target's attack (and a bit of armor), add to caster; then hit for 0.8×. | highthreat | `v` (0.3) — steal fraction | `{k:'siphon',v:0.3,name:'Cutpurse'}` |
| `doubleaxe` | Volley of `n` shots cycling through in-range foes (repeats if it outnumbers them). | in-range → nearest | `n` (2) — shots; `v` (3.0) — per-shot mult | `{k:'doubleaxe',v:1.0,n:6,name:'Fusillade'}` |

### 5b. Multi-target / AoE damage

| Kind | Effect | Target | Params (default) | Example |
|------|--------|--------|------------------|---------|
| `nova` | Blast around a cluster after a short arc. | densest | `v` — dmg mult; `r` (1) — radius | `{k:'nova',v:1.7,r:2,name:'Supernova'}` |
| `quake` | Board-wide staggered shockwave; 50% chance to briefly stun each foe. | all foes | `v` — dmg mult | `{k:'quake',v:2.0,name:'Thunderstomp'}` |
| `beam` | Piercing line toward the farthest foe; hits everything on the path in order. | farthest (line) | `v` — dmg mult | `{k:'beam',v:2.4,name:'Doom Bolt'}` |
| `chain` | Lightning bounces between nearby foes, −25% each jump. | nearest → bounce | `v` — first-hit mult; `j` (4) — max jumps | `{k:'chain',v:2.2,j:5,name:'Chain Tempest'}` |
| `burst` | Detonates around the caster, hitting everyone inside `n` times each. | self AoE | `r` (1) — radius; `n` (1) — hits; `v` (1.5) — per-hit mult | `{k:'burst',v:1.6,n:2,r:2,name:'Nova Burst'}` |
| `selfdestruct` | Big burst around caster, then the caster dies. Best on tokens / a dying unit. | self AoE | `r` (2) — radius; `v` (4.0) — dmg mult | `{k:'selfdestruct',v:3.5,r:1,name:'Cinder Burst'}` |
| `bombard` | Rain projectiles from off-board onto up to `n` marked foes (struck at live positions). | up to `n` foes | `n` (5); `v` (1.6) — dmg; `glyph`/`zcol`; `dir` (N,S,E,W,NE,NW,SE,SW = 'N'); `order` (all/random/col-left/col-right/row-top/row-bottom = 'all') | `{k:'bombard',v:1.8,n:6,glyph:'☄',dir:'N',order:'all',name:'Mortar Barrage'}` |
| `cone` | Wedge fanning from the caster toward the nearest foe; optional DoT / debuff. | nearest (wedge) | `r` (3) — range; `v` (1.8) — dmg; `width` (1) — 0 narrow…2+ wide; `dot:{burn,dur,poison,bleed}`; `debuff:{…}`; `zcol` | `{k:'cone',v:1.6,r:3,width:1,dot:{burn:1,dur:3},name:'Ignite Charge'}` |
| `whirlwind` | Status: pulse `v`×dmg to adjacent foes every 0.3 s for `dur` s while the caster keeps moving. | adjacent (over time) | `v` (0.8) — per-pulse frac; `dur` (3) — seconds | `{k:'whirlwind',v:0.8,dur:3,name:'Cyclone'}` |

### 5c. Zones & fields (persist on the board)

| Kind | Effect | Center | Params (default) | Example |
|------|--------|--------|------------------|---------|
| `zone` | Damaging tiles that tick while foes stand on them. | densest | `r` (1) — radius; `v` (0.5) — dmg frac/tick; `dur` (4) — life; `zcol`/`zico` | `{k:'zone',v:0.55,r:2,dur:4,name:'Hail of Arrows'}` |
| `buffzone` | Tiles that buff **allies** standing on them. | caster | `r` (1); `dur` (5); `buff:{dmg:0.25,dr:0.15}`; `zcol`/`zico` | `{k:'buffzone',r:2,dur:5,buff:{dmg:0.3,as:0.2},name:'Sanctuary'}` |
| `debuffzone` | Tiles that sap **enemies** standing on them. | densest | `r` (1); `dur` (5); `debuff:{dmg:0.25,as:0.20}`; `zcol`/`zico` | `{k:'debuffzone',r:2,dur:6,debuff:{dmg:0.3,as:0.25},name:'Pox Cloud'}` |
| `timewarp` | Field that slows enemies (AS+move) and hastens allies inside it. | densest | `r` (2); `dur` (4); `v` (0.4) — AS delta | `{k:'timewarp',r:2,dur:4,v:0.4,name:'Chronofield'}` |
| `trap` | Arms a tile; first foe to step on it eats the payload. | densest | `r` (0) — size; `v` (2.0) — dmg; `dur` (10) — armed life; payload: `stacks`→bleed, `root`→stun, `slow`, `teleport`; `zcol` | `{k:'trap',v:2.5,root:1.5,name:'Plant Mines'}` |
| `wall` | Short line of impassable tiles just ahead of the caster. | ahead of caster | `n` (3) — length; `dur` (5); `zcol` | `{k:'wall',n:3,dur:5,name:'Barricade'}` |
| `firewall` | Burning line ahead of the caster; foes standing in it take damage every 0.5s and catch fire. **Passable by default** — see note below. | ahead of caster | `n` (3) — length; `v` (1.0) — dmg per tick; `dur` (5); `burn` (1) / `bdur` (2); `off` (2) — columns ahead; `block` (false) — also impassable; `zcol`/`zico` | `{k:'firewall',v:1.0,n:4,dur:6,burn:1.3,bdur:3,name:'Wall of Flame'}` |

> **`firewall` and `block`.** `occupied()` treats `wall` tiles as impassable and the AI paths
> with `occupied()`, so a damaging wall with `block:true` gets routed *around* and never burns
> anyone. Leave it passable so enemies must walk through the flames to reach your line; use
> `block:true` only when you want a pure Barricade reskin. Note also that zone damage passes a
> `null` source, so it earns the caster no lifesteal or kill credit.

### 5d. Crowd control & displacement

Stuns / fears / charms check `ccImmune`. Note: `hook`, `throw`, and `vortex` still
**reposition** an immune unit — only the stun/slow rider is blocked — whereas
`banish`, `freeze`, `taunt`, `silence`, `warcry`, `confuse`, `polymorph`, and
`charm` skip immune units entirely.

| Kind | Effect | Target | Params (default) | Example |
|------|--------|--------|------------------|---------|
| `freeze` | AoE stun for `v` s + light damage. | densest | `v` — stun sec; `r` (1) — radius | `{k:'freeze',v:1.6,r:2,name:'Avalanche'}` |
| `banish` | Hurl one foe to the far edge + stun `v` s + slow. | nearest | `v` (1.5) — stun sec | `{k:'banish',v:1.5,name:'Drag Under'}` |
| `throw` | Grab nearest foe, hurl it into the farthest; both take `v`×dmg + stun. | nearest→farthest | `v` (2.0) — dmg; `stun` (1.0) | `{k:'throw',v:2.0,name:'Gore Toss'}` |
| `hook` | Yank the farthest foe into melee beside the caster + `v`×dmg + stun. | farthest | `v` (1.2) — dmg; `stun` (1.0) | `{k:'hook',v:1.2,stun:1.0,name:'Drag Under'}` |
| `knockback` | Shove all nearby foes away; light damage, no stun. | AoE around caster | `r` (2) — radius; `v` (2) — push dist; `d` (0.6) — dmg mult | `{k:'knockback',r:2,v:2,name:'Shockwave'}` |
| `vortex` | Pull foes near a cluster inward + slow. | densest | `r` (2) — radius; `v` (2) — pull dist; `slow` (2) | `{k:'vortex',r:2,v:2,name:'Gravity Well'}` |
| `taunt` | Force nearby foes to attack the caster for `v` s; caster gains a shield. | AoE around caster | `v` (2.5) — dur; `r` (3); `shield` (maxhp×0.25) | `{k:'taunt',v:2.5,r:3,name:'Provoke'}` |
| `silence` | Drain nearby foes' charge and lock their casting for `v` s. | AoE around caster | `v` (2.5) — dur; `r` (2) | `{k:'silence',v:2.5,r:3,name:'Unspeakable Truth'}` |
| `warcry` | Terrify nearby foes: they flee and cannot act for `v` s. | AoE around caster | `v` (1.5) — dur; `r` (3) | `{k:'warcry',v:1.2,r:3,name:'Feral Howl'}` |
| `confuse` | Madden nearby foes into attacking their own side for `v` s. | AoE around caster | `v` (2.5) — dur; `r` (2) | `{k:'confuse',v:2.5,name:'Madness'}` |
| `polymorph` | Hex the biggest threat into a harmless Sheep (can't act) for `v` s. | highest `dmg×as` | `v` (3) — dur | `{k:'polymorph',v:3,name:'Hex'}` |
| `charm` | Turn a foe to your side for `v` s (moves it between arrays; reverts after). | highest `dmg×as` | `v` (4) — dur | `{k:'charm',name:'Maddening Gaze'}` |
| `swallow` | Remove a foe from the fight until the caster dies, then regurgitate it. | highest `dmg×as` | `regurg` (0.5) — HP% on return | `{k:'swallow',regurg:0.5,name:'Consume'}` |

### 5e. Buffs, heals & defense (self / ally)

| Kind | Effect | Scope | Params (default) | Example |
|------|--------|-------|------------------|---------|
| `heal` | Heal allies within 3 hexes. | allies ≤3 | `v` — heal amount (`r` only changes the visual blast; heal radius is fixed at 3) | `{k:'heal',v:240,name:'Abyssal Mend'}` |
| `shield` | Shield the caster. | self | `v` — shield amount | `{k:'shield',v:260,name:'Glacial Shell'}` |
| `bulwark` | Shield a cluster of allies + grant them +15% armor. | allies ≤`r` | `v` — shield each; `r` (2) — radius | `{k:'bulwark',v:280,r:2,name:'Carapace Wall'}` |
| `rally` | Nearby allies gain `v` attack speed (+ a bit of damage). | allies ≤`r` | `v` (0.5) — AS frac; `r` (3) | `{k:'rally',v:0.6,name:'Howl'}` |
| `berserk` | Self buff: +`v` AS, +`d` damage, +15% lifesteal (rest of fight). | self | `v` (0.5) — AS; `d` (0.3) — dmg | `{k:'berserk',v:0.5,d:0.3,name:'Bloodlust'}` |
| `cleanse` | Strip all debuffs from nearby allies + brief debuff-immunity. | allies ≤`r` | `r` (3); `v` (1.5) — immunity sec | `{k:'cleanse',v:1.5,name:'Purify'}` |
| `phase` | Caster (or most-wounded ally) becomes untargetable + immune for `v` s. | self / ally | `v` (1.5) — dur; `self` (true; set `self:false` to shield an ally) | `{k:'phase',v:1.8,name:'Blade Dance'}` |
| `bond` | Tether caster to the most-wounded ally; incoming damage is shared for `v` s. | self + ally | `v` (5) — dur | `{k:'bond',v:5,name:'Soul Tether'}` |
| `redemption` | When the caster **dies**, heal nearby allies. | on-death, allies ≤`r` | `v` (180) — heal; `r` (2) | `{k:'redemption',v:180,r:2,name:'Martyr'}` |

### 5f. Summons, revives & transforms

| Kind | Effect | Params (default) | Example |
|------|--------|------------------|---------|
| `summon` | Raise `n` ally tokens beside the caster. | `token` ('skeleton') — key into `TOKENS`; `n` (3); `v` (1) — token power | `{k:'summon',token:'skeleton',n:3,name:'Raise Dead'}` |
| `mirror` | Spawn `n` health-scaled illusion copies of the caster (tokens; expire, don't count). | `n` (2); `v` (0.4) — HP frac; `dmg` (0.6) — dmg frac; `dur` (8) — lifespan | `{k:'mirror',n:2,v:0.4,name:'Illusions'}` |
| `pyre` | Revive the most-recently-fallen ally beside the caster at `v` HP. | `v` (0.5) — HP frac | `{k:'pyre',v:0.5,name:'Rekindle'}` |
| `transform` | Turn the caster into a bigger creature with new stats **and its own ult** (installed from the form). One-time. | `form` — key into `TRANSFORM_FORMS` (below) | `{k:'transform',form:'Fire Drake',name:'Draconic Ascension'}` |

**`TRANSFORM_FORMS`** (`engine-combat.js` ~line 47) — each form sets art/class/type,
stat multipliers, and the ult the transformed unit then charges:

`Seraph` · `Fire Drake` · `Living Flame` · `Leviathan` · `Thunder Beast` ·
`Greater Phoenix` · `Mountain Titan` · `Brood Queen` · `Grizzly Bear`

---

## 6. Adding a brand-new kind

1. **Engine:** add an `else if(k==='<kind>')` branch in `castUlt()`
   (`engine-combat.js`). Read your params as `u.ult.<name>` with a sensible
   `||` default. Reuse the shared helpers rather than hand-rolling:
   `pickTarget`, `placeNear`, `pushUnit`, `swapPos`, `slay`, `applyPayload`
   (respects `ccImmune` for stun/slow/burn/poison), `applyStatus`/`hasStatus`/
   `statusData` (timed effects with `onEnd`, incl. death-triggered), `fieldTiles`,
   `blastAt`, `fx`, `spawnProjectile`, `queueImpact` (staggered/delayed effects).
2. **Any CC** must skip `ccImmune` units — match the existing CC branches.
3. **Fallback text:** add an entry to `ULT_DESC` (`ui-tooltips.js`).
4. **This guide:** add a catalog row with the params, target mode, and an example.
5. **Determinism:** all randomness must go through `RNG()` (never `Math.random`) so
   replays stay deterministic.

## 7. Keep it in sync

Treat the catalog above as part of the engine's contract. Any commit that adds a
kind, renames a param, or changes a default updates the matching row here. A kind
whose behavior and whose documentation disagree is a bug in this file.
