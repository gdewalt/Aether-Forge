// @ts-nocheck
import { G } from "./engine-hex.js";
import { POOL, STARTER_FACTIONS, ascCostMult, upgTier } from "./data-units.js";
import { RNG, pick } from "./rng.js";
import { benchMax, checkFusion, recruit, unitTier } from "./ui-shop.js";
import { clone } from "./flow-forge.js";
import { mkLive } from "./ui-planning.js";
import { toast } from "./ui-tooltips.js";

/* ============================================================
   RELICS (run-long, army-wide) & EQUIPMENT (unit-attached, movable)
   Each relic/equipment has an `apply` hook.
   - relic.apply(units, G)  runs once on a combat side's units (player only) after synergies
   - relic.eco(G)           optional: economy hook on pickup / per battle
   - equip.apply(u)         runs on the wearer when its live combat object is built
   ============================================================ */
export const RELICS=[
  // ---- Static ----
  {id:'banner',name:'Banner of the Vanguard',fam:'Static',ico:'🚩',rar:'Rare',
   desc:'+1 Army Cap.',onPick:(G)=>{G.cap+=1;}},
  {id:'whetstone',name:'Eternal Whetstone',fam:'Static',ico:'🗡️',rar:'Common',
   desc:'All units +12% damage.',apply:(us)=>us.forEach(u=>u.dmg*=1.12)},
  {id:'aegisplate',name:'Aegis Plating',fam:'Static',ico:'🛡️',rar:'Common',
   desc:'All units +8% damage reduction.',apply:(us)=>us.forEach(u=>u.dr=Math.min(.85,(u.dr||0)+.08))},
  {id:'warhorn',name:'Warhorn of Haste',fam:'Static',ico:'📯',rar:'Uncommon',
   desc:'All units +12% attack speed.',apply:(us)=>us.forEach(u=>u.as*=1.12)},
  {id:'vitalroot',name:'Vital Root',fam:'Static',ico:'🌰',rar:'Common',
   desc:'All units +15% max HP.',apply:(us)=>us.forEach(u=>{u.hp*=1.15;u.maxhp=u.hp;})},
  // ---- Synergy ----
  {id:'crimson',name:'Crimson Pact',fam:'Synergy',ico:'🩸',rar:'Rare',
   desc:'Bleed gains +2 max stacks and ticks 60% harder.',apply:(us)=>us.forEach(u=>{u.bleedBonus=2;u.bleedDotMul=1.6;})},
  {id:'everburn',name:'Everburning Coal',fam:'Synergy',ico:'🔥',rar:'Rare',
   desc:'Burns deal +60% damage and last longer.',apply:(us)=>us.forEach(u=>{if(u.burn)u.burn*=1.6;u.burnDur=3.2;})},
  {id:'deepfrost',name:'Deepfreeze Sigil',fam:'Synergy',ico:'❄️',rar:'Rare',
   desc:'Frost reaches freeze at 3 slow stacks instead of 4.',apply:(us)=>us.forEach(u=>{if(u.slow)u.freezeAt=3;})},
  {id:'starcharge',name:'Astral Conductor',fam:'Synergy',ico:'✨',rar:'Rare',
   desc:'All units start battle with 25% magic charge.',apply:(us)=>us.forEach(u=>u.mag=Math.max(u.mag,25))},
  // ---- Class ----
  {id:'quiver',name:"Hunter's Quiver",fam:'Class',ico:'🏹',rar:'Uncommon',
   desc:'Archers ignore 20% of target armor.',apply:(us)=>us.forEach(u=>{if(u.cls==='Archer')u.armorPierce=(u.armorPierce||0)+.20;})},
  {id:'shadowstep',name:'Shadowstep Cloak',fam:'Class',ico:'🌑',rar:'Rare',
   desc:'Rogues begin each battle behind the enemy line.',apply:(us)=>us.forEach(u=>{if(u.cls==='Rogue')u.infiltrate=true;})},
  {id:'gricharm',name:'Grimoire Charm',fam:'Class',ico:'📖',rar:'Uncommon',
   desc:'Mages: ultimates deal +25%.',apply:(us)=>us.forEach(u=>{if(u.cls==='Mage')u.ultMul=(u.ultMul||1)*1.25;})},
  {id:'chalice',name:'Chalice of Mercy',fam:'Class',ico:'🍶',rar:'Uncommon',
   desc:'Clerics heal +30%.',apply:(us)=>us.forEach(u=>{if(u.cls==='Cleric')u.healMul=(u.healMul||1)*1.30;})},
  // ---- Economy ----
  {id:'coinpurse',name:"Merchant's Seal",fam:'Economy',ico:'🪙',rar:'Common',
   desc:'+25 gold after every battle.',battleGold:25},
  {id:'duplodie',name:'Duplicator Die',fam:'Economy',ico:'🎲',rar:'Rare',
   desc:'After each battle, 35% chance to copy a random owned unit.',postBattle:(G)=>{if(RNG()<0.35&&G.army.length<benchMax()){const c=clone(pick(G.army));c.gear={weapon:null,armor:null,trinket:null};c.tier=c.tier||1;G.army.push(c);toast('🎲 Duplicator copied '+c.name);checkFusion();}}},
  {id:'scryingorb',name:'Scrying Orb',fam:'Economy',ico:'🔮',rar:'Uncommon',
   desc:'Reveals the enemy army and its exact positions during planning, so you can counter-place.',scry:true},
  // ---- Game-Changers (Legendary) ----
  {id:'phoenixcrown',name:'Phoenix Crown',fam:'Game-Changer',ico:'👑',rar:'Legendary',
   desc:'First ally to die each battle revives at full HP with +30% stats.',apply:(us)=>{us.forEach(u=>u._reviveEligible=true);},gc:true},
  {id:'resonance',name:'Hivemind Resonance',fam:'Game-Changer',ico:'🧠',rar:'Legendary',
   desc:'Every unit counts as +1 toward all its synergies.',synBonus:1,gc:true},
  {id:'hourglass',name:'Time-Worn Hourglass',fam:'Game-Changer',ico:'⏳',rar:'Legendary',
   desc:'Ultimate charge +60%, but max HP -20%.',apply:(us)=>us.forEach(u=>{u.chargeMul=(u.chargeMul||1)*1.6;u.hp*=.8;u.maxhp=u.hp;}),gc:true},
  {id:'ruin',name:'Pact of Ruin',fam:'Game-Changer',ico:'💀',rar:'Legendary',
   desc:'All units +40% damage, but cannot be healed.',apply:(us)=>us.forEach(u=>{u.dmg*=1.4;u.noHeal=true;}),gc:true},
  // ---- Added Static ----
  {id:'ironbark',name:'Ironbark Charm',fam:'Static',ico:'🪵',rar:'Common',
   desc:'All units +8% damage reduction.',apply:(us)=>us.forEach(u=>u.dr=(u.dr||0)+0.08)},
  {id:'bloodidol',name:'Bloodbound Idol',fam:'Static',ico:'🩸',rar:'Uncommon',
   desc:'All units gain 10% lifesteal.',apply:(us)=>us.forEach(u=>u.lifesteal=(u.lifesteal||0)+0.10)},
  {id:'sentinel',name:"Sentinel's Aegis",fam:'Static',ico:'🛡️',rar:'Uncommon',
   desc:'Front-row units take -15% damage.',apply:(us)=>us.forEach(u=>{if(u.c!=null&&u.c<=1)u._frontWard=0.15;})},
  {id:'farseeker',name:'Farseeker Lens',fam:'Static',ico:'🔭',rar:'Uncommon',
   desc:'Ranged units gain +1 range and +10% damage.',apply:(us)=>us.forEach(u=>{if(u.t==='r'){u.rng=(u.rng||0)+1;u.dmg*=1.10;}})},
  // ---- Added Synergy ----
  {id:'standard',name:'Faction Standard',fam:'Synergy',ico:'🚩',rar:'Rare',
   desc:'All faction synergy breakpoints trigger one unit earlier.',synBonus:1},
  // ---- Added Class ----
  {id:'warlord',name:"Warlord's Crest",fam:'Class',ico:'⚔️',rar:'Uncommon',
   desc:'Warriors deal +12% damage.',apply:(us)=>us.forEach(u=>{if(u.cls==='Warrior')u.dmg*=1.12;})},
  {id:'bulwarkbanner',name:'Bulwark Banner',fam:'Class',ico:'🚩',rar:'Uncommon',
   desc:'Guardians gain +20% max HP and +6% damage reduction.',apply:(us)=>us.forEach(u=>{if(u.cls==='Guardian'){u.hp*=1.20;u.maxhp=u.hp;u.dr=(u.dr||0)+0.06;}})},
  // ---- Added Economy ----
  {id:'spoils',name:'Spoils Pouch',fam:'Economy',ico:'💰',rar:'Common',
   desc:'+50% gold from battles.',goldMult:1.5},
  {id:'whistle',name:"Recruiter's Whistle",fam:'Economy',ico:'📯',rar:'Uncommon',
   desc:'Battle rewards offer 4 unit choices instead of 3.',rewardChoices:4},
  {id:'compass',name:"Trader's Compass",fam:'Economy',ico:'🧭',rar:'Uncommon',
   desc:'One free reroll on every reward and recruitment screen.',freeRerolls:1},
  // ---- Added Game-Changers ----
  {id:'twinsoul',name:'Twin Soul Pendant',fam:'Game-Changer',ico:'☯️',rar:'Legendary',
   desc:'Your highest-tier unit is duplicated (as a token) at battle start.',apply:(us)=>{const real=us.filter(u=>!u.token);if(!real.length)return;const best=real.slice().sort((a,b)=>(unitTier(b)-unitTier(a))||(b.hp-a.hp))[0];const c=mkLive(best,best.side,best.c,best.r);c.token=true;c.tokenLife=999;c._twin=true;us.push(c);},gc:true},
  {id:'conqmap',name:"Conqueror's Map",fam:'Game-Changer',ico:'🗺️',rar:'Legendary',
   desc:'Re-pick your route once per act; bosses drop an extra relic.',onPick:(G)=>{G._routeRepick=(G._routeRepick||0)+1;},gc:true},
  {id:'soulforge',name:'Soulforge Anvil',fam:'Game-Changer',ico:'⚒️',rar:'Legendary',
   desc:'Fusing to Tier 2/3 requires only 2 copies instead of 3.',onPick:(G)=>{G._fuseN=2;checkFusion();},gc:true},
];
export const RELIC_BY_ID={};RELICS.forEach(r=>RELIC_BY_ID[r.id]=r);

export const EQUIPMENT=[
  // ---- Weapons ----
  {id:'w_greatsword',name:'Sunforged Greatsword',slot:'weapon',ico:'⚔️',rar:'Legendary',
   desc:'+45% damage; attacks ignore 30% damage reduction.',apply:(u)=>{u.dmg*=1.45;u.armorPierce=(u.armorPierce||0)+.30;}},
  {id:'w_serrated',name:'Serrated Blade',slot:'weapon',ico:'🗡️',rar:'Uncommon',
   desc:'+25% damage; attacks apply bleed.',apply:(u)=>{u.dmg*=1.25;u.bleed=true;}},
  {id:'w_emberbrand',name:'Emberbrand',slot:'weapon',ico:'🔥',rar:'Uncommon',
   desc:'+15% damage; attacks burn.',apply:(u)=>{u.dmg*=1.15;u.burn=Math.max(u.burn||1,1.2);}},
  {id:'w_swiftbow',name:'Swiftwind Bow',slot:'weapon',ico:'🏹',rar:'Uncommon',
   desc:'+25% attack speed; +1 range.',apply:(u)=>{u.as*=1.25;u.rng+=1;}},
  {id:'w_executioner',name:"Executioner's Axe",slot:'weapon',ico:'🪓',rar:'Rare',
   desc:'+20% damage; +15% crit chance.',apply:(u)=>{u.dmg*=1.2;u.crit=(u.crit||0)+.15;}},
  // ---- Armor ----
  {id:'a_frostward',name:'Frostward Mail',slot:'armor',ico:'🧥',rar:'Uncommon',
   desc:'+30% HP; immune to freeze & slow.',apply:(u)=>{u.hp*=1.3;u.maxhp=u.hp;u.ccImmune=true;}},
  {id:'a_aegis',name:'Aegis of the Bastion',slot:'armor',ico:'🛡️',rar:'Rare',
   desc:'+25% HP; +12% damage reduction.',apply:(u)=>{u.hp*=1.25;u.maxhp=u.hp;u.dr=Math.min(.85,(u.dr||0)+.12);}},
  {id:'a_thorns',name:'Thornmail',slot:'armor',ico:'🌵',rar:'Uncommon',
   desc:'+20% HP; reflects 20% of melee damage taken.',apply:(u)=>{u.hp*=1.2;u.maxhp=u.hp;u.reflect=.2;}},
  {id:'a_phoenix',name:'Phoenix Feather',slot:'armor',ico:'🪶',rar:'Rare',
   desc:'+15% HP; revives once at 40% HP.',apply:(u)=>{u.hp*=1.15;u.maxhp=u.hp;u.selfRevive=.4;}},
  // ---- Trinkets ----
  {id:'t_swiftboots',name:'Swiftboots',slot:'trinket',ico:'👢',rar:'Common',
   desc:'+40% move speed.',apply:(u)=>{u.mv*=1.4;}},
  {id:'t_soulreaver',name:'Soulreaver Pendant',slot:'trinket',ico:'📿',rar:'Rare',
   desc:'Heals self for 25% of damage dealt (lifesteal).',apply:(u)=>{u.lifesteal=(u.lifesteal||0)+.25;}},
  {id:'t_focusgem',name:'Focusing Gem',slot:'trinket',ico:'💎',rar:'Uncommon',
   desc:'Magic bar charges 40% faster.',apply:(u)=>{u.chargeMul=(u.chargeMul||1)*1.4;}},
  {id:'t_warbanner',name:'Crown of Command',slot:'trinket',ico:'👑',rar:'Legendary',
   desc:'Aura: allies within 2 hexes gain +15% damage.',apply:(u)=>{u.auraDmg=.15;}},
  {id:'t_wardstone',name:'Wardstone',slot:'trinket',ico:'🔮',rar:'Common',
   desc:'+10% damage reduction.',apply:(u)=>{u.dr=Math.min(.85,(u.dr||0)+.10);}},

  // ---- Weapons (added) ----
  {id:'w_tideglaive',name:'Tideglaive',slot:'weapon',ico:'🔱',rar:'Uncommon',
   desc:'+18% damage; attacks apply slow.',apply:(u)=>{u.dmg*=1.18;u.slow=true;}},
  {id:'w_venomfang',name:'Venomfang Dagger',slot:'weapon',ico:'🗡️',rar:'Uncommon',
   desc:'+15% damage; attacks apply poison.',apply:(u)=>{u.dmg*=1.15;u.spore=true;}},
  {id:'w_stormpike',name:'Stormpike',slot:'weapon',ico:'⚡',rar:'Rare',
   desc:'+20% damage; attacks chain lightning to a nearby foe.',apply:(u)=>{u.dmg*=1.2;u._chainBolt={frac:0.4};}},
  {id:'w_warhammer',name:'Crushing Maul',slot:'weapon',ico:'🔨',rar:'Common',
   desc:'+30% damage, but −8% attack speed.',apply:(u)=>{u.dmg*=1.3;u.as*=0.92;}},
  {id:'w_reaper',name:'Reaper’s Edge',slot:'weapon',ico:'🌑',rar:'Rare',
   desc:'+18% damage; +30% damage vs targets below 40% HP.',apply:(u)=>{u.dmg*=1.18;u._exec=(u._exec||0)+0.30;}},
  // ---- Armor (added) ----
  {id:'a_plate',name:'Bulwark Plate',slot:'armor',ico:'🛡️',rar:'Common',
   desc:'+22% HP.',apply:(u)=>{u.hp*=1.22;u.maxhp=u.hp;}},
  {id:'a_regen',name:'Verdant Cuirass',slot:'armor',ico:'🌿',rar:'Uncommon',
   desc:'+15% HP; regenerates 2% max HP per second.',apply:(u)=>{u.hp*=1.15;u.maxhp=u.hp;u.regen=(u.regen||0)+0.02;}},
  {id:'a_warding',name:'Warding Robes',slot:'armor',ico:'🧣',rar:'Uncommon',
   desc:'+18% HP; takes −15% magic damage.',apply:(u)=>{u.hp*=1.18;u.maxhp=u.hp;u.magicWard=(u.magicWard||0)+0.15;}},
  {id:'a_juggernaut',name:'Juggernaut Shell',slot:'armor',ico:'🐢',rar:'Rare',
   desc:'+35% HP; cannot be knocked back; −10% move speed.',apply:(u)=>{u.hp*=1.35;u.maxhp=u.hp;u.ccImmune=true;u.mv*=0.9;}},
  // ---- Trinkets (added) ----
  {id:'t_lucky',name:'Lucky Coin',slot:'trinket',ico:'🪙',rar:'Common',
   desc:'+10% crit chance.',apply:(u)=>{u.crit=(u.crit||0)+.10;}},
  {id:'t_battlestandard',name:'Battle Standard',slot:'trinket',ico:'🚩',rar:'Uncommon',
   desc:'Aura: allies within 2 hexes attack 12% faster.',apply:(u)=>{u._auraAS=(u._auraAS||0)+.12;}},
  {id:'t_shadowcloak',name:'Shadowstep Cloak',slot:'trinket',ico:'🥷',rar:'Rare',
   desc:'This unit starts the battle behind the enemy line.',apply:(u)=>{u.infiltrate=true;}},
  {id:'t_runestone',name:'Charged Runestone',slot:'trinket',ico:'🔋',rar:'Uncommon',
   desc:'Starts each battle with 35% magic charge.',apply:(u)=>{u._startMag=Math.max(u._startMag||0,35);}},
  {id:'t_sigil',name:'Sigil of the Bound',slot:'trinket',ico:'🧿',rar:'Legendary',
   desc:'Aura: allies within 2 hexes take −12% damage.',apply:(u)=>{u.auraWard=(u.auraWard||0)+.12;}},
];
export const EQUIP_BY_ID={};EQUIPMENT.forEach(e=>EQUIP_BY_ID[e.id]=e);
export const RAR_COL={Common:'#9aa0a6',Uncommon:'#5bbf6a',Rare:'#4a90c2',Legendary:'#f0d375'};
export const FAM_COL={Static:'#9aa0a6',Synergy:'#e0726b',Class:'#7c9ed4',Economy:'#d9a521','Game-Changer':'#f0d375'};
export function newEquip(id){return {id};}
// ---- unit rarity (derived from a stat budget) & recruit cost ----
export function unitPower(u){
  // rough effective-stat budget: durability + sustained offense + range/utility
  const dps=u.dmg*u.as;
  return u.hp*0.06 + dps*1.0 + (u.t==='r'?u.rng*6:0) + (u.cls==='Cleric'?30:0);
}
// Authored rarity: each faction is ranked by power into a fixed shape — top 1 Legendary,
// next 2 Rare, next 2 Uncommon, the rest Common. For an 8-unit faction that's the intended
// 3 Common / 2 Uncommon / 2 Rare / 1 Legendary; larger factions get extra Commons (filler
// backbone), smaller ones drop a Common. Computed once and cached on each unit as _rar.
export let _rarityAssigned=false;
export function assignRarities(){
  if(_rarityAssigned)return; _rarityAssigned=true;
  const byFac={};
  POOL.forEach(u=>{ (byFac[u.faction]=byFac[u.faction]||[]).push(u); });
  for(const f in byFac){
    const us=byFac[f].slice().sort((a,b)=>unitPower(b)-unitPower(a));   // strongest first
    us.forEach((u,i)=>{
      if(u._rarFixed){ return; }                       // honor any hand-set rarity
      u._rar = i===0 ? 'Legendary'
             : i<=2  ? 'Rare'
             : i<=4  ? 'Uncommon'
             : 'Common';
    });
  }
}
export function unitRarity(u){
  if(u._rar) return u._rar;
  assignRarities();
  if(u._rar) return u._rar;
  // fallback for units outside POOL (tokens, transformed forms): stat-threshold estimate
  const p=unitPower(u);
  return u._rar = p>=135?'Legendary' : p>=115?'Rare' : p>=95?'Uncommon' : 'Common';
}
export const UNIT_COST={Common:20, Uncommon:40, Rare:65, Legendary:100};
export const EQUIP_COST={Common:15, Uncommon:30, Rare:50, Legendary:85};
export function equipCost(e){ return EQUIP_COST[e.rar]; }
export const VICTORY_DISCOUNT=0.75;   // survivors hire on cheap — 25% off shop prices
export function unitCost(u){ return UNIT_COST[unitRarity(u)]; }
export function qmDiscount(){ return 1 - upgTier('qm_shop')*0.08; }   // Quartermaster: Bulk Discounts
export function offerCost(u){ let base=unitCost(u); if(G&&G._recruitMode==='victory')base*=VICTORY_DISCOUNT; return Math.max(1,Math.round(base*ascCostMult()*qmDiscount())); }
export function sellValue(u){ const frac=0.5+upgTier('qm_refund')*0.15; return Math.floor(unitCost(u)*frac); }   // Quartermaster: Fair Trade
export function relicReward(n,allowGC){
  // pick n distinct relics the player doesn't own; bias against GC unless allowed
  const owned=new Set((G.relics||[]).map(r=>r.id));
  let pool=RELICS.filter(r=>!owned.has(r.id) && (allowGC|| !r.gc));
  const out=[];while(out.length<n && pool.length){const r=pick(pool);out.push(r);pool=pool.filter(x=>x.id!==r.id);}
  return out;
}
/* ---------- LEVEL-WEIGHTED RARITY (GDD §23, keyed to player level) ----------
   Low levels see mostly Commons; higher levels unlock progressively stronger offers. */
export function rarityWeights(lv){
  if(lv<=2) return {Common:70,Uncommon:28,Rare:2, Legendary:0};
  if(lv<=4) return {Common:42,Uncommon:39,Rare:17,Legendary:2};
  if(lv<=6) return {Common:26,Uncommon:41,Rare:27,Legendary:6};
  if(lv<=8) return {Common:18,Uncommon:36,Rare:34,Legendary:12};
  return            {Common:10,Uncommon:28,Rare:42,Legendary:20};
}
export const RAR_ORDER=['Legendary','Rare','Uncommon','Common'];
export function rollRarity(levelBonus){
  const lv=(G?G.level:1)+(levelBonus||0);
  const w=rarityWeights(lv);
  let total=0; for(const k in w)total+=w[k];
  let r=RNG()*total;
  for(const k of ['Common','Uncommon','Rare','Legendary']){ r-=w[k]; if(r<0)return k; }
  return 'Common';
}
export function activePool(){
  const act=G.activeFactions||STARTER_FACTIONS;
  const p=POOL.filter(u=>act.includes(u.faction));
  return p.length?p:POOL.filter(u=>u.faction==='Neutral');
}
export function pickUnitByRarity(levelBonus){
  let rar=rollRarity(levelBonus);
  const src=activePool();
  // fall down tiers if a rarity has no units in the active pool
  let idx=RAR_ORDER.indexOf(rar);
  for(let i=idx;i<RAR_ORDER.length;i++){
    const pool=src.filter(u=>unitRarity(u)===RAR_ORDER[i]);
    if(pool.length) return clone(pick(pool));
  }
  return clone(pick(src));
}
export function equipReward(n,levelBonus){
  const out=[]; let pool=EQUIPMENT.slice();
  while(out.length<n && pool.length){
    let rar=rollRarity(levelBonus);
    let idx=RAR_ORDER.indexOf(rar), e=null;
    for(let i=idx;i<RAR_ORDER.length && !e;i++){
      const sub=pool.filter(x=>x.rar===RAR_ORDER[i]);
      if(sub.length)e=pick(sub);
    }
    if(!e)e=pick(pool);
    out.push(e); pool=pool.filter(x=>x.id!==e.id);
  }
  return out;
}

