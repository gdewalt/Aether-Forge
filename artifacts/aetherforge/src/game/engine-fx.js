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
import { SC, artOf, hasSprite, unitBodyHTML } from "./ui-render-core.js";
import { TT, hideTip, positionTip, showTip, tipHTML, toast } from "./ui-tooltips.js";
import { drawGrid, fitGrid } from "./ui-planning.js";
import { slowAtkRate, slowMoveRate } from "./engine-combat.js";
import { beam, blast, bossIntroduction, deathParticles, floatingText, majorImpactShake, mountBattleRenderer, projectile, setBattleHoveredUnit, syncBattleRenderer, ultimateSequence } from "./battle-renderer.js";

/* ---------- playback speed ---------- */
export let SPEED=1;
export let PAUSED=false;
export function setSpeed(s){SPEED=s;document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===s));toast(s+'× speed');}
const COMBAT_FEED=[];
export function pushCombatEvent(text,tone=''){if(!text)return;COMBAT_FEED.unshift({text,tone});COMBAT_FEED.length=Math.min(COMBAT_FEED.length,6);const el=document.getElementById('combatFeed');if(el)el.innerHTML=COMBAT_FEED.map(x=>`<li class="${x.tone}">${x.text}</li>`).join('');}
export function togglePause(){PAUSED=!PAUSED;const b=document.getElementById('pauseBtn');if(b){b.textContent=PAUSED?'▶ Resume':'Ⅱ Pause';b.setAttribute('aria-pressed',String(PAUSED));}document.getElementById('combatShell')?.classList.toggle('is-paused',PAUSED);pushCombatEvent(PAUSED?'Battle paused':'Battle resumed','system');}
export function toggleCombatOptions(){const p=document.getElementById('combatOptions');if(!p)return;const open=p.hidden;p.hidden=!open;document.getElementById('optionsBtn')?.setAttribute('aria-expanded',String(open));}
export function toggleReducedMotion(on){document.documentElement.classList.toggle('reduce-motion',!!on);}
document.addEventListener('keydown',e=>{if(!document.getElementById('combatShell')||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;if(e.code==='Space'){e.preventDefault();togglePause();}else if(['1','2','4'].includes(e.key))setSpeed(Number(e.key));else if(e.key==='Escape'&&!document.getElementById('combatOptions')?.hidden)toggleCombatOptions();});

/* ---------- hovered unit (drives the live tooltip refresh) ---------- */
export let HOVU=null;
let FOCUSED_UNIT=null;
export function setHOVU(v){ HOVU = v; }
function focusUnit(u){FOCUSED_UNIT=u;renderFocusedUnit();}
function renderFocusedUnit(){const el=document.getElementById('focusedUnit');if(!el)return;const u=HOVU||(FOCUSED_UNIT?.alive&&FOCUSED_UNIT)||(G.battle?.P||[]).find(x=>x.alive)||(G.battle?.E||[]).find(x=>x.alive);if(!u){el.innerHTML='<div class="hud-empty">No unit selected</div>';return;}const fc=u.side==='E'?(u.ecol||'#d65752'):(FCOL[u.faction]||'#aaa');el.innerHTML=`<div class="focus-head"><span class="focus-crest" style="--crest:${fc}">${u.ico||'◆'}</span><div><b>${u.name}</b><small>${u.faction||'Enemy'} · ${u.cls||'Unit'}</small></div></div><div class="stat-chips"><span>❤ ${Math.max(0,Math.round(u.hp))}/${Math.round(u.maxhp)}</span><span>⚔ ${Math.round(u.dmg)}</span><span>✦ ${Math.round(u.mag||0)}%</span></div><div class="focus-ult"><span>${u.ult?.name||'No ultimate'}</span><i style="width:${Math.min(100,u.mag||0)}%"></i></div>`;}

/* ---------- phase label ---------- */
export const PHASE_NAMES={countdown:'Countdown',advance:'Advance',clash:'Clash',escalation:'Escalation ⚡'};
export function renderPhase(){
  const b=G.battle; const el=document.getElementById('btime'); if(!el)return;
  if(b.phase==='countdown'){ el.textContent='Battle begins in '+Math.ceil(b.cd)+'…'; return; }
  el.textContent=b.t.toFixed(1)+'s · '+(PHASE_NAMES[b.phase]||'');
}

/* ---------- the combat screen shell ---------- */
export function showCombat(){
  PAUSED=false;FOCUSED_UNIT=null;COMBAT_FEED.length=0;
  let html=`<div class="panel battle-shell" id="combatShell"><header class="combat-topbar"><div><small>ENGAGEMENT</small><h2>${G.battle.node.nm}</h2></div><div class="phase-medallion"><span id="btime">0.0s</span></div><div class="combat-controls" aria-label="Battle controls"><div class="speed-group" role="group" aria-label="Playback speed"><button data-speed="1" class="active" onclick="setSpeed(1)">1×</button><button data-speed="2" onclick="setSpeed(2)">2×</button><button data-speed="4" onclick="setSpeed(4)">4×</button></div><button id="pauseBtn" aria-pressed="false" onclick="togglePause()">Ⅱ Pause</button><button id="optionsBtn" aria-expanded="false" onclick="toggleCombatOptions()">⚙ Options</button></div></header>${G.battle.mod?`<div class="battle-modifier"><span>${G.battle.mod.ico}</span><b>${G.battle.mod.name}</b><small>${G.battle.mod.desc||''}</small></div>`:''}<div class="combat-layout"><main class="battle-stage"><div class="gridwrap" id="gridwrap"><div id="grid" style="width:${GRIDW}px;height:${GRIDH}px"></div></div><div class="row" id="combatStatus"></div></main><aside class="combat-rail"><section><div class="rail-title">Focused unit</div><div id="focusedUnit" class="focused-unit"></div></section><section><div class="rail-title">Battle chronicle</div><ol id="combatFeed" class="combat-feed" aria-live="polite"></ol></section></aside></div><div id="combatOptions" class="combat-options" role="dialog" aria-label="Combat options" hidden><div><b>Battle Options</b><button aria-label="Close options" onclick="toggleCombatOptions()">×</button></div><label><input type="checkbox" onchange="toggleReducedMotion(this.checked)"> Reduce motion</label><p>Pause: <kbd>Space</kbd> · Speeds: <kbd>1</kbd> <kbd>2</kbd> <kbd>4</kbd> · Options: <kbd>Esc</kbd></p></div></div>`;
  SC.innerHTML=html;
  // Combat has no legacy SVG board. Pixi owns every visible battlefield layer;
  // the grid element only hosts the canvas and accessible tooltip hit areas.
  const canvasHost=document.createElement('div');
  canvasHost.className='battle-canvas-host'; canvasHost.id='battle-canvas-host';
  document.getElementById('grid').appendChild(canvasHost);
  void mountBattleRenderer(canvasHost).then(()=>{syncBattleRenderer(G.battle);const boss=[...(G.battle.P||[]),...(G.battle.E||[])].find(u=>u.boss);if(boss)bossIntroduction(boss);});
  resetCombatTokens();   // fresh grid → drop any tokens tracked from a prior battle
  renderCombat();
  renderFocusedUnit();pushCombatEvent('Forces enter the field','system');
  fitGrid();
}

/* ---------- DOM accessibility/tooltip hit areas ----------
   The sim runs ~30×/sec. Tearing down and rebuilding every token each frame (createElement +
   innerHTML + sprite lookup + 3 addEventListener per unit per frame) was the biggest source of
   GC churn and mobile jank. Instead we keep one node per unit (TOK maps unit→node), created
   once with its listeners, and each frame only mutate what changes: position, HP/shield/mag bar
   widths, shield glow, cloak, debuff badges, and the transient juice-animation classes. The
   token's inner structure is rebuilt only when its build signature changes (sprite finished
   loading, a transform swapped the creature, or a side flip from charm). */
let TOK=new Map();   // Map<unitObject, tokenNode>, keyed by live-unit identity within one battle
export function resetCombatTokens(){ for(const [,d] of TOK) d.remove(); TOK.clear(); }

function tokGeom(u){
  const useSpr=hasSprite(artOf(u));
  // Summoned tokens render at the same size as regular units — only bosses and sub-bosses
  // (elites, Drake Lieutenants) get a larger standee.
  const sz=u.boss?(u.foot>=3?122:100):u.subboss?80:70;
  const fs=u.boss?(u.foot>=3?50:40):u.subboss?38:34;
  const sprH=u.boss?(u.foot>=3?158:130):u.subboss?112:98;   // standee heights
  const ring=u.side==='P'?'tok-p':'tok-e';
  return {useSpr,sz,fs,sprH,ring};
}
// signature capturing everything that changes the token's STRUCTURE (vs. per-frame mutations)
function tokSig(u,g){ return artOf(u)+'|'+(g.useSpr?'s':'e')+'|'+g.sz+'|'+u.side; }
function tokInnerHTML(u,g){
  const fc=(u.side==='E'?(u.ecol||'#a5453a'):FCOL[u.faction])||'#888';
  const body=unitBodyHTML(u,{ring:g.ring,flip:(u.side==='E'),fc,size:g.useSpr?g.sprH:g.sz,discSize:g.sz,fs:g.fs,extra:''});
  // shield elements are always present but zeroed; per-frame updates size/fade them (no rebuild on shield change)
  const shieldRing=g.useSpr?`<div class="spr-shield" style="opacity:0"></div>`:'';
  const bars=`<div class="bar"><i class="hpf" style="width:100%"></i><i class="shf" style="width:0%"></i></div>`+
    `<div class="bar"><i class="mgf" style="width:0%"></i></div>`;
  // db-slot is display:contents so the absolutely-positioned .debuffs inside still anchors to .unit-tok
  return `<div class="tok-stack${g.useSpr?' has-spr':''}">${body}${shieldRing}</div>`+
    `<span class="db-slot" style="display:contents"></span>`+
    (g.useSpr?`<div class="spr-bars">${bars}</div>`:bars);
}
function cacheTokRefs(d){
  d._body=d.querySelector('.spr-body')||d.querySelector('.tok-body');
  d._sprShield=d.querySelector('.spr-shield');
  d._hpf=d.querySelector('.hpf'); d._shf=d.querySelector('.shf'); d._mgf=d.querySelector('.mgf');
  d._dbSlot=d.querySelector('.db-slot');
  d._dbStr='';   // force debuff badges to render on the next update
}
function buildToken(u,g){
  const d=document.createElement('div');
  d.className='battle-hitbox';
  d.style.cssText=`left:-999px;top:-999px`;
  d.setAttribute('tabindex','0'); d.setAttribute('role','button'); d.setAttribute('aria-label',u.name);
  d._sig=tokSig(u,g); d._lastAtk=null; d._lastHit=null; d._lastBig=null;
  // listeners attached ONCE (u is a stable object for this battle)
  d.addEventListener('mouseenter',e=>{HOVU=u;setBattleHoveredUnit(u);showTip(u,true,e.clientX,e.clientY);});
  d.addEventListener('mousemove',e=>positionTip(e.clientX,e.clientY));
  d.addEventListener('mouseleave',()=>{HOVU=null;setBattleHoveredUnit(null);hideTip();});
  d.addEventListener('click',()=>focusUnit(u));
  d.addEventListener('focus',()=>{HOVU=u;setBattleHoveredUnit(u);const r=d.getBoundingClientRect();showTip(u,true,r.left+r.width/2,r.top);});
  d.addEventListener('blur',()=>{HOVU=null;setBattleHoveredUnit(null);hideTip();});
  return d;
}
// retrigger a one-shot juice animation only on a NEW event (remove→reflow→re-add restarts it)
function juice(d,u,bt,useSpr){
  if(u._atkFx!=null && bt-u._atkFx<0.28){
    if(u._atkFx!==d._lastAtk){ d.classList.remove('jx-atk'); void d.offsetWidth; d.classList.add('jx-atk');
      const L=8; d.style.setProperty('--lx',(u._atkVX*L).toFixed(1)+'px'); d.style.setProperty('--ly',(u._atkVY*L).toFixed(1)+'px'); d._lastAtk=u._atkFx; }
  } else if(d._lastAtk!=null){ d.classList.remove('jx-atk'); d._lastAtk=null; }
  const big=u._bigHit!=null && bt-u._bigHit<0.3;
  const hit=u._hitFx!=null && bt-u._hitFx<0.22;
  if(big){
    if(u._bigHit!==d._lastBig){ d.classList.remove('jx-bighit'); void d.offsetWidth; d.classList.add('jx-bighit'); d._lastBig=u._bigHit; }
    if(d._lastHit!=null){ d.classList.remove('jx-hit'); d._lastHit=null; }
  } else {
    if(d._lastBig!=null){ d.classList.remove('jx-bighit'); d._lastBig=null; }
    if(hit){ if(u._hitFx!==d._lastHit){ d.classList.remove('jx-hit'); void d.offsetWidth; d.classList.add('jx-hit'); d._lastHit=u._hitFx; } }
    else if(d._lastHit!=null){ d.classList.remove('jx-hit'); d._lastHit=null; }
  }
}
function updateToken(d,u){
  const ce=hexCenter(u.c,u.r);
  d.style.left=(ce.x-29)+'px';d.style.top=(ce.y-38)+'px';d.setAttribute('aria-label',`${u.name}, ${Math.ceil(u.hp)} health`);
}
export function renderCombat(){
  const g=document.getElementById('grid'); if(!g)return;
  syncBattleRenderer(G.battle);
  // reconcile one persistent node per live unit
  const seen=new Set();
  [...G.battle.P,...G.battle.E].forEach(u=>{
    if(!u.alive)return;
    let d=TOK.get(u);
    if(!d){ d=buildToken(u,tokGeom(u)); TOK.set(u,d); g.appendChild(d); }
    updateToken(d,u);
    seen.add(u);
  });
  for(const [u,d] of TOK){ if(!seen.has(u)){ d.remove(); TOK.delete(u); } }
  // if hovering a unit that's still alive, refresh its tooltip content live
  if(HOVU && HOVU.alive){TT.innerHTML=tipHTML(HOVU,true);}
  else if(HOVU && !HOVU.alive){HOVU=null;hideTip();}
  renderFocusedUnit();
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
  pushCombatEvent(`${u.name} falls`,u.side==='E'?'good':'danger');
  deathParticles(u);
}
// Floating combat text (damage numbers, status glyphs, crit banners) is the most frequent FX —
// a hit spawns one every attack. Pool the DOM nodes instead of createElement/remove per hit to
// cut GC churn in busy fights (esp. at 4×). A node is detached back into the pool 1s after it
// fires; re-appending a pooled node restarts the `floatup` CSS animation (removal→reinsertion
// resets it), so no forced reflow is needed. The RNG jitter draw is kept exactly where it was
// so the sim's seeded RNG stream — and thus deterministic outcomes — is unchanged.
const _fxPool=[]; const _FX_MAX=80;
export function fx(u,txt,color,cls){
  // Most ultimate branches historically emitted a second large name banner
  // immediately after ultFx(). The compact Pixi cast label already carries
  // that information, so suppress only that same-tick duplicate.
  if(cls&&u?._ultCueAt!=null&&G.battle&&Math.abs(G.battle.t-u._ultCueAt)<.06)return;
  floatingText(u,txt,color||'#fff',!!cls);
}
export function ultFx(u){
  pushCombatEvent(`${u.name} casts ${u.ult?.name||'an ultimate'}`,'ultimate');
  u._ultCueAt=G.battle?.t??0;
  ultimateSequence(u);
}
// ---- projectiles: animate a glyph from source hex to target hex ----
export const PROJ_GLYPH={Sylvan:'➳',Ironhold:'●',Emberkin:'🔥',Tidecallers:'❄',Leonin:'🌾',Gilded:'✦'};
export function spawnProjectile(src,tgt,opts){
  projectile(src,tgt,{...(opts||{}),dur:(opts&&opts.dur||260)/(SPEED||1)});return;
  const g=document.getElementById('grid');if(!g)return;
  const a=hexCenter(src.c,src.r), bcen=hexCenter(tgt.c,tgt.r);
  const glyph=opts&&opts.glyph || PROJ_GLYPH[src.faction] || '•';
  const color=opts&&opts.color || '#ffe9a8';
  const p=document.createElement('div');p.className='proj'+(opts&&opts.spin?' spin':'');
  p.style.left=a.x+'px';p.style.top=a.y+'px';p.textContent=glyph;p.style.color=color;
  g.appendChild(p);
  // flight time scales with playback speed so the projectile lands in step with its
  // sim-clock impact (which now fires SPEED× sooner in wall-clock at 2×/4×).
  const dur=(opts&&opts.dur || 260)/(SPEED||1); const t0=performance.now();
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
  blast(c,r,radiusHexes,color);return;
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(c,r);
  const px=(radiusHexes+0.6)*HR*2;
  const d=document.createElement('div');d.className='blast';
  d.style.cssText=`left:${ce.x-px/2}px;top:${ce.y-px/2}px;width:${px}px;height:${px}px;border-color:${color||'#f0d375'}`;
  g.appendChild(d);setTimeout(()=>d.remove(),520);
}
// ---- screen shake (grid trembles) ----
export function screenShake(){majorImpactShake(3.5,220);}
// ---- expanding shockwave ring (bigger, louder than a blast) ----
export function shockwaveAt(c,r,radiusHexes,color,delay){
  setTimeout(()=>blast(c,r,radiusHexes,color||'#d89544',false),delay||0);return;
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
  blast(c,r,.45,'#b98b52');return;
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
  beam(src,tgt,color);return;
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
  blast(u.c,u.r,.65,'#5bbf6a');return;
  const g=document.getElementById('grid');if(!g)return;const ce=hexCenter(u.c,u.r);
  const px=HR*2.4;const d=document.createElement('div');d.className='heal-ring';
  d.style.cssText=`left:${ce.x-px/2}px;top:${ce.y-px/2}px;width:${px}px;height:${px}px`;
  g.appendChild(d);setTimeout(()=>d.remove(),600);
}
// ---- boss phase-transition banner ----
export function bossPhaseFx(bu,phase){
  pushCombatEvent(`${bu.name} enters phase ${phase}`,'danger');
  ultimateCamera(bu);
  floatingText(bu,'⚠ '+bu.name.split(',')[0]+' — PHASE '+phase,'#ff8a7a',true);
  toast('⚠ Boss enters Phase '+phase+' — reinforcements!');
}
