// @ts-nocheck
import { FACTIONS } from "./data-units.js";
import { simTick } from "./engine-combat.js";

/* ---------- ENEMY FACTIONS (9, three per act) ----------
   Each enemy unit: EU(name,cls,type,rng,hp,dmg,as,mv,ico,ultObj|null)
   Bosses are defined per act-III faction (and reused thematically for earlier boss nodes). */
// ab: optional {passive, tip} bag — passive is structured mechanical data (merged onto the
// live unit by applyUnitAbility in engine-combat.js), tip is the human-readable flavor line
// shown in tooltips (see abilityFor() in ui-tooltips.js).
export function EU(name,cls,t,rng,hp,dmg,as,mv,ico,ult,ab){return {name,faction:'__enemy',cls,t,rng,hp,dmg,as,mv,ico,ult:ult||{k:'none',name:'—'},passive:ab&&ab.passive,tip:ab&&ab.tip};}
export const ENEMY_FACTIONS={
  // ---- ACT I ----
  'Brigand Host':{ico:'🏴',col:'#8a6d3b',units:[
    EU('Cutthroat','Rogue','m',1,360,38,1.15,1.3,'🔪',{k:"blink",name:"Backstab"},{passive:{"crit":0.15},tip:"Opportunist: +15% crit chance."}),
    EU('Brigand','Warrior','m',1,460,40,.9,1.2,'🪓',{k:"berserk",v:0.5,d:0.3,name:"Bloodlust"},{passive:{"lifesteal":0.1},tip:"Plunderer: lifesteal 10% of damage dealt."}),
    EU('Bandit Archer','Archer','r',4,300,44,.95,1.2,'🏹',{k:"beam",v:1.4,name:"Pinning Volley"},{passive:{"bleed":true},tip:"Barbed Arrows: attacks apply bleed."}),
    EU('Thug','Warrior','m',1,540,46,.85,1.1,'👊',{k:"quake",v:1.1,name:"Brutal Smash"},{passive:{"dr":0.06},tip:"Brawler: +12% armor while adjacent to 2+ allies."}),
    EU('Highwayman','Rogue','m',1,400,50,1.2,1.4,'🐴',{k:"drain",v:1.8,name:"Cutpurse"},{passive:{"_vs":{"wounded":1.2}},tip:"Cutthroat: +20% damage vs wounded (<50% HP)."}),
  ]},
  'Wildwood Pack':{ico:'🐺',col:'#5b7b3a',units:[
    EU('Dire Wolf','Beast','m',1,420,46,1.25,1.7,'🐺',{k:"berserk",v:0.45,d:0.25,name:"Frenzy"},{passive:{"_auraAS":0.08},tip:"Pack Hunter: nearby allies +8% attack speed."}),
    EU('Boar','Beast','m',1,620,42,.8,1.3,'🐗',{k:"banish",name:"Gore Toss"},{passive:{"reflect":0.2},tip:"Bristled: attackers take 20% reflected damage."}),
    EU('Treant Sapling','Guardian','m',1,820,34,.6,0.8,'🌲',{k:"bulwark",v:100,r:2,name:"Bark Ward"},{passive:{"_regenIdle":0.02},tip:"Rooted: regenerates 2% max HP/sec while stationary."}),
    EU('Spitting Viper','Beast','r',3,260,40,1.3,1.9,'🐍',{k:"curse",name:"Venom Spray"},{passive:{"spore":true},tip:"Venomous: attacks apply poison."}),
    EU('Pack Alpha','Beast','m',1,540,54,1.1,1.6,'🐾',{k:"rally",v:0.6,name:"Howl"},{passive:{"_auraAS":0.08},tip:"Alpha: nearby allies +8% attack speed."}),
  ]},
  'Bog Cult':{ico:'🐸',col:'#4a6b54',units:[
    EU('Cultist','Mage','r',3,320,48,.9,1.1,'🕯️',{k:"curse",name:"Hex"},{passive:{"spore":true},tip:"Plague-Touched: attacks apply poison."}),
    EU('Bog Lurker','Rogue','m',1,420,44,1.1,1.2,'🐍',{k:"drain",v:1.6,name:"Leech"},{passive:{"crit":0.15},tip:"Ambusher: +15% crit chance."}),
    EU('Toad Brute','Guardian','m',1,760,40,.7,0.9,'🐸',{k:"quake",v:1.2,name:"Belly Flop"},{passive:{"reflect":0.2},tip:"Warty Hide: attackers take 20% reflected damage."}),
    EU('Mire Priest','Cleric','r',3,420,30,.8,1.0,'🔮',{k:"heal",v:100,name:"Foul Mend"},{passive:{"_periodicHeal":{"amt":80,"range":3,"every":4}},tip:"Foul Grace: heals lowest-HP ally for 80 every 4s."}),
    EU('Swamp Hag','Mage','r',4,360,58,.85,1.0,'🧙',{k:"zone",v:1.2,r:2,name:"Quagmire"},{passive:{"slow":true},tip:"Mire: attacks apply slow."}),
  ]},
  // ---- ACT II ----
  'Iron Legion':{ico:'🤖',col:'#7a7f88',units:[
    EU('Sentinel Automaton','Warrior','m',1,750,56,.85,1.0,'🤖',{k:"bulwark",v:100,r:2,name:"Bulwark Protocol"},{passive:{"aegis":0.05,"aegisCap":0.25},tip:"Plating: converts 5% of damage taken into armor (aegis)."}),
    EU('Rust Pikebot','Warrior','m',1,700,50,.9,1.0,'🔩',{k:"beam",v:1.3,name:"Pike Lunge"},{passive:{"dr":0.06,"_condArmor":{"adjFaction":{"fac":"__enemy","amt":0.12}}},tip:"Phalanx: +12% armor while adjacent to another ally."}),
    EU('Siege Engine','Archer','r',5,550,92,.55,0.8,'🎯',{k:"zone",v:1.8,r:2,name:"Bombardment"},{passive:{"armorPierce":0.1},tip:"Siege Protocol: attacks ignore 20% of target armor."}),
    EU('Iron Praetor','Warrior','m',1,860,68,.9,1.0,'⚙️',{k:"rally",v:0.5,name:"Reactivate"},{passive:{"_auraAllyDmg":0.1},tip:"Command Aura: nearby allies +10% damage."}),
    EU('Cogsmith Drone','Mage','r',4,480,64,.8,0.9,'🔧',{k:"beam",v:1.6,name:"Mortar Servo"},{passive:{"_periodicHeal":{"amt":90,"range":3,"every":4},"_periodicShield":{"amt":50,"range":3,"every":5}},tip:"Field Repair: shields the nearest ally for 50 every 5s."}),
  ]},
  'Frostbound Clan':{ico:'🧊',col:'#6fa8c7',units:[
    EU('Frost Raider','Warrior','m',1,620,54,.95,1.2,'🪓',{k:"berserk",v:0.5,d:0.3,name:"Coldblood Fury"},{passive:{"_dmgAboveHP":{"amt":0.2,"thr":0.6}},tip:"Coldblood: +20% damage while above 60% HP."}),
    EU('Ice Shaman','Mage','r',4,600,60,.85,1.0,'❄️',{k:"freeze",v:1.5,r:1,name:"Frost Nova"},{passive:{"slow":true},tip:"Rime: attacks apply slow."}),
    EU('Tundra Bear','Beast','m',1,980,60,.75,1.1,'🐻‍❄️',{k:"quake",v:1.5,name:"Maul"},{passive:{"reflect":0.2},tip:"Hibernal Hide: attackers take 20% reflected damage."}),
    EU('Snow Stalker','Rogue','m',1,520,58,1.2,1.4,'🐆',{k:"execute",v:0.3,name:"Frozen Strike"},{passive:{"_vs":{"frozen":1.25}},tip:"Frostblade: +25% damage vs frozen."}),
    EU('Frost Giant','Guardian','m',1,1320,82,.6,0.9,'🗿',{k:"freeze",v:1.6,r:2,name:"Avalanche"},{passive:{"ccImmune":true},tip:"Immovable: cannot be knocked back."}),
  ]},
  'Emberforge Syndicate':{ico:'🌋',col:'#c0562b',units:[
    EU('Flame Cannon','Archer','r',5,680,60,.55,0.8,'💥',{k:"doubleaxe",v:2.0,n:4,name:"Grapeshot"},{passive:{"burn":1,"burnDur":2},tip:"Incendiary: attacks apply burn."}),
    EU('Forge Guard','Guardian','m',1,1000,58,.7,0.9,'🛡️',{k:"bulwark",v:260,r:2,name:"Molten Guard"},{passive:{"reflect":0.25},tip:"Molten Skin: attackers take 25% reflected damage."}),
    EU('Pyrolancer','Warrior','m',1,640,66,.95,1.2,'🔥',{k:"beam",v:1.6,name:"Ignite Charge"},{passive:{"burn":1,"burnDur":2},tip:"Searing: attacks apply burn."}),
    EU('Magma Adept','Mage','r',4,600,65,.85,1.0,'🌋',{k:"zone",v:2,r:2,name:"Eruption"},{passive:{"_auraMagicResist":0.08},tip:"Heat Haze: nearby allies take -8% magic damage (ward field)."}),
    EU('Cinder Sprite','Beast','m',1,360,50,1.3,1.6,'✨',{k:"blink",name:"Cinder Dash"},{passive:{"burn":1,"burnDur":2},tip:"Ember Trail: attacks apply burn."}),
  ]},
  // ---- ACT III ----
  'Void Choir':{ico:'🐙',col:'#6a4d8c',units:[
    EU('Deep Cultist','Mage','r',4,460,76,.85,1.0,'📖',{k:"curse",name:"Unmake"},{passive:{"_vs":{"wounded":1.2}},tip:"Eldritch: +20% damage vs wounded (<50% HP)."}),
    EU('Tide Spawn','Warrior','m',1,820,70,.9,1.1,'🦑',{k:"drain",v:1.7,name:"Engulf"},{passive:{"lifesteal":0.1},tip:"Engulfing: lifesteal 10% of damage dealt."}),
    EU('Star Seer','Mage','r',5,420,68,.9,1.0,'👁️',{k:"charm",name:"Maddening Gaze"},{passive:{"slow":true},tip:"Maddening: attacks apply slow."}),
    EU('Reef Priest','Cleric','r',3,520,40,.8,1.0,'🔱',{k:"heal",v:240,name:"Abyssal Mend"},{passive:{"_periodicHeal":{"amt":90,"range":3,"every":4}},tip:"Deep Grace: heals lowest-HP ally for 90 every 4s."}),
    EU('Tentacle Horror','Beast','m',1,720,72,1.1,1.4,'🐙',{k:"banish",name:"Drag Under"},{passive:{"_healOnEnemyDeath":0.05},tip:"Devourer: heals 5% max HP whenever a nearby enemy dies."}),
  ]},
  'Stormhalla':{ico:'⚡',col:'#d8b13a',units:[
    EU('Valkyrie','Beast','r',4,560,72,1.0,1.8,'🪽',{k:"blink",name:"Diving Strike"},{passive:{"crit":0.15},tip:"Winged: +15% crit chance."}),
    EU('Thunder Lord','Mage','r',4,520,84,.9,1.1,'⚡',{k:"chain",v:2,j:4,name:"Chain Lightning"},{passive:{"chargeMul":1.2},tip:"Imbued: ultimate charges 20% faster."}),
    EU('Storm Cavalry','Warrior','m',1,760,68,1.0,1.7,'🐎',{k:"rally",v:0.5,name:"Charge"},{passive:{"_dmgAboveHP":{"amt":0.2,"thr":0.6}},tip:"Charge: +20% damage while above 60% HP."}),
    EU('Sky Warden','Guardian','m',1,1080,64,.7,1.0,'🛡️',{k:"bulwark",v:300,r:2,name:"Storm Ward"},{passive:{"aegis":0.12,"aegisCap":0.25},tip:"Aegis: converts 12% of damage taken into armor."}),
    EU('Tempest Rider','Beast','m',1,620,66,1.2,1.8,'🌩️',{k:"blink",name:"Sky Dive"},{passive:{"_auraAS":0.08},tip:"Tailwind: nearby allies +8% attack speed."}),
  ]},
  'Dread Dominion':{ico:'👑',col:'#9e2b25',units:[
    EU('Tyrant Guard','Guardian','m',1,1200,80,.7,0.9,'🛡️',{k:"bulwark",v:240,r:2,name:"Iron Will"},{passive:{"ccImmune":true},tip:"Unbreakable: cannot be knocked back."}),
    EU('Dominion Mage','Mage','r',5,720,96,.8,1.0,'🔮',{k:"beam",v:2.4,name:"Doom Bolt"},{passive:{"chargeMul":1.2},tip:"Dread Focus: ultimate charges 20% faster."}),
    EU('Death Knight','Warrior','m',1,940,82,.9,1.1,'☠️',{k:"execute",v:0.3,name:"Reaper Strike"},{passive:{"_vs":{"wounded":1.25}},tip:"Dread Blade: +25% damage vs wounded (<50% HP)."}),
    EU('Soul Reaver','Rogue','m',1,680,76,1.2,1.4,'🗡️',{k:"drain",v:2,name:"Harvest"},{passive:{"_healOnEnemyDeath":0.05},tip:"Soul Harvest: heals 5% max HP whenever a nearby enemy dies."}),
    EU('Royal Cleric','Cleric','r',3,680,44,.8,1.0,'✝️',{k:"heal",v:200,name:"Royal Mend"},{passive:{"_periodicHeal":{"amt":90,"range":3,"every":4}},tip:"Royal Grace: heals lowest-HP ally for 90 every 4s."}),
  ]},
};
// Elite enemies: two per faction, stronger than normal units but weaker than bosses.
// One is chosen at random and added to an Elite battle's army (rendered larger, back-row).
export const ELITES={
  'Brigand Host':[
    EU('Brigand Captain','Warrior','m',1,820,84,1.0,1.1,'🗡️',{k:'berserk',v:0.5,d:0.35,name:'Warcry'},{passive:{"_auraAllyDmg":0.1},tip:"Warlord: nearby allies +10% damage."}),
    EU('Master Outlaw','Rogue','r',3,640,96,1.1,1.2,'🏹',{k:"doubleaxe",v:1.0,n:6,name:"Fusillade"},{passive:{"crit":0.2},tip:"Deadeye: +20% crit chance."}),
  ],
  'Wildwood Pack':[
    EU('Dire Alpha','Beast','m',1,900,90,1.15,1.7,'🐺',{k:'berserk',v:0.55,d:0.3,name:'Blood Frenzy'},{passive:{"_auraAS":0.08},tip:"Apex Predator: nearby allies +8% attack speed."}),
    EU('Elder Treant','Guardian','m',1,1500,76,0.6,0.7,'🌳',{k:'bulwark',v:220,r:2,name:'Grovekeeper'},{passive:{"reflect":0.25},tip:"Ancient Bark: attackers take 25% reflected damage."}),
  ],
  'Bog Cult':[
    EU('Plague Matron','Mage','r',4,760,92,0.9,1.0,'🧫',{k:'zone',v:1.8,r:2,name:'Pestilence'},{passive:{"spore":true},tip:"Contagion: attacks apply poison."}),
    EU('Bog Horror','Guardian','m',1,1300,82,0.7,0.9,'🐊',{k:'drain',v:2.0,name:'Devour'},{passive:{"_healOnEnemyDeath":0.05},tip:"Gluttonous: heals 5% max HP whenever a nearby enemy dies."}),
  ],
  'Iron Legion':[
    EU('Praetorian Colossus','Guardian','m',1,1600,88,0.7,0.8,'🛡️',{k:'bulwark',v:380,r:2,name:'Aegis Field'},{passive:{"ccImmune":true},tip:"Immovable: cannot be knocked back."}),
    EU('Siege Walker','Archer','r',5,900,120,0.6,0.7,'🎯',{k:'zone',v:2.2,r:2,name:'Siege Barrage'},{passive:{"armorPierce":0.1},tip:"Siege Protocol: attacks ignore 20% of target armor."}),
  ],
  'Frostbound Clan':[
    EU('Glacier Warlord','Guardian','m',1,1550,98,0.75,0.85,'🧊',{k:'freeze',v:1.8,r:2,name:'Permafrost'},{passive:{"slow":true},tip:"Permafrost: attacks apply slow."}),
    EU('Blizzard Shaman','Mage','r',5,820,104,0.85,1.0,'🌨️',{k:'zone',v:2.0,r:2,name:'Whiteout'},{passive:{"slow":true},tip:"Whiteout: attacks apply slow."}),
  ],
  'Emberforge Syndicate':[
    EU('Forge Tyrant','Warrior','m',1,1200,108,0.95,1.0,'🔥',{k:'beam',v:2.0,name:'Magma Lance'},{passive:{"burn":1,"burnDur":2},tip:"Molten Core: attacks apply burn."}),
    EU('Artillery Master','Archer','r',6,820,140,0.55,0.7,'💥',{k:'zone',v:2.6,r:2,name:'Mortar Storm'},{passive:{"burn":1,"burnDur":2},tip:"Incendiary Shells: attacks apply burn."}),
  ],
  'Void Choir':[
    EU('Void Prophet','Mage','r',5,920,114,0.9,1.0,'👁️',{k:'curse',name:'Unspeakable Truth'},{passive:{"_auraMagicResist":0.08},tip:"Maddening Aura: nearby allies take -8% magic damage (ward field)."}),
    EU('Abyssal Behemoth','Guardian','m',1,1700,100,0.8,0.9,'🦑',{k:'drain',v:2.2,name:'Consume'},{passive:{"lifesteal":0.12},tip:"Voracious: lifesteal 12% of damage dealt."}),
  ],
  'Stormhalla':[
    EU('Valkyrie Champion','Beast','r',3,1000,118,1.2,1.6,'⚡',{k:'chain',v:2.2,j:5,name:'Tempest Call'},{passive:{"chargeMul":1.2},tip:"Storm-Charged: ultimate charges 20% faster."}),
    EU('Storm Jarl','Warrior','m',1,1250,110,1.0,1.3,'🌩️',{k:'blink',name:'Thunderclap Dive'},{passive:{"_auraAS":0.08},tip:"Gale Force: nearby allies +8% attack speed."}),
  ],
  'Dread Dominion':[
    EU('Drake Knight','Warrior','m',1,1400,124,1.0,1.1,'🐉',{k:'execute',v:0.35,name:'Wyrmslayer'},{passive:{"aegis":0.12,"aegisCap":0.25},tip:"Dragonscale: converts 12% of damage taken into armor (aegis)."}),
    EU('Dominion Archon','Mage','r',5,1050,132,0.9,1.0,'🔮',{k:'beam',v:2.6,name:'Annihilate'},{passive:{"chargeMul":1.2},tip:"Dread Focus: ultimate charges 20% faster."}),
  ],
};
export const ACT_ENEMIES={1:['Brigand Host','Wildwood Pack','Bog Cult'],
                   2:['Iron Legion','Frostbound Clan','Emberforge Syndicate'],
                   3:['Void Choir','Stormhalla','Dread Dominion']};
// Enemy faction synergies — each enemy army gets its signature theme (GDD §14), so factions
// play differently and aren't just stat-blocks. Applied to the whole enemy army at battle start,
// scaled by how many of the army share the theme (n = army size, always cohesive).
export const ENEMY_SYN={
  'Brigand Host':(E,n)=>{ E.forEach(u=>{u._plunder=0.04; u._plunderMax=0.6;}); },        // Plunder: +dmg per kill (wired below)
  'Wildwood Pack':(E,n)=>{ const as=n>=4?1.18:1.10; E.forEach(u=>{u.as*=as; if(u.t==='r'||u.cls==='Beast')u.target='backline';}); }, // pack speed + dive backline
  'Bog Cult':(E,n)=>{ E.forEach(u=>{u.spore=true;}); },                                    // poison clouds on hit (reuses spore)
  'Iron Legion':(E,n)=>{ const dr=n>=4?0.12:0.10; E.forEach(u=>{u.dr=(u.dr||0)+dr;}); },   // shared armor wall
  'Frostbound Clan':(E,n)=>{ E.forEach(u=>{u.slow=true; u.deepfreeze=true; u.freezeAt=5;}); }, // stacking slow→freeze (reuses Tidecaller mechanic)
  'Emberforge Syndicate':(E,n)=>{ E.forEach(u=>{u.burn=1.0; u.burnDur=2.5; if(u.t==='r')u.dmg=Math.round(u.dmg*1.12);}); }, // burn + artillery (reuses Emberkin)
  'Void Choir':(E,n)=>{ E.forEach(u=>{u.lifesteal=(u.lifesteal||0)+0.15; u._killEmpower=0.05;}); }, // lifesteal + empower on kill
  'Stormhalla':(E,n)=>{ const as=n>=4?1.15:1.08; E.forEach(u=>{u.as*=as; u.mv*=1.12; u.lightning=true;}); }, // speed + chain lightning (reuses Stormherd)
  'Dread Dominion':(E,n)=>{ E.forEach(u=>{u.hp=Math.round(u.hp*1.12); u.dmg=Math.round(u.dmg*1.12); u._killEmpower=0.04;}); }, // overwhelming stats + empower
};
// named bosses keyed loosely to act
// Named bosses — one per enemy faction (GDD §14). Keyed by faction name.
// mech: a signature mechanic id resolved in simTick; foot: hex footprint (visual scale).
export const BOSSES={
  // ---- ACT I ----
  'Brigand Host':{name:'Balor the Black Brand',ico:'🪓',cls:'Warrior',hp:1500,dmg:80,as:.9,foot:2,
    ult:{k:'nova',v:2.0,r:2,name:'Cleaving Roar'},mech:'plunder',
    desc:'Plunder: grows stronger with every kill his host scores.'},
  'Wildwood Pack':{name:'Old Gnashroot',ico:'🐺',cls:'Beast',hp:1650,dmg:74,as:1.0,foot:2,
    ult:{k:'nova',v:1.8,r:1,name:'Feral Howl'},mech:'summon',
    desc:'Summons a wolf pack at 50% HP.'},
  'Bog Cult':{name:'Mother Mireveil',ico:'🧪',cls:'Mage',hp:1400,dmg:70,as:.85,foot:2,
    ult:{k:'nova',v:2.2,r:2,name:'Pox Cloud'},mech:'plague',
    desc:'Below 50% HP, doubles all poison on the field.'},
  // ---- ACT II ----
  'Iron Legion':{name:'Colossus Prime, the Dormant Warlord',ico:'🤖',cls:'Guardian',hp:2600,dmg:96,as:.75,foot:2,
    ult:{k:'shield',v:400,name:'Aegis Protocol'},mech:'legionrevive',
    desc:'At 50% HP, reactivates every fallen automaton once.'},
  'Frostbound Clan':{name:'Jarnvex the Glacier Tyrant',ico:'🧊',cls:'Guardian',hp:2800,dmg:100,as:.7,foot:3,
    ult:{k:'freeze',v:2.0,r:2,name:'Glacial Cataclysm'},mech:'boardfreeze',
    desc:'Freezes the whole board at 60% and 30% HP.'},
  'Emberforge Syndicate':{name:'Forgelord Durn Brassheart',ico:'🌋',cls:'Mage',hp:2400,dmg:108,as:.85,foot:2,
    ult:{k:'nova',v:2.6,r:2,name:'Mortar Barrage'},mech:'barrage',
    desc:'Rains mortars on your densest cluster; fights with cannon emplacements.'},
  // ---- ACT III ----
  'Void Choir':{name:"X'thuul, the Sleeping Deep",ico:'🐙',cls:'Mage',hp:3200,dmg:112,as:.9,foot:2,
    ult:{k:'execute',v:.4,name:'Devour'},mech:'devour',
    desc:'At 50% HP, devours a player unit to heal fully.'},
  'Stormhalla':{name:'Valdris Stormcrowned',ico:'⚡',cls:'Beast',hp:3000,dmg:118,as:1.05,foot:2,
    ult:{k:'nova',v:2.4,r:2,name:'Chain Tempest'},mech:'stormcall',
    desc:'Summons board-wide chain-lightning storms; flies over your front line.'},
  'Dread Dominion':{name:'Vorkagar the World-Ender',ico:'🐲',cls:'Warrior',hp:4000,dmg:128,as:.9,foot:3,
    ult:{k:'quake',v:2.8,r:2,name:'Annihilation'},mech:'worldender',
    desc:'A multi-phase elder dragon flanked by Drake Lieutenants; full-board fire breath.'},
};

