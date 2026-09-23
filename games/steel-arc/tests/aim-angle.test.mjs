import test from 'node:test';
import assert from 'node:assert/strict';
import {screenHeading} from '../web/aim-angle.js';
import {TURN_MS,chooseWeakTeamAiAction} from '../server/rooms.mjs';
import {createTeamMatch} from '../web/engine.js';

test('both players show the same angle for the same screen direction',()=>{
  assert.equal(screenHeading(53),53);
  assert.equal(screenHeading(127,true),53);
  assert.equal(screenHeading(screenHeading(127,true)+1,true),126);
  for(const angle of [0,45,90,180,270,359])assert.equal(screenHeading(screenHeading(angle,true),true),angle);
});
test('friend room turn lasts forty seconds',()=>assert.equal(TURN_MS,40000));
test('AI aims towards the enemy instead of firing backwards',()=>{
  const state=createTeamMatch({seed:18});state.phase='aim';
  const a=chooseWeakTeamAiAction(state,'A1',()=>.5),b=chooseWeakTeamAiAction(state,'B1',()=>.5);
  assert.ok(a.heading>=10&&a.heading<=85);
  assert.ok(b.heading>=95&&b.heading<=170);
  assert.equal(a.weaponId,'calibration');assert.equal(b.weaponId,'calibration');
});
