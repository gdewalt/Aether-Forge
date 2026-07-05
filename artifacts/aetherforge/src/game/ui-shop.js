// @ts-nocheck
import { G } from "./engine-hex.js";
import { RAR_COL, activePool, equipCost, equipReward, newEquip, offerCost, pickUnitByRarity, qmDiscount, sellValue, unitRarity } from "./data-loot.js";
import { SC, advanceRow, renderHUD } from "./ui-render-core.js";
import { afterUnitReward, equipCardInner } from "./flow-battle-end.js";
import { cardHTML, showEquip } from "./ui-army-equip.js";
import { clone } from "./flow-forge.js";
import { gainXp } from "./flow-commanders.js";
import { openEquipDetail, openUnitDetail, toast } from "./ui-tooltips.js";
import { pick } from "./rng.js";
import { upgTier } from "./data-units.js";

/* ---------- SHOP ---------- */
/* ---------- SHOP / RECRUIT (gold-based, reroll, bench-selling) ---------- */
export const BENCH_MAX_OVER=3;                 // bench can hold cap + this many
export function benchMax(){ return G.cap + BENCH_MAX_OVER + (G.benchBonus||0); }
export function rollUnitOffers(n,guaranteeCheap,levelBonus){
  const a=[];
  for(let i=0;i<n;i++){ const u=pickUnitByRarity(levelBonus); u.gear={weapon:null,armor:null,trinket:null}; a.push(u); }
  if(guaranteeCheap && !a.some(u=>['Common','Uncommon'].includes(unitRarity(u)))){
    const cheapPool=activePool().filter(p=>['Common','Uncommon'].includes(unitRarity(p)));
    if(cheapPool.length){ const u=clone(pick(cheapPool)); u.gear={weapon:null,armor:null,trinket:null}; a[0]=u; }
  }
  return a;
}
export function rerollCost(){ return Math.max(1,Math.round((15 + 10*(G._rerolls||0))*qmDiscount())); }   // escalating, resets each visit; Quartermaster discount applies
export function freeRerollAllow(){ return (G.relics||[]).reduce((n,r)=>n+(r.freeRerolls||0),0) + upgTier('qm_reroll'); }   // +Quartermaster free reroll

export function showShop(ri){
  G._recruitMode='shop';
  G._offers=rollUnitOffers(3,true);
  G._eqOffers=equipReward(3);
  G._rerolls=0; G._freeRerolls=freeRerollAllow();
  renderRecruit();
}
export function renderRecruit(){
  const mode=G._recruitMode;
  const isShop=mode==='shop';
  const full=G.army.length>=benchMax();
  let html=`<div class="panel"><div class="lbl">${isShop?'Recruitment Camp':'Victory — Recruit Survivors'}</div>`;
  if(!isShop && G.battle && G.battle.P && upgTier('cdx_recap')){   // Codex — After-Action: detailed post-battle breakdown
    const mvp=[...G.battle.P].sort((a,b)=>(b._dmgDealt||0)-(a._dmgDealt||0))[0];
    const ultStar=[...G.battle.P].sort((a,b)=>(b._ults||0)-(a._ults||0))[0];
    const fallen=G.battle.P.filter(u=>!u.alive).length;
    if(mvp) html+=`<div class="row" style="margin-bottom:8px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:#0006;font-size:12px;gap:14px">
      <span>🏆 <b style="color:var(--gold-bright)">${mvp.ico} ${mvp.name}</b> dealt ${Math.round(mvp._dmgDealt||0)} dmg</span>
      ${ultStar&&(ultStar._ults||0)>0?`<span>✨ ${ultStar.ico} ${ultStar.name} ×${ultStar._ults} ultimates</span>`:''}
      ${fallen?`<span style="color:#e8a59f">☠ ${fallen} fell (they return next battle)</span>`:'<span style="color:#9fd0a0">No casualties</span>'}
    </div>`;
  }
  html+=`<div class="row" style="justify-content:space-between;margin-bottom:8px">
      <span class="tip">${isShop?'Hire units and buy gear — costs gold by rarity.':'Survivors hire on cheap — <b>25% off</b> shop prices.'}</span>
      <span class="tip">🪙 <b style="color:var(--gold-bright)">${G.gold}</b> · Bench <b>${G.army.length}/${benchMax()}</b></span></div>`;
  html+=`<div class="bench">`;
  G._offers.forEach((u,i)=>{
    const cost=offerCost(u);
    const blocked = full || G.gold<cost;
    const note = full?'bench full — sell below' : (G.gold<cost?'too expensive':'tap to inspect');
    html+=`<div onclick="inspectRecruit(${i})" style="cursor:pointer;${blocked?'opacity:.55':''}">${cardHTML(u,i,false,{cost,border:true})}
      <div class="tip" style="text-align:center;font-size:9px;margin-top:2px">${note}</div></div>`;
  });
  if(!G._offers.length) html+=`<div class="tip">All offers taken.</div>`;
  html+=`</div>`;
  const hasFree=(G._freeRerolls||0)>0;
  html+=`<div class="row" style="margin-top:10px">
      <button class="small" onclick="rerollOffers()" ${(!hasFree&&G.gold<rerollCost())?'disabled':''}>🎲 ${hasFree?'Free reroll 🧭':'Reroll units (🪙'+rerollCost()+')'}</button>
    </div>`;
  // shop: 3 purchasable equipment
  if(isShop){
    html+=`<div class="lbl" style="margin-top:16px">Quartermaster — equipment for sale</div><div class="bench">`;
    (G._eqOffers||[]).forEach((e,i)=>{
      const c=equipCost(e); const afford=G.gold>=c;
      html+=`<div class="card" style="cursor:pointer;border-color:${RAR_COL[e.rar]};${afford?'':'opacity:.55'}" onclick="inspectEquip(${i})">
        ${equipCardInner(e)}
        <div class="cs" style="margin-top:3px;justify-content:flex-end"><span style="color:var(--gold-bright);font-weight:700">🪙${c}</span></div>
      </div>`;
    });
    if(!(G._eqOffers||[]).length) html+=`<div class="tip">Sold out.</div>`;
    html+=`</div>`;
  }
  // bench with selling
  html+=`<div class="lbl" style="margin-top:16px">Your Bench — tap a unit to sell</div><div class="bench">`;
  if(!G.army.length) html+=`<div class="tip">No units on the bench.</div>`;
  G.army.forEach((u,i)=>{
    html+=`<div onclick="sellPrompt(${i})" style="cursor:pointer">${cardHTML(u,i,false,{sell:sellValue(u)})}</div>`;
  });
  html+=`</div>`;
  html+=`<div class="row" style="margin-top:16px;justify-content:space-between">
      <button class="small" onclick="${isShop?'leaveShop()':'afterUnitReward()'}">${isShop?'Leave →':'Done →'}</button>
      <button class="small" onclick="showEquip()">⚒ Manage Equipment</button></div></div>`;
  SC.innerHTML=html; renderHUD();
}
export function leaveShop(){
  if(!G.army.length){ toast('Recruit at least one unit before you march out'); return; }
  advanceRow();
}
export function rerollOffers(){
  const free=(G._freeRerolls||0)>0;
  if(!free){ const c=rerollCost(); if(G.gold<c){toast('Not enough gold');return;} G.gold-=c; G._rerolls=(G._rerolls||0)+1; toast('Rerolled (🪙'+c+')'); }
  else { G._freeRerolls--; toast('🧭 Free reroll'); }
  G._offers=rollUnitOffers(3, true, G._recruitMode==='victory'?(G._victoryLB||0):0);
  if(G._recruitMode==='shop') G._eqOffers=equipReward(3);
  renderRecruit();
}
export function inspectRecruit(i){
  const u=G._offers[i]; const cost=offerCost(u);
  const full=G.army.length>=benchMax();
  const can = !full && G.gold>=cost;
  const label = full?'Bench Full' : (G.gold<cost?`Need 🪙${cost}`:`Recruit (🪙${cost})`);
  openUnitDetail(u, { label, disabled:!can, onTake:()=>buyUnit(i) });
}
export function buyUnit(i){
  const u=G._offers[i]; const cost=offerCost(u);
  if(G.army.length>=benchMax()){ toast('Bench full ('+benchMax()+') — sell a unit first'); return; }
  if(G.gold<cost){ toast('Not enough gold'); return; }
  G.gold-=cost;
  G.army.push(u);
  G._offers.splice(i,1);
  toast('Recruited '+u.name+' (🪙'+cost+')');
  checkFusion();
  renderRecruit();
}
/* ---------- TIER FUSION (3 copies → 1 stronger unit, per GDD §15) ---------- */
export const TIER_MULT={2:1.6, 3:2.4};      // stat multiplier vs tier 1
export const TIER_STARS={1:'',2:'★★',3:'★★★'};
export function unitTier(u){ return u.tier||1; }
export function checkFusion(){
  let fused=true;
  while(fused){
    fused=false;
    const groups={};
    G.army.forEach((u,i)=>{ const k=u.name+'|'+unitTier(u); (groups[k]=groups[k]||[]).push(i); });
    for(const k in groups){
      const fuseN=(G._fuseN||3);
      if(groups[k].length>=fuseN){
        const idxs=groups[k].slice(0,fuseN).sort((a,b)=>b-a);
        const keepIx=idxs[idxs.length-1];        // lowest index = the unit we keep
        const tier=unitTier(G.army[keepIx]);
        if(tier>=3) continue;
        const keep=G.army[keepIx];
        const extraGear=[];
        idxs.forEach(ix=>{ const u=G.army[ix]; if(u!==keep&&u.gear){ ['weapon','armor','trinket'].forEach(s=>{ if(u.gear[s])extraGear.push(u.gear[s]); }); } });
        idxs.filter(ix=>ix!==keepIx).forEach(ix=>G.army.splice(ix,1));   // remove the consumed copies (high→low order preserved by sort)
        const newTier=tier+1, mult=TIER_MULT[newTier]/(TIER_MULT[tier]||1);
        keep.tier=newTier;
        keep.hp=Math.round(keep.hp*mult); keep.dmg=Math.round(keep.dmg*mult);
        extraGear.forEach(id=>G.stash.push(newEquip(id)));
        toast('✨ FUSION! '+keep.name+' → Tier '+newTier+' '+TIER_STARS[newTier]);
        fused=true;
        break;
      }
    }
  }
}
export function sellPrompt(i){
  const u=G.army[i]; const val=sellValue(u);
  openUnitDetail(u, { label:`Sell for 🪙${val}`, onTake:()=>sellUnit(i) });
}
export function sellUnit(i){
  const u=G.army[i]; const val=sellValue(u);
  // return any equipped gear to the stash
  if(u.gear){ ['weapon','armor','trinket'].forEach(s=>{ if(u.gear[s]){ G.stash.push(newEquip(u.gear[s])); } }); }
  G.gold+=val; G.army.splice(i,1);
  toast('Sold '+u.name+' for 🪙'+val);
  renderRecruit();
}
export function inspectEquip(i){
  const e=G._eqOffers[i]; const c=equipCost(e);
  const can=G.gold>=c;
  openEquipDetail(e, {label: can?`Buy (🪙${c})`:`Need 🪙${c}`, disabled:!can, onTake:()=>buyEquip(i)});
}
export function buyEquip(i){
  const e=G._eqOffers[i]; const c=equipCost(e);
  if(G.gold<c){ toast('Not enough gold'); return; }
  G.gold-=c; G.stash.push(newEquip(e.id));
  G._eqOffers.splice(i,1);
  toast('Bought '+e.name+' (🪙'+c+')');
  renderRecruit();
}
// legacy entry retained in case referenced
export function recruit(ri,i){ buyUnit(i); }

/* ---------- REST ---------- */
export function showRest(ri){
  SC.innerHTML=`<div class="panel center"><div class="lbl">Rest Site</div>
    <p class="tip" style="margin:14px 0">The army makes camp. Choose a boon:</p>
    <div class="row" style="justify-content:center;flex-wrap:wrap">
      <button onclick="restChoice('cap',${ri})">📖 Train — +30 XP</button>
      <button onclick="restChoice('gold',${ri})">🪙 Forage — +40 Gold</button>
      <button onclick="restChoice('fortify',${ri})">🛡️ Fortify — +20% Max HP next battle</button>
    </div></div>`;
}
export function restChoice(k,ri){
  if(k==='cap'){ gainXp(30); }
  else if(k==='fortify'){ G.fortifyNext=0.20; toast('🛡️ The army is fortified — +20% Max HP next battle'); }
  else { G.gold+=40; toast('+40 gold'); }
  advanceRow();
}

