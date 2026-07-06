// @ts-nocheck
import { EQUIPMENT, activePool, equipIcoHTML, newEquip, relicIcoHTML, relicReward, unitRarity } from "./data-loot.js";
import { FACTION_INFO, FCOL } from "./data-units.js";
import { FAC_SYN } from "./synergies.js";
import { G } from "./engine-hex.js";
import { SC, advanceRow } from "./ui-render-core.js";
import { TIER_MULT, TIER_STARS, benchMax, checkFusion, recruit } from "./ui-shop.js";
import { addActiveFaction, factionChoices } from "./flow-commanders.js";
import { cardHTML } from "./ui-army-equip.js";
import { pick } from "./rng.js";
import { toast } from "./ui-tooltips.js";

export const TEMPER_STATS=[
  {k:'hp',  label:'Health',  ico:'❤'},
  {k:'dmg', label:'Damage',  ico:'⚔'},
  {k:'as',  label:'Atk Speed',ico:'⚡'},
];
export function showForge(){
  G._forgeUsed=false;
  const E=G.essence||0;
  const canTier=G.army.some(u=>(u.tier||1)<3);
  let html=`<div class="panel"><div class="lbl">⚒️ The Arcane Forge</div>
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <span class="tip">Spend Essence on one forging. Each visit allows a single action.</span>
      <span class="tip">🔮 <b style="color:#c8a6ff">${E}</b> Essence</span></div>
    <div style="display:flex;flex-direction:column;gap:9px">`;
  // A — Forge Equipment: 1 essence → a random piece of gear
  html+=`<div class="card" style="width:100%;border-color:#4a90c2">
    <div class="cn" style="font-size:13px">⚙️ Forge Equipment <span style="color:#c8a6ff">🔮1</span></div>
    <div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:2px">Forge a random piece of equipment (weapon, armor, or trinket) into your stash.</div>
    <button class="small" style="margin-top:6px" ${E<1?'disabled':''} onclick="forgeEssence('equip')">Forge gear →</button></div>`;
  // B — Tier-Up: 2 essence → raise a unit a full tier
  html+=`<div class="card" style="width:100%;border-color:#9575cd">
    <div class="cn" style="font-size:13px">✦ Forge Tier-Up <span style="color:#c8a6ff">🔮2</span></div>
    <div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:2px">Raise one unit a full Tier with no duplicates needed — a big stat boost and supercharged ability.</div>
    <button class="small" style="margin-top:6px" ${(E<2||!canTier)?'disabled':''} onclick="forgeEssence('tierup')">Choose unit →</button></div>`;
  // C — Forge Relic: 3 essence → a random run-long relic
  html+=`<div class="card" style="width:100%;border-color:#c9a227">
    <div class="cn" style="font-size:13px">🏺 Forge Relic <span style="color:#c8a6ff">🔮3</span></div>
    <div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:2px">Forge a random run-long relic (army-wide power). Game-Changers excluded.</div>
    <button class="small" style="margin-top:6px" ${E<3?'disabled':''} onclick="forgeEssence('relic')">Forge relic →</button></div>`;
  // D — Forge Apprentice: free → a random Common/Uncommon recruit
  html+=`<div class="card" style="width:100%;border-color:#5a8f6a">
    <div class="cn" style="font-size:13px">🔨 Forge Apprentice <span style="color:#9fd0a0">Free</span></div>
    <div class="cs" style="font-size:11px;color:#c9bbe0;margin-top:2px">Hammer out a fresh recruit at no cost — a random Common or Uncommon unit from your factions.</div>
    <button class="small" style="margin-top:6px" onclick="forgeEssence('apprentice')">Forge recruit →</button></div>`;
  html+=`</div><div class="row" style="margin-top:16px"><button class="small" onclick="advanceRow()">Leave the forge →</button></div></div>`;
  SC.innerHTML=html;
}
export function forgeEssence(action){
  if(G._forgeUsed){ toast('The forge has cooled — one action per visit'); return; }
  const E=G.essence||0;
  if(action==='equip'){
    if(E<1){ toast('Need 🔮1 Essence'); return; }
    const e=pick(EQUIPMENT); G.essence-=1; G.stash.push(newEquip(e.id));
    G._forgeUsed=true; toast('⚙️ Forged '+equipIcoHTML(e,16)+' '+e.name+' (🔮1)',true); advanceRow();
  } else if(action==='relic'){
    if(E<3){ toast('Need 🔮3 Essence'); return; }
    const offers=relicReward(1,false);
    if(!offers.length){ toast('No new relics to forge'); return; }
    const r=offers[0]; G.essence-=3; G.relics.push(r); if(r.onPick)r.onPick(G);
    G._forgeUsed=true; toast('🏺 Forged relic: '+relicIcoHTML(r,16)+' '+r.name+' (🔮3)',true); advanceRow();
  } else if(action==='apprentice'){
    if(G.army.length>=benchMax()){ toast('Bench full — sell a unit first'); return; }
    const pool=activePool().filter(x=>{const r=unitRarity(x); return r==='Common'||r==='Uncommon';});
    const src=pool.length?pool:activePool();
    if(!src.length){ toast('No recruits available'); return; }
    const u=clone(pick(src)); u.gear={weapon:null,armor:null,trinket:null}; u.tier=1;
    G.army.push(u);
    G._forgeUsed=true; toast('🔨 Forged a recruit: '+u.name+' (free)'); checkFusion(); advanceRow();
  } else if(action==='tierup'){
    if(E<2){ toast('Need 🔮2 Essence'); return; }
    if(!G.army.some(u=>(u.tier||1)<3)){ toast('No unit can be tiered up'); return; }
    let html=`<div class="panel"><div class="lbl">✦ Tier-Up Which Unit? <span class="tip">(🔮2)</span></div><div class="bench">`;
    G.army.forEach((u,i)=>{
      const maxed=(u.tier||1)>=3;
      html+=`<div onclick="${maxed?'':`forgeTierUnit(${i})`}" style="cursor:${maxed?'not-allowed':'pointer'};${maxed?'opacity:.5':''}">${cardHTML(u,i,false)}
        <div class="tip" style="text-align:center;font-size:9px;margin-top:2px">${maxed?'Tier 3 max':'select'}</div></div>`;
    });
    html+=`</div><div class="row" style="margin-top:14px"><button class="small" onclick="showForge()">← Back</button></div></div>`;
    SC.innerHTML=html;
  }
}
export function forgeTierUnit(i){
  if(G._forgeUsed){ toast('The forge has cooled — one action per visit'); return; }
  if((G.essence||0)<2){ toast('Need 🔮2 Essence'); return; }
  const u=G.army[i];
  if((u.tier||1)>=3){ toast('Already Tier 3'); return; }
  G.essence-=2;
  const tier=u.tier||1, newTier=tier+1, mult=TIER_MULT[newTier]/(TIER_MULT[tier]||1);
  u.tier=newTier; u.hp=Math.round(u.hp*mult); u.dmg=Math.round(u.dmg*mult);
  G._forgeUsed=true;
  toast('✦ '+u.name+' forged to Tier '+newTier+' '+TIER_STARS[newTier]+' (🔮2)');
  advanceRow();
}
export function showTown(){
  const choices=factionChoices(3);
  let html=`<div class="panel"><div class="lbl">🏰 Town — Forge an Alliance</div>
    <p class="tip" style="margin-bottom:12px">${choices.length?'A frontier town pledges fresh banners — or trades in rare arcane shards. Choose one:':'Every unlocked faction is already in your pool. The artificers offer their wares instead.'}</p>
    <div style="display:flex;flex-direction:column;gap:10px">`;
  choices.forEach(f=>{
    const info=FACTION_INFO[f]||{ico:'',blurb:''}; const syn=FAC_SYN[f];
    html+=`<div class="card" style="width:100%;cursor:pointer;border-color:${FCOL[f]||'#555'}" onclick="townPickFaction('${f}')">
      <div class="cn" style="font-size:14px">${info.ico} ${f}</div>
      <div class="cs" style="color:#c9bbe0;font-size:11px;margin-top:3px">${info.blurb}</div>
      ${syn?`<div class="cs dim" style="font-size:10px;margin-top:3px">Synergy: ${syn.name} — ${syn.desc[0]} → ${syn.desc[1]}</div>`:''}
    </div>`;
  });
  // Essence option (always available)
  html+=`<div class="card" style="width:100%;cursor:pointer;border-color:#9575cd" onclick="townTakeEssence()">
    <div class="cn" style="font-size:14px">🔮 Arcane Shard <span style="color:#c8a6ff">+1 Essence</span></div>
    <div class="cs" style="color:#c9bbe0;font-size:11px;margin-top:3px">Take a shard of Essence instead — the premium currency spent at the Arcane Forge.</div>
  </div>`;
  html+=`</div><div class="row" style="margin-top:14px"><button class="small" onclick="advanceRow()">Move on →</button></div></div>`;
  SC.innerHTML=html;
}
export function townPickFaction(f){ addActiveFaction(f); advanceRow(); }
export function townTakeEssence(){ G.essence=(G.essence||0)+1; toast('🔮 +1 Essence'); advanceRow(); }
export function clone(o){return JSON.parse(JSON.stringify(o));}

