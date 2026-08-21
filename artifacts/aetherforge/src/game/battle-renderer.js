// @ts-nocheck
/* ============================================================
   GPU BATTLE RENDERER
   This is the presentation boundary for the battlefield. It deliberately
   receives a battle snapshot and never mutates combat state, which lets the
   deterministic simulator remain independent of how the game is drawn.

   The DOM token renderer remains temporarily above this canvas while unit,
   VFX, and HUD layers migrate one at a time. Keeping the layers explicit
   avoids a risky all-at-once renderer rewrite.
   ============================================================ */
import { Application, Container, Graphics } from 'pixi.js';
import { COLS, ROWS, GRIDH, GRIDW, HR, hexCenter } from './engine-hex.js';

let app=null;
let host=null;
let terrain=null;
let zones=null;
let units=null;
let effects=null;
let mounted=false;
let zoneSignature='';

function hexPoints(cx,cy,r){
  const points=[];
  for(let i=0;i<6;i++){
    const a=Math.PI/3*i;
    points.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
  }
  return points;
}

function buildTerrain(){
  terrain.removeChildren();
  const base=new Graphics();
  base.rect(0,0,GRIDW,GRIDH).fill({color:0x10151a});
  terrain.addChild(base);

  for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++){
    const {x,y}=hexCenter(c,r);
    const variation=(c*17+r*29)%3;
    const fill=[0x25352d,0x29372d,0x1f3029][variation];
    const tile=new Graphics();
    tile.poly(hexPoints(x,y,HR-2)).fill({color:fill,alpha:0.98});
    tile.poly(hexPoints(x,y,HR-2)).stroke({color:0x6f8b70,alpha:0.2,width:1});
    terrain.addChild(tile);
  }

  // A restrained vignette gives the board depth before illustrated terrain
  // assets replace these procedural tiles in the next migration slice.
  const vignette=new Graphics();
  vignette.rect(0,0,GRIDW,GRIDH).stroke({color:0x050707,alpha:0.62,width:18});
  terrain.addChild(vignette);
}

export async function mountBattleRenderer(nextHost){
  if(!nextHost)return false;
  if(mounted && host===nextHost)return true;
  destroyBattleRenderer();
  host=nextHost;
  app=new Application();
  await app.init({
    width:GRIDW,
    height:GRIDH,
    backgroundAlpha:0,
    antialias:true,
    autoDensity:true,
    resolution:Math.min(window.devicePixelRatio||1,2),
    preference:'webgl',
  });
  app.canvas.className='battle-canvas';
  app.canvas.setAttribute('aria-hidden','true');
  host.appendChild(app.canvas);
  terrain=new Container();
  zones=new Container();
  units=new Container();
  effects=new Container();
  app.stage.addChild(terrain,zones,units,effects);
  buildTerrain();
  mounted=true;
  return true;
}

// This small bridge proves the renderer consumes simulation state without
// owning it. Zone visuals move here first; unit sprites are intentionally kept
// in the DOM layer until their hitboxes/tooltips migrate in the next slice.
export function syncBattleRenderer(battle){
  if(!mounted||!zones)return;
  const nextSignature=(battle?.zones||[]).map(z=>
    `${z.color}|${z.life?.toFixed?.(1)||0}|${(z.tiles||[]).map(t=>t.c+','+t.r).join(';')}`
  ).join('/');
  if(nextSignature===zoneSignature)return;
  zoneSignature=nextSignature;
  zones.removeChildren().forEach(child=>child.destroy());
  for(const zone of battle?.zones||[]){
    for(const tile of zone.tiles||[]){
      const {x,y}=hexCenter(tile.c,tile.r);
      const marker=new Graphics();
      marker.circle(x,y,HR*.48).fill({color:zone.color||0x9ccc65,alpha:Math.min(.34,.1+(zone.life||0)*.035)});
      marker.circle(x,y,HR*.48).stroke({color:zone.color||0x9ccc65,alpha:.62,width:2});
      zones.addChild(marker);
    }
  }
}

export function destroyBattleRenderer(){
  if(app){ app.destroy(true,{children:true,texture:false,textureSource:false}); }
  app=null; host=null; terrain=null; zones=null; units=null; effects=null; mounted=false; zoneSignature='';
}
