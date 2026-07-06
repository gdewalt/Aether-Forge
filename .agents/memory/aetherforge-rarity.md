---
name: Aetherforge unit rarity is authored data, not computed
description: Unit rarity (Common/Uncommon/Rare/Legendary) is a hand-set field on each unit, not derived from stats at runtime.
---

Rarity for each unit in `data-units.js` is an explicit `rar` argument passed to the `U(...)` helper (trailing param, after `ult`), not something computed from stats/power at boot.

**Why:** the previous system computed rarity at runtime by ranking units within each faction by a power formula and assigning positional bands (top unit = Legendary, next 2 = Rare, etc.), cached on `u._rar`. The user found this "defined strangely" — rarity should be an intentional design choice per unit, editable directly, not an emergent side-effect of a stat formula.

**How to apply:** to change how often a unit is offered/appears, edit its `rar` value directly in its `U(...)` call in `data-units.js` — no other file needs to change. `unitRarity(u)` in `data-loot.js` just reads `u.rar` (falling back to the old stat-threshold heuristic only for non-POOL units like tokens/transformed forms that have no authored `rar`). The old `assignRarities()`/`_rar`/`_rarFixed` machinery was removed since it's now dead code.
