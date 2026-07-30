// @ts-nocheck
import { ACT_ENEMIES, BOSSES, ELITES, ENEMY_FACTIONS } from "./data-enemies.js";
import { COLS, G, ROWS } from "./engine-hex.js";
import { GLOBAL_DIFF, actDmgMult, actHpMult } from "./engine-combat.js";
import { RNG, pick, rint } from "./rng.js";
import { asc, ascEnemyMult } from "./data-units.js";
import { clone } from "./flow-forge.js";
import { showPlan } from "./ui-planning.js";
import { toast } from "./ui-tooltips.js";
import forestIcon from "../assets/terrain/forest.png";
import highIcon from "../assets/terrain/high.png";
import sacredIcon from "../assets/terrain/sacred.png";
import lavaIcon from "../assets/terrain/lava.png";
import rubbleIcon from "../assets/terrain/rubble.png";

/* ---------- battlefield terrain art (painterly cell-shaded mini-tiles, shown on hex overlays) ---------- */
export const TERRAIN_ICONS={
  forest:forestIcon, high:highIcon, sacred:sacredIcon, lava:lavaIcon, rubble:rubbleIcon,
};

/* ============================================================
   BATTLE
   ============================================================ */
/* ---------- BATTLE EVENT MODIFIERS (GDD §20) ---------- */
export const BATTLE_MODS=[
  {id:'bloodmoon',name:'Blood Moon',ico:'🌕',desc:'All units +25% damage, -15% max HP.',
   apply:(P,E)=>[...P,...E].forEach(u=>{u.dmg*=1.25;u.hp*=.85;u.maxhp=u.hp;})},
  {id:'thickfog',name:'Thick Fog',ico:'🌫️',desc:'Ranged attack range reduced by 1.',
   apply:(P,E)=>[...P,...E].forEach(u=>{if(u.t==='r')u.rng=Math.max(2,u.rng-1);})},
  {id:'highwinds',name:'High Winds',ico:'🌬️',desc:'All units move 30% faster.',
   apply:(P,E)=>[...P,...E].forEach(u=>{u.mv*=1.3;})},
  {id:'arcanesurge',name:'Arcane Surge',ico:'🔮',desc:'Magic bars charge 50% faster.',
   apply:(P,E)=>[...P,...E].forEach(u=>{u.chargeMul=(u.chargeMul||1)*1.5;})},
  {id:'ironcurse',name:'Curse of Rust',ico:'🦠',desc:'Armor & damage reduction halved.',
   apply:(P,E)=>[...P,...E].forEach(u=>{u.dr=(u.dr||0)*0.5;})},
  {id:'longshadows',name:'Long Shadows',ico:'🌑',desc:'Rogues deal +30% damage.',
   apply:(P,E)=>[...P,...E].forEach(u=>{if(u.cls==='Rogue')u.dmg*=1.3;})},
];
/* ---------- EVENT MODIFIERS (GDD §20) — player-chosen, single-battle, set via Event nodes ----------
   Three flavors: Buff (clean edge), Debuff (a price paid for another reward), Gamble (high-variance).
   Each is stored on G._eventMod and applied once at the next battle's start, then cleared.
   apply:(P,E)=> mutate player array P and/or enemy array E. revealEnemy flags the planning screen. */
export const EVENT_MODS=[
  // --- BUFFS ---
  {id:'em_shrine',  flavor:'Buff', name:'Ancient Shrine',  ico:'\u26e9\ufe0f', desc:'Your army deals +20% damage next battle.',
   apply:(P,E)=>P.forEach(u=>u.dmg*=1.20)},
  {id:'em_wardrums',flavor:'Buff', name:'War Drums',       ico:'\ud83e\udd41', desc:'Your ultimates charge 50% faster next battle.',
   apply:(P,E)=>P.forEach(u=>u.chargeMul=(u.chargeMul||1)*1.5)},
  {id:'em_omen',    flavor:'Buff', name:'Omen of Ruin',    ico:'\ud83d\udc41\ufe0f', desc:'Reveal enemy placement and gain +1 Army Cap next battle.',
   apply:(P,E)=>{}, capBonus:1, revealEnemy:true},
  {id:'em_bulwark', flavor:'Buff', name:'Bulwark Blessing',ico:'\ud83d\udee1\ufe0f', desc:'Your army takes \u221218% damage next battle.',
   apply:(P,E)=>P.forEach(u=>u.dr=Math.min(.85,(u.dr||0)+0.18))},
  {id:'em_swift',   flavor:'Buff', name:'Windrunner Hymn', ico:'\ud83c\udf2c\ufe0f', desc:'Your army moves & attacks 15% faster next battle.',
   apply:(P,E)=>P.forEach(u=>{u.mv*=1.15;u.as*=1.15})},
  {id:'em_vanguard',flavor:'Buff', name:'Vanguard Oath',   ico:'\u2694\ufe0f', desc:'Your army starts next battle with 30% magic charge.',
   apply:(P,E)=>P.forEach(u=>u.mag=Math.max(u.mag||0,30))},
  {id:'em_focus',   flavor:'Buff', name:'Seer\u2019s Focus', ico:'\ud83d\udd2e', desc:'Your ultimates hit 25% harder next battle.',
   apply:(P,E)=>P.forEach(u=>u.ultMul=(u.ultMul||1)*1.25)},
  // --- DEBUFFS (usually accepted as the price of a reward elsewhere) ---
  {id:'em_cursedidol',flavor:'Debuff',name:'Cursed Idol',  ico:'\ud83d\uddff', desc:'Your army deals \u221215% damage next battle.',
   apply:(P,E)=>P.forEach(u=>u.dmg*=0.85)},
  {id:'em_plague',  flavor:'Debuff',name:'Plague Wind',    ico:'\u2623\ufe0f', desc:'Your units start next battle poisoned.',
   apply:(P,E)=>P.forEach(u=>{u.poisonT=4;})},
  {id:'em_frozen',  flavor:'Debuff',name:'Frozen Pass',    ico:'\u2744\ufe0f', desc:'Your army moves 20% slower next battle.',
   apply:(P,E)=>P.forEach(u=>u.mv*=0.8)},
  {id:'em_brittle', flavor:'Debuff',name:'Brittle Armor',  ico:'\ud83e\uddb4', desc:'Your army\u2019s damage reduction is halved next battle.',
   apply:(P,E)=>P.forEach(u=>u.dr=(u.dr||0)*0.5)},
  {id:'em_fatigue', flavor:'Debuff',name:'Battle Fatigue', ico:'\ud83d\ude29', desc:'Your army attacks 12% slower next battle.',
   apply:(P,E)=>P.forEach(u=>u.as*=0.88)},
  {id:'em_emboldened',flavor:'Debuff',name:'Emboldened Foe',ico:'\ud83d\ude08',desc:'The enemy deals +12% damage next battle.',
   apply:(P,E)=>E.forEach(u=>u.dmg*=1.12)},
  {id:'em_thinned', flavor:'Debuff',name:'Thinned Ranks',  ico:'\ud83e\ude78', desc:'Your units enter next battle at 80% HP.',
   apply:(P,E)=>P.forEach(u=>{u.hp=Math.round(u.maxhp*0.8)})},
  // --- GAMBLES (high-variance, opt-in) ---
  {id:'em_coin',    flavor:'Gamble',name:'Gambler\u2019s Coin',ico:'\ud83e\ude99',desc:'50/50: your army gains +30% or \u221230% damage next battle.',
   apply:(P,E)=>{const up=RNG()<0.5;P.forEach(u=>u.dmg*=up?1.3:0.7);}},
  {id:'em_pact',    flavor:'Gamble',name:'Pact of Power',  ico:'\ud83d\udd25', desc:'+40% damage, but your army cannot be healed next battle.',
   apply:(P,E)=>P.forEach(u=>{u.dmg*=1.4;u.noHeal=true})},
  {id:'em_bargain', flavor:'Gamble',name:'Mystic Bargain', ico:'\u2728', desc:'Start next battle with full ultimates, but at \u221230% HP.',
   apply:(P,E)=>P.forEach(u=>{u.mag=100;u.hp=Math.round(u.maxhp*0.7)})},
  {id:'em_allin',   flavor:'Gamble',name:'All or Nothing', ico:'\ud83c\udfb2', desc:'+50% attack speed, but \u221225% max HP next battle.',
   apply:(P,E)=>P.forEach(u=>{u.as*=1.5;u.hp=Math.round(u.hp*0.75);u.maxhp=u.hp})},
  {id:'em_glasscannon',flavor:'Gamble',name:'Glass Cannon',ico:'\ud83d\udc8e',desc:'+45% damage, but your army takes +25% damage next battle.',
   apply:(P,E)=>P.forEach(u=>{u.dmg*=1.45;u.dr=(u.dr||0)-0.25})},
  {id:'em_berserk', flavor:'Gamble',name:'Bloodfury Rite', ico:'\ud83e\ude78', desc:'+35% attack speed, but enemies also gain +15% damage.',
   apply:(P,E)=>{P.forEach(u=>u.as*=1.35);E.forEach(u=>u.dmg*=1.15);}},
];
export const EVENT_MODS_BY_ID=Object.fromEntries(EVENT_MODS.map(m=>[m.id,m]));
export function setEventMod(m){ if(G._eventMod && G._eventMod.id!==m.id) toast('⚠️ '+G._eventMod.name+' replaced'); G._eventMod=m; if(m.capBonus)G._eventModCap=m.capBonus; else G._eventModCap=0; toast(m.ico+' '+m.name+' \u2014 active next battle'); }
export function eventModOf(flavor){ return pick(EVENT_MODS.filter(m=>m.flavor===flavor)); }

export function rollBattleMod(node){
  // ~35% of standard battles, 50% of elites; never the first battle, always announce
  if(G.cleared===0) return null;
  let chance = node.t==='elite'?0.5 : node.t==='battle'?0.35 : 0.25;
  if(asc()>=8) chance=Math.min(0.95, chance+0.4);   // A8: Cursed Map
  return RNG()<chance ? pick(BATTLE_MODS) : null;
}
export function startBattle(node){
  // Event Modifier army-cap bonus (Omen of Ruin) applies for this battle's planning, restored after.
  if(G._eventModCap){ G._capSaved=G.cap; G.cap+=G._eventModCap; G._eventModCap=0; }
  G.battle={node, phase:'plan', placements:{}, mod:rollBattleMod(node), terrain:genTerrain()};
  buildEnemyArmy(node);
  showPlan();
}
/* ---------- TERRAIN (GDD §4) — generated in the neutral middle columns ---------- */
export const TERRAIN_META={forest:{ico:'🌲',col:'rgba(76,140,74,.30)',name:'Forest',desc:'-25% incoming ranged damage; slower movement through it'},
                    high:{ico:'⛰️',col:'rgba(160,140,90,.30)',name:'High Ground',desc:'+1 range & +10% ranged damage for the unit standing here'},
                    rubble:{ico:'🪨',col:'rgba(110,105,120,.40)',name:'Rubble',desc:'Impassable — blocks movement and shapes choke points'},
                    sacred:{ico:'✨',col:'rgba(150,130,235,.34)',name:'Sacred Ground',desc:'+25% ultimate charge rate while standing here'},
                    lava:{ico:'🌋',col:'rgba(225,90,45,.40)',name:'Lava',desc:'Burns any unit standing on it each second; the AI avoids pathing through it'}};
export function genTerrain(){
  const t={};
  const used=new Set();
  const allCols=[...Array(COLS).keys()];           // every column 0..COLS-1
  const midCols=[4,5,6,7];                           // neutral band (rubble confined here, clear of both deploy zones)
  const place=(type,count,cols)=>{
    let guard=0;
    while(count>0&&guard<160){
      guard++;
      const c=pick(cols), r=rint(ROWS);
      const k=c+','+r;
      if(used.has(k))continue;
      used.add(k); t[k]=type; count--;
    }
  };
  // Rubble (impassable) stays in the neutral band so it never clogs a deploy zone.
  place('rubble',3+rint(3), midCols);                // 3-5 impassable rocks, center only
  // Forest and high ground scatter across the WHOLE board, including both deploy zones.
  place('forest',6+rint(4), allCols);                // 6-9 forests everywhere
  place('high',4+rint(3), allCols);                  // 4-6 high-ground tiles everywhere
  // Rare features: Sacred Ground (boon, contested neutral band) and Lava (hazard, scattered).
  if(RNG()<0.30) place('sacred',1+rint(2), midCols);   // ~30% of battles, 1-2 sacred tiles
  if(RNG()<0.22) place('lava',1+rint(2), midCols);     // ~22% of battles, 1-2 lava tiles
  return t;
}
export function terrainAt(c,r){ return (G.battle&&G.battle.terrain&&G.battle.terrain[c+','+r])||null; }
export function buildEnemyArmy(node){
  // pick an act-appropriate enemy faction
  const roster=ACT_ENEMIES[Math.min(3,G.act)];
  let fname;
  if(node.t==='boss'){
    // GDD §16: the boss is whichever faction the player fought most this act.
    const tally=G.routeTally||{};
    fname=roster.slice().sort((a,b)=>(tally[b]||0)-(tally[a]||0))[0] || pick(roster);
    // Act III: if the route is genuinely empty/tied, default to the Dread Dominion gate.
    if(G.act>=3 && !Object.keys(tally).length) fname='Dread Dominion';
  } else {
    fname=pick(roster);
    G.routeTally=G.routeTally||{}; G.routeTally[fname]=(G.routeTally[fname]||0)+1;
  }
  const fac=ENEMY_FACTIONS[fname];
  // size: gentler early; grows with act & clears WITHIN the current act (resets each act)
  const ac=G.actCleared||0;
  // size: gentler early; grows with act & clears WITHIN the current act (resets each act).
  // Act I grows its enemy count more slowly so the introductory act stays comfortably winnable.
  let size = node.t==='boss'?4 : node.t==='elite'?(G.act>=3?6:5)
           : G.act===1 ? 4+Math.floor(ac/5)
           : 4+Math.floor(ac/3)+(G.act-1);
  size=Math.min(size, node.t==='boss'?7:8);
  // Difficulty scale. Act I is a gentler on-ramp (softer per-clear growth), but its base is high
  // enough that the opening fights are contested rather than free. Acts II/III step up per act —
  // the per-act jump is deliberately modest because ACT_HP_MULT/ACT_DMG_MULT compound on top of
  // it and the enemy count also grows.
  const perClear = G.act===1 ? 0.018 : 0.020;
  // Explicit per-act bases: Act III is the real difficulty step, Act II a moderate one.
  const base     = G.act===1 ? 1.02 : G.act===2 ? 1.32 : 1.50;
  let scale = base + perClear*(G.actCleared||0);
  if(node.t==='elite'){
    // Elites: a premium over the act's rank-and-file (on top of the extra body and the mini-boss),
    // so clearing one demands an upgraded roster. A3 Elite Pressure ascension adds more.
    scale *= 1.05 + (asc()>=3?0.12:0);
  } else if(node.t==='boss'){
    // Boss nodes: the boss unit itself carries the fight, so its escort is lighter and does NOT
    // take the per-clear ramp — otherwise a late-act boss escort out-scales the act's own battles.
    scale = base * 0.80;
  }
  scale *= ascEnemyMult();                                // A1/A9: enemy power up
  scale *= GLOBAL_DIFF;                                    // global difficulty ease (player-friendly tuning)
  const arr=[];
  for(let i=0;i<size;i++){
    const base=clone(pick(fac.units));
    base.efaction=fname; base.ecol=fac.col;
    base.hp=Math.round(base.hp*scale*actHpMult()); base.dmg=Math.round(base.dmg*scale*actDmgMult());
    arr.push(base);
  }
  // Elite battles: add one randomly-chosen elite (stronger than normal, weaker than a boss).
  if(node.t==='elite' && ELITES[fname]){
    const el=clone(pick(ELITES[fname]));
    el.efaction=fname; el.ecol=fac.col; el.subboss=true; el.elite=true;
    // the elite's base stats are already high (mini-boss tier), so scale it more gently than rank-and-file
    const eScale=1+(scale-1)*0.6;
    el.hp=Math.round(el.hp*eScale*actHpMult()); el.dmg=Math.round(el.dmg*eScale*actDmgMult());
    arr.unshift(el);   // front of the list → placed in the back row like a mini-boss
  }
  if(node.t==='boss'){
    const B=BOSSES[fname]||BOSSES['Dread Dominion'];
    const boss=clone(fac.units[0]);
    boss.name=B.name; boss.art=B.art||B.name; boss.ico=B.ico; boss.cls=B.cls; boss.t='m'; boss.rng=1;
    const bossHpMul = G.act===2?2.10 : G.act===3?1.00 : 1.85;   // act-aware: ACT_HP_MULT compounds on top
    const bossActMul = G.act===2?1.03 : G.act===3?0.85 : 1.0;   // ACT_DMG_MULT already scales later bosses hard
    boss.hp=Math.round(B.hp*bossHpMul*GLOBAL_DIFF*actHpMult()); boss.dmg=Math.round(B.dmg*GLOBAL_DIFF*bossActMul*actDmgMult()); boss.as=B.as; boss.mv=0.9; boss.ult=B.ult; boss.boss=true;
    if(asc()>=6) boss.hp=Math.round(boss.hp*1.15);   // A6: Cruel Bosses
    boss.mech=B.mech; boss.foot=B.foot||2; boss.bossDesc=B.desc;
    boss.efaction=fname; boss.ecol=fac.col;
    arr.unshift(boss);
    // GDD §14: Vorkagar is flanked by two Drake Lieutenant sub-bosses.
    if(fname==='Dread Dominion'){
      for(let k=0;k<2;k++){
        const dl=clone(fac.units[1]||fac.units[0]);
        dl.name='Drake Lieutenant'; dl.art='Drake Lieutenant'; dl.ico='🐉'; dl.t='m'; dl.rng=1;
        dl.hp=Math.round(boss.hp*0.20); dl.dmg=Math.round(B.dmg*0.7); dl.as=B.as; dl.mv=1.0;
        dl.ult={k:'nova',v:2.0,r:1,name:'Searing Breath'}; dl.subboss=true;
        dl.efaction=fname; dl.ecol=fac.col;
        arr.push(dl);
      }
    }
  }
  G.battle.enemyTemplates=arr; G.battle.enemyTheme=fname; G.battle.enemyIco=fac.ico;
  if(node.t==='boss'){ const B=BOSSES[fname]; if(B){ G.battle.bossName=B.name; G.battle.bossDesc=B.desc; } }
}

/* ----- PLANNING ----- */
