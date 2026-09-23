import test from 'node:test';
import assert from 'node:assert/strict';
import {MemorySteelArcRoomStore,SteelArcRoomService,TURN_MS,DUEL_READY_MS} from '../server/rooms.mjs';

async function setup(withAi=false){
  let now=1000;
  const store=new MemorySteelArcRoomStore(),service=new SteelArcRoomService(store,()=>now);
  const host=await service.create({name:'Host'}),code=host.room.code;
  let guest;
  if(withAi)await service.request(code,host.token,'ai',{slot:'B1',enabled:true});
  else{
    guest=await service.request(code,'','join',{name:'Guest',seatKey:'b'.repeat(48)});
    await service.request(code,guest.token,'ready',{ready:true});
  }
  await service.request(code,host.token,'start');
  const state=()=>service.request(code,host.token,'state');
  const fire=async player=>{
    const current=await state();
    return service.request(code,player.token,'action',{type:'calibration',heading:90,power:20,version:current.room.version,requestId:crypto.randomUUID()});
  };
  const confirm=player=>service.request(code,player.token,'duel-ready',{seed:store.rows.get(code).room.engine.seed});
  return {service,store,host,guest,code,state,fire,confirm,tick:ms=>now+=ms,now:()=>now};
}

test('AI calibrates immediately after a human and duel confirmation is idempotent',async()=>{
  const f=await setup(true),calibrated=await f.fire(f.host);
  assert.ok(calibrated.game.calibration.shots.B1);
  assert.equal(calibrated.game.phase,'aim');
  assert.equal(calibrated.room.duelWaiting,true);
  assert.equal(calibrated.room.deadline,null);
  f.tick(TURN_MS+1);
  assert.equal((await f.state()).game.shotHistory.length,0);
  await assert.rejects(f.service.request(f.code,f.host.token,'duel-ready',{seed:-1}),{status:409});
  const started=await f.confirm(f.host),deadline=started.room.deadline;
  assert.equal(started.room.duelWaiting,false);
  assert.equal(deadline,f.now()+TURN_MS);
  f.tick(1000);
  assert.equal((await f.confirm(f.host)).room.deadline,deadline);
});

test('one expired calibration turn preserves the next human turn and both confirmations start a full duel clock',async()=>{
  const f=await setup();f.tick(TURN_MS+1);
  const expired=await f.state();
  assert.ok(expired.game.calibration.shots.A1);
  assert.equal(expired.game.calibration.shots.B1,undefined);
  assert.equal(expired.game.calibration.turn,'B1');
  assert.equal(expired.room.deadline,f.now()+TURN_MS);
  const calibrated=await f.fire(f.guest);
  assert.equal(calibrated.room.deadline,null);
  await f.confirm(f.host);f.tick(TURN_MS+1);
  const waiting=await f.state();
  assert.equal(waiting.game.completedTurns,0);
  assert.equal(waiting.room.duelWaiting,true);
  await assert.rejects(f.service.request(f.code,f.host.token,'action',{type:'fire',heading:45,power:60,version:waiting.room.version,requestId:'premature-fire'}),{status:409});
  const started=await f.confirm(f.guest);
  assert.equal(started.room.deadline,f.now()+TURN_MS);
  assert.equal(started.game.completedTurns,0);
});

test('an absent confirmation has a bounded wait and does not consume the first duel turn',async()=>{
  const f=await setup();await f.fire(f.host);await f.fire(f.guest);
  f.tick(DUEL_READY_MS+1);
  const started=await f.state();
  assert.equal(started.room.duelWaiting,false);
  assert.equal(started.game.completedTurns,0);
  assert.equal(started.room.deadline,f.now()+TURN_MS);
});

test('leaving the current calibration seat immediately advances its AI replacement',async()=>{
  const f=await setup();await f.fire(f.host);
  await f.service.request(f.code,f.guest.token,'leave');
  const state=await f.state();
  assert.ok(state.game.calibration.shots.B1);
  assert.equal(state.game.phase,'aim');
  assert.equal(state.room.duelWaiting,true);
});
