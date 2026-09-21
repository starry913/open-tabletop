import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,canBuild,upgradeGame,validSavedGame} from '../web/engine.js';
import {chooseAction} from '../web/ai.js';

const owned=()=>{const g=createGame({playerCount:3,mode:'local'});for(const id of [1,3])g.properties[id].owner=0;return g;};
test('building requires the active player to land on that exact owned street this turn',()=>{
  let g=owned();g.players[0].pos=1;
  assert.equal(canBuild(g,0,1),false);assert.throws(()=>applyAction(g,0,{type:'build',property:1}));
  g=applyAction(g,0,{type:'roll'},()=>.2);assert.equal(g.players[0].pos,3);assert.equal(g.phase,'end');
  const before=structuredClone(g);assert.equal(canBuild(g,0,1),false);
  assert.throws(()=>applyAction(g,0,{type:'build',property:1}));assert.deepEqual(g,before);
  assert.throws(()=>applyAction(g,1,{type:'build',property:3}));assert.equal(canBuild(g,0,3),true);
  assert.deepEqual(chooseAction(g),{type:'build',property:3});
  g=applyAction(g,0,{type:'build',property:3});assert.equal(g.properties[3].level,1);assert.equal(g.players[0].cash,14500);
  assert.equal(canBuild(g,0,3),false);assert.equal(canBuild(g,0,1),false);
  assert.notEqual(chooseAction(g).type,'build');
});
test('hotel upgrades also require landing and debts never allow building',()=>{
  let g=owned();for(const id of [1,3])g.properties[id].level=4;g.houses=24;g.phase='end';g.players[0].pos=1;
  assert.equal(canBuild(g,0,3),false);assert.throws(()=>applyAction(g,0,{type:'build',property:3}));
  g=applyAction(g,0,{type:'build',property:1});assert.equal(g.properties[1].level,5);assert.equal(g.hotels,11);assert.equal(g.houses,28);
  g.players[0].pos=3;g.phase='debt';g.debt={from:0,to:1,amount:20000};assert.equal(canBuild(g,0,3),false);
});
test('existing buildings and pending purchase survive the landing-build migration exactly once',()=>{
  const old=owned();old.schema=4;old.rulesVersion=4;old.properties[1].level=1;old.houses=31;old.phase='buy';old.pending=6;old.players[0].pos=6;
  const next=upgradeGame(old);assert.equal(next.schema,5);assert.equal(next.rulesVersion,5);
  assert.deepEqual(next.players,old.players);assert.deepEqual(next.properties,old.properties);assert.equal(next.houses,31);
  assert.equal(next.phase,'buy');assert.equal(next.pending,6);assert.ok(validSavedGame(next));assert.deepEqual(upgradeGame(next),next);
});
