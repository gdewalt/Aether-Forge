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
   t:type m=melee r=ranged ; rng range ; ab ultimate def
   rar: authored rarity — 'Common'|'Uncommon'|'Rare'|'Legendary'. Drives how often this unit
   is offered in recruit/shop/reward pools (see rarityWeights() in data-loot.js) and its
   recruit cost (UNIT_COST). Edit this value directly to rebalance a unit's availability.
*/
export function U(name,faction,cls,t,rng,hp,dmg,as,mv,ico,ult,rar){
  return {name,faction,cls,t,rng,hp,dmg,as,mv,ico,ult,rar};
}
// ultimate kinds: nova(aoe), heal, shield, execute, rally(+as), freeze(stun)
export const POOL=[
  // Neutral — starter units, no faction synergy (flexible, well-rounded)
  U('Footman','Neutral','Warrior','m',1,640,50,.85,1.2,'🪖',{k:'shield',v:240,name:'Shield Wall'},'Common'),
  U('Archer','Neutral','Archer','r',4,400,58,.95,1.2,'🎯',{k:'nova',v:1.6,r:1,name:'Volley'},'Common'),
  U('Spearman','Neutral','Warrior','m',1,560,54,.9,1.2,'🔱',{k:'rally',v:.5,name:'Phalanx Formation'},'Common'),
  U('Crossbowman','Neutral','Archer','r',5,420,80,.65,1.0,'🏹',{k:'execute',v:.3,name:'Heavy Bolt'},'Uncommon'),
  U('Mercenary','Neutral','Warrior','m',1,720,70,.95,1.2,'🗡️',{k:'berserk',v:0.4,d:0.25,name:'War Cry'},'Uncommon'),
  U('Wandering Mage','Neutral','Mage','r',4,430,95,0.6,0.95,'🏹',{k:'chain',v:1.6,j:4,name:'Spellstorm'},'Rare'),
  // Ironhold — armor wall (Warrior/Guardian)
  U('Shieldbreaker','Ironhold','Warrior','m',1,820,52,.8,1.1,'🛡️',{k:'shield',v:280,name:'Anvil Stance'},'Common'),
  U('Hammerguard','Ironhold','Warrior','m',1,720,62,.85,1.2,'🔨',{k:'quake',v:1.4,name:'Ground Pound'},'Common'),
  // U('Cannoneer','Ironhold','Archer','r',4,560,96,.6,1.0,'💥',{k:'zone',v:0.6,r:1,dur:4,zico:'💥',zcol:'#c97a2b',name:'Cannon Barrage'},'Rare'),
  U('Mountain King','Ironhold','Guardian','m',1,1150,84,.78,1.0,'⛰️',{k:'shield',v:340,name:'Bulwark of Ages'},'Rare'),
  U('Axe Thrower','Ironhold','Archer','r',3,560,66,0.85,0.95,'⛏️',{k:'doubleaxe',v:3.0,name:'Twin Axes'},'Uncommon'),
  // U('Runesmith','Ironhold','Mage','r',3,520,68,0.7,0.88,'🔨',{k:'shield',v:234,name:'Forge Rune'},'Common'),
  U('Anvil Priest','Ironhold','Cleric','m',1,740,46,0.65,0.82,'🪓',{k:'heal',v:300,name:'Molten Blessing'},'Uncommon'),
  U('Thane Brokk Ironfist','Ironhold','Warrior','m',1,1500,105,0.8,0.82,'⚒️',{k:'quake',v:2.0,name:'Avalanche of Steel'},'Legendary'),
  // Sylvan — ranged scaling (Archer)
  U('Greenwood Archer','Sylvan','Archer','r',4,380,64,1.05,1.3,'🏹',{k:'nova',v:1.6,r:1,name:'Twin Shot'},'Uncommon'),
  U('Hawkeye Ranger','Sylvan','Archer','r',5,420,86,.95,1.2,'🎯',{k:'beam',v:2.2,name:'Piercing Shot'},'Rare'),
  U('Thornblade Dancer','Sylvan','Rogue','m',1,440,60,1.25,1.5,'🍃',{k:'blink',v:3.0,name:'Thornstep'},'Common'),
  U('Druid of the Grove','Sylvan','Cleric','r',3,500,44,.8,1.1,'🌿',{k:'transform',form:'Grizzly Bear',fico:'🐻',hp:1.6,dmg:2.4,as:1.1,name:'Wild Shape'},'Uncommon'),
  U('Briar Scout','Sylvan','Archer','r',4,340,58,1.1,1.22,'🏹',{k:'zone',v:0.55,r:2,dur:4,zico:'🔥',zcol:'#ff7a3a',name:'Pinning Volley'},'Common'),
  // U('Moonpetal Sage','Sylvan','Mage','r',4,450,70,0.8,0.95,'🍃',{k:'chain',v:1.6,j:4,name:'Lunar Grove'},'Common'),
  // U('Treant Warden','Sylvan','Guardian','m',1,1300,70,0.55,0.8,'🌿',{k:'summon',v:1,n:3,token:'squirrel',name:'Living Barricade'},'Rare'),
  U('Lady Aelwyn, Voice of the Wild','Sylvan','Archer','r',6,760,98,1.1,1.09,'🦌',{k:'summon',v:1,n:4,token:'squirrel',name:'Call of the Wild'},'Legendary'),
  // Gilded — healing & mitigation (Cleric/Warrior)
  U('Acolyte Medic','Gilded','Cleric','r',3,460,38,.8,1.1,'✚',{k:'heal',v:220,name:'Benediction'},'Common'),
  U('Templar','Gilded','Warrior','m',1,860,74,.9,1.1,'🜲',{k:'heal',v:200,name:'Blessing'},'Uncommon'),
  U('High Paladin','Gilded','Guardian','m',1,1180,88,.8,1.0,'☀️',{k:'rally',v:1.0,name:'Holy Zeal'},'Rare'),
  U('Squire of Dawn','Gilded','Warrior','m',1,620,50,0.9,1.02,'⚜️',{k:'shield',v:280,name:'Shield of Faith'},'Common'),
  U('Lightbringer','Gilded','Mage','r',4,480,72,0.8,0.95,'✝️',{k:'beam',v:2.2,name:'Smite'},'Uncommon'),
  U('Seraphine, the Dawnward','Gilded','Cleric','r',4,860,90,0.8,0.95,'😇',{k:'transform',form:'Seraph',fico:'😇',hp:1.0,dmg:2.0,as:1.2,name:'Apotheosis'},'Legendary'),
  // Leonin — bleed & speed (Rogue/Beast)
  U('Maned Brawler','Leonin','Warrior','m',1,640,58,1.15,1.5,'🦷',{k:'berserk',v:0.5,d:0.3,name:'Blood Rage'},'Common'),
  U('Pridehunter','Leonin','Archer','r',3,420,52,1.1,1.4,'🌾',{k:'execute',v:.3,name:'Heavy Throw'},'Uncommon'),
  U('Cub Skirmisher','Leonin','Rogue','m',1,420,44,1.35,1.43,'🦁',{k:'nova',v:1.7,r:1,name:'Rapid Slashes'},'Common'),
  U('Savannah Seer','Leonin','Cleric','r',3,450,46,0.9,1.16,'🐾',{k:'curse',v:1,r:2,name:'Bloodletting Curse'},'Uncommon'),
  U('Sunmane Duelist','Leonin','Rogue','m',1,700,72,1.35,1.36,'🐆',{k:'blink',v:3.0,name:'Hundred Cuts'},'Rare'),
  U('Pride Matriarch','Leonin','Warrior','m',1,980,90,1.25,1.36,'🌾',{k:'drain',v:3.2,name:'Apex Predator'},'Legendary'),
  // Emberkin — burn AoE (Mage)
  U('Pyromancer','Emberkin','Mage','r',4,420,84,.85,1.1,'🌋',{k:'nova',v:2.0,r:2,name:'Firestorm'},'Uncommon'),
  U('Salamander Brave','Emberkin','Warrior','m',1,600,64,.95,1.3,'🦎',{k:'berserk',v:0.6,d:0.50,name:'Blazing Blows'},'Uncommon'),
  U('Inferno Magus','Emberkin','Mage','r',5,520,100,.8,1.0,'☄️',{k:'transform',form:'Living Flame',fico:'🔥',hp:1.0,dmg:2.0,as:1.2,name:'Incarnate'},'Rare'),
  U('Spark Tosser','Emberkin','Archer','r',4,340,54,1.05,1.02,'🔥',{k:'beam',v:2.7,name:'Firework'},'Common'),
  U('Ashmaw Lizard','Emberkin','Beast','m',1,640,66,1.05,1.22,'🌋',{k:'transform',form:'Fire Drake',fico:'🐉',hp:1.0,dmg:2.0,as:1.15,name:'Evolve'},'Common'),
  U('Vael, the Living Flame','Emberkin','Mage','r',4,820,110,0.85,0.95,'♨️',{k:'quake',v:2.5,name:'Wave of Fire'},'Legendary'),
  // Tidecallers — slow/freeze (Mage)
  U('Tide Acolyte','Tidecallers','Mage','r',4,380,58,.9,1.2,'💧',{k:'banish',v:1.6,name:'Undertow'},'Uncommon'),
  U('Ice Lancer','Tidecallers','Archer','r',5,420,80,.9,1.1,'🧊',{k:'execute',v:.4,name:'Shatterlance'},'Common'),
  U('Frostguard','Tidecallers','Warrior','m',1,700,54,.8,1.1,'❄️',{k:'shield',v:260,name:'Glacial Shell'},'Common'),
  U('Leviathan Caller','Tidecallers','Mage','r',4,640,90,.75,1.0,'🌊',{k:'transform',form:'Leviathan',fico:'🐋',hp:1.0,dmg:2.0,as:1.0,rng:2,name:'Summon Leviathan'},'Rare'),
  // U('Mist Skirmisher','Tidecallers','Rogue','m',1,440,50,1.2,1.36,'🌊',{k:'blink',v:3.0,name:'Riptide'},'Common'),
  U('Glacier Warden','Tidecallers','Guardian','m',1,1150,54,0.6,0.8,'🧊',{k:'bulwark',v:300,r:2,name:'Wall of Ice'},'Uncommon'),
  U('Maris, the Frozen Tide','Tidecallers','Mage','r',5,900,100,0.8,0.88,'🐟',{k:'freeze',v:1.75,r:3,name:'Absolute Zero'},'Legendary'),
  // Stormherd — beastfolk shamans: attack speed & lightning (Beast/Mage)
  U('Thunderhide Bull','Stormherd','Beast','m',1,620,56,1.2,1.6,'🐃',{k:'transform',form:'Thunder Beast',fico:'🐃',hp:1.0,dmg:1.0,as:2.0,name:'Storm Avatar'},'Common'),
  U('Sky Shaman','Stormherd','Mage','r',4,420,66,.95,1.2,'🌩️',{k:'zone',v:0.6,r:1,dur:4,zico:'🌩️',zcol:'#ff7a3a',name:'Summon Storm'},'Uncommon'),
  // U('Lightning Dancer','Stormherd','Rogue','m',1,480,58,1.45,1.7,'💃',{k:'blink',v:3.0,name:'Storm Step'},'Uncommon'),
  U('Thunder Patriarch','Stormherd','Beast','m',1,900,76,1.0,1.3,'🦬',{k:'quake',v:1.4,name:'Stampede'},'Rare'),
  U('Galeclaw Skirmisher','Stormherd','Rogue','m',1,440,54,1.3,1.63,'🌩️',{k:'chain',v:1.7,j:5,name:'Chain Lightning'},'Common'),
  U('Totem Warden','Stormherd','Cleric','r',3,520,44,0.8,1.02,'🪶',{k:'rally',v:1.1,name:'Storm Totem'},'Uncommon'),
  // U('Roc Rider','Stormherd','Archer','r',5,640,82,1.05,1.5,'🌪️',{k:'beam',v:2.4,name:'Diving Tempest'},'Rare'),
  U('Kharz, Stormhorn Chieftain','Stormherd','Warrior','m',1,1050,100,1.1,1.5,'🐂',{k:'quake',v:2.0,name:'Thunderstomp'},'Legendary'),
  // Voidtouched — demons & warlocks: lifesteal & execute (Warrior/Mage/Rogue)
  U('Void Cultist','Voidtouched','Mage','r',4,400,70,.9,1.1,'👁️',{k:'charm',v:4,name:'Corrupt Mind'},'Common'),
  U('Soul Leech','Voidtouched','Rogue','m',1,520,62,1.25,1.5,'🦇',{k:'drain',v:3.2,name:'Blood Frenzy'},'Common'),
  U('Pit Tyrant','Voidtouched','Guardian','m',1,1100,82,.8,1.0,'😈',{k:'bulwark',v:300,r:2,name:'Abyssal Aegis'},'Rare'),
  U('Dread Reaver','Voidtouched','Warrior','m',1,780,76,0.9,1.02,'🔮',{k:'drain',v:2.8,name:'Reaping Sweep'},'Uncommon'),
  U('Pact Priest','Voidtouched','Cleric','r',3,470,56,0.8,1.02,'🌑',{k:'zone',v:0.55,r:1,dur:4,zico:'🔥',zcol:'#ff7a3a',name:'Dark Communion'},'Uncommon'),
  // U('Abyssal Summoner','Voidtouched','Mage','r',4,560,88,0.8,0.88,'👿',{k:'banish',v:1.5,name:'Open the Rift'},'Rare'),
  U('Xareth, the Soulflayer','Voidtouched','Mage','r',2,900,105,0.9,1.02,'💀',{k:'execute',v:.9,name:'Harvest of Souls'},'Legendary'),
  // Phoenix Cult — self-immolating rebirth
  U('Ash Disciple','Phoenix','Mage','r',4,400,68,.9,1.2,'🌋',{k:'zone',v:0.6,r:1,dur:5,zico:'🔥',zcol:'#ff8a3a',name:'Ember Field'},'Uncommon'),
  U('Flamewing Seer','Phoenix','Cleric','r',3,460,40,.8,1.1,'🕊️',{k:'heal',v:230,name:'Rekindle'},'Common'),
  U('Ember Acolyte','Phoenix','Mage','r',3,420,70,0.85,1.02,'🔥',{k:'nova',v:1.7,r:2,name:'Immolate'},'Common'),
  U('Ashen Zealot','Phoenix','Warrior','m',1,640,72,1.05,1.16,'🌋',{k:'nova',v:1.7,r:1,name:'Selfpyre'},'Uncommon'),
  U('Pyreborn Champion','Phoenix','Warrior','m',1,820,88,1.1,1.22,'♨️',{k:'nova',v:1.7,r:1,name:'Supernova'},'Rare'),
  U('The Undying Phoenix','Phoenix','Mage','r',2,1100,100,1.0,1.29,'☀️',{k:'beam',v:2.6,name:'Rebirth in Fire'},'Legendary'),
  // Gravewardens — stone constructs that harden under fire
  U('Stone Sentinel','Gravewardens','Guardian','m',1,980,46,.7,0.9,'🗿',{k:'bulwark',v:300,r:2,name:'Petrify'},'Uncommon'),
  U('Runekeeper','Gravewardens','Mage','r',3,520,56,.8,1.0,'🪬',{k:'bulwark',v:260,r:3,name:'Runic Ward'},'Common'),
  U('Granite Colossus','Gravewardens','Guardian','m',1,1250,72,.7,0.8,'🏔️',{k:'transform',form:'Mountain Titan',fico:'🗻',hp:1.4,dmg:2.0,as:1.0,name:'Titan Form'},'Uncommon'),
  U('Gravel Golem','Gravewardens','Guardian','m',1,1100,42,0.55,0.8,'⚙️',{k:'banish',v:1.5,name:'Boulder Toss'},'Common'),
  U('Rune Colossus','Gravewardens','Guardian','m',1,1300,58,0.5,0.8,'🗽',{k:'quake',v:1.6,name:'Seismic Slam'},'Rare'),
  U('The Eternal Bulwark','Gravewardens','Guardian','m',1,2000,55,0.45,0.8,'🤖',{k:'bulwark',v:600,r:3,name:'Unbreakable'},'Legendary'),
  // Hivemind — insect swarm, spawns Swarmlings
  U('Mantis Striker','Hivemind','Rogue','m',1,460,54,1.35,1.6,'🦗',{k:'blink',v:3.0,name:'Ambush'},'Uncommon'),
  U('Beetle Bulwark','Hivemind','Guardian','m',1,900,50,.8,1.0,'🪲',{k:'bulwark',v:280,r:2,name:'Carapace Wall'},'Uncommon'),
  U('Drone Tender','Hivemind','Cleric','r',3,440,36,.85,1.2,'🐝',{k:'heal',v:200,name:'Royal Jelly'},'Rare'),
  U('Skitterer','Hivemind','Beast','m',1,260,24,1.5,1.63,'🐝',{k:'summon',v:1,n:2,token:'swarmling',name:'Multiply'},'Common'),
  U('Spitter Drone','Hivemind','Archer','r',3,240,30,1.2,1.22,'🦗',{k:'curse',v:1,r:2,name:'Corrosive Cloud'},'Common'),
  // U('Brood Warden','Hivemind','Cleric','r',3,520,40,1.0,1.09,'🦂',{k:'summon',v:1,n:3,token:'swarmling',name:'Endless Swarm'},'Rare'),
  U('The Brood Mother','Hivemind','Beast','m',1,1800,70,1.0,0.88,'🐞',{k:'summon',v:1,n:4,token:'swarmling',name:'Endless Brood'},'Legendary'),
  // Stargazers — ultimate acceleration
  U('Star Acolyte','Stargazers','Mage','r',4,380,62,.95,1.2,'✨',{k:'beam',v:2.0,name:'Shooting Star'},'Uncommon'),
  U('Astral Blade','Stargazers','Warrior','m',1,680,66,1.0,1.3,'🌠',{k:'blink',v:3.2,name:'Star Step'},'Common'),
  U('Comet Herald','Stargazers','Mage','r',5,540,92,.8,1.0,'☄️',{k:'zone',v:0.7,r:2,dur:4,zico:'☄️',zcol:'#c8a6ff',name:'Meteor Field'},'Rare'),
  U('Astral Weaver','Stargazers','Mage','r',4,440,72,0.7,0.95,'🔭',{k:'curse',v:1,r:2,name:'Gravity Well'},'Common'),
  U('Celestial Magus','Stargazers','Mage','r',5,500,90,0.65,0.88,'🌠',{k:'chain',v:1.6,j:9,name:'Supernova Cascade'},'Uncommon'),
  U('The Cosmic Oracle','Stargazers','Mage','r',5,760,95,0.7,0.95,'🌌',{k:'rally',v:1.0,name:'Convergence'},'Legendary'),
  // Arachnari — webs that root, amplified damage on webbed foes
  // U('Fang Matriarch','Arachnari','Beast','m',1,940,76,1.0,1.2,'🕸',{k:'drain',v:3.0,name:'Devouring Brood'},'Rare'),
  U('Web Spinner','Arachnari','Rogue','m',1,380,40,1.2,1.43,'🕷️',{k:'freeze',v:1.5,r:1,name:'Ensnaring Burst'},'Common'),
  U('Silk Slinger','Arachnari','Archer','r',4,340,52,0.95,1.16,'🕸️',{k:'nova',v:1.7,r:2,name:'Sticky Volley'},'Common'),
  U('Venomfang Lurker','Arachnari','Rogue','m',1,460,58,1.3,1.56,'🪺',{k:'blink',v:3.0,name:'Jumping Spider'},'Uncommon'),
  U('Broodmother Acolyte','Arachnari','Cleric','r',3,480,42,0.85,1.09,'🥚',{k:'summon',v:1,n:3,token:'broodling',name:'Hatch Swarm'},'Rare'),
  // U('Weaver Mage','Arachnari','Mage','r',4,420,70,0.8,0.95,'🪳',{k:'zone',v:0.55,r:2,dur:4,zico:'🕸️',zcol:'#a1887f',name:'Web Prison'},'Uncommon'),
  U('Carapace Sentinel','Arachnari','Guardian','m',1,1050,64,0.7,0.88,'🜸',{k:'bulwark',v:420,r:2,name:'Living Web Wall'},'Uncommon'),
  U('Queen Atraxa, the Brood Empress','Arachnari','Mage','r',3,1150,98,0.9,1.02,'👑',{k:'summon',v:1,n:4,token:'broodling',name:'Tangleweb Cataclysm'},'Legendary'),
  // Myconid Bloom — spreading poison spores
  U('Spore Sprout','Myconid','Beast','m',1,520,48,1.0,1.2,'🍄',{k:'zone',v:0.5,r:1,dur:5,zico:'🟢',zcol:'#9ccc65',name:'Spore Cloud'},'Common'),
  U('Puffcap Lobber','Myconid','Archer','r',4,420,62,.9,1.1,'🌫️',{k:'zone',v:0.55,r:2,dur:4,zico:'🟢',zcol:'#aed581',name:'Spore Bomb'},'Common'),
  U('Bloom Sage','Myconid','Cleric','r',3,480,40,.8,1.0,'🌺',{k:'charm',v:4,name:'Spore Thrall'},'Rare'),
  // U('Fungal Forager','Myconid','Beast','m',1,460,44,1.0,1.16,'🌫️',{k:'zone',v:0.55,r:1,dur:4,zico:'🟢',zcol:'#9ccc65',name:'Spore Spray'},'Common'),
  U('Myco-Alchemist','Myconid','Mage','r',4,440,68,0.8,0.95,'🍂',{k:'zone',v:0.8,r:2,dur:4,zico:'🟢',zcol:'#9ccc65',name:'Toxic Bloom'},'Uncommon'),
  U('Sporemother Tender','Myconid','Cleric','r',3,470,40,0.8,1.02,'🟫',{k:'heal',v:280,name:'Bloomheal'},'Uncommon'),
  // U('Contagion Walker','Myconid','Rogue','m',1,500,58,1.2,1.36,'🌺',{k:'blink',v:3.0,name:'Plague Lunge'},'Common'),
  U('Mycelia, the Deep Mother','Myconid','Mage','r',3,1150,95,0.85,0.88,'🌳',{k:'zone',v:1.0,r:3,dur:6,zico:'🟢',zcol:'#9ccc65',name:'Spore Apocalypse'},'Legendary'),
  // Grimgear Goblins — engineers who build turrets & bots
  U('Boom Lobber','Grimgear','Archer','r',4,400,72,.85,1.2,'🧨',{k:'nova',v:1.7,r:1,name:'Big Boom'},'Common'),
  // U('Cog Brawler','Grimgear','Warrior','m',1,640,60,1.05,1.3,'🔧',{k:'zone',v:0.6,r:1,dur:4,zico:'💥',zcol:'#ffb300',name:'Minefield'},'Uncommon'),
  U('Mecha-Pilot','Grimgear','Guardian','m',1,1020,70,.8,1.0,'🤖',{k:'banish',v:1.7,name:'Steam Punch'},'Uncommon'),
  U('Pop-Shot Goblin','Grimgear','Archer','r',4,330,50,1.05,1.16,'🤖',{k:'doubleaxe',v:3.5,name:'Double Barrel'},'Uncommon'),
  U('Sapper','Grimgear','Rogue','m',1,380,55,1.15,1.5,'🔧',{k:'zone',v:0.6,r:1,dur:4,zico:'💥',zcol:'#ffb300',name:'Plant Mines'},'Common'),
  U('Tinker Engineer','Grimgear','Mage','r',3,420,40,0.8,1.09,'🛠️',{k:'summon',v:1,n:2,token:'scrapbot',name:'Deploy Bots'},'Rare'),
  U('Grizzlemaw, the Warboss-Inventor','Grimgear','Mage','r',4,1050,90,0.9,1.02,'🚀',{k:'summon',v:1,n:4,token:'scrapbot',name:'Cogwork Cataclysm'},'Legendary'),
  // Hollow Legion — fallen rise as skeletons
  U('Bone Soldier','Hollow','Warrior','m',1,600,52,.9,1.1,'💀',{k:'blink',v:2.8,name:'Grave Lunge'},'Common'),
  // U('Death Priest','Hollow','Cleric','r',3,500,42,.8,1.0,'⚰️',{k:'charm',v:4,name:'Enthrall'},'Rare'),
  U('Bone Archer','Hollow','Archer','r',4,320,58,0.9,1.02,'🦴',{k:'zone',v:0.55,r:2,dur:4,zico:'🟣',zcol:'#9b59b6',name:'Barrage of Bones'},'Common'),
  // U('Ghoul Prowler','Hollow','Rogue','m',1,400,52,1.2,1.36,'⚰️',{k:'execute',v:0.3,name:'Feast'},'Common'),
  U('Necromancer','Hollow','Mage','r',4,460,60,0.75,0.95,'🕯️',{k:'summon',v:1,n:3,token:'skeleton',name:'Army of the Dead'},'Uncommon'),
  U('Grave Knight','Hollow','Warrior','m',1,760,72,0.85,0.95,'👻',{k:'drain',v:2.8,name:'Death\'s Embrace'},'Uncommon'),
  // U('Bone Chorister','Hollow','Cleric','r',3,480,42,0.8,1.02,'☠️',{k:'heal',v:260,name:'Dirge of Mending'},'Uncommon'),
  U('Lich Adept','Hollow','Mage','r',5,560,92,0.75,0.88,'🪦',{k:'curse',v:1,r:2,name:'Mass Decay'},'Rare'),
  U('Mortis, the Bone Sovereign','Hollow','Mage','r',4,880,98,0.8,0.88,'👑',{k:'beam',v:10.0,name:'Finger of Death'},'Legendary'),
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

