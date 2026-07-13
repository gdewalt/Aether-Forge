// @ts-nocheck
import { CCOL, FCOL } from "./data-units.js";
import { EQUIP_BY_ID, RAR_COL, equipIcoHTML, newEquip, unitRarity } from "./data-loot.js";
import { G } from "./engine-hex.js";
import { SC, showArmy, showMap, spriteThumb } from "./ui-render-core.js";
import { TIER_STARS, renderRecruit } from "./ui-shop.js";
import { ensureGear } from "./flow-commanders.js";
import { equipCardInner } from "./flow-battle-end.js";
import { showPlan } from "./ui-planning.js";
import { toast } from "./ui-tooltips.js";

export let EQ_SEL=null; // {from:'stash',idx} or {from:'unit',ui,slot}
export let EQ_BACK='map'; // which screen opened the equip manager: 'map' | 'army' | 'recruit'
export function showEquip(back){
  EQ_BACK=back||'map'; EQ_SEL=null; renderEquip();
}
// Back returns to the screen the player came from. The recruit screen re-renders from
// run state (G._offers / G._eqOffers / G._rerolls), so its exact contents are preserved.
export function equipBack(){
  if(EQ_BACK==='recruit') renderRecruit();
  else if(EQ_BACK==='army') showArmy();
  else showMap();
}
export function renderEquip(){
  const SLOTS=['weapon','armor','trinket'];const SLOT_ICO={weapon:'⚔',armor:'🛡',trinket:'💍'};
  let html=`<div class="panel"><div class="lbl">Equipment — drag-free: click an item, then click a slot</div>
    <p class="tip" style="margin-bottom:10px">Each unit has 3 slots (Weapon · Armor · Trinket). Gear is movable at any safe moment. ${EQ_SEL?'<b style="color:var(--gold-bright)">Selecting… click a destination, or click again to cancel.</b>':'Click an equipped item to unequip, or a stash item to place it.'}</p>`;
  // units with their slots
  html+=`<div style="display:flex;flex-direction:column;gap:8px">`;
  G.army.forEach((u,ui)=>{
    ensureGear(u);
    html+=`<div class="row" style="gap:10px;border:1px solid var(--line);border-radius:6px;padding:8px;background:#0006">
      <div style="min-width:150px"><b style="color:var(--gold-bright);font-family:Cinzel">${spriteThumb(u,28)} ${u.name}</b>
        <div class="tip" style="font-size:10px">${u.faction} · ${u.cls}</div></div>`;
    SLOTS.forEach(slot=>{
      const id=u.gear[slot]; const e=id?EQUIP_BY_ID[id]:null;
      const sel = EQ_SEL&&EQ_SEL.from==='unit'&&EQ_SEL.ui===ui&&EQ_SEL.slot===slot;
      const canDrop = EQ_SEL && pendingSlot()===slot;
      html+=`<div onclick="equipSlotClick(${ui},'${slot}')"
        style="flex:1;min-width:120px;border:1px dashed ${sel?'var(--gold-bright)':canDrop?'var(--good)':'var(--line)'};border-radius:5px;padding:6px;cursor:pointer;background:${canDrop?'#1c3a1c':'#0004'}">
        <div class="tip" style="font-size:9px;text-transform:uppercase">${SLOT_ICO[slot]} ${slot}</div>
        ${e?`<div style="color:${RAR_COL[e.rar]};font-size:11px;font-family:Cinzel">${equipIcoHTML(e,16)} ${e.name}</div>`:`<div class="dim" style="font-size:11px">— empty —</div>`}</div>`;
    });
    html+=`</div>`;
  });
  html+=`</div>`;
  // stash
  html+=`<div class="lbl" style="margin-top:16px">Stash (${G.stash.length})</div><div class="bench">`;
  if(!G.stash.length)html+=`<div class="tip">No spare equipment. Win Elites and the Boss to find gear.</div>`;
  G.stash.forEach((it,si)=>{
    const e=EQUIP_BY_ID[it.id]; const sel=EQ_SEL&&EQ_SEL.from==='stash'&&EQ_SEL.idx===si;
    html+=`<div class="card" style="cursor:pointer;border-color:${sel?'var(--gold-bright)':RAR_COL[e.rar]}" onclick="stashClick(${si})">${equipCardInner(e)}</div>`;
  });
  const backLbl = EQ_BACK==='recruit' ? (G._recruitMode==='shop'?'← Back to Camp':'← Back to Rewards') : EQ_BACK==='army' ? '← Back to Army' : '← Back to Map';
  html+=`</div><div class="row" style="margin-top:14px"><button class="small" onclick="equipBack()">${backLbl}</button>
    <span class="tip">Tip: re-tool against the next foe — gear is fully movable between battles.</span></div></div>`;
  SC.innerHTML=html;
}
export function pendingSlot(){ if(!EQ_SEL)return null; if(EQ_SEL.from==='stash')return EQUIP_BY_ID[G.stash[EQ_SEL.idx].id].slot; return EQ_SEL.slot; }
export function stashClick(si){
  if(EQ_SEL&&EQ_SEL.from==='stash'&&EQ_SEL.idx===si){EQ_SEL=null;renderEquip();return;}
  EQ_SEL={from:'stash',idx:si}; renderEquip();
}
export function equipSlotClick(ui,slot){
  const u=G.army[ui]; ensureGear(u);
  if(!EQ_SEL){
    if(u.gear[slot]){ EQ_SEL={from:'unit',ui,slot}; renderEquip(); }
    return;
  }
  // clicking the same selected slot again → unequip to stash
  if(EQ_SEL.from==='unit'&&EQ_SEL.ui===ui&&EQ_SEL.slot===slot){
    G.stash.push(newEquip(u.gear[slot])); u.gear[slot]=null; EQ_SEL=null; renderEquip(); toast('Unequipped to stash'); return;
  }
  const wantSlot=pendingSlot();
  if(wantSlot!==slot){ toast('That item goes in the '+wantSlot+' slot'); return; }
  if(EQ_SEL.from==='stash'){
    const it=G.stash[EQ_SEL.idx];
    if(u.gear[slot])G.stash.push(newEquip(u.gear[slot]));
    u.gear[slot]=it.id; G.stash.splice(EQ_SEL.idx,1);
  } else {
    const from=G.army[EQ_SEL.ui]; const movingId=from.gear[EQ_SEL.slot];
    const displaced=u.gear[slot];
    u.gear[slot]=movingId; from.gear[EQ_SEL.slot]=displaced||null;
  }
  EQ_SEL=null; renderEquip();
}
// unequip-to-stash when selecting a unit slot then clicking stash area handled via a dedicated button:
export function showPlan2(){ /* return to planning from equip screen */ showPlan(); }
export function cardHTML(u,i,placed,opts){
  opts=opts||{};
  const fc=FCOL[u.faction]||'#999', cc=CCOL[u.cls]||'#999';
  const rar=unitRarity(u);
  let gearStr='';
  if(u.gear){const g=['weapon','armor','trinket'].map(s=>u.gear[s]?EQUIP_BY_ID[u.gear[s]].ico:'').filter(Boolean);
    if(g.length)gearStr=`<div class="cs" style="margin-top:2px">${g.map(x=>`<span title="equipped">${x}</span>`).join(' ')}</div>`;}
  let tagStr='';
  if(opts.cost!=null) tagStr=`<div class="cs" style="margin-top:3px;justify-content:space-between"><span class="chip" style="background:${RAR_COL[rar]};color:#0e0b14;font-size:8px">${rar}</span><span style="color:var(--gold-bright);font-weight:700">🪙${opts.cost}</span></div>`;
  else if(opts.sell!=null) tagStr=`<div class="cs" style="margin-top:3px;justify-content:space-between"><span class="chip" style="background:${RAR_COL[rar]};color:#0e0b14;font-size:8px">${rar}</span><span style="color:#d6b86a">sell 🪙${opts.sell}</span></div>`;
  return `<div class="card${placed?' placed':''}" data-i="${i}" style="${opts.border?`border-color:${RAR_COL[rar]}`:''}">
    <div class="cn">${spriteThumb(u,24)} ${u.name}${u.tier>1?` <span style="color:var(--gold-bright)">${TIER_STARS[u.tier]}</span>`:''}</div>
    <div class="cf"><span class="chip" style="background:${fc};color:#0e0b14">${u.faction}</span>
      <span class="chip" style="background:${cc};color:#fff">${u.cls}</span></div>
    <div class="cs"><span>❤${u.hp}</span><span>⚔${u.dmg}</span><span>${u.t==='r'?'🏹'+u.rng:'⚔1'}</span></div>
    <div class="cs"><span class="dim" style="font-size:9px">★ ${u.ult.name}</span></div>
    ${gearStr}${tagStr}
  </div>`;
}

