import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,createTeamMatch,resolveCalibrationShot,terrainHeightAt} from '../web/engine.js';
import {rangeScore,RANGE_WIDTH} from '../web/tidal-range.js';
test('tidal range is seeded, shallow, equal-height and separate from duel terrain',()=>{
 for(let seed=1;seed<=40;seed++){
  const s=createTeamMatch({seed});assert.equal(s.terrain.themeId,'range');assert.notEqual(s.battleTerrain.themeId,'range');assert.ok(s.terrain.width>=RANGE_WIDTH.min&&s.terrain.width<=RANGE_WIDTH.max);
  assert.equal(s.tanks.A1.y,s.tanks.B1.y);assert.equal(s.tanks.A2.y,s.tanks.B2.y);
  assert.ok(terrainHeightAt(s.terrain,s.calibration.targetX)>520);
  assert.deepEqual(s.terrain,createTeamMatch({seed}).terrain);
 }
 const practice=createMatch({seed:7,themeId:'range'});assert.ok(practice.terrain.rangeTarget);assert.equal(practice.terrain.regions[0].material,'sand');
});

test('new rounds change actual distance, mirror both teams and defeat a fixed 51/107 answer',()=>{
 let previousRangeDistance,previousBattleWidth,hits=0;const distances=[];
 for(let seed=1;seed<=100;seed++){
  const s=createTeamMatch({seed,previousRangeDistance,previousBattleWidth}),c=s.calibration;
  if(previousRangeDistance!==undefined)assert.ok(Math.abs(c.distance-previousRangeDistance)>=300);
  if(previousBattleWidth!==undefined)assert.ok(Math.abs(s.battleTerrain.width-previousBattleWidth)>=350);
  assert.equal(c.targetX-s.tanks.A1.x,s.tanks.B1.x-c.targetX);
  assert.equal(c.targetX-s.tanks.A2.x,s.tanks.B2.x-c.targetX);
  const shot=resolveCalibrationShot(s,'A1',{heading:51,power:107});if(shot.score>=90)hits++;
  distances.push(c.distance);previousRangeDistance=c.distance;previousBattleWidth=s.battleTerrain.width;
 }
 assert.ok(Math.max(...distances)-Math.min(...distances)>700);assert.ok(hits<20,`fixed answer got ${hits} high scores`);
});
test('every range shooting seat can reach the core within 125 power using real ballistics',()=>{
 for(const seed of [1,7,25,93])for(const slot of ['A1','B1','A2','B2']){
  const s=createTeamMatch({seed});let lo=20,hi=125,best=Infinity;
  for(let i=0;i<15;i++){
   const power=(lo+hi)/2;delete s.calibration.shots[slot];
   const shot=resolveCalibrationShot(s,slot,{heading:slot[0]==='A'?45:135,power});
   const miss=(shot.x-s.calibration.targetX)*(slot[0]==='A'?1:-1);best=Math.min(best,Math.abs(miss));if(miss>0)hi=power;else lo=power;
  }
  assert.ok(best<4,`${seed} ${slot} misses by ${best}`);
 }
});
test('high scores require a narrow core while wider misses still earn points',()=>{
 assert.equal(rangeScore(0),100);assert.equal(rangeScore(36),90);assert.ok(rangeScore(100)>0&&rangeScore(100)<70);assert.equal(rangeScore(260),0);assert.equal(rangeScore(-36),90);
});
