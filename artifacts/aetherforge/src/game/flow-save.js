// @ts-nocheck
/* ---------- IN-PROGRESS RUN PERSISTENCE ----------
   Saves the current run (G) to localStorage between nodes so a refresh, tab close, or
   container restart doesn't discard it — the title screen then offers "Resume Run".
   Everything in G is JSON-safe except relics, which hold their apply()/onPick()/postBattle()
   functions: those are saved as ids and rehydrated from RELIC_BY_ID on load. Gear and stash
   are already id-based ({id}); units and the map are plain data. The transient G.battle is
   never saved — resume drops the player back on the map (a battle in progress is replayed).
   Stored separately from META, so this survives "Reset Progress" and vice-versa. */
import { G, setG } from "./engine-hex.js";
import { RELIC_BY_ID } from "./data-loot.js";

export const RUN_KEY='aetherforge_run_v1';
// Whitelist of run-defining fields to persist (excludes G.battle and function-bearing relics,
// which are handled specially, and battle-transient _fields we don't want carried across resume).
const RUN_FIELDS=['hp','gold','essence','cap','act','cleared','actCleared','lore','over','commander',
  'xp','level','benchBonus','routeTally','activeFactions','ascension','map','army','stash',
  '_stats','_lastPlace','_uidSeq','_scoutRows','fortifyNext'];

export function saveRun(){
  if(!G || G.over) return;                       // never persist a finished/absent run
  try{
    const o={v:1, relics:(G.relics||[]).map(r=>r.id)};
    for(const k of RUN_FIELDS) if(G[k]!==undefined) o[k]=G[k];
    localStorage.setItem(RUN_KEY, JSON.stringify(o));
  }catch(e){}
}
export function hasSavedRun(){
  try{ const o=JSON.parse(localStorage.getItem(RUN_KEY)); return !!(o&&o.v===1&&o.map&&o.army); }
  catch(e){ return false; }
}
// Restore the saved run into G (relic refs rehydrated). Returns true on success.
export function loadRun(){
  let o=null; try{ o=JSON.parse(localStorage.getItem(RUN_KEY)); }catch(e){}
  if(!o || o.v!==1 || !o.map || !o.army){ return false; }
  const g={};
  for(const k of RUN_FIELDS) if(o[k]!==undefined) g[k]=o[k];
  g.relics=(o.relics||[]).map(id=>RELIC_BY_ID[id]).filter(Boolean);   // functions come back with the refs
  g.over=false;
  setG(g);
  return true;
}
export function clearRun(){ try{ localStorage.removeItem(RUN_KEY); }catch(e){} }
