// @ts-nocheck
import { living } from "./engine-combat.js";

/* ---------- synergy definitions (simplified from GDD) ---------- */
export const FAC_SYN={
  Ironhold:{name:'Aegis Wall',bp:[2,4],desc:['+10 armor·flat dmg-reduce','front line shielded'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Ironhold'){u.dr=(u.dr||0)+(lvl>=2?0.20:0.10);}})},
  Sylvan:{name:'Volley',bp:[2,4],desc:['ranged +12% AS','ranged +25% AS & dmg'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Sylvan'&&u.t==='r'){u.as*=(lvl>=2?1.25:1.12);if(lvl>=2)u.dmg*=1.2;}})},
  Gilded:{name:'Blessing',bp:[2,4],desc:['healing +25%','+ army -10% dmg taken'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Gilded'){u.healMul=(u.healMul||1)*1.25;}if(lvl>=2)u.dr=(u.dr||0)+0.10;})},
  Leonin:{name:'Bleed',bp:[2,4],desc:['attacks bleed (+dmg taken)','bleed amp +15% AS'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Leonin'){u.bleed=true;if(lvl>=2)u.as*=1.15;}})},
  Emberkin:{name:'Burn',bp:[2,4],desc:['attacks burn (DoT)','+30% burn dmg'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Emberkin'){u.burn=lvl>=2?1.3:1;}})},
  Tidecallers:{name:'Frost',bp:[2,4],desc:['attacks slow','slow stacks → freeze'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Tidecallers'){u.slow=true;if(lvl>=2)u.deepfreeze=true;}})},
  Stormherd:{name:'Storm',bp:[2,4],desc:['+12% attack speed','attacks may chain lightning'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Stormherd'){u.as*=1.12;if(lvl>=2)u.lightning=true;}})},
  Voidtouched:{name:'Hunger',bp:[2,4],desc:['12% lifesteal','kills grant stacking +8% damage'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Voidtouched'){u.lifesteal=(u.lifesteal||0)+.12;if(lvl>=2)u.voidstack=true;}})},
  Phoenix:{name:'Rebirth',bp:[2,4],desc:['units revive once at 40% HP','revive at 60% HP with +20% dmg'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Phoenix'){u.phoenixRevive=lvl>=2?0.6:0.4;if(lvl>=2)u.phoenixEmpower=true;}})},
  Gravewardens:{name:'Aegis',bp:[2,4],desc:['damage taken builds armor','stronger conversion'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Gravewardens'){u.aegis=lvl>=2?0.010:0.006;u.aegisCap=lvl>=2?0.30:0.20;}})},
  Hivemind:{name:'Swarm',bp:[2,4],desc:['attacks may spawn Swarmlings','+3% dmg per living Hivemind'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Hivemind'){u.hiveSpawn=true;if(lvl>=2)u.hiveScale=true;}})},
  Stargazers:{name:'Ascendance',bp:[2,4],desc:['Stargazers +35% charge','all allies +20% charge; ults can crit'],apply:(units,lvl)=>{units.forEach(u=>{if(u.faction==='Stargazers'){u.chargeMul=(u.chargeMul||1)*1.35;if(lvl>=2)u.ultCrit=true;}});if(lvl>=2)units.forEach(u=>{u.chargeMul=(u.chargeMul||1)*1.2;});}},
  Arachnari:{name:'Web',bp:[2,4],desc:['attacks web; 3 stacks root','webbed foes take +15% dmg'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Arachnari'){u.web=true;if(lvl>=2)u.webAmp=true;}})},
  Myconid:{name:'Spores',bp:[2,4],desc:['attacks poison','foes in spore clouds take +15% dmg'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Myconid'){u.spore=true;if(lvl>=2)u.sporeAmp=true;}})},
  Grimgear:{name:'Engineering',bp:[2,4],desc:['build a Gun Turret at battle start','2 turrets; deaths spawn Scrap Bots'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Grimgear'){u.grimgear=lvl;}})},
  Hollow:{name:'Undeath',bp:[2,4],desc:['Hollow deaths raise Skeletons','any ally death raises a Skeleton'],apply:(units,lvl)=>units.forEach(u=>{if(u.faction==='Hollow'){u.hollowRaise=lvl;}})},
};
export const CLASS_SYN={ // weaker, cross-faction, bp 3/6
  Warrior:{bp:[3,6],desc:['+6% max HP','+10% HP & +5 armor'],apply:(u,l)=>{u.hp*=(l>=2?1.10:1.06);u.maxhp=u.hp;if(l>=2)u.dr=(u.dr||0)+0.05;}},
  Archer:{bp:[3,6],desc:['+1 range','+1 range & +8% AS'],apply:(u,l)=>{u.rng=(u.rng||0)+1;if(l>=2)u.as*=1.08;}},
  Mage:{bp:[3,6],desc:['ability/ult power +7%','+12% ult power & charge faster'],apply:(u,l)=>{u.ultMul=(u.ultMul||1)*(l>=2?1.12:1.07);if(l>=2)u.chargeMul=(u.chargeMul||1)*1.08;}},
  Cleric:{bp:[3,6],desc:['healing +10%','+18% healing & healed allies get a shield'],apply:(u,l)=>{u.healMul=(u.healMul||1)*(l>=2?1.18:1.10);if(l>=2)u._healShield=true;}},
  Rogue:{bp:[3,6],desc:['+10% crit · crits ×1.75','+18% crit · ultimates can crit'],apply:(u,l)=>{u.crit=(u.crit||0)+(l>=2?0.18:0.10);u.critMul=1.75;if(l>=2)u.ultCrit=true;}},
  Guardian:{bp:[3,6],desc:['+8% armor','+14% armor & nearby allies -8% dmg'],apply:(u,l)=>{u.dr=(u.dr||0)+(l>=2?0.14:0.08);if(l>=2)u._guardianWard=true;}},
  Beast:{bp:[3,6],desc:['+6% AS & move','+10% AS & move'],apply:(u,l)=>{const m=(l>=2?1.10:1.06);u.as*=m;u.mv*=m;}},
};

