// @ts-nocheck
import { FACTIONS, FACTION_INFO, FCOL, META, META_TRACKS, ascGoldMult, buyUpgrade, metaLockable, saveMeta, upgTier } from "./data-units.js";
import { FAC_SYN } from "./synergies.js";
import { FAM_COL, RAR_COL, equipIcoHTML, equipReward, newEquip, relicIcoHTML, relicReward } from "./data-loot.js";
import { G } from "./engine-hex.js";
import { SC, advanceRow, renderHUD, showTitle } from "./ui-render-core.js";
import { buyUnit, freeRerollAllow, inspectRecruit, renderRecruit, rollUnitOffers } from "./ui-shop.js";
import { checkFactionCommanderUnlocks, gainXp, showCommanderSelect } from "./flow-commanders.js";
import { finishRunStats, recordBattleStats } from "./stats.js";
import { pick } from "./rng.js";
import { toast } from "./ui-tooltips.js";

export function endBattle(won){
  clearInterval(G.battle.timer);
  recordBattleStats(won);
  if(G._capSaved!=null){ G.cap=G._capSaved; G._capSaved=null; }   // undo Omen of Ruin cap bonus
  const status=document.getElementById('combatStatus');
  if(won){
    G.cleared++; G.actCleared=(G.actCleared||0)+1;
    const reward = G.battle.node.t==='boss'?15 : G.battle.node.t==='elite'?8:4;
    G.lore+=reward;
    if(G.battle.node.t==='boss') G.essence+=2;   // premium currency from boss kills (GDD §27)
    const a=G.act;
    const goldM=(G.relics||[]).reduce((m,r)=>m*(r.goldMult||1),1);
    G.gold+= Math.round((G.battle.node.t==='boss'?(50+25*a):G.battle.node.t==='elite'?(30+10*a):(15+5*a))*ascGoldMult()*goldM);
    gainXp(G.battle.node.t==='boss'?(25+10*a):G.battle.node.t==='elite'?(15+5*a):(9+3*a), true);
    // economy & post-battle relic hooks
    (G.relics||[]).forEach(r=>{ if(r.battleGold)G.gold+=r.battleGold; if(r.postBattle)r.postBattle(G); });
    setTimeout(()=>showVictory(),700);
  } else {
    G.over=true;
    finishRunStats('defeat');
    setTimeout(()=>showDefeat(),700);
  }
}

/* ---------- victory: reward pick ---------- */
export function showVictory(){
  G._recruitMode='victory';
  const lb=G.battle.node.t==='boss'?2 : G.battle.node.t==='elite'?1 : 0;
  G._victoryLB=lb;
  let nOffers=Math.max(3,...(G.relics||[]).map(r=>r.rewardChoices||3));
  if(G.commander==='brunhild') nOffers=Math.max(2,...(G.relics||[]).map(r=>(r.rewardChoices||3)-1));   // Brunhild: one fewer choice
  // Quartermaster — Wide Draft: once per act, this battle's reward offers 4 choices
  if(upgTier('qm_draft') && G._wideDraftAct!==G.act && G.battle.node.t==='battle'){ nOffers=Math.max(nOffers,4); G._wideDraftAct=G.act; G._wideDraftThis=true; }
  G._offers=rollUnitOffers(nOffers,true,lb);
  G._rerolls=0; G._freeRerolls=freeRerollAllow();
  const isBoss=G.battle.node.t==='boss';
  const a=G.act; const goldGain=isBoss?(50+25*a):G.battle.node.t==='elite'?(30+10*a):(15+5*a);
  toast('Victory! +🪙'+goldGain);
  renderRecruit();
}
export function inspectVictory(i){ inspectRecruit(i); }
export function takeReward(i){ buyUnit(i); }
export function afterUnitReward(){
  // elites & bosses award a relic choice; bosses also drop equipment
  const t=G.battle.node.t;
  if(t==='elite'||t==='boss'){ showRelicReward(t==='boss'); }
  else advanceRow();
}
export function showRelicReward(allowGC){
  const offers=relicReward(3,allowGC); G._relicOffers=offers;
  if(!offers.length){ afterRelicReward(); return; }
  let html=`<div class="panel center"><div class="lbl">Spoils — Choose a Relic</div>
    <p class="tip" style="margin:8px 0">A run-long, army-wide power. Choose one:</p>
    <div class="bench" style="justify-content:center;margin:14px 0">`;
  offers.forEach((r,i)=>html+=`<div class="card" style="cursor:pointer;border-color:${FAM_COL[r.fam]}" onclick="takeRelic(${i})">
    <div class="cn" style="color:${RAR_COL[r.rar]}">${relicIcoHTML(r,22)} ${r.name}</div>
    <div class="cf"><span class="chip" style="background:${FAM_COL[r.fam]};color:#0e0b14">${r.fam}</span></div>
    <div class="cs" style="color:#c9bbe0">${r.desc}</div></div>`);
  html+=`</div><button class="small" onclick="afterRelicReward()">Skip relic →</button></div>`;
  SC.innerHTML=html;renderHUD();
}
export function takeRelic(i){
  const r=G._relicOffers[i]; G.relics.push(r); if(r.onPick)r.onPick(G);
  toast('Gained relic: '+r.name); afterRelicReward();
}
export function afterRelicReward(){
  if(G.battle.node.t==='boss'){ showEquipReward(); }
  else advanceRow();
}
export function showEquipReward(){
  const offers=equipReward(3,2); G._equipOffers=offers;
  let html=`<div class="panel center"><div class="lbl">Boss Hoard — Choose Equipment</div>
    <p class="tip" style="margin:8px 0">Movable gear for one unit. Goes to your stash:</p>
    <div class="bench" style="justify-content:center;margin:14px 0">`;
  offers.forEach((e,i)=>html+=`<div class="card" style="cursor:pointer;border-color:${RAR_COL[e.rar]}" onclick="takeEquip(${i})">
    ${equipCardInner(e)}</div>`);
  html+=`</div><button class="small" onclick="advanceRow()">Skip →</button></div>`;
  SC.innerHTML=html;renderHUD();
}
export function takeEquip(i){ G.stash.push(newEquip(G._equipOffers[i].id)); toast('Stashed '+G._equipOffers[i].name); advanceRow(); }
export function equipCardInner(e){
  const SLOT_ICO={weapon:'⚔ Weapon',armor:'🛡 Armor',trinket:'💍 Trinket'};
  return `<div class="cn" style="color:${RAR_COL[e.rar]}">${equipIcoHTML(e,22)} ${e.name}</div>
    <div class="cf"><span class="chip" style="background:${RAR_COL[e.rar]};color:#0e0b14">${e.rar}</span>
      <span class="chip" style="background:#2a2138;color:#c9bbe0">${SLOT_ICO[e.slot]}</span></div>
    <div class="cs" style="color:#c9bbe0">${e.desc}</div>`;
}
export function bankLore(){
  // move the run's earned Lore into the persistent meta wallet (once per run end)
  if(G && !G._loreBanked){ META.lore=(META.lore||0)+(G.lore||0); G._loreBanked=true; saveMeta(META); }
}
export function showDefeat(){
  bankLore();
  SC.innerHTML=`<div class="panel center"><div class="win-banner" style="color:var(--bad)">The Banners Fall</div>
    <p class="tip" style="margin:14px auto;max-width:480px">Your army was wiped. A run ends with a single defeat — but you banked
      <b>+${G.lore} Lore</b> toward permanent faction unlocks.</p>
    <div class="row" style="justify-content:center;margin-top:12px">
      <button class="primary" onclick="showCommanderSelect()">New Run</button>
      <button class="small" onclick="showMetaStore()">🏛 Athenaeum (${META.lore} Lore)</button>
      <button class="small" onclick="showTitle()">Title</button></div></div>`;
  renderHUD();
}
export function winGame(){
  finishRunStats('win');
  bankLore();
  // clearing a run unlocks the next ascension tier (up to 10)
  if((G.ascension||0)>=META.ascMax && META.ascMax<10){ META.ascMax++; saveMeta(META); }
  SC.innerHTML=`<div class="panel center"><div class="win-banner" style="color:var(--gold-bright)">The Realm Restored</div>
    <p class="tip" style="margin:14px auto;max-width:520px">You cleared all three acts and broke the Dread Dominion.
      Final army of ${G.army.length}, <b>+${G.lore} Lore</b> banked toward faction unlocks.</p>
    <div class="row" style="justify-content:center;margin-top:12px">
      <button class="primary" onclick="showCommanderSelect()">New Run</button>
      <button class="small" onclick="showMetaStore()">🏛 Athenaeum (${META.lore} Lore)</button></div></div>`;
  renderHUD();
}
/* ---------- THE ATHENAEUM — spend banked Lore on permanent horizontal upgrades (GDD §25a) ---------- */
export function showMetaStore(tab){
  if(tab) META._tab=tab;
  const cur=META._tab||'factions';
  const tabs=[['factions','🏛 Factions']].concat(META_TRACKS.map(tr=>[tr.id, tr.ico+' '+tr.name]));
  let html=`<div class="panel"><div class="lbl">🏛 The Athenaeum</div>
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <span class="tip">Spend banked Lore on permanent, horizontal upgrades — options and knowledge, never raw power.</span>
      <span class="tip">📜 <b style="color:var(--gold-bright)">${META.lore}</b> Lore</span></div>`;
  // tab bar
  html+=`<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">`;
  tabs.forEach(([id,label])=>{ html+=`<button class="small" style="${cur===id?'background:#2a2138;border-color:var(--gold-bright);color:var(--gold-bright)':''}" onclick="showMetaStore('${id}')">${label}</button>`; });
  html+=`</div>`;

  if(cur==='factions'){
    const lockable=metaLockable();
    html+=`<p class="tip" style="margin-bottom:10px">Unlock factions into your draft pool for future runs. Unlocked: <b>(${META.unlocked.length}/${FACTIONS.length+1})</b></p>`;
    if(!lockable.length){ html+=`<p class="tip">Every faction is unlocked. The realm holds no more secrets for you.</p>`; }
    else { html+=`<div style="display:flex;flex-direction:column;gap:8px">`;
      lockable.forEach(f=>{ const info=FACTION_INFO[f]; const afford=META.lore>=info.cost; const syn=FAC_SYN[f];
        html+=`<div class="card" style="width:100%;border-color:${FCOL[f]||'#555'};${afford?'':'opacity:.6'}">
          <div class="row" style="justify-content:space-between">
            <div><div class="cn" style="font-size:14px">${info.ico} ${f}</div>
              <div class="cs" style="color:#c9bbe0;font-size:11px;margin-top:2px">${info.blurb}</div>
              ${syn?`<div class="cs dim" style="font-size:10px;margin-top:2px">${syn.name}: ${syn.desc[0]} → ${syn.desc[1]}</div>`:''}</div>
            <button class="small" ${afford?'':'disabled'} onclick="unlockFaction('${f}')" style="white-space:nowrap">📜 ${info.cost}</button>
          </div></div>`; });
      html+=`</div>`; }
  } else {
    const tr=META_TRACKS.find(t=>t.id===cur);
    html+=`<p class="tip" style="margin-bottom:10px">${tr.blurb}</p><div style="display:flex;flex-direction:column;gap:8px">`;
    tr.upgrades.forEach(u=>{
      const t=upgTier(u.id), maxed=t>=u.max, cost=maxed?null:u.cost[t], afford=!maxed&&META.lore>=cost;
      const pips=u.max>1?` <span style="color:#9c8fb0;font-size:10px">[${t}/${u.max}]</span>`:'';
      html+=`<div class="card" style="width:100%;${maxed?'border-color:#5a8f6a':afford?'':'opacity:.6'}">
        <div class="row" style="justify-content:space-between">
          <div><div class="cn" style="font-size:14px">${u.ico} ${u.name}${pips}</div>
            <div class="cs" style="color:#c9bbe0;font-size:11px;margin-top:2px">${u.tierDesc(maxed?u.max:t+1)}</div></div>
          ${maxed?`<span class="chip" style="background:#16291c;color:#9fd0a0;white-space:nowrap">✓ Owned</span>`
                 :`<button class="small" ${afford?'':'disabled'} onclick="buyUpgrade('${u.id}')" style="white-space:nowrap">📜 ${cost}</button>`}
        </div></div>`;
    });
    html+=`</div>`;
  }
  html+=`<div class="row" style="margin-top:16px"><button class="primary" onclick="showCommanderSelect()">Begin a Run →</button>
    <button class="small" onclick="showTitle()">Title</button></div></div>`;
  SC.innerHTML=html;
}
export function unlockFaction(f){
  const info=FACTION_INFO[f]; if(!info)return;
  if(META.lore<info.cost){ toast('Not enough Lore'); return; }
  META.lore-=info.cost; META.unlocked.push(f); saveMeta(META);
  toast(info.ico+' '+f+' permanently unlocked!');
  checkFactionCommanderUnlocks();
  showMetaStore();
}

/* ---------- stat tooltip ---------- */
