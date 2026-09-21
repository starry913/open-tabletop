import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BOARD,CARDS,createGame,upgradeGame,rent,applyAction,validSavedGame} from '../web/engine.js';
import {interest,redemption,START_CASH,GO_SALARY,JAIL_FEE} from '../web/economy.js';
const baseline=JSON.parse(await readFile(new URL('./fixtures/economy-v1.json',import.meta.url),'utf8'));

test('every board price, rent, tax and event payout is exactly 10 times the previous economy',()=>{
  const monetary=['price','mortgage','build','amount','house','hotel'];
  function compare(old,current){for(const [key,value] of Object.entries(old))assert.deepEqual(current[key],key==='rent'?value.map(n=>n*10):monetary.includes(key)?value*10:value,`${current.id??current.kind}.${key}`);}
  baseline.board.forEach((b,i)=>compare(b,BOARD[i]));
  for(const deck of Object.keys(baseline.cards))baseline.cards[deck].forEach((c,i)=>compare(c,CARDS[deck][i]));
  assert.deepEqual([START_CASH,GO_SALARY,JAIL_FEE],[15000,2000,500]);
});
test('railroads and dice-based utilities scale rent, including special card multipliers',()=>{
  const g=createGame();g.properties[5].owner=0;assert.equal(rent(g,5),250);
  g.properties[15].owner=0;assert.equal(rent(g,5),500);assert.equal(rent(g,5,7,2),1000);
  g.properties[12].owner=0;assert.equal(rent(g,12,7),280);
  g.properties[28].owner=0;assert.equal(rent(g,12,7),700);assert.equal(rent(g,12,7,10),700);
});
test('interest rounding preserves the old fee at the new minimum currency unit',()=>{
  assert.equal(interest(750),80);assert.equal(redemption(750),830);
  assert.equal(interest(1750),180);assert.equal(redemption(500),550);
});
test('old saves convert cash and pending settlements once without scaling dice or positions',()=>{
  const old=createGame();old.schema=1;delete old.moneyScale;old.players.forEach(p=>p.cash/=10);
  old.players[0].cash=1234;old.players[0].pos=17;old.phase='debt';
  old.debt={kind:'pay',from:0,to:1,amount:1500};old.queue=[{kind:'pay',from:1,to:0,amount:25},{kind:'move',player:0,steps:7}];
  old.events=[{id:1,text:'Player 50 掷出 2 + 6。'}];old.eventId=1;old.lastCard={deck:'chance',index:6,text:'收到分红 50。'};
  const upgraded=upgradeGame(old);assert.equal(upgraded.players[0].cash,12340);assert.equal(upgraded.players[0].pos,17);
  assert.equal(upgraded.debt.amount,15000);assert.equal(upgraded.queue[0].amount,250);assert.equal(upgraded.queue[1].steps,7);
  assert.deepEqual(upgraded.legacyEvents,old.events);assert.match(upgraded.lastCard.text,/500/);assert.deepEqual(upgraded.dice,old.dice);
  assert.equal(upgraded.houses,32);assert.ok(validSavedGame(upgraded));assert.equal(old.players[0].cash,1234);
  assert.deepEqual(upgradeGame(upgraded),upgraded);
  const auction={...old,phase:'auction',debt:null,queue:[],auction:{property:1,active:[0,1],actor:1,bid:37,high:0}};
  const canceled=upgradeGame(auction);assert.equal(canceled.auction,null);assert.equal(canceled.players[0].cash,12340);assert.equal(canceled.properties[1].owner,null);assert.equal(canceled.phase,'end');
  const trade={...old,phase:'trade',trade:{from:0,to:1,give:[1],take:[3],giveCash:12,takeCash:43,returnPhase:'debt'}};
  const t=upgradeGame(trade).trade;assert.equal(t.giveCash,120);assert.equal(t.takeCash,430);assert.deepEqual(t.give,[1]);
});
test('trade inputs preserve the old one-unit resolution as ten new units',()=>{
  const fresh=createGame();assert.throws(()=>applyAction(fresh,0,{type:'trade',to:1,giveCash:1}));
  const offer=applyAction(fresh,0,{type:'trade',to:1,giveCash:10});assert.equal(offer.trade.giveCash,10);
});
