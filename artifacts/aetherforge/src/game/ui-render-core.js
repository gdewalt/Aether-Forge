// @ts-nocheck
import { ACT_ENEMIES, BOSSES } from "./data-enemies.js";
import { COMMANDERS, COMMANDER_PORTRAITS, checkAct2CommanderUnlocks, gainXp, maybeFactionPick, showCommanderSelect, xpToNext } from "./flow-commanders.js";
import { FACTIONS, META, asc, upgTier } from "./data-units.js";
import { FAM_COL, relicIcoHTML } from "./data-loot.js";
import { G, setG } from "./engine-hex.js";
import { NODE_ICONS, NODE_META, genMap } from "./engine-map.js";
import { TT, armTipAutoHide, hideTip, openUnitDetail, positionTip, toast } from "./ui-tooltips.js";
import { cardHTML, showEquip } from "./ui-army-equip.js";
import { recruit, showRest, showShop } from "./ui-shop.js";
import { showEvent } from "./flow-events.js";
import { showForge, showTown } from "./flow-forge.js";
import { showMetaStore, winGame } from "./flow-battle-end.js";
import { finishRunStats } from "./stats.js";
import { clearRun, hasSavedRun, loadRun, saveRun } from "./flow-save.js";
import { startBattle } from "./engine-battle-setup.js";

/* ============================================================
   RENDER: HUD + screens
   ============================================================ */
export const SC=document.getElementById('screen');
// ---- Sprite system: unit art is bundled at build time from src/assets/sprites/ ----
// Vite content-hashes every file in that folder (immutably cacheable) and import.meta.glob
// hands us a static { artKey -> hashed URL } map — no runtime server, no object storage, no
// per-unit 404 probing. A unit shows its sprite when a matching <artKey>.png (or .webp) file
// exists there; otherwise it falls back to its emoji glyph. Every unit carries an `art` field
// (set by U()/EU()/TOKENS/bosses/transform forms; defaults to the unit's name) so renaming a
// unit — or several units sharing one sprite — doesn't break resolution. Always resolve via
// artOf(u). To add or replace a sprite, drop <artKey>.png in src/assets/sprites and rebuild.
export function artOf(u){ return u.art||u.name||''; }
const _spriteModules = import.meta.glob('../assets/sprites/*.{png,webp,PNG,WEBP}', { eager:true, query:'?url', import:'default' });
export const SPRITE_URLS = {};   // artKey -> bundled, content-hashed URL
for(const p in _spriteModules){
  const key = decodeURIComponent(p.slice(p.lastIndexOf('/')+1).replace(/\.(png|webp)$/i,''));
  SPRITE_URLS[key] = _spriteModules[p];
}
export function spriteURL(name){ return SPRITE_URLS[name]; }
export function hasSprite(name){ return Object.prototype.hasOwnProperty.call(SPRITE_URLS, name); }
// Warm the browser cache so a sprite is decoded before its token first paints (kills pop-in).
// No-op for art keys with no bundled file. Idempotent.
const _warmed=new Set();
export function preloadSprite(name){ const url=SPRITE_URLS[name]; if(url&&!_warmed.has(name)){ _warmed.add(name); const i=new Image(); i.src=url; } }
export function preloadUnitSprites(units){ (units||[]).forEach(u=>preloadSprite(artOf(u))); }
function _sprThumbHTML(name,px){
  return `<img src="${SPRITE_URLS[name]}" style="height:${px}px;width:auto;vertical-align:middle;margin-right:2px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">`;
}
function _sprBodyHTML(name,ds){
  const h=Number(ds.sprSize)||44;
  const ring=ds.sprRing||'';
  const flip=ds.sprFlip==='1'?'transform:scaleX(-1);':'';
  const extra=decodeURIComponent(ds.sprExtra||'');
  const sideClass=ring==='tok-e'?'spr-e':'spr-p';
  return `<div class="spr-body ${sideClass}" style="height:${h}px;${flip}${extra}">`
    +`<img src="${SPRITE_URLS[name]}" draggable="false" style="height:${h}px;width:auto;display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45));"></div>`;
}
// small inline thumbnail for cards/tooltips/lists; falls back to the emoji glyph
export function spriteThumb(u,px){
  const name=artOf(u); px=px||22;
  if(hasSprite(name)){ preloadSprite(name); return _sprThumbHTML(name,px); }
  return `<span class="spr-fallback">${u.ico}</span>`;
}
// Render the visual body of a unit: a standee sprite if available, else the emoji disc.
// opts: {size, ring:'tok-p'|'tok-e', flip:bool, fc, extra:''(css), fs}
export function unitBodyHTML(u,opts){
  const name=artOf(u);
  const ring=opts.ring||'';
  const extra=opts.extra||'';
  if(hasSprite(name)){
    preloadSprite(name);
    // standee: preserve aspect ratio, sit on the hex; height drives size
    const h=opts.size||44;
    return _sprBodyHTML(name,{sprSize:h,sprRing:ring,sprFlip:opts.flip?'1':'0',sprExtra:encodeURIComponent(extra)});
  }
  // fallback: emoji disc (existing look)
  const sz=opts.discSize||opts.size||38, fs=opts.fs||19, fc=opts.fc||'#888';
  return `<div class="tok-body ${ring}" style="background:${fc};color:#0e0b14;width:${sz}px;height:${sz}px;font-size:${fs}px;cursor:help;${extra}">${u.ico}</div>`;
}
export const HUD=document.getElementById('hud');
export function renderHUD(){
  if(!G){HUD.innerHTML='';return;}
  const relicStr=(G.relics&&G.relics.length)
    ? ' <span title="Relics" style="cursor:help" onmouseenter="showRelicBar(event)" onmouseleave="hideTip()">🏺 <b>'+G.relics.length+'</b></span>' : '';
  const cmd=COMMANDERS.find(c=>c.id===G.commander);
  HUD.innerHTML=`${cmd?`<span title="${cmd.passive}" style="cursor:help"><img class="cmd-icon-sm" src="${COMMANDER_PORTRAITS[cmd.id]}" alt=""></span>`:''}<span>❤️ Run <b>${G.over?'—':'Alive'}</b></span>
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
    `<div style="margin-top:6px"><b style="color:${FAM_COL[r.fam]}">${relicIcoHTML(r,16)} ${r.name}</b>
     <div style="font-size:11px;color:#b7a9cc">${r.desc}</div></div>`).join('');
  TT.classList.add('show');positionTip(e.clientX,e.clientY);armTipAutoHide(4000);
}

/* ---------- title ---------- */
export function resumeRun(){
  // guard against a corrupt/incompatible save leaving the player stuck: on any restore failure,
  // discard it and fall back to the title.
  try{ if(loadRun()){ renderHUD(); showMap(); return; } }catch(e){ setG(null); }
  clearRun(); showTitle();
}
// Abandon = discard the in-progress run (distinct from just navigating to the title).
export function abandonRun(){ clearRun(); showTitle(); }
export function showTitle(){
  if(G&&G._stats&&!G._stats.done) finishRunStats('abandoned');   // leaving mid-run (Abandon button) still records the run
  setG(null);renderHUD();
  const resumable=hasSavedRun();
  SC.innerHTML=`<div class="panel center" style="margin-top:30px;padding:40px">
    <h2 style="font-size:30px;color:var(--gold-bright)">Banners of the Broken Realm</h2>
    <p class="tip" style="margin:14px auto;max-width:560px;font-size:14px;line-height:1.6">
      Assemble an army, place it on the hex field, and watch the battle resolve on its own.
      Win to climb the map and recruit more units; chase faction &amp; class synergies and unleash
      ultimates. <b>Lose one battle and the run ends.</b></p>
    <div class="row" style="justify-content:center;margin-top:18px">
      ${resumable?`<button class="primary" onclick="resumeRun()">▶ Resume Run</button>`:''}
      <button class="${resumable?'small':'primary'}" onclick="showCommanderSelect()">Begin a Run</button>
      <button class="small" onclick="showHowToPlay()">📖 How to Play</button>
      <button class="small" onclick="showMetaStore()">🏛 Athenaeum</button>
      <button class="small" onclick="showStats()">📊 Stats</button>
    </div>
    <p class="tip" style="margin-top:24px">17 factions, 103 units, 58 ultimate types, deterministic auto-combat.<br>
      <span style="color:#9c8fb0">Unlocked: <b>${META.unlocked.length}/${FACTIONS.length+1}</b> factions · 📜 <b>${META.lore}</b> Lore banked</span></p>
    <div class="row" style="justify-content:center;margin-top:18px">
      <button class="small danger" onclick="if(confirm('Reset ALL progress? This permanently erases unlocked factions, commanders, Lore, ascension, and Athenaeum upgrades.')){resetProgress();showTitle();}">🗑 Reset Progress</button>
    </div>
  </div>`;
}

/* ---------- HOW TO PLAY ---------- */
// Reference screen reached from the title. Pure prose/markup — deliberately imports nothing so it
// can't add an import cycle. If a rule below changes in the engine, update it here too.
export function showHowToPlay(){
  const sect=(title,body)=>`<div class="card" style="width:100%;margin-bottom:10px;text-align:left">
    <div class="cn" style="font-size:14px">${title}</div>
    <div style="font-size:13px;color:#c9bbe0;margin-top:6px;line-height:1.65">${body}</div></div>`;
  const k=s=>`<b style="color:var(--gold-bright)">${s}</b>`;
  SC.innerHTML=`<div class="panel" style="margin-top:20px;padding:24px;max-width:820px;margin-left:auto;margin-right:auto">
    <div class="center">
      <h2 style="font-size:26px;color:var(--gold-bright)">How to Play</h2>
      <p class="tip" style="margin:10px auto 18px;max-width:640px;font-size:13px;line-height:1.6">
        A roguelike autobattler. You are a commander, not a puppeteer — you build the army and choose
        where each unit stands, then the battle plays itself out. Every win makes your army stronger;
        a single loss ends the run.</p>
    </div>

    ${sect('⚔️ The core idea',`
      You draft an army, place it on the hex battlefield, and press begin. From then on your units
      pick their own targets, move, attack, and fire their ultimates — you cannot control them
      mid-fight. ${k('All of your decisions happen before the battle starts')}: who you recruit, how
      you upgrade them, and where you position them. Combat is deterministic, so the same army in the
      same spots against the same foes always resolves the same way.`)}

    ${sect('🗺️ A run, step by step',`
      1. Pick a ${k('commander')} — each has a signature passive that shapes the whole run.<br>
      2. You start with ${k('4 army slots')}, 160 gold, and a small starting force.<br>
      3. Climb the ${k('map')} from the bottom row upward, choosing one node at a time. You may only
         move along a connecting path, so which route you take is a real decision.<br>
      4. Clear the act's ${k('boss')} at the top to advance. Three acts to win.<br>
      5. ${k('Lose a single battle and the run is over')} — there are no extra lives. What you keep is
         the Lore you banked, which is spent between runs.`)}

    ${sect('🧭 Map nodes',`
      ⚔️ ${k('Battle')} — a standard enemy host. Win to recruit a survivor.<br>
      💀 ${k('Elite')} — a much tougher fight that drops a ${k('Relic')}. Expect to need upgraded units.<br>
      🐉 ${k('Boss')} — the act's finale. Drops a Relic and Equipment.<br>
      ⚖️ ${k('Recruit')} — hire a new unit and browse gear.<br>
      🏰 ${k('Town')} — unlock another faction into this run's draft pool.<br>
      ⚒️ ${k('Arcane Forge')} — spend gold &amp; Essence to permanently upgrade a unit or a piece of gear.<br>
      🔥 ${k('Rest')} — choose a boon: train (+XP) or forage (+gold).<br>
      ❓ ${k('Event')} — a narrative choice, with reward or risk.`)}

    ${sect('🛡️ Building the army',`
      ${k('Rarity')} — Common, Uncommon, Rare, Legendary. Each step up is a modest power increase
      (roughly +20% per tier) and costs more gold, so a Legendary is better than a Common of the same
      class, but not by a landslide.<br>
      ${k('Fusion')} — collect ${k('3 copies')} of the same unit and they merge into a ★★ version at
      1.6× stats; three of those become ★★★ at 2.4×. This is the strongest power curve in the game —
      a fused Common outperforms an unfused Legendary, so duplicates are never wasted.<br>
      ${k('Equipment')} — every unit has a weapon, armor, and trinket slot. Gear dropped from bosses
      and bought in shops can be moved freely between units.<br>
      ${k('Army slots')} — you gain +1 slot every second commander level, so later fights are fought
      with more bodies as well as better ones.`)}

    ${sect('✨ Synergies',`
      Fielding several units that share a ${k('faction')} activates that faction's theme at 2 and 4
      units — Ironhold gains armor, Sylvan's archers gain attack speed, Emberkin set foes alight, and
      so on. ${k('Classes')} give weaker but easier cross-faction bonuses at 3 and 6 units (Warriors
      gain HP, Archers gain range, Mages gain ultimate power). Chasing a synergy usually beats
      fielding six unrelated units — the planning screen shows which are active.`)}

    ${sect('🔮 Ultimates',`
      Every unit has one ultimate. Its bar fills as the unit ${k('deals and takes damage')}, and fires
      automatically at full — from board-wide quakes and chain lightning to hooks that drag your foe's
      backline into the open, silences, doom brands, revives, and summons. Because the bar charges from
      combat rather than a timer, a unit that's positioned to actually fight is a unit that casts.
      Hover any unit to read exactly what its ultimate does.`)}

    ${sect('⛰️ Positioning &amp; terrain',`
      Placement is your main lever. Put durable units where the enemy arrives first and fragile
      damage-dealers behind them; melee units walk to their targets, ranged ones open fire from a
      distance. The middle of the board is scattered with terrain:<br>
      🌲 ${k('Forest')} — −25% incoming ranged damage, but slower to move through.<br>
      ⛰️ ${k('High Ground')} — +1 range and +10% ranged damage for whoever stands there.<br>
      ✨ ${k('Sacred Ground')} — ultimate charges 25% faster.<br>
      🌋 ${k('Lava')} — burns anything standing on it.<br>
      🪨 ${k('Rubble')} — impassable; it shapes the choke points.`)}

    ${sect('🏛 Between runs',`
      Runs bank ${k('Lore')}, which you spend in the ${k('Athenaeum')} on permanent upgrades and on
      unlocking new factions and commanders for future runs — so a lost run still moves you forward.
      Once you can win comfortably, raise the ${k('Ascension')} level to make enemies tougher in
      exchange for a stiffer challenge.`)}

    ${sect('💡 Tips for your first runs',`
      • Take the fights you can win and read every enemy line before you commit — hover the enemy
        units on the planning screen.<br>
      • Buy duplicates. Fusion is stronger than rarity.<br>
      • Two or four units of one faction is worth more than six scattered ones.<br>
      • Keep a healer or a shield alive; sustain wins long fights, and the longer a fight runs the
        harder both sides hit.<br>
      • ${k('Elites are gated on upgrades, not luck')} — if an elite looks impossible, it probably is.
        Take a Recruit or Forge node first and come back stronger.`)}

    <div class="row" style="margin-top:14px;justify-content:center">
      <button class="primary" onclick="showCommanderSelect()">Begin a Run</button>
      <button class="small" onclick="showTitle()">← Back</button>
    </div>
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
      <img class="ic mnode-icon" src="${NODE_ICONS[n.type]}" alt="${meta.nm}">${isCur?'<div class="pin">📍</div>':''}</div>`;
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
      <button class="small danger" onclick="if(confirm('Abandon run?'))abandonRun()">Abandon</button>
    </div></div>`;
  SC.innerHTML=html;
  saveRun();   // the map is the safe between-nodes checkpoint — persist the run for Resume
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
    if(G.act===2) checkAct2CommanderUnlocks();   // Act 2 boss just fell — check faction-gated commander unlocks
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
      <button class="small" onclick="showEquip('army')">⚒ Manage Equipment (${G.stash.length})</button></div>
    <div style="margin-top:14px" class="tip">Synergies (when deployed) — faction is primary, class is a weaker cross-faction bonus.</div></div>`;
  SC.innerHTML=html;
}
