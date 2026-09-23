import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamMatch,completeCalibration,TEAM_MAP_RANGE} from '../web/engine.js';
import {RANGE_WIDTH} from '../web/tidal-range.js';
test('random team maps stay in bounds and keep safe separated spawn pads',()=>{
  const widths=new Set(),spawns=new Set();
  for(let seed=1;seed<=300;seed++){
    const s=createTeamMatch({seed}),w=s.terrain.width;
    assert.ok(w>=RANGE_WIDTH.min&&w<=RANGE_WIDTH.max);
    assert.ok(s.battleTerrain.width>=TEAM_MAP_RANGE.minWidth&&s.battleTerrain.width<=TEAM_MAP_RANGE.maxWidth);
    assert.equal(s.terrain.points.length,w/s.terrain.step+1);
    widths.add(w);spawns.add(s.calibration.targetX-s.tanks.A1.x);
    assert.ok(s.tanks.B1.x-s.tanks.A1.x>=2760);
    assert.ok(s.tanks.B2.x-s.tanks.A2.x>=2280);
    assert.ok(s.tanks.A2.x-s.tanks.A1.x>=180);
    for(const tank of Object.values(s.tanks)){
      assert.ok(Math.abs(tank.x-s.calibration.targetX)<=2400);
      s.calibration.shots[tank.id]={score:50};
    }
    const oldX=s.tanks.A1.x;
    completeCalibration(s);
    assert.notEqual(s.tanks.A1.x,oldX);
    for(const t of Object.values(s.tanks)){assert.ok(t.x>48&&t.x<s.terrain.width-48);assert.ok(Math.abs(t.slope)<.001);}
  }
  assert.ok(widths.size>100);assert.ok(spawns.size>150);
  assert.deepEqual(createTeamMatch({seed:99}),createTeamMatch({seed:99}));
});
