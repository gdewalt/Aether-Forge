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
export const ABILITIES={
  "Brigand Captain":"Warlord: nearby allies +10% damage.",
  "Master Outlaw":"Deadeye: +20% crit chance.",
  "Dire Alpha":"Apex Predator: nearby allies +8% attack speed.",
  "Elder Treant":"Ancient Bark: attackers take 25% reflected damage.",
  "Plague Matron":"Contagion: attacks apply poison.",
  "Bog Horror":"Gluttonous: heals 5% max HP whenever a nearby enemy dies.",
  "Praetorian Colossus":"Immovable: cannot be knocked back.",
  "Siege Walker":"Siege Protocol: attacks ignore 20% of target armor.",
  "Glacier Warlord":"Permafrost: attacks apply slow.",
  "Blizzard Shaman":"Whiteout: attacks apply slow.",
  "Forge Tyrant":"Molten Core: attacks apply burn.",
  "Artillery Master":"Incendiary Shells: attacks apply burn.",
  "Void Prophet":"Maddening Aura: nearby allies take -8% magic damage (ward field).",
  "Abyssal Behemoth":"Voracious: lifesteal 12% of damage dealt.",
  "Valkyrie Champion":"Storm-Charged: ultimate charges 20% faster.",
  "Storm Jarl":"Gale Force: nearby allies +8% attack speed.",
  "Drake Knight":"Dragonscale: converts 12% of damage taken into armor (aegis).",
  "Dominion Archon":"Dread Focus: ultimate charges 20% faster.",
  "Cutthroat":"Opportunist: +15% crit chance.",
  "Brigand":"Plunderer: lifesteal 10% of damage dealt.",
  "Bandit Archer":"Barbed Arrows: attacks apply bleed.",
  "Thug":"Brawler: +12% armor while adjacent to 2+ allies.",
  "Highwayman":"Cutthroat: +20% damage vs wounded (<50% HP).",
  "Dire Wolf":"Pack Hunter: nearby allies +8% attack speed.",
  "Boar":"Thick Hide: attackers take 20% reflected damage.",
  "Treant Sapling":"Rooted: regenerates 2% max HP/sec while stationary.",
  "Spitting Viper":"Venomous: attacks apply poison.",
  "Pack Alpha":"Alpha: nearby allies +8% attack speed.",
  "Cultist":"Plague-Touched: attacks apply poison.",
  "Bog Lurker":"Ambusher: +15% crit chance.",
  "Toad Brute":"Warty Hide: attackers take 20% reflected damage.",
  "Mire Priest":"Foul Grace: heals lowest-HP ally for 80 every 4s.",
  "Swamp Hag":"Mire: attacks apply slow.",
  "Sentinel Automaton":"Plating: converts 12% of damage taken into armor (aegis).",
  "Rust Pikebot":"Phalanx: +12% armor while adjacent to another ally.",
  "Siege Engine":"Siege Protocol: attacks ignore 20% of target armor.",
  "Iron Praetor":"Command Aura: nearby allies +10% damage.",
  "Cogsmith Drone":"Field Repair: shields the nearest ally for 90 every 5s.",
  "Frost Raider":"Coldblood: +20% damage while above 60% HP.",
  "Ice Shaman":"Rime: attacks apply slow.",
  "Tundra Bear":"Hibernal Hide: attackers take 20% reflected damage.",
  "Snow Stalker":"Frostblade: +25% damage vs frozen.",
  "Frost Giant":"Immovable: cannot be knocked back.",
  "Flame Cannon":"Incendiary: attacks apply burn.",
  "Forge Guard":"Molten Skin: attackers take 25% reflected damage.",
  "Pyrolancer":"Searing: attacks apply burn.",
  "Magma Adept":"Heat Haze: nearby allies take -8% magic damage (ward field).",
  "Cinder Sprite":"Ember Trail: attacks apply burn.",
  "Deep Cultist":"Eldritch: +20% damage vs wounded (<50% HP).",
  "Tide Spawn":"Engulfing: lifesteal 10% of damage dealt.",
  "Star Seer":"Maddening: attacks apply slow.",
  "Reef Priest":"Deep Grace: heals lowest-HP ally for 90 every 4s.",
  "Tentacle Horror":"Devourer: heals 5% max HP whenever a nearby enemy dies.",
  "Valkyrie":"Winged: +15% crit chance.",
  "Thunder Lord":"Storm-Charged: ultimate charges 20% faster.",
  "Storm Cavalry":"Lancer: +20% damage while above 60% HP.",
  "Sky Warden":"Aegis: converts 12% of damage taken into armor.",
  "Tempest Rider":"Gale: nearby allies +8% attack speed.",
  "Tyrant Guard":"Unbreakable: cannot be knocked back.",
  "Dominion Mage":"Dread Focus: ultimate charges 20% faster.",
  "Death Knight":"Dread Blade: +25% damage vs wounded (<50% HP).",
  "Soul Reaver":"Soul Harvest: heals 5% max HP whenever a nearby enemy dies.",
  "Royal Cleric":"Royal Grace: heals lowest-HP ally for 90 every 4s.",
  'Footman':'Bulwark: while adjacent to 2+ allies, gains +15% armor.',
  'Spearman':'Reach: +1 range while adjacent to a friendly unit.',
  'Archer':'Take Aim: every 4th shot deals +60% damage.',
  'Crossbowman':'Piercing Bolt: attacks ignore 25% of target armor.',
  'Mercenary':'Veteran: +10% damage while above 60% HP.',
  'Wandering Mage':'Arcane Momentum: gains +12 magic charge whenever any enemy dies.',
  'Shieldbreaker':'Hold the Line: +12% armor while adjacent to another Dwarf.',
  'Anvil Priest':'Forgeheart (periodic 4s): heals & shields a front-line ally.',
  'Axe Thrower':'Heavy Throw: attacks ignore 20% armor.',
  'Hammerguard':'Crushing Blow: every 4th hit ignores 30% armor.',
  'Runesmith':'Runic Ward (periodic 4s): shields nearest ally for 120.',
  'Cannoneer':'Grapeshot: hits a 2-hex blast at the target.',
  'Mountain King':'Unyielding: cannot be knocked back; +15% DMG below 50% HP.',
  'Thane Brokk Ironfist':'Forgefather: counts as two units toward Ironhold and Warrior synergies.',
  'Briar Scout':'Tangleshot: hits slow the target 15% 2s.',
  'Druid of the Grove':'Regrowth (periodic 4s): heals lowest-HP ally 100. Its magic charges 60% faster; at full charge it Wild Shapes into a Grizzly Bear.',
  'Greenwood Archer':'Keen Eye: +1 range while no enemy is adjacent.',
  'Moonpetal Sage':'Moonfire: attacks chain a small bolt to a 2nd enemy.',
  'Thornblade Dancer':'Evasion: 20% chance to dodge an attack.',
  'Treant Warden':'Rooted Strength: regenerates 2% HP/sec while stationary.',
  'Hawkeye Ranger':'Hunter\'s Mark: marked target takes +15% from all sources.',
  'Lady Aelwyn, Voice of the Wild':'Court\'s Blessing: all Sylvan attacks pierce 1 extra target.',
  'Squire of Dawn':'Dawnward: while adjacent to an ally, takes -12% damage.',
  'Acolyte Medic':'Mend (periodic 3s): heals lowest-HP ally 80.',
  'Lightbringer':'Radiance: attacks heal the nearest ally for 25% of dmg.',
  'Templar':'Righteous Fury: +20% vs Voidtouched/undead.',
  'High Paladin':'Aegis of Light: allies behind take -15% damage.',
  'Seraphine, the Dawnward':'Guardian Angel: first ally to fall each battle revives at 50%.',
  'Cub Skirmisher':'Quick Claws: first attack each fight applies 2 Bleed.',
  'Maned Brawler':'Bloodscent: +20% AS vs any bleeding enemy.',
  'Pridehunter':'Hamstring Shot: hits on bled targets slow them 20% 2s.',
  'Savannah Seer':'Pridesong: attacks heal the lowest-HP ally for 20% of damage dealt.',
  'Pride Matriarch':'Queen\'s Roar (periodic 5s): Leonin +1 max Bleed stack & +10% AS.',
  'Sunmane Duelist':'Riposte: on being hit, counter for 50% + 1 Bleed.',
  'Ashmaw Lizard':'Feeding Frenzy: +5% AS per burning enemy on field.',
  'Salamander Brave':'Molten Skin: melee attackers take burn damage.',
  'Spark Tosser':'Scattering Sparks: attacks ignite 1 nearby enemy too.',
  'Pyromancer':'Conflagration: +30% to already-burning targets.',
  'Inferno Magus':'Wildfire: burns spread to adjacent enemies each tick.',
  'Vael, the Living Flame':'Eternal Pyre: all burns on the field deal +50%.',
  'Frostguard':'Rime Armor: gains armor as nearby enemies are slowed.',
  'Mist Skirmisher':'Flash Freeze: first hit on a target applies 2 Slow stacks.',
  'Glacier Warden':'Cold Front: enemies adjacent are slowed 25%.',
  'Tide Acolyte':'Chill: attacks slow target 15% 2s (stacks).',
  'Ice Lancer':'Piercing Frost: +40% vs frozen targets.',
  'Leviathan Caller':'Deep Chill: periodically applies a Slow stack to a nearby enemy.',
  'Maris, the Frozen Tide':'Eternal Winter: enemies near Tidecallers are slowed.',
  'Galeclaw Skirmisher':'Windrunner: +AS the further it traveled before attacking.',
  'Lightning Dancer':'Static Step: every 3rd attack chains a small jolt to a nearby foe.',
  'Sky Shaman':'Conduction: bonus damage to enemies already hit by lightning this fight.',
  'Stormhoof Charger':'Momentum: gains +4% attack speed each second in combat (caps at +24%).',
  'Totem Warden':'Spirit Totem (periodic 4s): nearby allies +12% AS.',
  'Thunder Patriarch':'Stormcaller: nearby allies gain +8% attack speed.',
  'Kharz, Stormhorn Chieftain':'Heart of the Storm: all crits chain lightning to 2 foes.',
  'Roc Rider':'Skyborne Dive: teleports to the enemy back row at the start of combat, gaining +20% move speed.',
  'Soul Leech':'Siphon: basic attacks heal for 12% of damage dealt.',
  'Void Cultist':'Corruption: marked foes take +10% damage from all sources for 3s.',
  'Abyssal Summoner':'Demonic Pact: every 6s summons a temporary lesser demon.',
  'Dread Reaver':'Unholy Vigor: lifesteals 30%.',
  'Pact Priest':'Blood Tithe (periodic 4s): heals the lowest-HP ally, paying a little of its own HP.',
  'Pit Tyrant':'Devour: heals 5% max HP whenever a nearby enemy dies.',
  'Xareth, the Soulflayer':'Soul Engine: every enemy death = Voidtouched +3% DMG permanently.',
  'Ash Disciple':'Cinders: attacks apply a small burn that ticks for 2s.',
  'Ashen Zealot':'Martyr: below 30% HP, attacks +50% DMG.',
  'Ember Acolyte':'Searing Bolt: deals 70; self takes 8% of damage dealt.',
  'Flamewing Seer':'Cinder Link: attacks burn self 6%, heal a Phoenix ally 6%.',
  'Pyreborn Champion':'Eternal Flame: +25% DMG per time it has died this battle.',
  'The Undying Phoenix':'Reignite (periodic 6s): heals 10% max HP to all Phoenix; self burns 5%.',
  'Gravel Golem':'Crumble Guard: takes -20% damage from the first hit of each enemy.',
  'Runekeeper':'Ward Field: allies within 2 hexes take -8% magic damage.',
  'Stone Sentinel':'Immovable: cannot be knocked back; +10% armor while stationary.',
  'Rune Colossus':'Stoneskin (periodic 5s): self & adjacent allies gain a 180 shield.',
  'Granite Colossus':'Immovable: cannot be knocked back; +15% armor while stationary.',
  'The Eternal Bulwark':'Living Wall: all friendly units take -10% ranged damage.',
  'Beetle Bulwark':'Carapace: gains +6% armor for each living Hivemind ally.',
  'Skitterer':'Breed: every 3rd attack spawns a Swarmling.',
  'Spitter Drone':'Acid Spit: attacks reduce armor by 3 (stacks, max 8).',
  'Drone Tender':'Royal Jelly (periodic 4s): heals lowest-HP Hivemind + spawns a Swarmling.',
  'Mantis Striker':'Scything: attacks against full-HP foes deal +25%.',
  'Brood Warden':'Hatchery (periodic 4s): spawns 2 Swarmlings near lowest-HP ally.',
  'The Brood Mother':'Living Hive: Swarmlings gain +40% HP and never expire.',
  'Astral Blade':'Star-Touched: ultimate charges 15% faster.',
  'Astral Weaver':'Entropy: when an enemy ults, deal 250 to it.',
  'Star Acolyte':'Focus: +12% damage to the farthest enemy in range.',
  'Celestial Magus':'Resonance: each allied ult fired grants self +20 magic.',
  'Comet Herald':'Falling Stars: every 5s, a small meteor hits a random foe.',
  'The Cosmic Oracle':'Echoing Cosmos: friendly ultimates have a 25% chance to fire a second time.',
  'Silk Slinger':'Webshot: attacks apply 1 Web stack (slow 12%, stacks).',
  'Web Spinner':'Spinneret: every 3rd attack spawns a Broodling.',
  'Broodmother Acolyte':'Nurture (periodic 4s): heals lowest-HP ally + spawns a Broodling.',
  'Carapace Sentinel':'Web Anchor: adjacent enemies slowed 20%; immune to displacement.',
  'Venomfang Lurker':'Pounce: +30% damage vs webbed/slowed targets.',
  'Weaver Mage':'Entangling Field: attacks leave a web hex that slows.',
  'Fang Matriarch':'Venomfang: attacks heal for 10% and apply light poison.',
  'Queen Atraxa, the Brood Empress':'Living Hive: Broodlings never expire and apply +1 Web stack.',
  'Fungal Forager':'Mulch: heals 3% max HP/sec while in any spore cloud.',
  'Spore Sprout':'Spore Burst: on death, leaves a poison cloud for 3s.',
  'Bloom Sage':'Symbiosis: healed allies also gain +5% attack speed for 3s.',
  'Contagion Walker':'Carrier: when a poisoned enemy dies, poison jumps to nearest.',
  'Myco-Alchemist':'Virulence: deals +15% damage to poisoned enemies.',
  'Puffcap Lobber':'Spore Shot: attacks apply light poison.',
  'Sporemother Tender':'Symbiosis (periodic 4s): heals an ally and cleanses its debuffs.',
  'Mycelia, the Deep Mother':'Mycelial Network: while Mycelia is alive, your spore clouds never expire and slow enemies inside them.',
  'Sapper':'Demolition: +40% vs Guardians/constructs & high armor.',
  'Tinker Engineer':'Assemble (periodic 5s): builds a Scrap Bot nearby.',
  'Boom Lobber':'Shrapnel: attacks splash 30% damage to foes adjacent to the target.',
  'Cog Brawler':'Overbuilt: +10% armor and +10% HP while a turret/bot ally is alive.',
  'Pop-Shot Goblin':'Potshot: every 4th shot explodes, splashing 1 adjacent.',
  'Mecha-Pilot':'Piloted Walker: a construct; +5% DMG per friendly robot/turret.',
  'Grizzlemaw, the Warboss-Inventor':'Mass Production: friendly turrets and robots have +50% stats and slowly regenerate health.',
  'Bone Soldier':'Undying: revives once as a weaker skeleton on death.',
  'Ghoul Prowler':'Carrion: +20% damage vs wounded (<50% HP) targets.',
  'Bone Archer':'Brittle Bolts: attacks reduce target healing 30%.',
  'Bone Chorister':'Dirge (periodic 4s): heals the lowest-HP ally and grants it +10 magic charge.',
  'Death Priest':'Soul Harvest: heals nearby allies when an enemy dies.',
  'Grave Knight':'Soul Harvest: +6% DMG per enemy that has died.',
  'Necromancer':'Raise Dead (periodic 5s): summons a Skeleton at an ally death site.',
  'Lich Adept':'Decay: a spreading DoT that worsens over time.',
  'Mortis, the Bone Sovereign':'Endless Host: your skeletons never expire.'
};
// returns {name, desc} for a unit's passive Magic Ability (from the design roster), or null
export function abilityFor(u){
  const raw=ABILITIES[u.name]; if(!raw) return null;
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

