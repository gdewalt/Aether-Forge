// @ts-nocheck
/* ============================================================
   COMBAT PRESENTATION LAYER
   Everything here is pure presentation: it reads battle state and paints the
   DOM (unit tokens, HP/mag bars, floating text, projectiles, blasts, beams,
   rings, screen shake) plus the shared debuff view-model. It holds no game
   logic — the deterministic simulation lives in engine-combat.js, which calls
   these to visualize what the sim decided. (engine-combat re-exports these so
   existing importers keep resolving them from there.)
   ============================================================ */
import { COLS, G, GRIDH, GRIDW, HR, hexCenter } from "./engine-hex.js";
import { FCOL } from "./data-units.js";
import { RNG } from "./rng.js";
import { SC, artOf, hasSprite, unitBodyHTML } from "./ui-render-core.js";
import { TT, hideTip, positionTip, showTip, tipHTML, toast } from "./ui-tooltips.js";
import { drawGrid, fitGrid } from "./ui-planning.js";
import { slowAtkRate, slowMoveRate } from "./engine-combat.js";

/* ---------- playback speed ---------- */
export let SPEED=1;
export function setSpeed(s){SPEED=s;toast(s+'× speed');}

/* ---------- hovered unit (drives the live tooltip refresh) ---------- */
export let HOVU=null;
export function setHOVU(v){ HOVU = v; }

/* ---------- phase label ---------- */
export const PHASE_NAMES={countdown:'Countdown',advance:'Advance',clash:'Clash',escalation:'Escalation ⚡'};
export function renderPhase(){
  const b=G.battle; const el=document.getElementById('btime'); if(!el)return;
  if(b.phase==='countdown'){ el.textContent='Battle begins in '+Math.ceil(b.cd)+'…'; return; }
  el.textContent=b.t.toFixed(1)+'s · '+(PHASE_NAMES[b.phase]||'');
}

/* ---------- the combat screen shell ---------- */
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

/* ---------- per-frame paint of every live unit + damaging zones ---------- */
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

/* ---------- floating combat text & particle bursts ---------- */
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
// ---- boss phase-transition banner ----
export function bossPhaseFx(bu,phase){
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(bu.c,bu.r);
  const d=document.createElement('div');d.className='ultflash';
  d.style.cssText=`left:${Math.max(10,ce.x-90)}px;top:${ce.y-44}px;font-size:22px;color:#ff8a7a;text-shadow:0 0 14px #9e2b25`;
  d.textContent='⚠ '+bu.name.split(',')[0]+' — PHASE '+phase+'!';
  g.appendChild(d);setTimeout(()=>d.remove(),1400);
  toast('⚠ Boss enters Phase '+phase+' — reinforcements!');
}
