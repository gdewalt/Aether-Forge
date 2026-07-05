// @ts-nocheck
import { G } from "./engine-hex.js";
import { RNG, pick, rint } from "./rng.js";
import { recruit } from "./ui-shop.js";

/* ---------- map generation ---------- */
/* ============================================================
   MAP — Slay-the-Spire-style directed graph
   Nodes laid out in rows; several paths traced bottom→top create
   the branching edges. You may only move to a node connected to
   your current node.
   ============================================================ */
export const MAP_ROWS=13;            // rows between (and including) start and pre-boss; boss is a separate top node
export const MAP_PATHS=6;            // number of seed paths traced upward (more = denser web)
export function chooseNodeType(row,totalRows,act){
  // Spire-like distribution with row-based rules
  if(row===0 && act===1) return 'shop';   // the RUN opens (Act I only) at a Recruitment Camp to assemble an initial army
  if(row===totalRows-1) return 'rest';          // guaranteed rest before boss
  const r=RNG();
  if(row<=2){ // early: mostly battles, maybe a recruit
    return r<0.72?'battle':(r<0.86?'shop':'town');
  }
  if(r<0.40) return 'battle';
  if(r<0.54) return 'elite';
  if(r<0.67) return 'shop';
  if(r<0.76) return 'town';      // faction-unlock node
  if(r<0.84) return 'forge';     // Arcane Forge crafting node
  if(r<0.93) return 'rest';
  return 'event';
}
export const NODE_META={
  battle:{ic:'⚔️',nm:'Battle'}, elite:{ic:'💀',nm:'Elite'}, shop:{ic:'⚖️',nm:'Recruit'},
  town:{ic:'🏰',nm:'Town'}, forge:{ic:'⚒️',nm:'Arcane Forge'}, rest:{ic:'🔥',nm:'Rest'}, event:{ic:'❓',nm:'Event'}, boss:{ic:'🐉',nm:'Boss'}
};
export function genMap(act){
  act = act || (typeof G!=='undefined' && G ? (G.act||1) : 1);
  const rows=[];               // rows[r] = array of node objects
  // 1) lay out nodes per row
  for(let r=0;r<MAP_ROWS;r++){
    const count = r===0 ? (2+rint(2)) : (2+rint(3));   // 2-4 nodes
    const arr=[];
    for(let i=0;i<count;i++){
      arr.push({ id:r+'_'+i, row:r, slot:i, count, type:null, next:[], prev:[] });
    }
    rows.push(arr);
  }
  // boss row (single node) on top
  const boss={ id:'boss', row:MAP_ROWS, slot:0, count:1, type:'boss', next:[], prev:[] };
  rows.push([boss]);

  // 2) trace MAP_PATHS paths from bottom row to the top, creating edges
  const startNodes=rows[0];
  for(let p=0;p<MAP_PATHS;p++){
    let cur = startNodes[p % startNodes.length];      // spread starts across bottom nodes
    for(let r=0;r<MAP_ROWS;r++){
      const nextRow = rows[r+1];
      // pick a next node whose slot is horizontally near cur's normalized position
      const curX = (cur.slot+0.5)/cur.count;
      // candidates sorted by horizontal closeness, prefer not to cross too far
      const cand = nextRow.map(n=>({n, dx:Math.abs((n.slot+0.5)/n.count - curX)}))
                          .sort((a,b)=>a.dx-b.dx);
      // mostly pick the closest; sometimes the 2nd for variety (but avoid big crossings)
      let choicePool = cand.slice(0, Math.min(2,cand.length));
      const chosen = (choicePool.length>1 && RNG()<0.4) ? choicePool[1].n : choicePool[0].n;
      if(!cur.next.includes(chosen.id)){ cur.next.push(chosen.id); chosen.prev.push(cur.id); }
      cur = chosen;
    }
  }
  // 3) ensure connectivity: every node (except row0) must have a parent; every non-boss node must have a child
  const byId={}; rows.flat().forEach(n=>byId[n.id]=n);
  for(let r=1;r<rows.length;r++){
    rows[r].forEach(n=>{
      if(n.prev.length===0){ // attach to nearest node in row below
        const below=rows[r-1];
        const nx=(n.slot+0.5)/n.count;
        const par=below.map(b=>({b,dx:Math.abs((b.slot+0.5)/b.count-nx)})).sort((a,b)=>a.dx-b.dx)[0].b;
        par.next.push(n.id); n.prev.push(par.id);
      }
    });
  }
  for(let r=0;r<rows.length-1;r++){
    rows[r].forEach(n=>{
      if(n.next.length===0){ // attach to nearest node in row above
        const above=rows[r+1];
        const nx=(n.slot+0.5)/n.count;
        const ch=above.map(b=>({b,dx:Math.abs((b.slot+0.5)/b.count-nx)})).sort((a,b)=>a.dx-b.dx)[0].b;
        n.next.push(ch.id); ch.prev.push(n.id);
      }
    });
  }
  // 4) assign node types (skip boss, already set)
  rows.forEach((row,r)=>{ if(r===rows.length-1)return; row.forEach(n=>{ n.type=chooseNodeType(r,MAP_ROWS,act); }); });
  // Act I: guarantee a Town on the second floor (row 1) so new players reliably meet faction unlocks early.
  if(act===1 && rows[1] && rows[1].length){
    if(!rows[1].some(n=>n.type==='town')){
      const pick=rows[1][rint(rows[1].length)];
      pick.type='town';
    }
  }
  // de-dup edges
  rows.flat().forEach(n=>{ n.next=[...new Set(n.next)]; n.prev=[...new Set(n.prev)]; });

  return { rows, byId, curId:null, started:false };
}

