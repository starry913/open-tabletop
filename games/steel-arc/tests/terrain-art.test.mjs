import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,terrainHeightAt,deformTerrain} from '../web/engine.js';
import {createTerrainArt} from '../web/terrain-art.js';

test('overview mip images are reused and close views retain full resolution',()=>{
 const previous=globalThis.OffscreenCanvas;let built=0,closed=0,zoom=.4;const drawn=[];
 const fake=()=>new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
 globalThis.OffscreenCanvas=class {
  constructor(width,height){this.width=width;this.height=height;built++;}
  getContext(){return fake();}
  transferToImageBitmap(){return {width:this.width,height:this.height,close(){closed++;}};}
 };
 const ctx=fake();
 // A real property-aware proxy is needed for camera transforms and blit checks.
 const main=new Proxy({canvas:{width:1280,height:720},getTransform:()=>({a:zoom,d:zoom,e:0,f:0}),drawImage:s=>drawn.push(s.width)}, {get:(target,key)=>key in target?target[key]:ctx[key]});
 try{
  const state=createMatch({seed:42,themeId:'falls'}),art=createTerrainArt(main,terrainHeightAt);
  art.ground(state);const cold=built;assert.ok(drawn.every(w=>w===256));
  art.ground(state);assert.equal(built,cold);
  drawn.length=0;zoom=.88;art.ground(state);assert.equal(built,cold);assert.ok(drawn.every(w=>w===768));
  art.ground(createMatch({seed:43,themeId:'falls'}));assert.ok(closed>0);
 }finally{if(previous===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=previous;}
});

test('terrain chunks survive cloned snapshots and rebuild only near a crater',()=>{
  const original=globalThis.OffscreenCanvas;let builds=0;
  const context=()=>new Proxy({}, {get:(_,key)=>key==='clearRect'?()=>builds++:key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
  globalThis.OffscreenCanvas=class {constructor(width,height){this.width=width;this.height=height;}getContext(){return context();}};
  try{
    const state=createMatch({seed:42,themeId:'falls'}),art=createTerrainArt(context(),terrainHeightAt);
    art.ground(state);const initial=builds;assert.ok(initial>4);
    art.ground(state);assert.equal(builds,initial);
    art.ground(structuredClone(state));assert.equal(builds,initial,'network snapshot must reuse unchanged chunks');
    const x=state.terrain.landmarks[0].x;
    assert.ok(deformTerrain(state.terrain,{x,y:terrainHeightAt(state.terrain,x),radius:55})>0);
    art.ground(state);assert.ok(builds>initial&&builds<=initial+2,'only crater-adjacent chunks rebuild');
    const updated=builds;art.ground(state);assert.equal(builds,updated);
    art.ground(createMatch({seed:42,themeId:'ice'}));assert.ok(builds>updated,'map switch must invalidate');
  }finally{if(original===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=original;}
});

test('shallow beds curve below a level waterline and hills have asymmetric shoulders',()=>{
  for(let seed=1;seed<=30;seed++){
    const t=createMatch({seed,themeId:'falls'}).terrain;
    for(const r of t.regions.filter(r=>r.material==='shallow')){
      const span=r.to-r.from,edge=terrainHeightAt(t,r.from+span*.03),middle=terrainHeightAt(t,r.from+span*.5);
      assert.ok(middle>edge+3,'real shallow basin, not a flat material strip');
      assert.ok(middle-r.level>=24&&middle-r.level<40);
    }
    const p=t.landmarks[0];assert.ok(Math.abs(terrainHeightAt(t,p.x-p.radius*.45)-terrainHeightAt(t,p.x+p.radius*.45))>1);
  }
});
