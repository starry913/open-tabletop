import test from 'node:test';
import assert from 'node:assert/strict';
import {MonopolyRoomService,MemoryMonopolyRoomStore,TURN_MS,AI_DELAY_MS,ROOM_TTL} from '../server/rooms.mjs';
import {randomBytes} from 'node:crypto';
const seatKey=()=>randomBytes(24).toString('hex');
async function setup(count=4){
  let now=100000;const store=new MemoryMonopolyRoomStore(),service=new MonopolyRoomService(store,()=>now),host=await service.create({name:'Host',playerCount:count});
  const code=host.room.code,key=seatKey(),guest=await service.request(code,'','join',{name:'Guest',seatKey:key});
  const call=(who,op,body)=>service.request(code,who.token,op,{...(op==='action'?{moneyScale:10,rulesVersion:5}:{}),...body});
  return {store,service,host,guest,call,code,key,tick:ms=>now+=ms,now:()=>now};
}
test('ready gate, owner authority, AI fill and safe per-member views',async()=>{
  const x=await setup();
  await assert.rejects(x.call(x.host,'start'),/准备/);await assert.rejects(x.call(x.guest,'start'),/房主/);
  await x.call(x.guest,'ready',{ready:true});const s=await x.call(x.host,'start');
  assert.equal(s.room.aiCount,2);assert.deepEqual(s.game.players.map(p=>p.isBot),[false,false,true,true]);
  assert.equal((await x.call(x.guest,'state')).room.selfSeat,1);
  const serialized=JSON.stringify(await x.call(x.guest,'state'));
  for(const hidden of ['tokenHash','processed','members','seed','rng','decks','queue'])assert.ok(!serialized.includes(`"${hidden}":`));
  await assert.rejects(x.service.request(x.code,seatKey(),'state'),/身份/);
});
test('join retries recover the same seat, including after the match starts',async()=>{
  const x=await setup();const again=await x.service.request(x.code,'','join',{name:'Guest',seatKey:x.key});
  assert.equal(again.room.selfId,x.guest.room.selfId);assert.equal(again.room.roster.length,2);
  await x.call(x.guest,'ready',{ready:true});await x.call(x.host,'start');
  const restored=await x.service.request(x.code,'','join',{name:'Guest',seatKey:x.key});assert.equal(restored.room.selfId,x.guest.room.selfId);
  await assert.rejects(x.service.request(x.code,'','join',{name:'Late',seatKey:seatKey()}),/开始/);
});
test('service owns dice, validates turn/version, and deduplicates identical actions',async()=>{
  const x=await setup();await x.call(x.guest,'ready',{ready:true});const started=await x.call(x.host,'start');
  const body={type:'roll',die:100,version:started.room.version,requestId:'same_roll_12345'};
  await assert.rejects(x.call(x.guest,'action',body),/轮到你/);
  const result=await x.call(x.host,'action',body);assert.ok(result.game.dice.every(d=>d>=1&&d<=6));assert.equal(result.game.dice.length,1);assert.equal(result.game.diceId,1);
  const duplicate=await x.call(x.host,'action',body);assert.equal(duplicate.room.version,result.room.version);assert.equal(duplicate.game.diceId,1);
  await assert.rejects(x.call(x.host,'action',{...body,requestId:'different_request'}),/更新/);
});
test('concurrent identical actions commit exactly one roll through CAS',async()=>{
  const x=await setup();await x.call(x.guest,'ready',{ready:true});const started=await x.call(x.host,'start');
  const body={type:'roll',version:started.room.version,requestId:'concurrent_roll_1'};
  const results=await Promise.all([x.call(x.host,'action',body),x.call(x.host,'action',body)]);
  assert.deepEqual(results[0].game,results[1].game);assert.equal(results[0].game.diceId,1);
});
test('timeout advances one action, leaving transfers ownership and hands the portfolio to AI',async()=>{
  const x=await setup();await x.call(x.guest,'ready',{ready:true});await x.call(x.host,'start');
  x.tick(TURN_MS+1);let s=await x.call(x.guest,'state');assert.equal(s.game.diceId,1);
  await x.call(x.host,'leave');s=await x.call(x.guest,'state');assert.equal(s.room.isOwner,true);assert.equal(s.game.players[0].isBot,true);
  assert.equal(s.room.aiCount,3);await assert.rejects(x.call(x.host,'state'),/身份/);
  x.tick(AI_DELAY_MS+1);await x.call(x.guest,'state');
});
test('finished rooms restart only after ready and expired rooms cannot restore',async()=>{
  const x=await setup();await x.call(x.guest,'ready',{ready:true});await x.call(x.host,'start');
  const row=await x.store.get(x.code,x.now());row.room.engine.players[0].cash=0;row.room.engine.players[2].bankrupt=true;row.room.engine.players[3].bankrupt=true;row.room.engine.phase='debt';row.room.engine.debt={kind:'pay',from:0,to:1,amount:2000};
  await x.store.cas(x.code,row.revision,row.room,row.expiresAt);
  const finished=await x.call(x.host,'action',{type:'bankrupt',version:row.room.version,requestId:'finish_the_match'});
  assert.equal(finished.room.status,'finished');await assert.rejects(x.call(x.host,'start'),/准备/);
  await x.call(x.host,'ready',{ready:true});await x.call(x.guest,'ready',{ready:true});const restart=await x.call(x.host,'start');
  assert.equal(restart.game.phase,'roll');assert.equal(restart.game.diceId,0);
  x.tick(ROOM_TTL+1);await assert.rejects(x.call(x.guest,'state'),/过期/);
});
test('an empty waiting room can be rejoined with a new owner and start normally',async()=>{
  const x=await setup();await x.call(x.host,'leave');await x.call(x.guest,'leave');
  const fresh=await x.service.request(x.code,'','join',{name:'New pilot',seatKey:seatKey()});
  assert.equal(fresh.room.isOwner,true);assert.equal(fresh.room.roster.length,1);
  assert.equal((await x.call(fresh,'start')).room.status,'playing');
});
test('landed buyer alone may buy or skip; human trade timeout rejects',async()=>{
  const x=await setup();await x.call(x.guest,'ready',{ready:true});await x.call(x.host,'start');
  let row=await x.store.get(x.code,x.now());row.room.engine.phase='buy';row.room.engine.pending=1;
  await x.store.cas(x.code,row.revision,row.room,row.expiresAt);
  await assert.rejects(x.call(x.guest,'action',{type:'buy',version:row.room.version,requestId:'guest_buy_001'}),/轮到你/);
  await assert.rejects(x.call(x.guest,'action',{type:'skipBuy',version:row.room.version,requestId:'guest_skip_001'}),/轮到你/);
  let s=await x.call(x.host,'action',{type:'skipBuy',version:row.room.version,requestId:'host_skip_001'});
  assert.equal(s.game.phase,'end');assert.equal(s.game.properties[1].owner,null);assert.equal(s.game.players[0].cash,15000);assert.equal(s.game.auction,null);
  row=await x.store.get(x.code,x.now());row.room.engine.phase='roll';row.room.engine.auction=null;row.room.engine.turn=0;
  await x.store.cas(x.code,row.revision,row.room,row.expiresAt);
  s=await x.call(x.host,'action',{type:'trade',to:1,giveCash:100,takeCash:0,give:[],take:[],version:row.room.version,requestId:'trade_offer_1'});
  x.tick(TURN_MS+1);s=await x.call(x.host,'state');assert.equal(s.game.phase,'roll');assert.equal(s.game.players[0].cash,15000);assert.equal(s.game.players[1].cash,15000);
});
test('authenticated reads migrate legacy rooms once; stale denomination clients cannot spend',async()=>{
  const x=await setup();await x.call(x.guest,'ready',{ready:true});await x.call(x.host,'start');
  const row=await x.store.get(x.code,x.now());row.room.engine.schema=1;delete row.room.engine.moneyScale;
  row.room.engine.players.forEach(p=>p.cash/=10);row.room.engine.phase='buy';row.room.engine.pending=1;
  await x.store.cas(x.code,row.revision,row.room,row.expiresAt);
  const migrated=await x.call(x.host,'state');assert.equal(migrated.game.schema,5);assert.equal(migrated.game.players[0].cash,15000);
  assert.equal(migrated.game.phase,'buy');assert.equal(migrated.game.pending,1);
  const again=await x.call(x.host,'state');assert.equal(again.game.players[0].cash,15000);assert.equal(again.room.version,migrated.room.version);
  await assert.rejects(x.call(x.host,'action',{type:'buy',moneyScale:1,version:again.room.version,requestId:'old_currency_buy'}),/刷新/);
  await assert.rejects(x.call(x.host,'action',{type:'buy',rulesVersion:2,version:again.room.version,requestId:'old_dice_rules_buy'}),/刷新/);
  await assert.rejects(x.call(x.host,'action',{type:'auction',rulesVersion:3,version:again.room.version,requestId:'old_auction_rules'}),/刷新/);
  const bought=await x.call(x.host,'action',{type:'buy',version:again.room.version,requestId:'new_currency_buy'});
  assert.equal(bought.game.players[0].cash,14400);
});
test('server rejects remote building and old construction clients',async()=>{
  const x=await setup();await x.call(x.guest,'ready',{ready:true});await x.call(x.host,'start');
  const row=await x.store.get(x.code,x.now()),g=row.room.engine;
  g.phase='end';g.players[0].pos=1;g.properties[1].owner=0;g.properties[3].owner=0;
  await x.store.cas(x.code,row.revision,row.room,row.expiresAt);
  await assert.rejects(x.call(x.host,'action',{type:'build',property:3,version:row.room.version,requestId:'remote_build_001'}),/到达/);
  await assert.rejects(x.call(x.host,'action',{type:'build',property:1,rulesVersion:4,version:row.room.version,requestId:'old_build_client'}),/刷新/);
  const built=await x.call(x.host,'action',{type:'build',property:1,version:row.room.version,requestId:'landed_build_001'});
  assert.equal(built.game.properties[1].level,1);assert.equal(built.game.properties[3].level,0);assert.equal(built.game.players[0].cash,14500);
});
