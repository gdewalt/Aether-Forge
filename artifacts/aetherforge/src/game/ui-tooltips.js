// @ts-nocheck
import { CCOL, FCOL, POOL } from "./data-units.js";
import { CLASS_SYN, FAC_SYN } from "./synergies.js";
import { EQUIP_BY_ID, RAR_COL, equipIcoHTML } from "./data-loot.js";
import { HOVU, activeDebuffs, auraAtkSpeed, living, setHOVU, slowAtkRate, slowMoveRate } from "./engine-combat.js";
import { TIER_STARS } from "./ui-shop.js";
import { spriteThumb } from "./ui-render-core.js";

export const ULT_DESC={
  nova:'AoE burst around the densest enemy cluster',
  heal:'Heals wounded nearby allies',
  shield:'Gains a barrier that absorbs incoming damage before HP',
  execute:'Instantly slays a low-HP foe (else heavy hit)',
  doubleaxe:'Barrage: fires a volley of shots that cycle through enemies in range, each for heavy bonus damage',
  burst:'Detonates a zone around the caster, striking every enemy inside multiple times for bonus damage',
  rally:'Boosts allied attack speed',
  freeze:'Freezes & damages enemies in an area',
  chain:'Lightning leaps between nearby foes, weakening each jump',
  beam:'A piercing beam strikes everything in a line',
  summon:'Raises allied tokens beside the caster',
  drain:'A vampiric strike that heals the caster',
  bulwark:'Shields and hardens nearby allies',
  curse:'Hexes a cluster: they take more damage and rot from poison',
  berserk:'The caster surges with attack speed, damage, and lifesteal',
  quake:'A board-wide cataclysm damages and may stun every foe',
  transform:'Transforms into a powerful new creature for the rest of the battle — with its own attacks and a new ultimate',
  blink:'Teleports behind an enemy and lands a devastating strike',
  banish:'Hurls an enemy to the far edge of the board, stunned',
  charm:'Temporarily turns an enemy unit to fight for you',
  zone:'Scorches an area of tiles that burns enemies standing on them'
};
export const TT=document.getElementById('tooltip');

/* ---------- unit / equipment DETAIL MODAL (mobile-friendly inspect) ---------- */
// returns {name, desc} for a unit's passive Magic Ability, or null. The flavor text now
// lives as `tip` directly on the unit's own template (see U()/EU() in data-units.js /
// data-enemies.js) rather than in a separate name-keyed dictionary.
export function abilityFor(u){
  const raw=u.tip; if(!raw) return null;
  const idx=raw.indexOf(':');
  if(idx>0) return {name:raw.slice(0,idx).trim(), desc:raw.slice(idx+1).trim()};
  return {name:'', desc:raw};
}
export function statBar(val,max,col){ const p=Math.max(4,Math.min(100,val/max*100)); return `<div class="statbar"><i style="width:${p}%;background:${col}"></i></div>`; }
export function closeModal(){ const m=document.getElementById('umodal-scrim'); if(m)m.remove(); }
export function openUnitDetail(u, action){
  closeModal();
  const isEnemy=u.faction==='__enemy';
  const fc=(isEnemy?(u.ecol||'#a5453a'):FCOL[u.faction])||'#999', cc=CCOL[u.cls]||'#999';
  const facName=isEnemy?(u.efaction||'Enemy'):u.faction;
  // base template (tier-1, no temper/gear) for buff coloring of upgraded stats
  const _tpl = u._base || (typeof POOL!=='undefined' ? POOL.find(p=>p.name===u.name) : null);
  const _dB = _tpl?{hp:_tpl.hp,dmg:_tpl.dmg,as:_tpl.as,mv:_tpl.mv}:null;
  const _GR='#5bbf6a', _RD='#e0736b';
  const _dc=(cur,base)=>{ if(!base||Math.abs(cur-base)<Math.max(0.001,base*0.02))return 'var(--parch)'; return cur>base?_GR:_RD; };
  const _da=(cur,base)=>{ if(!base||Math.abs(cur-base)<Math.max(0.001,base*0.02))return ''; return cur>base?' ▲':' ▼'; };
  // synergy text
  let synTxt='';
  if(!isEnemy && FAC_SYN[u.faction]){ const s=FAC_SYN[u.faction]; synTxt=`<div class="abil" style="margin-top:6px"><b>${facName} synergy — ${s.name}</b><br>At 2: ${s.desc[0]}<br>At 4: ${s.desc[1]}</div>`; }
  else if(!isEnemy && u.faction==='Neutral'){ synTxt=`<div class="abil" style="margin-top:6px"><b>Neutral</b><br>No faction synergy — flexible filler that never dilutes a faction count.</div>`; }
  const cs=CLASS_SYN[u.cls];
  const clsTxt=cs?`<div class="abil" style="margin-top:6px"><b>${u.cls} class (cross-faction)</b><br>At 3: ${cs.desc[0]}<br>At 6: ${cs.desc[1]}</div>`:'';
  const rngTxt = u.t==='r'?`${u.rng} (ranged)`:'1 (melee)';
  const gearTxt = (u.gear&&['weapon','armor','trinket'].some(s=>u.gear[s]))
    ? `<div class="sect"><h4>Equipment</h4>`+['weapon','armor','trinket'].filter(s=>u.gear[s]).map(s=>{const e=EQUIP_BY_ID[u.gear[s]];return `<div class="abil" style="margin-bottom:5px"><b style="color:${RAR_COL[e.rar]}">${equipIcoHTML(e,16)} ${e.name}</b><br>${e.desc}</div>`;}).join('')+`</div>` : '';
  const scrim=document.createElement('div');scrim.className='scrim';scrim.id='umodal-scrim';
  scrim.addEventListener('click',e=>{if(e.target===scrim)closeModal();});
  scrim.innerHTML=`<div class="umodal">
    <div class="uhead">
      <div class="uname">${spriteThumb(u,30)} ${u.name}${u.tier>1?` <span style="font-size:14px">${TIER_STARS[u.tier]}</span>`:''}</div>
      <div class="utags">
        <span class="chip" style="background:${fc};color:#0e0b14">${facName}</span>
        <span class="chip" style="background:${cc};color:#fff">${u.cls}</span>
        <span class="chip" style="background:#2a2138;color:#c9bbe0">${u.t==='r'?'Ranged':'Melee'}</span>
      </div>
    </div>
    <div class="ubody">
      <div class="statrow"><span class="k">Health</span><span class="v" style="color:${_dB?_dc(u.hp,_dB.hp):'var(--parch)'}">${u.hp}${_dB?_da(u.hp,_dB.hp):''}</span></div>${statBar(u.hp,1300,'#5bbf6a')}
      <div class="statrow" style="margin-top:6px"><span class="k">Damage</span><span class="v" style="color:${_dB?_dc(u.dmg,_dB.dmg):'var(--parch)'}">${u.dmg}${_dB?_da(u.dmg,_dB.dmg):''}</span></div>${statBar(u.dmg,110,'#d4534a')}
      <div class="statrow" style="margin-top:6px"><span class="k">Attack Speed</span><span class="v" style="color:${_dB?_dc(u.as,_dB.as):'var(--parch)'}">${u.as.toFixed(2)}/s${_dB?_da(u.as,_dB.as):''}</span></div>${statBar(u.as,1.5,'#e0a020')}
      <div class="statrow" style="margin-top:6px"><span class="k">Range</span><span class="v">${rngTxt}</span></div>
      <div class="statrow"><span class="k">Move Speed</span><span class="v">${u.mv.toFixed(1)}</span></div>
      <div class="statrow"><span class="k">DPS (approx)</span><span class="v">${Math.round(u.dmg*u.as)}</span></div>
      ${_dB&&(u.hp!==_dB.hp||u.dmg!==_dB.dmg||u.as!==_dB.as)?`<div class="tip" style="font-size:10px;margin-top:4px"><span style="color:#5bbf6a">▲ green</span> = buffed above base · <span style="color:#e0736b">▼ red</span> = reduced</div>`:''}
      ${(()=>{const ab=abilityFor(u);return ab?`<div class="sect"><h4>Magic Ability${ab.name?' — '+ab.name:''}</h4>
        <div class="abil">${ab.desc}<br><span style="color:#7d7191;font-size:11px">A passive that triggers automatically in battle.</span></div></div>`:'';})()}
      <div class="sect"><h4>Ultimate — ${u.ult.name}</h4>
        <div class="abil">${ULT_DESC[u.ult.k]||'A powerful special ability.'}<br><span style="color:#7d7191;font-size:11px">Charges as the unit deals &amp; takes damage; fires at full bar.</span></div>
      </div>
      <div class="sect"><h4>Synergies</h4>${synTxt}${clsTxt}</div>
      ${gearTxt}
    </div>
    <div class="ufoot">
      <button class="small" onclick="closeModal()">← Back</button>
      ${action?`<button class="primary" id="modal-take-btn" ${action.disabled?'disabled':''}>${action.label}</button>`:''}
    </div>
  </div>`;
  document.body.appendChild(scrim);
  if(action&&action.onTake&&!action.disabled){ const b=document.getElementById('modal-take-btn'); if(b)b.onclick=()=>{closeModal();action.onTake();}; }
}
export function openEquipDetail(e, action){
  closeModal();
  const SLOT={weapon:'Weapon',armor:'Armor',trinket:'Trinket'};
  const scrim=document.createElement('div');scrim.className='scrim';scrim.id='umodal-scrim';
  scrim.addEventListener('click',ev=>{if(ev.target===scrim)closeModal();});
  scrim.innerHTML=`<div class="umodal">
    <div class="uhead"><div class="uname" style="color:${RAR_COL[e.rar]}">${equipIcoHTML(e,22)} ${e.name}</div>
      <div class="utags"><span class="chip" style="background:${RAR_COL[e.rar]};color:#0e0b14">${e.rar}</span>
        <span class="chip" style="background:#2a2138;color:#c9bbe0">${SLOT[e.slot]}</span></div></div>
    <div class="ubody"><div class="abil">${e.desc}</div>
      <div class="tip" style="margin-top:10px;font-size:11px">Equip on any unit from the Equipment screen. Gear is fully movable between battles.</div></div>
    <div class="ufoot"><button class="small" onclick="closeModal()">← Back</button>
      ${action?`<button class="primary" id="modal-take-btn" ${action.disabled?'disabled':''}>${action.label}</button>`:''}</div>
  </div>`;
  document.body.appendChild(scrim);
  if(action&&action.onTake&&!action.disabled){ const b=document.getElementById('modal-take-btn'); if(b)b.onclick=()=>{closeModal();action.onTake();}; }
}

export function tipHTML(u,live){
  const isEnemy=u.side==='E'||u.faction==='__enemy';
  const facName=isEnemy?(u.efaction||'Enemy'):u.faction;
  const fc=(isEnemy?(u.ecol||'#a5453a'):FCOL[u.faction])||'#999', cc=CCOL[u.cls]||'#999';
  const hp = live?`${Math.max(0,Math.round(u.hp))} / ${Math.round(u.maxhp||u.hp)}`:`${u.hp}`;
  const rng = u.t==='r'?`${u.rng} (ranged)`:'1 (melee)';
  // buff/debuff coloring: compare live/effective value to the unit's template base
  const B=u._base||{hp:u.maxhp,dmg:u.dmg,as:u.as,mv:u.mv,rng:u.rng,dr:u.dr||0,crit:u.crit||0};
  const GREEN='#5bbf6a', RED='#e0736b', NEU='var(--parch)';
  function col(cur,base,higherIsBetter=true){
    if(base==null||Math.abs(cur-base)<Math.max(0.001,base*0.02)) return NEU;
    const up=cur>base; return (up===higherIsBetter)?GREEN:RED;
  }
  function arrow(cur,base){ if(base==null||Math.abs(cur-base)<Math.max(0.001,base*0.02))return ''; return cur>base?' ▲':' ▼'; }
  // effective combat values: AS and movement are modified live by slow / auras
  let asEff=u.as, mvEff=u.mv, drEff=u.dr||0;
  if(live){
    if(typeof slowAtkRate==='function') asEff=u.as*(u.slowT>0?slowAtkRate(u):1)*(typeof auraAtkSpeed==='function'?auraAtkSpeed(u):1);
    if(typeof slowMoveRate==='function') mvEff=u.mv*(u.slowT>0?slowMoveRate(u):1);
  }
  const sv=(label,curStr,c)=>`<span>${label}</span><span style="color:${c}">${curStr}</span>`;
  let statuses='';
  if(live){
    const d=activeDebuffs(u);
    let pills = d.map(x=>`<span class="db-pill" style="background:${x.color}22;color:${x.color};border-color:${x.color}66">${x.icon} ${x.label} ${x.detail}</span>`).join('');
    if(u.shield>0) pills += `<span class="db-pill" style="background:#7cdcff22;color:#7cdcff;border-color:#7cdcff66">🛡 Shield ${Math.round(u.shield)}</span>`;
    if(pills){
      statuses=`<div class="tt-ult" style="border-top-color:#5a2a2a"><b style="color:#e8a59f">Status</b><br>` + pills + `</div>`;
    }
  }
  return `<div class="tt-n">${spriteThumb(u,22)} ${u.name}${u.tier>1?` ${TIER_STARS[u.tier]}`:''}</div>
    <div class="tt-tag"><span class="chip" style="background:${fc};color:#0e0b14">${facName}</span>
      <span class="chip" style="background:${cc};color:#fff">${u.cls}</span></div>
    <div class="tt-grid">
      <span>Health</span><span>${hp}${u.shield>0?` <span style="color:#7cdcff">+${Math.round(u.shield)}🛡</span>`:''}</span>
      ${sv('Damage', Math.round(u.dmg)+arrow(u.dmg,B.dmg), col(u.dmg,B.dmg))}
      ${sv('Atk Speed', asEff.toFixed(2)+'/s'+arrow(asEff,B.as), col(asEff,B.as))}
      ${sv('Range', rng, col(u.rng,B.rng))}
      ${sv('Move', mvEff.toFixed(1)+arrow(mvEff,B.mv), col(mvEff,B.mv))}
      ${(u.dr||B.dr)?sv('Dmg Reduce', Math.round((u.dr||0)*100)+'%'+arrow(u.dr||0,B.dr), col(u.dr||0,B.dr)):''}
      ${(u.crit||B.crit)?sv('Crit', Math.round((u.crit||0)*100)+'%'+arrow(u.crit||0,B.crit), col(u.crit||0,B.crit)):''}
      ${live?`<span>Magic</span><span>${Math.round(u.mag)}%</span>`:''}
    </div>
    ${(()=>{const ab=abilityFor(u);return ab?`<div class="tt-ult"><b style="color:#8fd0ff">✦ ${ab.name||'Magic Ability'}</b><br>${ab.desc}</div>`:'';})()}
    <div class="tt-ult"><b>★ ${u.ult.name}</b><br>${ULT_DESC[u.ult.k]||''}</div>
    ${gearLine(u)}
    ${statuses}`;
}
export function gearLine(u){
  if(!u.gear)return '';
  const g=['weapon','armor','trinket'].map(s=>u.gear[s]).filter(Boolean).map(id=>EQUIP_BY_ID[id]);
  if(!g.length)return '';
  return `<div class="tt-ult" style="border-top-color:#3a3050"><b style="color:#9fd0a0">Equipment</b><br>`+
    g.map(e=>`<span style="font-size:11px;color:${RAR_COL[e.rar]}">${equipIcoHTML(e,14)} ${e.name}</span>`).join('<br>')+`</div>`;
}
export let _tipTimer=null;
export function armTipAutoHide(ms){ clearTimeout(_tipTimer); _tipTimer=setTimeout(hideTip, ms||2600); }
export function showTip(u,live,x,y){
  TT.innerHTML=tipHTML(u,live);TT.classList.add('show');
  positionTip(x,y);
  armTipAutoHide();
}
export function positionTip(x,y){
  const pad=14, w=TT.offsetWidth, h=TT.offsetHeight;
  let px=x+pad, py=y+pad;
  if(px+w>window.innerWidth-8)px=x-w-pad;
  if(py+h>window.innerHeight-8)py=y-h-pad;
  if(py<8)py=8;
  if(px<8)px=8;
  TT.style.left=px+'px';TT.style.top=py+'px';
}
export function hideTip(){ clearTimeout(_tipTimer); TT.classList.remove('show'); setHOVU(null); }
// Touch / pointer devices have no mouseleave, so dismiss tooltips on any new tap
// and after the auto-hide timer. Capture phase so it runs before other handlers.
document.addEventListener('touchstart',()=>{ if(TT.classList.contains('show'))hideTip(); },{passive:true,capture:true});
document.addEventListener('pointerdown',(e)=>{ if(e.pointerType&&e.pointerType!=='mouse'){ if(TT.classList.contains('show'))hideTip(); } },{capture:true});
window.addEventListener('scroll',()=>{ if(TT.classList.contains('show'))hideTip(); },{passive:true});

/* ---------- toast ---------- */
export let toastT;
export function toast(msg,html=false){let t=document.querySelector('.toast');if(t)t.remove();
  t=document.createElement('div');t.className='toast';if(html)t.innerHTML=msg;else t.textContent=msg;document.body.appendChild(t);
  clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),1800);}

