// @ts-nocheck
import { TT, hideTip, positionTip, showTip, tipHTML, toast } from "./ui-tooltips.js";
import { CLASS_SYN, FAC_SYN } from "./synergies.js";
import { COLS, G, GRIDH, GRIDW, HR, ROWS, hexCenter, hexDist } from "./engine-hex.js";
import { ENEMY_FACTIONS, ENEMY_SYN } from "./data-enemies.js";
import { FCOL } from "./data-units.js";
import { RNG, pick, rint } from "./rng.js";
import { SC, artOf, hasSprite, unitBodyHTML } from "./ui-render-core.js";
import { archetypeOf, calcSyn, drawGrid, fitGrid, mkLive } from "./ui-planning.js";
import { clone } from "./flow-forge.js";
import { endBattle } from "./flow-battle-end.js";
import { ensureGear } from "./flow-commanders.js";
import { terrainAt } from "./engine-battle-setup.js";

// Merges a unit's structured `passive` data (authored directly on its template in
// data-units.js/data-enemies.js, see U()/EU()) onto the live combat unit. Runs right after
// gear (mkLive applies equipment first), so the handful of fields gear can also grant
// combine the same way the old text-parser used to: strongest-wins for lifesteal/reflect/
// crit/armorPierce, additive-capped for armor (dr), multiplicative for chargeMul, and
// burn prefers whichever source already applied it (only burnDur always updates).
export function applyUnitAbility(u){
  const p=u.passive; if(!p) return;
  for(const k in p){
    const v=p[k];
    if(k==='lifesteal'||k==='reflect'||k==='crit'||k==='armorPierce') u[k]=Math.max(u[k]||0,v);
    else if(k==='dr') u.dr=Math.min(.85,(u.dr||0)+v);
    else if(k==='chargeMul') u.chargeMul=(u.chargeMul||1)*v;
    else if(k==='burn') u.burn=u.burn||v;
    else if(k==='selfRevive') u.selfRevive=p._reviveAsSkeleton?(u.selfRevive||v):v;
    else if(k==='_vs'||k==='_condArmor') u[k]={...(u[k]||{}),...v};
    else u[k]=v;
  }
}
/* ---------- TOKENS & CONSTRUCTS (GDD §8a) ----------
   Spawned mid-battle, free of Army Cap, never count toward synergy, capped per side. */
// Transformed creatures: each transform ultimate swaps the unit into one of these full forms —
// new name (so the sprite resolves by name), attack type/range, stat multipliers, and its OWN ultimate.
export const TRANSFORM_FORMS={
  'Seraph':            {art:'Seraph',         ico:'😇',cls:'Cleric', t:'r',rng:3, hp:1.0,dmg:2.0,as:1.2, ult:{k:'heal',v:300,r:3,name:'Radiant Grace'}},
  'Fire Drake':        {art:'Fire Drake',     ico:'🐉',cls:'Beast',  t:'r',rng:4, hp:1.0,dmg:2.2,as:1.15,ult:{k:'nova',v:2.4,r:2,name:'Dragonfire Breath'}},
  'Living Flame':      {art:'Living Flame',   ico:'🔥',cls:'Mage',   t:'r',rng:4, hp:1.0,dmg:2.2,as:1.2, ult:{k:'zone',v:2.0,r:2,name:'Conflagration'}},
  'Leviathan':         {art:'Leviathan',      ico:'🐋',cls:'Warrior',t:'m',rng:1, hp:1.0,dmg:2.0,as:1.0, ult:{k:'quake',v:2.0,r:2,name:'Tidal Crush'}},
  'Thunder Beast':     {art:'Thunder Beast',  ico:'🐃',cls:'Beast',  t:'m',rng:1, hp:1.0,dmg:2.1,as:1.2, ult:{k:'chain',v:2.0,r:4,name:'Thunderstampede'}},
  'Greater Phoenix':   {art:'Greater Phoenix',ico:'🦅',cls:'Beast',  t:'r',rng:3, hp:1.0,dmg:2.2,as:1.25,ult:{k:'nova',v:2.2,r:2,name:'Solar Flare'}},
  'Mountain Titan':    {art:'Mountain Titan', ico:'🗻',cls:'Guardian',t:'m',rng:1,hp:1.0,dmg:2.0,as:1.0, ult:{k:'quake',v:2.2,r:2,name:'Seismic Slam'}},
  'Brood Queen':       {art:'Brood Queen',    ico:'🦂',cls:'Beast',  t:'m',rng:1, hp:1.0,dmg:1.9,as:1.3, ult:{k:'summon',token:'swarmling',n:3,v:1,name:'Spawn Brood'}},
  'Grizzly Bear':      {art:'Grizzly Bear',   ico:'🐻',cls:'Beast',  t:'m',rng:1, hp:1.6,dmg:2.4,as:1.1, ult:{k:'berserk',v:0.5,d:0.3,name:'Feral Rage'}},
};
export const TOKENS={
  swarmling:{name:'Swarmling',art:'Swarmling',cls:'Beast',t:'m',rng:1,hp:120,dmg:18,as:1.2,mv:1.8,ico:'🐛',ult:{k:'none',name:'—'},hive:true,life:4},
  squirrel:{name:'Squirrel',art:'Squirrel',cls:'Beast',t:'m',rng:1,hp:110,dmg:20,as:1.3,mv:2.2,ico:'🐿️',ult:{k:'none',name:'—'},life:null},
  broodling:{name:'Broodling',art:'Broodling',cls:'Beast',t:'m',rng:1,hp:140,dmg:22,as:1.15,mv:1.7,ico:'🕷️',ult:{k:'none',name:'—'},web:true,life:6},
  skeleton:{name:'Skeleton',art:'Skeleton',cls:'Warrior',t:'m',rng:1,hp:200,dmg:50,as:.9,mv:1.2,ico:'💀',ult:{k:'none',name:'—'},life:5},
  turret:{name:'Gun Turret',art:'Gun Turret',cls:'Archer',t:'r',rng:5,hp:280,dmg:45,as:1.0,mv:0,ico:'🗼',ult:{k:'none',name:'—'},life:null},
  scrapbot:{name:'Scrap Bot',art:'Scrap Bot',cls:'Warrior',t:'m',rng:1,hp:180,dmg:22,as:1.0,mv:1.3,ico:'🤖',ult:{k:'none',name:'—'},life:null},
};
export const TOKEN_SIDE_CAP=12;
export function spawnToken(side,key,nearC,nearR,mult){
  const b=G.battle; if(!b||b.done)return null;
  const arr=side==='P'?b.P:b.E;
  if(arr.filter(u=>u.alive&&u.token).length>=TOKEN_SIDE_CAP)return null;
  // find nearest empty hex (spiral via BFS over neighbors)
  let spot=null; const seen=new Set([nearC+','+nearR]); const q=[{c:nearC,r:nearR}];
  while(q.length&&!spot){ const cur=q.shift();
    for(const n of neighbors(cur.c,cur.r)){ const k=n.c+','+n.r; if(seen.has(k))continue; seen.add(k);
      if(!occupied(n.c,n.r)){spot=n;break;} q.push(n); } }
  if(!spot)return null;
  const tpl=clone(TOKENS[key]); tpl.faction='Token';
  if(mult){tpl.hp=Math.round(tpl.hp*mult);tpl.dmg=Math.round(tpl.dmg*mult);}
  const u=mkLive(tpl,side,spot.c,spot.r);
  u.token=true; u.tokenLife=tpl.life; u.tkey=key;
  // Grizzlemaw — friendly turrets/robots get +50% stats and regenerate over the battle
  if((key==='turret'||key==='scrapbot') && living(side).some(a=>a._constructWarboss&&a.alive)){
    u.hp=Math.round(u.hp*1.5); u.maxhp=u.hp; u.dmg=Math.round(u.dmg*1.5);
    u._constructRegen=0.03;   // 3% max HP per second
    fx(u,'⚙ UPGRADED','#ffcf6a');
  }
  // Brood Mother — Swarmlings gain +HP and never expire
  if(key==='swarmling'){ const bm=living(side).find(a=>a._tokenHpBuff&&a.alive); if(bm){ u.hp=Math.round(u.hp*(1+bm._tokenHpBuff)); u.maxhp=u.hp; if(bm._tokenPersist)u.tokenLife=999; } }
  // Mortis — skeletons never expire
  if(key==='skeleton' && living(side).some(a=>a._skeletonPersist&&a.alive)) u.tokenLife=999;
  arr.push(u);
  fx(u,'+'+tpl.ico,'#d6caa0');
  return u;
}
export function countHive(side){ return living(side).filter(x=>x.faction==='Hivemind'||x.hive).length; }
export function summonAdds(bu,n,scale,filter){
  const b=G.battle; const fac=ENEMY_FACTIONS[bu.efaction]; if(!fac)return 0;
  let pool=fac.units; if(filter)pool=pool.filter(filter); if(!pool.length)pool=fac.units;
  let spawned=0;
  for(const nb of neighbors(bu.c,bu.r)){
    if(spawned>=n)break;
    if(occupied(nb.c,nb.r))continue;
    const t=clone(pick(pool));
    t.efaction=bu.efaction; t.ecol=bu.ecol;
    t.hp=Math.round(t.hp*(scale||0.8)); t.dmg=Math.round(t.dmg*(scale||0.8));
    b.E.push(mkLive(t,'E',nb.c,nb.r)); spawned++;
  }
  return spawned;
}
// per-boss signature mechanics (GDD §14), fired on each new phase threshold
export function bossMechanic(bu,phase,frac){
  const b=G.battle;
  switch(bu.mech){
    case 'summon':        // Old Gnashroot — summon a wolf pack
      summonAdds(bu,3,0.85,u=>u.cls==='Beast'); break;
    case 'plague':        // Mother Mireveil — double all field poison
      [...b.P,...b.E].forEach(u=>{ if(u.poisonT>0)u.poisonT+=2.5; }); fx(bu,'POX DOUBLES','#9ccc65','big'); break;
    case 'legionrevive':  // Colossus Prime — reactivate fallen automatons once
      if(!bu._legionRaised){ bu._legionRaised=true;
        const dead=b.E.filter(u=>!u.alive&&!u.boss&&!u.token).slice(0,4);
        dead.forEach(d=>{ if(!occupied(d.c,d.r)){ d.alive=true; d.hp=d.maxhp*0.6; fx(d,'⚑ RISEN','#cfd8dc','big'); } });
        if(!dead.length)summonAdds(bu,3,0.8);
      } break;
    case 'boardfreeze':   // Jarnvex — freeze the whole board
      living('P').forEach(u=>{ if(!u.ccImmune){u.stun=1.4;u.slowT=3;} }); fx(bu,'❄ BOARD FREEZE','#7cdcff','big'); break;
    case 'barrage':       // Forgelord Durn — mortar the densest cluster + cannon emplacements
      { const center=densestTarget(bu,living('P'));
        if(center){ const hit=living('P').filter(u=>hexDist(u,center)<=2);
          hit.forEach(u=>applyDamage(u, bu.dmg*1.4, 'atk', bu)); blastAt(center.c,center.r,'#ff7a3a'); }
        if(phase===2) summonAdds(bu,2,0.9,u=>u.t==='r');
      } break;
    case 'devour':        // X'thuul — devour a player unit to heal fully
      { const prey=living('P').sort((a,b)=>a.hp-b.hp)[0];
        if(prey){ prey.alive=false; fx(prey,'DEVOURED','#b48ae8','big'); bu.hp=bu.maxhp; fx(bu,'FULL HEAL','#b48ae8','big'); healRingAt(bu); }
      } break;
    case 'stormcall':     // Valdris — board-wide chain lightning
      living('P').forEach(u=>{ applyDamage(u, bu.dmg*0.6, 'atk', bu); }); fx(bu,'⚡ TEMPEST','#ffe97a','big'); break;
    case 'worldender':    // Vorkagar — full-board fire breath + enrage
      living('P').forEach(u=>{ applyDamage(u, bu.dmg*0.8, 'atk', bu); u.burnT=3; }); fx(bu,'🔥 WORLD-FIRE','#ff7043','big');
      if(phase===3){ bu.as*=1.4; bu.dmg*=1.15; }   // enrage
      summonAdds(bu,2,0.8); break;
    default:              // generic: summon 2 adds
      summonAdds(bu,2,0.8);
  }
}
export function bossPhaseFx(bu,phase){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(bu.c,bu.r);
  const d=document.createElement('div');d.className='ultflash';
  d.style.cssText=`left:${Math.max(10,ce.x-90)}px;top:${ce.y-44}px;font-size:22px;color:#ff8a7a;text-shadow:0 0 14px #9e2b25`;
  d.textContent='⚠ '+bu.name.split(',')[0]+' — PHASE '+phase+'!';
  g.appendChild(d);setTimeout(()=>d.remove(),1400);
  toast('⚠ Boss enters Phase '+phase+' — reinforcements!');
}
// ---- Enemy deployment: role-aware columns + varied per-battle formations (GDD §8) ----
export function hasRelic(id){ return (G.relics||[]).some(r=>r.id===id); }
// Compute enemy board positions once (role-aware columns + varied formations, GDD §8).
// Cached on G.battle.enemyPositions so the planning preview (Scrying Orb) and the actual
// battle use identical placements and the seeded RNG is consumed exactly once.
export function computeEnemyPositions(templates){
  const ENEMY_MIN_C=COLS-4;                 // enemy deploy zone: rightmost 4 columns (8..11)
  const occupied=new Set();
  const taken=(c,r)=>occupied.has(c+','+r) || terrainAt(c,r)==='rubble' || c<0||c>=COLS||r<0||r>=ROWS;
  const claim=(c,r)=>{occupied.add(c+','+r);};
  function bandFor(t){
    if(t.boss||t.subboss) return [COLS-1,COLS-1];
    if(t.t==='r' || t.cls==='Cleric' || t.cls==='Mage' || t.cls==='Archer') return [COLS-2,COLS-1];
    if(t.cls==='Rogue'||t.cls==='Beast') return [ENEMY_MIN_C+1,COLS-2];
    return [ENEMY_MIN_C, ENEMY_MIN_C+1];
  }
  const ROWMID=(ROWS-1)/2;
  const formations=['spread','clustered','flanks','staggered'];
  const formation=formations[Math.floor(RNG()*formations.length)];
  function rowOrder(){
    const rows=[...Array(ROWS).keys()];
    if(formation==='clustered') return rows.sort((a,bb)=>Math.abs(a-ROWMID)-Math.abs(bb-ROWMID));
    if(formation==='flanks')    return rows.sort((a,bb)=>Math.abs(bb-ROWMID)-Math.abs(a-ROWMID));
    if(formation==='staggered'){ const ev=rows.filter(r=>r%2===0), od=rows.filter(r=>r%2===1); return [...ev,...od]; }
    const off=Math.floor(RNG()*ROWS);
    return rows.map(r=>(r+off)%ROWS);
  }
  function placeOne(t){
    const [c0,c1]=bandFor(t);
    const rows=rowOrder();
    const bandCols=[]; for(let c=c0;c<=c1;c++)bandCols.push(c);
    const overflowCols=[]; for(let c=COLS-1;c>=ENEMY_MIN_C;c--)if(!bandCols.includes(c))overflowCols.push(c);
    const colTries=[...bandCols, ...overflowCols];
    for(const r of rows){ for(const c of colTries){ if(!taken(c,r)){ claim(c,r); return {c,r}; } } }
    for(let c=COLS-1;c>=ENEMY_MIN_C;c--)for(let r=0;r<ROWS;r++) if(!taken(c,r)){claim(c,r);return {c,r};}
    return {c:COLS-1,r:0};
  }
  const order=templates.map((t,i)=>({t,i})).sort((a,bz)=>{
    const rank=x=>{
      if(x.t.boss||x.t.subboss) return 4;
      if(x.t.t==='r'||x.t.cls==='Cleric'||x.t.cls==='Mage'||x.t.cls==='Archer') return 3;
      if(x.t.cls==='Rogue'||x.t.cls==='Beast') return 2;
      return 1;
    };
    return rank(a)-rank(bz);
  });
  const out=new Array(templates.length);
  for(const {t,i} of order){ const pos=placeOne(t); out[i]={t,c:pos.c,r:pos.r}; }
  return out;
}
// build live enemy units from the cached positions
export function placeEnemies(templates, E, mk){
  const b=G.battle;
  if(!b.enemyPositions) b.enemyPositions=computeEnemyPositions(templates);
  b.enemyPositions.forEach(p=>{ E.push(mk(p.t,'E',p.c,p.r)); });
}
export function beginCombat(){
  const b=G.battle;
  const mk=mkLive;
  let P=[], E=[];
  // remember where each unit was deployed so the next battle's plan screen can prefill it
  G._lastPlace=G._lastPlace||{};
  for(const k in b.placements){ const p=b.placements[k]; const au=G.army[p.idx]; if(au&&au._uid) G._lastPlace[au._uid]={c:p.c,r:p.r}; }
  for(const k in b.placements){const p=b.placements[k];P.push(mk(ensureGear(G.army[p.idx]),'P',p.c,p.r));}
  placeEnemies(b.enemyTemplates, E, mk);
  applySyn(P,true); applySyn(E,false);
  // commander signature passive (player side only)
  const cmd=G.commander;
  if(cmd==='aldric'){ P.forEach(u=>{ if(u.c>=2){ u.dr=Math.min(.85,(u.dr||0)+.10); u.hp+=60; u.maxhp=u.hp; } }); }
  else if(cmd==='myrra'){ P.forEach(u=>{ u.mag=Math.max(u.mag,20); }); }
  else if(cmd==='rakkan'){ P.forEach(u=>{ u.rakkanN=3; }); }
  else if(cmd==='korven'){ P.forEach(u=>{ u._korvenEligible=true; }); }
  else if(cmd==='silkweaver'){ E.forEach(u=>{ if(!u.ccImmune){ u.slowT=Math.max(u.slowT||0,3); u.slowStacks=Math.max(u.slowStacks||0,1); } }); }
  else if(cmd==='hollowqueen'){ P.forEach(u=>{ if(!u.token)u._queenRaise=true; }); }
  // Rest "Fortify" boon: +Max HP for this battle only (consumed once applied)
  if(G.fortifyNext){ const f=G.fortifyNext; P.forEach(u=>{ u.hp=Math.round(u.hp*(1+f)); u.maxhp=u.hp; }); G.fortifyNext=0; }
  [...P,...E].forEach(u=>{ if(u._startMag)u.mag=Math.max(u.mag||0,u._startMag); });   // Charged Runestone: opening magic charge
  // Grimgear Engineering: build turret(s) at battle start near a goblin
  const gg=P.filter(u=>u.faction==='Grimgear');
  const ggLvl=gg.length?Math.max(...gg.map(u=>u.grimgear||0)):0;
  if(ggLvl>=1){ b.P=P; b.E=E; const anchor=gg[0];
    spawnToken('P','turret',anchor.c,anchor.r, ggLvl>=2?1.3:1);
    if(ggLvl>=2) spawnToken('P','turret',anchor.c,anchor.r,1.3);
    P=b.P; }
  // battle event modifier (announced in deploy screen); applied pre-battle, so hp = maxhp
  if(b.mod){ b.mod.apply(P,E); [...P,...E].forEach(u=>{u.maxhp=u.hp;}); }
  // one-shot modifier granted by a narrative Event (Standing Stones etc.) — applies once, then clears
  if(G._eventMod){ try{ G._eventMod.apply(P,E); }catch(e){} [...P,...E].forEach(u=>{u.maxhp=u.hp;}); G._eventMod=null; }
  // infiltrate (Shadowstep Cloak): move eligible rogues to the enemy back columns,
  // cloaked (invisible to enemy targeting) for the first second of combat
  P.forEach(u=>{ if(u.infiltrate){ const col=COLS-2-rint(2); let rr=u.r; while(occupiedIn([...P,...E],col,rr))rr=(rr+1)%ROWS; u.c=col;u.r=rr; u._cloakT=1; }});
  b.P=P;b.E=E;b.t=0;b.log=[];b.phase='countdown';b.cd=3;b.acc=0;b.zones=[];
  showCombat();
  // RENDER loop ~33ms; SIM runs at fixed 30Hz inside, decoupled (spec: fixed timestep, render interpolates)
  b.timer=setInterval(()=>frame(),33);
}
export function applySyn(units,isPlayer){
  // synergy-count bonus from Game-Changer relics (player only)
  let synBonus=0;
  if(isPlayer && G.relics) G.relics.forEach(r=>{if(r.synBonus)synBonus+=r.synBonus;});
  const {fc,cc}=calcSyn(units);
  if(synBonus){ for(const f in fc)fc[f]+=synBonus; for(const c in cc)cc[c]+=synBonus; }
  for(const f in fc){const s=FAC_SYN[f];if(!s)continue;let lvl=0;s.bp.forEach((b,k)=>{if(fc[f]>=b)lvl=k+1;});if(lvl)s.apply(units,lvl);}
  for(const c in cc){const s=CLASS_SYN[c];if(!s)continue;let lvl=0;s.bp.forEach((b,k)=>{if(cc[c]>=b)lvl=k+1;});if(lvl)units.forEach(u=>{if(u.cls===c)s.apply(u,lvl);});}
  // run-long relics (player army only)
  if(isPlayer && G.relics) G.relics.forEach(r=>{ if(r.apply)r.apply(units,G); });
  // enemy faction synergy: give the enemy army its signature theme (GDD §14)
  if(!isPlayer){ const theme=G.battle&&G.battle.enemyTheme; const es=theme&&ENEMY_SYN[theme]; if(es)es(units,units.length); }
  units.forEach(u=>u.maxhp=u.hp);
}
export function occupiedIn(arr,c,r){return arr.some(u=>u.alive&&u.c===c&&u.r===r);}
export function showCombat(){
  let html=`<div class="panel"><div class="lbl">Battle — ${G.battle.node.nm}${G.battle.mod?` · ${G.battle.mod.ico} ${G.battle.mod.name}`:''}</div>
    <div class="row" style="justify-content:space-between;margin-bottom:6px">
      <span class="tip" id="btime">0.0s</span>
      <span class="tip">⏩ <a class="link" onclick="setSpeed(1)">1×</a> ·
        <a class="link" onclick="setSpeed(2)">2×</a> · <a class="link" onclick="setSpeed(4)">4×</a></span>
    </div>
    <div class="gridwrap" id="gridwrap"><div id="grid" style="width:${GRIDW}px;height:${GRIDH}px"></div></div>
    <div class="row" style="margin-top:10px;justify-content:center" id="combatStatus"></div></div>`;
  SC.innerHTML=html;
  drawGrid('combat');
  renderCombat();
  fitGrid();
}
export let SPEED=1;
export function setSpeed(s){SPEED=s;toast(s+'× speed');}
export function renderCombat(){
  document.querySelectorAll('.unit-tok.live').forEach(e=>e.remove());
  document.querySelectorAll('.zone-tile').forEach(e=>e.remove());
  const g=document.getElementById('grid');
  // damaging zones (rendered under units)
  (G.battle.zones||[]).forEach(z=>{
    z.tiles.forEach(t=>{
      const ce=hexCenter(t.c,t.r);
      const zt=document.createElement('div');zt.className='zone-tile';
      zt.style.cssText=`position:absolute;left:${ce.x-18}px;top:${ce.y-18}px;width:36px;height:36px;border-radius:8px;`+
        `background:${z.color};opacity:${Math.min(.5,0.18+z.life*0.04)};pointer-events:none;z-index:1;`+
        `display:flex;align-items:center;justify-content:center;font-size:13px`;
      zt.textContent=z.glyph;
      g.appendChild(zt);
    });
  });
  [...G.battle.P,...G.battle.E].forEach(u=>{
    if(!u.alive)return;const ce=hexCenter(u.c,u.r);const fc=(u.side==='E'?(u.ecol||'#a5453a'):FCOL[u.faction])||'#888';
    const d=document.createElement('div');d.className='unit-tok live';d.style.cssText=`--hs:70px;left:${ce.x-35}px;top:${ce.y-35}px;pointer-events:auto`;
    if(u._cloakT>0){ d.style.opacity=.45; d.style.filter='saturate(.4)'; }   // infiltrator cloak: shown as a ghost

    // --- combat juice: recent attack/hit drive transient animation classes ---
    const bt=G.battle?G.battle.t:0;
    if(u._atkFx!=null && bt-u._atkFx<0.28){ d.classList.add('jx-atk'); const L=8; d.style.setProperty('--lx',(u._atkVX*L).toFixed(1)+'px'); d.style.setProperty('--ly',(u._atkVY*L).toFixed(1)+'px'); }
    if(u._bigHit!=null && bt-u._bigHit<0.3){ d.classList.add('jx-bighit'); }
    else if(u._hitFx!=null && bt-u._hitFx<0.22){ d.classList.add('jx-hit'); }
    const hpp=Math.max(0,u.hp/u.maxhp*100), mgp=Math.min(100,u.mag);
    const ring=u.side==='P'?'tok-p':'tok-e';
    const bossSz=u.boss?(u.foot>=3?'122px':'100px'):null;
    const sz=u.boss?bossSz:u.subboss?'80px':u.token?'48px':'70px';const fs=u.boss?(u.foot>=3?'50px':'40px'):u.subboss?'38px':u.token?'24px':'34px';
    const sprH=u.boss?(u.foot>=3?158:130):u.subboss?112:u.token?62:98;  // standee heights (tokens are smaller minions)
    const useSpr=hasSprite(artOf(u));
    // Shield visuals: blue glow on the token + a cyan overlay on the HP bar sized to the shield fraction
    const shielded=u.shield>0;
    const shGlow=shielded?`box-shadow:0 0 ${6+ (u._shieldFx>0?10:0)}px ${2+(u._shieldFx>0?2:0)}px rgba(124,220,255,${0.55+(u._shieldFx>0?0.35:0)}), inset 0 0 6px rgba(124,220,255,.5);`:'';
    const shPct=shielded?Math.min(100,u.shield/u.maxhp*100):0;
    const body=unitBodyHTML(u,{ring,flip:(u.side==='E'),fc,size:useSpr?sprH:parseInt(sz),discSize:parseInt(sz),fs:parseInt(fs),extra:(shielded&&!useSpr)?shGlow:''});
    const shieldRing=(shielded&&useSpr)?`<div class="spr-shield" style="opacity:${0.5+(u._shieldFx>0?0.4:0)}"></div>`:'';
    const barsHTML=`<div class="bar"><i class="hpf" style="width:${hpp}%"></i>${shielded?`<i class="shf" style="width:${shPct}%"></i>`:''}</div>
      <div class="bar"><i class="mgf" style="width:${mgp}%"></i></div>`;
    d.innerHTML=`<div class="tok-stack${useSpr?' has-spr':''}">${body}${shieldRing}</div>
      ${debuffBadges(u)}
      ${useSpr?`<div class="spr-bars">${barsHTML}</div>`:barsHTML}`;
    d.addEventListener('mouseenter',e=>{HOVU=u;showTip(u,true,e.clientX,e.clientY);});
    d.addEventListener('mousemove',e=>positionTip(e.clientX,e.clientY));
    d.addEventListener('mouseleave',()=>{HOVU=null;hideTip();});
    g.appendChild(d);
  });
  // if hovering a unit that's still alive, refresh its tooltip content live
  if(HOVU && HOVU.alive){TT.innerHTML=tipHTML(HOVU,true);}
  else if(HOVU && !HOVU.alive){HOVU=null;hideTip();}
}
export let HOVU=null;
export function setHOVU(v){ HOVU = v; }
// ---- shared debuff model (used by token badges + tooltip) ----
export function activeDebuffs(u){
  const d=[];
  if(u.stun>0)        d.push({icon:'❄',label:'Frozen',color:'#7cdcff',detail:(u.stun).toFixed(1)+'s'});
  if(u.slowT>0||u.slowStacks>0){ const st=Math.max(1,u.slowStacks||0); const mv=Math.round((1-slowMoveRate(u))*100), at=Math.round((1-slowAtkRate(u))*100); d.push({icon:'🐌',label:'Slowed (−'+mv+'% move, −'+at+'% attack)',color:'#9fd0ff',detail:u.slowStacks>0?'×'+u.slowStacks:(u.slowT).toFixed(1)+'s'}); }
  if(u.bleedStacks>0) d.push({icon:'🩸',label:'Bleeding',color:'#e8736b',detail:'×'+u.bleedStacks});
  if(u.burnT>0)       d.push({icon:'🔥',label:'Burning',color:'#ffa14a',detail:(u.burnT).toFixed(1)+'s'});
  if(u.poisonT>0)     d.push({icon:'🟢',label:'Poisoned',color:'#9ccc65',detail:(u.poisonStacks>1?'×'+u.poisonStacks+' · ':'')+(u.poisonT).toFixed(1)+'s'});
  if(u.curseT>0)      d.push({icon:'☠',label:'Cursed (+25% dmg taken)',color:'#b07cd8',detail:(u.curseT).toFixed(1)+'s'});
  if(u._charmT>0)     d.push({icon:'💗',label:'Charmed (fighting for the enemy)',color:'#ff7ab0',detail:(u._charmT).toFixed(1)+'s'});
  return d;
}
export function debuffBadges(u){
  const d=activeDebuffs(u); if(!d.length)return '';
  return `<div class="debuffs">${d.map(x=>`<span class="db" title="${x.label}">${x.icon}</span>`).join('')}</div>`;
}
export function deathBurst(u){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(u.c,u.r);
  const col=u.side==='E'?'rgba(210,90,80,':'rgba(200,180,140,';
  for(let i=0;i<7;i++){
    const ang=RNG()*Math.PI*2, dist=10+RNG()*22;
    const dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist-8;
    const p=document.createElement('div');p.className='death-bit';
    const sz=2+RNG()*3;
    p.style.cssText=`left:${ce.x}px;top:${ce.y}px;width:${sz}px;height:${sz}px;background:${col}${(0.5+RNG()*0.3).toFixed(2)});--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px`;
    g.appendChild(p);setTimeout(()=>p.remove(),650);
  }
}
export function fx(u,txt,color,cls){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(u.c,u.r);
  const d=document.createElement('div');d.className='fx'+(cls?' '+cls:'');
  // small horizontal jitter so stacked numbers don't perfectly overlap
  const jx=(RNG?RNG()*16-8:Math.random()*16-8);
  d.style.cssText=`left:${ce.x-10+jx}px;top:${ce.y-24}px;color:${color||'#fff'}`;
  d.textContent=txt;g.appendChild(d);setTimeout(()=>d.remove(),1000);
}
export function ultFx(u){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(u.c,u.r);
  const d=document.createElement('div');d.className='ultflash';d.style.cssText=`left:${ce.x-30}px;top:${ce.y-30}px`;
  d.textContent=u.ult.name+'!';g.appendChild(d);setTimeout(()=>d.remove(),1100);
}
// ---- projectiles: animate a glyph from source hex to target hex ----
export const PROJ_GLYPH={Sylvan:'➳',Ironhold:'●',Emberkin:'🔥',Tidecallers:'❄',Leonin:'🌾',Gilded:'✦'};
export function spawnProjectile(src,tgt,opts){
  const g=document.getElementById('grid');if(!g)return;
  const a=hexCenter(src.c,src.r), bcen=hexCenter(tgt.c,tgt.r);
  const glyph=opts&&opts.glyph || PROJ_GLYPH[src.faction] || '•';
  const color=opts&&opts.color || '#ffe9a8';
  const p=document.createElement('div');p.className='proj'+(opts&&opts.spin?' spin':'');
  p.style.left=a.x+'px';p.style.top=a.y+'px';p.textContent=glyph;p.style.color=color;
  g.appendChild(p);
  const dur=opts&&opts.dur || 260; const t0=performance.now();
  // leave a little fading trail
  let lastTrail=0;
  function step(now){
    const k=Math.min(1,(now-t0)/dur);
    const x=a.x+(bcen.x-a.x)*k, y=a.y+(bcen.y-a.y)*k - Math.sin(k*Math.PI)*14; // slight arc
    p.style.transform=`translate(${x-a.x}px,${y-a.y}px)`;
    if(now-lastTrail>26){lastTrail=now;
      const tr=document.createElement('div');tr.className='trail';tr.style.cssText=`left:${x}px;top:${y}px;background:${color}`;
      g.appendChild(tr);setTimeout(()=>tr.remove(),350);
    }
    if(k<1)requestAnimationFrame(step); else p.remove();
  }
  requestAnimationFrame(step);
}
// ---- AoE blast ring at a hex ----
export function blastAt(c,r,radiusHexes,color){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(c,r);
  const px=(radiusHexes+0.6)*HR*2;
  const d=document.createElement('div');d.className='blast';
  d.style.cssText=`left:${ce.x-px/2}px;top:${ce.y-px/2}px;width:${px}px;height:${px}px;border-color:${color||'#f0d375'}`;
  g.appendChild(d);setTimeout(()=>d.remove(),520);
}
// ---- screen shake (grid trembles) ----
export function screenShake(){ const g=document.getElementById('grid'); if(!g)return; g.classList.remove('quaking'); void g.offsetWidth; g.classList.add('quaking'); setTimeout(()=>g&&g.classList.remove('quaking'),620); }
// ---- expanding shockwave ring (bigger, louder than a blast) ----
export function shockwaveAt(c,r,radiusHexes,color,delay){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(c,r);
  const px=(radiusHexes+0.9)*HR*2;
  setTimeout(()=>{ const g2=document.getElementById('grid'); if(!g2)return;
    const d=document.createElement('div');d.className='shockwave';
    d.style.cssText=`left:${ce.x-px/2}px;top:${ce.y-px/2}px;width:${px}px;height:${px}px;${color?'border-color:'+color:''}`;
    g2.appendChild(d);setTimeout(()=>d.remove(),640);
  }, delay||0);
}
// ---- debris kicked up by a quake ----
export function debrisBurst(c,r,n){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(c,r);
  const bits=['🪨','▪','◾','🪨','●']; 
  for(let i=0;i<(n||5);i++){
    const d=document.createElement('div');d.className='debris';d.textContent=bits[(Math.random()*bits.length)|0];
    d.style.cssText=`left:${ce.x+(Math.random()*30-15)}px;top:${ce.y+(Math.random()*10-5)}px;--dx:${(Math.random()*44-22)|0}px;--rot:${(Math.random()*360)|0}deg;color:#b98b52`;
    g.appendChild(d);setTimeout(()=>d.remove(),720);
  }
}
// ---- piercing beam line drawn between two hexes, with muzzle flash ----
export function beamLine(src,tgt,color){
  const g=document.getElementById('grid');if(!g)return;
  const a=hexCenter(src.c,src.r), b=hexCenter(tgt.c,tgt.r);
  const dx=b.x-a.x, dy=b.y-a.y; const len=Math.hypot(dx,dy)+HR; const ang=Math.atan2(dy,dx)*180/Math.PI;
  const line=document.createElement('div');line.className='beamline';
  line.style.cssText=`left:${a.x}px;top:${a.y-5}px;width:${len}px;transform:rotate(${ang}deg)`;
  if(color)line.style.background=`linear-gradient(90deg,transparent,${color} 15%,#fff 50%,${color} 85%,transparent)`;
  g.appendChild(line);setTimeout(()=>line.remove(),440);
  const m=document.createElement('div');m.className='muzzle';const ms=HR*1.6;
  m.style.cssText=`left:${a.x-ms/2}px;top:${a.y-ms/2}px;width:${ms}px;height:${ms}px`;
  g.appendChild(m);setTimeout(()=>m.remove(),400);
}
export function healRingAt(u){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(u.c,u.r);
  const px=HR*2.4;const d=document.createElement('div');d.className='heal-ring';
  d.style.cssText=`left:${ce.x-px/2}px;top:${ce.y-px/2}px;width:${px}px;height:${px}px`;
  g.appendChild(d);setTimeout(()=>d.remove(),600);
}
export function living(side){return G.battle[side].filter(u=>u.alive);}
// A "spore cloud" = any spore-tagged damaging zone. This is the single definition all
// spore-referencing abilities use: standing on a spore zone's tile counts as being in a cloud.
export function inSporeCloud(u){
  const zs=G.battle&&G.battle.zones; if(!zs)return false;
  for(const z of zs){ if(z.spore && z.tiles.some(t=>t.c===u.c&&t.r===u.r)) return true; }
  return false;
}
export const ENEMY_HEAL_MULT=0.55;   // enemy healing is markedly less effective than the player's
export const PLAYER_HEAL_MULT=0.85;  // player healing trimmed slightly across the board (was 1.0)
export function healScale(healer){ return healer&&healer.side==='E' ? ENEMY_HEAL_MULT : PLAYER_HEAL_MULT; }
export function enemyOf(u){return living(u.side==='P'?'E':'P');}

export const TICK=1/30;                 // fixed sim timestep (spec: 30 ticks/sec)
export const PACE=0.7;                  // combat pace factor (spec's #1 tuning lever): <1 = longer, more watchable fights
export const GLOBAL_DIFF=1.0;           // global difficulty ease: <1 lowers all enemy HP & damage uniformly
// Per-act balance knobs — multipliers applied to ALL enemy HP / damage (rank-and-file, elites, bosses).
// Index by act (1/2/3); index 0 is an unused padding slot so ACT_HP_MULT[act] reads naturally.
// Set to 1.0 for no change; raise to make an act harder, lower to ease it.
export const ACT_HP_MULT  = [1.0, 1.0, 1.5, 2.0];   // [pad, Act I, Act II, Act III]
export const ACT_DMG_MULT = [1.0, 1.0, 1.2, 1.5];   // [pad, Act I, Act II, Act III]
export function actHpMult(){  return ACT_HP_MULT[Math.min(3, G.act||1)]  || 1.0; }
export function actDmgMult(){ return ACT_DMG_MULT[Math.min(3, G.act||1)] || 1.0; }
export const MOVE_BASE=1.1;             // seconds-per-hex = MOVE_BASE / unit.mv  (higher = slower, more visible movement)
// Slow effect: strongly hampers movement, and slightly hampers attack speed.
// Slow effect: strongly hampers movement, slightly hampers attack speed — and STACKS intensify both.
export const SLOW_MOVE_BASE=0.55, SLOW_MOVE_PER_STACK=0.09, SLOW_MOVE_FLOOR=0.28;  // move cooldown rate
export const SLOW_ATK_BASE=0.85,  SLOW_ATK_PER_STACK=0.05, SLOW_ATK_FLOOR=0.62;    // attack cooldown rate
// effective rate multiplier for a slowed unit (lower = slower). stacks default to 1 when a slow
// source set only the timer (e.g. Banish), so any slow is at least as strong as one stack.
export function slowMoveRate(u){ if(!(u.slowT>0))return 1; const st=Math.max(1,u.slowStacks||0); return Math.max(SLOW_MOVE_FLOOR, SLOW_MOVE_BASE-(st-1)*SLOW_MOVE_PER_STACK); }
export function slowAtkRate(u){ if(!(u.slowT>0))return 1; const st=Math.max(1,u.slowStacks||0); return Math.max(SLOW_ATK_FLOOR, SLOW_ATK_BASE-(st-1)*SLOW_ATK_PER_STACK); }
export const PHASE_NAMES={countdown:'Countdown',advance:'Advance',clash:'Clash',escalation:'Escalation ⚡'};
export function frame(){
  const b=G.battle; if(!b||b.done)return;
  if(b.phase==='countdown'){
    b.cd-=0.033*SPEED;
    if(b.cd<=0){b.phase='advance';} 
    renderCombat(); renderPhase(); return;
  }
  // advance the deterministic sim by (SPEED) ticks worth of time, decoupled from render
  b.acc += 0.033*SPEED;
  let steps=0;
  while(b.acc>=TICK && !b.done && steps<8){ simTick(); b.acc-=TICK; steps++; }
  renderCombat(); renderPhase();
}
export function escFactor(t){ return t>30 ? 1+(t-30)*0.05 : 1; }  // Bloodlust ramp (prototype: from 30s)

// ----- one fixed 30Hz tick, following the GDD order of operations -----
export function simTick(){
  const b=G.battle; b.t+=TICK;
  if(b.phase==='advance' && b.t>=2) b.phase='clash';       // contact window
  const esc=escFactor(b.t);
  if(esc>1 && b.phase==='clash') b.phase='escalation';
  const all=[...b.P,...b.E].filter(u=>u.alive);

  // (1) STATUS EFFECTS tick first
  for(const u of all){
    if(u.slowT>0)u.slowT-=TICK;
    if(u._regenIdle!=null) u._idleT=(u._idleT||0)+TICK;
    if(u._condArmor) updateCondArmor(u);
    if(u._markT>0){ u._markT-=TICK; if(u._markT<=0)u._marked=false; }
    if(u._counterCD>0)u._counterCD-=TICK;
    if(u._diveMoveBuff){ u._diveT=(u._diveT==null?4:u._diveT)-TICK; if(u._diveT<=0)u._diveMoveBuff=0; }
    if(u._constructRegen && u.hp<u.maxhp){ u.hp=Math.min(u.maxhp,u.hp+u.maxhp*u._constructRegen*TICK); }
    if(u._shockedT>0){ u._shockedT-=TICK; if(u._shockedT<=0)u._shocked=false; }
    if(u._cloakT>0){ u._cloakT-=TICK; if(u._cloakT<=0){ u._cloakT=0; fx(u,'🌫','#b9c4d0'); } }   // infiltrator cloak wears off
    if(u.shieldT>0){ u.shieldT-=TICK; if(u.shieldT<=0){ u.shield=0; } }
    if(u._shieldFx>0)u._shieldFx-=TICK;
    if(u._healAST>0){ u._healAST-=TICK; if(u._healAST<=0)u._healAS=0; }
    if(u._periodicSlow){ u._pslowT=(u._pslowT||0)-TICK; if(u._pslowT<=0){ u._pslowT=u._periodicSlow.every; const foes=enemyOf(u).filter(f=>f.alive&&hexDist(f,u)<=u._periodicSlow.range); if(foes.length){ const t=foes.sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; t.slowT=Math.max(t.slowT||0,2); t.slowStacks=Math.min(5,(t.slowStacks||0)+1); fx(t,'❄','#9fd0ff'); } } }
    if(u._decayStacks>0){ u._decayT=(u._decayT||0)+TICK; const dmg=u.maxhp*0.0010*Math.min(5,u._decayStacks); applyDamage(u,dmg,'dot'); if(u._decayT>=1){ u._decayT=0; u._decayStacks=Math.min(5,u._decayStacks+1); const near=living(u.side).filter(e=>e!==u&&e.alive&&hexDist(e,u)<=1&&!(e._decayStacks>0))[0]; if(near){near._decayStacks=1;} } }
    if(u._periodicMeteor){ u._metT=(u._metT||0)-TICK; if(u._metT<=0){ u._metT=u._periodicMeteor.every; const foes=enemyOf(u).filter(f=>f.alive); if(foes.length){ const t=foes[Math.floor(RNG()*foes.length)]; applyDamage(t,u.dmg*1.5*PACE,'dot',u); blastAt(t.c,t.r,1,'#c8a6ff'); } } }
    if(u._periodicTeamHeal){ u._pthT=(u._pthT||0)-TICK; if(u._pthT<=0){ u._pthT=u._periodicTeamHeal.every; if(u._periodicTeamHeal.lowest){ const t=living(u.side).filter(m=>m!==u&&m.hp<m.maxhp).sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp)[0]; if(t){t.hp=Math.min(t.maxhp,t.hp+t.maxhp*u._periodicTeamHeal.amt*healScale(u));healRingAt(t);u.hp=Math.max(1,u.hp-u.maxhp*0.04);} } else { living(u.side).forEach(m=>{ if(m.faction===u._periodicTeamHeal.fac&&m.hp<m.maxhp){m.hp=Math.min(m.maxhp,m.hp+m.maxhp*u._periodicTeamHeal.amt);healRingAt(m);} }); u.hp=Math.max(1,u.hp-u.maxhp*0.05); } } }
    // Queen's Roar (Pride Matriarch): periodically raises nearby same-faction allies' max Bleed stacks and (once) their attack speed
    if(u._periodicFactionBuff){ u._pfbT=(u._pfbT||0)-TICK; if(u._pfbT<=0){ u._pfbT=u._periodicFactionBuff.every;
      living(u.side).forEach(m=>{ if(m.faction===u._periodicFactionBuff.fac){
        if(u._periodicFactionBuff.bleedCap) m.bleedBonus=Math.max(m.bleedBonus||0,u._periodicFactionBuff.bleedCap);
        if(u._periodicFactionBuff.asAmt && !m._pfbASApplied){ m.as*=(1+u._periodicFactionBuff.asAmt); m._pfbASApplied=true; }
        fx(m,'👑','#f4c542');
      } });
    } }
    if(u._burnFieldAmp && u.burnT===undefined){} // marker only; applied in DoT below
    if(u._healCutT>0){ u._healCutT-=TICK; if(u._healCutT<=0)u._healCut=0; }
    if(u._regenStationary && (u.movecd||0)>0 && u._idleT>0.3 && u.hp<u.maxhp){ u.hp=Math.min(u.maxhp,u.hp+u.maxhp*u._regenStationary*TICK); }
    if(u._slowAura){ enemyOf(u).forEach(e=>{ if(hexDist(e,u)<=(u._slowAura.range||1)){ e.slowT=Math.max(e.slowT||0,0.5); } }); }
    if(u._burnSpread && u.burnT>0){ enemyOf(u).forEach(e=>{ if(e!==u&&hexDist(e,u)<=1&&!(e.burnT>0)&&RNG()<0.3){ e.burnT=1.2; } }); }
    if(u._periodicSummon){ u._psumT=(u._psumT||0)-TICK; if(u._psumT<=0){ u._psumT=u._periodicSummon.every; const cnt=u._periodicSummon.count||1; let nc=u.c,nr=u.r; if(u._periodicSummon.nearLowAlly){ const low=living(u.side).filter(m=>m!==u).sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp)[0]; if(low){nc=low.c;nr=low.r;} } for(let i=0;i<cnt;i++)spawnToken(u.side,u._periodicSummon.key,nc,nr,u._periodicSummon.mult); if(u._periodicSummon.healHive){ const h=living(u.side).filter(m=>m!==u&&m.faction==='Hivemind'&&m.hp<m.maxhp).sort((a,b)=>a.hp-b.hp)[0]; if(h){h.hp=Math.min(h.maxhp,h.hp+h.maxhp*0.08);healRingAt(h);} } } }
    if(u._periodicCharge){ u._pcT=(u._pcT||0)-TICK; if(u._pcT<=0){ u._pcT=u._periodicCharge.every; const al=living(u.side).filter(m=>m!==u).sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; if(al)al.mag=Math.min(100,al.mag+u._periodicCharge.amt); } }
    if(u._regenIdle && u._idleT>0.6 && u.hp<u.maxhp){ u.hp=Math.min(u.maxhp,u.hp+u.maxhp*u._regenIdle*TICK); }
    if(terrainAt(u.c,u.r)==='lava'){ applyDamage(u, u.maxhp*0.004, 'dot'); u._lavaFx=(u._lavaFx||0)-TICK; if(u._lavaFx<=0){ u._lavaFx=0.5; fx(u,'🌋','#ff7a3a'); } }   // lava burns ~12%/s
    if(u._sporeHeal && u.hp<u.maxhp && inSporeCloud(u)){ u.hp=Math.min(u.maxhp,u.hp+u.maxhp*u._sporeHeal*TICK); }
    if(u._periodicHeal){ u._phT=(u._phT||0)-TICK; if(u._phT<=0){ u._phT=u._periodicHeal.every; let pool=living(u.side).filter(m=>m!==u&&hexDist(m,u)<=u._periodicHeal.range); if(!u._cleanse)pool=pool.filter(m=>m.hp<m.maxhp); if(pool.length){ let t; if(u._cleanse){ const debuffed=pool.filter(m=>m.slowT>0||m.burnT>0||m.poisonT>0||m.bleedStacks>0||m.curseT>0); t=debuffed.length?debuffed.sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp)[0]:pool.sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp)[0]; } else t=pool.sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp)[0]; if(t.hp<t.maxhp)t.hp=Math.min(t.maxhp,t.hp+u._periodicHeal.amt*healScale(u)*(1-(t._healCut||0))); if(u._cleanse)cleanseDebuffs(t); healRingAt(t); if(u._periodicHealCharge)t.mag=Math.min(100,t.mag+u._periodicHealCharge); if(u._healGrantsAS){t._healAS=u._healGrantsAS;t._healAST=3;} if(u._healShield)applyShield(t,u._periodicHeal.amt*0.5*healScale(u)); } } }
    if(u._periodicShield){ u._psT=(u._psT||0)-TICK; if(u._psT<=0){ u._psT=u._periodicShield.every; if(u._periodicShield.self){ [u,...living(u.side).filter(m=>m!==u&&hexDist(m,u)<=1)].forEach(t=>{applyShield(t,u._periodicShield.amt*healScale(u));}); } else { const allies=living(u.side).filter(m=>m!==u&&hexDist(m,u)<=u._periodicShield.range); if(allies.length){ const t=allies.sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; applyShield(t,u._periodicShield.amt*healScale(u)); } } } }
    if(u.burnT>0){ u.burnT-=TICK; const vael=[...b.P,...b.E].find(a=>a.alive&&a._burnFieldAmp&&a.side!==u.side); const amp=vael?(1+vael._burnFieldAmp):1; applyDamage(u, u.maxhp*0.0018*(u.burnMul||1)*amp, 'dot'); }
    if(u.poisonT>0){ u.poisonT-=TICK; applyDamage(u, u.maxhp*0.0015*Math.max(1,u.poisonStacks||0), 'poison'); if(u.poisonT<=0)u.poisonStacks=0; }   // stacks (from spore clouds) scale the DoT; on-hit poison stays 1×
    if(u.regen>0&&u.hp<u.maxhp&&u.alive){ u.hp=Math.min(u.maxhp,u.hp+u.maxhp*u.regen*TICK*healScale(u)); }   // Verdant Cuirass regen
    if(u.curseT>0)u.curseT-=TICK;
    if(u.stun>0)u.stun-=TICK;
    if(u._charmT>0){ u._charmT-=TICK; if(u._charmT<=0 && u._charmHome){ u.side=u._charmHome; u._charmHome=null; u.tgt=null; u.retgt=0; fx(u,'freed','#9c8fb0'); } }
    if(u.token&&u.tokenLife!=null){ u.tokenLife-=TICK; if(u.tokenLife<=0){ u.alive=false; fx(u,'✦','#9c8fb0'); } }
  }
  // (1b) DAMAGING ZONES — units standing on a hostile zone tile take damage; zones decay
  if(b.zones&&b.zones.length){
    for(const z of b.zones){
      // Mycelia — while she lives, her side's spore clouds don't decay; otherwise normal decay
      const cloudMaster = z.spore && living(z.side).some(a=>a._cloudMaster&&a.alive);
      if(!cloudMaster) z.life-=TICK;
      z.tick=(z.tick||0)+TICK;
      if(z.tick>=0.5){ z.tick=0;
        for(const u of all){ if(u.side===z.side)continue;
          if(z.tiles.some(t=>t.c===u.c&&t.r===u.r)){
            // spore clouds poison instead of dealing direct damage: each tick inside adds a stack (cap 5)
            if(z.spore){ if(!u.ccImmune){ u.poisonT=Math.max(u.poisonT||0,2.5); u.poisonStacks=Math.min(5,(u.poisonStacks||0)+1); } }
            else applyDamage(u, z.dmg*0.5*PACE, 'dot', null);
            if(z.spore && cloudMaster){ u.slowT=Math.max(u.slowT||0,1); u.slowStacks=Math.max(u.slowStacks||0,1); }
          }
        }
      }
    }
    b.zones=b.zones.filter(z=>z.life>0);
  }

  // boss phase transitions (GDD §9 + §14 signature mechanics)
  for(const bu of all){
    if(!bu.boss||!bu.alive)continue;
    bu._phase=bu._phase||1;
    const frac=bu.hp/bu.maxhp;
    const want= frac<=0.33?3 : frac<=0.66?2 : 1;
    if(want>bu._phase){
      bu._phase=want;
      bu.dmg*=1.2;
      bossPhaseFx(bu,want);
      bossMechanic(bu,want,frac);
    }
    // continuous mechanics that don't depend on phase thresholds
    if(bu.mech==='plunder'){ /* handled on-kill in applyDamage */ }
  }

  // per-unit decision priority (spec): ult > ability(support) > attack > move
  const deaths=[];
  for(const u of all){
    if(!u.alive)continue;
    if(u.stun>0)continue;                                   // (rooted could still attack; we keep simple)
    // ---- TARGET SELECTION with stickiness (units commit to a fight) ----
    u.retgt-=TICK;
    const curOK = u.tgt && u.tgt.alive && !(u.tgt._cloakT>0);   // a target that cloaks is dropped like a dead one
    const effR = u.rng + ((terrainAt(u.c,u.r)==='high'&&u.t==='r')?1:0);
    const inRange = curOK && hexDist(u,u.tgt)<=effR;
    if(!curOK){
      // current target gone — acquire a fresh one right away
      u.tgt=acquireTarget(u); u.retgt=RETGT_TIME;
    } else if(inRange){
      // actively engaging: stay locked on; don't abandon a fight we're in
      // (refresh the timer so we won't immediately re-evaluate the moment we step out of range)
      u.retgt=Math.max(u.retgt,0.5);
    } else if(u.retgt<=0){
      // still closing on the target and the timer lapsed — re-evaluate, but only switch
      // to a clearly better candidate so units don't thrash between near-equal foes
      const cand=acquireTarget(u);
      if(cand && cand!==u.tgt && betterTarget(u,cand,u.tgt)) u.tgt=cand;
      u.retgt=RETGT_TIME;
    }

    // (2) ULTIMATE if bar full
    if(u.mag>=100){ castUlt(u,esc); u.mag=0; continue; }

    // (3)/(4) SUPPORT ability: clerics prefer healing a wounded ally over attacking
    if(u.arch==='support'){
      const ally=woundedAlly(u);
      if(ally){
        u.atkcd-=TICK*slowAtkRate(u);
        if(u.atkcd<=0){ u.atkcd=1/u.as; const heal=(u.ult.v?u.ult.v*0.18:60)*(u.healMul||1)*healScale(u);
          if(!ally.noHeal){ ally.hp=Math.min(ally.maxhp,ally.hp+heal); fx(ally,'+'+Math.round(heal),'#5bbf6a'); }
          u.mag=Math.min(100,u.mag+8*(u.chargeMul||1)); }
        continue;
      }
    }

    const tgt=u.tgt; if(!tgt){continue;}
    const d=hexDist(u,tgt);
    const onHigh=terrainAt(u.c,u.r)==='high';
    let effRng=u.rng+(onHigh&&u.t==='r'?1:0);
    if(u._condRange){
      const cr=u._condRange;
      let on=false;
      if(cr.when==='allyAdj') on=living(u.side).some(a=>a!==u&&hexDist(a,u)<=1);
      else on=!enemyOf(u).some(e=>hexDist(e,u)<=1);   // default: noEnemyAdj
      if(on)effRng+=cr.amt;
    }
    // (5) ATTACK if in range
    if(d<=effRng){
      u.atkcd-=TICK*slowAtkRate(u)*auraAtkSpeed(u)*selfAtkSpeedMul(u);
      if(u.atkcd<=0){
        u.atkcd=1/u.as;
        u._idleT=0;   // attacked this tick — reset idle timer (for regen-while-idle abilities)
        if(u._asPerTravel)u._travelDist=0;   // Galeclaw: reset travel charge after attacking
        let dmg=u.dmg*esc*PACE*auraBonus(u)*condDamageMul(u);
        if(u._selfBurnDmg)dmg*=(1+u._selfBurnDmg);
        if(u.token){ const aura=living(u.side).find(a=>a._tokenDmgAura&&!a.token&&hexDist(a,u)<=a._tokenDmgAura.range); if(aura)dmg*=(1+aura._tokenDmgAura.amt); }
        if(u._tokenDmgAura && u.token)dmg*=1;
        if(u._nthHit){ u._hitCount=(u._hitCount||0)+1; if(u._hitCount%u._nthHit.n===0)dmg*=(1+u._nthHit.amt); }
        if(u._markAmp){ if(tgt._marked)dmg*=(1+u._markAmp); tgt._marked=true; tgt._markT=4; }
        if(u.hiveScale)dmg*=1+0.03*countHive(u.side);
        if(onHigh&&u.t==='r')dmg*=1.10;
        let isCrit=u.crit&&RNG()<u.crit; if(isCrit)dmg*=1.5;
        if(isCrit) fx(u,'CRIT!','#ffd375','crit');   // floats up from the attacker; the target shows the ✶ damage number
        let rakkanBleed=false;
        if(u.rakkanN>0){ u.rakkanN--; dmg*=1.25; rakkanBleed=true; }
        if(u.t==='r' && u.rng>1){
          // ranged: fly a projectile, damage lands on impact
          const T=tgt, A=u, D=dmg, CR=isCrit, RB=rakkanBleed;
          spawnProjectile(u,tgt,{});
          setTimeout(()=>{ if(T.alive&&A.alive!==undefined){ applyDamage(T,D,'atk',A,CR); if(RB&&T.alive)T.bleedStacks=Math.min(5,(T.bleedStacks||0)+1); if(A._splash)splashHit(A,T,D); if(A._chainBolt)chainBolt(A,T,D); if(A._pierce)pierceHit(A,T,D); if(A._shockChance&&T.alive&&RNG()<A._shockChance){T.stun=Math.max(T.stun||0,0.4);T._shocked=true;T._shockedT=3;fx(T,'⚡','#ffe97a');} if(A._decayTouch&&T.alive&&!(T._decayStacks>0)){T._decayStacks=1;fx(T,'☠','#9c7fb0');} } },240);
        } else {
          applyDamage(tgt,dmg,'atk',u,isCrit);
          if(rakkanBleed&&tgt.alive)tgt.bleedStacks=Math.min(5,(tgt.bleedStacks||0)+1);
          if(u._splash)splashHit(u,tgt,dmg);
          if(u._chainBolt)chainBolt(u,tgt,dmg);
          if(u._pierce)pierceHit(u,tgt,dmg);
          if(u._igniteNearby){ const f=enemyOf(u).filter(e=>e!==tgt&&e.alive&&hexDist(e,tgt)<=2&&!(e.burnT>0))[0]; if(f){f.burnT=1.5;fx(f,'🔥','#ff8a3a');} }
          if(u._shockChance&&tgt.alive&&RNG()<u._shockChance){ tgt.stun=Math.max(tgt.stun||0,0.4); tgt._shocked=true; tgt._shockedT=3; fx(tgt,'⚡','#ffe97a'); }
          if(u._decayTouch&&tgt.alive&&!(tgt._decayStacks>0)){ tgt._decayStacks=1; fx(tgt,'☠','#9c7fb0'); }
        }
        if(u._selfBurnDmg||u._selfRecoil){ const cost=(u._selfBurnCost||0)*u.maxhp + (u._selfRecoil||0)*dmg; if(cost>0){u.hp-=cost;} }
        u._atkFx=G.battle.t; { const sc=hexCenter(u.c,u.r), tc=hexCenter(tgt.c,tgt.r); let dx=tc.x-sc.x, dy=tc.y-sc.y; const m=Math.hypot(dx,dy)||1; u._atkVX=dx/m; u._atkVY=dy/m; }   // juice: lunge toward target's actual position
        u.mag=Math.min(100,u.mag+9*(u.chargeMul||1)*(terrainAt(u.c,u.r)==='sacred'?1.25:1));   // charge from dealing damage (sacred ground +25%)
        if(u._healAllyOnHit){ const al=living(u.side).filter(m=>m!==u&&m.hp<m.maxhp).sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; if(al){al.hp=Math.min(al.maxhp,al.hp+dmg*u._healAllyOnHit*healScale(u));healRingAt(al);} }
        if(u._grantAllyCharge){ const al=living(u.side).filter(m=>m!==u&&hexDist(m,u)<=2).sort((a,b)=>b.mag-a.mag)[0]; if(al)al.mag=Math.min(100,al.mag+u._grantAllyCharge); }
        if(u._nthSpawn){ u._nspCount=(u._nspCount||0)+1; if(u._nspCount%u._nthSpawn.n===0)spawnToken(u.side,u._nthSpawn.key,u.c,u.r); }
        if(u._armorShred&&tgt.alive){ tgt._shred=Math.min(u._armorShred.max,(tgt._shred||0)+u._armorShred.amt); tgt.dr=Math.max(0,(tgt._drBase!=null?tgt._drBase:(tgt._drBase=tgt.dr||0))-tgt._shred/100); }
        if(u._healCut&&tgt.alive){ tgt._healCut=u._healCut; tgt._healCutT=3; }
      }
    } else {
      if(u.mv<=0)continue;   // stationary constructs (turrets) never move
      // (6) MOVE toward target — gated by a move cooldown so steps are visible
      u.movecd=(u.movecd||0)-TICK*slowMoveRate(u)*(u._movePerFaction?(1+Math.min(0.4,u._movePerFaction.amt*living(u.side).filter(a=>a!==u&&a.faction===u._movePerFaction.fac&&hexDist(a,u)<=3).length)):1)*(u._diveMoveBuff?(1+u._diveMoveBuff):1);
      if(u.movecd<=0){
        u.movecd = MOVE_BASE / Math.max(0.5,u.mv);   // seconds per hex step
        stepToward(u,tgt);
        if(u._asPerTravel)u._travelDist=(u._travelDist||0)+1;   // Galeclaw: build travel charge
        if(terrainAt(u.c,u.r)==='forest') u.movecd*=1.6;   // forest slows movement through it
      }
    }
  }

  // (5) DEATHS & on-death triggers
  [...b.P,...b.E].forEach(u=>{ if(u.alive&&u.hp<=0){ u.alive=false; fx(u,'☠','#d4534a'); onDeath(u); }});

  // resolution checks: last army standing, escalation cap, overtime backstop
  const pl=living('P').length, el=living('E').length;
  if(pl===0||el===0){ b.done=true; endBattle(pl>0&&el===0); return; }
  if(b.t>=70){ // overtime backstop (prototype-scaled): lower total HP loses
    b.done=true; endBattle(totalHP('P')>=totalHP('E')); return;
  }
}

// ----- targeting archetypes (spec) -----
export const RETGT_TIME=2;   // seconds between target re-evaluations while a unit is still closing in
// Hysteresis: when a unit re-evaluates while out of range, only switch to `cand` if it is
// meaningfully better than the `cur` target for this unit's archetype — prevents thrashing.
export function betterTarget(u,cand,cur){
  switch(u.arch){
    case 'lowhp':   return cand.hp < cur.hp*0.80;                          // hunt a clearly weaker target
    case 'highhp':  return cand.hp > cur.hp*1.20;                          // a clearly beefier target
    case 'backline':return colDepth(cand) > colDepth(cur)+1;              // a notably deeper target
    case 'dense': { const dc=foesNear(cand,u),cc=foesNear(cur,u); return dc>=cc+2; } // a clearly denser cluster
    default:        return hexDist(u,cand) < hexDist(u,cur)-2;            // nearest: only if 2+ hexes closer
  }
}
export function foesNear(f,u){ const foes=enemyOf(u); return foes.filter(o=>hexDist(o,f)<=1).length; }
// Absorb shield: add to a unit's shield pool (separate from HP). Decays over SHIELD_DUR seconds.
export const SHIELD_DUR=8;            // a shield lasts up to 8s if untouched
export function applyShield(t,amt){
  if(!t||!t.alive||amt<=0)return;
  const cap=Math.max(t.maxhp*0.6, amt);   // a single shield can buffer up to 60% max HP (or the grant itself)
  t.shield=Math.min(cap,(t.shield||0)+amt);
  t.shieldT=SHIELD_DUR;
  t._shieldFx=0.6;             // brief flash intensity (drives the glow pulse on apply)
  fx(t,'+'+Math.round(amt)+' shield','#7cdcff');
}
export function cleanseDebuffs(t){
  let cleaned=false;
  if(t.slowT>0){t.slowT=0;t.slowStacks=0;cleaned=true;}
  if(t.burnT>0){t.burnT=0;cleaned=true;}
  if(t.poisonT>0||t.poisonStacks>0){t.poisonT=0;t.poisonStacks=0;cleaned=true;}
  if(t.bleedStacks>0){t.bleedStacks=0;cleaned=true;}
  if(t.curseT>0){t.curseT=0;cleaned=true;}
  if(t._marked){t._marked=false;t._markT=0;cleaned=true;}
  if(cleaned)fx(t,'✦ CLEANSED','#7fe0d0');
}
export function acquireTarget(u){
  const foes=enemyOf(u).filter(f=>!(f._cloakT>0)); if(!foes.length)return null;   // cloaked infiltrators are invisible to targeting
  switch(u.arch){
    case 'lowhp':   return foes.reduce((a,c)=>c.hp<a.hp?c:a);
    case 'highhp':  return foes.reduce((a,c)=>c.hp>a.hp?c:a);
    case 'backline':return foes.reduce((a,c)=>colDepth(c)>colDepth(a)?c:a);
    case 'dense':   return densestTarget(u,foes);
    default:        return foes.reduce((a,c)=>hexDist(u,c)<hexDist(u,a)?c:a); // nearest
  }
}
export function densestTarget(u,foes){
  // pick the foe with the most other foes within 1 hex (best AoE anchor)
  let best=foes[0],bc=-1;
  for(const f of foes){ let n=foes.filter(o=>hexDist(o,f)<=1).length; if(n>bc){bc=n;best=f;} }
  return best;
}
export function woundedAlly(u){
  const mates=living(u.side).filter(m=>m.hp<m.maxhp*0.85 && hexDist(m,u)<=4 && !m.noHeal);
  if(!mates.length)return null;
  return mates.reduce((a,c)=>(c.hp/c.maxhp)<(a.hp/a.maxhp)?c:a);
}
export function auraBonus(u){ // Crown of Command + Batch 3 nearby-ally damage auras
  let m=1; for(const a of living(u.side)){ if(a!==u && hexDist(a,u)<=2){ if(a.auraDmg)m+=a.auraDmg; if(a._auraAllyDmg)m+=a._auraAllyDmg; } } return m;
}
export function auraAtkSpeed(u){ // Batch 3: +AS from nearby allies' aura passives
  let m=1; for(const a of living(u.side)){ if(a!==u && a._auraAS && hexDist(a,u)<=(a._auraRange||2)) m+=a._auraAS; } return m;
}
export function selfAtkSpeedMul(u){ // Batch 14: self-scaling attack speed
  let m=1;
  if(u._asRamp){ const t=G.battle?G.battle.t:0; m+=Math.min(u._asRamp.max, u._asRamp.per*Math.floor(t)); }
  if(u._asLowHP){ m+=0.4*(1-u.hp/u.maxhp); } // up to +40% at near-death
  if(u._asPerBurn){ m+=Math.min(0.4,u._asPerBurn*enemyOf(u).filter(e=>e.burnT>0).length); }
  if(u._healAS&&u._healAST>0) m+=u._healAS;   // Bloom Sage: healed allies gain +AS briefly
  if(u._asPerTravel) m+=Math.min(0.3,(u._travelDist||0)*0.04); // Galeclaw: faster after traveling
  return m;
}
export function auraMagicResist(u){ // Batch 3: -magic damage taken from nearby ward-bearers
  let r=0; for(const a of living(u.side)){ if(a!==u && a._auraMagicResist && hexDist(a,u)<=(a._auraRange||2)) r+=a._auraMagicResist; } return Math.min(0.4,r);
}
// Batch 7: splash — deal a fraction of an attack's damage to foes adjacent to the target.
export function splashHit(src,tgt,dmg){
  const frac=src._splash.frac||0.3; const max=src._splash.max||99;
  let hit=0;
  for(const f of enemyOf(src)){ if(f!==tgt && f.alive && hexDist(f,tgt)<=1){ applyDamage(f,dmg*frac,'atk',src); if(++hit>=max)break; } }
  if(hit>0) blastAt(tgt.c,tgt.r,1,'#ffb347');
}
// Batch 9: chain bolt — a small jolt arcs to the nearest OTHER enemy.
export function chainBolt(src,tgt,dmg){
  if(src._chainBolt.nth){ src._cbCount=(src._cbCount||0)+1; if(src._cbCount%src._chainBolt.nth!==0)return; }
  const next=enemyOf(src).filter(f=>f!==tgt&&f.alive).sort((a,b)=>hexDist(tgt,a)-hexDist(tgt,b))[0];
  if(next){ spawnProjectile(tgt,next,{glyph:'⚡',color:'#ffe97a',dur:120}); applyDamage(next,dmg*src._chainBolt.frac,'atk',src); fx(next,'⚡','#ffe97a'); }
}
// Batch 9: pierce — the attack passes through to an enemy roughly behind the target.
export function pierceHit(src,tgt,dmg){
  const extra=src._pierce.extra||1;
  const behind=enemyOf(src).filter(f=>f!==tgt&&f.alive&&hexDist(f,tgt)<=2&&colDepth(f)>=colDepth(tgt))
    .sort((a,b)=>hexDist(tgt,a)-hexDist(tgt,b)).slice(0,extra);
  behind.forEach(f=>{ applyDamage(f,dmg*0.7,'atk',src); fx(f,'⟶','#cfe8a0'); });
}
// Batch 6: dynamic conditional armor — recomputes a bonus damage-reduction each tick.
export function updateCondArmor(u){
  if(!u._condArmor) return;
  if(u._condArmorBase==null) u._condArmorBase=u.dr||0;
  let bonus=0; const ca=u._condArmor;
  if(ca.adjAllies){ const n=living(u.side).filter(a=>a!==u&&hexDist(a,u)<=1).length; if(n>=(ca.adjAllies.n||2))bonus+=ca.adjAllies.amt; }
  if(ca.adjFaction){ const n=living(u.side).filter(a=>a!==u&&a.faction===ca.adjFaction.fac&&hexDist(a,u)<=1).length; if(n>=1)bonus+=ca.adjFaction.amt; }
  if(ca.clericAlive){ if(living(u.side).some(a=>a.cls==='Cleric'&&a.alive))bonus+=ca.clericAlive; }
  if(ca.constructAlive){ if(living(u.side).some(a=>a.token&&a.alive))bonus+=ca.constructAlive; }
  if(ca.perFaction){ const n=living(u.side).filter(a=>a.faction===ca.perFaction.fac).length; bonus+=Math.min(ca.perFaction.cap||0.36, ca.perFaction.amt*n); }
  if(ca.perSlowedEnemy){ const n=enemyOf(u).filter(e=>e.slowT>0).length; bonus+=Math.min(0.30, ca.perSlowedEnemy*n); }
  u.dr=Math.min(.85, u._condArmorBase + bonus*0.5);
}
// Batch 4: self-conditional damage multiplier (HP thresholds, ramps, per-event stacks)
export function condDamageMul(u){
  let m=1;
  if(u._dmgAboveHP && u.hp>=u.maxhp*u._dmgAboveHP.thr) m+=u._dmgAboveHP.amt;
  if(u._dmgBelowHP && u.hp<=u.maxhp*u._dmgBelowHP.thr) m+=u._dmgBelowHP.amt;
  if(u._dmgRamp){ const t=G.battle?G.battle.t:0; m+=Math.min(u._dmgRamp.max, u._dmgRamp.per*Math.floor(t)); }
  if(u._dmgPerStack) m+=u._dmgPerStack*(u._stacks||0);
  if(u._dmgPerDeath) m+=u._dmgPerDeath*(u._deathCount||0); // Pyreborn: per time died this battle
  if(u._dmgPerFactionNear){ const n=living(u.side).filter(a=>a!==u&&a.faction===u._dmgPerFactionNear.fac&&hexDist(a,u)<=3).length; m+=Math.min(u._dmgPerFactionNear.cap||0.6, u._dmgPerFactionNear.amt*n); }
  if(u._dmgPerRobot){ const n=living(u.side).filter(a=>a.token&&(a.tkey==='turret'||a.tkey==='scrapbot')).length; m+=Math.min(0.5,u._dmgPerRobot*n); }
  if(u._dmgVsFarthest && u.tgt){ const foes=enemyOf(u); const far=foes.slice().sort((a,b)=>hexDist(u,b)-hexDist(u,a))[0]; if(far===u.tgt)m+=u._dmgVsFarthest; }
  return m;
}
export function onDeath(u){
  // hook for on-death triggers (Phoenix rebirth, Hivemind spawns, etc. — stubbed for prototype slice)
}
export function renderPhase(){
  const b=G.battle; const el=document.getElementById('btime'); if(!el)return;
  if(b.phase==='countdown'){ el.textContent='Battle begins in '+Math.ceil(b.cd)+'…'; return; }
  el.textContent=b.t.toFixed(1)+'s · '+(PHASE_NAMES[b.phase]||'');
}
export function colDepth(u){return u.side==='P'?u.c:(COLS-u.c);} // how deep into enemy territory (for rogue dive we want their backline = high enemy col)
export function totalHP(s){return living(s).reduce((a,u)=>a+u.hp,0);}
export function stepToward(u,t){
  // BFS over unoccupied hexes from u toward any hex within attack range of t.
  // Returns the FIRST step of the shortest unblocked route, so units route around jams.
  const startKey=u.c+','+u.r;
  const goalDist=u.rng;
  const visited={};visited[startKey]={from:null};
  const queue=[{c:u.c,r:u.r}];
  let goalCell=null, scan=0;
  while(queue.length && scan<260){
    scan++;
    const cur=queue.shift();
    if(hexDist(cur,t)<=goalDist && !(cur.c===u.c&&cur.r===u.r)){ goalCell=cur; break; }
    const nbs=neighbors(cur.c,cur.r).sort((a,b)=>(hexDist(a,t)+(terrainAt(a.c,a.r)==='lava'?3:0))-(hexDist(b,t)+(terrainAt(b.c,b.r)==='lava'?3:0)));
    for(const n of nbs){
      const k=n.c+','+n.r;
      if(visited[k])continue;
      if(occupied(n.c,n.r) && !(n.c===t.c&&n.r===t.r))continue;
      visited[k]={from:cur.c+','+cur.r};
      queue.push(n);
    }
  }
  if(goalCell){
    let k=goalCell.c+','+goalCell.r, prev=visited[k].from;
    while(prev && prev!==startKey){ k=prev; prev=visited[k].from; }
    if(prev===startKey){ const a=k.split(',').map(Number); if(!occupied(a[0],a[1])){u.c=a[0];u.r=a[1];return;} }
  }
  // Fallback 1: any empty neighbor that doesn't increase distance (sidestep around a jam)
  const here=hexDist(u,t);
  const opts=neighbors(u.c,u.r).filter(n=>!occupied(n.c,n.r)).sort((a,b)=>hexDist(a,t)-hexDist(b,t));
  for(const n of opts){ if(hexDist(n,t)<=here){ u.c=n.c;u.r=n.r; return; } }
  // Fallback 2: if fully boxed in, take ANY empty neighbor to keep things fluid
  if(opts.length){ u.c=opts[0].c; u.r=opts[0].r; }
}
export function neighbors(c,r){
  const even=(c%2)===0;
  const dirs= even
   ?[[+1,0],[+1,-1],[0,-1],[-1,-1],[-1,0],[0,+1]]
   :[[+1,+1],[+1,0],[0,-1],[-1,0],[-1,+1],[0,+1]];
  return dirs.map(([dc,dr])=>({c:c+dc,r:r+dr})).filter(n=>n.c>=0&&n.c<COLS&&n.r>=0&&n.r<ROWS);
}
export function occupied(c,r){ if(terrainAt(c,r)==='rubble')return true; return [...G.battle.P,...G.battle.E].some(u=>u.alive&&u.c===c&&u.r===r);}
export function applyDamage(tgt,amt,kind,src,isCrit){
  if(!tgt.alive)return;
  if(kind==='atk'&&tgt.dodge&&RNG()<tgt.dodge){ fx(tgt,'DODGE','#cfe8ff'); return; }   // Batch 8
  let drEff=tgt.dr||0;
  if(src&&src.armorPierce)drEff=Math.max(0,drEff-src.armorPierce);
  let dmg=amt*(1-drEff);
  if(kind==='atk'&&src){ const emp=(src._plunderAcc||0)+(src._empAcc||0); if(emp>0)dmg*=(1+emp); } // enemy Plunder/empower stacks
  // Batch 10: Gravel Golem — first hit from each distinct enemy is reduced
  if(kind==='atk'&&src&&tgt._firstHitReduce){ tgt._fhSeen=tgt._fhSeen||{}; const id=src.name+src.side; if(!tgt._fhSeen[id]){ tgt._fhSeen[id]=1; dmg*=(1-tgt._firstHitReduce); } }
  if((kind==='dot'||kind==='poison')){ const mr=auraMagicResist(tgt); if(mr>0)dmg*=(1-mr); }   // Batch 3: ward auras soften DoT/magic
  if((kind==='dot'||kind==='poison')&&tgt.magicWard>0)dmg*=(1-tgt.magicWard);   // Warding Robes: self magic resistance
  if(kind==='atk'&&src&&src._exec&&tgt.hp/tgt.maxhp<0.40)dmg*=(1+src._exec);   // Reaper's Edge: bonus vs low-HP foes
  if(kind==='atk'&&src&&src.t==='r'&&src.rng>1&&terrainAt(tgt.c,tgt.r)==='forest')dmg*=0.75;  // forest ranged cover
  if(kind==='atk'&&src&&src.t==='r'&&src.rng>1){ const ward=living(tgt.side).find(a=>a._rangedWard); if(ward)dmg*=(1-ward._rangedWard); }  // Eternal Bulwark army-wide ranged ward
  if(dmg>0){ const g=living(tgt.side).find(a=>a!==tgt&&a._guardianWard&&hexDist(a,tgt)<=2); if(g)dmg*=0.92; }  // Guardian class synergy: allies near a Guardian take -8%
  if(dmg>0){ const w=living(tgt.side).find(a=>a!==tgt&&a.auraWard&&hexDist(a,tgt)<=2); if(w)dmg*=(1-w.auraWard); }  // Sigil of the Bound: nearby allies take less damage
  if(tgt._frontWard&&dmg>0)dmg*=(1-tgt._frontWard);  // Sentinel's Aegis: front-row units take less
  if(tgt.bleedStacks>0)dmg*=(1+0.08*(tgt.bleedAmpMul||1)*Math.min(5,tgt.bleedStacks)); // bleed amp — up to 5 stacks (40%)
  if(kind==='atk'&&src&&src.webAmp&&tgt.slowT>0)dmg*=1.15;   // Arachnari: webbed foes take more
  if(kind==='atk'&&src&&src.sporeAmp&&inSporeCloud(tgt))dmg*=1.15; // Myconid: foes in a spore cloud take more
  if(tgt.curseT>0)dmg*=1.25; // Curse ultimate: cursed foes take more damage
  // Batch 1 — conditional "vs target state" damage bonuses (from unit passive abilities)
  if(kind==='atk'&&src&&src._vs){
    const v=src._vs;
    if(v.bled&&tgt.bleedStacks>0)dmg*=v.bled;
    if(v.frozen&&tgt.stun>0)dmg*=v.frozen;
    if(v.slowed&&tgt.slowT>0)dmg*=v.slowed;
    if(v.wounded&&tgt.hp/tgt.maxhp<0.5)dmg*=v.wounded;
    if(v.full&&tgt.hp>=tgt.maxhp*0.99)dmg*=v.full;
    if(v.undead&&(tgt.faction==='Hollow'||/undead|skeleton|bone|ghoul|lich|wraith/i.test((tgt.name||'')+(tgt.efaction||'')+(tgt.cls||''))))dmg*=v.undead;
    if(v.armored&&((tgt.dr||0)>=0.15||tgt.cls==='Guardian'))dmg*=v.armored;
    if(v.burning&&tgt.burnT>0)dmg*=v.burning;
    if(v.poisoned&&tgt.poisonT>0)dmg*=v.poisoned;
    if(v.shocked&&tgt._shocked)dmg*=v.shocked;
  }
  if(kind==='atk'&&src&&src._shocked&&tgt._lessFromShocked)dmg*=(1-tgt._lessFromShocked);
  // Absorb shields: a shield pool soaks damage before HP (decays over time, set elsewhere).
  // Poison is the exception — it seeps through shields and damages health directly.
  if(tgt.shield>0 && dmg>0 && kind!=='poison'){
    const absorbed=Math.min(tgt.shield,dmg);
    tgt.shield-=absorbed; dmg-=absorbed;
    fx(tgt,'-'+Math.round(absorbed),'#7cdcff');
    if(tgt.shield<=0){ tgt.shield=0; fx(tgt,'SHIELD BROKEN','#7cdcff'); }
  }
  tgt.hp-=dmg;
  tgt._dmgTaken=(tgt._dmgTaken||0)+dmg;   // per-battle telemetry (run statistics)
  if(dmg>0&&G.battle){ tgt._hitFx=G.battle.t; if(kind==='atk'&&dmg>tgt.maxhp*0.12)tgt._bigHit=G.battle.t; }   // juice: flinch / big-hit shake
  // Batch 10: counter-attack — when struck in melee, retaliate
  if(kind==='atk'&&src&&src.alive&&tgt.alive&&tgt._counter&&src.rng<=1&&hexDist(src,tgt)<=1){
    if(!tgt._counterCD||tgt._counterCD<=0){ tgt._counterCD=0.5;
      applyDamage(src,tgt.dmg*tgt._counter.frac*PACE,'atk',tgt);
      if(tgt._counter.bleed&&src.alive)src.bleedStacks=Math.min(5,(src.bleedStacks||0)+1);
      fx(tgt,'COUNTER','#ffd27a');
    }
  }
  // Batch 10: first-hit bleed — first strike on a full-HP target applies bleed
  if(kind==='atk'&&src&&src._firstHitBleed&&tgt.alive&&(amt>=0)&&tgt.hp+dmg>=tgt.maxhp*0.99){
    tgt.bleedStacks=Math.min(5,(tgt.bleedStacks||0)+src._firstHitBleed);
  }
  // first attack of the battle (not every hit) applies a burst of bleed stacks — Cub Skirmisher
  if(kind==='atk'&&src&&src._firstAtkBleed&&!src._firstAtkDone&&tgt.alive){
    src._firstAtkDone=true;
    tgt.bleedStacks=Math.min(5+(src.bleedBonus||0),(tgt.bleedStacks||0)+src._firstAtkBleed);
  }
  if(kind==='atk'&&src){
    if(src.side==='P') src._dmgDealt=(src._dmgDealt||0)+dmg;
    // lifesteal (Soulreaver / Voidtouched)
    if(src.lifesteal&&src.alive){src.hp=Math.min(src.maxhp,src.hp+dmg*src.lifesteal*healScale(src));}
    // thorns reflect (melee only)
    if(tgt.reflect&&src.rng<=1&&src.alive){src.hp-=dmg*tgt.reflect;fx(src,'-'+Math.round(dmg*tgt.reflect),'#b6e3a0');}
    // on-hit status effects from src (modified by relics)
    if(src.bleed)tgt.bleedStacks=Math.min(5+(src.bleedBonus||0),tgt.bleedStacks+1);
    if(src.burn&&!tgt.ccImmune){tgt.burnT=src.burnDur||2;tgt.burnMul=src.burn;}
    if(src.slow&&!tgt.ccImmune){tgt.slowT=2;tgt.slowStacks++;const fa=src.freezeAt||4;if(src.deepfreeze&&tgt.slowStacks>=fa){tgt.stun=1.2;tgt.slowStacks=0;fx(tgt,'FROZEN','#7cdcff','big');}}
    if(src.web&&!tgt.ccImmune){tgt.slowT=2;tgt.slowStacks++;if(tgt.slowStacks>=3){tgt.stun=1.0;tgt.slowStacks=0;fx(tgt,'🕸 ROOTED','#d6caa0','big');}}
    if(src.spore&&!tgt.ccImmune){tgt.poisonT=2.5;}
    if(src.hiveSpawn&&RNG()<0.22){spawnToken(src.side,'swarmling',src.c,src.r);}
    if(tgt.aegis){const cap=tgt.aegisCap||0.20;tgt._aegisGain=tgt._aegisGain||0;if(tgt._aegisGain<cap){tgt._aegisGain+=tgt.aegis;tgt.dr=Math.min(.85,(tgt.dr||0)+tgt.aegis);}}
    if(isCrit) fx(tgt,'✶'+Math.round(dmg),'#ffd375','crit');
    else fx(tgt,'-'+Math.round(dmg),'#ffe9a8');
  } else if(kind==='dot'){
    tgt._dotAcc=(tgt._dotAcc||0)+dmg; tgt._dotT=(tgt._dotT||0)-TICK;
    if(tgt._dotT<=0){
      const col=tgt.poisonT>0?'#9ccc65':tgt.burnT>0?'#ffa14a':'#e8736b';
      fx(tgt,'-'+Math.round(tgt._dotAcc),col);
      tgt._dotAcc=0; tgt._dotT=0.5;
    }
  }
  // Stormherd chain lightning: 20% on attack, arcs to one nearby enemy
  if(kind==='atk'&&src&&src.lightning&&RNG()<0.2&&tgt.alive!==undefined){
    const others=enemyOf(src).filter(o=>o!==tgt&&o.alive&&hexDist(o,tgt)<=2);
    if(others.length){const o=pick(others);o.hp-=dmg*0.35;fx(o,'⚡'+Math.round(dmg*0.35),'#ffe97a');if(o.hp<=0)tryDeath(o);}
  }
  // target gains magic from taking damage (spec: bar fills from dealing AND taking).
  // Only real hits grant charge — DoT ticks fire 30x/sec and would runaway-charge the bar.
  if(kind==='atk') tgt.mag=Math.min(100,tgt.mag+5*(tgt.chargeMul||1)*(terrainAt(tgt.c,tgt.r)==='sacred'?1.25:1));
  if(tgt.hp<=0){
    tryDeath(tgt);
    // Voidtouched Hunger: kills grant stacking power for the battle
    if(!tgt.alive&&kind==='atk'&&src&&src.voidstack){src.dmg*=1.08;fx(src,'HUNGER+','#b48ae8');}
    // Balor's Plunder: when a player unit falls, the Brigand boss snowballs
    if(!tgt.alive && tgt.side==='P'){
      const boss=living('E').find(u=>u.mech==='plunder');
      if(boss){ boss.dmg=Math.round(boss.dmg*1.10); fx(boss,'PLUNDER+','#e0a020'); }
    }
  }
}
// death with self-revive (Phoenix Feather) and Phoenix Crown relic handling
export function tryDeath(u){
  if(u.phoenixRevive && !u._phoenixUsed){ u._phoenixUsed=true; u.hp=u.maxhp*u.phoenixRevive; if(u.phoenixEmpower)u.dmg*=1.2; fx(u,'🔥 REBORN','#ff7043','big'); healRingAt(u); return; }
  // if(u.selfRevive && !u._revivedSelf){ u._revivedSelf=true; u.hp=u.maxhp*u.selfRevive; fx(u,'REVIVE','#f0a35a','big'); healRingAt(u); return; }
  if(u._korvenEligible && !G.battle._korvenUsed && u.side==='P'){ G.battle._korvenUsed=true; u.hp=u.maxhp*0.5; fx(u,'🔥 REBORN','#f0a35a','big'); healRingAt(u); return; }
  if(u._reviveEligible && !G.battle._crownUsed && u.side==='P'){ G.battle._crownUsed=true; u.hp=u.maxhp; u.dmg*=1.3; u.as*=1.3; fx(u,'👑 REBORN','#f0d375','big'); healRingAt(u); return; }
  if(u.selfRevive && !u._revivedSelf){ if(u._reviveChance==null || RNG()<u._reviveChance){ u._revivedSelf=true; u._deathCount=(u._deathCount||0)+1; u.hp=u.maxhp*u.selfRevive; fx(u,'REVIVE','#f0a35a','big'); healRingAt(u); return; } }
  // team-revive aura from an ally (e.g. Seraphine): first friendly death each battle revives
  if(u.side && !u._teamReviveAura){
    const aura=living(u.side).find(a=>a._teamReviveAura&&a.alive);
    if(aura && !G.battle['_teamRev_'+u.side]){ G.battle['_teamRev_'+u.side]=true; u.hp=u.maxhp*aura._teamReviveAura; fx(u,'✟ REVIVED','#f0d375','big'); healRingAt(u); return; }
  }
  u.alive=false;
  deathBurst(u);   // juice: dust/blood puff on death
  // Enemy faction themes: Brigand Plunder & Void/Dread empower — killers' side gains stacking damage
  const _killSide=u.side==='P'?'E':'P';
  living(_killSide).forEach(a=>{
    if(a._plunder){ const cap=a._plunderMax||0.6; a._plunderAcc=Math.min(cap,(a._plunderAcc||0)+a._plunder); }
    if(a._killEmpower){ a._empAcc=(a._empAcc||0)+a._killEmpower; }
  });
  // Batch 4 — event-stacking damage passives
  living(u.side).forEach(a=>{ if(a._stackOn==='allyDeath') a._stacks=(a._stacks||0)+1; });
  living(u.side==='P'?'E':'P').forEach(a=>{ if(a._stackOn==='kill') a._stacks=(a._stacks||0)+1; });
  // Batch 13: Necromancer raises a skeleton where an ally fell
  living(u.side).forEach(a=>{ if(a._summonOnAllyDeath&&a.alive&&RNG()<0.5) spawnToken(u.side,a._summonOnAllyDeath,u.c,u.r); });
  // Batch 2 — on-death triggers
  if(u._deathPoisonCloud){ G.battle.zones=G.battle.zones||[]; G.battle.zones.push({tiles:[{c:u.c,r:u.r},...neighbors(u.c,u.r)],side:u.side,dmg:u.dmg*0.4,life:3,color:'#9ccc65',glyph:'🟢',tick:0,spore:true}); }
  // ally heal when an enemy dies (units on the opposite side with _healOnEnemyDeath)
  const killers=living(u.side==='P'?'E':'P').filter(a=>a._healOnEnemyDeath);
  killers.forEach(a=>{ if(hexDist(a,u)<=3){ a.hp=Math.min(a.maxhp,a.hp+a.maxhp*a._healOnEnemyDeath); healRingAt(a);} });
  // Batch 15: Grave Acolyte — enemy deaths accelerate its ult charge
  living(u.side==='P'?'E':'P').forEach(a=>{ if(a._chargeOnEnemyDeath&&a.alive) a.mag=Math.min(100,a.mag+100*a._chargeOnEnemyDeath); });
  // poison-jump: if a poisoned unit dies, spread poison to the nearest enemy of whoever has the aura
  if(u.poisonT>0){ const jumpers=living(u.side==='P'?'E':'P').filter(a=>a._poisonJumpAura); if(jumpers.length){ const near=living(u.side).filter(x=>x.alive).sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; if(near){near.poisonT=Math.max(near.poisonT||0,2.5);fx(near,'🟢','#9ccc65');} } }
  // Hollow Legion Undeath: deaths raise Skeletons (lvl1: Hollow units only; lvl2: any ally)
  if(!u.token){
    const lv=Math.max(0,...living(u.side).map(x=>x.hollowRaise||0),0);
    if(lv>=1 && (lv>=2 || u.faction==='Hollow')) spawnToken(u.side,'skeleton',u.c,u.r);
    if(u._queenRaise && !u._queenRaised){ u._queenRaised=true; spawnToken(u.side,'skeleton',u.c,u.r); }   // Hollow Queen commander: each unit raises a skeleton on first death
    // Grimgear lvl2: goblin deaths leave a Scrap Bot
    const gl=Math.max(0,...living(u.side).map(x=>x.grimgear||0),0);
    if(gl>=2 && u.faction==='Grimgear') spawnToken(u.side,'scrapbot',u.c,u.r);
  }
}
export function castUlt(u,esc,_echo){
  u._ults=(u._ults||0)+1;
  ultFx(u);
  // The Cosmic Oracle — friendly ultimates have a 25% chance to fire a second time
  if(!_echo && u.side){
    const oracle=living(u.side).some(a=>a!==u&&a.alive&&a._ultEcho);
    if(oracle && RNG()<0.25){ fx(u,'✦ ECHO','#c8a6ff','big'); setTimeout(()=>{ if(u.alive&&G.battle&&!G.battle.done) castUlt(u,esc,true); },180); }
  }
  // Batch 15: allies that charge when a friendly ult fires; foes that punish enemy ults
  living(u.side).forEach(a=>{ if(a!==u&&a._chargeOnAllyUlt) a.mag=Math.min(100,a.mag+a._chargeOnAllyUlt); });
  enemyOf(u).forEach(e=>{ if(e._punishUlt&&e.alive&&hexDist(e,u)<=99){ applyDamage(u,e._punishUlt,'atk',e); } });
  const k=u.ult.k, foes=enemyOf(u), mates=living(u.side);
  let power=u.ultMul||1;
  { const seer=living(u.side).find(a=>a!==u&&a._allyUltAmp&&hexDist(a,u)<=a._allyUltAmp.range); if(seer)power*=(1+seer._allyUltAmp.amt); }
  if(u.ultCrit&&RNG()<0.25){ power*=1.5; fx(u,'ASTRAL CRIT','#c8a6ff','big'); }
  if(k==='none')return;
  if(k==='nova'){ // aoe around densest cluster
    let center=densestTarget(u,foes); if(!center)return;
    const col=u.faction==='Emberkin'?'#ff7a3a':'#f0d375';
    fx(u,'✸ '+(u.ult.name||'NOVA').toUpperCase(),col,'big');
    // a projectile arcs to the cluster, then the blast lands
    spawnProjectile(u,center,{glyph:u.ico,color:col,dur:300,spin:true});
    setTimeout(()=>{ if(!G.battle||G.battle.done)return; blastAt(center.c,center.r,(u.ult.r||1),col);
      foes.forEach(f=>{if(f.alive&&hexDist(f,center)<=(u.ult.r||1))applyDamage(f,u.dmg*u.ult.v*esc*power*PACE,'atk',u);}); },300);
  } else if(k==='heal'){
    fx(u,'✚ '+(u.ult.name||'HEAL').toUpperCase(),'#5bbf6a','big'); blastAt(u.c,u.r,(u.ult.r||3),'#5bbf6a');
    mates.forEach(m=>{if(hexDist(m,u)<=3 && !m.noHeal){const h=u.ult.v*(u.healMul||1)*healScale(u);m.hp=Math.min(m.maxhp,m.hp+h);healRingAt(m);fx(m,'+'+Math.round(h),'#5bbf6a');}});
  } else if(k==='shield'){
    {const sh=Math.round(u.ult.v*healScale(u));applyShield(u,sh);healRingAt(u);blastAt(u.c,u.r,0,'#7cdcff');fx(u,'🛡 '+(u.ult.name||'SHIELD').toUpperCase(),'#7cdcff','big');}
  } else if(k==='execute'){
    let t=foes.reduce((a,c)=>c.hp<a.hp?c:a,foes[0]); if(!t)return;
    spawnProjectile(u,t,{glyph:'⚡',color:'#fff',dur:200});
    if(t.hp/t.maxhp<=u.ult.v){t.hp=0;t.alive=false;fx(t,'EXECUTE','#d4534a','big');onDeath(t);}
    else applyDamage(t,u.dmg*2.5*power*PACE,'atk',u,true);
  } else if(k==='doubleaxe'){
    // Barrage: a volley of axes cycles through enemies within range (repeating targets if the volley outnumbers them)
    const effR=u.rng + ((terrainAt(u.c,u.r)==='high'&&u.t==='r')?1:0);
    const inRange=foes.filter(f=>hexDist(u,f)<=effR);
    const tgts=(inRange.length?inRange:foes).slice().sort((a,b)=>hexDist(u,a)-hexDist(u,b));
    if(!tgts.length)return;
    const shots=u.ult.n||2;
    fx(u,'⚔ '+(u.ult.name||'BARRAGE').toUpperCase(),'#e6b860','big');
    for(let i=0;i<shots;i++){
      const t=tgts[i%tgts.length];
      spawnProjectile(u,t,{glyph:'🪓',color:'#e6b860',dur:240,spin:true});
      applyDamage(t, u.dmg*(u.ult.v||3.0)*power*PACE, 'atk', u, true);
    }
  } else if(k==='burst'){
    // Burst: detonates a zone centered on the caster, hitting every enemy inside `n` times each.
    // r sets the radius (1 = adjacent only, 2 = within 2 hexes, ...), v the per-hit damage multiplier.
    const rad=u.ult.r||1;
    const inRange=foes.filter(f=>hexDist(f,u)<=rad);
    if(!inRange.length)return;
    const hits=u.ult.n||1;
    const col='#ff6a3a';
    fx(u,'💥 '+(u.ult.name||'BURST').toUpperCase(),col,'big');
    blastAt(u.c,u.r,rad,col);
    for(let i=0;i<hits;i++){
      inRange.forEach(f=>{ if(f.alive) applyDamage(f, u.dmg*(u.ult.v||1.5)*esc*power*PACE, 'atk', u, true); });
    }
  } else if(k==='rally'){
    // battlefield rally: surge nearby allies' attack speed (and a touch of damage), with a loud banner
    fx(u,'⚑ RALLY','#f0d375','big'); blastAt(u.c,u.r,(u.ult.r||3),'#f0d375');
    mates.forEach(m=>{ if(hexDist(m,u)<=(u.ult.r||3)){ m.as*=(1+(u.ult.v||0.5)); m.dmg=Math.round(m.dmg*(1+(u.ult.v||0.5)*0.3)); healRingAt(m); fx(m,'⚑','#f0d375'); } });
  } else if(k==='freeze'){
    let center=densestTarget(u,foes);if(!center)return;
    fx(u,'❄ '+(u.ult.name||'FREEZE').toUpperCase(),'#7cdcff','big');
    spawnProjectile(u,center,{glyph:'❄',color:'#7cdcff',dur:300,spin:true});
    setTimeout(()=>{ if(!G.battle||G.battle.done)return; blastAt(center.c,center.r,(u.ult.r||1),'#7cdcff');
      foes.forEach(f=>{if(f.alive&&hexDist(f,center)<=(u.ult.r||1)){f.stun=u.ult.v;applyDamage(f,u.dmg*1.2*esc*PACE,'atk',u);fx(f,'❄','#7cdcff');}}); },300);
  } else if(k==='chain'){
    // lightning arcs from the nearest foe to successive nearby foes, falling off each jump
    let cur=foes.slice().sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; if(!cur)return;
    const hit=new Set(); let dmg=u.dmg*u.ult.v*power*PACE; const maxJumps=u.ult.j||4;
    fx(u,'⚡ CHAIN','#ffe97a','big');
    for(let j=0;j<maxJumps && cur;j++){
      const prev=cur; hit.add(prev);
      spawnProjectile(j===0?u:{c:prev._fromC??u.c,r:prev._fromR??u.r},prev,{glyph:'⚡',color:'#ffe97a',dur:120});
      applyDamage(prev,dmg,'atk',u); fx(prev,'⚡','#ffe97a');
      dmg*=0.75;
      const next=foes.filter(f=>f.alive&&!hit.has(f)).sort((a,b)=>hexDist(prev,a)-hexDist(prev,b))[0];
      cur=next;
    }
  } else if(k==='beam'){
    // piercing line toward the most distant foe — a searing beam lances across the board, hitting everything on its path
    let far=foes.slice().sort((a,b)=>hexDist(u,b)-hexDist(u,a))[0]; if(!far)return;
    const bcol=u.faction==='Emberkin'?'#ff7a3a':'#ff9d5c';
    fx(u,'☄ '+(u.ult.name||'BEAM').toUpperCase(),bcol,'big');
    beamLine(u,far,bcol);   // the glowing beam itself, with muzzle flash at the caster
    const dx=far.c-u.c, dy=far.r-u.r;
    // find everyone on the beam, then detonate them in order of distance so the beam visibly travels outward
    const hitList=foes.filter(f=>{ if(!f.alive)return false;
      const fdx=f.c-u.c, fdy=f.r-u.r;
      const aligned = (dx===0?Math.abs(fdx)<=1:Math.sign(fdx)===Math.sign(dx)) && (dy===0?Math.abs(fdy)<=1:true);
      return aligned && hexDist(u,f)<=hexDist(u,far)+1;
    }).sort((a,b)=>hexDist(u,a)-hexDist(u,b));
    hitList.forEach((f,i)=>{ setTimeout(()=>{ if(!G.battle||G.battle.done||!f.alive)return;
      applyDamage(f,u.dmg*u.ult.v*esc*power*PACE,'atk',u); fx(f,'☄','#fff'); blastAt(f.c,f.r,0,bcol); blastAt(f.c,f.r,1,bcol);
    }, 60+i*70); });
  } else if(k==='summon'){
    // raise ally tokens beside the caster (necromancer / swarm payoff)
    const key=u.ult.token||'skeleton'; const n=u.ult.n||3;
    fx(u,'☠ '+(u.ult.name||'SUMMON').toUpperCase(),'#cfd8dc','big'); blastAt(u.c,u.r,1,'#b6a8c8');
    for(let i=0;i<n;i++) spawnToken(u.side,key,u.c,u.r,u.ult.v||1);
  } else if(k==='drain'){
    // vampiric strike: heavy single-target hit that heals the caster
    let t=foes.slice().sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; if(!t)return;
    fx(u,'🩸 '+(u.ult.name||'DRAIN').toUpperCase(),'#c0392b','big');
    spawnProjectile(u,t,{glyph:'🩸',color:'#c0392b',dur:200});
    const dmg=u.dmg*u.ult.v*power*PACE; applyDamage(t,dmg,'atk',u,true);
    const heal=dmg*0.6*healScale(u); u.hp=Math.min(u.maxhp,u.hp+heal); healRingAt(u); fx(u,'+'+Math.round(heal),'#c0392b');
  } else if(k==='bulwark'){
    // shield a cluster of allies (team protection, distinct from self-shield)
    fx(u,'BULWARK','#7cdcff','big');
    mates.forEach(m=>{ if(hexDist(m,u)<=(u.ult.r||2)){ const sv=Math.round(u.ult.v*(u.healMul||1)*healScale(u)); applyShield(m,sv); m.dr=Math.min(.85,(m.dr||0)+0.15); healRingAt(m); } });
  } else if(k==='curse'){
    // hex a cluster: damage-amp debuff + lingering poison (a setup ultimate)
    let center=densestTarget(u,foes); if(!center)return;
    fx(u,'☠ '+(u.ult.name||'CURSE').toUpperCase(),'#9b59b6','big');
    spawnProjectile(u,center,{glyph:'☠',color:'#9b59b6',dur:280,spin:true});
    setTimeout(()=>{ if(!G.battle||G.battle.done)return; blastAt(center.c,center.r,(u.ult.r||2),'#9b59b6');
      foes.forEach(f=>{ if(f.alive&&hexDist(f,center)<=(u.ult.r||2)){ f.curseT=4; f.poisonT=Math.max(f.poisonT||0,3); fx(f,'CURSED','#9b59b6'); } }); },280);
  } else if(k==='berserk'){
    // self-buff: surge of attack speed and damage for the rest of the fight
    u.as*=(1+(u.ult.v||0.5)); u.dmg=Math.round(u.dmg*(1+(u.ult.d||0.3))); u.lifesteal=(u.lifesteal||0)+0.15;
    healRingAt(u); fx(u,'⚔ BERSERK','#e74c3c','big');
  } else if(k==='quake'){
    // board-wide cataclysm: the ground heaves — screen shakes, shockwaves ripple outward, debris flies
    fx(u,'⛰ '+(u.ult.name||'QUAKE').toUpperCase(),'#b9772e','big');
    screenShake();
    // concentric shockwaves expanding from the caster
    shockwaveAt(u.c,u.r,2.2,'#d89544',0);
    shockwaveAt(u.c,u.r,3.6,'#a86a34',120);
    shockwaveAt(u.c,u.r,5.0,'#8a5628',240);
    foes.forEach(f=>{ if(f.alive){
      // stagger each foe's hit slightly by distance so the wave visibly sweeps across the board
      const d=hexDist(u,f); setTimeout(()=>{ if(!G.battle||G.battle.done||!f.alive)return;
        applyDamage(f,u.dmg*u.ult.v*esc*power*PACE,'atk',u); if(RNG()<0.5)f.stun=Math.max(f.stun||0,0.6);
        blastAt(f.c,f.r,0,'#b9772e'); debrisBurst(f.c,f.r,4);
      }, Math.min(300, d*45));
    } });
  } else if(k==='transform'){
    // Swap the unit into a distinct creature: new name (drives the sprite), attack type, and its own ultimate.
    if(!u._transformed){
      u._transformed=true;
      const T=u.ult;                                   // {form, fico, hp, dmg, as, rng, name}
      const F=TRANSFORM_FORMS[T.form]||{};
      u._origName=u.name; u._origIco=u.ico; u._origCls=u.cls; u._origT=u.t; u._origRng=u.rng;
      // identity → the transformed creature (sprite resolves by the form's art key)
      u.name=T.form||'Beast';
      u.art=F.art||T.form||'Beast';
      u.ico=F.ico||T.fico||'🐲';
      if(F.cls)u.cls=F.cls;
      if(F.t)u.t=F.t;                                  // melee/ranged can change (Drake→ranged, Leviathan→melee)
      u.rng=F.rng||T.rng||u.rng;
      // stats scale up
      u.maxhp=Math.round(u.maxhp*(F.hp||T.hp||2.0)); u.hp=u.maxhp;
      u.dmg=Math.round(u.dmg*(F.dmg||T.dmg||2.2));
      u.as*=(F.as||T.as||1.2);
      u.dr=Math.min(.85,(u.dr||0)+0.10);
      u._formName=T.form||'beast';
      // install the FORM'S own ultimate and reset the bar so it can charge & fire again
      if(F.ult){ u.ult=Object.assign({}, F.ult); }
      u.mag=0;
      // the new form is a different kind of combatant — recompute its AI archetype (a healer druid
      // becomes a melee bruiser bear) and drop the stale target so it re-acquires and advances.
      u.arch=archetypeOf(u); u.tgt=null; u.retgt=0; u.atkcd=0;
      blastAt(u.c,u.r,1,'#ffcf5c'); healRingAt(u); fx(u,'⟿ '+(T.form||'TRANSFORM').toUpperCase(),'#ffcf5c','big');
    }
  } else if(k==='blink'){
    // teleport behind the chosen enemy and land a devastating strike
    let t=foes.slice().sort((a,b)=>(b.hp)-(a.hp))[0]; // hit the juiciest target (highest HP/backline carry)
    if(u.arch==='backline') t=foes.slice().sort((a,b)=>b.c-a.c)[0]||t; // divers prefer the far backline
    if(!t)return;
    // find an empty hex "behind" the target (further from the caster's side)
    const behindC = u.side==='P' ? Math.min(COLS-1,t.c+1) : Math.max(0,t.c-1);
    let dest=null;
    for(const cand of [{c:behindC,r:t.r},...neighbors(t.c,t.r)]){
      if(cand.c>=0&&cand.c<COLS&&cand.r>=0&&cand.r<ROWS&&!occupied(cand.c,cand.r)){ dest=cand; break; }
    }
    fx(u,'BLINK','#b48ae8','big'); blastAt(u.c,u.r,0,'#b48ae8');
    if(dest){ u.c=dest.c; u.r=dest.r; }
    blastAt(t.c,t.r,0,'#b48ae8');
    applyDamage(t,u.dmg*(u.ult.v||3.2)*power*PACE,'atk',u,true);
    u.tgt=t; u.retgt=2;
  } else if(k==='banish'){
    // hurl an enemy to the far edge of the board (removes a threat from the fight for a while)
    let t=foes.slice().sort((a,b)=>hexDist(u,a)-hexDist(u,b))[0]; if(!t)return;
    const edgeC = t.side==='E' ? COLS-1 : 0;  // shove toward its own back edge
    let dest=null;
    for(let dc=0;dc<COLS&&!dest;dc++){
      const cc = t.side==='E' ? COLS-1-dc : dc;
      for(const r of [t.r,t.r-1,t.r+1,0,ROWS-1]){
        if(r>=0&&r<ROWS&&!occupied(cc,r)){ dest={c:cc,r}; break; }
      }
    }
    spawnProjectile(u,t,{glyph:'🌀',color:'#7cdcff',dur:200});
    fx(t,'BANISHED','#7cdcff','big');
    if(dest){ t.c=dest.c; t.r=dest.r; }
    t.stun=Math.max(t.stun||0,u.ult.v||1.5); t.slowT=2; t.tgt=null; t.retgt=2;
  } else if(k==='charm'){
    // temporarily turn an enemy unit to fight for you
    let t=foes.filter(f=>!f.boss&&!f._charmT).sort((a,b)=>(b.dmg*b.as)-(a.dmg*a.as))[0]; if(!t)return;
    spawnProjectile(u,t,{glyph:'💗',color:'#ff7ab0',dur:220});
    t._charmT=u.ult.v||4;          // duration in seconds
    t._charmHome=t.side;           // remember original side
    t.side=u.side;                 // switch allegiance
    t.tgt=null; t.retgt=0;
    fx(t,'CHARMED','#ff7ab0','big'); healRingAt(t);
  } else if(k==='zone'){
    // create a damaging zone of board tiles around the densest enemy cluster
    let center=densestTarget(u,foes); if(!center)return;
    const rad=u.ult.r||1;
    const tiles=[];
    for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){ if(hexDist({c,r},center)<=rad)tiles.push({c,r}); }
    G.battle.zones=G.battle.zones||[];
    G.battle.zones.push({tiles, side:u.side, dmg:u.dmg*(u.ult.v||0.5), life:u.ult.dur||4, color:u.ult.zcol||'#ff7a3a', glyph:u.ult.zico||'🔥', tick:0, spore:(u.faction==='Myconid')});
    spawnProjectile(u,center,{glyph:u.ult.zico||'🔥',color:u.ult.zcol||'#ff7a3a',dur:260,spin:true});
    setTimeout(()=>{ if(G.battle&&!G.battle.done) blastAt(center.c,center.r,rad,u.ult.zcol||'#ff7a3a'); },260);
    fx(u,'ZONE','#ff7a3a','big');
  }
}
