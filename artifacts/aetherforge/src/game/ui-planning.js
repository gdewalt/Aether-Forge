// @ts-nocheck
import { CCOL, FACTIONS, FCOL, upgTier } from "./data-units.js";
import { CLASS_SYN, FAC_SYN } from "./synergies.js";
import { COLS, G, GRIDH, GRIDW, HR, ROWS, hexCenter } from "./engine-hex.js";
import { EQUIP_BY_ID, unitPower, unitRarity } from "./data-loot.js";
import { RNG } from "./rng.js";
import { SC, hasSprite, unitBodyHTML } from "./ui-render-core.js";
import { TERRAIN_ICONS, TERRAIN_META, terrainAt } from "./engine-battle-setup.js";
import { TT, ULT_DESC, armTipAutoHide, hideTip, positionTip, showTip, toast } from "./ui-tooltips.js";
import { applyUnitAbility, beginCombat, computeEnemyPositions, hasRelic, occupied } from "./engine-combat.js";
import { cardHTML } from "./ui-army-equip.js";
import { clone } from "./flow-forge.js";
import { unitTier } from "./ui-shop.js";

export function showPlan(){
  const b=G.battle;
  let html=`<div class="panel"><div class="lbl">Deploy — ${b.node.nm} (vs ${b.enemyIco||''} ${b.enemyTheme})</div>`;
  if(b.mod) html+=`<div class="row" style="margin-bottom:8px;padding:7px 10px;border:1px solid var(--violet);border-radius:6px;background:#1d1430">
    <span style="font-size:18px">${b.mod.ico}</span><div><b style="font-family:Cinzel;color:#c9a7e8">${b.mod.name}</b>
    <div class="tip" style="font-size:11px">${b.mod.desc}</div></div></div>`;
  if(G.fortifyNext) { const pos=G.fortifyNext>0; html+=`<div class="row" style="margin-bottom:8px;padding:6px 10px;border:1px solid ${pos?'#2f8f83':'#a5453a'};border-radius:6px;background:${pos?'#10231f':'#2a1212'}"><span style="font-size:16px">${pos?'🛡️':'🩸'}</span><div class="tip" style="font-size:11px;color:${pos?'#8fd6c8':'#e8a59f'}">${pos?'Fortified':'Rift-wounded'} — your units enter this battle with ${pos?'+':''}${Math.round(G.fortifyNext*100)}% Max HP.</div></div>`; }
  if(G._eventMod){ const m=G._eventMod; const fc={Buff:'#2f8f83',Debuff:'#a5453a',Gamble:'#b8893a'}[m.flavor]||'#6a5fa0'; const bg={Buff:'#10231f',Debuff:'#2a1212',Gamble:'#241c10'}[m.flavor]||'#16121f'; html+=`<div class="row" style="margin-bottom:8px;padding:6px 10px;border:1px solid ${fc};border-radius:6px;background:${bg}"><span style="font-size:16px">${m.ico}</span><div class="tip" style="font-size:11px;color:#d8cdb0"><b>${m.name}</b> <span style="opacity:.7">(${m.flavor})</span> — ${m.desc}</div></div>`; }
  if(b.bossName) html+=`<div class="row" style="margin-bottom:8px;padding:7px 10px;border:1px solid #a5453a;border-radius:6px;background:#2a1212">
    <span style="font-size:20px">${b.enemyIco}</span><div><b style="font-family:Cinzel;color:#e89a8f">BOSS — ${b.bossName}</b>
    <div class="tip" style="font-size:11px">${b.bossDesc}</div></div></div>`;
  if(hasRelic('scryingorb')) html+=`<div class="row" style="margin-bottom:8px;padding:6px 10px;border:1px solid #6a4a9c;border-radius:6px;background:#1a1430">
    <span style="font-size:16px">🔮</span><div class="tip" style="font-size:11px;color:#c9a7e8">Scrying Orb — the enemy army is revealed below (dashed tokens). Hover or tap one to inspect it, then counter-place.</div></div>`;
  html+=`<div class="row" style="justify-content:space-between;margin-bottom:6px">
    <span class="tip" id="placehint">Tap a unit below, then tap a glowing hex to place it.</span>
    <span class="tip">Placed: <b id="pcount">0</b>/${G.cap}</span></div>`;
  html+=`<div class="gridwrap" id="gridwrap"><div id="grid" style="width:${GRIDW}px;height:${GRIDH}px"></div></div>`;
  html+=`<div class="grid2" style="margin-top:14px">
    <div><div class="lbl">Your Bench — tap to select (or drag)</div><div class="bench" id="benchZone"></div>
      <div class="tip" style="font-size:10px;margin-top:4px">Tap a placed unit's card to return it to the bench.</div></div>
    <div><div class="lbl">Active Synergies</div><div class="syn-list" id="synZone"></div></div>
  </div>`;
  if(upgTier('cdx_synergy')){   // Codex — Enemy Lore: show the foe's active synergies during planning
    const foe=(b.enemyTemplates||b.E||[]).filter(u=>!u.token&&!u.boss);
    if(foe.length){ const es=calcSyn(foe);
      let er='';
      es.active.forEach(a=>{ er+=`<div class="syn act" style="border-color:#7a4a4a"><span>${a.name} ×${a.n}</span><small>${a.desc}</small></div>`; });
      if(!er)er='<div class="tip">No active enemy synergies.</div>';
      html+=`<div style="margin-top:10px"><div class="lbl">👁️ Enemy Synergies (Codex)</div><div class="syn-list">${er}</div></div>`;
    }
  }
  html+=`<div class="row" style="margin-top:16px;justify-content:space-between">
    <button class="small" onclick="autoPlace()">Auto-place</button>
    <button class="primary" id="beginBtn" onclick="beginCombat()" disabled>Begin Battle ⚔</button></div></div>`;
  SC.innerHTML=html;
  b.placements={}; b.selIdx=null;
  // restore last battle's deployment: units keep their hex if it's still a legal spot.
  // Units are tracked by a run-scoped uid (assigned here) since army order can shift.
  G.army.forEach(u=>{ if(!u._uid) u._uid=(G._uidSeq=(G._uidSeq||0)+1); });
  if(G._lastPlace){
    G.army.forEach((u,i)=>{
      const s=G._lastPlace[u._uid]; if(!s)return;
      if(Object.keys(b.placements).length>=G.cap)return;
      if(s.c>3 || b.placements[s.c+','+s.r])return;
      const tt=terrainAt(s.c,s.r); if(tt==='rubble'||tt==='lava')return;
      b.placements[s.c+','+s.r]={idx:i,c:s.c,r:s.r};
    });
  }
  drawGrid('plan');
  if(hasRelic('scryingorb')) drawEnemyPreview();
  drawBench();
  updateSyn();
  fitGrid();
  if(Object.keys(b.placements).length) afterPlace();   // render the restored tokens & enable Begin
  // bench is a drop target: dragging a placed unit here un-deploys it
  const bz=document.getElementById('benchZone');
  bz.addEventListener('dragover',e=>{if(DRAG&&DRAG.src==='hex'){e.preventDefault();bz.classList.add('dragover');}});
  bz.addEventListener('dragleave',()=>bz.classList.remove('dragover'));
  bz.addEventListener('drop',e=>{e.preventDefault();bz.classList.remove('dragover');
    if(DRAG&&DRAG.src==='hex'){delete G.battle.placements[DRAG.fromKey];afterPlace();toast('Returned to bench');}});
}
export function fitGrid(){
  const wrap=document.getElementById('gridwrap'); const grid=document.getElementById('grid');
  if(!wrap||!grid)return;
  const avail=wrap.clientWidth;
  const scale=Math.min(1, avail/GRIDW);
  grid.style.transform = scale<1 ? `scale(${scale})` : '';
  // reserve the scaled height so following content isn't overlapped
  wrap.style.height = (GRIDH*scale)+'px';
}
window.addEventListener('resize',()=>{ if(document.getElementById('gridwrap'))fitGrid(); });
export function drawGrid(mode){
  const g=document.getElementById('grid');g.innerHTML='';
  // 1) one SVG holding all hex visuals (no per-hex event binding here)
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('width',GRIDW);svg.setAttribute('height',GRIDH);
  svg.style.cssText='position:absolute;left:0;top:0;pointer-events:none';
  // --- defs: ground texture, zone glows, hex sheen ---
  const playerEnd=hexCenter(3,0).x+HR;          // x where player deploy zone ends
  const enemyStart=hexCenter(COLS-4,0).x-HR;    // x where enemy deploy zone begins
  const mid=GRIDW/2;
  let defs=`<defs>
    <radialGradient id="ground" cx="50%" cy="38%" r="78%">
      <stop offset="0%" stop-color="#3d3326"/><stop offset="42%" stop-color="#332a20"/>
      <stop offset="78%" stop-color="#251e17"/><stop offset="100%" stop-color="#191410"/>
    </radialGradient>
    <linearGradient id="pZone" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(90,150,230,.28)"/><stop offset="100%" stop-color="rgba(90,150,230,.04)"/>
    </linearGradient>
    <linearGradient id="eZone" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="rgba(220,90,70,.28)"/><stop offset="100%" stop-color="rgba(220,90,70,.04)"/>
    </linearGradient>
    <radialGradient id="hexSheen" cx="50%" cy="32%" r="70%">
      <stop offset="0%" stop-color="rgba(255,245,220,.10)"/><stop offset="100%" stop-color="rgba(255,245,220,0)"/>
    </radialGradient>
    <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0"/>
      <feComposite operator="in" in2="SourceGraphic"/></filter>
    <filter id="zoneBlur"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>`;
  // --- ground plate + faint mottled texture ---
  let bg=`<rect x="0" y="0" width="${GRIDW}" height="${GRIDH}" rx="14" fill="url(#ground)"/>`;
  bg+=`<rect x="0" y="0" width="${GRIDW}" height="${GRIDH}" rx="14" fill="#6b5a3e" opacity="0.5" filter="url(#rough)"/>`;
  // soft deploy-zone glows (blurred bands behind the hexes)
  bg+=`<rect x="0" y="8" width="${playerEnd+6}" height="${GRIDH-16}" rx="20" fill="url(#pZone)" filter="url(#zoneBlur)" opacity="0.9"/>`;
  bg+=`<rect x="${enemyStart-6}" y="8" width="${GRIDW-enemyStart+6}" height="${GRIDH-16}" rx="20" fill="url(#eZone)" filter="url(#zoneBlur)" opacity="0.9"/>`;
  // central battle line down the neutral band
  bg+=`<line x1="${mid}" y1="14" x2="${mid}" y2="${GRIDH-14}" stroke="rgba(230,200,140,.18)" stroke-width="2" stroke-dasharray="3 9"/>`;
  let polys='';
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
    const ce=hexCenter(c,r);
    const isP=c<=3, isE=c>=COLS-4;
    const ter=terrainAt(c,r);
    // earthen hex base with gentle per-hex tonal variation
    const tone=((c*7+r*13)%5);
    let fill = isP?'rgba(74,116,170,.16)': isE?'rgba(176,74,64,.16)':`rgba(${past(tone)},.16)`;
    let stroke = isP?'rgba(120,170,224,.55)': isE?'rgba(214,120,108,.55)':'rgba(150,130,96,.34)';
    let sw='1.4';
    if(ter){ fill=TERRAIN_META[ter].col; stroke='rgba(210,190,140,.6)'; sw='1.6'; }
    polys+=`<polygon points="${hexPts(ce.x,ce.y)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"></polygon>`;
    polys+=`<polygon points="${hexPts(ce.x,ce.y)}" fill="url(#hexSheen)" stroke="none"></polygon>`;
  }
  // vignette on top for depth
  const vig=`<rect x="0" y="0" width="${GRIDW}" height="${GRIDH}" rx="14" fill="none"/>
    <radialGradient id="vig" cx="50%" cy="50%" r="72%"><stop offset="62%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,.45)"/></radialGradient>
    <rect x="0" y="0" width="${GRIDW}" height="${GRIDH}" rx="14" fill="url(#vig)"/>`;
  svg.innerHTML=defs+bg+polys+vig;
  // robust fallback: if innerHTML didn't populate (older engines), build nodes explicitly
  if(!svg.querySelector('polygon')){
    for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
      const ce=hexCenter(c,r);const isP=c<=3,isE=c>=COLS-4;
      const p=document.createElementNS(svgNS,'polygon');
      p.setAttribute('points',hexPts(ce.x,ce.y));
      p.setAttribute('fill', isP?'rgba(74,116,170,.16)': isE?'rgba(176,74,64,.16)':'rgba(120,105,80,.16)');
      p.setAttribute('stroke', isP?'rgba(120,170,224,.55)': isE?'rgba(214,120,108,.55)':'rgba(150,130,96,.34)');
      p.setAttribute('stroke-width','1.4');
      svg.appendChild(p);
    }
  }
  g.appendChild(svg);
  // --- ambient particles: drifting dust motes + faint embers for atmosphere ---
  const pf=document.createElement('div'); pf.className='particle-field';
  pf.style.cssText=`position:absolute;left:0;top:0;width:${GRIDW}px;height:${GRIDH}px;pointer-events:none;overflow:hidden;border-radius:14px;z-index:2;--gridh:${GRIDH}px`;
  let pHTML='';
  for(let i=0;i<26;i++){
    const x=Math.round(RNG()*GRIDW), dur=(6+RNG()*9).toFixed(1), delay=(-RNG()*12).toFixed(1);
    const sz=(1.5+RNG()*2.5).toFixed(1), drift=Math.round(RNG()*40-20);
    const ember=RNG()<0.32;
    const col=ember?`rgba(255,${150+Math.round(RNG()*60)},80,`:`rgba(225,210,170,`;
    const op=(ember?0.5:0.32)*(0.6+RNG()*0.4);
    pHTML+=`<span class="mote${ember?' ember':''}" style="left:${x}px;width:${sz}px;height:${sz}px;
      background:${col}${op.toFixed(2)});--dur:${dur}s;--delay:${delay}s;--drift:${drift}px;
      box-shadow:0 0 ${ember?6:3}px ${col}${(op*0.8).toFixed(2)})"></span>`;
  }
  pf.innerHTML=pHTML;
  g.appendChild(pf);

  // terrain icon markers (with hover/tap tooltip)
  if(G.battle&&G.battle.terrain){
    for(const k in G.battle.terrain){
      const [c,r]=k.split(',').map(Number);
      const ce=hexCenter(c,r);
      const m=document.createElement('div');
      const ter=G.battle.terrain[k]; const meta=TERRAIN_META[ter];
      const ts=Math.round(HR*1.15);
      m.style.cssText=`position:absolute;left:${ce.x-ts/2}px;top:${ce.y-ts/2-2}px;z-index:3;pointer-events:auto;cursor:help;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))`;
      m.innerHTML=`<svg width="0" height="0"><defs><filter id="tShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="0.6" flood-opacity="0.5"/></filter></defs></svg>`+terrainSVG(ter,ts);
      m.addEventListener('mouseenter',e=>{TT.innerHTML=`<div class="tt-n">${meta.ico} ${meta.name}</div><div style="font-size:12px;color:#c9bbe0;margin-top:4px">${meta.desc}</div>`;TT.classList.add('show');positionTip(e.clientX,e.clientY);armTipAutoHide();});
      m.addEventListener('mouseleave',hideTip);
      g.appendChild(m);
    }
  }

  // 2) reliable DIV tap-targets for deploy hexes (immune to SVG/transform issues)
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
    const isP=c<=3;
    if(!(mode==='plan'&&isP))continue;
    const ce=hexCenter(c,r);
    const t=document.createElement('div');
    t.className='hex deploy';
    t.dataset.c=c;t.dataset.r=r;
    // square-ish tap pad centered on the hex (a bit smaller than hex so they don't overlap much)
    const size=HR*1.7;
    t.style.cssText=`position:absolute;left:${ce.x-size/2}px;top:${ce.y-size/2}px;width:${size}px;height:${size}px;`+
      `border-radius:50%;cursor:pointer;z-index:4;`;
    t.addEventListener('click',()=>placeAt(c,r));
    t.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';t.classList.add('dragover');});
    t.addEventListener('dragleave',()=>t.classList.remove('dragover'));
    t.addEventListener('drop',e=>{e.preventDefault();t.classList.remove('dragover');dropOnHex(c,r);});
    g.appendChild(t);
  }
}
export function hexPts(cx,cy){let p=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i);p.push((cx+HR*Math.cos(a)).toFixed(1)+','+(cy+HR*Math.sin(a)).toFixed(1));}return p.join(' ');}
// subtle earthen tonal variation for neutral-band hexes
export function past(n){ const t=[[126,110,82],[116,102,76],[134,116,86],[120,108,84],[128,114,80]]; return t[n%t.length].join(','); }
// illustrated terrain tiles (painterly cell-shaded PNG art instead of emoji)
export function terrainSVG(type,size){
  const s=size||40;
  const src=TERRAIN_ICONS[type]||TERRAIN_ICONS.rubble;
  return `<img src="${src}" width="${s}" height="${s}" style="display:block;object-fit:contain" alt="${type}">`;
}
// Scrying Orb: draw translucent enemy preview tokens on the planning grid.
export function drawEnemyPreview(){
  const b=G.battle; if(!b||!b.enemyTemplates) return;
  if(!b.enemyPositions) b.enemyPositions=computeEnemyPositions(b.enemyTemplates);
  const g=document.getElementById('grid'); if(!g) return;
  b.enemyPositions.forEach(p=>{
    const t=p.t; const ce=hexCenter(p.c,p.r);
    const tok=document.createElement('div');
    tok.className='enemy-preview';
    const size=HR*1.5;
    const big=t.boss||t.subboss;
    tok.style.cssText=`position:absolute;left:${ce.x-size/2}px;top:${ce.y-size/2}px;width:${size}px;height:${size}px;`+
      `border-radius:50%;z-index:3;display:flex;align-items:center;justify-content:center;`+
      `font-size:${big?18:15}px;background:rgba(165,69,58,.20);border:1.5px dashed #c87a6e;`+
      `opacity:.78;cursor:help;filter:drop-shadow(0 1px 2px #000)`;
    tok.textContent=t.ico||(t.boss?'🐉':'☠');
    const ultName=t.ult?(t.ult.name||t.ult.k):'—';
    const ultDesc=t.ult&&typeof ULT_DESC!=='undefined'&&ULT_DESC[t.ult.k]?ULT_DESC[t.ult.k]:'';
    const rangeTxt=(t.t==='r'?`Ranged ${t.rng}`:'Melee');
    tok.addEventListener('mouseenter',e=>{
      TT.innerHTML=`<div class="tt-n">${t.ico||''} ${t.name}${big?' ★':''}</div>`+
        `<div style="font-size:11px;color:#c9bbe0;margin-top:3px">${t.cls||''} · ${rangeTxt}</div>`+
        `<div style="font-size:11px;color:#9fb6c9;margin-top:2px">❤ ${t.hp} · ⚔ ${t.dmg} · ⚡ ${t.as}</div>`+
        `<div style="font-size:11px;color:#e8b98f;margin-top:3px">✦ ${ultName}${ultDesc?' — '+ultDesc:''}</div>`;
      TT.classList.add('show');positionTip(e.clientX,e.clientY);armTipAutoHide();
    });
    tok.addEventListener('mouseleave',hideTip);
    tok.addEventListener('click',()=>{
      TT.innerHTML=`<div class="tt-n">${t.ico||''} ${t.name}${big?' ★':''}</div>`+
        `<div style="font-size:11px;color:#c9bbe0;margin-top:3px">${t.cls||''} · ${rangeTxt}</div>`+
        `<div style="font-size:11px;color:#9fb6c9;margin-top:2px">❤ ${t.hp} · ⚔ ${t.dmg} · ⚡ ${t.as}</div>`+
        `<div style="font-size:11px;color:#e8b98f;margin-top:3px">✦ ${ultName}${ultDesc?' — '+ultDesc:''}</div>`;
      TT.classList.add('show');positionTip(ce.x+40,ce.y+120);armTipAutoHide();
    });
    g.appendChild(tok);
  });
}
export function drawBench(){
  const z=document.getElementById('benchZone');z.innerHTML='';
  G.army.forEach((u,i)=>{
    const placed=Object.values(G.battle.placements).some(p=>p.idx===i);
    const d=document.createElement('div');d.innerHTML=cardHTML(u,i,placed);
    const card=d.firstElementChild;
    if(G.battle.selIdx===i) card.classList.add('sel');
    // hover tooltip (static stats) — desktop only; tap is reserved for selection on mobile
    card.addEventListener('mouseenter',e=>showTip(u,false,e.clientX,e.clientY));
    card.addEventListener('mousemove',e=>positionTip(e.clientX,e.clientY));
    card.addEventListener('mouseleave',hideTip);
    if(!placed){
      card.setAttribute('draggable','true');
      card.addEventListener('dragstart',e=>{
        DRAG={src:'bench',idx:i};card.classList.add('dragging');hideTip();
        e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));
      });
      card.addEventListener('dragend',()=>{card.classList.remove('dragging');clearDragHighlights();DRAG=null;});
      // TAP TO SELECT (primary method on touch): tap a unit, then tap a glowing hex
      card.addEventListener('click',()=>{
        hideTip();
        G.battle.selIdx=(G.battle.selIdx===i?null:i);
        drawBench(); highlightDeploy();
      });
    } else {
      // tapping a placed unit's card returns it to the bench
      card.addEventListener('click',()=>{
        for(const k in G.battle.placements){ if(G.battle.placements[k].idx===i){ delete G.battle.placements[k]; break; } }
        G.battle.selIdx=null; afterPlace(); highlightDeploy();
      });
    }
    z.appendChild(card);
  });
}
// pulse the deploy hexes when a unit is selected, so mobile users see where to tap
export function highlightDeploy(){
  const on = G.battle && G.battle.selIdx!==null && G.battle.selIdx!==undefined;
  document.querySelectorAll('.hex.deploy').forEach(h=>h.classList.toggle('await', on));
  const hint=document.getElementById('placehint');
  if(hint) hint.textContent = on ? '👆 Now tap a glowing hex on your side to place this unit'
                                 : 'Tap a unit below, then tap a glowing hex to place it.';
}
export let DRAG=null;
export function clearDragHighlights(){document.querySelectorAll('.hex.dragover').forEach(h=>h.classList.remove('dragover'));}
export function placeAt(c,r){
  const b=G.battle; if(b.selIdx===null){toast('Tap a unit first, then tap a hex');return;}
  const key=c+','+r;
  // if the selected unit is already somewhere, free that hex
  for(const k in b.placements)if(b.placements[k].idx===b.selIdx)delete b.placements[k];
  // if the target hex is occupied by a different unit, bump it back to the bench
  if(b.placements[key]) delete b.placements[key];
  if(Object.keys(b.placements).length>=G.cap){toast('At Army Cap ('+G.cap+')');b.selIdx=null;highlightDeploy();return;}
  b.placements[key]={idx:b.selIdx,c,r};
  b.selIdx=null;
  afterPlace(); highlightDeploy();
}
export function dropOnHex(c,r){
  if(!DRAG)return;
  const b=G.battle, key=c+','+r;
  // never allow a unit to be placed on an impassable / hazard hex
  const tt=terrainAt(c,r);
  if(tt==='rubble'){ toast('Rubble — impassable'); return; }
  if(tt==='lava'){ toast('Lava — too dangerous to stand on'); return; }
  // if dragging from another hex, that's a move; allow swapping
  if(DRAG.src==='hex'){
    const fromKey=DRAG.fromKey;
    if(b.placements[key]){ // swap the two units
      const tmp=b.placements[key];
      b.placements[key]=b.placements[fromKey];
      b.placements[fromKey]=tmp;
      b.placements[key].c=c;b.placements[key].r=r;
      b.placements[fromKey].c=Number(fromKey.split(',')[0]);b.placements[fromKey].r=Number(fromKey.split(',')[1]);
    } else {
      delete b.placements[fromKey];
      b.placements[key]={idx:DRAG.idx,c,r};
    }
    afterPlace();return;
  }
  // from bench
  if(b.placements[key]){toast('Hex occupied');return;}
  if(Object.keys(b.placements).length>=G.cap){toast('At Army Cap');return;}
  for(const k in b.placements)if(b.placements[k].idx===DRAG.idx)delete b.placements[k];
  b.placements[key]={idx:DRAG.idx,c,r};
  afterPlace();
}
export function afterPlace(){
  renderTokensPlan();drawBench();updateSyn();
  const pc=document.getElementById('pcount');if(pc)pc.textContent=Object.keys(G.battle.placements).length;
  const bb=document.getElementById('beginBtn');if(bb)bb.disabled=Object.keys(G.battle.placements).length===0;
}
export function renderTokensPlan(){
  document.querySelectorAll('.unit-tok.plan').forEach(e=>e.remove());
  const g=document.getElementById('grid');
  for(const k in G.battle.placements){
    const p=G.battle.placements[k];const u=G.army[p.idx];const ce=hexCenter(p.c,p.r);
    const fc=FCOL[u.faction];const key=k;
    const d=document.createElement('div');d.className='unit-tok plan';
    const useSpr=hasSprite(u.name);
    d.style.cssText=`--hs:70px;left:${ce.x-35}px;top:${ce.y-35}px;pointer-events:auto`;
    d.setAttribute('draggable','true');
    d.innerHTML=`<div class="tok-stack${useSpr?' has-spr':''}">${unitBodyHTML(u,{ring:'tok-p',fc,size:useSpr?82:48,extra:useSpr?'':'cursor:grab'})}</div>`;
    d.addEventListener('mouseenter',e=>showTip(u,false,e.clientX,e.clientY));
    d.addEventListener('mousemove',e=>positionTip(e.clientX,e.clientY));
    d.addEventListener('mouseleave',hideTip);
    d.addEventListener('dragstart',e=>{DRAG={src:'hex',idx:p.idx,fromKey:key};d.classList.add('dragging');hideTip();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','hex');});
    d.addEventListener('dragend',()=>{d.classList.remove('dragging');clearDragHighlights();DRAG=null;});
    d.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});
    d.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();dropOnHex(p.c,p.r);});
    // tap behaviour: if a bench unit is selected, place/swap here; else return this unit to bench
    d.addEventListener('click',e=>{
      e.stopPropagation();
      if(G.battle.selIdx!==null && G.battle.selIdx!==undefined){ placeAt(p.c,p.r); }
      else { delete G.battle.placements[key]; G.battle.selIdx=null; afterPlace(); highlightDeploy(); toast('Returned to bench'); }
    });
    g.appendChild(d);
  }
}
export function autoPlace(){
  const b=G.battle;b.placements={};
  const cap=Math.min(G.cap,G.army.length);
  const RAR_W={Common:0,Uncommon:18,Rare:42,Legendary:80};
  const TIER_W={1:0,2:55,3:130};
  // composite priority: raw effective power + big bumps for rarity and tier (the deliberate
  // "tall" investments), so stronger/higher-tier units always make the board first.
  const scoreOf=(u)=> unitPower(u) + (RAR_W[unitRarity(u)]||0) + (TIER_W[unitTier(u)]||0);
  // rank the whole bench, then bias toward the dominant faction so picks still build synergy
  const ranked=G.army.map((u,idx)=>({u,idx,base:scoreOf(u)})).sort((a,b)=>b.base-a.base);
  // find the strongest faction among the top contenders to nudge synergy completion
  const facCount={};
  ranked.slice(0,Math.min(cap+2,ranked.length)).forEach(e=>{ if(e.u.faction&&e.u.faction!=='Neutral') facCount[e.u.faction]=(facCount[e.u.faction]||0)+1; });
  const topFac=Object.keys(facCount).sort((a,b)=>facCount[b]-facCount[a])[0];
  ranked.forEach(e=>{ e.score=e.base + (topFac&&e.u.faction===topFac?22:0) + (e.u.cls?6:0); });
  ranked.sort((a,b)=>b.score-a.score);
  const chosen=ranked.slice(0,cap);
  // position: melee to the front rows (col 3 then 2), ranged to the back (col 1 then 0).
  // Within each line, the strongest go to the center rows where they fight longest.
  const melee=chosen.filter(e=>e.u.t!=='r').sort((a,b)=>b.score-a.score);
  const ranged=chosen.filter(e=>e.u.t==='r').sort((a,b)=>b.score-a.score);
  const centerRows=(count)=>{ const mid=(ROWS-1)/2, out=[]; for(let i=0;i<count;i++){ const off=Math.ceil(i/2)*(i%2?1:-1); out.push(Math.max(0,Math.min(ROWS-1,Math.round(mid+off)))); } return out; };
  const placeLine=(list,frontCol,backCol)=>{
    const rows=centerRows(list.length);
    const free=(c,r)=> r>=0&&r<ROWS && c>=0 && !b.placements[c+','+r] && terrainAt(c,r)!=='rubble' && terrainAt(c,r)!=='lava';
    list.forEach((e,k)=>{
      let c=frontCol, r=rows[k];
      if(!free(c,r)){
        // try the back column at the same row, then scan rows in both columns for any free, non-rubble hex
        let found=false;
        for(const col of [backCol,frontCol]){ for(let dr=0;dr<ROWS&&!found;dr++){ const rr=(rows[k]+dr)%ROWS; if(free(col,rr)){c=col;r=rr;found=true;} } if(found)break; }
        if(!found){ // last resort: any free deploy hex (cols 0-3)
          for(let col=0;col<=3&&!found;col++)for(let rr=0;rr<ROWS&&!found;rr++){ if(free(col,rr)){c=col;r=rr;found=true;} }
        }
        if(!found)return; // board genuinely full — skip (shouldn't happen with cap<=10)
      }
      b.placements[c+','+r]={idx:e.idx,c,r};
    });
  };
  placeLine(melee,3,2);
  placeLine(ranged,1,0);
  renderTokensPlan();drawBench();updateSyn();
  document.getElementById('pcount').textContent=Object.keys(b.placements).length;
  document.getElementById('beginBtn').disabled=false;
}
export function deployedUnits(){return Object.values(G.battle.placements).map(p=>({...G.army[p.idx]}));}
export function calcSyn(units){
  const fc={},cc={};units.filter(u=>!u.token).forEach(u=>{const w=u._synWeight||1;fc[u.faction]=(fc[u.faction]||0)+w;cc[u.cls]=(cc[u.cls]||0)+w;});
  const active=[];
  for(const f in fc){const s=FAC_SYN[f];if(!s)continue;let lvl=0;s.bp.forEach((b,k)=>{if(fc[f]>=b)lvl=k+1;});if(lvl>0)active.push({type:'faction',name:f+' — '+s.name,lvl,n:fc[f],bp:s.bp,desc:s.desc[lvl-1]});}
  for(const c in cc){const s=CLASS_SYN[c];if(!s)continue;let lvl=0;s.bp.forEach((b,k)=>{if(cc[c]>=b)lvl=k+1;});if(lvl>0)active.push({type:'class',name:c+' (class)',lvl,n:cc[c],bp:s.bp,desc:s.desc[lvl-1]});}
  return {fc,cc,active};
}
export function updateSyn(){
  const z=document.getElementById('synZone');if(!z)return;
  const units=deployedUnits();const {fc,cc,active}=calcSyn(units);
  let html='';
  const allF={};FACTIONS.forEach(f=>allF[f]=fc[f]||0);
  Object.entries(allF).filter(([f,n])=>n>0).forEach(([f,n])=>{
    const s=FAC_SYN[f];const a=active.find(x=>x.name.startsWith(f));
    html+=`<div class="syn ${a?'act':''}"><span><b style="color:${FCOL[f]}">${f}</b> ×${n}</span>
      <small>${a?a.desc:'need '+s.bp[0]}</small></div>`;
  });
  Object.entries(cc).filter(([c,n])=>n>=2).forEach(([c,n])=>{
    const s=CLASS_SYN[c];const a=active.find(x=>x.name.startsWith(c)&&x.type==='class');
    html+=`<div class="syn ${a?'act':''}"><span><span style="color:${CCOL[c]}">◆</span> ${c} ×${n}</span>
      <small>${a?a.desc:'need '+s.bp[0]}</small></div>`;
  });
  if(!html)html='<div class="tip">Place units to form synergies.</div>';
  z.innerHTML=html;
}

/* ----- COMBAT SIM ----- */
// targeting archetype per the GDD (Nearest/LowestHP/HighestHP/Backline/Densest/SupportAlly)
export function archetypeOf(u){
  if(u.cls==='Cleric') return 'support';
  if(u.ult&&u.ult.k==='execute') return 'lowhp';
  if(u.ult&&u.ult.k==='nova'&&(u.ult.r||1)>=2) return 'dense';
  if(u.cls==='Rogue') return 'backline';
  if(u.cls==='Guardian'||u.ult&&u.ult.k==='shield') return 'highhp';
  return 'nearest';
}
// build a live combat unit from a template (also used by boss phase summons)
export function mkLive(tpl,side,c,r){
  const u=clone(tpl);
  // base snapshot (from the template) for live buff/debuff coloring in tooltips
  u._base={hp:tpl.hp, dmg:tpl.dmg, as:tpl.as, mv:tpl.mv, rng:tpl.rng, dr:tpl.dr||0, crit:tpl.crit||0};
  u.maxhp=u.hp; u.side=side; u.c=c; u.r=r; u.mag=0; u.alive=true;
  u.dr=u.dr||0; u.crit=u.crit||0; u.ultMul=1; u.healMul=1; u.atkcd=0; u.stun=0; u.slowT=0; u.slowStacks=0;
  u.bleedStacks=0; u.poisonStacks=0; u.burnT=0; u.arch=archetypeOf(u); u.retgt=0; u.tgt=null;
  u.chargeMul=u.chargeMul||1; u.lifesteal=0; u.armorPierce=0; u.movecd=0; u.shield=0; u.shieldT=0;
  if(u.gear){ ['weapon','armor','trinket'].forEach(slot=>{const id=u.gear[slot];if(id){const e=EQUIP_BY_ID[id];if(e&&e.apply)e.apply(u);}}); }
  applyUnitAbility(u);
  return u;
}
// Translate a unit's passive Magic Ability (text from the design roster) into mechanical
// effects, by matching common keyword patterns to the engine's existing on-hit / stat hooks.
// Effects that the sim already supports are wired up; purely-flavor lines simply display.
