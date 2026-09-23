import {moveTank,setAim,hasFallingSupply} from './engine.js';
import {BASE_MOVE_SPEED} from './motion-config.js';

export const CONTROL_CONFIG=Object.freeze({moveSpeed:BASE_MOVE_SPEED,headingSpeed:80,powerSpeed:46,maxFrame:.033});
export function stepTankControls(state,id,keys,dt,{mirrored=false}={}){
  const steps=[];
  if(state.turn!==id||state.phase!=='aim'||hasFallingSupply(state))return {steps,changed:false};
  dt=Math.min(CONTROL_CONFIG.maxFrame,Math.max(0,dt));
  const tank=state.tanks[id];let changed=false;
  for(const [key,direction] of [['KeyA',-1],['KeyD',1]])if(keys.has(key)){
    // Inputs are screen-relative; prediction and authority retain world-space steps.
    const distance=direction*(mirrored?-1:1)*CONTROL_CONFIG.moveSpeed*dt;
    if(moveTank(state,id,distance)){steps.push(distance);changed=true;}
  }
  if(!keys.has('KeyA')&&!keys.has('KeyD')&&Math.abs(tank.slideVelocity||0)>.4){tank.coastTime=(tank.coastTime||0)+dt;while(tank.coastTime>=1/60){tank.coastTime-=1/60;moveTank(state,id,0);steps.push(0);changed=true;}}
  const angle=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const power=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
  if(angle||power){
    const heading=Number.isFinite(tank.heading)?tank.heading:tank.direction===1?tank.angle:180-tank.angle;
    setAim(state,id,{heading:heading+angle*(mirrored?-1:1)*CONTROL_CONFIG.headingSpeed*dt,power:tank.power+power*CONTROL_CONFIG.powerSpeed*dt});changed=true;
  }
  return {steps,changed};
}
