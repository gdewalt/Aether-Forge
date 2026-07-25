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

- **Act I was free** — 88% win at *half* power, then Acts II/III spiked **11×**
  and **3×**. 
- **Boss escorts used a flat `scale=1.35`** that never tracked the act, so
  late-act *normal* battles out-scaled the act's own boss.
- **`ACT_HP_MULT`/`ACT_DMG_MULT` compounded** on top of an already-steep per-act
  base, and Act II/III enemy *count* grew every 2 clears on top of that.

Changes:

| Knob | Before | After |
|---|---|---|
| `ACT_HP_MULT` | 1.0 / 1.5 / 2.0 | 1.0 / 1.15 / 1.35 |
| `ACT_DMG_MULT` | 1.0 / 1.2 / 1.5 | 1.0 / 1.05 / 1.15 |
| Act I base / per-clear | 0.92 / 0.012 | 1.02 / 0.018 |
| Act II–III base / per-clear | 1.15+0.18·(act−1) / 0.07 | 1.20+0.12·(act−1) / 0.045 |
| Act I enemy count | 3+⌊ac/4⌋ | 4+⌊ac/5⌋ |
| Act II–III enemy count | 3+⌊ac/2⌋+(act−1) | 3+⌊ac/3⌋+(act−1) |
| Elite scale | flat 1.08/1.32/1.46 | act scale × **1.12** |
| Boss escort | flat 1.35, size 5 | act base × 0.80, size 4 |
| Boss HP multiplier | flat 2.0 | act-aware **1.85 / 1.60 / 1.25** |
| Drake Lieutenant HP | 45% of boss | 25% of boss |

Elites now take a **premium on top of** the extra body and the mini-boss they
already bring, rather than a hand-set per-act number.

### Boss mechanics (not statistics, but they dominated the Act III fight)

Vorkagar was unwinnable at any roster power. The cause was mechanical stacking,
not stats — its army is actually *lighter* than a normal Act III battle
(12.5k HP / 767 DPS vs 14.2k / 1147). Per phase every boss gained `dmg ×1.2`,
and Vorkagar added a full-board breath at `dmg×0.8`, six summoned adds, and a
1.4× enrage on top. Softened: phase ramp `×1.2 → ×1.12`, breath `0.8 → 0.55`,
enrage `1.4/1.15 → 1.25/1.10`, and its base HP 4000 → 3400.

The **Bloodlust escalation ramp is now capped at 2.0×** (was unbounded — 4× by
90s), because it disproportionately punished long boss fights where the boss's
own HP pool makes a fast finish impossible regardless of player strength.

## 5. Result

Win rates with rosters representative of each stage:

| Stage | Roster | Win | Survivors |
|---|---|---|---|
| Act I battle #1 | 4× tier-1 Common | **75%** | 2.7 / 4 |
| Act I battle #4 | starter +1 | 88% | 4.2 / 5 |
| Act I battle #8 | starter +1 | 63% | 2.5 / 5 |
| **Act I elite** | **unupgraded** | **0%** | 0 |
| **Act I elite** | **upgraded (tier 2–3)** | **100%** | 6 / 6 |
| Act I boss | early roster | 46% | 1.0 |
| Act II battle | tier-2 team | 96% | 4.7 / 6 |
| **Act II elite** | tier-2 team | **25%** | 0.9 |
| Act II boss | tier-2 team | 71% | 4.3 |
| Act III battle | endgame team | 83% | 7.3 / 8 |
| Act III elite | endgame team | 79% | 7.2 / 8 |
| Act III boss | endgame team | 83% | 5.4 / 8 |

Opening fights are contested but winnable (goal 2); elites are a wall to an
unupgraded roster and clear cleanly once fused (goal 3).

### Caveat on the harness

The sim models units, synergies, ults, terrain and enemy composition, but **not**
gear, relics, commander passives or meta upgrades — so real-run win rates will sit
somewhat above these figures. A reference roster with no armor/shields also badly
misreports AoE-heavy **boss** fights specifically (it implied the Act III boss
needed >32× power, while a realistic tanky endgame team wins 83%). Boss numbers
should always be read from a realistic composition, not a stat-scaled one.
