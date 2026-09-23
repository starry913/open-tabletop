import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSize} from '../web/render-budget.js';
import {createMatch,createTeamMatch} from '../web/engine.js';
import {BIOME_IDS,materialAt} from '../web/biomes.js';

test('high DPI cannot silently allocate a 4K/8K game canvas',()=>{
 for(const width of [800,1280,1920,2560,3840])for(const dpr of [1,1.25,2,3,4]){
  const size=renderSize(width,dpr);assert.ok(size.width*size.height<=1920*1080);assert.equal(size.width/size.height,16/9);
 }
});
test('six maps place solo tanks at the outer edges and teammates in nearby safe pads',()=>{
 for(const themeId of BIOME_IDS)for(let seed=1;seed<=100;seed++){
  const solo=createMatch({themeId,seed}),w=solo.terrain.width;
  assert.ok(solo.tanks.player.x>=54&&solo.tanks.player.x<=82);
  assert.ok(w-solo.tanks.enemy.x>=54&&w-solo.tanks.enemy.x<=82);
  assert.ok(!materialAt(solo.terrain,solo.tanks.player.x).water);
  assert.ok(!materialAt(solo.terrain,solo.tanks.enemy.x).water);
  const room=createTeamMatch({themeId,seed}),rw=room.battleTerrain.width;
  assert.ok(room.battlePositions.A1<90&&rw-room.battlePositions.B1<90);
  for(const [slot,x] of Object.entries(room.battlePositions)){
   assert.ok((slot[0]==='A'?x:rw-x)<560);
   assert.ok(!materialAt(room.battleTerrain,x).blocked);
  }
 }
});
