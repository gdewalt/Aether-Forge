// @ts-nocheck
import { ACT_ENEMIES, BOSSES } from "./data-enemies.js";
import { COMMANDERS, gainXp, maybeFactionPick, showCommanderSelect, xpToNext } from "./flow-commanders.js";
import { FACTIONS, META, asc, upgTier } from "./data-units.js";
import { FAM_COL } from "./data-loot.js";
import { G, setG } from "./engine-hex.js";
import { NODE_META, genMap } from "./engine-map.js";
import { TT, armTipAutoHide, hideTip, openUnitDetail, positionTip, toast } from "./ui-tooltips.js";
import { cardHTML, showEquip } from "./ui-army-equip.js";
import { recruit, showRest, showShop } from "./ui-shop.js";
import { showEvent } from "./flow-events.js";
import { showForge, showTown } from "./flow-forge.js";
import { showMetaStore, winGame } from "./flow-battle-end.js";
import { startBattle } from "./engine-battle-setup.js";

/* ============================================================
   RENDER: HUD + screens
   ============================================================ */
export const SC=document.getElementById('screen');
// ---- Sprite system: load sprites/{exact unit name}.png, fall back to emoji ----
// Served by the api-server artifact from object storage (see artifacts/api-server/src/routes/storage.ts)
export const SPRITE_DIR='/api/storage/public-objects/sprites/';
export const _sprStatus={};   // name -> 'ok' | 'fail' | undefined(loading)
export function spriteURL(name){ return SPRITE_DIR+encodeURIComponent(name)+'.png'; }
export function preloadSprite(name){
  if(_sprStatus[name]!==undefined) return;
  _sprStatus[name]='loading';
  const img=new Image();
  img.onload=()=>{ _sprStatus[name]='ok'; _patchLoadedSprites(name); };
  img.onerror=()=>{ _sprStatus[name]='fail'; };
  img.src=spriteURL(name);
}
export function hasSprite(name){ return _sprStatus[name]==='ok'; }
// Sprite loads are async (fetched from object storage), so the very first render of a
// card/token often happens before the image is ready and falls back to the emoji glyph.
// We tag that fallback markup with data attributes and, once the sprite finishes loading,
// patch any matching elements still in the DOM in-place — no full-screen re-render needed.
function _sprThumbHTML(name,px){
  return `<img src="${spriteURL(name)}" style="height:${px}px;width:auto;vertical-align:middle;margin-right:2px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">`;
}
function _sprBodyHTML(name,ds){
  const h=Number(ds.sprSize)||44;
  const ring=ds.sprRing||'';
  const flip=ds.sprFlip==='1'?'transform:scaleX(-1);':'';
  const extra=decodeURIComponent(ds.sprExtra||'');
  const sideClass=ring==='tok-e'?'spr-e':'spr-p';
  return `<div class="spr-body ${sideClass}" style="height:${h}px;${flip}${extra}">`
    +`<img src="${spriteURL(name)}" draggable="false" style="height:${h}px;width:auto;display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45));"></div>`;
}
function _patchLoadedSprites(name){
  const sel='[data-spr="'+encodeURIComponent(name)+'"]';
  document.querySelectorAll(sel).forEach(el=>{
    el.outerHTML = el.dataset.sprKind==='thumb'
      ? _sprThumbHTML(name, el.dataset.sprPx)
      : _sprBodyHTML(name, el.dataset);
  });
}
// small inline thumbnail for cards/tooltips/lists; falls back to the emoji glyph
export function spriteThumb(u,px){
  const name=u.name||''; preloadSprite(name); px=px||22;
  if(hasSprite(name)) return _sprThumbHTML(name,px);
  return `<span class="spr-fallback" data-spr="${encodeURIComponent(name)}" data-spr-kind="thumb" data-spr-px="${px}">${u.ico}</span>`;
}
// Render the visual body of a unit: a standee sprite if available, else the emoji disc.
// opts: {size, ring:'tok-p'|'tok-e', flip:bool, fc, extra:''(css), fs}
export function unitBodyHTML(u,opts){
  const name=u.name||'';
  preloadSprite(name);
  const ring=opts.ring||'';
  const flip=opts.flip?'transform:scaleX(-1);':'';
  const extra=opts.extra||'';
  if(hasSprite(name)){
    // standee: preserve aspect ratio, sit on the hex; height drives size
    const h=opts.size||44;
    return _sprBodyHTML(name,{sprSize:h,sprRing:ring,sprFlip:opts.flip?'1':'0',sprExtra:encodeURIComponent(extra)});
  }
  // fallback: emoji disc (existing look)
  const sz=opts.discSize||opts.size||38, fs=opts.fs||19, fc=opts.fc||'#888';
  return `<div class="tok-body ${ring}" data-spr="${encodeURIComponent(name)}" data-spr-kind="body" data-spr-size="${opts.size||44}" data-spr-ring="${ring}" data-spr-flip="${opts.flip?'1':'0'}" data-spr-extra="${encodeURIComponent(extra)}" style="background:${fc};color:#0e0b14;width:${sz}px;height:${sz}px;font-size:${fs}px;cursor:help;${extra}">${u.ico}</div>`;
}
export const HUD=document.getElementById('hud');
export function renderHUD(){
  if(!G){HUD.innerHTML='';return;}
  const relicStr=(G.relics&&G.relics.length)
    ? ' <span title="Relics" style="cursor:help" onmouseenter="showRelicBar(event)" onmouseleave="hideTip()">🏺 <b>'+G.relics.length+'</b></span>' : '';
  const cmd=COMMANDERS.find(c=>c.id===G.commander);
  HUD.innerHTML=`${cmd?`<span title="${cmd.passive}" style="cursor:help">${cmd.ico}</span>`:''}<span>❤️ Run <b>${G.over?'—':'Alive'}</b></span>
    <span>🪙 <b>${G.gold}</b></span>
    ${G.essence?`<span title="Essence — premium currency for the Arcane Forge">🔮 <b>${G.essence}</b></span>`:''}
    <span>📜 Lore <b>${G.lore}</b></span>
    ${asc()>0?`<span title="Ascension ${asc()} handicaps active">⛰️ <b>A${asc()}</b></span>`:''}
    <span>⚑ Army <b>${G.army.length}/${G.cap}</b></span>
    <span title="Every level: +1 bench. Every 2nd level: +1 Army Cap." style="cursor:help">Lv <b>${G.level}</b> <span style="font-size:10px;color:#9c8fb0">${G.xp}/${xpToNext(G.level)}</span></span>
    <span title="Factions active in this run's draft pool: ${(G.activeFactions||[]).join(', ')}" style="cursor:help">🏳 <b>${(G.activeFactions||[]).length}</b></span>
    <span>Act <b>${G.act}</b></span>${relicStr}`;
}
export function showRelicBar(e){
  if(!G.relics||!G.relics.length)return;
  TT.innerHTML=`<div class="tt-n">Relics</div>`+G.relics.map(r=>
    `<div style="margin-top:6px"><b style="color:${FAM_COL[r.fam]}">${r.ico} ${r.name}</b>
     <div style="font-size:11px;color:#b7a9cc">${r.desc}</div></div>`).join('');
  TT.classList.add('show');positionTip(e.clientX,e.clientY);armTipAutoHide(4000);
}

/* ---------- title ---------- */
export function showTitle(){
  setG(null);renderHUD();
  SC.innerHTML=`<div class="panel center" style="margin-top:30px;padding:40px">
    <h2 style="font-size:30px;color:var(--gold-bright)">Banners of the Broken Realm</h2>
    <p class="tip" style="margin:14px auto;max-width:560px;font-size:14px;line-height:1.6">
      Assemble an army, place it on the hex field, and watch the battle resolve on its own.
      Win to climb the map and recruit more units; chase faction &amp; class synergies and unleash
      ultimates. <b>Lose one battle and the run ends.</b></p>
    <div class="row" style="justify-content:center;margin-top:18px">
      <button class="primary" onclick="showCommanderSelect()">Begin a Run</button>
      <button class="small" onclick="showMetaStore()">🏛 Athenaeum</button>
    </div>
    <p class="tip" style="margin-top:24px">17 factions, 149 units, 20 ultimate types, deterministic auto-combat.<br>
      <span style="color:#9c8fb0">Unlocked: <b>${META.unlocked.length}/${FACTIONS.length+1}</b> factions · 📜 <b>${META.lore}</b> Lore banked</span></p>
  </div>`;
}

/* ---------- MAP screen (graph) ---------- */
export const MAP_W=720, ROW_GAP=64, MAP_PADX=60, MAP_TOP=40;
export function nodePos(n,totalRows){
  // x spread across width by slot; y from bottom (row 0) to top (boss)
  const x = MAP_PADX + ((n.slot+0.5)/n.count) * (MAP_W-2*MAP_PADX);
  const y = MAP_TOP + (totalRows-1 - n.row) * ROW_GAP;   // row0 at bottom
  // deterministic jitter so it doesn't look like a grid
  const jx = (hashStr(n.id)%17-8);
  return { x:x+jx, y };
}
export function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0;}return Math.abs(h);}
export function reachableIds(){
  const m=G.map;
  if(!m.started) return new Set(m.rows[0].map(n=>n.id));   // first move: any bottom node
  const cur=m.byId[m.curId];
  return new Set(cur?cur.next:[]);
}
export function showMap(){
  G.over=false;renderHUD();
  const m=G.map;
  const totalRows=m.rows.length;
  const mapH = MAP_TOP*2 + (totalRows-1)*ROW_GAP;
  const reach=reachableIds();
  // build edges svg
  let edges='';
  m.rows.flat().forEach(n=>{
    const a=nodePos(n,totalRows);
    n.next.forEach(nid=>{
      const c=m.byId[nid]; const b=nodePos(c,totalRows);
      const onPath = (m.visited&&m.visited.includes(n.id)&&m.curId===nid) ;
      const active = (m.curId===n.id && reach.has(nid)) || (!m.started && n.row===0);
      const col = active? 'var(--gold)' : (m.visited&&m.visited.includes(n.id)? 'var(--teal)':'#3a2f4d');
      const w = active?2.4:1.4;
      // gentle curve
      const midY=(a.y+b.y)/2;
      edges+=`<path d="M${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}" fill="none" stroke="${col}" stroke-width="${w}" opacity="${active?0.95:0.55}"/>`;
    });
  });
  // build nodes
  let nodes='';
  m.rows.flat().forEach(n=>{
    const pos=nodePos(n,totalRows);
    const meta=NODE_META[n.type]||NODE_META.battle;
    const isReach = reach.has(n.id) && !G.over;
    const isCur = m.curId===n.id;
    const isVisited = m.visited&&m.visited.includes(n.id);
    let cls='mnode'+(n.type==='boss'?' boss':'');
    if(isCur)cls+=' current'; else if(isVisited)cls+=' visited'; else if(isReach)cls+=' reachable';
    nodes+=`<div class="${cls}" style="left:${pos.x}px;top:${pos.y}px"
      ${isReach?`onclick="enterNode('${n.id}')"`:''}
      onmouseenter="mapTip(event,'${n.type}')" onmouseleave="hideTip()">
      <div class="ic">${meta.ic}</div>${isCur?'<div class="pin">📍</div>':''}</div>`;
  });
  let html=`<div class="panel"><div class="lbl">The Road — Act ${G.act} ${'★'.repeat(G.act)}</div>`;
  if(upgTier('cdx_boss') || G._scoutRows){   // Codex Oracle's Sight or Expedition Forward Scouts: preview the act's likely boss
    const roster=ACT_ENEMIES[Math.min(3,G.act)]; const tally=G.routeTally||{};
    let bf=roster.slice().sort((a,b)=>(tally[b]||0)-(tally[a]||0))[0]||roster[0];
    if(G.act>=3 && !Object.keys(tally).length) bf='Dread Dominion';
    const B=BOSSES[bf];
    if(B) html+=`<div class="row" style="margin-bottom:8px;padding:6px 10px;border:1px solid #6a4a9c;border-radius:6px;background:#1a1430">
      <span style="font-size:16px">🔮</span><div class="tip" style="font-size:11px;color:#c9a7e8">Oracle's Sight — the road points toward <b>${B.ico} ${B.name}</b>. ${B.desc}</div></div>`;
  }
  html+=`<div id="map-wrap" style="width:${MAP_W}px;height:${mapH}px">
      <svg id="map-edges" width="${MAP_W}" height="${mapH}">${edges}</svg>
      ${nodes}
    </div>
    <div class="maplegend">
      <span>⚔️ Battle</span><span>💀 Elite</span><span>⚖️ Recruit</span>
      <span>🔥 Rest</span><span>❓ Event</span><span>🐉 Boss</span>
    </div>
    <p class="tip center" style="margin-top:6px">${m.started?'Follow an edge from 📍 to your next node.':'Choose any node on the bottom row to begin.'}</p>`;
  if(G.relics&&G.relics.length){
    html+=`<div class="row" style="margin-top:8px;justify-content:center;gap:6px;flex-wrap:wrap">`;
    G.relics.forEach(r=>html+=`<span class="chip" title="${r.name}: ${r.desc}" style="background:${FAM_COL[r.fam]}22;color:${FAM_COL[r.fam]};border:1px solid ${FAM_COL[r.fam]}66;cursor:help">${r.ico} ${r.name}</span>`);
    html+=`</div>`;
  }
  html+=`<div class="row" style="margin-top:14px;justify-content:space-between">
      <button class="small" onclick="showArmy()">View Army (${G.army.length})</button>
      <button class="small" onclick="showEquip()">⚒ Equipment (${G.stash.length})</button>
      <button class="small danger" onclick="if(confirm('Abandon run?'))showTitle()">Abandon</button>
    </div></div>`;
  SC.innerHTML=html;
}
export const MAP_TIP={battle:'A standard enemy host. Win to recruit a survivor.',
  elite:'A tougher fight — but it drops a Relic.',shop:'Recruit a new unit and browse gear.',
  town:'Unlock a new faction into this run’s draft pool.',
  forge:'Arcane Forge — spend gold &amp; Essence to permanently upgrade a unit or gear.',
  rest:'Choose a boon: train (+XP) or forage (+gold).',event:'A narrative choice with a chance at reward or risk.',
  boss:'The act boss. Drops a Relic and Equipment.'};
export function mapTip(e,type){ TT.innerHTML=`<div class="tt-n">${NODE_META[type].nm}</div><div style="font-size:12px;color:#c9bbe0;margin-top:4px">${MAP_TIP[type]||''}</div>`;TT.classList.add('show');positionTip(e.clientX,e.clientY);armTipAutoHide();}

export function enterNode(id){
  const m=G.map; const n=m.byId[id];
  const reach=reachableIds();
  if(!reach.has(id)){ toast('You can only move along a path.'); return; }
  m.curId=id; m.started=true; m.visited=(m.visited||[]); if(!m.visited.includes(id))m.visited.push(id);
  G.curNode=n;
  if(n.type==='battle'||n.type==='elite'||n.type==='boss'){ startBattle({t:n.type,nm:NODE_META[n.type].nm,ic:NODE_META[n.type].ic}); }
  else if(n.type==='shop'){ showShop(); }
  else if(n.type==='town'){ showTown(); }
  else if(n.type==='forge'){ showForge(); }
  else if(n.type==='rest'){ showRest(); }
  else if(n.type==='event'){ showEvent(); }
}
// after finishing a node, either continue or (if boss done) go to next act
export function advanceRow(){
  const m=G.map; const n=m.byId[m.curId];
  if(n && n.type==='boss'){
    G.act++; if(G.act>3){ winGame(); return; }
    G.actCleared=0;   // difficulty ramps from scratch each act
    G._seenEvents=[];  // events draw without repeats within an act
    G.map=genMap(G.act); G.routeTally={}; gainXp(15,true);
    if(maybeFactionPick(()=>{ toast('Act '+G.act+' begins'); showMap(); })) return;
    toast('Act '+G.act+' begins — +15 XP');
    showMap(); return;
  }
  if(maybeFactionPick(()=>showMap())) return;
  showMap();
}

/* ---------- ARMY view ---------- */
export function showArmy(){
  let html=`<div class="panel"><div class="lbl">Your Army — tap a unit to inspect</div><div class="bench">`;
  G.army.forEach((u,i)=>html+=`<div onclick="openUnitDetail(G.army[${i}])" style="cursor:pointer">${cardHTML(u,i,false)}</div>`);
  html+=`</div><div class="row" style="margin-top:14px;justify-content:space-between">
      <button class="small" onclick="showMap()">← Back to Map</button>
      <button class="small" onclick="showEquip()">⚒ Manage Equipment (${G.stash.length})</button></div>
    <div style="margin-top:14px" class="tip">Synergies (when deployed) — faction is primary, class is a weaker cross-faction bonus.</div></div>`;
  SC.innerHTML=html;
}
