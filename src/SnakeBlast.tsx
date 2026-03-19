import { useState, useEffect, useRef, useCallback, type JSX } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
//  INTERFACES / TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Tile {
  x: number;
  y: number;
}

interface SnakeSegment {
  x: number;
  y: number;
}

interface Direction {
  x: number;
  y: number;
}

interface FruitType {
  grow: number;
  score: number;
  r: number;
  c0: string;
  c1: string;
  c2: string;
  glow: string;
  weight: number;
}

interface Fruit {
  x: number;
  y: number;
  t: number;
  pw?: string; // powerup id when this is a powerup fruit
}

interface PowerupEffect {
  id: string;  // "rush"|"chill"|"fat"|"ghost"|"double"
  timer: number;
  dur: number;
}

interface Shape {
  tiles: Tile[];
  bonus: number;
  id: number;
  col?: string;
  tileSet?: Set<string>;
}

interface ShapeDef {
  pts: [number, number][];
  b: number;
  col?: string;
}

interface Bulge {
  t: number;
}

interface Popup {
  wx: number;
  wy: number;
  text: string;
  col: string;
  life: number;
}

interface ComboPop {
  n: number;
  timer: number;
  dur: number;
}

interface PendingFill {
  rem: Set<string>;
  prevByCoord: Map<string, SnakeSegment>;
  bonus: number;
  cx: number;
  cy: number;
  tiles: Tile[];
  timer: number;
  dur: number;
  col?: string;
}

interface Reconnect {
  timer: number;
  dur: number;
  gapIdx: number;
  M: number;
  paths: SnakeSegment[][];  // paths[j] = ordered waypoints (start→target) for back segment j
}

interface FillAnim {
  segs: { x: number; y: number }[];
  cutPt: { x: number; y: number };
  timer: number;
  dur: number;
}

interface SkinDef {
  head: string;
  a: string;
  b: string;
  glow: string;
}

interface ConfettiParticle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  life: number;
  rot: number; rotV: number;
  size: number;
}

interface Particle {
  wx: number; wy: number;   // world-pixel position
  vx: number; vy: number;   // velocity px/s
  color: string;
  life: number;
  size: number;
}

interface Ship {
  x: number; y: number;   // pixel position (center)
  vx: number; vy: number; // velocity px/s
  r: number;              // radius px
  type: number;           // 0=fighter, 1=cruiser, 2=destroyer, 3=dreadnought
  angle: number;          // facing angle (rad)
}

interface VoidThemeDef {
  bg: string;
  shipCol: string;
  shipGlow: string;
  engineCol: string;
  barrierCol: string;
}

interface ThemeDef {
  bg: string;
  floor: string;
  grid: string;
  wall: string;
  wallStroke: string;
}

interface ForestThemeDef {
  bg: string;
  floor: string;
  grid: string;
  treeGround: string;
  trunk: string;
  canopy1: string;
  canopy2: string;
  canopy3: string;
}

interface GameSettings {
  speed: string;
  skin: string;
  bg: string;
  maze: string;
  mapSize: string;
  map: string;
}

interface UnlockStore {
  skins: string[];
  mazethemes: string[];
  maps: string[];
  forestthemes: string[];
  mapsizes: string[];
  voidthemes: string[];
}

interface GameState {
  tiles: Uint8Array;
  snake: SnakeSegment[];
  prevSnake: SnakeSegment[];
  dir: Direction;
  dirQueue: Direction[];
  grow: number;
  fruits: Fruit[];
  shapes: Shape[];
  score: number;
  combo: number;
  comboTimer: number;
  comboPop: ComboPop | null;
  moveT: number;
  tickDur: number;
  skin: SkinDef;
  theme: ThemeDef;
  waitInput: boolean;
  camX: number;
  camY: number;
  dyingTimer: number;
  dyingDur?: number;
  fillAnim: FillAnim | null;
  bulges: Bulge[];
  pendingFill: PendingFill | null;
  reconnect: Reconnect | null;
  wt: number;
  mapType: string;
  forestTheme?: ForestThemeDef;
  powerups: PowerupEffect[];
  baseTickDur: number;
  fruitTarget: number;
  powerupTarget: number;
  powerupSpawnTimer: number;
  tier: number;
  scoreMult: number;
  deathCause: "wall" | "body" | "ship" | null;
  ships: Ship[];
  voidTheme?: VoidThemeDef;
}

type ScreenState = "menu" | "playing" | "paused" | "dying" | "gameover";

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const T        = 40;
const WALL     = 1;
// Map size — controls physical dimensions (purchasable).
// targetWt values are 70k+1 so they divide evenly by every cell size (5,7,10).
const MAZE_SIZE_DEFS: Record<string,{targetWt:number}> = {
  Small:  {targetWt:71 },   // 71 tiles × 40px = 2840px
  Medium: {targetWt:141},   // 141 tiles × 40px = 5640px
  Large:  {targetWt:211},   // 211 tiles × 40px = 8440px
};
const FOREST_SIZE_DEFS: Record<string,{wt:number}> = {
  Small:  {wt:70 },
  Medium: {wt:150},
  Large:  {wt:220},
};
// Difficulty — controls corridor width / tree density only, not physical size
const MAZE_DIFF_DEFS: Record<string,{pass:number,dep:number}> = {
  Easy:   {pass:9, dep:8},
  Normal: {pass:6, dep:5},
  Hard:   {pass:4, dep:2},
};
const FOREST_DIFF_DEFS: Record<string,{density:number,cluster:number,clearR:number,ringW:number,ringDensity:number}> = {
  Easy:   {density:0.055, cluster:6, clearR:10, ringW:14, ringDensity:0.055},
  Normal: {density:0.085, cluster:5, clearR:8,  ringW:16, ringDensity:0.090},
  Hard:   {density:0.120, cluster:4, clearR:5,  ringW:18, ringDensity:0.130},
};
const mazeDims=(sizeKey:string,diffKey:string)=>{
  const s=MAZE_SIZE_DEFS[sizeKey]||MAZE_SIZE_DEFS.Small;
  const d=MAZE_DIFF_DEFS[diffKey]||MAZE_DIFF_DEFS.Normal;
  const cell=d.pass+WALL;
  const mz=Math.round((s.targetWt-1)/cell);
  const wt=mz*cell+WALL;
  return{mz,pass:d.pass,dep:d.dep,cell,wt};
};
const COMBO_DUR   = 5000;
// Shape target scales with map size so larger maps feel dense with targets
const shapeTargetFor = (wt: number): number => wt <= 80 ? 8 : wt <= 150 ? 14 : 22;
const CULL_MARGIN = 32; // tiles beyond screen before items are removed
// Neighbour directions used when drawing shape outlines (dx,dy,ax,ay,bx,by offsets are applied per-tile)
const SHAPE_EDGE_DIRS = [[0,-1,0,0,1,0],[0,1,0,1,1,1],[-1,0,0,0,0,1],[1,0,1,0,1,1]] as const;
// Fruit rarities — weight out of 100, grow = segments added, r = base radius (fraction of T)
const FRUIT_TYPES: FruitType[]=[
  {grow:1, score:6,   r:0.28, c0:"#ffdd44",c1:"#ff5500",c2:"#cc1100",glow:"#ff6600",weight:70},
  {grow:2, score:16,  r:0.33, c0:"#44ffcc",c1:"#00cc88",c2:"#005544",glow:"#00ffaa",weight:20},
  {grow:3, score:38,  r:0.38, c0:"#aaccff",c1:"#4466ff",c2:"#1100aa",glow:"#5588ff",weight:8 },
  {grow:5, score:75,  r:0.46, c0:"#ffee55",c1:"#ffbb00",c2:"#aa5500",glow:"#ffdd00",weight:2 },
];
// At higher tiers, weight shifts toward rarer fruits
const rndFruitType=(tier: number=0):number=>{
  const s=tier*5;
  const w=[Math.max(20,70-s*2),20+s/2,8+s/2,2+s];
  const total=w.reduce((a,b)=>a+b,0);
  let c=0;const r=Math.random()*total;
  for(let i=0;i<w.length;i++){c+=w[i];if(r<c)return i;}return 0;
};

// ── Powerups ──────────────────────────────────────────────────────────────────
interface PowerupDef {id:string;icon:string;col:string;glow:string;dur:number;score:number;}
const POWERUP_DEFS: PowerupDef[]=[
  {id:"rush",  icon:"!!",col:"#ffee44",glow:"#ffcc00",dur:5000,score:30 },
  {id:"chill", icon:"~~", col:"#88ddff",glow:"#44aaff",dur:6000,score:30 },
  {id:"ghost", icon:"++", col:"#bbbbff",glow:"#6666ff",dur:7000,score:50 },
  {id:"double",icon:"x2", col:"#ffdd00",glow:"#ffaa00",dur:8000,score:75 },
];
// Chance (0–1) of a powerup spawning every 10 s when none are on the map, per tier
const POWERUP_SPAWN_CHANCE=[0.20,0.35,0.50,0.70,0.90];
// Which powerup types unlock at each tier (cumulative)
const POWERUP_BY_TIER: string[][]=[
  ["rush"],                          // tier 0: only rush
  ["rush","chill"],                  // tier 1: +chill
  ["rush","chill","ghost"],          // tier 2: +ghost
  ["rush","chill","ghost","double"], // tier 3: +double
  ["rush","chill","ghost","double"], // tier 4: all
];
// Theme quality tier: 0 (worst) → 4 (best)
const THEME_TIER: Record<string,number>={
  Mono:0,Pine:0, Neon:1,Swamp:1, Arctic:2,Autumn:2, Magma:3,Cherry:3, Space:4,Winter:4,
  Nebula:2, Aurora:3, Solar:3, Pulsar:4, Practice:0,
};
// Practice map border-wall style (green arena)
const PRACTICE_BARRIER_COL="#00ff66";
const rndPowerup=(tier: number):string=>{
  const pool=POWERUP_BY_TIER[Math.min(tier,4)];
  if(!pool.length)return "rush";
  return pool[(Math.random()*pool.length)|0];
};

const SPEEDS: Record<string, number> = { Slow: 230, Normal: 140, Fast: 72 };

// ── Shop prices (0 = free/default) ────────────────────────────────────────────
const SKIN_PRICES:         Record<string,number> = {Mono:0,   Neon:120,  Arctic:280, Magma:520,  Cosmic:840 };
const MAZETHEME_PRICES:    Record<string,number> = {Mono:0,   Neon:160,  Arctic:320, Magma:560,  Space:900  };
const MAP_PRICES:          Record<string,number> = {Practice:0, Maze:0, Forest:600, Void:900};
const MAPSIZE_PRICES:      Record<string,number> = {Small:0,  Medium:400, Large:800 };
const FORESTTHEME_PRICES:  Record<string,number> = {Pine:0,   Swamp:240, Autumn:360, Cherry:680, Winter:1100};
const VOID_DIFF_DEFS: Record<string,{count:number,speed:number,minR:number,maxR:number}> = {
  Easy:   {count:18, speed:75,  minR:14, maxR:36},
  Normal: {count:32, speed:120, minR:16, maxR:46},
  Hard:   {count:48, speed:180, minR:22, maxR:80},
};
// Ship count multiplier by map size (bigger map = way more ships)
const VOID_SIZE_MULT: Record<string,number> = {Small:1.0, Medium:2.8, Large:5.0};
const VOID_THEMES: Record<string,VoidThemeDef> = {
  Nebula: {bg:"#06001a",shipCol:"#cc44ff",shipGlow:"#8800ff",engineCol:"#ff44ff",barrierCol:"#aa00ff"},
  Aurora: {bg:"#001a0a",shipCol:"#00ff88",shipGlow:"#00aa44",engineCol:"#44ffcc",barrierCol:"#00ffaa"},
  Solar:  {bg:"#1a0400",shipCol:"#ff8800",shipGlow:"#cc4400",engineCol:"#ffff44",barrierCol:"#ff6600"},
  Pulsar: {bg:"#000d1a",shipCol:"#4488ff",shipGlow:"#0044cc",engineCol:"#44ffff",barrierCol:"#0088ff"},
};
const VOIDTHEME_PRICES: Record<string,number> = {Nebula:0, Aurora:280, Solar:560, Pulsar:900};
const DIFF_COIN_MULT:      Record<string,number> = {Easy:0.7, Normal:1.0, Hard:1.8  };
const SKIN_COIN_MULT:      Record<string,number> = {Mono:1.0, Neon:1.1, Arctic:1.2, Magma:1.35, Cosmic:1.5};
const SPEED_SCORE_MULT:    Record<string,number> = {Slow:0.8, Normal:1.0, Fast:1.4  };
const SIZE_SCORE_MULT:     Record<string,number> = {Small:1.0,Medium:1.2, Large:1.5 };
const SPEED_COIN_MULT:     Record<string,number> = {Slow:0.6, Normal:1.0, Fast:1.6  };

const SKINS: Record<string, SkinDef> = {
  Mono:   { head:"#ffffff", a:"#eeeeee", b:"#ff3333", glow:"#ff5555" },
  Neon:   { head:"#dffff5", a:"#00ffaa", b:"#00aaff", glow:"#00ffcc" },
  Arctic: { head:"#eef8ff", a:"#88ddff", b:"#1166ee", glow:"#44aaff" },
  Magma:  { head:"#fff6e0", a:"#ffcc00", b:"#ff2200", glow:"#ff6600" },
  Cosmic: { head:"#f0e0ff", a:"#cc44ff", b:"#3300cc", glow:"#9900ff" },
};

const THEMES: Record<string, ThemeDef> = {
  "Mono":   { bg:"#0a0a0a", floor:"#181818", grid:"rgba(255,255,255,0.10)", wall:"#e8e8e8", wallStroke:"rgba(0,0,0,0.82)"     },
  "Neon":   { bg:"#04020f", floor:"#080520", grid:"rgba(0,255,180,0.28)",   wall:"#d0ccff", wallStroke:"rgba(100,0,220,0.78)"  },
  "Arctic": { bg:"#060c18", floor:"#0d2444", grid:"rgba(70,160,255,0.30)",  wall:"#cce4f8", wallStroke:"rgba(20,80,160,0.68)"  },
  "Magma":  { bg:"#0d0100", floor:"#2a0e00", grid:"rgba(210,70,10,0.28)",   wall:"#f0d0a8", wallStroke:"rgba(160,40,0,0.78)"   },
  "Space":  { bg:"#040810", floor:"#0e1e3a", grid:"rgba(40,110,255,0.28)",  wall:"#c8d4f0", wallStroke:"rgba(0,40,150,0.72)"   },
};

const FOREST_THEMES: Record<string, ForestThemeDef> = {
  Pine:   { bg:"#030d02", floor:"#0d1a09", grid:"rgba(20,60,10,0.22)",    treeGround:"#0a1407", trunk:"#5a3010", canopy1:"#1a4010", canopy2:"#256818", canopy3:"#3a8822" },
  Autumn: { bg:"#0d0500", floor:"#1c0c02", grid:"rgba(140,60,0,0.25)",    treeGround:"#0e0600", trunk:"#4a2200", canopy1:"#8c3200", canopy2:"#c85500", canopy3:"#e87a10" },
  Swamp:  { bg:"#010804", floor:"#091208", grid:"rgba(20,70,30,0.20)",    treeGround:"#050b04", trunk:"#2a2810", canopy1:"#0c2a12", canopy2:"#184a1e", canopy3:"#256830" },
  Cherry: { bg:"#0a0208", floor:"#160610", grid:"rgba(180,40,100,0.22)",  treeGround:"#0a0208", trunk:"#5a2838", canopy1:"#881040", canopy2:"#c42868", canopy3:"#ff6aaa" },
  Winter: { bg:"#020408", floor:"#0a1020", grid:"rgba(140,190,255,0.22)", treeGround:"#060c18", trunk:"#5a5a70", canopy1:"#b8cce0", canopy2:"#ddeeff", canopy3:"#f0f8ff" },
};

const SHAPE_DEFS: ShapeDef[] = [
  { pts:[[0,0],[1,0],[0,1],[1,1]],              b:80  },
  { pts:[[0,0],[1,0],[2,0],[1,1]],              b:90  },
  { pts:[[1,0],[0,1],[1,1],[2,1]],              b:90  },
  { pts:[[0,0],[0,1],[0,2],[1,2]],              b:100 },
  { pts:[[0,0],[1,0],[1,1],[1,2]],              b:100 },
  { pts:[[1,0],[2,0],[0,1],[1,1]],              b:100 },
  { pts:[[0,0],[1,0],[1,1],[2,1]],              b:100 },
  { pts:[[0,0],[0,1],[0,2]],                    b:50  },
  { pts:[[0,0],[1,0],[2,0]],                    b:50  },
  { pts:[[0,0],[1,0],[0,1]],                    b:45  },
  { pts:[[1,0],[0,1],[1,1],[0,2]],              b:90  },
  { pts:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],  b:200 },
  { pts:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]], b:520, col:"#ffaa00" },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════════════════
const lerp    = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp   = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const hRgb    = (h: string): [number, number, number] => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const lerpHex = (c1: string, c2: string, t: number): string => {
  const [r1,g1,b1]=hRgb(c1),[r2,g2,b2]=hRgb(c2);
  return `rgb(${(r1+(r2-r1)*t)|0},${(g1+(g2-g1)*t)|0},${(b1+(b2-b1)*t)|0})`;
};
function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number=8): void {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAZE
// ═══════════════════════════════════════════════════════════════════════════════
function genMaze(mz: number, pass: number, dep: number): Uint8Array {
  const W=mz, H=mz;
  const cell=pass+WALL, wt=mz*cell+WALL;
  const rW=new Uint8Array(W*H).fill(1);
  const bW=new Uint8Array(W*H).fill(1);
  const vis=new Uint8Array(W*H);
  const stk=[(H>>1)*W+(W>>1)];
  vis[(H>>1)*W+(W>>1)]=1;
  while(stk.length){
    const idx=stk[stk.length-1];
    const cx=idx%W,cy=(idx/W)|0;
    const nb: [number, number][]=[];
    if(cx<W-1&&!vis[cy*W+cx+1])nb.push([1,0]);
    if(cx>0  &&!vis[cy*W+cx-1])nb.push([-1,0]);
    if(cy<H-1&&!vis[(cy+1)*W+cx])nb.push([0,1]);
    if(cy>0  &&!vis[(cy-1)*W+cx])nb.push([0,-1]);
    if(!nb.length){stk.pop();continue;}
    const[dx,dy]=nb[(Math.random()*nb.length)|0];
    const nx=cx+dx,ny=cy+dy;
    vis[ny*W+nx]=1;
    if(dx===1)rW[cy*W+cx]=0;
    if(dx===-1)rW[cy*W+nx]=0;
    if(dy===1)bW[cy*W+cx]=0;
    if(dy===-1)bW[cy*W+nx]=0;
    stk.push(ny*W+nx);
  }
  const deg=(cx: number,cy: number): number=>{
    let d=0;
    if(cx<W-1&&!rW[cy*W+cx])d++;
    if(cx>0  &&!rW[cy*W+cx-1])d++;
    if(cy<H-1&&!bW[cy*W+cx])d++;
    if(cy>0  &&!bW[(cy-1)*W+cx])d++;
    return d;
  };
  for(let p=0;p<dep;p++){
    for(let cy=0;cy<H;cy++)for(let cx=0;cx<W;cx++){
      if(deg(cx,cy)>1)continue;
      const opts: (()=>void)[]=[];
      if(cx<W-1&&rW[cy*W+cx])opts.push(()=>{rW[cy*W+cx]=0;});
      if(cx>0  &&rW[cy*W+cx-1])opts.push(()=>{rW[cy*W+cx-1]=0;});
      if(cy<H-1&&bW[cy*W+cx])opts.push(()=>{bW[cy*W+cx]=0;});
      if(cy>0  &&bW[(cy-1)*W+cx])opts.push(()=>{bW[(cy-1)*W+cx]=0;});
      if(opts.length)opts[(Math.random()*opts.length)|0]();
    }
  }
  const tiles=new Uint8Array(wt*wt);
  for(let cy=0;cy<H;cy++)for(let cx=0;cx<W;cx++){
    const tx0=cx*cell+WALL,ty0=cy*cell+WALL;
    for(let dy=0;dy<pass;dy++)for(let dx=0;dx<pass;dx++)tiles[(ty0+dy)*wt+(tx0+dx)]=1;
    if(cx<W-1&&!rW[cy*W+cx])for(let dy=0;dy<pass;dy++)tiles[(ty0+dy)*wt+(tx0+pass)]=1;
    if(cy<H-1&&!bW[cy*W+cx])for(let dx=0;dx<pass;dx++)tiles[(ty0+pass)*wt+(tx0+dx)]=1;
  }
  return tiles;
}

function genForest(wt: number, density: number, cluster: number, clearR: number, ringW: number, ringDensity: number): Uint8Array {
  const tiles=new Uint8Array(wt*wt).fill(1);
  for(let x=0;x<wt;x++){tiles[x]=0;tiles[(wt-1)*wt+x]=0;}
  for(let y=0;y<wt;y++){tiles[y*wt]=0;tiles[y*wt+wt-1]=0;}
  const mid=(wt/2)|0;
  const GAP=3;
  const placed:{x:number,y:number,r:number}[]=[];
  const tooClose=(cx:number,cy:number,r:number):boolean=>{
    for(const p of placed){const dx=cx-p.x,dy=cy-p.y;if(Math.sqrt(dx*dx+dy*dy)<r+p.r+GAP)return true;}return false;
  };
  const placeOrganic=(cx:number,cy:number,r:number):void=>{
    placed.push({x:cx,y:cy,r});
    const ri=Math.ceil(r)+1;
    for(let dy=-ri;dy<=ri;dy++)for(let dx=-ri;dx<=ri;dx++){
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<=r*0.65||(dist<=r*1.15&&Math.random()<0.60)){
        const tx=cx+dx,ty=cy+dy;
        if(tx>1&&tx<wt-2&&ty>1&&ty<wt-2)tiles[ty*wt+tx]=0;
      }
    }
  };
  // Global scatter
  const numAttempts=(wt*wt*density*6)|0;
  for(let i=0;i<numAttempts;i++){
    const cx=2+((Math.random()*(wt-4))|0);
    const cy=2+((Math.random()*(wt-4))|0);
    if(Math.abs(cx-mid)<clearR&&Math.abs(cy-mid)<clearR)continue;
    const r=1.4+Math.random()*cluster*0.48;
    if(tooClose(cx,cy,r))continue;
    placeOrganic(cx,cy,r);
  }
  // Dense ring around spawn
  const ringAttempts=((Math.PI*(ringW*ringW-clearR*clearR))*ringDensity*6)|0;
  for(let i=0;i<ringAttempts;i++){
    const ang=Math.random()*Math.PI*2;
    const rr=clearR+Math.random()*ringW;
    const cx=Math.max(2,Math.min(wt-3,(mid+Math.cos(ang)*rr)|0));
    const cy=Math.max(2,Math.min(wt-3,(mid+Math.sin(ang)*rr)|0));
    if(Math.abs(cx-mid)<clearR&&Math.abs(cy-mid)<clearR)continue;
    const r=1.4+Math.random()*cluster*0.48;
    if(tooClose(cx,cy,r))continue;
    placeOrganic(cx,cy,r);
  }
  // Post-process: widen 1-tile pinch corridors
  for(let ty=2;ty<wt-2;ty++)for(let tx=2;tx<wt-2;tx++){
    if(!tiles[ty*wt+tx])continue;
    const blockedH=!tiles[ty*wt+tx-1]&&!tiles[ty*wt+tx+1];
    const blockedV=!tiles[(ty-1)*wt+tx]&&!tiles[(ty+1)*wt+tx];
    if(blockedH&&!blockedV){tiles[ty*wt+tx-1]=1;}
    else if(blockedV&&!blockedH){tiles[(ty-1)*wt+tx]=1;}
  }
  // Re-enforce border
  for(let x=0;x<wt;x++){tiles[x]=0;tiles[(wt-1)*wt+x]=0;}
  for(let y=0;y<wt;y++){tiles[y*wt]=0;tiles[y*wt+wt-1]=0;}
  return tiles;
}

function genVoid(wt: number): Uint8Array {
  const tiles=new Uint8Array(wt*wt).fill(1);
  for(let x=0;x<wt;x++){tiles[x]=0;tiles[(wt-1)*wt+x]=0;}
  for(let y=0;y<wt;y++){tiles[y*wt]=0;tiles[y*wt+wt-1]=0;}
  return tiles;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SPAWN HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function floorNear(tiles: Uint8Array,camX: number,camY: number,vW: number,vH: number,excl: Set<string>,wt: number,margin: number=4): Tile|null{
  const x0=Math.max(1,((camX/T)|0)-margin);
  const y0=Math.max(1,((camY/T)|0)-margin);
  const x1=Math.min(wt-2,(((camX+vW)/T)|0)+margin);
  const y1=Math.min(wt-2,(((camY+vH)/T)|0)+margin);
  const pool: Tile[]=[];
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)
    if(tiles[ty*wt+tx]&&!excl.has(`${tx},${ty}`))pool.push({x:tx,y:ty});
  return pool.length?pool[(Math.random()*pool.length)|0]:null;
}
// Picks a random floor tile anywhere in the maze — used for initial global distribution
function floorAnywhere(tiles: Uint8Array,excl: Set<string>,wt: number): Tile|null{
  for(let a=0;a<600;a++){
    const tx=1+((Math.random()*(wt-2))|0);
    const ty=1+((Math.random()*(wt-2))|0);
    if(tiles[ty*wt+tx]&&!excl.has(`${tx},${ty}`))return{x:tx,y:ty};
  }
  return null;
}
function shapeNear(tiles: Uint8Array,camX: number,camY: number,vW: number,vH: number,existing: Shape[],snakeSet: Set<string>,wt: number,margin: number=18): Shape|null{
  const def=SHAPE_DEFS[(Math.random()*SHAPE_DEFS.length)|0];
  const occ=new Set<string>();
  for(const sh of existing)for(const t of sh.tiles)occ.add(`${t.x},${t.y}`);
  const x0=Math.max(2,((camX/T)|0)-margin);
  const y0=Math.max(2,((camY/T)|0)-margin);
  const x1=Math.min(wt-5,(((camX+vW)/T)|0)+margin);
  const y1=Math.min(wt-5,(((camY+vH)/T)|0)+margin);
  if(x1<=x0||y1<=y0)return null;
  for(let a=0;a<400;a++){
    const ox=x0+((Math.random()*(x1-x0))|0);
    const oy=y0+((Math.random()*(y1-y0))|0);
    const st=def.pts.map(([dx,dy])=>({x:ox+dx,y:oy+dy}));
    const key=(t: Tile)=>`${t.x},${t.y}`;
    if(st.every(t=>t.x>0&&t.x<wt-1&&t.y>0&&t.y<wt-1&&tiles[t.y*wt+t.x]&&!occ.has(key(t))&&!snakeSet.has(key(t))))
      return{tiles:st,bonus:def.b,id:Math.random(),col:def.col};
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIO  (Web Audio API — lazily initialised on first user action)
// ═══════════════════════════════════════════════════════════════════════════════
let _ac: AudioContext|null=null;
const ac=():AudioContext=>{
  if(!_ac)_ac=new(window.AudioContext||(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
  if(_ac.state==="suspended")_ac.resume();
  return _ac;
};
const _t=(type: OscillatorType,freq: number,t: number,dur: number,vol: number=0.12):void=>{const a=ac(),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+0.005);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.start(t);o.stop(t+dur+0.01);};
const sndClick=():void=>{const a=ac(),t=a.currentTime;_t('sine',480,t,0.055,0.038);_t('triangle',720,t,0.032,0.020);};
const sndTurnH=():void=>{const a=ac(),t=a.currentTime;const o=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(380,t+0.05);f.type='lowpass';f.frequency.value=800;o.connect(f);f.connect(g);g.connect(a.destination);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.055,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.055);o.start(t);o.stop(t+0.06);};
const sndTurnV=():void=>{const a=ac(),t=a.currentTime;const o=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(190,t+0.06);f.type='lowpass';f.frequency.value=500;o.connect(f);f.connect(g);g.connect(a.destination);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.055,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.065);o.start(t);o.stop(t+0.07);};
const sndEat=(type: number=0):void=>{const a=ac(),t=a.currentTime;const freqs=[[440,880],[440,660,1100],[330,550,880,1320],[220,330,440,660,1100,1760]];const step=[0.065,0.055,0.048,0.038][type]||0.065;(freqs[type]||freqs[0]).forEach((f,i)=>_t('sine',f,t+i*step,0.13,0.10+type*0.016));};
const sndFillStart=():void=>{const a=ac(),t=a.currentTime;[320,420,540].forEach((f,i)=>_t('square',f,t+i*0.058,0.13,0.055));};
const sndBlast=():void=>{const a=ac(),t=a.currentTime;const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(28,t+0.28);o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(0.44,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.30);o.start(t);o.stop(t+0.32);[1200,1700,2200,2800].forEach((f,i)=>_t('sine',f,t+i*0.028,0.14,0.06));};
const sndDeath=():void=>{const a=ac(),t=a.currentTime;const o=a.createOscillator(),g=a.createGain();o.type='sawtooth';o.frequency.setValueAtTime(280,t);o.frequency.exponentialRampToValueAtTime(35,t+0.18);o.connect(g);g.connect(a.destination);g.gain.setValueAtTime(0.35,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.20);o.start(t);o.stop(t+0.22);[380,300,220,140].forEach((f,i)=>_t('square',f,t+0.05+i*0.09,0.14,0.07));};
const sndPause=():void=>{const a=ac(),t=a.currentTime;_t('sine',600,t,0.09,0.09);_t('sine',400,t+0.06,0.09,0.07);};
const sndResume=():void=>{const a=ac(),t=a.currentTime;_t('sine',400,t,0.09,0.07);_t('sine',600,t+0.06,0.09,0.09);};

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const lsHSKey=(map:string,mapSize:string,maze:string)=>`snakeBlastHigh_${map}_${mapSize}_${maze}`;

export default function SnakeBlast(): JSX.Element {
  const cvs          =useRef<HTMLCanvasElement>(null);
  const gRef         =useRef<GameState|null>(null);
  const pops         =useRef<Popup[]>([]);
  const srRef        =useRef<ScreenState>("menu");
  const fsRef        =useRef<number>(0);
  const stRef        =useRef<GameSettings>({speed:"Normal",skin:"Mono",bg:"Mono",maze:"Normal",mapSize:"Small",map:"Practice"});
  const confettiRef  =useRef<ConfettiParticle[]>([]);
  const particlesRef =useRef<Particle[]>([]);
  const mazeUnlockedRef  =useRef<boolean>(false);
  const showIntroRef     =useRef<boolean>(false);
  const hsBeatenRef  =useRef<boolean>(false);
  const gameStartHSRef=useRef<number>(0);
  const newHSAnimRef  =useRef<{score:number,anim:number}|null>(null);
  const menuMapRef    =useRef<{tiles:Uint8Array,wt:number,mapType:string,forestTheme?:ForestThemeDef,theme?:ThemeDef,voidTheme?:VoidThemeDef}|null>(null);
  const menuMapAnimRef=useRef<number>(0);
  const menuPageRef   =useRef<"main"|"skins"|"maps"|"info">("main");
  const menuDirRef    =useRef<"fwd"|"back"|"none">("none");
  const coinsEarnedRef=useRef<number>(0);
  const mazeJustUnlockedRef=useRef<boolean>(false);
  const unlocksRef    =useRef<UnlockStore>({skins:["Mono"],mazethemes:["Mono"],maps:["Practice"],forestthemes:[],mapsizes:["Small"],voidthemes:[]});
  const[screen,    setScreen    ]=useState<ScreenState>("menu");
  const [showIntro,    setShowIntro]    =useState<boolean>(false);
  useEffect(()=>{showIntroRef.current=showIntro;},[showIntro]);
  const[menuPage,  setMenuPage  ]=useState<"main"|"skins"|"maps"|"info">("main");
  const[settings,  setSettings  ]=useState<GameSettings>(()=>{
    try{
      const s=localStorage.getItem("snakeBlastSettings");
      if(s){
        const p=JSON.parse(s) as GameSettings;
        // Migrate: if maze was renamed to Small/Medium/Large, move it to mapSize and reset maze to Normal
        if(p.maze==="Small"||p.maze==="Medium"||p.maze==="Large"){p.mapSize=p.maze;p.maze="Normal";}
        if(!p.mapSize)p.mapSize="Small";
        if(!MAZE_DIFF_DEFS[p.maze])p.maze="Normal";
        return p;
      }
    }catch{}
    return {speed:"Normal",skin:"Mono",bg:"Mono",maze:"Normal",mapSize:"Small",map:"Practice"};
  });
  const[highScores,setHighScores]=useState<Record<string,number>>(()=>{
    const obj:Record<string,number>={};
    // Migrate old scores (stored without mapSize) into Medium size slot
    const old=parseInt(localStorage.getItem("snakeBlastHigh")||"0");
    if(old>0)obj[`Maze_Medium_Normal`]=old;
    for(const m of ["Maze","Forest","Void"])for(const d of ["Easy","Normal","Hard"]){
      // Old format: snakeBlastHigh_Maze_Normal
      const oldV=parseInt(localStorage.getItem(`snakeBlastHigh_${m}_${d}`)||"0");
      if(oldV>0)obj[`${m}_Medium_${d}`]=Math.max(obj[`${m}_Medium_${d}`]||0,oldV);
      // New format with all 3 keys
      for(const sz of Object.keys(MAZE_SIZE_DEFS)){
        const v=parseInt(localStorage.getItem(lsHSKey(m,sz,d))||"0");
        if(v>0)obj[`${m}_${sz}_${d}`]=Math.max(obj[`${m}_${sz}_${d}`]||0,v);
      }
    }
    // Practice uses a single fixed key
    const pv=parseInt(localStorage.getItem(lsHSKey("Practice","Small","Normal"))||"0");
    if(pv>0)obj["Practice_Small_Normal"]=pv;
    return obj;
  });
  const[coins,  setCoins  ]=useState<number>(()=>Math.max(0,parseInt(localStorage.getItem("snakeBlastCoins")||"0")));
  const[unlocks,setUnlocks]=useState<UnlockStore>(()=>{
    try{
      const s=localStorage.getItem("snakeBlastUnlocks");
      if(s){
        const p=JSON.parse(s) as UnlockStore;
        if(!p.mapsizes)p.mapsizes=["Small"];
        if(!p.voidthemes)p.voidthemes=[];
        // Migration: always ensure Practice is unlocked
        if(!p.maps.includes("Practice"))p.maps=["Practice",...p.maps];
        return p;
      }
    }catch{}
    return {skins:["Mono"],mazethemes:["Mono"],maps:["Practice"],forestthemes:[],mapsizes:["Small"],voidthemes:[]};
  });
  const[viewSkin,    setViewSkin   ]=useState(()=>settings.skin);
  const[viewSpeed,   setViewSpeed  ]=useState(()=>settings.speed);
  const[viewMap,     setViewMap    ]=useState(()=>settings.map);
  const[viewMaze,    setViewMaze   ]=useState(()=>settings.maze);
  const[viewMapSize, setViewMapSize]=useState(()=>settings.mapSize||"Small");
  const[viewBg,      setViewBg     ]=useState(()=>settings.bg);
  useEffect(()=>{stRef.current=settings;localStorage.setItem("snakeBlastSettings",JSON.stringify(settings));},[settings]);
  useEffect(()=>{menuPageRef.current=menuPage;},[menuPage]);
  useEffect(()=>{
    if(menuPage==="skins"){setViewSkin(settings.skin);setViewSpeed(settings.speed);}
    else if(menuPage==="maps"){setViewMap(settings.map);setViewMaze(settings.maze);setViewMapSize(settings.mapSize||"Small");setViewBg(settings.bg);}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[menuPage]);
  useEffect(()=>{unlocksRef.current=unlocks;mazeUnlockedRef.current=unlocks.maps.includes("Maze");localStorage.setItem("snakeBlastUnlocks",JSON.stringify(unlocks));},[unlocks]);
  useEffect(()=>{
    if(menuPage!=="maps"){menuMapRef.current=null;menuMapAnimRef.current=0;return;}
    menuMapAnimRef.current=0;
    let tiles:Uint8Array,wt:number;
    if(viewMap==="Forest"){
      const fs=FOREST_SIZE_DEFS[viewMapSize]||FOREST_SIZE_DEFS.Small;
      const fd=FOREST_DIFF_DEFS[viewMaze]||FOREST_DIFF_DEFS.Normal;
      tiles=genForest(fs.wt,fd.density,fd.cluster,fd.clearR,fd.ringW,fd.ringDensity);wt=fs.wt;
    } else if(viewMap==="Void"){
      const wt2=MAZE_SIZE_DEFS[viewMapSize]?.targetWt||71;
      tiles=genVoid(wt2); wt=wt2;
    } else if(viewMap==="Practice"){
      tiles=genVoid(41); wt=41;
    } else {
      const d=mazeDims(viewMapSize,viewMaze);
      tiles=genMaze(d.mz,d.pass,d.dep);wt=d.wt;
    }
    menuMapRef.current={
      tiles,wt,mapType:viewMap,
      forestTheme:viewMap==="Forest"?(FOREST_THEMES[viewBg]||FOREST_THEMES.Pine):undefined,
      theme:viewMap==="Maze"?(THEMES[viewBg]||THEMES["Mono"]):undefined,
      voidTheme: viewMap==="Void"?(VOID_THEMES[viewBg]||VOID_THEMES.Nebula):undefined,
    };
  },[menuPage,viewMap,viewMaze,viewMapSize,viewBg]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const startGame=useCallback((opts: GameSettings):void=>{
    // Replace any locked items with their free defaults
    const ul=unlocksRef.current;
    const eff:GameSettings={...opts};
    if(!ul.skins.includes(eff.skin))eff.skin="Mono";
    if(!ul.maps.includes(eff.map)){eff.map="Practice";eff.bg="Mono";}
    else if(eff.map==="Forest"&&!ul.forestthemes.includes(eff.bg))eff.bg="Pine";
    else if(eff.map==="Maze"&&!ul.mazethemes.includes(eff.bg))eff.bg="Mono";
    else if(eff.map==="Void"&&!((ul.voidthemes||[]).includes(eff.bg)))eff.bg="Nebula";
    if(!(ul.mapsizes||[]).includes(eff.mapSize||"Small"))eff.mapSize="Small";
    if(!MAZE_DIFF_DEFS[eff.maze])eff.maze="Normal";
    let tiles: Uint8Array, wt: number, sx: number, sy: number;
    if(eff.map==="Forest"){
      const fs=FOREST_SIZE_DEFS[eff.mapSize||"Small"]||FOREST_SIZE_DEFS.Small;
      const fd=FOREST_DIFF_DEFS[eff.maze]||FOREST_DIFF_DEFS.Normal;
      tiles=genForest(fs.wt,fd.density,fd.cluster,fd.clearR,fd.ringW,fd.ringDensity);
      wt=fs.wt; sx=(wt/2)|0; sy=(wt/2)|0;
    } else if(eff.map==="Void"){
      const wt2=MAZE_SIZE_DEFS[eff.mapSize||"Small"]?.targetWt||71;
      tiles=genVoid(wt2); wt=wt2;
      sx=(wt/2)|0; sy=(wt/2)|0;
    } else if(eff.map==="Practice"){
      // Fixed small open arena — always same size regardless of setting
      tiles=genVoid(41); wt=41;
      sx=20; sy=20;
    } else {
      const d=mazeDims(eff.mapSize||"Small",eff.maze);
      tiles=genMaze(d.mz,d.pass,d.dep); wt=d.wt;
      sx=((d.mz/2)|0)*d.cell+WALL+((d.pass/2)|0);
      sy=((d.mz/2)|0)*d.cell+WALL+((d.pass/2)|0);
    }
    const vd=VOID_DIFF_DEFS[eff.maze]||VOID_DIFF_DEFS.Normal;
    const sizeMult=VOID_SIZE_MULT[eff.mapSize||"Small"]??1.0;
    const shipCount=Math.round(vd.count*sizeMult);
    const ships:Ship[]=[];
    if(eff.map==="Void"){
      for(let i=0;i<shipCount;i++){
        let spx=(wt/2|0)*T,spy=(wt/2|0)*T;
        for(let a=0;a<300;a++){
          const tx=2+((Math.random()*(wt-4))|0);
          const ty=2+((Math.random()*(wt-4))|0);
          if(Math.abs(tx-(wt/2|0))>12||Math.abs(ty-(wt/2|0))>12){spx=tx*T+T/2;spy=ty*T+T/2;break;}
        }
        const r=vd.minR+Math.random()*(vd.maxR-vd.minR);
        const spd=vd.speed*(0.55+Math.random()*0.90);
        const ang=Math.random()*Math.PI*2;
        const type=r<22?0:r<36?1:r<56?2:3;
        ships.push({x:spx,y:spy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,r,type,angle:ang});
      }
    }
    const W=cvs.current?.width||800,H=cvs.current?.height||600;
    const snake: SnakeSegment[]=[{x:sx,y:sy},{x:sx-1,y:sy},{x:sx-2,y:sy},{x:sx-3,y:sy}];
    const prevSnake=snake.map(s=>({...s}));
    const sset=new Set(snake.map(s=>`${s.x},${s.y}`));
    const camX=sx*T+T/2-W/2,camY=sy*T+T/2-H/2;
    const tier=THEME_TIER[eff.bg]??0;
    const sizeIndex={Small:0,Medium:1,Large:2}[eff.mapSize||"Small"]??0;
    const diffFruitMult={Easy:0.8,Normal:1.0,Hard:1.6}[eff.maze]??1.0;
    const forestMult=eff.map==="Forest"?1.5:1.0;
    const fruitTarget=Math.round([10+tier*2, 22+tier*3, 26+tier*3][sizeIndex]*diffFruitMult*forestMult);
    const powerupTarget=0; // kept for interface compat; actual spawning is timer-based
    const scoreMult=parseFloat(((SPEED_SCORE_MULT[eff.speed]||1)*(SIZE_SCORE_MULT[eff.mapSize||"Small"]||1)).toFixed(2));
    const baseTick=SPEEDS[eff.speed]||140;
    const fruits: Fruit[]=[],shapes: Shape[]=[],excl=new Set(sset);
    for(let i=0;i<fruitTarget;i++){
      const f=floorAnywhere(tiles,excl,wt);
      if(f){fruits.push({...f,t:rndFruitType(tier)});excl.add(`${f.x},${f.y}`);}
    }
    const initShapeTarget=shapeTargetFor(wt);
    for(let i=0;i<initShapeTarget;i++){
      const sh=shapeNear(tiles,camX,camY,W,H,shapes,sset,wt,999);
      if(sh)shapes.push(sh);
    }
    gRef.current={
      tiles,snake,prevSnake,
      dir:{x:1,y:0},dirQueue:[],
      grow:0,fruits,shapes,
      score:0,combo:0,comboTimer:0,comboPop:null,
      moveT:0,tickDur:baseTick,
      skin:SKINS[eff.skin]||SKINS.Mono,
      theme:THEMES[eff.bg]||THEMES["Mono"],
      waitInput:true,camX,camY,
      dyingTimer:0,fillAnim:null,bulges:[],pendingFill:null,reconnect:null,
      wt, mapType:eff.map,
      forestTheme: eff.map==="Forest"?(FOREST_THEMES[eff.bg]||FOREST_THEMES.Pine):undefined,
      powerups:[],baseTickDur:baseTick,fruitTarget,powerupTarget,powerupSpawnTimer:0,tier,scoreMult,
      deathCause:null,
      ships,
      voidTheme: eff.map==="Void"?(VOID_THEMES[eff.bg]||VOID_THEMES.Nebula):undefined,
    };
    pops.current=[];fsRef.current=0;
    confettiRef.current=[];particlesRef.current=[];hsBeatenRef.current=false;
    gameStartHSRef.current=parseInt(localStorage.getItem(lsHSKey(eff.map,eff.map==="Practice"?"Small":(eff.mapSize||"Small"),eff.map==="Practice"?"Normal":eff.maze))||"0");
    newHSAnimRef.current=null;
    coinsEarnedRef.current=0;
    mazeJustUnlockedRef.current=false;
    if(!localStorage.getItem("snakeBlastIntroSeen")){
      localStorage.setItem("snakeBlastIntroSeen","1");
      setShowIntro(true);
    }
    srRef.current="playing";setScreen("playing");
  },[]);

  // ── Input ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const D: Record<string, Direction>={
      ArrowUp:{x:0,y:-1},w:{x:0,y:-1},W:{x:0,y:-1},
      ArrowDown:{x:0,y:1},s:{x:0,y:1},S:{x:0,y:1},
      ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},A:{x:-1,y:0},
      ArrowRight:{x:1,y:0},d:{x:1,y:0},D:{x:1,y:0},
    };
    const applyDir=(nd: Direction):void=>{
      const g=gRef.current;
      if(!g||srRef.current!=="playing")return;
      // Check against last queued dir (or current) to prevent 180° flip
      const lastDir=g.dirQueue.length>0?g.dirQueue[g.dirQueue.length-1]:g.dir;
      if((lastDir.x!==0||lastDir.y!==0)&&nd.x===-lastDir.x&&nd.y===-lastDir.y)return;
      if(g.dirQueue.length<3){g.dirQueue.push(nd);}
      if(g.waitInput)g.waitInput=false;
    };
    const onKey=(e: KeyboardEvent):void=>{
      if(showIntroRef.current){setShowIntro(false);showIntroRef.current=false;return;}
      const nd=D[e.key];
      if(nd){e.preventDefault();applyDir(nd);}
      if((e.key===" "||e.key==="Enter")&&srRef.current==="gameover")startGame(stRef.current);
      if(e.key==="Escape"){
        if(srRef.current==="playing"){srRef.current="paused";setScreen("paused");sndPause();}
        else if(srRef.current==="paused"){srRef.current="playing";setScreen("playing");sndResume();}
      }
    };
    let t0: {x: number; y: number}|null=null;
    const onTS=(e: TouchEvent):void=>{t0={x:e.touches[0].clientX,y:e.touches[0].clientY};};
    const onTE=(e: TouchEvent):void=>{
      if(!t0)return;
      const dx=e.changedTouches[0].clientX-t0.x,dy=e.changedTouches[0].clientY-t0.y;
      t0=null;
      if(Math.abs(dx)<12&&Math.abs(dy)<12)return;
      applyDir(Math.abs(dx)>Math.abs(dy)?(dx>0?{x:1,y:0}:{x:-1,y:0}):(dy>0?{x:0,y:1}:{x:0,y:-1}));
    };
    window.addEventListener("keydown",onKey);
    window.addEventListener("touchstart",onTS,{passive:true});
    window.addEventListener("touchend",onTE,{passive:true});
    return()=>{
      window.removeEventListener("keydown",onKey);
      window.removeEventListener("touchstart",onTS);
      window.removeEventListener("touchend",onTE);
    };
  },[startGame]);

  // ── Game Loop ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    const canvas=cvs.current;if(!canvas)return;
    const ctx=canvas.getContext("2d")!;
    const resize=():void=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
    resize();window.addEventListener("resize",resize);
    let raf: number,last=0;

    const addPop=(wx: number,wy: number,text: string,col: string)=>pops.current.push({wx,wy,text,col,life:1.0});

    const addScore=(pts: number,tx: number,ty: number,g: GameState):void=>{
      g.combo++;
      const dbl=g.powerups.some(p=>p.id==="double")?2:1;
      const v=Math.round(pts*Math.sqrt(g.combo)*g.scoreMult)*dbl;g.score+=v;
      addPop(tx*T+T/2,ty*T,g.combo>=2?`+${v} ×${g.combo}`:`+${v}`,g.combo>=2?"#ff00cc":"#00ffcc");
      g.comboTimer=COMBO_DUR;
      if(g.combo>=2)g.comboPop={n:g.combo,timer:950,dur:950};
      // First time beating the high score — confetti burst around score HUD
      if(!hsBeatenRef.current&&gameStartHSRef.current>0&&g.score>gameStartHSRef.current){
        hsBeatenRef.current=true;
        const cols=["#ff0088","#00ffcc","#ffdd00","#ff4400","#00aaff","#cc00ff"];
        for(let i=0;i<38;i++){
          const ang=Math.random()*Math.PI*2,spd=50+Math.random()*150;
          confettiRef.current.push({x:150+(Math.random()-0.5)*140,y:50+(Math.random()-0.5)*50,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-90,color:cols[(Math.random()*cols.length)|0],life:1.6,rot:Math.random()*Math.PI*2,rotV:(Math.random()-0.5)*10,size:4+Math.random()*5});
        }
      }
    };

    const spawnParticles=(wx:number,wy:number,count:number,color:string,speed:number,size:number):void=>{
      for(let i=0;i<count;i++){
        const ang=Math.random()*Math.PI*2;
        const spd=speed*(0.35+Math.random()*0.85);
        particlesRef.current.push({wx,wy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-speed*0.3,color,life:0.85+Math.random()*0.55,size:size*(0.45+Math.random()*1.0)});
      }
    };

    // startDying: move snake to death position so player sees the turn, then wait
    const startDying=(g: GameState):void=>{
      g.dyingTimer=g.tickDur+1100;
      g.dyingDur  =g.tickDur+1100;
      srRef.current="dying";setScreen("dying");
      sndDeath();
    };

    const die=(g: GameState):void=>{
      fsRef.current=g.score;
      const st=stRef.current;
      const isPractice=st.map==="Practice";
      const sz=isPractice?"Small":(st.mapSize||"Small");
      const diff=isPractice?"Normal":st.maze;
      const comboKey=`${st.map}_${sz}_${diff}`;
      const lsK=lsHSKey(st.map,sz,diff);
      const prevHigh=parseInt(localStorage.getItem(lsK)||"0");
      const isNewHigh=g.score>prevHigh;
      // No coins on Practice — coins only on real maps
      const earned=isPractice?0:Math.round(Math.floor(g.score/50)*(DIFF_COIN_MULT[st.maze]||1)*(SPEED_COIN_MULT[st.speed]||1)*(SKIN_COIN_MULT[st.skin]||1));
      coinsEarnedRef.current=earned;
      if(earned>0)setCoins(c=>{const n=c+earned;localStorage.setItem("snakeBlastCoins",String(n));return n;});
      // Auto-unlock Maze when player hits 1000 score on Practice
      if(isPractice&&g.score>=1000){
        setUnlocks(prev=>{
          if(prev.maps.includes("Maze"))return prev;
          mazeJustUnlockedRef.current=true;
          const u={...prev,maps:[...prev.maps,"Maze"]};
          localStorage.setItem("snakeBlastUnlocks",JSON.stringify(u));
          return u;
        });
      }
      srRef.current="gameover";setScreen("gameover");
      setHighScores(prev=>{
        const cur=prev[comboKey]||0;
        const hs=Math.max(cur,g.score);
        if(hs>cur)localStorage.setItem(lsK,String(hs));
        return hs>cur?{...prev,[comboKey]:hs}:prev;
      });
      if(isNewHigh){
        newHSAnimRef.current={score:g.score,anim:0};
        // Confetti burst from screen center for the game over celebration
        const cols=["#ff0088","#00ffcc","#ffdd00","#ff4400","#00aaff","#cc00ff","#ffffff","#ff8800"];
        for(let i=0;i<65;i++){
          const ang=Math.random()*Math.PI*2,spd=100+Math.random()*260;
          confettiRef.current.push({x:canvas.width/2+(Math.random()-0.5)*60,y:canvas.height/2+(Math.random()-0.5)*60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-130,color:cols[(Math.random()*cols.length)|0],life:2.8,rot:Math.random()*Math.PI*2,rotV:(Math.random()-0.5)*12,size:5+Math.random()*7});
        }
      }
    };

    // Only detects fill — actual removal happens after the flash animation
    const checkShapes=(g: GameState):void=>{
      if(g.pendingFill)return;
      const hd=g.snake[0];
      const bset=new Set<string>();
      for(let i=1;i<g.snake.length;i++)bset.add(`${g.snake[i].x},${g.snake[i].y}`);
      for(let si=g.shapes.length-1;si>=0;si--){
        const sh=g.shapes[si];
        if(sh.tiles.some(t=>t.x===hd.x&&t.y===hd.y))continue;
        if(!sh.tiles.every(t=>bset.has(`${t.x},${t.y}`)))continue;
        const rem=new Set(sh.tiles.map(t=>`${t.x},${t.y}`));
        const cx=(sh.tiles.reduce((a,t)=>a+t.x,0)/sh.tiles.length)|0;
        const cy=(sh.tiles.reduce((a,t)=>a+t.y,0)/sh.tiles.length)|0;
        const prevByCoord=new Map<string,SnakeSegment>();
        for(let i=0;i<g.snake.length;i++)prevByCoord.set(`${g.snake[i].x},${g.snake[i].y}`,g.prevSnake[i]||g.snake[i]);
        g.pendingFill={rem,prevByCoord,bonus:sh.bonus,cx,cy,tiles:sh.tiles,timer:500,dur:500,col:sh.col};
        sndFillStart();
        return; // one at a time
      }
    };

    const tick=(g: GameState,W: number,H: number):void=>{
      if(g.waitInput)return;
      if(g.dirQueue.length>0){const nd=g.dirQueue.shift()!;if(nd.x!==g.dir.x||nd.y!==g.dir.y){nd.x!==0?sndTurnH():sndTurnV();}g.dir=nd;}
      const hd=g.snake[0];
      const nh={x:hd.x+g.dir.x,y:hd.y+g.dir.y};
      const growing=g.grow>0;

      // Helper: move snake to death position so the turn is visible, then die
      const dieAt=(cause:"wall"|"body"|"ship"):void=>{
        g.deathCause=cause;
        g.prevSnake=growing?[g.snake[0],...g.snake]:[...g.snake];
        g.snake.unshift(nh);
        if(growing)g.grow--;else g.snake.pop();
        startDying(g);
      };

      // Wall collision
      if(nh.x<0||nh.x>=g.wt||nh.y<0||nh.y>=g.wt||!g.tiles[nh.y*g.wt+nh.x]){dieAt("wall");return;}

      // Ship collision
      if(g.ships.length>0){
        const nhpx=nh.x*T+T/2,nhpy=nh.y*T+T/2;
        for(const ship of g.ships){
          const ddx=nhpx-ship.x,ddy=nhpy-ship.y;
          if(ddx*ddx+ddy*ddy<(ship.r+T*0.38)*(ship.r+T*0.38)){dieAt("ship");return;}
        }
      }

      // Self-collision — ghost powerup bypasses it entirely
      if(!g.powerups.some(p=>p.id==="ghost")){
        const bodyEnd=growing?g.snake.length:g.snake.length-1;
        for(let i=0;i<bodyEnd;i++){
          if(g.snake[i].x===nh.x&&g.snake[i].y===nh.y){dieAt("body");return;}
        }
      }

      // Normal movement
      g.prevSnake=growing?[g.snake[0],...g.snake]:[...g.snake];
      g.snake.unshift(nh);
      if(growing)g.grow--;else g.snake.pop();
      const sset=new Set(g.snake.map(s=>`${s.x},${s.y}`));
      for(let i=0;i<g.fruits.length;i++){
        const f=g.fruits[i];
        if(f.x!==nh.x||f.y!==nh.y)continue;
        g.fruits.splice(i,1);
        if(f.pw){
          const def=POWERUP_DEFS.find(p=>p.id===f.pw);
          if(def){
            g.powerups=g.powerups.filter(p=>p.id!==f.pw); // refresh if already active
            g.powerups.push({id:f.pw,timer:def.dur,dur:def.dur});
            addScore(def.score,nh.x,nh.y,g);
            addPop(nh.x*T+T/2,nh.y*T-T,`${def.icon} ${f.pw.toUpperCase()}!`,def.col);
            g.powerupSpawnTimer=0;
            g.bulges.push({t:0});sndEat(3);
            spawnParticles(nh.x*T+T/2,nh.y*T+T/2,20,def.col,230,7);
            spawnParticles(nh.x*T+T/2,nh.y*T+T/2,10,"#ffffff",160,4);
          }
        } else {
          const ft=FRUIT_TYPES[f.t||0];
          g.grow+=ft.grow;addScore(ft.score,nh.x,nh.y,g);g.bulges.push({t:0});sndEat(f.t||0);
          const PCOLS=["#ffdd44","#00ffaa","#88aaff","#ffdd00"];
          const PSPEEDS=[90,125,165,210];const PCOUNTS=[7,12,16,22];
          spawnParticles(nh.x*T+T/2,nh.y*T+T/2,PCOUNTS[f.t||0],PCOLS[f.t||0],PSPEEDS[f.t||0],3.5+(f.t||0)*1.5);
        }
        break;
      }
      checkShapes(g);
      // Cull items that have scrolled too far off-screen
      const cx0=(g.camX/T|0)-CULL_MARGIN, cy0=(g.camY/T|0)-CULL_MARGIN;
      const cx1=((g.camX+W)/T|0)+CULL_MARGIN, cy1=((g.camY+H)/T|0)+CULL_MARGIN;
      g.fruits=g.fruits.filter(f=>f.x>=cx0&&f.x<=cx1&&f.y>=cy0&&f.y<=cy1);
      g.shapes=g.shapes.filter(sh=>sh.tiles.some(t=>t.x>=cx0&&t.x<=cx1&&t.y>=cy0&&t.y<=cy1));
      // Respawn near camera to maintain density wherever the snake is
      const excl=new Set(sset);for(const ff of g.fruits)excl.add(`${ff.x},${ff.y}`);
      while(g.fruits.filter(f=>!f.pw).length<g.fruitTarget){
        const nf=floorNear(g.tiles,g.camX,g.camY,W,H,excl,g.wt,20);
        if(!nf)break;g.fruits.push({...nf,t:rndFruitType(g.tier)});excl.add(`${nf.x},${nf.y}`);
      }
      // Powerup spawning is timer-based (handled in main update loop)
      while(g.shapes.length<shapeTargetFor(g.wt)){
        const ns=shapeNear(g.tiles,g.camX,g.camY,W,H,g.shapes,sset,g.wt);
        if(!ns)break;g.shapes.push(ns);
      }
    };

    const drawSnake=(g: GameState,alpha: number,ts: number):void=>{
      const{snake,prevSnake,skin,dir,fruits}=g;
      if(!snake.length)return;
      const pts=snake.map((seg,i)=>{
        const p=prevSnake[i]||seg;
        return{x:lerp(p.x,seg.x,alpha)*T+T/2,y:lerp(p.y,seg.y,alpha)*T+T/2};
      });
      // Reconnect animation: each back segment walks its stored waypoint path
      if(g.reconnect){
        const prog=clamp(1-g.reconnect.timer/g.reconnect.dur,0,1);
        const{gapIdx,M,paths}=g.reconnect;
        for(let j=0;j<M;j++){
          const i=gapIdx+j;
          const path=paths[j];
          if(i<pts.length&&path&&path.length>=2){
            const n=path.length-1;
            const tg=prog*n;
            const k=Math.min(n-1,Math.floor(tg));
            const f=tg-k;
            pts[i]={x:lerp(path[k].x,path[k+1].x,f)*T+T/2,y:lerp(path[k].y,path[k+1].y,f)*T+T/2};
          }
        }
      }
      // When only the head remains, add a half-tile visual stub behind it
      if(pts.length===1&&(dir.x!==0||dir.y!==0)){
        pts.push({x:pts[0].x-dir.x*T*0.5,y:pts[0].y-dir.y*T*0.5});
      }
      const ghostActive=g.powerups.some(p=>p.id==="ghost");
      const lw=T*0.58;
      const N=pts.length;
      // Split into sub-paths wherever shape-fill removed a segment (gap > 1.9 tiles)
      const subPaths: {x:number;y:number}[][]=[];
      {let cur=[pts[0]];
      for(let i=1;i<N;i++){
        const dx=pts[i].x-pts[i-1].x,dy=pts[i].y-pts[i-1].y;
        if(dx*dx+dy*dy>T*T*3.61){subPaths.push(cur);cur=[pts[i]];}
        else cur.push(pts[i]);
      }subPaths.push(cur);}
      // Midpoint smoothing per sub-path — curves through midpoints so 90° turns round naturally
      const smooth=(p: {x:number;y:number}[]):void=>{
        const n=p.length;if(!n)return;
        const mx=(i: number,j: number)=>(p[i].x+p[j].x)/2;
        const my=(i: number,j: number)=>(p[i].y+p[j].y)/2;
        if(n===1){ctx.moveTo(p[0].x,p[0].y);return;}
        ctx.moveTo(mx(0,1),my(0,1));
        for(let i=1;i<n-1;i++)ctx.quadraticCurveTo(p[i].x,p[i].y,mx(i,i+1),my(i,i+1));
        ctx.lineTo(p[n-1].x,p[n-1].y);
      };
      // Build the snake path ONCE — reused for all body stroke passes (eliminates 8x redundant path builds)
      ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
      ctx.beginPath();
      for(const sp of subPaths)smooth(sp);

      // Ghost: pulsing blue glow and reduced base opacity
      if(ghostActive){
        const gp=0.18+0.12*Math.sin(ts*0.008);
        ctx.lineWidth=lw+30;ctx.strokeStyle="#3333ff";ctx.globalAlpha=gp;ctx.stroke();
        ctx.lineWidth=lw+14;ctx.strokeStyle="#aaaaff";ctx.globalAlpha=gp*0.5;ctx.stroke();
        ctx.globalAlpha=1;
      }

      // Outer glow
      ctx.lineWidth=lw+18;ctx.strokeStyle=skin.glow;ctx.globalAlpha=ghostActive?0.02:0.03;ctx.stroke();
      ctx.lineWidth=lw+8;ctx.globalAlpha=ghostActive?0.04:0.07;ctx.stroke();
      ctx.globalAlpha=1;

      // Drop shadow — makes snake look elevated above the floor
      ctx.shadowColor="rgba(0,0,0,0.6)";ctx.shadowBlur=12;
      ctx.shadowOffsetX=3;ctx.shadowOffsetY=7;
      ctx.lineWidth=lw;ctx.strokeStyle="rgba(0,0,0,0.01)";ctx.stroke();
      ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;

      // Dark edge ring — peeks out around the main body, gives roundness/depth
      ctx.lineWidth=lw+4;ctx.strokeStyle="rgba(0,0,0,0.50)";ctx.stroke();

      // Main body — gradient along length (tail colour → head colour)
      const gr=ctx.createLinearGradient(pts[N-1].x,pts[N-1].y,pts[0].x,pts[0].y);
      gr.addColorStop(0,skin.a);gr.addColorStop(1,skin.b);
      ctx.lineWidth=lw;ctx.strokeStyle=gr;ctx.stroke();

      // Cylinder highlight + specular drawn here before tabs (path still valid)
      ctx.lineWidth=lw*0.45;ctx.strokeStyle=lerpHex(skin.a,"#ffffff",0.28);ctx.globalAlpha=0.50;ctx.stroke();
      ctx.lineWidth=lw*0.13;ctx.strokeStyle="#ffffff";ctx.globalAlpha=0.28;ctx.stroke();
      ctx.globalAlpha=1;

      // ── Body tabs — alternating chevron lightning marks from each edge ─────
      // (tabs call beginPath per triangle, which is fine — path strokes already done above)
      {const sp=subPaths[0];
      if(sp.length>=3){
        ctx.save();
        const thw=lw*0.23;
        const oY =lw*0.48;
        const iY =lw*0.09;
        // Precompute RGB for both skin colors once — avoids 4 hex-parses per tab
        const[ar,ag,ab]=hRgb(skin.a),[br,bg2,bb]=hRgb(skin.b);
        const Nm1=Math.max(N-1,1);
        for(let i=2;i<sp.length-1;i++){
          const dx=sp[i].x-sp[i-1].x,dy=sp[i].y-sp[i-1].y;
          const len=Math.sqrt(dx*dx+dy*dy);if(len<2)continue;
          const cs=dx/len,sn=dy/len;
          const mx=(sp[i-1].x+sp[i].x)*0.5,my=(sp[i-1].y+sp[i].y)*0.5;
          const tf=clamp(i/Nm1,0,1);
          // Numeric lerp: skin.b→skin.a, then darken 36% — no string parsing
          const tr=((br+(ar-br)*tf)*0.64)|0;
          const tg=((bg2+(ag-bg2)*tf)*0.64)|0;
          const tb=((bb+(ab-bb)*tf)*0.64)|0;
          const so=(i%2===0)?oY:-oY;
          const si2=(i%2===0)?iY:-iY;
          ctx.fillStyle=`rgb(${tr},${tg},${tb})`;ctx.globalAlpha=0.88;
          ctx.beginPath();
          ctx.moveTo(mx-thw*cs-so*sn, my-thw*sn+so*cs);
          ctx.lineTo(mx-si2*sn,        my+si2*cs);
          ctx.lineTo(mx+thw*cs-so*sn, my+thw*sn+so*cs);
          ctx.closePath();ctx.fill();
        }
        ctx.globalAlpha=1;ctx.restore();
      }}

      ctx.globalAlpha=1;
      ctx.restore();

      // ── Pending fill — flash the body segments that are about to be removed ─
      if(g.pendingFill){
        const{rem,timer,dur}=g.pendingFill;
        const prog=1-timer/dur;
        const flash=0.5+0.5*Math.sin(prog*Math.PI*10);
        ctx.save();ctx.shadowColor="#ff88ff";ctx.shadowBlur=18;
        snake.forEach((seg,i)=>{
          if(!rem.has(`${seg.x},${seg.y}`))return;
          ctx.globalAlpha=0.55+flash*0.40;
          ctx.fillStyle=`rgba(255,120,255,0.90)`;
          ctx.beginPath();ctx.arc(pts[i].x,pts[i].y,lw*0.52,0,Math.PI*2);ctx.fill();
        });
        ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.restore();
      }
      // ── Swallow bulge (travels from head to tail when fruit eaten) ────────
      if(g.bulges&&g.bulges.length&&N>1){
        ctx.save();
        for(const b of g.bulges){
          const idx=b.t*(N-1);
          const i0=Math.floor(idx),i1=Math.min(N-1,i0+1);
          const f=idx-i0;
          const bx=lerp(pts[i0].x,pts[i1].x,f),by=lerp(pts[i0].y,pts[i1].y,f);
          const br=lw*(0.56+0.30*Math.sin(Math.PI*b.t));
          ctx.globalAlpha=0.80*(1-b.t*0.35);
          ctx.shadowColor=skin.glow;ctx.shadowBlur=10;
          ctx.fillStyle="rgba(0,0,0,0.45)";
          ctx.beginPath();ctx.arc(bx,by,br+3,0,Math.PI*2);ctx.fill();
          const gr2=ctx.createRadialGradient(bx-2,by-3,1,bx,by,br);
          gr2.addColorStop(0,lerpHex(skin.a,"#ffffff",0.35));
          gr2.addColorStop(1,skin.b);
          ctx.fillStyle=gr2;
          ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();
        }
        ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.restore();
      }

      // ── Fill animation (removed segments slide to new tail) ──────────────
      if(g.fillAnim){
        const{segs,cutPt,timer,dur}=g.fillAnim;
        const prog=1-timer/dur;
        ctx.save();ctx.shadowBlur=0;
        segs.forEach((seg,si)=>{
          const delay=0.25*(si/segs.length);
          const p=clamp((prog-delay)/(1-delay),0,1);
          const px=lerp(seg.x,cutPt.x,p),py=lerp(seg.y,cutPt.y,p);
          const fa=(1-p)*0.88;
          const fr=lw*0.50*(1-p*0.55);
          ctx.globalAlpha=fa;
          ctx.fillStyle="rgba(0,0,0,0.50)";
          ctx.beginPath();ctx.arc(px,py,fr+2,0,Math.PI*2);ctx.fill();
          ctx.fillStyle=lerpHex(skin.b,skin.a,p);
          ctx.beginPath();ctx.arc(px,py,fr,0,Math.PI*2);ctx.fill();
        });
        ctx.globalAlpha=1;ctx.restore();
      }

      // ── Head ────────────────────────────────────────────────────────────
      ctx.save();
      const hp=pts[0];
      const pp=pts[1]||hp;
      const adx=hp.x-pp.x,ady=hp.y-pp.y;
      const alen=Math.sqrt(adx*adx+ady*ady);
      const bodyAngle=alen>0.5?Math.atan2(ady,adx):Math.atan2(dir.y||0,dir.x||1);

      // Mouth — open when any fruit is exactly 1 tile away from the head
      const hx=snake[0].x,hy=snake[0].y;
      let mouthOpen=0;
      for(const f of fruits){
        if(Math.abs(f.x-hx)+Math.abs(f.y-hy)===1){mouthOpen=0.42;break;}
      }

      const hw=T*0.88;
      const rx=hw*0.62;
      const ry=hw*0.44;
      const hcx=hp.x+Math.cos(bodyAngle)*rx*0.18;
      const hcy=hp.y+Math.sin(bodyAngle)*rx*0.18;
      ctx.translate(hcx,hcy);ctx.rotate(bodyAngle);

      // Squash & stretch during crash impact — compress along travel, expand perpendicular
      if(g.dyingTimer>0&&g.dyingDur){
        const dp=clamp(1-g.dyingTimer/g.dyingDur,0,1);
        const si=clamp((dp-0.08)/0.26,0,1);
        const sq=si<0.5?si*2:2-si*2;   // triangle: 0→1 at impact peak, back to 0
        ctx.scale(1-sq*0.40, 1+sq*0.30);  // squish forward, bulge outward
      }

      // Neck connector — filled ellipse bridging the body tube into the head rear
      ctx.fillStyle=lerpHex(skin.head,skin.b,0.44);
      ctx.beginPath();ctx.ellipse(-rx*0.46,0,rx*0.56,Math.min(lw*0.52,ry),0,0,Math.PI*2);ctx.fill();

      // Drop shadow
      ctx.shadowColor="rgba(0,0,0,0.60)";ctx.shadowBlur=12;ctx.shadowOffsetX=2;ctx.shadowOffsetY=6;
      ctx.fillStyle="rgba(0,0,0,0.01)";
      ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();
      ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;

      // Dark outline
      ctx.strokeStyle="rgba(0,0,0,0.45)";ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();

      // Glow + base fill — head stays a single solid ellipse always
      ctx.shadowColor=skin.glow;ctx.shadowBlur=26;
      const hg=ctx.createRadialGradient(-rx*0.22,-ry*0.22,ry*0.06,0,0,rx*1.1);
      hg.addColorStop(0,lerpHex(skin.head,"#ffffff",0.50));
      hg.addColorStop(0.40,skin.head);
      hg.addColorStop(1,lerpHex(skin.head,skin.b,0.55));
      ctx.fillStyle=hg;
      ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;

      // Cylinder highlight
      ctx.strokeStyle=lerpHex(skin.head,"#ffffff",0.55);
      ctx.lineWidth=ry*0.38;ctx.globalAlpha=0.42;
      ctx.beginPath();ctx.ellipse(0,0,rx*0.72,ry*0.45,0,Math.PI*0.88,Math.PI*2.12);ctx.stroke();
      ctx.globalAlpha=1;

      // Snout bump
      ctx.fillStyle=lerpHex(skin.head,skin.b,0.35);
      ctx.beginPath();ctx.ellipse(rx*0.72,0,rx*0.28,ry*0.52,0,0,Math.PI*2);ctx.fill();

      // Mouth — along the forward axis (x) at y=0 in local head frame
      ctx.lineCap="round";
      if(mouthOpen>0){
        // Round opening at snout tip
        ctx.fillStyle="#150004";
        ctx.beginPath();ctx.arc(rx*0.84,0,ry*0.19,0,Math.PI*2);ctx.fill();
        // Tongue from opening tip
        const tTip=rx*0.84+ry*0.19,tLen=rx*0.38,tFork=rx*0.15;
        ctx.strokeStyle="#ff1144";ctx.lineWidth=2.4;ctx.globalAlpha=0.95;
        ctx.beginPath();ctx.moveTo(tTip,0);ctx.lineTo(tTip+tLen,0);ctx.stroke();
        ctx.lineWidth=1.8;
        ctx.beginPath();ctx.moveTo(tTip+tLen,0);ctx.lineTo(tTip+tLen+tFork,-ry*0.24);ctx.stroke();
        ctx.beginPath();ctx.moveTo(tTip+tLen,0);ctx.lineTo(tTip+tLen+tFork, ry*0.24);ctx.stroke();
        ctx.globalAlpha=1;
      } else {
        // Closed mouth — short seam sitting under the nostrils
        ctx.strokeStyle="rgba(0,0,0,0.48)";ctx.lineWidth=1.5;ctx.globalAlpha=0.58;
        ctx.beginPath();ctx.moveTo(rx*0.60,0);ctx.lineTo(rx*0.90,0);ctx.stroke();
        ctx.globalAlpha=1;
      }

      // Nostrils
      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.beginPath();ctx.ellipse(rx*0.80,-ry*0.28,rx*0.055,ry*0.10,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(rx*0.80, ry*0.28,rx*0.055,ry*0.10,0,0,Math.PI*2);ctx.fill();

      // Eyes
      const ey=ry*0.72,ex=rx*0.28,er=ry*0.28,ei=er*0.42;
      ctx.fillStyle="#040c1e";
      ctx.beginPath();ctx.arc(ex,-ey,er,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(ex, ey,er,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=skin.glow;ctx.globalAlpha=0.90;
      ctx.beginPath();ctx.arc(ex-er*0.25,-ey-er*0.25,ei,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(ex-er*0.25, ey-er*0.25,ei,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;

      ctx.restore();
    };

    const drawHUD=(W: number,H: number,g: GameState):void=>{
      const vW=W,vH=H;
      if(g.mapType==="Practice"&&!mazeUnlockedRef.current){
        const prog=Math.min(1,g.score/1000);
        const bw=Math.min(vW*0.6,320),bh=14,bx=(vW-bw)/2,by=vH-28;
        ctx.fillStyle="rgba(0,0,0,0.55)";
        rRect(ctx,bx-6,by-6,bw+12,bh+12,6);ctx.fill();
        ctx.fillStyle="#112211";
        rRect(ctx,bx,by,bw,bh,4);ctx.fill();
        ctx.fillStyle="#00ff66";
        if(prog>0){rRect(ctx,bx,by,bw*prog,bh,4);ctx.fill();}
        ctx.fillStyle="#aaffcc";ctx.font=`bold 11px 'Courier New',monospace`;ctx.textAlign="center";
        ctx.fillText(`Score ${g.score}/1000 to unlock Maze`,vW/2,by-10);
      }
      const newHS=hsBeatenRef.current;
      const scoreCol=newHS?"#ffdd00":"#00ffcc";
      const scoreBorder=newHS?"rgba(255,210,0,0.30)":"rgba(0,255,200,0.22)";
      const scoreLbl=newHS?"rgba(255,210,0,0.45)":"rgba(0,255,200,0.38)";
      ctx.save();ctx.textBaseline="middle";
      // Score panel (enlarged)
      ctx.fillStyle="rgba(0,6,20,0.88)";rRect(ctx,10,10,340,96);ctx.fill();
      ctx.strokeStyle=scoreBorder;ctx.lineWidth=1;rRect(ctx,10,10,340,96);ctx.stroke();
      ctx.fillStyle=scoreCol;ctx.shadowColor=scoreCol;ctx.shadowBlur=22;
      ctx.textAlign="left";ctx.font=`bold 56px "Courier New"`;
      ctx.fillText(`${g.score}`,22,52);
      ctx.shadowBlur=0;ctx.fillStyle=scoreLbl;
      ctx.font=`bold 12px "Courier New"`;
      ctx.fillText("SCORE",22,88);
      ctx.fillStyle="rgba(0,200,100,0.45)";ctx.font=`12px "Courier New"`;
      ctx.fillText(`BODY  ${g.snake.length}`,110,88);
      if(g.scoreMult!==1.0){
        const mCol=g.scoreMult>1?"#ffcc44":"rgba(150,150,150,0.60)";
        ctx.fillStyle=mCol;ctx.shadowColor=mCol;ctx.shadowBlur=6;
        ctx.fillText(`×${g.scoreMult.toFixed(2)}`,230,88);
        ctx.shadowBlur=0;
      }
      // Combo HUD strip (only when streak ≥ 2, enlarged)
      if(g.combo>=2){
        ctx.fillStyle="rgba(0,0,18,0.88)";rRect(ctx,W-250,10,240,96);ctx.fill();
        ctx.strokeStyle="rgba(255,0,200,0.28)";ctx.lineWidth=1;rRect(ctx,W-250,10,240,96);ctx.stroke();
        ctx.fillStyle="#ff00cc";ctx.shadowColor="#ff00cc";ctx.shadowBlur=22;
        ctx.textAlign="right";ctx.font=`bold 56px "Courier New"`;
        ctx.fillText(`×${g.combo}`,W-16,52);
        ctx.shadowBlur=0;ctx.fillStyle="rgba(255,0,200,0.38)";
        ctx.font=`bold 12px "Courier New"`;ctx.fillText("COMBO",W-16,88);
        // Timer bar
        const bx=W-243,by=112,bw=226,bh=4;
        ctx.fillStyle="rgba(255,0,180,0.12)";ctx.fillRect(bx,by,bw,bh);
        const pct=clamp(g.comboTimer/COMBO_DUR,0,1);
        const gg=ctx.createLinearGradient(bx,0,bx+bw,0);
        gg.addColorStop(0,"#ff0088");gg.addColorStop(1,"#dd00ff");
        ctx.fillStyle=gg;ctx.shadowColor="#ff00cc";ctx.shadowBlur=4;
        ctx.fillRect(bx,by,bw*pct,bh);
        ctx.shadowBlur=0;
      }
      // ── Active powerup bars (stacked below score panel) ──────────────────
      if(g.powerups.length>0){
        const bx=10,bw=194;
        g.powerups.forEach((pw,idx)=>{
          const def=POWERUP_DEFS.find(p=>p.id===pw.id);if(!def)return;
          const by=116+idx*24;
          const frac=clamp(pw.timer/pw.dur,0,1);
          const[pr,pg2,pb]=hRgb(def.col);
          ctx.fillStyle="rgba(0,6,20,0.78)";rRect(ctx,bx,by,bw,20,4);ctx.fill();
          ctx.fillStyle=`rgba(${pr},${pg2},${pb},0.18)`;ctx.fillRect(bx+2,by+2,bw-4,16);
          const bg2=ctx.createLinearGradient(bx,0,bx+bw,0);
          bg2.addColorStop(0,def.col);bg2.addColorStop(1,def.glow);
          ctx.fillStyle=bg2;ctx.globalAlpha=0.80;ctx.fillRect(bx+2,by+2,(bw-4)*frac,16);
          ctx.globalAlpha=1;ctx.shadowColor=def.glow;ctx.shadowBlur=5;
          ctx.fillStyle="#fff";ctx.textAlign="left";ctx.textBaseline="middle";
          ctx.font=`bold 10px "Courier New"`;
          ctx.fillText(`${def.icon} ${pw.id.toUpperCase()}`,bx+7,by+10);
          ctx.shadowBlur=0;
        });
      }
      ctx.restore();
    };

    const drawComboPop=(W: number,H: number,g: GameState):void=>{
      if(!g.comboPop)return;
      const{n,timer,dur}=g.comboPop;
      const prog=1-timer/dur;                              // 0→1 as animation plays
      const rise=H*0.08*Math.pow(prog,0.4);                // fast upward rise
      const cy=H/2-60-rise;
      const sc=1+0.5*Math.pow(Math.max(0,1-prog*3.5),2);  // big pop then settles to 1
      const alpha=prog<0.65?1:1-(prog-0.65)/0.35;
      ctx.save();ctx.globalAlpha=alpha;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.translate(W/2,cy);ctx.scale(sc,sc);
      // Shadow / halo
      ctx.shadowColor="#ff00cc";ctx.shadowBlur=40;
      ctx.fillStyle="#ff00cc";
      ctx.font=`bold 52px "Courier New"`;
      ctx.fillText(`×${n}`,0,0);
      // White core
      ctx.shadowBlur=0;ctx.fillStyle="#ffffff";ctx.globalAlpha=alpha*0.9;
      ctx.font=`bold 52px "Courier New"`;
      ctx.fillText(`×${n}`,0,0);
      // Label beneath
      ctx.globalAlpha=alpha*0.8;ctx.fillStyle="#ff88ee";
      ctx.font=`bold 15px "Courier New"`;ctx.letterSpacing="4px";
      ctx.fillText("COMBO",0,38);
      ctx.restore();
    };

    const drawWait=(W: number,H: number,ts: number):void=>{
      const p=0.5+0.5*Math.sin(ts/420);
      ctx.save();
      ctx.fillStyle="rgba(0,6,20,0.78)";rRect(ctx,W/2-185,H/2-27,370,54,10);ctx.fill();
      ctx.strokeStyle=`rgba(0,255,200,${0.20+0.20*p})`;ctx.lineWidth=1.5;
      rRect(ctx,W/2-185,H/2-27,370,54,10);ctx.stroke();
      ctx.globalAlpha=0.50+0.50*p;
      ctx.fillStyle="#00ffcc";ctx.shadowColor="#00ffcc";ctx.shadowBlur=10;
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font=`bold 14px "Courier New"`;
      ctx.fillText("PRESS  WASD  OR  ARROW  KEYS  TO  BEGIN",W/2,H/2);
      ctx.restore();
    };

    // Renders as overlay — caller draws the dark backdrop first
    const drawGO=(W: number,H: number,ts: number,newHS: {score:number,anim:number}|null=null):void=>{
      ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.shadowBlur=42;ctx.shadowColor="#ff0044";
      ctx.fillStyle="#ff2255";ctx.font=`bold 50px "Courier New"`;
      ctx.fillText("GAME  OVER",W/2,H/2-90);
      ctx.shadowColor="#00ffcc";ctx.fillStyle="#00ffcc";
      ctx.font=`bold 22px "Courier New"`;ctx.shadowBlur=10;
      ctx.fillText(`FINAL SCORE:  ${fsRef.current}`,W/2,H/2-30);
      const p=0.5+0.5*Math.sin(ts/500);
      ctx.globalAlpha=0.35+0.65*p;ctx.fillStyle="#fff";ctx.shadowBlur=0;
      ctx.font=`bold 12px "Courier New"`;
      ctx.fillText("SPACE · ENTER  to play again",W/2,H/2+14);
      // New high score slide-in animation
      if(newHS){
        const ease=1-Math.pow(1-Math.min(newHS.anim,1),3);
        const y=lerp(H+120,H*0.60,ease);
        const al=Math.min(newHS.anim*3,1);
        ctx.globalAlpha=al;
        ctx.shadowColor="#ffdd00";ctx.shadowBlur=28;
        ctx.fillStyle="#ffdd44";ctx.font=`bold 13px "Courier New"`;
        ctx.letterSpacing="5px";ctx.fillText("NEW  HIGHSCORE!",W/2,y);
        ctx.letterSpacing="0px";ctx.shadowBlur=55;ctx.font=`bold 68px "Courier New"`;
        ctx.fillStyle="#ffffff";ctx.shadowColor="#ffdd00";
        ctx.fillText(`${newHS.score}`,W/2,y+54);
        ctx.shadowBlur=0;
      }
      ctx.restore();
    };


    const renderMenuMap=(W: number,H: number,ts: number,dt: number):void=>{
      const mm=menuMapRef.current;
      menuMapAnimRef.current=Math.min(1,menuMapAnimRef.current+dt/700);
      const et=1-Math.pow(1-menuMapAnimRef.current,3);
      if(!mm){
        ctx.fillStyle=`rgba(0,0,0,${lerp(1,0.72,et)})`;ctx.fillRect(0,0,W,H);return;
      }
      const cx=clamp((mm.wt/2)*T-W/2+Math.sin(ts*0.00018)*T*5,0,mm.wt*T-W);
      const cy=clamp((mm.wt/2)*T-H/2+Math.cos(ts*0.00013)*T*4,0,mm.wt*T-H);
      ctx.save();ctx.translate(-cx,-cy);
      const tx0=Math.max(0,(cx/T|0)-1),ty0=Math.max(0,(cy/T|0)-1);
      const tx1=Math.min(mm.wt-1,tx0+(W/T|0)+3),ty1=Math.min(mm.wt-1,ty0+(H/T|0)+3);
      const e=4;
      for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
        const fl=mm.tiles[ty*mm.wt+tx];
        const px=tx*T,py=ty*T;
        if(fl){
          if(mm.mapType==="Forest"){
            const ft=mm.forestTheme!;
            ctx.fillStyle=ft.floor;ctx.fillRect(px,py,T,T);
            ctx.fillStyle="rgba(0,0,0,0.28)";ctx.fillRect(px,py,T,e);ctx.fillRect(px,py,e,T);
            ctx.fillStyle="rgba(255,255,255,0.04)";ctx.fillRect(px,py+T-e,T,e);ctx.fillRect(px+T-e,py,e,T);
            ctx.strokeStyle=ft.grid;ctx.lineWidth=0.8;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
          } else if(mm.mapType==="Void"||mm.mapType==="Practice"){
            // floor tiles: just show bg (no rendering needed — bg already fills)
          } else {
            const th=mm.theme!;
            ctx.fillStyle=th.floor;ctx.fillRect(px,py,T,T);
            ctx.fillStyle="rgba(0,0,0,0.32)";ctx.fillRect(px,py,T,e);ctx.fillRect(px,py,e,T);
            ctx.fillStyle="rgba(255,255,255,0.06)";ctx.fillRect(px,py+T-e,T,e);ctx.fillRect(px+T-e,py,e,T);
            ctx.strokeStyle=th.grid;ctx.lineWidth=0.8;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
          }
        } else {
          if(mm.mapType==="Forest"){
            const ft=mm.forestTheme!;
            ctx.fillStyle=ft.treeGround;ctx.fillRect(px,py,T,T);
            ctx.fillStyle=ft.trunk;ctx.fillRect(px+(T*0.38)|0,py+(T*0.62)|0,(T*0.24)|0,(T*0.38)|0);
            ctx.shadowColor="rgba(0,0,0,0.55)";ctx.shadowBlur=10;ctx.shadowOffsetY=5;
            ctx.fillStyle=ft.canopy1;ctx.beginPath();ctx.arc(px+T*0.5,py+T*0.38,T*0.43,0,Math.PI*2);ctx.fill();
            ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetY=0;
            ctx.fillStyle=ft.canopy2;ctx.globalAlpha=0.80;ctx.beginPath();ctx.arc(px+T*0.5,py+T*0.34,T*0.33,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
            ctx.fillStyle=ft.canopy3;ctx.globalAlpha=0.55;ctx.beginPath();ctx.arc(px+T*0.38,py+T*0.24,T*0.16,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
          } else if(mm.mapType==="Void"){
            const vt=mm.voidTheme as VoidThemeDef;
            ctx.fillStyle=vt?.bg||"#06001a";ctx.fillRect(px,py,T,T);
            ctx.strokeStyle=vt?.barrierCol||"#aa00ff";ctx.lineWidth=1.2;
            ctx.shadowColor=vt?.barrierCol||"#aa00ff";ctx.shadowBlur=8;
            ctx.strokeRect(px+1,py+1,T-2,T-2);ctx.shadowBlur=0;
          } else if(mm.mapType==="Practice"){
            ctx.fillStyle="#010c04";ctx.fillRect(px,py,T,T);
            ctx.strokeStyle=PRACTICE_BARRIER_COL;ctx.lineWidth=1.2;
            ctx.shadowColor=PRACTICE_BARRIER_COL;ctx.shadowBlur=8;
            ctx.strokeRect(px+1,py+1,T-2,T-2);ctx.shadowBlur=0;
          } else {
            const th=mm.theme!;
            ctx.fillStyle=th.wall;ctx.fillRect(px,py,T,T);
            ctx.strokeStyle=th.wallStroke;ctx.lineWidth=1.2;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
          }
        }
      }
      ctx.restore();
      ctx.fillStyle=`rgba(0,0,0,${lerp(1,0.72,et)})`;ctx.fillRect(0,0,W,H);
    };

    const drawMenuSnake=(W: number,H: number,ts: number):void=>{
      const skin=SKINS[stRef.current.skin]||SKINS.Mono;
      const sm=stRef.current.speed==="Fast"?2.0:stRef.current.speed==="Slow"?0.45:1;
      const N=42,SP=65;
      const pos=(t: number)=>{const tt=t*0.00048*sm;const d=1+Math.sin(tt)*Math.sin(tt);return{x:W/2+W*0.40*Math.cos(tt)/d,y:H/2+H*0.24*Math.sin(tt)*Math.cos(tt)/d};};
      const pts=Array.from({length:N},(_,i)=>pos(ts-i*SP));
      const lw=T*0.55;
      // Build menu snake path ONCE — reused for all stroke passes
      ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
      ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<N-1;i++){const mx=(pts[i].x+pts[i+1].x)/2,my=(pts[i].y+pts[i+1].y)/2;ctx.quadraticCurveTo(pts[i].x,pts[i].y,mx,my);}
      ctx.lineTo(pts[N-1].x,pts[N-1].y);
      // Glow
      ctx.lineWidth=lw+18;ctx.strokeStyle=skin.glow;ctx.globalAlpha=0.05;ctx.stroke();
      ctx.lineWidth=lw+8;ctx.globalAlpha=0.10;ctx.stroke();ctx.globalAlpha=1;
      // Drop shadow
      ctx.shadowColor="rgba(0,0,0,0.5)";ctx.shadowBlur=10;ctx.shadowOffsetY=5;
      ctx.lineWidth=lw;ctx.strokeStyle="rgba(0,0,0,0.01)";ctx.globalAlpha=0.5;ctx.stroke();
      ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      // Dark edge ring
      ctx.lineWidth=lw+4;ctx.strokeStyle="rgba(0,0,0,0.5)";ctx.globalAlpha=0.40;ctx.stroke();
      // Main body gradient
      const gr=ctx.createLinearGradient(pts[N-1].x,pts[N-1].y,pts[0].x,pts[0].y);
      gr.addColorStop(0,skin.a);gr.addColorStop(1,skin.b);
      ctx.lineWidth=lw;ctx.strokeStyle=gr;ctx.globalAlpha=0.55;ctx.stroke();
      // Cylinder highlight (before tabs — path still valid)
      ctx.lineWidth=lw*0.45;ctx.strokeStyle=lerpHex(skin.a,"#ffffff",0.28);ctx.globalAlpha=0.22;ctx.stroke();
      ctx.globalAlpha=1;
      // Body tabs — alternating chevrons matching body gradient
      {const thw=lw*0.23,oY=lw*0.48,iY=lw*0.09;
      ctx.save();
      for(let i=2;i<N-1;i++){
        const dx=pts[i].x-pts[i-1].x,dy=pts[i].y-pts[i-1].y;
        const len=Math.sqrt(dx*dx+dy*dy);if(len<2)continue;
        const cs=dx/len,sn=dy/len;
        const mx=(pts[i-1].x+pts[i].x)*0.5,my=(pts[i-1].y+pts[i].y)*0.5;
        const tf=clamp(i/Math.max(N-1,1),0,1);
        const tabCol=lerpHex(lerpHex(skin.b,skin.a,tf),"#000000",0.36);
        const so=(i%2===0)?oY:-oY;
        const si2=(i%2===0)?iY:-iY;
        ctx.fillStyle=tabCol;ctx.globalAlpha=0.48;
        ctx.beginPath();
        ctx.moveTo(mx-thw*cs-so*sn, my-thw*sn+so*cs);
        ctx.lineTo(mx-si2*sn,        my+si2*cs);
        ctx.lineTo(mx+thw*cs-so*sn, my+thw*sn+so*cs);
        ctx.closePath();ctx.fill();
      }
      ctx.restore();}
      ctx.globalAlpha=1;ctx.restore();
      // Head
      const hp=pts[0],pp=pts[1];
      const angle=Math.atan2(hp.y-pp.y,hp.x-pp.x);
      const hw=T*0.88,rx=hw*0.62,ry=hw*0.44;
      const hcx=hp.x+Math.cos(angle)*rx*0.18,hcy=hp.y+Math.sin(angle)*rx*0.18;
      ctx.save();ctx.translate(hcx,hcy);ctx.rotate(angle);
      // Neck connector
      ctx.fillStyle=lerpHex(skin.head,skin.b,0.44);
      ctx.beginPath();ctx.ellipse(-rx*0.46,0,rx*0.56,Math.min(lw*0.52,ry),0,0,Math.PI*2);ctx.fill();
      // Drop shadow
      ctx.shadowColor="rgba(0,0,0,0.55)";ctx.shadowBlur=12;ctx.shadowOffsetX=2;ctx.shadowOffsetY=6;
      ctx.fillStyle="rgba(0,0,0,0.01)";ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();
      ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
      // Dark outline
      ctx.strokeStyle="rgba(0,0,0,0.40)";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();
      // Glow + fill
      ctx.shadowColor=skin.glow;ctx.shadowBlur=22;
      const hg=ctx.createRadialGradient(-rx*0.22,-ry*0.22,ry*0.06,0,0,rx*1.1);
      hg.addColorStop(0,lerpHex(skin.head,"#ffffff",0.50));hg.addColorStop(0.40,skin.head);hg.addColorStop(1,lerpHex(skin.head,skin.b,0.55));
      ctx.fillStyle=hg;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      // Cylinder highlight
      ctx.strokeStyle=lerpHex(skin.head,"#ffffff",0.55);ctx.lineWidth=ry*0.38;ctx.globalAlpha=0.42;
      ctx.beginPath();ctx.ellipse(0,0,rx*0.72,ry*0.45,0,Math.PI*0.88,Math.PI*2.12);ctx.stroke();ctx.globalAlpha=1;
      // Snout bump
      ctx.fillStyle=lerpHex(skin.head,skin.b,0.35);ctx.beginPath();ctx.ellipse(rx*0.72,0,rx*0.28,ry*0.52,0,0,Math.PI*2);ctx.fill();
      // Closed mouth
      ctx.lineCap="round";ctx.strokeStyle="rgba(0,0,0,0.48)";ctx.lineWidth=1.5;ctx.globalAlpha=0.58;
      ctx.beginPath();ctx.moveTo(rx*0.60,0);ctx.lineTo(rx*0.90,0);ctx.stroke();ctx.globalAlpha=1;
      // Nostrils
      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.beginPath();ctx.ellipse(rx*0.80,-ry*0.28,rx*0.055,ry*0.10,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(rx*0.80, ry*0.28,rx*0.055,ry*0.10,0,0,Math.PI*2);ctx.fill();
      // Eyes
      const ex=rx*0.28,ey=ry*0.72,er=ry*0.28;
      ctx.fillStyle="#040c1e";ctx.beginPath();ctx.arc(ex,-ey,er,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(ex,ey,er,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=skin.glow;ctx.globalAlpha=0.90;
      ctx.beginPath();ctx.arc(ex-er*0.25,-ey-er*0.25,er*0.42,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(ex-er*0.25,ey-er*0.25,er*0.42,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.restore();
    };

    const drawStars=(W: number,H: number,ts: number):void=>{
      const sm=stRef.current.speed==="Fast"?2.2:stRef.current.speed==="Slow"?0.45:1;
      // Batch stars into 6 opacity tiers — cuts state changes from 90→6
      ctx.save();
      for(let tier=0;tier<6;tier++){
        const minA=tier/6,maxA=(tier+1)/6;
        ctx.beginPath();
        for(let i=0;i<90;i++){
          const a=Math.pow(Math.max(0,Math.sin(ts*0.0045*sm+i*2.1)),5)*0.95+0.02;
          if(a<minA||a>=maxA)continue;
          const x=((i*7919+ts*0.016*(i%8+0.4)*sm)%W+W)%W;
          const y=(i*5231+i*2.3)%H;
          const r=(i%4+1)*0.5;
          ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2);
        }
        ctx.globalAlpha=(minA+maxA)/2;
        ctx.fillStyle=`rgba(140,180,255,1)`;
        ctx.fill();
      }
      ctx.globalAlpha=1;ctx.restore();
    };

    const renderWorld=(g: GameState,alpha: number,ts: number):void=>{
      const{camX,camY}=g;
      const W=canvas.width,H=canvas.height;
      ctx.save();ctx.translate(-camX,-camY);
      const tx0=Math.max(0,(camX/T|0)-1);
      const ty0=Math.max(0,(camY/T|0)-1);
      const tx1=Math.min(g.wt-1,tx0+(W/T|0)+3);
      const ty1=Math.min(g.wt-1,ty0+(H/T|0)+3);
      // Tiles — batched by pass to minimise fillStyle/strokeStyle state changes
      const e=4;
      if(g.mapType==="Practice"){
        // Pass 1: floor base
        ctx.fillStyle="#0d1f0d";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(g.tiles[ty*g.wt+tx])ctx.fillRect(tx*T,ty*T,T,T);
        }
        // Pass 2: floor top+left shadow
        ctx.fillStyle="rgba(0,0,0,0.30)";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])continue;
          const px=tx*T,py=ty*T;ctx.fillRect(px,py,T,e);ctx.fillRect(px,py,e,T);
        }
        // Pass 3: floor bottom+right highlight
        ctx.fillStyle="rgba(0,255,80,0.04)";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])continue;
          const px=tx*T,py=ty*T;ctx.fillRect(px,py+T-e,T,e);ctx.fillRect(px+T-e,py,e,T);
        }
        // Pass 4: floor grid
        ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(g.tiles[ty*g.wt+tx])ctx.rect(tx*T+.5,ty*T+.5,T-1,T-1);
        }
        ctx.strokeStyle="rgba(0,255,80,0.10)";ctx.lineWidth=0.6;ctx.stroke();
        // Pass 5: walls
        ctx.fillStyle="#010c04";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.fillRect(tx*T,ty*T,T,T);
        }
        // Pass 6: wall glow outline
        ctx.strokeStyle=PRACTICE_BARRIER_COL;ctx.lineWidth=1.5;ctx.shadowColor=PRACTICE_BARRIER_COL;ctx.shadowBlur=10;
        ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.rect(tx*T+1,ty*T+1,T-2,T-2);
        }
        ctx.stroke();ctx.shadowBlur=0;
      } else if(g.mapType==="Void"){
        ctx.fillStyle=g.voidTheme!.bg;
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.fillRect(tx*T,ty*T,T,T);
        }
        ctx.strokeStyle=g.voidTheme!.barrierCol;ctx.lineWidth=1.5;ctx.shadowColor=g.voidTheme!.barrierCol;ctx.shadowBlur=12;
        ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.rect(tx*T+1,ty*T+1,T-2,T-2);
        }
        ctx.stroke();ctx.shadowBlur=0;
      } else if(g.mapType==="Forest"){
        // Batched multi-pass rendering — one state change per pass instead of ~10 per tile
        const ft=g.forestTheme!;
        // Pass 1: floor base
        ctx.fillStyle=ft.floor;
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(g.tiles[ty*g.wt+tx])ctx.fillRect(tx*T,ty*T,T,T);
        }
        // Pass 2: floor top+left shadow
        ctx.fillStyle="rgba(0,0,0,0.28)";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])continue;
          const px=tx*T,py=ty*T;ctx.fillRect(px,py,T,e);ctx.fillRect(px,py,e,T);
        }
        // Pass 3: floor bottom+right highlight
        ctx.fillStyle="rgba(255,255,255,0.04)";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])continue;
          const px=tx*T,py=ty*T;ctx.fillRect(px,py+T-e,T,e);ctx.fillRect(px+T-e,py,e,T);
        }
        // Pass 4: floor grid (batched path)
        ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(g.tiles[ty*g.wt+tx])ctx.rect(tx*T+.5,ty*T+.5,T-1,T-1);
        }
        ctx.strokeStyle=ft.grid;ctx.lineWidth=0.8;ctx.stroke();
        // Pass 5: tree ground
        ctx.fillStyle=ft.treeGround;
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.fillRect(tx*T,ty*T,T,T);
        }
        // Pass 6: trunks
        ctx.fillStyle=ft.trunk;
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.fillRect((tx*T+(T*0.38))|0,(ty*T+(T*0.62))|0,(T*0.24)|0,(T*0.38)|0);
        }
        // Pass 7: canopy1 — shadow set once, all arcs in one path
        ctx.shadowColor="rgba(0,0,0,0.55)";ctx.shadowBlur=8;ctx.shadowOffsetY=4;
        ctx.fillStyle=ft.canopy1;ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx]){const px=tx*T,py=ty*T;ctx.moveTo(px+T*0.93,py+T*0.38);ctx.arc(px+T*0.50,py+T*0.38,T*0.43,0,Math.PI*2);}
        }
        ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.shadowColor="transparent";
        // Pass 8: canopy2
        ctx.fillStyle=ft.canopy2;ctx.globalAlpha=0.80;ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx]){const px=tx*T,py=ty*T;ctx.moveTo(px+T*0.83,py+T*0.34);ctx.arc(px+T*0.50,py+T*0.34,T*0.33,0,Math.PI*2);}
        }
        ctx.fill();
        // Pass 9: canopy3
        ctx.fillStyle=ft.canopy3;ctx.globalAlpha=0.55;ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx]){const px=tx*T,py=ty*T;ctx.moveTo(px+T*0.54,py+T*0.24);ctx.arc(px+T*0.38,py+T*0.24,T*0.16,0,Math.PI*2);}
        }
        ctx.fill();ctx.globalAlpha=1;
      } else {
        // Maze — batched by draw type: one state change per pass instead of per tile
        const th=g.theme;
        // Pass 1: floor base
        ctx.fillStyle=th.floor;
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(g.tiles[ty*g.wt+tx])ctx.fillRect(tx*T,ty*T,T,T);
        }
        // Pass 2: floor top+left shadow
        ctx.fillStyle="rgba(0,0,0,0.32)";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])continue;
          const px=tx*T,py=ty*T;ctx.fillRect(px,py,T,e);ctx.fillRect(px,py,e,T);
        }
        // Pass 3: floor bottom+right highlight
        ctx.fillStyle="rgba(255,255,255,0.06)";
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])continue;
          const px=tx*T,py=ty*T;ctx.fillRect(px,py+T-e,T,e);ctx.fillRect(px+T-e,py,e,T);
        }
        // Pass 4: floor grid (single batched path)
        ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(g.tiles[ty*g.wt+tx])ctx.rect(tx*T+.5,ty*T+.5,T-1,T-1);
        }
        ctx.strokeStyle=th.grid;ctx.lineWidth=0.8;ctx.stroke();
        // Pass 5: wall base
        ctx.fillStyle=th.wall;
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.fillRect(tx*T,ty*T,T,T);
        }
        // Pass 6: wall outlines (single batched path)
        ctx.beginPath();
        for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
          if(!g.tiles[ty*g.wt+tx])ctx.rect(tx*T+.5,ty*T+.5,T-1,T-1);
        }
        ctx.strokeStyle=th.wallStroke;ctx.lineWidth=1.2;ctx.stroke();
      }
      // Void stars — batched by opacity tier to reduce state changes
      if(g.mapType==="Void"&&g.voidTheme){
        const vt=g.voidTheme;
        ctx.save();ctx.fillStyle=vt.shipGlow;
        // Draw in 4 opacity tiers to limit state changes (was 140 individual fillStyle changes)
        for(let tier=0;tier<4;tier++){
          ctx.globalAlpha=0.12+tier*0.10;
          ctx.beginPath();
          for(let i=tier;i<140;i+=4){
            const stx=((i*6271+i*31)%(g.wt-2)+1)*T+(i*13%T);
            const sty=((i*5231+i*19)%(g.wt-2)+1)*T+(i*17%T);
            if(stx<(tx0-1)*T||stx>(tx1+2)*T||sty<(ty0-1)*T||sty>(ty1+2)*T)continue;
            const sr=0.5+(i%3)*0.5;
            ctx.moveTo(stx+sr,sty);ctx.arc(stx,sty,sr,0,Math.PI*2);
          }
          ctx.fill();
        }
        ctx.globalAlpha=1;ctx.restore();
      }
      // Shapes
      for(const sh of g.shapes){
        if(!sh.tileSet)sh.tileSet=new Set(sh.tiles.map(t=>`${t.x},${t.y}`));
        const sset=sh.tileSet;
        const pulse=0.12+0.08*Math.sin(ts*0.003);
        const [cr,cg,cb]=hRgb(sh.col||"#aa00ff");
        const ir=Math.min(255,cr+50),ig=Math.min(255,cg+60),ib=Math.min(255,cb+55);
        for(const{x,y}of sh.tiles){
          if(x<tx0-1||x>tx1+1||y<ty0-1||y>ty1+1)continue;
          ctx.fillStyle=`rgba(${cr},${cg},${cb},${0.13+pulse})`;ctx.fillRect(x*T,y*T,T,T);
          ctx.fillStyle=`rgba(${ir},${ig},${ib},${0.05+pulse*0.4})`;ctx.fillRect(x*T+5,y*T+5,T-10,T-10);
        }
        // Batch all edges of this shape into one path → one stroke call
        ctx.save();ctx.strokeStyle=`rgba(${ir},${ig},${ib},0.90)`;
        ctx.lineWidth=2;ctx.shadowColor=sh.col||"#cc00ff";ctx.shadowBlur=14;
        ctx.beginPath();
        for(const{x,y}of sh.tiles){
          if(x<tx0-1||x>tx1+1||y<ty0-1||y>ty1+1)continue;
          for(const[ddx,ddy,dax,day,dbx,dby]of SHAPE_EDGE_DIRS){
            if(!sset.has(`${x+ddx},${y+ddy}`)){ctx.moveTo((x+dax)*T,(y+day)*T);ctx.lineTo((x+dbx)*T,(y+dby)*T);}
          }
        }
        ctx.stroke();
        ctx.restore();
      }
      // Pending fill flash — tiles light up before being removed
      if(g.pendingFill){
        const{tiles,timer,dur,col:pfCol}=g.pendingFill;
        const prog=1-timer/dur;
        const flash=0.5+0.5*Math.sin(prog*Math.PI*10); // rapid flicker
        const [fr,fg2,fb]=hRgb(pfCol||"#ff88ff");
        ctx.save();
        ctx.shadowColor=pfCol||"#ff88ff";ctx.shadowBlur=28;
        ctx.fillStyle=`rgba(${fr},${fg2},${fb},${0.30+flash*0.55})`;
        for(const{x,y}of tiles){
          if(x<tx0-1||x>tx1+1||y<ty0-1||y>ty1+1)continue;
          ctx.fillRect(x*T,y*T,T,T);
        }
        ctx.strokeStyle=`rgba(${Math.min(255,fr+30)},${Math.min(255,fg2+30)},${Math.min(255,fb+30)},${0.70+flash*0.30})`;
        ctx.lineWidth=3;
        for(const{x,y}of tiles){
          if(x<tx0-1||x>tx1+1||y<ty0-1||y>ty1+1)continue;
          ctx.strokeRect(x*T+1.5,y*T+1.5,T-3,T-3);
        }
        ctx.restore();
      }
      // Fruits — single save/restore for the whole batch; fast path for t=0 (most common)
      ctx.save();
      ctx.textAlign="center";ctx.textBaseline="middle";
      for(const f of g.fruits){
        const{x,y}=f;
        if(x<tx0||x>tx1||y<ty0||y>ty1)continue;
        const cx2=x*T+T/2,cy2=y*T+T/2;
        if(f.pw){
          // ── Powerup fruit ─────────────────────────────────────────────────
          const def=POWERUP_DEFS.find(p=>p.id===f.pw);
          if(def){
            const spin=ts*0.0022;
            const pulse=0.88+0.12*Math.sin(ts*0.006+x*1.1);
            const r=T*0.40*pulse;
            ctx.strokeStyle=def.col;ctx.lineWidth=2.5;
            ctx.globalAlpha=0.70+0.22*Math.sin(ts*0.007);
            ctx.shadowColor=def.glow;ctx.shadowBlur=20;
            ctx.beginPath();ctx.arc(cx2,cy2,r*1.58,spin,spin+Math.PI*1.55);ctx.stroke();
            ctx.beginPath();ctx.arc(cx2,cy2,r*1.58,spin+Math.PI,spin+Math.PI*2.55);ctx.stroke();
            ctx.globalAlpha=0.90;ctx.shadowBlur=0;
            const gpw=ctx.createRadialGradient(cx2-3,cy2-3,1,cx2,cy2,r);
            gpw.addColorStop(0,"#ffffff");gpw.addColorStop(0.35,def.col);gpw.addColorStop(1,def.glow);
            ctx.fillStyle=gpw;ctx.beginPath();ctx.arc(cx2,cy2,r,0,Math.PI*2);ctx.fill();
            ctx.globalAlpha=0.45;ctx.fillStyle="#fff";
            ctx.beginPath();ctx.arc(cx2-r*0.28,cy2-r*0.32,r*0.30,0,Math.PI*2);ctx.fill();
            ctx.globalAlpha=1;ctx.font=`${(r*0.95)|0}px serif`;
            ctx.shadowColor=def.glow;ctx.shadowBlur=10;
            ctx.fillText(def.icon,cx2,cy2+r*0.04);
            ctx.shadowBlur=0;ctx.globalAlpha=1;
          }
        } else if(f.t===0){
          // ── Common fruit — fast flat render (no gradient, no shadow) ──────
          const ft=FRUIT_TYPES[0];
          const r=T*ft.r*(0.92+0.08*Math.sin(ts*0.005+x*0.7));
          ctx.fillStyle=ft.c1;
          ctx.beginPath();ctx.arc(cx2,cy2,r,0,Math.PI*2);ctx.fill();
          ctx.globalAlpha=0.30;ctx.fillStyle="#fff";
          ctx.beginPath();ctx.arc(cx2-r*0.3,cy2-r*0.35,r*0.28,0,Math.PI*2);ctx.fill();
          ctx.globalAlpha=1;
        } else {
          // ── Uncommon / rare / epic fruit ──────────────────────────────────
          const ft=FRUIT_TYPES[f.t];
          const pulse=0.92+0.08*Math.sin(ts*0.005+x*0.7);
          const r=T*ft.r*pulse;
          ctx.shadowColor=ft.glow;ctx.shadowBlur=14+f.t*8;
          const grd=ctx.createRadialGradient(cx2-2,cy2-2,1,cx2,cy2,r);
          grd.addColorStop(0,ft.c0);grd.addColorStop(0.55,ft.c1);grd.addColorStop(1,ft.c2);
          ctx.fillStyle=grd;ctx.beginPath();ctx.arc(cx2,cy2,r,0,Math.PI*2);ctx.fill();
          ctx.shadowBlur=0;ctx.globalAlpha=0.38;ctx.fillStyle="#fff";
          ctx.beginPath();ctx.arc(cx2-r*0.3,cy2-r*0.35,r*0.32,0,Math.PI*2);ctx.fill();
          if(f.t>=2){
            const ringA=0.35+0.25*Math.sin(ts*0.004+x);
            ctx.globalAlpha=ringA;ctx.strokeStyle=ft.glow;
            ctx.lineWidth=f.t>=3?2.5:1.5;ctx.shadowColor=ft.glow;ctx.shadowBlur=10;
            ctx.beginPath();ctx.arc(cx2,cy2,r*(f.t>=3?1.55:1.40),0,Math.PI*2);ctx.stroke();
          }
          ctx.globalAlpha=0.85;ctx.shadowBlur=0;ctx.fillStyle="#fff";
          ctx.font=`bold ${8+f.t*2}px "Courier New"`;
          ctx.fillText(`+${ft.grow}`,cx2,cy2+r+8+f.t);
          ctx.globalAlpha=1;ctx.shadowBlur=0;
        }
      }
      ctx.restore();
      drawSnake(g,alpha,ts);
      // ── World-space burst particles ────────────────────────────────────────
      if(particlesRef.current.length>0){
        ctx.save();
        for(const p of particlesRef.current){
          const al=Math.max(0,Math.min(p.life,1))*0.92;
          if(al<0.02)continue;
          ctx.globalAlpha=al;ctx.fillStyle=p.color;
          // Direct coords — no save/restore/translate per particle
          ctx.fillRect(p.wx-p.size*0.5,p.wy-p.size*0.35,p.size,p.size*0.7);
        }
        ctx.globalAlpha=1;ctx.restore();
      }
      // ── Spaceships ────────────────────────────────────────────────────────────
      if(g.ships.length>0&&g.voidTheme){
        const vt=g.voidTheme;
        for(const ship of g.ships){
          const{x:sx2,y:sy2,r,type,angle}=ship;
          const throb=0.55+0.45*Math.sin(ts*0.008+sx2*0.01);
          ctx.save();ctx.translate(sx2,sy2);ctx.rotate(angle);
          // Engine glow
          ctx.globalAlpha=throb*0.88;
          ctx.shadowColor=vt.engineCol;ctx.shadowBlur=r*0.9;
          ctx.fillStyle=vt.engineCol;
          if(type===0){
            ctx.beginPath();ctx.ellipse(-r*0.55,0,r*0.42,r*0.20,0,0,Math.PI*2);ctx.fill();
          } else if(type===1){
            ctx.beginPath();ctx.ellipse(-r*0.58,-r*0.22,r*0.36,r*0.15,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(-r*0.58, r*0.22,r*0.36,r*0.15,0,0,Math.PI*2);ctx.fill();
          } else if(type===2){
            ctx.beginPath();ctx.ellipse(-r*0.62,-r*0.28,r*0.38,r*0.16,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(-r*0.62, 0,      r*0.38,r*0.16,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(-r*0.62, r*0.28,r*0.38,r*0.16,0,0,Math.PI*2);ctx.fill();
          } else {
            // Dreadnought — 4 massive engine exhausts in a wide bank
            for(const oy of [-r*0.42,-r*0.14,r*0.14,r*0.42]){
              ctx.beginPath();ctx.ellipse(-r*0.65,oy,r*0.46,r*0.18,0,0,Math.PI*2);ctx.fill();
            }
          }
          ctx.globalAlpha=1;
          // Hull
          ctx.shadowColor=vt.shipGlow;ctx.shadowBlur=r*0.55;
          ctx.fillStyle=vt.shipCol;
          ctx.beginPath();
          if(type===0){
            ctx.moveTo(r,0);ctx.lineTo(-r*0.42,-r*0.50);ctx.lineTo(-r*0.18,0);ctx.lineTo(-r*0.42,r*0.50);
          } else if(type===1){
            ctx.moveTo(r*0.85,0);ctx.lineTo(r*0.18,-r*0.24);
            ctx.lineTo(-r*0.50,-r*0.58);ctx.lineTo(-r*0.70,-r*0.58);
            ctx.lineTo(-r*0.50,-r*0.20);ctx.lineTo(-r*0.50, r*0.20);
            ctx.lineTo(-r*0.70, r*0.58);ctx.lineTo(-r*0.50, r*0.58);ctx.lineTo(r*0.18, r*0.24);
          } else if(type===2){
            ctx.moveTo(r,0);ctx.lineTo(r*0.44,-r*0.55);
            ctx.lineTo(-r*0.46,-r*0.65);ctx.lineTo(-r*0.80,-r*0.38);
            ctx.lineTo(-r*0.80, r*0.38);ctx.lineTo(-r*0.46, r*0.65);ctx.lineTo(r*0.44, r*0.55);
          } else {
            // Dreadnought: thick slab hull with pronounced front spike and wide swept wings
            ctx.moveTo(r*1.0,0);
            ctx.lineTo(r*0.60,-r*0.22);
            ctx.lineTo(r*0.30,-r*0.55);
            ctx.lineTo(-r*0.20,-r*0.90);
            ctx.lineTo(-r*0.55,-r*0.90);
            ctx.lineTo(-r*0.80,-r*0.52);
            ctx.lineTo(-r*0.90,-r*0.52);ctx.lineTo(-r*0.90, r*0.52);
            ctx.lineTo(-r*0.80, r*0.52);
            ctx.lineTo(-r*0.55, r*0.90);
            ctx.lineTo(-r*0.20, r*0.90);
            ctx.lineTo(r*0.30, r*0.55);
            ctx.lineTo(r*0.60, r*0.22);
          }
          ctx.closePath();ctx.fill();
          // Cockpit highlight
          ctx.shadowBlur=0;ctx.fillStyle="#ffffff";ctx.globalAlpha=0.26;
          ctx.beginPath();ctx.ellipse(type<=1?r*0.14:r*0.08,0,r*0.20,r*0.10,0,0,Math.PI*2);ctx.fill();
          // Secondary cockpit ridge on dreadnought
          if(type===3){
            ctx.globalAlpha=0.14;
            ctx.beginPath();ctx.ellipse(r*0.20,0,r*0.50,r*0.24,0,0,Math.PI*2);ctx.fill();
          }
          // Dark outline
          ctx.globalAlpha=1;ctx.strokeStyle="rgba(0,0,0,0.35)";ctx.lineWidth=type===3?1.5:1;
          ctx.beginPath();
          if(type===0){ctx.moveTo(r,0);ctx.lineTo(-r*0.42,-r*0.50);ctx.lineTo(-r*0.18,0);ctx.lineTo(-r*0.42,r*0.50);}
          else if(type===1){ctx.moveTo(r*0.85,0);ctx.lineTo(r*0.18,-r*0.24);ctx.lineTo(-r*0.50,-r*0.58);ctx.lineTo(-r*0.70,-r*0.58);ctx.lineTo(-r*0.50,-r*0.20);ctx.lineTo(-r*0.50,r*0.20);ctx.lineTo(-r*0.70,r*0.58);ctx.lineTo(-r*0.50,r*0.58);ctx.lineTo(r*0.18,r*0.24);}
          else if(type===2){ctx.moveTo(r,0);ctx.lineTo(r*0.44,-r*0.55);ctx.lineTo(-r*0.46,-r*0.65);ctx.lineTo(-r*0.80,-r*0.38);ctx.lineTo(-r*0.80,r*0.38);ctx.lineTo(-r*0.46,r*0.65);ctx.lineTo(r*0.44,r*0.55);}
          else{ctx.moveTo(r*1.0,0);ctx.lineTo(r*0.60,-r*0.22);ctx.lineTo(r*0.30,-r*0.55);ctx.lineTo(-r*0.20,-r*0.90);ctx.lineTo(-r*0.55,-r*0.90);ctx.lineTo(-r*0.80,-r*0.52);ctx.lineTo(-r*0.90,-r*0.52);ctx.lineTo(-r*0.90,r*0.52);ctx.lineTo(-r*0.80,r*0.52);ctx.lineTo(-r*0.55,r*0.90);ctx.lineTo(-r*0.20,r*0.90);ctx.lineTo(r*0.30,r*0.55);ctx.lineTo(r*0.60,r*0.22);}
          ctx.closePath();ctx.stroke();
          ctx.restore();
        }
      }
      // ── Powerup arrow: faint arrow near head pointing to nearest powerup fruit ─
      const pwFruits=g.fruits.filter(f=>!!f.pw);
      if(pwFruits.length>0&&g.snake.length>0){
        const p0=g.prevSnake[0]||g.snake[0],s0=g.snake[0];
        const hx=lerp(p0.x,s0.x,alpha)*T+T/2;
        const hy=lerp(p0.y,s0.y,alpha)*T+T/2;
        // Find nearest powerup fruit
        let nearest=pwFruits[0],nd2=Infinity;
        for(const f of pwFruits){
          const dx=f.x*T+T/2-hx,dy=f.y*T+T/2-hy;
          const d2=dx*dx+dy*dy;if(d2<nd2){nd2=d2;nearest=f;}
        }
        const fdx=nearest.x*T+T/2-hx,fdy=nearest.y*T+T/2-hy;
        const fLen=Math.sqrt(fdx*fdx+fdy*fdy);
        if(fLen>T*1.8){
          const ang=Math.atan2(fdy,fdx);
          const arrowR=T*1.10; // distance from head center to arrow
          const ax=hx+Math.cos(ang)*arrowR,ay=hy+Math.sin(ang)*arrowR;
          const def=POWERUP_DEFS.find(p=>p.id===nearest.pw)||POWERUP_DEFS[0];
          const pulse=0.55+0.25*Math.sin(ts*0.005);
          ctx.save();
          ctx.translate(ax,ay);ctx.rotate(ang);
          // Glow pass
          ctx.globalAlpha=pulse*0.40;
          ctx.strokeStyle=def.glow;ctx.lineWidth=7;ctx.lineCap="round";
          ctx.shadowColor=def.glow;ctx.shadowBlur=12;
          const al=T*0.46;
          ctx.beginPath();ctx.moveTo(-al*0.5,0);ctx.lineTo(al*0.46,0);ctx.stroke();
          ctx.beginPath();ctx.moveTo(al*0.46,0);ctx.lineTo(al*0.08,-al*0.34);ctx.stroke();
          ctx.beginPath();ctx.moveTo(al*0.46,0);ctx.lineTo(al*0.08, al*0.34);ctx.stroke();
          // Sharp arrow
          ctx.globalAlpha=pulse;ctx.shadowBlur=6;
          ctx.strokeStyle=def.col;ctx.lineWidth=2.5;
          ctx.beginPath();ctx.moveTo(-al*0.5,0);ctx.lineTo(al*0.46,0);ctx.stroke();
          ctx.beginPath();ctx.moveTo(al*0.46,0);ctx.lineTo(al*0.08,-al*0.34);ctx.stroke();
          ctx.beginPath();ctx.moveTo(al*0.46,0);ctx.lineTo(al*0.08, al*0.34);ctx.stroke();
          ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.restore();
        }
      }
      ctx.restore();
    };

    const loop=(ts: number):void=>{
      raf=requestAnimationFrame(loop);
      const dt=Math.min(ts-last,100);last=ts;
      const W=canvas.width,H=canvas.height;
      const scr=srRef.current,g=gRef.current;

      // Background — must cover all map types and the menu screen
      let bgColor:string;
      if(scr==="menu"){
        const m=stRef.current.map,b=stRef.current.bg;
        if(m==="Forest")bgColor=(FOREST_THEMES[b]||FOREST_THEMES.Pine).bg;
        else if(m==="Void")bgColor=(VOID_THEMES[b]||VOID_THEMES.Nebula).bg;
        else if(m==="Practice")bgColor="#010c04";
        else bgColor=(THEMES[b]||THEMES["Mono"]).bg;
      } else if(g){
        if(g.mapType==="Forest")bgColor=g.forestTheme?.bg||"#030d02";
        else if(g.mapType==="Void")bgColor=g.voidTheme?.bg||"#06001a";
        else if(g.mapType==="Practice")bgColor="#010c04";
        else bgColor=g.theme.bg;
      } else {
        bgColor="#050810";
      }
      ctx.fillStyle=bgColor;
      ctx.fillRect(0,0,W,H);

      if(scr==="menu"){
        if(menuPageRef.current==="maps"){renderMenuMap(W,H,ts,dt);}
        else{drawMenuSnake(W,H,ts);drawStars(W,H,ts);}
        return;
      }
      if(!g)return;

      // ── Update ────────────────────────────────────────────────────────────
      if(scr==="playing"){
        if(g.fillAnim){g.fillAnim.timer-=dt;if(g.fillAnim.timer<=0)g.fillAnim=null;}
        if(g.pendingFill){
          g.pendingFill.timer-=dt;
          if(g.pendingFill.timer<=0){
            const{rem,prevByCoord,bonus,cx,cy}=g.pendingFill;
            const originalSnake=[...g.snake]; // full snapshot before removal
            g.snake=g.snake.filter(s=>!rem.has(`${s.x},${s.y}`));
            g.prevSnake=g.snake.map(s=>prevByCoord.get(`${s.x},${s.y}`)||s);
            // Find gap: first pair of consecutive segments more than 1 tile apart
            let gapIdx=-1;
            for(let i=1;i<g.snake.length;i++){
              const dx=g.snake[i].x-g.snake[i-1].x,dy=g.snake[i].y-g.snake[i-1].y;
              if(Math.abs(dx)+Math.abs(dy)>1){gapIdx=i;break;}
            }
            if(gapIdx!==-1){
              // Find where the first back segment sits in originalSnake
              // to determine how many tiles were removed before the gap
              const backHead=g.snake[gapIdx];
              let origBackStart=gapIdx;
              for(let i=gapIdx;i<originalSnake.length;i++){
                if(originalSnake[i].x===backHead.x&&originalSnake[i].y===backHead.y){origBackStart=i;break;}
              }
              const N_removed=origBackStart-gapIdx; // tiles removed between front and back
              const M=g.snake.length-gapIdx;
              // Build per-segment waypoint paths: each segment j walks N_removed steps
              // forward through originalSnake positions, following the path the snake traveled
              const paths: SnakeSegment[][]=[];
              for(let j=0;j<M;j++){
                const path: SnakeSegment[]=[];
                for(let k=N_removed;k>=0;k--){
                  const oi=gapIdx+j+k;
                  if(oi<originalSnake.length)path.push({...originalSnake[oi]});
                }
                paths.push(path);
              }
              g.reconnect={timer:500,dur:500,gapIdx,M,paths};
            }
            g.shapes=g.shapes.filter(sh=>!sh.tiles.every(t=>rem.has(`${t.x},${t.y}`)));
            addScore(bonus,cx,cy,g);
            sndBlast();
            for(let b=0;b<8;b++)pops.current.push({wx:cx*T+T/2+(Math.random()-.5)*T*4,wy:cy*T+(Math.random()-.5)*T*3,text:"++",col:"#cc00ff",life:1.3});
            spawnParticles(cx*T+T/2,cy*T+T/2,44,"#cc44ff",260,6);
            spawnParticles(cx*T+T/2,cy*T+T/2,22,"#ffffff",200,4);
            spawnParticles(cx*T+T/2,cy*T+T/2,16,"#ffaaff",320,8);
            const sset=new Set(g.snake.map(s=>`${s.x},${s.y}`));
            const ns=shapeNear(g.tiles,g.camX,g.camY,W,H,g.shapes,sset,g.wt);
            if(ns)g.shapes.push(ns);
            g.pendingFill=null;
          }
        }
        if(g.reconnect){
          g.reconnect.timer-=dt;
          if(g.reconnect.timer<=0){
            // Write final connected positions into game state so movement resumes whole
            const{gapIdx,M,paths}=g.reconnect;
            for(let j=0;j<M;j++){
              const i=gapIdx+j;
              const target=paths[j]?.[paths[j].length-1];
              if(i<g.snake.length&&target){g.snake[i]={...target};g.prevSnake[i]={...target};}
            }
            g.moveT=0;
            g.reconnect=null;
          }
        }
        for(const b of g.bulges)b.t+=dt/700;g.bulges=g.bulges.filter(b=>b.t<1);
        for(const p of particlesRef.current){p.wx+=p.vx*dt/1000;p.wy+=p.vy*dt/1000;p.vy+=300*dt/1000;p.life-=dt/900;}
        particlesRef.current=particlesRef.current.filter(p=>p.life>0);
        if(particlesRef.current.length>350)particlesRef.current.length=350;
        if(g.combo>0){g.comboTimer-=dt;if(g.comboTimer<=0){g.combo=0;g.comboTimer=0;}}
        if(g.comboPop){g.comboPop.timer-=dt;if(g.comboPop.timer<=0)g.comboPop=null;}
        // Tick powerup timers and recompute tickDur
        for(const pw of g.powerups)pw.timer-=dt;
        g.powerups=g.powerups.filter(pw=>pw.timer>0);
        g.tickDur=g.powerups.some(p=>p.id==="rush")?g.baseTickDur*0.80
          :g.powerups.some(p=>p.id==="chill")?g.baseTickDur*1.20
          :g.baseTickDur;
        // Probabilistic powerup spawn: 10 s timer, chance based on tier
        if(g.fruits.every(f=>!f.pw)){
          g.powerupSpawnTimer+=dt;
          if(g.powerupSpawnTimer>=10000){
            g.powerupSpawnTimer=0;
            const chance=POWERUP_SPAWN_CHANCE[Math.min(g.tier,4)];
            if(Math.random()<chance){
              const excl2=new Set(g.fruits.map(f=>`${f.x},${f.y}`));
              g.snake.forEach(s=>excl2.add(`${s.x},${s.y}`));
              const nf=floorNear(g.tiles,g.camX,g.camY,W,H,excl2,g.wt,20);
              if(nf)g.fruits.push({...nf,t:0,pw:rndPowerup(g.tier)});
            }
          }
        } else {
          g.powerupSpawnTimer=0; // reset while one exists
        }
        // Ship movement (Void map) — bounce off walls, destroy on body contact
        if(g.ships.length>0){
          const bodyTiles=new Set<string>();
          for(let bi=1;bi<g.snake.length;bi++)bodyTiles.add(`${g.snake[bi].x},${g.snake[bi].y}`);
          const shipHitsBody=(sx2:number,sy2:number,r2:number):boolean=>{
            const bx0=Math.max(0,Math.floor((sx2-r2)/T));
            const bx1=Math.min(g.wt-1,Math.floor((sx2+r2)/T));
            const by0=Math.max(0,Math.floor((sy2-r2)/T));
            const by1=Math.min(g.wt-1,Math.floor((sy2+r2)/T));
            for(let ty2=by0;ty2<=by1;ty2++)for(let tx2=bx0;tx2<=bx1;tx2++){
              if(bodyTiles.has(`${tx2},${ty2}`))return true;
            }
            return false;
          };
          // Helper: spawn a replacement ship far from the snake head
          const vdR=VOID_DIFF_DEFS[stRef.current.maze]||VOID_DIFF_DEFS.Normal;
          const spawnReplacement=():Ship=>{
            const hx=(g.snake[0]?.x??0)*T+T/2,hy=(g.snake[0]?.y??0)*T+T/2;
            let spx=hx,spy=hy;
            for(let a=0;a<400;a++){
              const tx=2+((Math.random()*(g.wt-4))|0);
              const ty=2+((Math.random()*(g.wt-4))|0);
              const ddx=tx*T+T/2-hx,ddy=ty*T+T/2-hy;
              if(ddx*ddx+ddy*ddy>(T*16)*(T*16)){spx=tx*T+T/2;spy=ty*T+T/2;break;}
            }
            const rr=vdR.minR+Math.random()*(vdR.maxR-vdR.minR);
            const spd2=vdR.speed*(0.55+Math.random()*0.90);
            const ang=Math.random()*Math.PI*2;
            const type=rr<22?0:rr<36?1:rr<56?2:3;
            return{x:spx,y:spy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2,r:rr,type,angle:ang};
          };
          const destroyed:Ship[]=[];
          for(const ship of g.ships){
            const nx2=ship.x+ship.vx*dt/1000;
            const wHitX=nx2-ship.r<T||nx2+ship.r>(g.wt-1)*T;
            if(wHitX){ship.vx*=-1;}
            else if(shipHitsBody(nx2,ship.y,ship.r)){destroyed.push(ship);continue;}
            else{ship.x=nx2;}
            const ny2=ship.y+ship.vy*dt/1000;
            const wHitY=ny2-ship.r<T||ny2+ship.r>(g.wt-1)*T;
            if(wHitY){ship.vy*=-1;}
            else if(shipHitsBody(ship.x,ny2,ship.r)){destroyed.push(ship);continue;}
            else{ship.y=ny2;}
            ship.angle=Math.atan2(ship.vy,ship.vx);
          }
          if(destroyed.length>0){
            g.ships=g.ships.filter(s=>!destroyed.includes(s));
            for(const ship of destroyed){
              // Explosion burst — bigger ship = more particles
              const pCols=[["#ffaa00","#ff5500"],["#ff8800","#ffff44"],["#ff4400","#ffcc00"],["#ff2200","#ffffff"]];
              const pcArr=pCols[ship.type]||pCols[0];
              spawnParticles(ship.x,ship.y,10+ship.type*10,pcArr[0],150+ship.r*3,3+ship.type*1.2);
              spawnParticles(ship.x,ship.y,6+ship.type*4,pcArr[1],220+ship.r*2,2);
              spawnParticles(ship.x,ship.y,4,"#ffffff",300,1.5);
              // Drop fruit at nearest open tile — bigger ship = rarer fruit
              const fx=Math.max(1,Math.min(g.wt-2,(ship.x/T)|0));
              const fy=Math.max(1,Math.min(g.wt-2,(ship.y/T)|0));
              const fexcl=new Set(g.fruits.map(f=>`${f.x},${f.y}`));
              g.snake.forEach(s2=>fexcl.add(`${s2.x},${s2.y}`));
              outer: for(let dr=0;dr<=4;dr++){
                for(let dy2=-dr;dy2<=dr;dy2++)for(let dx2=-dr;dx2<=dr;dx2++){
                  if(Math.abs(dx2)!==dr&&Math.abs(dy2)!==dr)continue;
                  const tx2=fx+dx2,ty2=fy+dy2;
                  if(tx2<1||ty2<1||tx2>=g.wt-1||ty2>=g.wt-1)continue;
                  if(!g.tiles[ty2*g.wt+tx2]||fexcl.has(`${tx2},${ty2}`))continue;
                  if(ship.type===3&&Math.random()<0.20){
                    g.fruits.push({x:tx2,y:ty2,t:0,pw:rndPowerup(g.tier)});
                  } else {
                    g.fruits.push({x:tx2,y:ty2,t:Math.min(3,ship.type)});
                  }
                  break outer;
                }
              }
              // Spawn a fresh replacement far from the snake
              g.ships.push(spawnReplacement());
            }
          }
        }
        if(!g.waitInput&&!g.fillAnim&&!g.pendingFill&&!g.reconnect){
          g.moveT+=dt;
          while(g.moveT>=g.tickDur){
            g.moveT-=g.tickDur;tick(g,W,H);
            if(srRef.current!=="playing")break;
          }
        }
        for(const p of pops.current){p.wy-=55*dt/1000;p.life-=dt/1500;}
        pops.current=pops.current.filter(p=>p.life>0);
        for(const c of confettiRef.current){c.x+=c.vx*dt/1000;c.y+=c.vy*dt/1000;c.vy+=220*dt/1000;c.rot+=c.rotV*dt/1000;c.life-=dt/2500;}
        confettiRef.current=confettiRef.current.filter(c=>c.life>0);
      } else if(scr==="dying"){
        // Advance the movement animation so the fatal turn is visible
        g.moveT=Math.min(g.moveT+dt,g.tickDur);
        g.dyingTimer-=dt;
        for(const p of particlesRef.current){p.wx+=p.vx*dt/1000;p.wy+=p.vy*dt/1000;p.vy+=300*dt/1000;p.life-=dt/900;}
        particlesRef.current=particlesRef.current.filter(p=>p.life>0);
        if(g.dyingTimer<=0){die(g);return;}
      } else if(scr==="gameover"){
        if(newHSAnimRef.current)newHSAnimRef.current.anim=Math.min(1,newHSAnimRef.current.anim+dt/1200);
        for(const c of confettiRef.current){c.x+=c.vx*dt/1000;c.y+=c.vy*dt/1000;c.vy+=220*dt/1000;c.rot+=c.rotV*dt/1000;c.life-=dt/2500;}
        confettiRef.current=confettiRef.current.filter(c=>c.life>0);
      }
      // paused: freeze everything

      // ── Alpha ─────────────────────────────────────────────────────────────
      let alpha: number;
      if(scr==="playing")      alpha=g.waitInput?0:clamp(g.moveT/g.tickDur,0,1);
      else if(scr==="dying"){
        // Crash: ease into wall, then damped spring bounce — head never passes through
        const p=clamp(1-(g.dyingTimer/(g.dyingDur??1)),0,1);
        const IMPACT=0.14, HIT=0.24; // HIT = alpha at moment of contact
        if(p<IMPACT){
          const t=p/IMPACT;
          alpha=t*t*HIT;  // quadratic ease-in: accelerates into wall
        } else {
          const sp=(p-IMPACT)/(1-IMPACT);
          // Damped spring: starts at HIT, bounces back (goes slightly negative = recoil), settles ~0
          alpha=HIT*Math.exp(-sp*4.5)*Math.cos(sp*Math.PI*3.6);
        }
      }
      else if(scr==="gameover")alpha=0.04; // frozen just barely against the wall (settled spring position)
      else                      alpha=1;   // paused: frozen

      // ── Camera (only advance when playing or dying) ────────────────────────
      if(scr==="playing"||scr==="dying"){
        const p0=g.prevSnake[0]||g.snake[0],s0=g.snake[0];
        g.camX=lerp(p0.x,s0.x,alpha)*T+T/2-W/2;
        g.camY=lerp(p0.y,s0.y,alpha)*T+T/2-H/2;
        // Screen shake: camera recoils from impact then oscillates & settles
        if(scr==="dying"){
          const p=clamp(1-(g.dyingTimer/(g.dyingDur??1)),0,1);
          if(p>0.12){
            const sp=(p-0.12)/(1-0.12);
            // Primary recoil — strong push away from wall, decays quickly
            const shk=42*Math.exp(-sp*3.0)*Math.cos(sp*Math.PI*5.0);
            // Lateral wobble — small perpendicular jitter
            const shkP=14*Math.exp(-sp*5.0)*Math.cos(sp*Math.PI*3.0+0.9);
            g.camX-=g.dir.x*shk+(-g.dir.y)*shkP;
            g.camY-=g.dir.y*shk+g.dir.x*shkP;
          }
        }
      }

      // ── World ─────────────────────────────────────────────────────────────
      renderWorld(g,alpha,ts);

      // ── Combo screen edge glow (slow, subtle — scales with combo) ────────
      if((scr==="playing"||scr==="paused")&&g.combo>=4){
        const ci=Math.min((g.combo-3)/18,1);
        const pulse=0.5+0.5*Math.sin(ts*0.0028); // very slow breathe
        const ceg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.30,W/2,H/2,Math.sqrt(W*W+H*H)*0.62);
        ceg.addColorStop(0,'rgba(0,0,0,0)');
        ceg.addColorStop(0.70,'rgba(0,0,0,0)');
        ceg.addColorStop(1,`rgba(255,0,180,${ci*pulse*0.22})`);
        ctx.fillStyle=ceg;ctx.fillRect(0,0,W,H);
        // High combo: slightly brighter glow, still slow
        if(g.combo>=10){
          const hi=Math.min((g.combo-9)/16,1);
          const hpulse=0.5+0.5*Math.sin(ts*0.0022+1.0);
          ctx.fillStyle=`rgba(255,60,200,${hi*hpulse*0.08})`;ctx.fillRect(0,0,W,H);
        }
      }

      // ── Popups (screen-space, only during active play) ────────────────────
      if(scr==="playing"){
        const{camX,camY}=g;
        ctx.save();ctx.textAlign="center";
        for(const p of pops.current){
          const sx2=p.wx-camX,sy2=p.wy-camY;
          if(sy2<-60||sy2>H+60)continue;
          ctx.globalAlpha=Math.max(0,p.life);
          ctx.fillStyle=p.col;ctx.shadowColor=p.col;ctx.shadowBlur=10;
          ctx.font=`bold 13px "Courier New"`;ctx.fillText(p.text,sx2,sy2);
        }
        ctx.globalAlpha=1;ctx.restore();
      }

      // ── HUD ───────────────────────────────────────────────────────────────
      drawHUD(W,H,g);
      if(scr==="playing"||scr==="paused")drawComboPop(W,H,g);
      if(scr==="playing"&&g.waitInput)drawWait(W,H,ts);

      // ── Overlays ──────────────────────────────────────────────────────────
      if(scr==="dying"){
        const p=clamp(1-(g.dyingTimer/(g.dyingDur??1)),0,1);
        const isBody=g.deathCause==="body";
        const isShip=g.deathCause==="ship";
        // Stage 1: impact flash — wall=warm white/orange, body=icy green/white, ship=yellow/white
        const flashW=p<0.13?(p/0.13):Math.max(0,1-(p-0.13)/0.15);
        if(flashW>0.005){
          ctx.fillStyle=isShip?`rgba(255,255,200,${flashW*0.95})`:isBody?`rgba(200,255,200,${flashW*0.82})`:`rgba(255,220,160,${flashW*0.88})`;
          ctx.fillRect(0,0,W,H);
        }
        // Stage 2: bloom — wall=red, body=deep purple, ship=orange
        const flashR=p<0.16?(p/0.16)*0.92:lerp(0.92,0.06,(p-0.16)/0.84);
        ctx.fillStyle=isShip?`rgba(220,110,0,${flashR})`:isBody?`rgba(80,0,180,${flashR})`:`rgba(210,8,0,${flashR})`;
        ctx.fillRect(0,0,W,H);
        // Stage 3: dark closing vignette — builds from p=0.22
        if(p>0.22){
          const vigP=clamp((p-0.22)/0.78,0,1);
          const vigA=vigP*0.76;
          const grad=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.06,W/2,H/2,Math.sqrt(W*W+H*H)*0.62);
          grad.addColorStop(0,'rgba(0,0,0,0)');
          grad.addColorStop(0.6,isShip?`rgba(40,20,0,${vigA*0.4})`:isBody?`rgba(20,0,40,${vigA*0.4})`:`rgba(30,0,0,${vigA*0.4})`);
          grad.addColorStop(1,`rgba(0,0,0,${vigA})`);
          ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
        }
      }
      if(scr==="gameover"){
        ctx.fillStyle="rgba(60,0,0,0.82)";
        ctx.fillRect(0,0,W,H);
        drawGO(W,H,ts,newHSAnimRef.current);
      }
      if(scr==="paused"){
        ctx.fillStyle="rgba(2,4,14,0.78)";
        ctx.fillRect(0,0,W,H);
      }
      // Confetti — screen-space, always on top
      if(confettiRef.current.length>0){
        ctx.save();
        for(const c of confettiRef.current){
          ctx.globalAlpha=Math.max(0,Math.min(c.life,1))*0.94;
          ctx.fillStyle=c.color;
          ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rot);
          ctx.fillRect(-c.size*0.5,-c.size*0.3,c.size,c.size*0.6);
          ctx.restore();
        }
        ctx.globalAlpha=1;ctx.restore();
      }
    };

    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);

  // ── D-Pad ─────────────────────────────────────────────────────────────────
  const dpad=(dir: Direction):void=>{
    const g=gRef.current;if(!g||srRef.current!=="playing")return;
    const lastDir=g.dirQueue.length>0?g.dirQueue[g.dirQueue.length-1]:g.dir;
    if((lastDir.x!==0||lastDir.y!==0)&&dir.x===-lastDir.x&&dir.y===-lastDir.y)return;
    if(g.dirQueue.length<3){g.dirQueue.push(dir);}
    if(g.waitInput)g.waitInput=false;
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const hexRgb=(h: string): string=>{const s=h.replace("#","");const n=parseInt(s,16);return`${(n>>16)&255},${(n>>8)&255},${n&255}`;};

  // ── Shop helpers ───────────────────────────────────────────────────────────
  type ShopCat = "skin"|"mazetheme"|"map"|"foresttheme"|"mapsize"|"voidtheme";
  const isUnlocked=(cat: ShopCat,id: string):boolean=>{
    if(cat==="skin")return unlocks.skins.includes(id);
    if(cat==="mazetheme")return unlocks.mazethemes.includes(id);
    if(cat==="map")return unlocks.maps.includes(id);
    if(cat==="mapsize")return (unlocks.mapsizes||[]).includes(id);
    if(cat==="voidtheme")return (unlocks.voidthemes||[]).includes(id);
    return unlocks.forestthemes.includes(id);
  };
  const itemPrice=(cat: ShopCat,id: string):number=>{
    if(cat==="skin")return SKIN_PRICES[id]??9999;
    if(cat==="mazetheme")return MAZETHEME_PRICES[id]??9999;
    if(cat==="map")return MAP_PRICES[id]??9999;
    if(cat==="mapsize")return MAPSIZE_PRICES[id]??9999;
    if(cat==="voidtheme")return VOIDTHEME_PRICES[id]??9999;
    return FORESTTHEME_PRICES[id]??9999;
  };
  const buyItem=(cat: ShopCat,id: string):void=>{
    const price=itemPrice(cat,id);
    if(price===0||isUnlocked(cat,id)||coins<price)return;
    sndClick();
    const n=coins-price;
    localStorage.setItem("snakeBlastCoins",String(n));
    setCoins(n);
    setUnlocks(prev=>{
      const u={...prev};
      if(cat==="skin")u.skins=[...prev.skins,id];
      else if(cat==="mazetheme")u.mazethemes=[...prev.mazethemes,id];
      else if(cat==="map"){
        if(id==="Forest"){
          u.maps=[...prev.maps,id];
          if(!prev.forestthemes.includes("Pine"))
            u.forestthemes=[...prev.forestthemes,"Pine"];
        } else if(id==="Void"){
          u.maps=[...prev.maps,id];
          if(!(prev.voidthemes||[]).includes("Nebula"))u.voidthemes=[...(prev.voidthemes||[]),"Nebula"];
        } else {
          u.maps=[...prev.maps,id];
        }
      } else if(cat==="mapsize")u.mapsizes=[...(prev.mapsizes||[]),id];
      else if(cat==="voidtheme")u.voidthemes=[...(prev.voidthemes||[]),id];
      else u.forestthemes=[...prev.forestthemes,id];
      return u;
    });
  };
  const itemStatusLine=(cat: ShopCat,viewId: string,equippedId: string,accent: string,onEquip: ()=>void): JSX.Element=>{
    const owned=isUnlocked(cat,viewId);
    const price=itemPrice(cat,viewId);
    const rgb=hexRgb(accent);
    if(!owned){
      const can=coins>=price;
      return(
        <div style={{textAlign:"center",marginBottom:10}}>
          <div style={{fontSize:13,letterSpacing:2,color:"rgba(255,200,50,0.90)",marginBottom:7,
            fontFamily:"Courier New"}}>LOCKED - {price} coins</div>
          <button onClick={()=>buyItem(cat,viewId)}
            style={{background:can?"rgba(255,200,50,0.16)":"rgba(255,50,50,0.08)",
              border:`1px solid ${can?"rgba(255,200,50,0.55)":"rgba(255,60,60,0.28)"}`,
              color:can?"#ffdd44":"rgba(255,80,80,0.65)",padding:"7px 26px",
              fontSize:13,fontFamily:"Courier New",cursor:can?"pointer":"default",
              letterSpacing:2,borderRadius:6,transition:"all 0.15s"}}>
            {can?"UNLOCK":"NEED  "+(price-coins)+"  MORE  COINS"}
          </button>
        </div>
      );
    }
    if(viewId===equippedId)return(
      <div style={{height:28,display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:13,letterSpacing:2,color:`rgba(${rgb},0.65)`,marginBottom:8}}>
        ✓  EQUIPPED
      </div>
    );
    return(
      <div style={{textAlign:"center",marginBottom:10}}>
        <button onClick={()=>{sndClick();onEquip();}}
          style={{background:`rgba(${rgb},0.12)`,border:`1px solid rgba(${rgb},0.50)`,
            color:accent,padding:"7px 26px",fontSize:13,fontFamily:"Courier New",
            cursor:"pointer",letterSpacing:2,borderRadius:6,transition:"all 0.15s"}}>
          EQUIP
        </button>
      </div>
    );
  };
  const equipLine=(viewId: string,equippedId: string,accent: string,onEquip: ()=>void): JSX.Element=>{
    const rgb=hexRgb(accent);
    if(viewId===equippedId)return(
      <div style={{height:28,display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:13,letterSpacing:2,color:`rgba(${rgb},0.65)`,marginBottom:8}}>
        ✓  EQUIPPED
      </div>
    );
    return(
      <div style={{textAlign:"center",marginBottom:10}}>
        <button onClick={()=>{sndClick();onEquip();}}
          style={{background:`rgba(${rgb},0.12)`,border:`1px solid rgba(${rgb},0.50)`,
            color:accent,padding:"7px 26px",fontSize:13,fontFamily:"Courier New",
            cursor:"pointer",letterSpacing:2,borderRadius:6,transition:"all 0.15s"}}>
          EQUIP
        </button>
      </div>
    );
  };

  const arRow=(label: string, val: string, onL: ()=>void, onR: ()=>void, accent: string): JSX.Element=>{
    const rgb=hexRgb(accent);
    return(
      <div style={{marginBottom:20,textAlign:"center",width:"100%"}}>
        <div style={{fontSize:12,letterSpacing:4,color:`rgba(${rgb},0.60)`,marginBottom:6,fontFamily:"Courier New"}}>{label}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
          <button onClick={onL} style={{background:"transparent",border:"none",color:accent,fontSize:36,cursor:"pointer",
            padding:"0 20px",fontFamily:"Courier New",lineHeight:1,
            textShadow:`0 0 10px ${accent}88`,transition:"opacity 0.12s"}}>‹</button>
          <div style={{flex:1,textAlign:"center",fontSize:20,letterSpacing:3,fontWeight:"bold",
            color:accent,fontFamily:"Courier New",textShadow:`0 0 8px ${accent}55`}}>{val}</div>
          <button onClick={onR} style={{background:"transparent",border:"none",color:accent,fontSize:36,cursor:"pointer",
            padding:"0 20px",fontFamily:"Courier New",lineHeight:1,
            textShadow:`0 0 10px ${accent}88`,transition:"opacity 0.12s"}}>›</button>
        </div>
      </div>
    );
  };

  // Small multiplier badge shown below each option selector
  const multBadge=(icon:string,label:string,mult:number,accent:string):JSX.Element=>{
    const pct=Math.round((mult-1)*100);
    const col=mult>1.01?accent:mult<0.99?"#ff5555":"rgba(160,160,160,0.35)";
    return(
      <div style={{textAlign:"center",fontSize:12,fontFamily:"Courier New",letterSpacing:1,
        color:col,marginTop:-10,marginBottom:10,opacity:0.92,pointerEvents:"none"}}>
        {icon}  {mult>1.01?"+":""}{pct}%  ·  ×{mult.toFixed(2)}  {label}
      </div>
    );
  };
  // Combined multiplier row used at the bottom of pages
  const combinedPanel=(coinMult:number,scoreMult:number):JSX.Element=>{
    const cCol=coinMult>1.01?"#ffdd44":coinMult<0.99?"#ff5555":"rgba(160,160,160,0.45)";
    const sCol=scoreMult>1.01?"#88ccff":scoreMult<0.99?"#ff5555":"rgba(160,160,160,0.45)";
    return(
      <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:12,
        background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",
        borderRadius:8,padding:"10px 24px",flexWrap:"wrap"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:3,color:"rgba(200,200,200,0.55)",fontFamily:"Courier New",marginBottom:2}}>COIN  MULT</div>
          <div style={{fontSize:16,fontWeight:"bold",fontFamily:"Courier New",color:cCol,
            textShadow:`0 0 10px ${cCol}88`}}>Coins  ×{coinMult.toFixed(2)}</div>
        </div>
        <div style={{width:1,background:"rgba(255,255,255,0.12)",alignSelf:"stretch"}}/>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:3,color:"rgba(200,200,200,0.55)",fontFamily:"Courier New",marginBottom:2}}>SCORE  MULT</div>
          <div style={{fontSize:16,fontWeight:"bold",fontFamily:"Courier New",color:sCol,
            textShadow:`0 0 10px ${sCol}88`}}>S  ×{scoreMult.toFixed(2)}</div>
        </div>
      </div>
    );
  };

  const mkBtn=(col: string,glow: string,label: string,onClick: ()=>void): JSX.Element=>(
    <button onClick={()=>{sndClick();onClick();}}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>)=>(e.currentTarget.style.background=`rgba(${hexRgb(col.startsWith("#")?col:"#"+col)},0.09)`)}
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>)=>{e.currentTarget.style.background="transparent";e.currentTarget.style.transform="scale(1)";e.currentTarget.style.transition="transform 0.22s cubic-bezier(0.34,1.56,0.64,1)";}}
      onPointerDown={(e: React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.style.transform="scale(0.91)";e.currentTarget.style.transition="transform 0.07s ease-in";}}
      onPointerUp={(e: React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.transition="transform 0.22s cubic-bezier(0.34,1.56,0.64,1)";}}
      onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.transition="transform 0.22s cubic-bezier(0.34,1.56,0.64,1)";}}
      style={{background:"transparent",border:`2px solid #${col}`,color:`#${col}`,
        padding:"15px 52px",fontSize:17,fontFamily:"Courier New",cursor:"pointer",
        letterSpacing:3,borderRadius:8,
        boxShadow:`0 0 22px #${glow}44`,textShadow:`0 0 10px #${col}`}}>{label}</button>
  );

  const dBtn: React.CSSProperties={position:"absolute",width:46,height:46,
    background:"rgba(0,255,136,0.06)",border:"1px solid rgba(0,255,136,0.27)",
    color:"rgba(0,255,136,0.65)",fontSize:18,cursor:"pointer",
    borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
    touchAction:"none",userSelect:"none"};

  const curSkin=SKINS[settings.skin]||SKINS.Mono;
  const curTheme=THEMES[settings.bg]||THEMES["Mono"];
  const diffAccent=settings.maze==="Easy"?"#44ff88":settings.maze==="Hard"?"#ff4422":"#ffdd00";
  const bestHS=Object.entries(highScores).reduce<{label:string,val:number}|null>(
    (b,[hk,v])=>(!b||v>b.val)?{label:hk.replace("_"," · "),val:v}:b,null);
  const viewSkinDef=SKINS[viewSkin]||SKINS.Mono;
  const viewTheme=THEMES[viewBg]||THEMES["Mono"];
  const viewForestTheme=FOREST_THEMES[viewBg]||FOREST_THEMES.Pine;
  const viewHighScore=viewMap==="Practice"?(highScores["Practice_Small_Normal"]||0):(highScores[`${viewMap}_${viewMapSize}_${viewMaze}`]||0);
  const viewDiffAccent=viewMaze==="Easy"?"#44ff88":viewMaze==="Hard"?"#ff4422":"#ffdd00";
  const viewSizeAccent=viewMapSize==="Small"?"#44ff88":viewMapSize==="Large"?"#ff4422":"#ffdd00";
  const isViewForest=viewMap==="Forest";
  const isViewVoid=viewMap==="Void";
  const vt=VOID_THEMES[viewBg];

  useEffect(()=>{
    if(viewMap==="Forest"&&!FOREST_THEMES[viewBg])setViewBg("Pine");
    else if(viewMap==="Maze"&&!THEMES[viewBg])setViewBg("Neon");
    else if(viewMap==="Void"&&!VOID_THEMES[viewBg])setViewBg("Nebula");
    // Practice has no theme selector — nothing to reset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[viewMap]);
  useEffect(()=>{
    if(settings.map==="Forest"&&!FOREST_THEMES[settings.bg])setSettings(s=>({...s,bg:"Pine"}));
    else if(settings.map==="Maze"&&!THEMES[settings.bg])setSettings(s=>({...s,bg:"Neon"}));
    else if(settings.map==="Void"&&!VOID_THEMES[settings.bg])setSettings(s=>({...s,bg:"Nebula"}));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[settings.map]);

  return(
    <div style={{width:"100%",height:"100vh",background:curTheme.bg,
      overflow:"hidden",position:"relative",fontFamily:"Courier New"}}>
      <style>{`
        @keyframes menuFadeIn    {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes menuSlideRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes menuSlideLeft {from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes blink         {50%{opacity:0}}
        button                   {touch-action:manipulation}
        [data-noscroll]::-webkit-scrollbar{display:none}
      `}</style>
      <canvas ref={cvs} style={{display:"block",position:"absolute",inset:0,width:"100%",height:"100%"}}/>

      {screen==="menu"&&(
        <div style={{position:"absolute",inset:0,display:"flex",
          flexDirection:"column",alignItems:"center",justifyContent:"center",
          overflow:"hidden",padding:0}}>
          <div style={{position:"absolute",top:16,right:22,textAlign:"right",pointerEvents:"none"}}>
            <div style={{fontSize:28,letterSpacing:2,color:"rgba(255,200,50,0.90)",
              fontFamily:"Courier New",textShadow:"0 0 18px rgba(255,180,0,0.70)"}}>
              Coins: {coins}
            </div>
            {settings.map!=="Practice"&&(()=>{
              const cm=parseFloat(((DIFF_COIN_MULT[settings.maze]||1)*(SPEED_COIN_MULT[settings.speed]||1)*(SKIN_COIN_MULT[settings.skin]||1)).toFixed(2));
              const cc=cm>1.01?"#ffdd44":cm<0.99?"#ff6666":"rgba(160,160,160,0.40)";
              return<div style={{fontSize:10,letterSpacing:1,color:cc,fontFamily:"Courier New",
                marginTop:2,textShadow:`0 0 8px ${cc}88`}}>Coins x{cm.toFixed(2)} per run</div>;
            })()}
          </div>

          {/* ── Main page ──────────────────────────────────── */}
          {menuPage==="main"&&(
          <div key="main" style={{display:"flex",flexDirection:"column",alignItems:"center",
            width:"min(600px,92vw)",maxHeight:"96vh",overflow:"hidden",
            background:"rgba(0,4,20,0.82)",backdropFilter:"blur(12px)",
            borderRadius:18,padding:"20px 28px",
            border:"1px solid rgba(255,255,255,0.08)",
            animation:`${menuDirRef.current==="back"?"menuSlideLeft":"menuFadeIn"} 0.38s ease-out both`}}>
            <div style={{textAlign:"center",marginBottom:20,pointerEvents:"none"}}>
              <div style={{fontSize:"clamp(34px,6vw,56px)",fontWeight:"bold",color:curTheme.wall,
                lineHeight:1.05,textShadow:`0 0 36px ${curSkin.a}88,0 0 72px ${curSkin.a}33`}}>SNAKE</div>
              <div style={{fontSize:"clamp(34px,6vw,56px)",fontWeight:"bold",color:curSkin.a,
                lineHeight:1.05,textShadow:`0 0 36px ${curSkin.a},0 0 72px ${curSkin.a}44`}}>BLAST</div>
            </div>
            <div style={{textAlign:"center",marginBottom:22,
              background:"rgba(255,200,50,0.13)",border:"1px solid rgba(255,200,50,0.35)",
              borderRadius:12,padding:"14px 36px",
              boxShadow:"0 0 30px rgba(255,180,0,0.15)",pointerEvents:"none"}}>
              <div style={{fontSize:12,letterSpacing:4,color:"rgba(255,200,50,0.70)",
                marginBottom:6,fontFamily:"Courier New"}}>
                {bestHS?"BEST  SCORE  —  "+bestHS.label.toUpperCase():"BEST  SCORE"}
              </div>
              <div style={{fontSize:"clamp(24px,4vw,36px)",fontWeight:"bold",
                fontFamily:"Courier New",letterSpacing:2,
                color:bestHS?"#ffdd44":"rgba(255,200,50,0.22)",
                textShadow:bestHS?"0 0 24px #ffcc0088,0 0 50px #ffaa0044":"none"}}>
                {bestHS?bestHS.val:"—"}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,width:"100%",marginBottom:22}}>
              {(["skins","maps","info"] as const).map((pg,i)=>{
                const c=i===0?curSkin.a:i===1?diffAccent:"#88ccff";const rgb2=hexRgb(c);
                return(
                  <button key={pg} onClick={()=>{sndClick();menuDirRef.current="fwd";setMenuPage(pg);}}
                    onMouseEnter={e=>(e.currentTarget.style.background=`rgba(${rgb2},0.11)`)}
                    onMouseLeave={e=>(e.currentTarget.style.background=`rgba(${rgb2},0.04)`)}
                    style={{background:`rgba(${rgb2},0.10)`,border:`1px solid rgba(${rgb2},0.40)`,
                      color:c,padding:"16px 0",fontSize:15,fontFamily:"Courier New",cursor:"pointer",
                      letterSpacing:3,borderRadius:9,width:"100%",transition:"all 0.18s",
                      textShadow:`0 0 10px ${c}66`,boxShadow:`0 0 16px rgba(${rgb2},0.10)`}}>
                    {i===0?"SNAKE  THEMES":i===1?"MAPS  &  MODE":"HOW  TO  PLAY"}
                  </button>
                );
              })}
            </div>
            <div>{mkBtn(curSkin.a.replace("#",""),curSkin.glow.replace("#",""),"▶  START  GAME",()=>startGame(settings))}</div>
            <div style={{marginTop:14,fontSize:9,color:curTheme.wall,opacity:0.20,
              letterSpacing:2,textAlign:"center",pointerEvents:"none"}}>
              WASD / ARROWS  ·  FILL  SHAPES  ·  CHAIN  COMBOS  ·  ESC  PAUSE
            </div>
          </div>)}

          {/* ── Skins page ─────────────────────────────────── */}
          {menuPage==="skins"&&(
          <div key="skins" style={{display:"flex",flexDirection:"column",alignItems:"center",
            width:"min(580px,92vw)",maxHeight:"96vh",overflow:"hidden",
            background:"rgba(0,4,20,0.82)",backdropFilter:"blur(12px)",
            borderRadius:18,padding:"20px 28px",
            border:"1px solid rgba(255,255,255,0.08)",
            animation:"menuSlideRight 0.38s ease-out both"}}>
            <div style={{fontSize:14,letterSpacing:5,color:viewSkinDef.a,opacity:0.75,
              marginBottom:18,pointerEvents:"none"}}>SNAKE  THEMES</div>
            {arRow("SKIN",viewSkin,
              ()=>{const opts=Object.keys(SKINS);const i=opts.indexOf(viewSkin);sndClick();if(i>0)setViewSkin(opts[i-1]);},
              ()=>{const opts=Object.keys(SKINS);const i=opts.indexOf(viewSkin);sndClick();if(i<opts.length-1)setViewSkin(opts[i+1]);},
              viewSkinDef.a)}
            <div style={{position:"relative",width:140,height:84,marginBottom:22,flexShrink:0}}>
              {([[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[3,1],[2,1],[1,1],[0,1],[0,2],[1,2],[2,2],[3,2],[4,2]] as [number,number][]).map(([x,y],i)=>(
                <div key={i} style={{position:"absolute",left:x*28,top:y*28,width:25,height:25,
                  background:i===0?viewSkinDef.head:i%2===0?viewSkinDef.a:viewSkinDef.b,
                  borderRadius:i===0?"6px 12px 12px 6px":"5px",
                  boxShadow:i===0?`0 0 16px ${viewSkinDef.glow}`:`0 0 4px ${viewSkinDef.a}44`,
                  transition:"background 0.2s"}}>
                  {i===0&&(<>
                    <div style={{position:"absolute",left:14,top:5,width:4,height:4,background:"#0009",borderRadius:"50%"}}/>
                    <div style={{position:"absolute",left:14,top:15,width:4,height:4,background:"#0009",borderRadius:"50%"}}/>
                  </>)}
                </div>
              ))}
            </div>
            {multBadge("Coins","coins",SKIN_COIN_MULT[viewSkin]||1,viewSkinDef.a)}
            {itemStatusLine("skin",viewSkin,settings.skin,viewSkinDef.a,()=>setSettings(s=>({...s,skin:viewSkin})))}
            {arRow("SPEED",viewSpeed,
              ()=>{const opts=Object.keys(SPEEDS);sndClick();setViewSpeed(opts[Math.max(0,opts.indexOf(viewSpeed)-1)]);},
              ()=>{const opts=Object.keys(SPEEDS);const i=opts.indexOf(viewSpeed);sndClick();if(i<opts.length-1)setViewSpeed(opts[i+1]);},
              viewSkinDef.glow)}
            {multBadge("Coins","coins",SPEED_COIN_MULT[viewSpeed]||1,viewSkinDef.glow)}
            {multBadge("S","score",SPEED_SCORE_MULT[viewSpeed]||1,"#88ccff")}
            {equipLine(viewSpeed,settings.speed,viewSkinDef.glow,()=>setSettings(s=>({...s,speed:viewSpeed})))}
            {combinedPanel(
              (DIFF_COIN_MULT[settings.maze]||1)*(SPEED_COIN_MULT[viewSpeed]||1)*(SKIN_COIN_MULT[viewSkin]||1),
              (SPEED_SCORE_MULT[viewSpeed]||1)*(SIZE_SCORE_MULT[settings.mapSize||"Small"]||1)
            )}
            <div style={{display:"flex",gap:14,marginTop:4}}>
              {mkBtn("666666","666666","←  BACK",()=>{menuDirRef.current="back";setMenuPage("main");})}
              {mkBtn(curSkin.a.replace("#",""),curSkin.glow.replace("#",""),"▶  START",()=>startGame(settings))}
            </div>
          </div>)}

          {/* ── Maps page ──────────────────────────────────── */}
          {menuPage==="maps"&&(
          <div key="maps" style={{display:"flex",flexDirection:"column",alignItems:"center",
            width:"min(580px,92vw)",maxHeight:"96vh",overflow:"hidden",
            background:"rgba(0,4,20,0.82)",backdropFilter:"blur(12px)",
            borderRadius:18,padding:"20px 28px",
            border:"1px solid rgba(255,255,255,0.08)",
            animation:"menuSlideRight 0.38s ease-out both"}}>
            <div style={{fontSize:14,letterSpacing:5,color:viewDiffAccent,opacity:0.75,
              marginBottom:18,pointerEvents:"none"}}>MAPS  &  MODE</div>
            {arRow("MAP",viewMap,
              ()=>{const opts=["Practice","Maze","Forest","Void"];sndClick();setViewMap(opts[Math.max(0,opts.indexOf(viewMap)-1)]);},
              ()=>{const opts=["Practice","Maze","Forest","Void"];const i=opts.indexOf(viewMap);sndClick();if(i<opts.length-1)setViewMap(opts[i+1]);},
              isViewVoid?(vt?.shipCol||"#cc44ff"):isViewForest?"#44bb44":viewMap==="Practice"?"#00ff66":viewTheme.wall)}
            {viewMap==="Maze"&&!isUnlocked("map","Maze")
              ? <div style={{textAlign:"center",marginBottom:10}}>
                  <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,200,50,0.85)",marginBottom:7,fontFamily:"Courier New"}}>LOCKED - REACH  1000  SCORE  IN  PRACTICE</div>
                  <div style={{fontSize:9,color:"rgba(255,200,50,0.50)",fontFamily:"Courier New",letterSpacing:1}}>Play Practice until you score 1000 — then Maze unlocks free!</div>
                </div>
              : itemStatusLine("map",viewMap,settings.map,isViewVoid?(vt?.shipCol||"#cc44ff"):isViewForest?"#44bb44":viewMap==="Practice"?"#00ff66":viewTheme.wall,()=>{
                  const newBg=isViewForest&&!FOREST_THEMES[settings.bg]?"Pine":isViewVoid&&!VOID_THEMES[settings.bg]?"Nebula":!isViewForest&&!isViewVoid&&!THEMES[settings.bg]?"Mono":settings.bg;
                  setSettings(s=>({...s,map:viewMap,bg:newBg}));
                })
            }
            {viewMap!=="Practice"&&arRow("MAP  SIZE",viewMapSize,
              ()=>{const opts=Object.keys(MAZE_SIZE_DEFS);sndClick();setViewMapSize(opts[Math.max(0,opts.indexOf(viewMapSize)-1)]);},
              ()=>{const opts=Object.keys(MAZE_SIZE_DEFS);const i=opts.indexOf(viewMapSize);sndClick();if(i<opts.length-1)setViewMapSize(opts[i+1]);},
              viewSizeAccent)}
            {viewMap!=="Practice"&&multBadge("S","score",SIZE_SCORE_MULT[viewMapSize]||1,viewSizeAccent)}
            {viewMap!=="Practice"&&itemStatusLine("mapsize",viewMapSize,settings.mapSize||"Small",viewSizeAccent,()=>setSettings(s=>({...s,mapSize:viewMapSize})))}
            {viewMap!=="Practice"&&arRow("DIFFICULTY",viewMaze,
              ()=>{const opts=Object.keys(MAZE_DIFF_DEFS);sndClick();setViewMaze(opts[Math.max(0,opts.indexOf(viewMaze)-1)]);},
              ()=>{const opts=Object.keys(MAZE_DIFF_DEFS);const i=opts.indexOf(viewMaze);sndClick();if(i<opts.length-1)setViewMaze(opts[i+1]);},
              viewDiffAccent)}
            {viewMap!=="Practice"&&multBadge("Coins","coins",DIFF_COIN_MULT[viewMaze]||1,viewDiffAccent)}
            {viewMap!=="Practice"&&equipLine(viewMaze,settings.maze,viewDiffAccent,()=>setSettings(s=>({...s,maze:viewMaze})))}
            {viewMap==="Practice"
              ? <div style={{textAlign:"center",marginBottom:6,fontSize:9,color:"rgba(0,255,102,0.50)",fontFamily:"Courier New",letterSpacing:2}}>FREE  STARTER  MAP  ·  NO  COINS  EARNED</div>
              : isViewForest
              ? arRow("THEME",viewBg,
                  ()=>{const opts=Object.keys(FOREST_THEMES);sndClick();setViewBg(opts[Math.max(0,opts.indexOf(viewBg)-1)]);},
                  ()=>{const opts=Object.keys(FOREST_THEMES);const i=opts.indexOf(viewBg);sndClick();if(i<opts.length-1)setViewBg(opts[i+1]);},
                  "#4dc44d")
              : isViewVoid
              ? arRow("THEME",viewBg,
                  ()=>{const opts=Object.keys(VOID_THEMES);sndClick();setViewBg(opts[Math.max(0,opts.indexOf(viewBg)-1)]);},
                  ()=>{const opts=Object.keys(VOID_THEMES);const i=opts.indexOf(viewBg);sndClick();if(i<opts.length-1)setViewBg(opts[i+1]);},
                  vt?.shipCol||"#cc44ff")
              : arRow("THEME",viewBg,
                  ()=>{const opts=Object.keys(THEMES);sndClick();setViewBg(opts[Math.max(0,opts.indexOf(viewBg)-1)]);},
                  ()=>{const opts=Object.keys(THEMES);const i=opts.indexOf(viewBg);sndClick();if(i<opts.length-1)setViewBg(opts[i+1]);},
                  viewTheme.wall)
            }
            {viewMap!=="Practice"&&isUnlocked("map",viewMap)&&(isViewForest
              ? itemStatusLine("foresttheme",viewBg,settings.bg,"#4dc44d",()=>setSettings(s=>({...s,bg:viewBg,map:"Forest"})))
              : isViewVoid
              ? itemStatusLine("voidtheme",viewBg,settings.bg,vt?.shipCol||"#cc44ff",()=>setSettings(s=>({...s,bg:viewBg,map:"Void"})))
              : itemStatusLine("mazetheme",viewBg,settings.bg,viewTheme.wall,()=>setSettings(s=>({...s,bg:viewBg,map:"Maze"})))
            )}
            {viewMap==="Practice"&&<div style={{width:"min(270px,76vw)",height:8,borderRadius:4,marginBottom:14,
              background:"linear-gradient(to right,#010c04,#00ff66 55%,#00aa44)"}}/>}
            {isViewVoid&&<div style={{width:"min(270px,76vw)",height:8,borderRadius:4,marginBottom:14,
              background:`linear-gradient(to right,${vt?.bg||"#06001a"},${vt?.shipGlow||"#8800ff"} 55%,${vt?.shipCol||"#cc44ff"})`}}/>}
            {!isViewVoid&&viewMap!=="Practice"&&<div style={{width:"min(270px,76vw)",height:8,borderRadius:4,marginBottom:14,overflow:"hidden",
              background:isViewForest
                ?`linear-gradient(to right,${viewForestTheme.treeGround},${viewForestTheme.canopy2} 55%,${viewForestTheme.floor})`
                :`linear-gradient(to right,${viewTheme.bg},${viewTheme.wall} 55%,${viewTheme.floor})`
            }}/>}
            <div style={{textAlign:"center",marginBottom:14,pointerEvents:"none"}}>
              <div style={{fontSize:12,letterSpacing:3,color:"rgba(255,200,50,0.65)",
                fontFamily:"Courier New",marginBottom:2}}>HIGH  SCORE</div>
              <div style={{fontSize:26,fontWeight:"bold",fontFamily:"Courier New",
                color:viewHighScore>0?"#ffdd44":"rgba(255,200,50,0.22)",
                textShadow:viewHighScore>0?"0 0 18px #ffcc0077":"none"}}>
                {viewHighScore>0?viewHighScore:"—"}
              </div>
            </div>
            {viewMap!=="Practice"&&combinedPanel(
              (DIFF_COIN_MULT[viewMaze]||1)*(SPEED_COIN_MULT[settings.speed]||1)*(SKIN_COIN_MULT[settings.skin]||1),
              (SPEED_SCORE_MULT[settings.speed]||1)*(SIZE_SCORE_MULT[viewMapSize]||1)
            )}
            <div style={{display:"flex",gap:14,marginTop:4}}>
              {mkBtn("666666","666666","←  BACK",()=>{menuDirRef.current="back";setMenuPage("main");})}
              {mkBtn(diffAccent.replace("#",""),diffAccent.replace("#",""),"▶  START",()=>startGame(settings))}
            </div>
          </div>)}

          {/* ── Info page ──────────────────────────────────── */}
          {menuPage==="info"&&(
          <div key="info" data-noscroll style={{display:"flex",flexDirection:"column",alignItems:"center",
            animation:"menuSlideRight 0.38s ease-out both",width:"min(900px,95vw)",
            maxHeight:"96vh",overflowY:"auto",scrollbarWidth:"none",
            background:"rgba(0,4,20,0.82)",backdropFilter:"blur(12px)",
            borderRadius:18,padding:"20px 28px",
            border:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{fontSize:14,letterSpacing:5,color:"#88ccff",opacity:0.80,
              marginBottom:18,pointerEvents:"none",flexShrink:0}}>HOW  TO  PLAY</div>

            {/* Section helper */}
            {(()=>{
              const S=(title:string,col:string,children:React.ReactNode)=>(
                <div style={{marginBottom:10,
                  background:`rgba(${hexRgb(col)},0.10)`,
                  border:`1px solid rgba(${hexRgb(col)},0.32)`,
                  borderRadius:10,padding:"12px 16px"}}>
                  <div style={{fontSize:12,letterSpacing:4,color:col,marginBottom:8,
                    fontFamily:"Courier New",opacity:0.90}}>{title}</div>
                  {children}
                </div>
              );
              const Row=(icon:string,name:string,desc:string,col:string)=>(
                <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
                  <div style={{fontSize:16,lineHeight:1,flexShrink:0,width:22,textAlign:"center"}}>{icon}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:"bold",color:col,fontFamily:"Courier New",
                      letterSpacing:1,marginBottom:2}}>{name}</div>
                    <div style={{fontSize:11,color:"rgba(200,220,255,0.70)",fontFamily:"Courier New",
                      lineHeight:1.45}}>{desc}</div>
                  </div>
                </div>
              );
              const Stat=(label:string,val:string,col:string)=>(
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  marginBottom:6,borderBottom:"1px solid rgba(255,255,255,0.07)",paddingBottom:5}}>
                  <div style={{fontSize:12,color:"rgba(200,220,255,0.65)",fontFamily:"Courier New"}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:"bold",color:col,fontFamily:"Courier New",
                    textShadow:`0 0 8px ${col}88`}}>{val}</div>
                </div>
              );
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,width:"100%",marginBottom:10}}>
                  <div style={{display:"flex",flexDirection:"column"}}>
                    {S("BASICS","#00ffcc",<>
                      {Row(">","STEER","WASD or arrow keys. On phone: swipe or use the d-pad.","#00ffcc")}
                      {Row("o","EAT  FRUIT","Your snake grows. Rarer fruit = more points. Eat fast to chain a combo!","#ffdd44")}
                      {Row("[]","FILL  SHAPES","Cover every glowing tile with your body. They explode for bonus points — your snake reconnects.","#cc88ff")}
                      {Row("X","DEATH","Touch a wall = red flash. Bite yourself = purple flash. Ghost lets you pass through yourself.","#ff4444")}
                      {Row("*","PRACTICE  MAP","Free starter map. Open arena, no coins. Score 1000 to unlock Maze and start earning coins!","#00ff66")}
                      {Row(">>","VOID  MAP","Open space! Dodge moving spaceships — they can't fly through your body. Touch a ship = death.","#cc88ff")}
                    </>)}
                    {S("COMBO","#ff88cc",<>
                      {Row("-","CHAIN","Eat fruits one after another before the timer runs out.","#ff88cc")}
                      {Stat("Combo  ×2","√2  ≈  1.4×  pts","#ff88cc")}
                      {Stat("Combo  ×4","√4  =  2×  pts","#ff44cc")}
                      {Stat("Combo  ×9","√9  =  3×  pts","#ff00cc")}
                      {Stat("Combo  ×16","√16  =  4×  pts","#cc00ff")}
                      <div style={{fontSize:9,color:"rgba(200,220,255,0.40)",fontFamily:"Courier New",marginTop:3,lineHeight:1.4}}>
                        High combos pulse the screen edges. Double powerup doubles all points too.
                      </div>
                    </>)}
                    {S("COINS","#ffdd44",<>
                      {Row("$","EARN","Coins = score ÷ 50 × multipliers. Spend in shop to unlock skins, maps, themes.","#ffdd44")}
                      {Stat("Hard  diff","× 1.8  coins","#ff4422")}
                      {Stat("Fast  speed","× 1.6  coins","#ff8844")}
                      {Stat("Cosmic  skin","× 1.5  coins","#cc44ff")}
                      {Stat("Magma  skin","× 1.35  coins","#ffcc00")}
                      {Stat("Arctic  skin","× 1.2  coins","#88ddff")}
                      {Stat("Neon  skin","× 1.1  coins","#00ffaa")}
                    </>)}
                  </div>
                  <div style={{display:"flex",flexDirection:"column"}}>
                    {S("FRUITS","#ffdd44",<>
                      {Stat("Common","+ 6  pts","#ffdd44")}
                      {Stat("Uncommon","+ 16  pts","#00ffaa")}
                      {Stat("Rare","+ 38  pts","#88aaff")}
                      {Stat("Epic","+ 75  pts","#ffbb00")}
                      <div style={{fontSize:9,color:"rgba(200,220,255,0.40)",fontFamily:"Courier New",marginTop:3,lineHeight:1.4}}>
                        Better themes make rarer fruits appear more often.
                      </div>
                    </>)}
                    {S("POWERUP  FRUITS","#bbbbff",<>
                      {Row("!!","RUSH  +30","Moves faster for 5 s.","#ffee44")}
                      {Row("~~","CHILL  +30","Moves slower for 6 s — easier to turn.","#88ddff")}
                      {Row("++","GHOST  +50","Pass through your own body for 7 s.","#bbbbff")}
                      {Row("x2","DOUBLE  +75","All score ×2 for 8 s.","#ffdd00")}
                      <div style={{fontSize:9,color:"rgba(200,220,255,0.40)",fontFamily:"Courier New",marginTop:3,lineHeight:1.4}}>
                        One powerup spawns every ~10 s when none are on the map. Better themes = higher chance.
                      </div>
                    </>)}
                    {S("SCORE  MULTIPLIER","#88ccff",<>
                      {Stat("Fast  speed","× 1.4  score","#ff8844")}
                      {Stat("Large  map","× 1.5  score","#ff4422")}
                      {Stat("Medium  map","× 1.2  score","#ffdd44")}
                      <div style={{fontSize:9,color:"rgba(200,220,255,0.40)",fontFamily:"Courier New",marginTop:3,lineHeight:1.4}}>
                        Multipliers stack. Fast + Large = ×2.1 score per point.
                      </div>
                    </>)}
                    {S("THEMES  &  TIERS","#88ccff",<>
                      {Row("0","Tier 0  —  Mono / Pine","Rush powerup only. Rare chance.","#aaaaaa")}
                      {Row("1","Tier 1  —  Neon / Swamp","Rush & Chill powerups.","#44ffcc")}
                      {Row("2","Tier 2  —  Arctic / Autumn","Adds Ghost powerup.","#88ddff")}
                      {Row("3","Tier 3  —  Magma / Cherry","Adds Double Score.","#ff8844")}
                      {Row("4","Tier 4  —  Space / Winter","All powerups. Rarest fruits.","#cc88ff")}
                    </>)}
                  </div>
                </div>
              );
            })()}

            <div style={{marginTop:4,flexShrink:0}}>
              {mkBtn("666666","666666","←  BACK",()=>{menuDirRef.current="back";setMenuPage("main");})}
            </div>
          </div>)}

        </div>
      )}

      {screen==="gameover"&&(
        <div style={{position:"absolute",bottom:60,left:"50%",transform:"translateX(-50%)",
          zIndex:10,display:"flex",gap:16,flexDirection:"column",alignItems:"center"}}>
          {mazeJustUnlockedRef.current&&(
            <div style={{textAlign:"center",pointerEvents:"none",animation:"menuFadeIn 0.7s ease-out both",
              background:"rgba(0,255,102,0.10)",border:"1px solid rgba(0,255,102,0.40)",
              borderRadius:10,padding:"10px 24px"}}>
              <div style={{fontSize:10,letterSpacing:3,color:"rgba(0,255,102,0.65)",
                fontFamily:"Courier New",marginBottom:4}}>MAZE  UNLOCKED!</div>
              <div style={{fontSize:12,color:"#00ff66",fontFamily:"Courier New",letterSpacing:1,
                textShadow:"0 0 16px rgba(0,255,102,0.70)"}}>You scored 1000!  Maze is now free.</div>
            </div>
          )}
          {coinsEarnedRef.current>0&&(
            <div style={{textAlign:"center",pointerEvents:"none",animation:"menuFadeIn 0.6s ease-out both"}}>
              <div style={{fontSize:11,letterSpacing:3,color:"rgba(255,200,50,0.60)",
                fontFamily:"Courier New",marginBottom:2}}>COINS  EARNED</div>
              <div style={{fontSize:22,fontWeight:"bold",color:"#ffdd44",fontFamily:"Courier New",
                letterSpacing:2,textShadow:"0 0 20px rgba(255,180,0,0.70)"}}>
                +{coinsEarnedRef.current}  coins
              </div>
            </div>
          )}
          {mkBtn("ff2255","ff2255","↺  PLAY  AGAIN",()=>startGame(stRef.current))}
          {mkBtn("00aaff","00aaff","⌂  MAIN  MENU",()=>{srRef.current="menu";setScreen("menu");menuDirRef.current="none";setMenuPage("main");})}
        </div>
      )}

      {screen==="paused"&&(
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
          justifyContent:"center",zIndex:10,animation:"menuFadeIn 0.18s ease-out both"}}>
          <div style={{background:"rgba(4,8,26,0.96)",
            border:"1px solid rgba(0,255,200,0.18)",borderRadius:22,
            padding:"44px 64px 36px",display:"flex",flexDirection:"column",
            alignItems:"center",gap:0,
            boxShadow:"0 0 0 1px rgba(0,255,200,0.08), 0 8px 60px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.04)"}}>
            <div style={{fontSize:"clamp(26px,4.5vw,40px)",fontWeight:"bold",color:"#00ffcc",
              letterSpacing:10,fontFamily:"Courier New",marginBottom:18,
              textShadow:"0 0 28px rgba(0,255,200,0.55), 0 0 60px rgba(0,255,200,0.18)"}}>
              PAUSED
            </div>
            <div style={{width:"100%",height:1,background:"linear-gradient(to right,transparent,rgba(0,255,200,0.20),transparent)",marginBottom:26}}/>
            <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",alignItems:"center",marginBottom:22}}>
              {mkBtn("00ff88","00ff88","▶  RESUME",()=>{sndResume();srRef.current="playing";setScreen("playing");})}
              {mkBtn("00aaff","00aaff","⌂  MAIN  MENU",()=>{srRef.current="menu";setScreen("menu");menuDirRef.current="none";setMenuPage("main");})}
            </div>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(0,255,200,0.25)",fontFamily:"Courier New"}}>
              ESC  TO  RESUME
            </div>
          </div>
        </div>
      )}

      {screen==="playing"&&(
        <div style={{position:"absolute",bottom:16,right:16,zIndex:10,width:144,height:144}}>
          <button onPointerDown={()=>dpad({x:0,y:-1})} style={{...dBtn,position:"absolute",bottom:96,right:49}}>▲</button>
          <button onPointerDown={()=>dpad({x:0,y: 1})} style={{...dBtn,position:"absolute",bottom:2, right:49}}>▼</button>
          <button onPointerDown={()=>dpad({x:-1,y:0})} style={{...dBtn,position:"absolute",bottom:49,right:98}}>◄</button>
          <button onPointerDown={()=>dpad({x: 1,y:0})} style={{...dBtn,position:"absolute",bottom:49,right:0}}>►</button>
        </div>
      )}
      {showIntro&&screen==="playing"&&(
        <div
          onClick={()=>setShowIntro(false)}
          onKeyDown={()=>setShowIntro(false)}
          tabIndex={0}
          style={{position:"absolute",inset:0,zIndex:50,background:"rgba(0,0,0,0.82)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,cursor:"pointer"}}
        >
          <div style={{color:"#00ff88",fontFamily:"'Courier New',monospace",fontSize:26,fontWeight:"bold",letterSpacing:2,marginBottom:8}}>SNAKEBLAST</div>
          <div style={{color:"#aaffcc",fontFamily:"'Courier New',monospace",fontSize:14,maxWidth:320,textAlign:"center",lineHeight:1.8}}>
            <div>Move with arrow keys or WASD</div>
            <div>Eat fruit to grow your snake</div>
            <div>Surround shape outlines to blast them</div>
            <div>Collect powerups for special abilities</div>
          </div>
          <div style={{color:"#00ff66",fontFamily:"'Courier New',monospace",fontSize:13,background:"rgba(0,255,100,0.10)",border:"1px solid #00ff66",borderRadius:8,padding:"8px 18px",marginTop:8}}>
            Get 1000 score on Practice to unlock new maps!
          </div>
          <div style={{color:"#558866",fontFamily:"'Courier New',monospace",fontSize:12,marginTop:16,animation:"blink 1.2s step-end infinite"}}>CLICK OR PRESS ANY KEY TO START</div>
        </div>
      )}
    </div>
  );
}

if (import.meta.hot) import.meta.hot.invalidate()
