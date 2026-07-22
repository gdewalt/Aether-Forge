// @ts-nocheck
import { G } from "./engine-hex.js";
import { showMetaStore } from "./flow-battle-end.js";
import { toast } from "./ui-tooltips.js";

/* ---------- factions & class colors ---------- */
export const FCOL={Ironhold:'#8d6e63',Sylvan:'#66bb6a',Gilded:'#ffca28',Leonin:'#f4c542',
            Phoenix:'#ff7043',Gravewardens:'#78909c',Hivemind:'#c0ca33',Stargazers:'#9575cd',
            Arachnari:'#a1887f',Myconid:'#aed581',Grimgear:'#ffb300',Hollow:'#cfd8dc',
            Emberkin:'#e64a19',Tidecallers:'#29b6f6',Stormherd:'#fdd835',Voidtouched:'#7e57c2',Neutral:'#9aa0a6'};
export const CCOL={Warrior:'#c62828',Mage:'#7c4d96',Cleric:'#d9a521',Rogue:'#566573',Archer:'#2e7d32',Guardian:'#6d4c41',Beast:'#9e9d24'};

/* ---------- unit templates ----------
   t:type m=melee r=ranged ; rng range ; ult ultimate def
   rar: authored rarity — 'Common'|'Uncommon'|'Rare'|'Legendary'. Drives how often this unit
   is offered in recruit/shop/reward pools (see rarityWeights() in data-loot.js) and its
   recruit cost (UNIT_COST). Edit this value directly to rebalance a unit's availability.
   ab: optional {passive, tip, art} bag — passive is structured mechanical data (merged onto
   the live unit by applyUnitAbility in engine-combat.js), tip is the human-readable flavor
   line shown in tooltips (see abilityFor() in ui-tooltips.js), art overrides which sprite
   the unit uses (defaults to the unit's name; see artOf() in ui-render-core.js).
*/
export function U(name,faction,cls,t,rng,hp,dmg,as,mv,ico,ult,rar,ab){
  return {name,faction,cls,t,rng,hp,dmg,as,mv,ico,ult,rar,passive:ab&&ab.passive,tip:ab&&ab.tip,art:(ab&&ab.art)||name};
}
// ultimate kinds: nova(aoe), heal, shield, execute, rally(+as), freeze(stun)
export const POOL=[
  // Neutral — starter units, no faction synergy (flexible, well-rounded)
  U('Footman','Neutral','Warrior','m',1,640,50,.85,1.2,'🪖',{k:'shield',v:240,name:'Hunker Down'},'Common',{art:"Footman",passive:{"dr":0.075,"_condArmor":{"adjAllies":{"n":2,"amt":0.15}}},tip:"Bulwark: while adjacent to 2+ allies, gains +15% armor."}),
  U('Archer','Neutral','Archer','r',4,400,58,.95,1.2,'🎯',{k:'nova',v:1.4,r:1,name:'Volley'},'Common',{art:"Archer",passive:{"_nthHit":{"n":4,"amt":0.6}},tip:"Take Aim: every 4th shot deals +60% damage."}),
  U('Spearman','Neutral','Warrior','m',1,560,54,.9,1.2,'🔱',{k:'rally',v:.5,name:'Phalanx Formation'},'Common',{art:"Spearman",passive:{"_condRange":{"amt":1,"when":"allyAdj"}},tip:"Reach: +1 range while adjacent to a friendly unit."}),
  U('Crossbowman','Neutral','Archer','r',5,420,80,.65,1.0,'🏹',{k:'execute',v:.3,name:'Heavy Bolt'},'Uncommon',{art:"Crossbowman",passive:{"armorPierce":0.125},tip:"Piercing Bolt: attacks ignore 25% of target armor."}),
  U('Mercenary','Neutral','Warrior','m',1,720,70,.95,1.2,'🗡️',{k:'berserk',v:0.4,d:0.25,name:'War Cry'},'Uncommon',{art:"Mercenary",passive:{"_dmgAboveHP":{"amt":0.1,"thr":0.6}},tip:"Veteran: +10% damage while above 60% HP."}),
  U('Wandering Mage','Neutral','Mage','r',4,430,95,0.6,0.95,'🏹',{k:'chain',v:1.6,j:4,name:'Spellstorm'},'Rare',{art:"Wandering Mage",passive:{"_chargeOnEnemyDeath":0.12},tip:"Arcane Momentum: gains +12 magic charge whenever any enemy dies."}),
  
  // Ironhold — armor wall (Warrior/Guardian)
  U('Shieldbreaker','Ironhold','Warrior','m',1,820,52,.8,1.1,'🛡️',{k:'shield',v:280,name:'Anvil Stance'},'Common',{art:"Shieldbreaker",passive:{"dr":0.06,"_condArmor":{"adjFaction":{"fac":"Ironhold","amt":0.12}}},tip:"Hold the Line: +12% armor while adjacent to another Dwarf."}),
  U('Hammerguard','Ironhold','Warrior','m',1,720,62,.85,1.2,'🔨',{k:'quake',v:1.4,name:'Ground Pound'},'Common',{art:"Hammerguard",passive:{"armorPierce":0.075},tip:"Crushing Blow: every 4th hit ignores 30% armor."}),
  U('Mountain King','Ironhold','Guardian','m',1,1150,84,.78,1.0,'⛰️',{k:'taunt',r:3,v:2.5,name:'Provoke',desc:'Roars a challenge — nearby enemies are forced to attack the Mountain King for 2.5s while it braces behind a shield.'},'Rare',{art:"Mountain King",passive:{"ccImmune":true},tip:"Unyielding: cannot be knocked back; +15% DMG below 50% HP."}),
  U('Axe Thrower','Ironhold','Archer','r',3,560,66,0.85,0.95,'⛏️',{k:'doubleaxe',v:3.0,name:'Twin Axes'},'Uncommon',{art:"Axe Thrower",passive:{"armorPierce":0.1},tip:"Heavy Throw: attacks ignore 20% armor."}),
  U('Anvil Priest','Ironhold','Cleric','m',1,740,46,0.65,0.82,'🪓',{k:'heal',v:300,name:'Molten Blessing'},'Uncommon',{art:"Anvil Priest",passive:{"_periodicHeal":{"amt":200,"range":3,"every":4},"_periodicShield":{"amt":150,"range":3,"every":6}},tip:"Forgeheart (periodic 4s): shield an ally."}),
  U('Thane Brokk Ironfist','Ironhold','Warrior','m',1,1500,105,0.8,0.82,'⚒️',{k:'quake',v:2.0,name:'Avalanche of Steel'},'Legendary',{art:"Thane Brokk Ironfist",tip:"Forgemother: counts as two units toward Ironhold and Warrior synergies."}),
  
  // Sylvan — ranged scaling (Archer)
  U('Greenwood Archer','Sylvan','Archer','r',4,380,64,1.05,1.3,'🏹',{k:'zone',v:0.55,r:2,dur:4,zico:'🏹',zcol:'#ff7a3a',name:'Hail of Arrows'},'Uncommon',{art:"Greenwood Archer",passive:{"_condRange":{"amt":1,"when":"noEnemyAdj"}},tip:"Keen Eye: +1 range while no enemy is adjacent."}),
  U('Hawkeye Ranger','Sylvan','Archer','r',5,420,86,.95,1.2,'🎯',{k:'beam',v:3.2,name:'Piercing Shot'},'Rare',{art:"Hawkeye Ranger",passive:{"_markAmp":0.15},tip:"Hunter's Mark: marked target takes +15% from all sources."}),
  U('Thornblade Dancer','Sylvan','Rogue','m',1,440,60,1.25,2.0,'🍃',{k:'blink',v:3.0,name:'Thornstep'},'Common',{art:"Thornblade Dancer",passive:{"dodge":0.2},tip:"Evasion: 20% chance to dodge an attack."}),
  U('Druid of the Grove','Sylvan','Cleric','r',3,500,44,.8,1.1,'🌿',{k:'transform',form:'Grizzly Bear',fico:'🐻',hp:1.6,dmg:2.4,as:1.1,name:'Wild Shape'},'Uncommon',{art:"Druid of the Grove",passive:{"chargeMul":1.6,"_periodicHeal":{"amt":80,"range":3,"every":4}},tip:"Regrowth (periodic 4s): heals lowest-HP ally."}),
  U('Briar Scout','Sylvan','Archer','r',4,340,58,1.1,1.22,'🏹',{k:'nova',v:1.6,r:1,name:'Thorn Burst'},'Common',{art:"Briar Scout",passive:{"slow":true},tip:"Tangleshot: hits slow the target 15% 2s."}),
  U('Lady Aelwyn, Voice of the Wild','Sylvan','Archer','r',6,760,98,1.1,1.09,'🦌',{k:'summon',v:1,n:4,token:'squirrel',name:'Call of the Wild'},'Legendary',{art:"Lady Aelwyn, Voice of the Wild",passive:{"_pierce":{"extra":1}},tip:"Court's Blessing: all Sylvan attacks pierce 1 extra target."}),
  
  // Gilded — healing & mitigation (Cleric/Warrior)
  U('Acolyte Medic','Gilded','Cleric','r',3,460,38,.8,1.1,'✚',{k:'heal',v:220,name:'Benediction'},'Common',{art:"Acolyte Medic",passive:{"_periodicHeal":{"amt":80,"range":3,"every":4}},tip:"Mend (periodic 3s): heals lowest-HP ally 80."}),
  U('Templar','Gilded','Warrior','m',1,860,74,.9,1.1,'🜲',{k:'redemption',v:240,r:3,name:"Martyr's Boon",desc:'A dying blessing — when the Templar falls, allies within 3 hexes are healed for 240.'},'Uncommon',{art:"Templar",passive:{"reflect":0.2},tip:"Righteous Fury: reflects 20% of taken damage."}),
  U('High Paladin','Gilded','Guardian','m',1,1180,88,.8,1.0,'☀️',{k:'rally',v:1.0,name:'Holy Zeal'},'Rare',{art:"High Paladin",passive:{"aegis":0.15,"aegisCap":0.25},tip:"Aegis of Light: nearby allies take -15% damage."}),
  U('Squire of Dawn','Gilded','Warrior','m',1,620,50,0.9,1.02,'⚜️',{k:'cleanse',r:3,v:1.5,name:'Purify',desc:'Cleanses all debuffs from nearby allies and wards them against new ones for a moment.'},'Common',{art:"Squire of Dawn",passive:{"_condArmor":{"adjAllies":{"n":1,"amt":0.12}}},tip:"Support: while adjacent to an ally, takes -12% damage."}),
  U('Lightbringer','Gilded','Mage','r',4,480,72,0.8,0.95,'✝️',{k:'beam',v:2.2,name:'Smite'},'Uncommon',{art:"Lightbringer",passive:{"_healAllyOnHit":0.25},tip:"Radiance: attacks heal the nearest ally for 25% of dmg."}),
  U('Seraphine, the Dawnward','Gilded','Cleric','r',4,860,90,0.8,0.95,'😇',{k:'transform',form:'Seraph',fico:'😇',hp:1.0,dmg:2.0,as:1.2,name:'Apotheosis'},'Legendary',{art:"Seraphine, the Dawnward",passive:{"selfRevive":0.5,"_teamReviveAura":0.5},tip:"Guardian Angel: first ally to fall each battle revives at 50%."}),
  
  // Leonin — bleed & speed (Rogue/Beast)
  U('Maned Brawler','Leonin','Warrior','m',1,700,65,1.15,1.5,'🦷',{k:'berserk',v:0.5,d:0.3,name:'Blood Rage'},'Common',{art:"Maned Brawler",passive:{"_vs":{"bled":1.2}},tip:"Bloodscent: +20% AS vs any bleeding enemy."}),
  U('Pridehunter','Leonin','Archer','r',3,420,60,1.1,1.4,'🌾',{k:'chain',v:1.8,j:3,name:'Bouncing Chakram'},'Uncommon',{art:"Pridehunter",passive:{"slow":true},tip:"Hamstring Shot: hits on bled targets slow them 20% 2s."}),
  U('Cub Skirmisher','Leonin','Rogue','m',1,420,44,1.35,2.0,'🦁',{k:'burst', r:1, n:3, v:1.2, name:'Rapid Slashes'},'Common',{art:"Cub Skirmisher",passive:{"_firstAtkBleed":2},tip:"Quick Claws: first attack each fight applies 2 Bleed."}),
  U('Savannah Seer','Leonin','Cleric','r',3,450,46,0.9,1.16,'🐾',{k:'curse',v:1,r:2,name:'Bloodletting Curse'},'Uncommon',{art:"Savannah Seer",passive:{"lifesteal":0.2,"_healAllyOnHit":0.2},tip:"Pridesong: attacks heal the lowest-HP ally for 20% of damage dealt."}),
  U('Sunmane Duelist','Leonin','Rogue','m',1,700,72,1.35,2.2,'🐆',{k:'blink',v:3.0,name:'Hundred Cuts'},'Rare',{art:"Sunmane Duelist",passive:{"_counter":{"frac":0.5,"bleed":true}},tip:"Riposte: on being hit, counter for 50% + 1 Bleed."}),
  U('Pride Matriarch','Leonin','Warrior','m',1,980,90,1.25,1.36,'🌾',{k:'drain',v:3.2,name:'Apex Predator'},'Legendary',{art:"Pride Matriarch",passive:{"_periodicFactionBuff":{"fac":"Leonin","every":5,"bleedCap":1,"asAmt":0.10}},tip:"Queen's Roar (periodic 5s): Leonin +1 max Bleed stack & +10% AS."}),
  
  // Emberkin — burn AoE (Mage)
  U('Pyromancer','Emberkin','Mage','r',4,420,84,.85,1.1,'🌋',{k:'nova',v:2.0,r:2,name:'Firestorm'},'Uncommon',{art:"Pyromancer",passive:{"_vs":{"burning":1.3}},tip:"Conflagration: +30% to already-burning targets."}),
  U('Salamander Brave','Emberkin','Warrior','m',1,600,64,.95,1.3,'🦎',{k:'cone',r:2,v:1.6,width:1,dot:{burn:1.5,dur:3},name:'Fire Breath',desc:'Exhales a short cone of flame, scorching every enemy caught in the blast and leaving them burning.'},'Uncommon',{art:"Salamander Brave",passive:{"burn":1,"burnDur":2,"reflect":0.2},tip:"Molten Skin: melee attackers take burn damage."}),
  U('Inferno Magus','Emberkin','Mage','r',5,520,100,.8,1.0,'☄️',{k:'transform',form:'Living Flame',fico:'🔥',hp:1.0,dmg:2.0,as:1.2,name:'Incarnate'},'Rare',{art:"Inferno Magus",passive:{"_burnSpread":true},tip:"Wildfire: burns spread to adjacent enemies each tick."}),
  U('Spark Tosser','Emberkin','Archer','r',4,340,54,1.05,1.02,'🔥',{k:'beam',v:2.7,name:'Firework'},'Common',{art:"Spark Tosser",passive:{"_igniteNearby":true},tip:"Scattering Sparks: attacks ignite 1 nearby enemy too."}),
  U('Ashmaw Lizard','Emberkin','Beast','m',1,640,66,1.05,1.22,'🌋',{k:'transform',form:'Fire Drake',fico:'🐉',hp:1.0,dmg:2.0,as:1.15,name:'Evolve'},'Common',{art:"Ashmaw Lizard",passive:{"_asPerBurn":0.05},tip:"Feeding Frenzy: +5% AS per burning enemy on field."}),
  U('Vael, the Living Flame','Emberkin','Mage','r',4,820,110,0.85,0.95,'♨️',{k:'quake',v:2.5,name:'Wave of Fire'},'Legendary',{art:"Vael, the Living Flame",passive:{"_burnFieldAmp":0.5},tip:"Eternal Pyre: all burns on the field deal +50%."}),
  
  // Tidecallers — slow/freeze (Mage)
  U('Tide Acolyte','Tidecallers','Mage','r',4,380,58,.9,1.2,'💧',{k:'banish',v:1.6,name:'Undertow'},'Uncommon',{art:"Tide Acolyte",passive:{"slow":true},tip:"Chill: attacks slow target 15% 2s (stacks)."}),
  U('Ice Lancer','Tidecallers','Archer','r',5,420,80,.9,1.1,'🧊',{k:'execute',v:.4,name:'Shatterlance'},'Common',{art:"Ice Lancer",passive:{"_vs":{"frozen":1.4}},tip:"Piercing Frost: +40% vs frozen targets."}),
  U('Frostguard','Tidecallers','Warrior','m',1,700,54,.8,1.1,'❄️',{k:'shield',v:260,name:'Glacial Shell'},'Common',{art:"Frostguard",passive:{"_condArmor":{"perSlowedEnemy":0.05}},tip:"Rime Armor: gains armor as nearby enemies are slowed."}),
  U('Leviathan Caller','Tidecallers','Mage','r',4,640,90,.75,1.0,'🌊',{k:'transform',form:'Leviathan',fico:'🐋',hp:1.0,dmg:2.0,as:1.0,rng:2,name:'Summon Leviathan'},'Rare',{art:"Leviathan Caller",passive:{"_periodicSlow":{"every":2,"range":4}},tip:"Deep Chill: periodically applies a Slow stack to a nearby enemy."}),
  U('Glacier Warden','Tidecallers','Guardian','m',1,1150,54,0.6,0.8,'🧊',{k:'bulwark',v:300,r:2,name:'Wall of Ice'},'Uncommon',{art:"Glacier Warden",passive:{"_slowAura":{"range":1}},tip:"Cold Front: enemies adjacent are slowed 25%."}),
  U('Maris, the Frozen Tide','Tidecallers','Mage','r',5,900,100,0.8,0.88,'🐟',{k:'freeze',v:1.75,r:3,name:'Absolute Zero'},'Legendary',{art:"Maris, the Frozen Tide",passive:{"_slowAura":{"range":1}},tip:"Eternal Winter: enemies near Tidecallers are slowed."}),
  
  // Stormherd — beastfolk shamans: attack speed & lightning (Beast/Mage)
  U('Thunderhide Bull','Stormherd','Beast','m',1,620,56,1.2,1.6,'🐃',{k:'transform',form:'Thunder Beast',fico:'🐃',hp:1.0,dmg:1.0,as:2.0,name:'Storm Avatar'},'Common',{art:"Thunderhide Bull"}),
  U('Sky Shaman','Stormherd','Mage','r',4,420,66,.95,1.2,'🌩️',{k:'zone',v:0.6,r:1,dur:4,zico:'🌩️',zcol:'#ff7a3a',name:'Summon Storm'},'Uncommon',{art:"Sky Shaman",passive:{"_vs":{"shocked":1.25}},tip:"Conduction: bonus damage to enemies already hit by lightning this fight."}),
  U('Thunder Patriarch','Stormherd','Beast','m',1,900,76,1.0,1.3,'🦬',{k:'quake',v:1.4,name:'Stampede'},'Rare',{art:"Thunder Patriarch",passive:{"_auraAS":0.08},tip:"Stormcaller: nearby allies gain +8% attack speed."}),
  U('Galeclaw Skirmisher','Stormherd','Rogue','m',1,440,54,1.3,2.1,'🌩️',{k:'chain',v:1.7,j:5,name:'Chain Lightning'},'Common',{art:"Galeclaw Skirmisher",passive:{"_asPerTravel":true},tip:"Windrunner: +AS the further it traveled before attacking."}),
  U('Totem Warden','Stormherd','Cleric','r',3,520,44,0.8,1.02,'🪶',{k:'rally',v:1.1,name:'Storm Totem'},'Uncommon',{art:"Totem Warden",passive:{"_auraAS":0.12},tip:"Spirit Totem (periodic 4s): nearby allies +12% AS."}),
  U('Kharz, Stormhorn Chieftain','Stormherd','Warrior','m',1,1050,100,1.1,1.5,'🐂',{k:'quake',v:2.0,name:'Thunderstomp'},'Legendary',{art:"Kharz, Stormhorn Chieftain",passive:{"crit":0.15},tip:"Heart of the Storm: all crits chain lightning to 2 foes."}),
  
  // Voidtouched — demons & warlocks: lifesteal & execute (Warrior/Mage/Rogue)
  U('Void Cultist','Voidtouched','Mage','r',4,400,70,.9,1.1,'👁️',{k:'charm',v:4,name:'Corrupt Mind'},'Common',{art:"Void Cultist",passive:{"_markAmp":0.1},tip:"Corruption: marked foes take +10% damage from all sources for 3s."}),
  U('Soul Leech','Voidtouched','Rogue','m',1,520,62,1.25,1.8,'🦇',{k:'drain',v:3.2,name:'Blood Frenzy'},'Common',{art:"Soul Leech",passive:{"lifesteal":0.12},tip:"Siphon: basic attacks heal for 12% of damage dealt."}),
  U('Pit Tyrant','Voidtouched','Guardian','m',1,1100,82,.8,1.0,'😈',{k:'swallow',regurg:0.5,name:'Consume',desc:'Swallows a foe whole, removing it from the fight until the Pit Tyrant dies — then it is regurgitated at half health.'},'Rare',{art:"Pit Tyrant",passive:{"_healOnEnemyDeath":0.05},tip:"Devour: heals 5% max HP whenever a nearby enemy dies."}),
  U('Dread Reaver','Voidtouched','Warrior','m',1,780,76,0.9,1.02,'🔮',{k:'siphon',v:0.35,name:'Plunder',desc:'Rips power from the deadliest foe — steals 35% of its attack (and some armor) and adds it to the Dread Reaver for the fight.'},'Uncommon',{art:"Dread Reaver",passive:{"lifesteal":0.3},tip:"Unholy Vigor: lifesteals 30%."}),
  U('Pact Priest','Voidtouched','Cleric','r',3,470,56,0.8,1.02,'🌑',{k:'zone',v:0.55,r:1,dur:4,zico:'🔥',zcol:'#ff7a3a',name:'Dark Communion'},'Uncommon',{art:"Pact Priest",passive:{"_periodicHeal":{"amt":80,"range":3,"every":4},"_periodicTeamHeal":{"amt":0.12,"fac":null,"every":4,"lowest":true}},tip:"Blood Tithe (periodic 4s): heals the lowest-HP ally, paying a little of its own HP."}),
  U('Xareth, the Soulflayer','Voidtouched','Mage','r',2,900,105,0.9,1.02,'💀',{k:'execute',v:.9,name:'Harvest of Souls'},'Legendary',{art:"Xareth, the Soulflayer",passive:{"_dmgPerStack":0.03,"_stackOn":"kill"},tip:"Soul Engine: every enemy death = Voidtouched +3% DMG permanently."}),
  
  // Phoenix Cult — self-immolating rebirth
  U('Ash Disciple','Phoenix','Mage','r',4,400,68,.9,1.2,'🌋',{k:'zone',v:0.6,r:1,dur:5,zico:'🔥',zcol:'#ff8a3a',name:'Ember Field'},'Uncommon',{art:"Ash Disciple",passive:{"burn":1,"burnDur":2},tip:"Cinders: attacks apply a small burn that ticks for 2s."}),
  U('Flamewing Seer','Phoenix','Cleric','r',3,460,40,.8,1.1,'🕊️',{k:'pyre',v:0.5,name:'Rekindle',desc:'Calls the most-recently-fallen ally back to the fight beside the Seer at half health.'},'Common',{art:"Flamewing Seer",passive:{"burn":1,"burnDur":2},tip:"Cinder Link: attacks burn self 6%, heal a Phoenix ally 6%."}),
  U('Ember Acolyte','Phoenix','Mage','r',3,420,70,0.85,1.02,'🔥',{k:'nova',v:1.7,r:2,name:'Immolate'},'Common',{art:"Ember Acolyte",passive:{"_selfRecoil":0.08},tip:"Searing Bolt: deals 70; self takes 8% of damage dealt."}),
  U('Ashen Zealot','Phoenix','Warrior','m',1,640,72,1.05,1.16,'🌋',{k:'nova',v:1.7,r:1,name:'Selfpyre'},'Uncommon',{art:"Ashen Zealot",passive:{"_dmgBelowHP":{"amt":0.5,"thr":0.3}},tip:"Martyr: below 30% HP, attacks +50% DMG."}),
  U('Pyreborn Champion','Phoenix','Warrior','m',1,820,88,1.1,1.22,'♨️',{k:'nova',v:1.7,r:1,name:'Supernova'},'Rare',{art:"Pyreborn Champion",passive:{"_dmgPerStack":null,"_stackOn":"allyDeath","_dmgPerDeath":0.25},tip:"Eternal Flame: +25% DMG per time it has died this battle."}),
  U('The Undying Phoenix','Phoenix','Mage','r',2,1100,100,1.0,1.29,'☀️',{k:'beam',v:2.6,name:'Rebirth in Fire'},'Legendary',{art:"The Undying Phoenix",passive:{"_periodicTeamHeal":{"amt":0.1,"fac":"Phoenix","every":4}},tip:"Reignite (periodic 6s): heals 10% max HP to all Phoenix; self burns 5%."}),
  
  // Gravewardens — stone constructs that harden under fire
  U('Stone Sentinel','Gravewardens','Guardian','m',1,980,46,.7,0.9,'🗿',{k:'bulwark',v:300,r:2,name:'Petrify'},'Uncommon',{art:"Stone Sentinel",passive:{"ccImmune":true,"dr":0.05},tip:"Immovable: cannot be knocked back; +10% armor while stationary."}),
  U('Runekeeper','Gravewardens','Mage','r',3,520,56,.8,1.0,'🪬',{k:'bulwark',v:260,r:3,name:'Runic Ward'},'Common',{art:"Runekeeper",passive:{"_auraMagicResist":0.08,"_auraRange":2},tip:"Ward Field: allies within 2 hexes take -8% magic damage."}),
  U('Granite Colossus','Gravewardens','Guardian','m',1,1250,72,.7,0.8,'🏔️',{k:'transform',form:'Mountain Titan',fico:'🗻',hp:1.4,dmg:2.0,as:1.0,name:'Titan Form'},'Uncommon',{art:"Granite Colossus",passive:{"ccImmune":true,"dr":0.075},tip:"Immovable: cannot be knocked back; +15% armor while stationary."}),
  U('Gravel Golem','Gravewardens','Guardian','m',1,1100,42,0.55,0.8,'⚙️',{k:'throw',v:2.6,stun:1.2,name:'Boulder Toss',desc:'Grabs the nearest foe and hurls it into the farthest enemy — both take heavy damage and are stunned ~1.2s.'},'Common',{art:"Gravel Golem",passive:{"_firstHitReduce":0.2},tip:"Crumble Guard: takes -20% damage from the first hit of each enemy."}),
  U('Rune Colossus','Gravewardens','Guardian','m',1,1300,58,0.5,0.8,'🗽',{k:'quake',v:1.6,name:'Seismic Slam'},'Rare',{art:"Rune Colossus",passive:{"_periodicShield":{"amt":180,"range":1,"every":6,"self":true}},tip:"Stoneskin (periodic 5s): self & adjacent allies gain a 180 shield."}),
  U('The Eternal Bulwark','Gravewardens','Guardian','m',1,2000,55,0.45,0.8,'🤖',{k:'bulwark',v:600,r:3,name:'Unbreakable'},'Legendary',{art:"The Eternal Bulwark",passive:{"_rangedWard":0.1},tip:"Living Wall: all friendly units take -10% ranged damage."}),
  
  // Hivemind — insect swarm, spawns Swarmlings
  U('Mantis Striker','Hivemind','Rogue','m',1,460,54,1.35,2.3,'🦗',{k:'blink',v:3.0,name:'Ambush'},'Uncommon',{art:"Mantis Striker",passive:{"_vs":{"full":1.25}},tip:"Scything: attacks against full-HP foes deal +25%."}),
  U('Beetle Bulwark','Hivemind','Guardian','m',1,900,50,.8,1.0,'🪲',{k:'bulwark',v:280,r:2,name:'Carapace Wall'},'Uncommon',{art:"Beetle Bulwark",passive:{"dr":0.03,"_condArmor":{"perFaction":{"fac":"Hivemind","amt":0.06,"cap":0.36}}},tip:"Carapace: gains +6% armor for each living Hivemind ally."}),
  U('Drone Tender','Hivemind','Cleric','r',3,440,36,.85,1.2,'🐝',{k:'heal',v:200,name:'Royal Jelly'},'Rare',{art:"Drone Tender",passive:{"_periodicSummon":{"key":"swarmling","every":5,"mult":1,"healHive":true}},tip:"Royal Jelly (periodic 4s): heals lowest-HP Hivemind + spawns a Swarmling."}),
  U('Skitterer','Hivemind','Beast','m',1,260,24,1.5,1.63,'🐝',{k:'mirror',n:2,v:0.5,dmg:0.7,name:'Multiply',desc:'Splits into 2 illusory copies of itself that swarm the enemy at half health.'},'Common',{art:"Skitterer",passive:{"_nthSpawn":{"n":3,"key":"swarmling"}},tip:"Breed: every 3rd attack spawns a Swarmling."}),
  U('Spitter Drone','Hivemind','Archer','r',3,240,30,1.2,1.22,'🦗',{k:'curse',v:1,r:2,name:'Corrosive Cloud'},'Common',{art:"Spitter Drone",passive:{"_armorShred":{"amt":3,"max":8}},tip:"Acid Spit: attacks reduce armor by 3 (stacks, max 8)."}),
  U('The Brood Mother','Hivemind','Beast','m',1,1800,70,1.0,0.88,'🐞',{k:'summon',v:1,n:4,token:'swarmling',name:'Endless Brood'},'Legendary',{art:"The Brood Mother",passive:{"_tokenHpBuff":0.4,"_tokenPersist":true},tip:"Living Hive: Swarmlings gain +40% HP and never expire."}),
  
  // Stargazers — ultimate acceleration
  U('Star Acolyte','Stargazers','Mage','r',4,380,62,.95,1.2,'✨',{k:'silence',r:3,v:2.5,name:'Disrupt',desc:'Snuffs the starlight of nearby enemies — draining their charge and stopping them casting for 2.5s.'},'Uncommon',{art:"Star Acolyte",passive:{"_dmgVsFarthest":0.12},tip:"Focus: +12% damage to the farthest enemy in range."}),
  U('Astral Blade','Stargazers','Warrior','m',1,680,66,1.0,1.3,'🌠',{k:'blink',v:3.2,name:'Star Step'},'Common',{art:"Astral Blade",passive:{"chargeMul":1.15},tip:"Star-Touched: ultimate charges 15% faster."}),
  U('Comet Herald','Stargazers','Mage','r',5,540,92,.8,1.0,'☄️',{k:'bombard',n:5,v:1.6,dir:'N',order:'row-top',glyph:'☄️',zcol:'#c8a6ff',name:'Meteor Storm',desc:'Calls down a storm of meteors from off the board onto up to 5 enemies, striking from the top row first.'},'Rare',{art:"Comet Herald",passive:{"_periodicMeteor":{"every":5}},tip:"Falling Stars: every 5s, a small meteor hits a random foe."}),
  U('Astral Weaver','Stargazers','Mage','r',4,440,72,0.7,0.95,'🔭',{k:'curse',v:1,r:2,name:'Gravity Well'},'Common',{art:"Astral Weaver",passive:{"_punishUlt":250},tip:"Entropy: when an enemy ults, deal 250 to it."}),
  U('Celestial Magus','Stargazers','Mage','r',5,500,90,0.65,0.88,'🌠',{k:'timewarp',r:2,dur:4,v:0.4,name:'Chronofield',desc:'Warps time in an area — allies inside attack faster while enemies are slowed in speed and movement.'},'Uncommon',{art:"Celestial Magus",passive:{"_chargeOnAllyUlt":20},tip:"Resonance: each allied ult fired grants self +20 magic."}),
  U('The Cosmic Oracle','Stargazers','Mage','r',5,760,95,0.7,0.95,'🌌',{k:'rally',v:1.0,name:'Convergence'},'Legendary',{art:"The Cosmic Oracle",passive:{"_ultEcho":true},tip:"Echoing Cosmos: friendly ultimates have a 25% chance to fire a second time."}),
  
  // Arachnari — webs that root, amplified damage on webbed foes
  U('Web Spinner','Arachnari','Rogue','m',1,380,40,1.2,1.9,'🕷️',{k:'freeze',v:1.5,r:1,name:'Ensnaring Burst'},'Common',{art:"Web Spinner",passive:{"_nthSpawn":{"n":3,"key":"swarmling"}},tip:"Spinneret: every 3rd attack spawns a Broodling."}),
  U('Silk Slinger','Arachnari','Archer','r',4,340,52,0.95,1.16,'🕸️',{k:'nova',v:1.7,r:2,name:'Sticky Volley'},'Common',{art:"Silk Slinger",passive:{"web":true},tip:"Webshot: attacks apply 1 Web stack (slow 12%, stacks)."}),
  U('Venomfang Lurker','Arachnari','Rogue','m',1,460,58,1.3,2.2,'🪺',{k:'blink',v:3.0,name:'Jumping Spider'},'Uncommon',{art:"Venomfang Lurker",passive:{"_vs":{"slowed":1.3}},tip:"Ruthless: +30% damage vs webbed/slowed targets."}),
  U('Broodmother Acolyte','Arachnari','Cleric','r',3,480,42,0.85,1.09,'🥚',{k:'trap',v:2.0,stacks:2,root:1.2,name:'Web Snare',desc:'Spins a hidden web near the enemy; the first foe to step onto it is rooted 1.2s and left bleeding.'},'Rare',{art:"Broodmother Acolyte",passive:{"_periodicHeal":{"amt":80,"range":3,"every":4}},tip:"Nurture (periodic 4s): heals lowest-HP ally + spawns a Broodling."}),
  U('Carapace Sentinel','Arachnari','Guardian','m',1,1050,64,0.7,0.88,'🜸',{k:'bulwark',v:420,r:2,name:'Living Web Wall'},'Uncommon',{art:"Carapace Sentinel",passive:{"web":true},tip:"Web Anchor: adjacent enemies slowed 20%; immune to displacement."}),
  U('Queen Atraxa, the Brood Empress','Arachnari','Mage','r',3,1150,98,0.9,1.02,'👑',{k:'summon',v:1,n:4,token:'broodling',name:'Tangleweb Cataclysm'},'Legendary',{art:"Queen Atraxa, the Brood Empress",passive:{"web":true},tip:"Living Hive: Broodlings never expire and apply +1 Web stack."}),
  
  // Myconid Bloom — spreading poison spores
  U('Spore Sprout','Myconid','Beast','m',1,520,48,1.0,1.2,'🍄',{k:'zone',v:0.5,r:1,dur:5,zico:'🟢',zcol:'#9ccc65',name:'Spore Cloud'},'Common',{art:"Spore Sprout",passive:{"_deathPoisonCloud":true},tip:"Spore Burst: on death, leaves a poison cloud for 3s."}),
  U('Puffcap Lobber','Myconid','Archer','r',4,420,62,.9,1.1,'🌫️',{k:'polymorph',v:3,name:'Sporeform',desc:'Lobs a transformative spore that turns the deadliest foe into a harmless critter for 3s.'},'Common',{art:"Puffcap Lobber",passive:{"spore":true},tip:"Spore Shot: attacks apply light poison."}),
  U('Bloom Sage','Myconid','Cleric','r',3,480,40,.8,1.0,'🌺',{k:'charm',v:4,name:'Spore Thrall'},'Rare',{art:"Bloom Sage",passive:{"_healGrantsAS":0.05},tip:"Symbiosis: healed allies also gain +5% attack speed for 3s."}),
  U('Myco-Alchemist','Myconid','Mage','r',4,440,68,0.8,0.95,'🍂',{k:'confuse',r:2,v:3,name:'Hallucinogens',desc:'Releases maddening spores — enemies caught in the cloud turn on their own allies for 3s.'},'Uncommon',{art:"Myco-Alchemist",passive:{"_vs":{"poisoned":1.15}},tip:"Virulence: deals +15% damage to poisoned enemies."}),
  U('Sporemother Tender','Myconid','Cleric','r',3,470,40,0.8,1.02,'🟫',{k:'heal',v:280,name:'Bloomheal'},'Uncommon',{art:"Sporemother Tender",passive:{"_periodicHeal":{"amt":240,"range":3,"every":4},"_cleanse":true},tip:"Symbiosis (periodic 4s): heals an ally and cleanses its debuffs."}),
  U('Mycelia, the Deep Mother','Myconid','Mage','r',3,1150,95,0.85,0.88,'🌳',{k:'zone',v:1.0,r:3,dur:6,zico:'🟢',zcol:'#9ccc65',name:'Spore Apocalypse'},'Legendary',{art:"Mycelia, the Deep Mother",passive:{"_cloudMaster":true},tip:"Mycelial Network: while Mycelia is alive, your spore clouds never expire and slow enemies inside them."}),
  
  // Grimgear Goblins — engineers who build turrets & bots
  U('Boom Lobber','Grimgear','Archer','r',4,400,72,.85,1.2,'🧨',{k:'nova',v:1.7,r:1,name:'Big Boom'},'Common',{art:"Boom Lobber",passive:{"_splash":{"frac":0.3}},tip:"Shrapnel: attacks splash 30% damage to foes adjacent to the target."}),
  U('Mecha-Pilot','Grimgear','Guardian','m',1,1020,70,.8,1.0,'🤖',{k:'banish',v:1.7,name:'Steam Punch'},'Uncommon',{art:"Mecha-Pilot",passive:{"_dmgPerRobot":0.05},tip:"Piloted Walker: a construct; +5% DMG per friendly robot/turret."}),
  U('Pop-Shot Goblin','Grimgear','Archer','r',4,330,50,1.05,1.16,'🤖',{k:'doubleaxe',v:3.5,name:'Double Barrel'},'Uncommon',{art:"Pop-Shot Goblin",passive:{"_splash":{"frac":0.6,"max":1}},tip:"Potshot: every 4th shot explodes, splashing 1 adjacent."}),
  U('Sapper','Grimgear','Rogue','m',1,380,55,1.15,1.5,'🔧',{k:'selfdestruct',r:2,v:4.0,name:'Detonate',desc:'Overloads its charges and explodes — dying to deal massive damage to everything within 2 hexes.'},'Common',{art:"Sapper",passive:{"_vs":{"armored":1.4}},tip:"Demolition: +40% vs Guardians/constructs & high armor."}),
  U('Tinker Engineer','Grimgear','Mage','r',3,420,40,0.8,1.09,'🛠️',{k:'wall',n:3,dur:6,name:'Barricade',desc:'Bolts together a wall of scrap that blocks a lane for 6s.'},'Rare',{art:"Tinker Engineer",passive:{"_periodicSummon":{"key":"scrapbot","every":6,"mult":1}},tip:"Assemble (periodic 5s): builds a Scrap Bot nearby."}),
  U('Grizzlemaw, the Warboss-Inventor','Grimgear','Mage','r',4,1050,90,0.9,1.02,'🚀',{k:'summon',v:1,n:4,token:'scrapbot',name:'Cogwork Cataclysm'},'Legendary',{art:"Grizzlemaw, the Warboss-Inventor",passive:{"_constructWarboss":true},tip:"Mass Production: friendly turrets and robots have +50% stats and slowly regenerate health."}),
  
  // Hollow Legion — fallen rise as skeletons
  U('Bone Soldier','Hollow','Warrior','m',1,600,52,.9,1.1,'💀',{k:'blink',v:2.8,name:'Grave Lunge'},'Common',{art:"Bone Soldier",passive:{"selfRevive":0.5,"_reviveAsSkeleton":true},tip:"Undying: revives once as a weaker skeleton on death."}),
  U('Bone Archer','Hollow','Archer','r',4,320,58,0.9,1.02,'🦴',{k:'zone',v:0.55,r:2,dur:4,zico:'🟣',zcol:'#9b59b6',name:'Barrage of Bones'},'Common',{art:"Bone Archer",passive:{"_healCut":0.3},tip:"Brittle Bolts: attacks reduce target healing 30%."}),
  U('Necromancer','Hollow','Mage','r',4,460,60,0.75,0.95,'🕯️',{k:'summon',v:1,n:3,token:'skeleton',name:'Army of the Dead'},'Uncommon',{art:"Necromancer",passive:{"_summonOnAllyDeath":"skeleton"},tip:"Raise Dead (periodic 5s): summons a Skeleton at an ally death site."}),
  U('Grave Knight','Hollow','Warrior','m',1,760,72,0.85,0.95,'👻',{k:'drain',v:2.8,name:'Death\'s Embrace'},'Uncommon',{art:"Grave Knight",passive:{"_healOnEnemyDeath":0.05,"_dmgPerStack":null,"_stackOn":"allyDeath"},tip:"Soul Harvest: +6% DMG per enemy that has died."}),
  U('Lich Adept','Hollow','Mage','r',5,560,92,0.75,0.88,'🪦',{k:'curse',v:1,r:2,name:'Mass Decay'},'Rare',{art:"Lich Adept",passive:{"_decayTouch":true},tip:"Decay: a spreading DoT that worsens over time."}),
  U('Mortis, the Bone Sovereign','Hollow','Mage','r',4,880,98,0.8,0.88,'👑',{k:'beam',v:10.0,name:'Finger of Death'},'Legendary',{art:"Mortis, the Bone Sovereign",passive:{"_skeletonPersist":true},tip:"Endless Host: your skeletons never expire."}),
];
// Thane Brokk counts as two units toward his faction & class synergies (Forgefather)
(POOL.find(u=>u.name==='Thane Brokk Ironfist')||{})._synWeight=2;
export const FACTIONS=['Ironhold','Sylvan','Gilded','Leonin','Emberkin','Tidecallers','Stormherd','Voidtouched','Phoenix','Gravewardens','Hivemind','Stargazers','Arachnari','Myconid','Grimgear','Hollow'];

/* ---------- FACTION-UNLOCK ECONOMY (GDD §6, §11, §25a) ----------
   Two layers: (1) META — which factions an account has permanently unlocked, bought
   with Lore between runs; (2) IN-RUN — which unlocked factions are active in the
   current draft pool, starting with just the four starters and widening via
   level-ups, Town nodes, and events. */
export const STARTER_FACTIONS=['Neutral','Ironhold','Sylvan','Gilded'];
// Factions unlocked on the account from the very start. The four starters seed the
// in-run draft pool directly; Leonin/Emberkin/Tidecallers are unlocked too (so they
// appear as level-up/Town/event choices for free) but must be ADDED into a run's pool.
export const DEFAULT_UNLOCKED=['Neutral','Ironhold','Sylvan','Gilded','Leonin','Emberkin','Tidecallers'];
// thematic display data + Lore cost (loosely tracks mechanical complexity per the GDD)
export const FACTION_INFO={
  Leonin:{ico:'🦁',cost:90,blurb:'Bleed stacks that amplify all incoming damage.'},
  Emberkin:{ico:'🔥',cost:100,blurb:'Spreading burn damage-over-time.'},
  Tidecallers:{ico:'🌊',cost:120,blurb:'Slows that stack into full board freezes.'},
  Stormherd:{ico:'⚡',cost:130,blurb:'Attack speed and chaining lightning.'},
  Voidtouched:{ico:'👁️',cost:160,blurb:'Lifesteal and snowballing kill power.'},
  Hollow:{ico:'💀',cost:130,blurb:'Fallen allies rise again as skeletons.'},
  Hivemind:{ico:'🐝',cost:150,blurb:'Swarmling tokens that scale your damage.'},
  Grimgear:{ico:'🤖',cost:160,blurb:'Build turrets and scrap-bot constructs.'},
  Myconid:{ico:'🍄',cost:160,blurb:'Spore poison that spreads and amplifies.'},
  Gravewardens:{ico:'🗿',cost:150,blurb:'Convert damage taken into permanent armor.'},
  Phoenix:{ico:'🦅',cost:180,blurb:'Units revive from death, reborn and empowered.'},
  Arachnari:{ico:'🕷️',cost:180,blurb:'Webs that root foes and amplify damage.'},
  Stargazers:{ico:'✨',cost:200,blurb:'Accelerate the whole army’s ultimate cadence.'},
};
export const META_KEY='aetherforge_meta_v1';
export function loadMeta(){
  let m=null;
  try{ m=JSON.parse(localStorage.getItem(META_KEY)); }catch(e){}
  if(!m||!m.unlocked){ m={unlocked:DEFAULT_UNLOCKED.slice(), lore:0, ascension:0, ascMax:0, commanders:['aldric']}; }
  if(m.ascension==null)m.ascension=0; if(m.ascMax==null)m.ascMax=0;
  if(!m.commanders)m.commanders=['aldric'];
  if(!m.commanders.includes('aldric'))m.commanders.push('aldric');
  if(!m.upgrades)m.upgrades={};   // Athenaeum upgrade tracks (Expedition / Quartermaster / Codex): id -> purchased tier
  // guarantee the default-unlocked factions are always present (covers older saves too)
  DEFAULT_UNLOCKED.forEach(f=>{ if(!m.unlocked.includes(f))m.unlocked.push(f); });
  return m;
}
export function saveMeta(m){ try{ localStorage.setItem(META_KEY, JSON.stringify(m)); }catch(e){} }
export let META=loadMeta();
// wipes all account progress (unlocked factions, Lore, ascension, unlocked commanders, Athenaeum upgrades)
export function resetProgress(){
  try{ localStorage.removeItem(META_KEY); }catch(e){}
  META=loadMeta();
}

/* ---------- ATHENAEUM UPGRADE TRACKS (GDD §25a) — horizontal: options, info, economy, never raw power ----------
   Each upgrade is multi-tier; you buy the next tier with Lore. Persisted in META.upgrades[id] = tier owned. */
export const META_TRACKS=[
  { id:'expedition', name:'Expedition', ico:'🧭', blurb:'Run-start conditions — what you begin each expedition with.',
    upgrades:[
      {id:'exp_gold',   name:'War Chest',      ico:'🪙', max:3, cost:[40,70,110], tierDesc:t=>`Start each run with +${t*40} gold.`},
      {id:'exp_lore',   name:'Scholar’s Stipend',ico:'📜', max:2, cost:[50,90],    tierDesc:t=>`Begin each run with +${t*5} banked Lore already earned.`},
      {id:'exp_gear',   name:'Field Kit',      ico:'🎒', max:2, cost:[60,110],     tierDesc:t=>`Start each run with ${t} random piece${t>1?'s':''} of equipment in your stash.`},
      {id:'exp_scout',  name:'Forward Scouts', ico:'🔭', max:1, cost:[70],         tierDesc:t=>`Scout ahead: preview each act's boss from the map screen for this run.`},
    ]},
  { id:'quartermaster', name:'Quartermaster', ico:'⚖️', blurb:'Economy & convenience — smoother money and shopping.',
    upgrades:[
      {id:'qm_shop',    name:'Bulk Discounts', ico:'🏷️', max:2, cost:[60,100], tierDesc:t=>`Recruitment & reroll costs reduced ${t*8}%.`},
      {id:'qm_reroll',  name:'Free Reroll',    ico:'🎲', max:1, cost:[70],     tierDesc:t=>`One free reroll on every Recruitment Camp visit.`},
      {id:'qm_refund',  name:'Fair Trade',     ico:'🤝', max:2, cost:[40,70],  tierDesc:t=>`Selling units refunds ${50+t*15}% of their cost (up from 50%).`},
      {id:'qm_draft',   name:'Wide Draft',     ico:'🃏', max:1, cost:[90],     tierDesc:t=>`Once per act, a battle reward offers 4 unit choices instead of 3.`},
    ]},
  { id:'codex', name:'Codex', ico:'📖', blurb:'Knowledge & legibility — see more before you commit.',
    upgrades:[
      {id:'cdx_synergy',name:'Enemy Lore',     ico:'👁️', max:1, cost:[50], tierDesc:t=>`Enemy synergies are revealed during planning from the very first run.`},
      {id:'cdx_recap',  name:'After-Action',   ico:'📋', max:1, cost:[40], tierDesc:t=>`Unlock the detailed post-battle breakdown screen.`},
      {id:'cdx_boss',   name:'Oracle’s Sight', ico:'🔮', max:1, cost:[60], tierDesc:t=>`Preview each act’s boss type from the map screen.`},
    ]},
];
export const META_UP_BY_ID={}; META_TRACKS.forEach(tr=>tr.upgrades.forEach(u=>{u.track=tr.id; META_UP_BY_ID[u.id]=u;}));
export function upgTier(id){ return (META.upgrades&&META.upgrades[id])||0; }
export function upgNextCost(u){ const t=upgTier(u.id); return t>=u.max?null:u.cost[t]; }
export function buyUpgrade(id){
  const u=META_UP_BY_ID[id]; if(!u)return;
  const t=upgTier(id); if(t>=u.max){ toast('Already maxed'); return; }
  const cost=u.cost[t];
  if(META.lore<cost){ toast('Not enough Lore'); return; }
  META.lore-=cost; META.upgrades[id]=t+1; saveMeta(META);
  toast(u.ico+' '+u.name+(u.max>1?(' '+(t+1)+'/'+u.max):'')+' purchased!');
  showMetaStore();
}
export function factionUnlocked(f){ return META.unlocked.includes(f); }
// factions unlocked on the account but NOT yet active in the current run
export function lockedInRun(){ return META.unlocked.filter(f=>f!=='Neutral' && !(G.activeFactions||[]).includes(f)); }
// unlocked-account factions, minus Neutral, sorted by Lore cost — for the meta store
export function metaLockable(){ return FACTIONS.filter(f=>!factionUnlocked(f)).sort((a,b)=>FACTION_INFO[a].cost-FACTION_INFO[b].cost); }

/* ---------- ASCENSION LADDER (GDD §25) — cumulative handicaps for replays ---------- */
export const ASCENSION=[
  {n:1,name:'Hardened Foes',desc:'Enemy power +10%.'},
  {n:2,name:'Lean Coffers',desc:'Gold rewards -20%.'},
  {n:3,name:'Elite Pressure',desc:'Elites hit harder (+15%).'},
  {n:4,name:'Scarce Picks',desc:'Recruit offers cost +25% gold.'},
  {n:5,name:'Fragile Heroes',desc:'Start each run with 1 fewer Army Cap.'},
  {n:6,name:'Cruel Bosses',desc:'Bosses gain +15% HP.'},
  {n:7,name:'Thin Supply',desc:'Shop & forge costs +20%.'},
  {n:8,name:'Cursed Map',desc:'Battle modifiers appear far more often.'},
  {n:9,name:'Relentless',desc:'Enemy power +25% total; bosses enrage sooner.'},
  {n:10,name:'The Broken Realm',desc:'All handicaps; the final boss gains extra menace.'},
];
export function asc(){ return G&&G.ascension||0; }
// cumulative enemy-power multiplier from the active ascension tier
export function ascEnemyMult(){ let m=1; const a=asc(); if(a>=1)m+=0.10; if(a>=9)m+=0.15; return m; }
export function ascGoldMult(){ return asc()>=2?0.8:1; }
export function ascCostMult(){ let m=1; if(asc()>=4)m+=0.25; if(asc()>=7)m+=0.20; return m; }
export function unitsOf(f){return POOL.filter(u=>u.faction===f);}

