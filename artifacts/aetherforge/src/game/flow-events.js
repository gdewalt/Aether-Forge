// @ts-nocheck
import { EQUIPMENT, activePool, newEquip, pickUnitByRarity, relicReward, unitPower, unitRarity } from "./data-loot.js";
import { G } from "./engine-hex.js";
import { POOL } from "./data-units.js";
import { RNG, pick, rint } from "./rng.js";
import { SC, advanceRow } from "./ui-render-core.js";
import { benchMax, checkFusion } from "./ui-shop.js";
import { clone } from "./flow-forge.js";
import { eventModOf, setEventMod } from "./engine-battle-setup.js";
import { factionChoices, showFactionPick } from "./flow-commanders.js";
import { past } from "./ui-planning.js";
import { toast } from "./ui-tooltips.js";

/* ---------- EVENT (narrative choice) ---------- */
// --- Event reward helpers ---
export function evGrantRelic(allowGC){ const offs=relicReward(1,allowGC); if(!offs.length){ G.gold+=40; toast('No new relic · +40 gold'); return; } const r=offs[0]; G.relics.push(r); if(r.onPick)r.onPick(G); toast('🏺 Gained relic: '+r.name); }
export function evGrantUnit(rarity){ if(G.army.length>=benchMax()){ G.gold+=30; toast('Bench full · +30 gold'); return; } let u; if(rarity){ const pool=activePool().filter(x=>unitRarity(x)===rarity); u=clone(pool.length?pick(pool):pick(activePool())); } else { u=pickUnitByRarity(0); } u.gear={weapon:null,armor:null,trinket:null}; u.tier=1; G.army.push(u); toast('Recruited '+u.name); checkFusion(); }
export function evGrantCopy(){ if(!G.army.length||G.army.length>=benchMax()){ G.gold+=30; toast('+30 gold'); return; } const base=pick(G.army.filter(u=>(u.tier||1)<3)||G.army); if(!base){ G.gold+=30; toast('+30 gold'); return; } const c=clone(base); c.gear={weapon:null,armor:null,trinket:null}; c.tier=base.tier||1; G.army.push(c); toast('📜 A second '+c.name+' joins — fusion progress'); checkFusion(); }
export function evGrantEquip(legendaryOk){ const pool=EQUIPMENT.filter(x=>legendaryOk||x.rar!=='Legendary'); const e=pick(pool); G.stash.push(newEquip(e.id)); toast('🗡️ Gained '+e.name); }
export function armyHasClass(cls){ return !!(G&&G.army)&&G.army.some(u=>u.cls===cls||u.cls2===cls); }
export function armyHasFaction(fac){ return !!(G&&G.army)&&G.army.some(u=>u.faction===fac); }

export const EVENTS=[
  {title:'Wandering Quartermaster',text:'A peddler offers a trade from his cart.',
   opts:[{label:'Take free gear →',act:()=>{const e=pick(EQUIPMENT);G.stash.push(newEquip(e.id));toast('Gained '+e.name);}},
         {label:'Demand gold (+50) →',act:()=>{G.gold+=50;toast('+50 gold');}}]},
  {title:'Ancient Shrine',text:'An altar hums with old power. Make an offering?',
   opts:[{label:'Pray — gain Lore (+4) →',act:()=>{G.lore+=4;toast('+4 Lore');}},
         {label:'Plunder — +60 gold, risk nothing →',act:()=>{G.gold+=60;toast('+60 gold');}}]},
  {title:'Lost Recruit',text:'A lone fighter asks to join your banner.',
   opts:[{label:'Welcome them (random unit) →',act:()=>{if(G.army.length<benchMax()){const u=clone(pick(POOL));u.gear={weapon:null,armor:null,trinket:null};G.army.push(u);toast('Recruited '+u.name);checkFusion();}else toast('Bench full');}},
         {label:'Send them off (+30 gold) →',act:()=>{G.gold+=30;toast('+30 gold');}}]},
  {title:'Abandoned Forge',text:'Cold embers and a half-finished blade lie here.',
   opts:[{label:'Salvage equipment →',act:()=>{const e=pick(EQUIPMENT.filter(x=>x.rar!=='Legendary'));G.stash.push(newEquip(e.id));toast('Salvaged '+e.name);}},
         {label:'Rest by the coals (+15% Max HP next battle) →',act:()=>{G.fortifyNext=Math.max(G.fortifyNext||0,0.15);toast('🛡️ Fortified for the next battle');}}]},
  {title:'Astral Rift',text:'A tear in the sky weeps shards of raw Essence. Reach in?',
   opts:[{label:'Take a shard safely (+1 Essence) →',act:()=>{G.essence=(G.essence||0)+1;toast('🔮 +1 Essence');}},
         {label:'Plunge your arm in (50/50: +3 Essence or −20% HP next battle) →',act:()=>{
            if(RNG()<0.5){ G.essence=(G.essence||0)+3; toast('🔮 +3 Essence!'); }
            else { G.fortifyNext=-0.20; toast('The rift bites — your army enters the next battle at −20% Max HP'); }
         }},
         {label:'Leave it be →',act:()=>{toast('You step away from the rift');}}]},
  {title:'Faction Emissary',text:'An envoy from an unaligned banner seeks an alliance with your host.',
   factionGate:true,
   opts:[{label:'Hear their pledge (add a faction) →',act:()=>{
            const choices=factionChoices(3);
            if(!choices.length){ G.gold+=30; toast('No alliance to be had · +30 gold'); return true; }
            showFactionPick(choices,'🤝 Faction Emissary','The envoy offers to fold one of these banners into your draft pool:',()=>advanceRow(),false);
            return false;   // the pick screen handles advancing
         }},
         {label:'Demand tribute instead (+40 gold) →',act:()=>{G.gold+=40;toast('+40 gold');return true;}}]},

  {title:'Twin Recruits',text:'Two identical sellswords stand ready — take both, or one and their purse.',
   opts:[{label:'Take both (fusion progress) →',act:()=>{
            if(G.army.length>=benchMax()-1){ G.gold+=40; toast('Bench too full · +40 gold'); return; }
            const u=pickUnitByRarity(0); u.gear={weapon:null,armor:null,trinket:null}; u.tier=1;
            const c=clone(u); G.army.push(u); G.army.push(c); toast('Recruited two '+u.name+' — fusion progress'); checkFusion();
         }},
         {label:'Take one + their coin (+45 gold) →',act:()=>{ evGrantUnit(); G.gold+=45; }}]},

  {title:'The Bleeding Statue',text:'A weeping idol promises power for a price in blood.',
   opts:[{label:'Sacrifice a unit for a Relic →',act:()=>{
            if(G.army.length<=1){ toast('Too few units to spare one'); return; }
            const lost=G.army.splice(rint(G.army.length),1)[0]; toast('🩸 '+lost.name+' is given to the statue'); evGrantRelic(false);
         }},
         {label:'Pay in gold (−40) for Essence (+2) →',act:()=>{ if(G.gold<40){toast('Not enough gold');return;} G.gold-=40; G.essence=(G.essence||0)+2; toast('🔮 +2 Essence'); }},
         {label:'Walk away →',act:()=>{toast('You leave the idol weeping');}}]},

  {title:'Gilded Chest',text:'A locked chest glimmers. A faint holy ward seals it.',
   opts:[{label:()=>armyHasClass('Cleric')?'Your Cleric dispels the ward (safe Relic) →':'Force it open (risky) →',
          act:()=>{ if(armyHasClass('Cleric')){ evGrantRelic(false); } else { if(RNG()<0.55){ evGrantRelic(false); } else { G.fortifyNext=-0.15; toast('💥 A trap! Your army enters the next battle at −15% HP'); } } }},
         {label:'Pry off the gilding (+55 gold) →',act:()=>{G.gold+=55;toast('+55 gold');}}]},

  {title:'Warlord\u2019s Challenge',text:'A scarred champion bars the road and demands a duel for honor.',
   opts:[{label:'Send your strongest (Legendary on win) →',act:()=>{
            const champ=G.army.slice().sort((a,b)=>unitPower(b)-unitPower(a))[0];
            const win = champ ? RNG() < 0.55+Math.min(0.3,unitPower(champ)/600) : RNG()<0.4;
            if(win){ evGrantUnit('Legendary'); toast('⚔️ Your champion wins the duel!'); }
            else { G.fortifyNext=Math.min(G.fortifyNext||0,-0.12); toast('Your champion is wounded — −12% HP next battle'); }
         }},
         {label:'Bribe past (−30 gold, gain a Relic) →',act:()=>{ if(G.gold<30){toast('Not enough gold');return;} G.gold-=30; evGrantRelic(false); }},
         {label:'Refuse and reroute →',act:()=>{toast('You take the long road');}}]},

  {title:'Ember Pilgrimage',text:'Coals stretch across the path. Pilgrims say they temper the worthy.',
   opts:[{label:'Walk the coals (a unit is Reborn) →',act:()=>{
            const u=pick(G.army); if(!u){ G.gold+=30; toast('+30 gold'); return; } u.phoenixRevive=Math.max(u.phoenixRevive||0,0.5); u._eventReborn=true; toast('🔥 '+u.name+' will revive once each battle');
         }},
         {label:'Donate to the shrine (+4 Lore) →',act:()=>{G.lore+=4;toast('+4 Lore');}}]},

  {title:'Hooded Tinker',text:'A goblin tinker spreads gadgets across a rug.',
   opts:[{label:'Buy a kit (−35 gold, gain Equipment) →',act:()=>{ if(G.gold<35){toast('Not enough gold');return;} G.gold-=35; evGrantEquip(false); }},
         {label:'Trade scrap (free common Equipment) →',act:()=>{ const e=pick(EQUIPMENT.filter(x=>x.rar==='Common'||x.rar==='Uncommon')); G.stash.push(newEquip(e.id)); toast('🔧 Gained '+e.name); }}]},

  {title:'Standing Stones',text:'Ancient runes thrum. Press a palm to one?',
   opts:[{label:'War rune (+25% damage next battle) →',act:()=>{ G._eventMod={id:'warrune',name:'War Rune',ico:'⚔️',desc:'+25% damage next battle',apply:(P,E)=>P.forEach(u=>u.dmg*=1.25)}; toast('⚔️ War Rune blessed — +25% damage next fight'); }},
         {label:'Ward rune (army −20% damage taken next battle) →',act:()=>{ G._eventMod={id:'wardrune',name:'Ward Rune',ico:'🛡️',desc:'−20% damage taken next battle',apply:(P,E)=>P.forEach(u=>u.dr=Math.min(.85,(u.dr||0)+0.20))}; toast('🛡️ Ward Rune blessed — tougher next fight'); }},
         {label:'Greed rune (+50 gold, enemies +10% next battle) →',act:()=>{ G.gold+=50; G._eventMod={id:'greedrune',name:'Greed Curse',ico:'💰',desc:'Enemies +10% damage next battle',apply:(P,E)=>E.forEach(u=>u.dmg*=1.1)}; toast('💰 +50 gold — but the foe grows bolder'); }}]},

  {title:'Field Medic',text:'A battlefield healer offers to mend your roster.',
   opts:[{label:()=>armyHasClass('Cleric')?'Your Clerics assist (gain a Relic + 20 gold) →':'Accept their care (+25 gold, +2 Lore) →',
          act:()=>{ if(armyHasClass('Cleric')){ evGrantRelic(false); G.gold+=20; } else { G.gold+=25; G.lore+=2; toast('+25 gold, +2 Lore'); } }},
         {label:'Decline, press on (+1 Essence) →',act:()=>{ G.essence=(G.essence||0)+1; toast('🔮 +1 Essence'); }}]},

  {title:'The Voidwell',text:'A well of starless dark whispers of relic-light below.',
   actGate:2,
   opts:[{label:'Channel it (permanent +10% ult charge this run) →',act:()=>{ G.relics.push({id:'evt_astral',name:'Astral Attunement',fam:'Synergy',ico:'🌌',rar:'Rare',desc:'All units gain +10% ultimate charge rate.',apply:(us)=>us.forEach(u=>{u.chargeMul=(u.chargeMul||1)*1.10;})}); toast('🌌 Astral Attunement — faster ultimates all run'); }},
         {label:'Reach inside for a Game-Changer (−1 unit\u2019s HP) →',act:()=>{ const u=pick(G.army); if(u){ u.hp=Math.round(u.maxhp*0.6); } evGrantRelic(true); }},
         {label:'Seal the rift →',act:()=>{toast('You close the tear');}}]},

  {title:'Deserter\u2019s Cache',text:'A fled soldier left a buried stash behind.',
   opts:[{label:'Dig it up (gold + Equipment) →',act:()=>{ G.gold+=35; evGrantEquip(false); toast('+35 gold and gear'); }},
         {label:'Take only the map (reveal: +5 Lore) →',act:()=>{ G.lore+=5; toast('+5 Lore'); }}]},

  {title:'Beast Whisperer',text:'A wild-eyed druid offers a pact with the wilds.',
   opts:[{label:()=>armyHasClass('Beast')?'Your beasts answer (free Beast unit) →':'Tame a companion (random unit) →',
          act:()=>{ if(armyHasClass('Beast')){ const pool=activePool().filter(u=>u.cls==='Beast'); if(pool.length&&G.army.length<benchMax()){ const u=clone(pick(pool)); u.gear={weapon:null,armor:null,trinket:null}; u.tier=1; G.army.push(u); toast('🐾 '+u.name+' joins the pack'); checkFusion(); } else evGrantUnit(); } else evGrantUnit(); }},
         {label:'Ask for guidance (+3 Lore, +20 gold) →',act:()=>{ G.lore+=3; G.gold+=20; toast('+3 Lore, +20 gold'); }}]},

  {title:'Mercenary Camp',text:'A band of sellswords will fight for coin — or sell you their finest blade.',
   opts:[{label:'Hire a veteran (−50 gold, Rare-tier unit) →',act:()=>{ if(G.gold<50){toast('Not enough gold');return;} G.gold-=50; evGrantUnit('Rare'); }},
         {label:'Buy their armory (Equipment + 1 Essence) →',act:()=>{ evGrantEquip(false); G.essence=(G.essence||0)+1; toast('🔮 +1 Essence and gear'); }},
         {label:'Recruit a free hand (random unit) →',act:()=>{ evGrantUnit(); }}]},

  {title:'Wayside Altar',text:'Sigils glow on a mossy altar — each blesses your next battle differently.',
   opts:[{label:()=>{const m=eventModOf('Buff');return m.ico+' '+m.name+' — '+m.desc;}, act:()=>{ setEventMod(eventModOf('Buff')); }},
         {label:()=>{const m=eventModOf('Gamble');return m.ico+' '+m.name+' (gamble) — '+m.desc;}, act:()=>{ setEventMod(eventModOf('Gamble')); }},
         {label:'Leave the altar untouched →', act:()=>{toast('You bow and move on');}}]},

  {title:'Devil’s Wager',text:'A horned merchant grins. “Coin now — you settle the price in the next fight.”',
   opts:[{label:'Take the gold (+70), accept a curse →',act:()=>{ G.gold+=70; setEventMod(eventModOf('Debuff')); }},
         {label:'Take Essence (+2), accept a curse →',act:()=>{ G.essence=(G.essence||0)+2; setEventMod(eventModOf('Debuff')); }},
         {label:'Refuse the bargain →',act:()=>{toast('You decline the merchant');}}]},

  {title:'Witch’s Gambit',text:'A hedge-witch offers a potion of pure chance for your next battle.',
   opts:[{label:()=>{const m=eventModOf('Gamble');return '🧪 '+m.name+' — '+m.desc;}, act:()=>{ setEventMod(eventModOf('Gamble')); }},
         {label:'Trade it for a safe boon instead →',act:()=>{ setEventMod(eventModOf('Buff')); }},
         {label:'Pour it out (+3 Lore) →',act:()=>{ G.lore+=3; toast('+3 Lore'); }}]},
];
export function showEvent(){
  // Draw without repeats within an act (GDD §21); respect act-gates and faction availability.
  G._seenEvents=G._seenEvents||[];
  let pool=EVENTS.filter(e=>{
    if(e.actGate && G.act < e.actGate) return false;                 // too early in the run
    if(e.factionGate && !factionChoices(1).length) return false;     // no faction left to offer
    return !G._seenEvents.includes(e.title);
  });
  if(!pool.length){ G._seenEvents=[]; pool=EVENTS.filter(e=>!(e.actGate&&G.act<e.actGate)&&!(e.factionGate&&!factionChoices(1).length)); }
  if(!pool.length) pool=EVENTS;                                       // ultimate fallback
  const ev=pick(pool); G._event=ev; G._seenEvents.push(ev.title);
  let html=`<div class="panel center"><div class="lbl">❓ ${ev.title}</div>
    <p class="tip" style="margin:14px auto;max-width:520px;font-size:14px">${ev.text}</p>
    <div class="row" style="justify-content:center;flex-wrap:wrap">`;
  ev.opts.forEach((o,i)=>{const lbl=(typeof o.label==='function')?o.label():o.label; html+=`<button onclick="eventChoice(${i})">${lbl}</button>`;});
  html+=`</div></div>`;
  SC.innerHTML=html;
}
export function eventChoice(i){ const r=G._event.opts[i].act(); if(r!==false) advanceRow(); }

