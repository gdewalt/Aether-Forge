// @ts-nocheck
/* ---------- hex grid geometry (flat-top, 14x8 scaled down to fit) ---------- */
export const COLS=12, ROWS=7, HR=46;
export const HEXW=2*HR, HEXH=Math.sqrt(3)*HR, COLSTEP=1.5*HR, ROWSTEP=HEXH;
export function hexCenter(c,r){const off=(c%2)?HEXH/2:0;return {x:c*COLSTEP+HR+6,y:r*ROWSTEP+off+HR+6};}
export function hexDist(a,b){ // axial-ish distance on offset coords (approx via cube)
  const ac=oc2cube(a.c,a.r), bc=oc2cube(b.c,b.r);
  return (Math.abs(ac.x-bc.x)+Math.abs(ac.y-bc.y)+Math.abs(ac.z-bc.z))/2;
}
export function oc2cube(col,row){const x=col;const z=row-((col-(col&1))>>1);const y=-x-z;return{x,y,z};}
export const GRIDW=(COLS-1)*COLSTEP+HEXW+12, GRIDH=(ROWS-1)*ROWSTEP+HEXH+HEXH/2+12;

/* ---------- game state ---------- */
export let G=null;
export function setG(v){ G = v; }
