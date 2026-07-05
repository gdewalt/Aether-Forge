// @ts-nocheck
import { assignRarities } from "./data-loot.js";
import { buyUpgrade } from "./data-units.js";
import {
  beginCombat,
  setSpeed,
} from "./engine-combat.js";
import {
  eventChoice,
} from "./flow-events.js";
import {
  hoverCommander,
  newRun,
  pickFaction,
  setAscension,
  showCommanderSelect,
  skipFaction,
  unlockCommander,
} from "./flow-commanders.js";
import {
  forgeEssence,
  forgeTierUnit,
  showForge,
  townPickFaction,
  townTakeEssence,
} from "./flow-forge.js";
import {
  afterRelicReward,
  afterUnitReward,
  showMetaStore,
  takeEquip,
  takeRelic,
  unlockFaction,
} from "./flow-battle-end.js";
import {
  advanceRow,
  enterNode,
  mapTip,
  showArmy,
  showMap,
  showRelicBar,
  showTitle,
} from "./ui-render-core.js";
import {
  equipSlotClick,
  showEquip,
  stashClick,
} from "./ui-army-equip.js";
import {
  inspectEquip,
  inspectRecruit,
  leaveShop,
  rerollOffers,
  restChoice,
  sellPrompt,
} from "./ui-shop.js";
import { autoPlace } from "./ui-planning.js";
import {
  closeModal,
  hideTip,
  openUnitDetail,
} from "./ui-tooltips.js";

/* ---------- expose inline HTML event-handler functions on window ---------- */
Object.assign(window, {
  advanceRow,
  afterRelicReward,
  afterUnitReward,
  autoPlace,
  beginCombat,
  buyUpgrade,
  closeModal,
  enterNode,
  equipSlotClick,
  eventChoice,
  forgeEssence,
  forgeTierUnit,
  hideTip,
  hoverCommander,
  inspectEquip,
  inspectRecruit,
  leaveShop,
  mapTip,
  newRun,
  openUnitDetail,
  pickFaction,
  rerollOffers,
  restChoice,
  sellPrompt,
  setAscension,
  setSpeed,
  showArmy,
  showCommanderSelect,
  showEquip,
  showForge,
  showMap,
  showMetaStore,
  showRelicBar,
  showTitle,
  skipFaction,
  stashClick,
  takeEquip,
  takeRelic,
  townPickFaction,
  townTakeEssence,
  unlockCommander,
  unlockFaction,
});

/* ---------- boot ---------- */
assignRarities();
showTitle();
