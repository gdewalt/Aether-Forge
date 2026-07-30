# Balance pass — unit statistics, tokens, transforms & difficulty curve

Goals this pass was tuned against:

1. Higher rarity units should be **slightly** stronger than lower rarities.
2. Battles should be **close but winnable** early on.
3. **Elites should require a strong team with upgraded units.**

Everything below was measured with a headless harness driving the real
`buildEnemyArmy()` / `simTick()` (not estimated), 24–30 seeded battles per cell.

---

## 1. Player rarity curve

**Problem.** Rarity was neither modest nor monotonic. Measuring power as
`hp × dmg × as`, Legendaries sat at **3.4–4.3×** Common, and two classes were
inverted — Guardian Legendary was *below* Guardian Rare, Cleric Rare *below*
Cleric Uncommon. Within-class steps were erratic (Mage Uncommon was +4% over
Common; Guardian Uncommon was +78%).

**Target curve** — ~20% per tier, applied per class:

| Common | Uncommon | Rare | Legendary |
|--------|----------|------|-----------|
| 1.00 | 1.20 | 1.45 | 1.75 |

**Method.** For each class, the class's **total power budget was held constant**
and only its *distribution* across rarities was changed. Each class/rarity group
was scaled to its target, splitting the factor across `hp` and `dmg` (`√f` each)
so every unit keeps its hp:dmg identity, its attack speed, range and movement,
and the intra-rarity variety between units is preserved.

Because the budget is preserved, this is **not** a global player nerf: Legendary
average power fell 88 → 60 while Common rose 27 → 33 and Uncommon 32 → 38. The
pool average is unchanged (41 → 41). Pool-wide the result is 1.00 / 1.14 / 1.38 /
1.78 (it differs slightly from the per-class targets because classes have
different rarity mixes).

> Legendaries are the biggest movers (roughly −30% power). This is the intended
> reading of "slightly stronger", and it has a deliberate side effect: a
> **tier-3 fused Common (2.4×) now beats a tier-1 Legendary (1.75×)**, which is
> what makes goal 3 work — elites reward investment, not just rare pulls.

## 2. Transforms

Eight of the nine `TRANSFORM_FORMS` had `hp:1.0` — a "Fire Drake" or "Mountain
Titan" was exactly as fragile as the caster, and all the power sat in raw damage.
Total multipliers were also inconsistent (2.00×–2.75×, with Grizzly Bear a 4.22×
outlier).

Every form is now normalized to **~2.70× total power**, with the power shifted
out of damage and into durability so a transformed creature is an actual monster.
Tanky forms lean further into HP (Mountain Titan 1.75, Leviathan 1.70) and caster
forms less so (Seraph/Living Flame 1.45).

## 3. Tokens

Spread was 4.8× (swarmling 2.6 power vs turret 12.6), and the swarm tokens were
chaff next to a ~33-power Common. Rebalanced onto a coherent curve that prices
**permanent** tokens (`life:null`) below **temporary** ones, with the immobile
turret keeping a premium for being stuck in place:

| Token | Power before → after | Note |
|---|---|---|
| swarmling | 2.6 → 7.2 | temporary (4s) |
| broodling | 3.5 → 7.4 | temporary (6s) |
| skeleton | 9.0 → 9.6 | temporary (5s), roughly unchanged |
| squirrel | 2.9 → 5.5 | permanent |
| scrapbot | 4.0 → 5.9 | permanent |
| turret | 12.6 → 10.9 | permanent, immobile, range 5 |

## 4. Difficulty curve

Measured required-player-power (the multiplier a reference roster needs for a
~50% win) exposed three structural faults:

- **Act I was free** — 88% win at *half* power, then Acts II/III spiked **11x**
  and **3x**.
- **Boss escorts used a flat `scale=1.35`** that never tracked the act, so
  late-act *normal* battles out-scaled the act's own boss.
- **Act II/III enemy count grew every 2 clears** on top of an already-steep base.

### Follow-up: Acts II & III were still too easy for a good composition

The first round of this pass over-corrected: `ACT_HP_MULT`/`ACT_DMG_MULT` were cut
hard (1.5 -> 1.15, 2.0 -> 1.35) on the strength of a reference roster carrying no
armour or shields, which badly misreports AoE-heavy fights. Re-measured against a
genuinely **optimized** build — double faction synergy (Aegis Wall + Blessing both
at level 2), tanks, sustain *and* real damage — Act III was a walkover: 100% win
on normal battles, **100% on elites**, with 7-8 of 8 units surviving.

Two measurement bugs were fixed first, and both had been distorting earlier
numbers:

1. The harness scored the engine's **70s overtime backstop** (`engine-combat.js`
   ~560: the side with more total HP wins) as a loss, so any fight that ran long —
   most boss fights — was misreported. The harness now replicates the engine's
   real resolution rules.
2. Enemy **count saturated at the cap of 8 for both acts**, so late Act II fielded
   exactly as many enemies as late Act III. Act III is now strictly larger at every
   point in the act.

All three levers were then raised, weighted toward Act III:

| Knob | Before | After |
|---|---|---|
| `ACT_HP_MULT` | 1.0 / 1.15 / 1.35 | 1.0 / **1.30** / **1.85** |
| `ACT_DMG_MULT` | 1.0 / 1.05 / 1.15 | 1.0 / **1.15** / **1.45** |
| Act II-III enemy count | 3+floor(ac/3)+(act-1) | **4**+floor(ac/3)+(act-1) |
| Elite enemy count | 5 | 5, **6 in Act III** |
| Act II-III base scale | 1.20+0.12*(act-1) | explicit per act: **1.32 / 1.50** |
| Act II-III per-clear | 0.045 | 0.020 (flatter; size carries the intra-act ramp) |
| Elite premium | x1.12 | x1.05 (size now carries the step) |
| Boss HP multiplier | 1.85 / 1.60 / 1.25 | 1.85 / **2.10** / **1.00** |
| Drake Lieutenant HP | 25% of boss | 20% of boss |

Act I was deliberately left untouched — its opening fights already measured 60-67%.

### Boss mechanics (not statistics, but they dominated the Act III fight)

Vorkagar was unwinnable at any roster power. The cause was mechanical stacking,
not stats — its army is actually *lighter* than a normal Act III battle. Per phase
every boss gained `dmg x1.2`, and Vorkagar added a full-board breath, summoned adds
and a 1.4x enrage on top. Softened: phase ramp `x1.2 -> x1.12`, breath
`0.8 -> 0.45`, enrage `1.4/1.15 -> 1.25/1.10`, adds per phase `2 -> 1`, and its
base HP 4000 -> 3000.

The **Bloodlust escalation ramp is now capped at 2.0x** (was unbounded — 4x by
90s), because it disproportionately punished long boss fights where the boss's own
HP pool makes a fast finish impossible regardless of player strength.

## 5. Result

Win rates against a **strong, synergy-stacked composition** at each stage — the
case the curve now has to hold up against:

| Stage | Roster | Win | Survivors |
|---|---|---|---|
| Act I battle #1 | 4x tier-1 | 60% | 2.3 / 4 |
| Act I battle #8 | 5x tier-1 | 67% | 2.9 / 5 |
| Act I elite | realistic mid-Act I | 67% | 3.7 / 6 |
| Act I boss | realistic end-Act I | 100% | 5.8 / 6 |
| Act II battle (early) | tier-2 | 90% | 3.8 / 6 |
| Act II battle (late) | tier-2 | **40%** | 1.6 / 6 |
| Act II elite | tier-2 | **53%** | 1.5 / 6 |
| Act II boss | tier-2 | **53%** | 3.4 / 6 |
| Act III battle (early) | tier-3 optimized | 90% | 6.0 / 8 |
| Act III battle (late) | tier-3 optimized | **53%** | 3.9 / 8 |
| Act III elite | tier-3 optimized | **57%** | 3.5 / 8 |
| Act III boss | tier-3 optimized | **57%** | 3.3 / 8 |

For comparison, the same optimized rosters before this follow-up: Act III normal
**100%/97%**, Act III elite **100%**, Act II normal **97%**, Act II boss **87%**.

### Caveat on the harness

The sim models units, synergies, ults, terrain and enemy composition, but **not**
gear, relics, commander passives or meta upgrades — so real-run win rates will sit
somewhat above these figures. A reference roster with no armor/shields also badly
misreports AoE-heavy **boss** fights specifically. Boss numbers should always be
read from a realistic composition, not a stat-scaled one.
