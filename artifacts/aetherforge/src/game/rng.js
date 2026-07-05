// @ts-nocheck
/* ============================================================
   AETHERFORGE prototype — deterministic hex auto-battler
   Implements: node map, hex deploy, magic-bar ultimates,
   faction + class synergies, win/loss (run ends on loss),
   reward picks. ~6 of the 17 factions for a playable slice.
   ============================================================ */

/* ---------- seeded RNG (mulberry32) ---------- */
export function makeRNG(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
export let RNG=makeRNG(Date.now()&0xffffffff);
export function setRNG(v){ RNG = v; }
export const rint=(n)=>Math.floor(RNG()*n);
export const pick=(arr)=>arr[rint(arr.length)];

