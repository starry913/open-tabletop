import {resolveCalibrationShot,advanceCalibrationTurn,completeCalibration} from '../web/engine.js';
// Movement/idempotency tests start in a completed duel. Calibration itself is
// exercised separately; do not bypass its action gate in production code.
export async function enterDuelFixture(service,code,token,now=Date.now()){
  const stored=await service.store.get(code,now),state=stored.room.engine;
  for(const id of state.turnOrder){resolveCalibrationShot(state,id,{heading:90,power:20});advanceCalibrationTurn(state);}
  completeCalibration(state);state.turn='A1';state.turnIndex=state.turnOrder.indexOf('A1');
  await service.store.cas(code,stored.revision,stored.room,stored.expiresAt);
  return service.request(code,token,'state');
}
