import { useEffect, useRef } from "react";
import "@/game/aetherforge.css";

declare global {
  interface Window {
    advanceRow?: unknown;
    afterRelicReward?: unknown;
    afterUnitReward?: unknown;
    autoPlace?: unknown;
    beginCombat?: unknown;
    buyUpgrade?: unknown;
    closeModal?: unknown;
    enterNode?: unknown;
    equipSlotClick?: unknown;
    eventChoice?: unknown;
    forgeEssence?: unknown;
    forgeTierUnit?: unknown;
    hideTip?: unknown;
    inspectEquip?: unknown;
    inspectRecruit?: unknown;
    leaveShop?: unknown;
    mapTip?: unknown;
    newRun?: unknown;
    openUnitDetail?: unknown;
    pickFaction?: unknown;
    rerollOffers?: unknown;
    restChoice?: unknown;
    sellPrompt?: unknown;
    setAscension?: unknown;
    setSpeed?: unknown;
    showArmy?: unknown;
    showCommanderSelect?: unknown;
    showEquip?: unknown;
    showForge?: unknown;
    showMap?: unknown;
    showMetaStore?: unknown;
    showRelicBar?: unknown;
    showTitle?: unknown;
    skipFaction?: unknown;
    stashClick?: unknown;
    takeEquip?: unknown;
    takeRelic?: unknown;
    townPickFaction?: unknown;
    townTakeEssence?: unknown;
    unlockFaction?: unknown;
  }
}

function App() {
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    import("@/game/boot.js");
  }, []);

  return (
    <div id="app">
      <div className="hd">
        <div>
          <h1>AETHERFORGE</h1>
          <div className="sub">Banners of the Broken Realm — prototype</div>
        </div>
        <div className="stats" id="hud"></div>
      </div>
      <div id="screen"></div>
      <div id="tooltip"></div>
    </div>
  );
}

export default App;
