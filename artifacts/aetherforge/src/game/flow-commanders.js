// @ts-nocheck
import { ASCENSION, FACTIONS, FACTION_INFO, FCOL, META, POOL, STARTER_FACTIONS, lockedInRun, saveMeta, upgTier } from "./data-units.js";
import { EQUIPMENT, newEquip } from "./data-loot.js";
import { FAC_SYN } from "./synergies.js";
import { G, setG } from "./engine-hex.js";
import { RNG, makeRNG, pick, setRNG } from "./rng.js";
import { SC, renderHUD, showMap, showTitle } from "./ui-render-core.js";
import { genMap } from "./engine-map.js";
import { recruit } from "./ui-shop.js";
import { recordFactionAdd, startRunStats } from "./stats.js";
import { toast } from "./ui-tooltips.js";
import aldricPortrait from "../assets/commanders/aldric.png";
import myrraPortrait from "../assets/commanders/myrra.png";
import rakkanPortrait from "../assets/commanders/rakkan.png";
import korvenPortrait from "../assets/commanders/korven.png";
import silkweaverPortrait from "../assets/commanders/silkweaver.png";
import hollowqueenPortrait from "../assets/commanders/hollowqueen.png";
import brunhildPortrait from "../assets/commanders/brunhild.png";

/* ---------- commander portrait art (painterly cell-shaded busts, shown on hover/select) ---------- */
export const COMMANDER_PORTRAITS={
  aldric:aldricPortrait, myrra:myrraPortrait, rakkan:rakkanPortrait, korven:korvenPortrait,
  silkweaver:silkweaverPortrait, hollowqueen:hollowqueenPortrait, brunhild:brunhildPortrait,
};

/* ---------- COMMANDERS (GDD §22) — alternate starts with signature passives ----------
   Unlock conditions (no longer Lore-gated): each commander below Aldric unlocks the
   first time you clear Act 2 with its signature faction active in that run's draft
   pool; Brunhild — who has no signature faction — unlocks once every faction on the
   account has been unlocked. */
export const COMMANDERS=[
  {id:'aldric',name:'Sir Aldric, the Warden',ico:'🛡️',theme:'Wall & sustain (default)',
   passive:'Front-row units (forward 2 columns) gain +10% damage reduction and +60 HP each battle.',
   army:['Footman','Footman','Spearman','Archer']},
  {id:'myrra',name:'Myrra, the Starseer',ico:'🔮',theme:'Ultimate engine / ranged',unlockFaction:'Stargazers',
   passive:'All units start every battle with +20% magic charge.',
   startFactions:['Neutral','Ironhold','Sylvan','Stargazers'],
   army:['Archer','Crossbowman','Wandering Mage','Spearman']},
  {id:'rakkan',name:'Rakkan, Pride-Father',ico:'🦁',theme:'Fast aggression / bleed',unlockFaction:'Leonin',
   passive:"Each unit's first 3 attacks per battle deal +25% damage and apply bleed.",
   startFactions:['Neutral','Ironhold','Sylvan','Leonin'],
   army:['Mercenary','Spearman','Archer','Footman']},
  {id:'korven',name:'Korven Ashheart',ico:'🔥',theme:'Sacrifice & rebirth',unlockFaction:'Emberkin',
   passive:'The first ally to die each battle revives at 50% HP.',
   startFactions:['Neutral','Ironhold','Sylvan','Emberkin'],
   army:['Footman','Spearman','Crossbowman','Mercenary']},
  {id:'silkweaver',name:'Mother Silkweaver',ico:'🕸️',theme:'Control & lockdown',unlockFaction:'Arachnari',
   passive:'Enemies begin each battle already slowed (1 web stack).',
   startFactions:['Neutral','Ironhold','Sylvan','Arachnari'],
   army:['Spearman','Archer','Wandering Mage','Footman']},
  {id:'hollowqueen',name:'The Hollow Queen',ico:'💀',theme:'Go-wide attrition',unlockFaction:'Hollow',
   passive:'The first time each of your units dies per battle, it raises a Skeleton in its place.',
   startFactions:['Neutral','Ironhold','Sylvan','Hollow'],
   army:['Footman','Footman','Mercenary','Archer']},
  {id:'brunhild',name:'Brunhild, the Unbroken',ico:'⚔️',theme:'Expert flexibility',unlockAllFactions:true,
   passive:'Start with all factions unlocked and +1 Army Cap, but battle rewards offer only 2 unit choices.',
   army:['Footman','Spearman','Archer','Crossbowman']},
];
export const DEFAULT_COMMANDERS=['aldric'];
export function commanderUnlocked(id){ return (META.commanders||DEFAULT_COMMANDERS).includes(id); }
export function showCommanderSelect(){
  let html=`<div class="panel"><div class="lbl">Choose Your Commander</div>
    <p class="tip" style="margin-bottom:12px">Each commander sets your starting band and a run-long signature passive.</p>`;
  // Ascension selector (only if the player has unlocked at least tier 1)
  if(META.ascMax>=1){
    const a=META.ascension||0;
    const tier=a>0?ASCENSION[a-1]:null;
    html+=`<div class="card" style="width:100%;border-color:#a5453a;margin-bottom:12px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><div class="cn" style="font-size:13px">⛰️ Ascension ${a} / ${META.ascMax}</div>
          <div class="cs" style="font-size:11px;color:#e8a59f;margin-top:2px">${tier?tier.name+' — '+tier.desc:'No handicaps — base difficulty.'}</div></div>
        <div class="row" style="gap:4px">
          <button class="small" ${a<=0?'disabled':''} onclick="setAscension(${a-1})">−</button>
          <button class="small" ${a>=META.ascMax?'disabled':''} onclick="setAscension(${a+1})">+</button>
        </div></div></div>`;
  }
  html+=`<div style="display:flex;flex-direction:column;gap:10px">`;
  COMMANDERS.forEach(c=>{
    const unlocked=commanderUnlocked(c.id);
    if(unlocked){
      html+=`<div class="card" style="width:100%;cursor:pointer" onclick="newRun('${c.id}')">
        <div class="cn" style="font-size:14px;display:flex;align-items:center;gap:8px"><img class="cmd-icon-md" src="${COMMANDER_PORTRAITS[c.id]}" alt="">${c.name}</div>
        <div class="cf"><span class="chip" style="background:#2a2138;color:#c9bbe0">${c.theme}</span></div>
        <div class="cs" style="color:#c9bbe0;font-size:11px;margin-top:4px">${c.passive}</div>
        <div class="cs dim" style="font-size:10px;margin-top:3px">Opening factions: ${(c.startFactions||STARTER_FACTIONS).filter(f=>f!=='Neutral').join(', ')} · recruit your army with starting gold</div>
      </div>`;
    } else {
      const reqText=c.unlockFaction
        ? `Unlock: finish Act 2 with ${FACTION_INFO[c.unlockFaction]?FACTION_INFO[c.unlockFaction].ico+' ':''}${c.unlockFaction} in your draft pool`
        : c.unlockAllFactions ? `Unlock: unlock every faction (${FACTIONS.filter(f=>META.unlocked.includes(f)).length}/${FACTIONS.length} so far)` : 'Locked';
      html+=`<div class="card" style="width:100%;opacity:.85;border-color:#3a3348">
        <div><div class="cn" style="font-size:14px;display:flex;align-items:center;gap:8px">🔒 <img class="cmd-icon-md" style="filter:grayscale(.6)" src="${COMMANDER_PORTRAITS[c.id]}" alt="">${c.name}</div>
          <div class="cf"><span class="chip" style="background:#2a2138;color:#c9bbe0">${c.theme}</span></div>
          <div class="cs" style="color:#9c8fb0;font-size:11px;margin-top:4px">${c.passive}</div>
          <div class="cs" style="color:#e8a59f;font-size:10px;margin-top:4px">${reqText}</div></div>
        </div>`;
    }
  });
  html+=`</div><div class="row" style="margin-top:14px"><button class="small" onclick="showTitle()">← Back</button></div></div>`;
  SC.innerHTML=html;
}
function unlockCommanderSilently(c){
  if(commanderUnlocked(c.id)) return false;
  (META.commanders=META.commanders||['aldric']).push(c.id); saveMeta(META);
  toast('🔓 '+c.ico+' '+c.name+' unlocked!');
  return true;
}
// call after clearing Act 2's boss: unlocks any commander whose signature faction was in this run's pool
export function checkAct2CommanderUnlocks(){
  COMMANDERS.filter(c=>c.unlockFaction && (G.activeFactions||[]).includes(c.unlockFaction))
    .forEach(unlockCommanderSilently);
}
// call after a faction gets unlocked in the Athenaeum: unlocks commanders (like Brunhild) gated on having every faction
export function checkFactionCommanderUnlocks(){
  if(FACTIONS.every(f=>META.unlocked.includes(f))) COMMANDERS.filter(c=>c.unlockAllFactions).forEach(unlockCommanderSilently);
}
export function setAscension(n){ META.ascension=Math.max(0,Math.min(META.ascMax,n)); saveMeta(META); showCommanderSelect(); }
export function newRun(commanderId){
  setRNG(makeRNG((Math.random()*1e9)|0));
  let cmd=COMMANDERS.find(c=>c.id===commanderId);
  if(!cmd||!commanderUnlocked(cmd.id)) cmd=COMMANDERS[0];   // fall back to the free default
  // Players no longer start with a pre-built army — the first node is a Recruitment Camp
  // where they spend their opening gold to assemble an initial composition.
  setG({hp:1, gold:160, essence:0, army:[], cap:4, act:1, map:genMap(1), cleared:0, actCleared:0, lore:0, over:false,
     relics:[], stash:[], commander:cmd.id, xp:0, level:1, benchBonus:0, routeTally:{},
     activeFactions:(cmd.startFactions||STARTER_FACTIONS).slice(), ascension:META.ascension||0});
  if(cmd.id==='brunhild'){ G.activeFactions=[...new Set(POOL.map(u=>u.faction))]; G.cap+=1; }   // Brunhild: all factions unlocked + bonus cap
  if(G.ascension>=5) G.cap=Math.max(3,G.cap-1);   // A5: Fragile Heroes
  // Athenaeum — Expedition track (run-start conditions)
  G.gold += upgTier('exp_gold')*40;                                   // War Chest
  if(upgTier('exp_lore')){ G.lore += upgTier('exp_lore')*5; }          // Scholar's Stipend (banked at run end with the rest)
  for(let i=0;i<upgTier('exp_gear');i++){ G.stash.push(newEquip(pick(EQUIPMENT.filter(e=>e.rar!=='Legendary')).id)); }  // Field Kit
  G._scoutRows = upgTier('exp_scout');                                 // Forward Scouts (consumed by map reveal)
  startRunStats(cmd);
  toast(cmd.ico+' '+cmd.name+' leads the banner');
  showMap();
}
export function ensureGear(u){ if(!u.gear)u.gear={weapon:null,armor:null,trinket:null}; return u; }
/* ---------- PLAYER XP & LEVELS — experience grows army & bench space ---------- */
export function xpToNext(lv){ return 20 + lv*12; }
export function gainXp(n,quiet){
  G.xp+=n;
  if(!quiet)toast('+'+n+' XP');
  let leveled=false;
  while(G.xp>=xpToNext(G.level)){
    G.xp-=xpToNext(G.level);
    G.level++;
    G.benchBonus++;                       // every level: +1 bench slot
    let msg='⬆ Level '+G.level+'! +1 bench slot';
    if(G.level%2===0){ G.cap++; msg+=' · +1 Army Cap'; }   // every 2nd level: +1 cap
    toast(msg);
    leveled=true;
    if(G.level%2===0) G._pendingFactionPick=(G._pendingFactionPick||0)+1;   // a new faction on every even level
  }
  renderHUD();
  return leveled;
}
// offer up to 3 not-yet-active unlocked factions to fold into the run's draft pool
export function factionChoices(n){
  const avail=lockedInRun();
  // shuffle deterministically via RNG
  const shuffled=avail.slice();
  for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(RNG()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
  return shuffled.slice(0,n||3);
}
export function addActiveFaction(f){
  if(!G.activeFactions.includes(f)){ G.activeFactions.push(f); recordFactionAdd(f); toast((FACTION_INFO[f]?FACTION_INFO[f].ico:'')+' '+f+' joins your draft pool'); }
}
// shown after a node resolves if level-ups queued faction picks and options exist
export function maybeFactionPick(then){
  if((G._pendingFactionPick||0)>0 && lockedInRun().length){
    const choices=factionChoices(3);
    if(choices.length){ showFactionPick(choices, 'Level Up — Recruit a New Faction',
      'Your growing renown draws a new faction to your banner. Add one to this run’s draft pool:',
      then, true); return true; }
  }
  G._pendingFactionPick=0;
  return false;
}
export function showFactionPick(choices, title, blurb, then, isLevel){
  let html=`<div class="panel"><div class="lbl">${title}</div>
    <p class="tip" style="margin-bottom:12px">${blurb}</p>
    <div style="display:flex;flex-direction:column;gap:10px">`;
  choices.forEach(f=>{
    const info=FACTION_INFO[f]||{ico:'',blurb:''};
    const syn=FAC_SYN[f];
    html+=`<div class="card" style="width:100%;cursor:pointer;border-color:${FCOL[f]||'#555'}" onclick="pickFaction('${f}',${isLevel?'true':'false'})">
      <div class="cn" style="font-size:14px">${info.ico} ${f}</div>
      <div class="cs" style="color:#c9bbe0;font-size:11px;margin-top:3px">${info.blurb}</div>
      ${syn?`<div class="cs dim" style="font-size:10px;margin-top:3px">Synergy: ${syn.name} — ${syn.desc[0]} → ${syn.desc[1]}</div>`:''}
    </div>`;
  });
  html+=`</div><div class="row" style="margin-top:14px"><button class="small" onclick="skipFaction(${isLevel?'true':'false'})">Skip for now →</button></div></div>`;
  SC.innerHTML=html;
  G._factionThen=then;
}
export function pickFaction(f,isLevel){
  addActiveFaction(f);
  if(isLevel) G._pendingFactionPick=Math.max(0,(G._pendingFactionPick||0)-1);
  const then=G._factionThen; G._factionThen=null;
  // chain another level-up pick if still queued and options remain
  if(isLevel && maybeFactionPick(then)) return;
  if(then) then(); else showMap();
}
export function skipFaction(isLevel){
  if(isLevel) G._pendingFactionPick=0;   // skipping forfeits queued level picks
  const then=G._factionThen; G._factionThen=null;
  if(then) then(); else showMap();
}
/* ---------- THE ARCANE FORGE (GDD §24) — one upgrade action per visit ---------- */
