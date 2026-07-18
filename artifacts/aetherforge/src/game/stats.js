// @ts-nocheck
import { G } from "./engine-hex.js";
import { SC } from "./ui-render-core.js";

/* ---------- RUN STATISTICS (balancing telemetry) ----------
   Every run appends a detailed record to localStorage: commander, ascension, result,
   per-battle unit performance (damage dealt/taken, ultimates cast, survival), the
   order factions joined the draft pool, and the final army. Viewed via the 📊 Stats
   screen on the title page; export the raw JSON from there for offline analysis.
   Stored separately from META so "Reset Progress" keeps the balance data. */
export const STATS_KEY='aetherforge_stats_v1';
const MAX_RUNS=100;   // keep the most recent N runs so localStorage stays bounded
export function loadStats(){
  let s=null;
  try{ s=JSON.parse(localStorage.getItem(STATS_KEY)); }catch(e){}
  if(!s||!Array.isArray(s.runs)) s={runs:[]};
  return s;
}
export function saveStats(s){ try{ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }catch(e){} }
export let STATS=loadStats();

// called from newRun once the run state (incl. activeFactions) is fully set up
export function startRunStats(cmd){
  G._stats={ v:1, start:Date.now(), commander:cmd.id, commanderName:cmd.name, ascension:G.ascension||0,
    factionLog:(G.activeFactions||[]).map(f=>({f,act:1,src:'start'})), battles:[], done:false };
}
// called whenever a faction joins the run's draft pool mid-run (level-up, Town, event)
export function recordFactionAdd(f,src){
  if(G&&G._stats&&!G._stats.done) G._stats.factionLog.push({f,act:G.act,src:src||'pick'});
}
// called from endBattle (both outcomes) while G.battle is still intact
export function recordBattleStats(won){
  if(!G||!G._stats||G._stats.done||!G.battle)return;
  const b=G.battle;
  G._stats.battles.push({
    act:G.act, node:b.node&&b.node.t, enemy:b.enemyTheme||null, won:!!won, dur:Math.round(b.t*10)/10,
    units:b.P.filter(u=>!u.token).map(u=>({n:u.name,tier:u.tier||1,dmg:Math.round(u._dmgDealt||0),taken:Math.round(u._dmgTaken||0),ults:u._ults||0,alive:!!u.alive})),
    enemyUnits:b.E.filter(u=>!u.token).map(u=>({n:u.name,fac:u.efaction||b.enemyTheme||null,boss:!!u.boss||!!u.subboss,dmg:Math.round(u._dmgDealt||0),taken:Math.round(u._dmgTaken||0),ults:u._ults||0,alive:!!u.alive})),
    tokens:b.P.filter(u=>u.token).length, enemies:b.E.length,
  });
}
// called once per run from winGame ('win'), endBattle loss ('defeat'), or showTitle ('abandoned')
export function finishRunStats(result){
  if(!G||!G._stats||G._stats.done)return;
  const s=G._stats; s.done=true; s.end=Date.now(); s.result=result;
  s.actReached=G.act; s.nodesCleared=G.cleared||0; s.level=G.level||1;
  s.loreEarned=G.lore||0; s.goldEnd=G.gold||0;
  s.finalArmy=(G.army||[]).map(u=>({n:u.name,tier:u.tier||1}));
  s.factions=(G.activeFactions||[]).slice();
  STATS.runs.push(s);
  if(STATS.runs.length>MAX_RUNS) STATS.runs=STATS.runs.slice(-MAX_RUNS);
  saveStats(STATS);
}

/* ---------- 📊 stats screen ---------- */
const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
function aggRows(runs,keyFn){
  const m={};
  runs.forEach(r=>{ const k=keyFn(r); if(k==null)return; (m[k]=m[k]||{n:0,w:0,acts:0}); m[k].n++; if(r.result==='win')m[k].w++; m[k].acts+=r.actReached||1; });
  return Object.entries(m).sort((a,b)=>b[1].n-a[1].n);
}
export function showStats(){
  const R=STATS.runs, wins=R.filter(r=>r.result==='win').length;
  const battles=R.flatMap(r=>r.battles||[]);
  // per-unit aggregates across every recorded battle
  const um={};
  battles.forEach(b=>(b.units||[]).forEach(u=>{ const e=(um[u.n]=um[u.n]||{n:0,dmg:0,taken:0,ults:0,deaths:0}); e.n++; e.dmg+=u.dmg; e.taken+=u.taken; e.ults+=u.ults; if(!u.alive)e.deaths++; }));
  const unitRows=Object.entries(um).sort((a,b)=>b[1].dmg/b[1].n-a[1].dmg/a[1].n);
  // what kills runs: defeats grouped by enemy faction + node type
  const lm={};
  R.filter(r=>r.result==='defeat').forEach(r=>{ const last=(r.battles||[]).filter(b=>!b.won).slice(-1)[0]; if(!last)return; const k=(last.enemy||'?')+' · '+(last.node||'?')+' (Act '+last.act+')'; lm[k]=(lm[k]||0)+1; });
  // faction winrates: runs whose final pool contained the faction
  const fm={};
  R.forEach(r=>(r.factions||[]).forEach(f=>{ if(f==='Neutral')return; (fm[f]=fm[f]||{n:0,w:0}); fm[f].n++; if(r.result==='win')fm[f].w++; }));
  let html=`<div class="panel"><div class="lbl">📊 Run Statistics</div>
    <p class="tip" style="margin-bottom:10px">Balancing telemetry — last ${MAX_RUNS} runs are kept. Export the raw JSON for deeper analysis.</p>
    <div class="card" style="width:100%;margin-bottom:10px"><div class="cn" style="font-size:13px">Overview</div>
      <div class="cs" style="font-size:12px;color:#c9bbe0;margin-top:4px">Runs: <b>${R.length}</b> · Wins: <b>${wins}</b> (${pct(wins,R.length)}) · Battles recorded: <b>${battles.length}</b> (${pct(battles.filter(b=>b.won).length,battles.length)} won)</div></div>`;
  if(R.length){
    html+=`<div class="card" style="width:100%;margin-bottom:10px"><div class="cn" style="font-size:13px">By Commander</div><div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:4px">`;
    aggRows(R,r=>r.commanderName||r.commander).forEach(([k,v])=>{ html+=`${k}: ${v.n} runs · ${pct(v.w,v.n)} wins · avg act ${(v.acts/v.n).toFixed(1)}<br>`; });
    html+=`</div></div>`;
    html+=`<div class="card" style="width:100%;margin-bottom:10px"><div class="cn" style="font-size:13px">By Ascension</div><div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:4px">`;
    aggRows(R,r=>'A'+(r.ascension||0)).forEach(([k,v])=>{ html+=`${k}: ${v.n} runs · ${pct(v.w,v.n)} wins<br>`; });
    html+=`</div></div>`;
  }
  if(Object.keys(lm).length){
    html+=`<div class="card" style="width:100%;margin-bottom:10px"><div class="cn" style="font-size:13px">Run-Ending Battles</div><div class="cs" style="font-size:11px;color:#e8a59f;margin-top:4px">`;
    Object.entries(lm).sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>{ html+=`${k}: ${n} defeat${n>1?'s':''}<br>`; });
    html+=`</div></div>`;
  }
  if(unitRows.length){
    html+=`<div class="card" style="width:100%;margin-bottom:10px"><div class="cn" style="font-size:13px">Units — avg per battle (fielded ≥1×)</div>
      <div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:4px;max-height:220px;overflow-y:auto">`;
    unitRows.forEach(([n,v])=>{ html+=`${n}: ${v.n}× · dmg ${Math.round(v.dmg/v.n)} · taken ${Math.round(v.taken/v.n)} · ults ${(v.ults/v.n).toFixed(1)} · died ${pct(v.deaths,v.n)}<br>`; });
    html+=`</div></div>`;
  }
  if(Object.keys(fm).length){
    html+=`<div class="card" style="width:100%;margin-bottom:10px"><div class="cn" style="font-size:13px">Faction Winrates (in final pool)</div><div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:4px">`;
    Object.entries(fm).sort((a,b)=>b[1].n-a[1].n).forEach(([f,v])=>{ html+=`${f}: in ${v.n} runs · ${pct(v.w,v.n)} wins<br>`; });
    html+=`</div></div>`;
  }
  if(R.length){
    html+=`<div class="card" style="width:100%;margin-bottom:10px"><div class="cn" style="font-size:13px">Recent Runs</div><div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:4px">`;
    R.slice(-10).reverse().forEach(r=>{ html+=`${new Date(r.start).toLocaleDateString()} — ${r.commanderName||r.commander} A${r.ascension||0}: <b style="color:${r.result==='win'?'#5bbf6a':r.result==='defeat'?'#e0736b':'#9c8fb0'}">${r.result}</b> · act ${r.actReached} · ${(r.battles||[]).length} battles · lvl ${r.level}<br>`; });
    html+=`</div></div>`;
  }
  html+=`<div class="row" style="margin-top:12px;justify-content:space-between">
    <button class="small" onclick="showTitle()">← Back</button>
    <div class="row" style="gap:6px">
      <button class="small" onclick="exportStats()">⬇ Export JSON</button>
      <button class="small danger" onclick="clearStats()">Clear Stats</button>
    </div></div></div>`;
  SC.innerHTML=html;
}
export function exportStats(){
  const blob=new Blob([JSON.stringify(STATS,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='aetherforge-stats.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
export function clearStats(){
  if(!confirm('Delete all recorded run statistics?'))return;
  STATS={runs:[]}; saveStats(STATS); showStats();
}
