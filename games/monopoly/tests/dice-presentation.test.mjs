import test from 'node:test';
import assert from 'node:assert/strict';
import {createDicePresentation,DICE_ROLL_MS} from '../web/dice-presentation.js';
import {createGame,applyAction,upgradeGame} from '../web/engine.js';

function setup(){
  let now=0,id=0,reveals=0;const timers=new Map();
  const gate=createDicePresentation({onReveal:()=>reveals++,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimer:key=>timers.delete(key)});
  const advance=ms=>{now+=ms;for(const[key,t]of [...timers])if(t.at<=now){timers.delete(key);t.fn();}};
  return {gate,advance,reveals:()=>reveals};
}
test('result, pawn position, payment and event log wait until the die stops',()=>{
  const {gate,advance}=setup();const old=createGame(),result=applyAction(old,0,{type:'roll'},()=>.6); // Four: income tax.
  gate.reset(old);assert.ok(gate.begin());assert.equal(gate.begin(),false);
  const view=gate.sync(result);assert.equal(gate.rolling,true);assert.equal(view.players[0].pos,0);assert.equal(view.players[0].cash,15000);assert.equal(view.events.length,0);
  advance(DICE_ROLL_MS-1);assert.deepEqual(gate.sync(result).dice,[1]);
  advance(1);assert.equal(gate.rolling,false);assert.deepEqual(gate.sync(result).dice,[4]);assert.equal(gate.sync(result).players[0].pos,4);assert.equal(gate.sync(result).players[0].cash,13000);
});
test('duplicate snapshots and pending phase changes share one animation',()=>{
  const {gate,advance,reveals}=setup();const old=createGame();gate.reset(old);
  let result=applyAction(old,0,{type:'roll'},()=>0);gate.sync(result);advance(500);gate.sync(result);
  result=applyAction(result,0,{type:'buy'});assert.equal(gate.sync(result).properties[1].owner,null);
  advance(DICE_ROLL_MS-500);assert.equal(gate.sync(result).properties[1].owner,0);assert.equal(reveals(),1);
  gate.sync(result);advance(2000);assert.equal(reveals(),1);
});
test('slow response does not spin twice; reset cancels a failed request or restored roll',()=>{
  const {gate,advance,reveals}=setup(),old=createGame();gate.reset(old);gate.begin();advance(2000);assert.equal(gate.rolling,true);
  const result=applyAction(old,0,{type:'roll'},()=>0);assert.deepEqual(gate.sync(result).dice,[1]);assert.equal(gate.rolling,false);
  gate.begin();gate.reset(result);advance(2000);assert.equal(gate.rolling,false);assert.equal(reveals(),0);
});
test('presentation never consumes randomness or modifies the authoritative snapshot',t=>{
  t.mock.method(Math,'random',()=>{throw Error('Presentation RNG is forbidden');});
  const {gate,advance}=setup(),old=createGame({},()=>.3),result=applyAction(old,0,{type:'roll'},()=>.4),copy=structuredClone(result);
  gate.reset(old);gate.begin();gate.sync(result);advance(DICE_ROLL_MS);assert.deepEqual(result,copy);
});
test('legacy doubles cannot leave an extra roll after migration to single-die rules',()=>{
  const old=createGame();old.schema=2;old.dice=[4,4];old.doubles=1;old.extra=true;old.phase='roll';old.players[0].pos=8;
  const next=upgradeGame(old);assert.equal(next.schema,5);assert.deepEqual(next.dice,[4]);assert.equal(next.turn,1);assert.equal(next.players[0].pos,8);assert.equal(next.extra,false);assert.deepEqual(upgradeGame(next),next);
  old.phase='end';const finish=upgradeGame(old);assert.equal(finish.turn,0);assert.equal(applyAction(finish,0,{type:'end'}).turn,1);
});
test('utilities reuse the one movement roll rather than requesting a second random result',()=>{
  let g=createGame();g.players[0].pos=6;g.properties[12].owner=1;let calls=0;
  g=applyAction(g,0,{type:'roll'},()=>{calls++;assert.equal(calls,1);return .99;});
  assert.equal(g.players[0].pos,12);assert.equal(g.players[0].cash,14760);assert.equal(g.players[1].cash,15240);
});
