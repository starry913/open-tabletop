import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,upgradeGame,validSavedGame} from '../web/engine.js';

const legacy=()=>({...createGame({playerCount:3}),schema:3,rulesVersion:3});
test('legacy unfinished bids are canceled without charging or awarding ownership',()=>{
  const old=legacy();old.phase='auction';old.auction={property:1,active:[0,1,2],actor:2,bid:900,high:1};
  const next=upgradeGame(old);
  assert.equal(next.schema,5);assert.equal(next.phase,'end');assert.equal(next.auction,null);
  assert.deepEqual(next.players,old.players);assert.deepEqual(next.properties,old.properties);
  assert.deepEqual(upgradeGame(next),next);assert.ok(validSavedGame(next));assert.equal(old.auction.bid,900);
});
test('legacy bankruptcy auctions are removed and turn proceeds to the next living player',()=>{
  const old=legacy();old.players[0].bankrupt=true;old.players[0].cash=0;
  old.phase='auction';old.auction={property:1,active:[1,2],actor:1,bid:0,high:null};
  old.queue=[{kind:'auction',property:3},{kind:'pay',from:1,to:2,amount:100}];
  const next=upgradeGame(old);assert.equal(next.turn,1);assert.equal(next.phase,'roll');
  assert.equal(next.properties[1].owner,null);assert.equal(next.properties[3].owner,null);
  assert.equal(next.players[1].cash,14900);assert.equal(next.players[2].cash,15100);
  assert.deepEqual(next.queue,[]);assert.ok(validSavedGame(next));
});
test('legacy pending purchase remains available and latest saves reject auction phases',()=>{
  const old=legacy();old.phase='buy';old.pending=1;old.players[0].pos=1;
  const next=upgradeGame(old);assert.equal(next.phase,'buy');assert.equal(next.pending,1);
  assert.deepEqual(next.players,old.players);assert.ok(validSavedGame(next));
  next.phase='auction';assert.equal(validSavedGame(next),false);
});
