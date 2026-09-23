import {MIN_POWER,MAX_POWER,POWER_SPAN} from './aim-limits.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const shortestAngle=(from,to)=>((to-from+540)%360)-180;

// Slingshot mapping with a calm center and a longer low-power range.
export function mapAimPointer(rawX,rawY,limit,{heading=45,power=68,precision=false}={}){
  const rawDistance=Math.hypot(rawX,rawY),distance=Math.min(limit,rawDistance),scale=rawDistance?distance/rawDistance:0;
  const x=rawX*scale,y=rawY*scale,normalized=limit?distance/limit:0,dead=.1;
  let nextHeading=heading;
  if(normalized>dead){
    const target=((Math.atan2(y,-x)*180/Math.PI)%360+360)%360;
    const factor=precision?.18:normalized<.28?.42:1;
    nextHeading=(heading+shortestAngle(heading,target)*factor+360)%360;
  }
  const effective=clamp((normalized-dead)/(1-dead),0,1);
  const targetPower=20+Math.pow(effective,1.55)*POWER_SPAN;
  const powerFactor=precision?.2:normalized<.32?.5:1;
  const nextPower=power+(targetPower-power)*powerFactor;
  return {heading:Math.round(nextHeading),power:Math.round(clamp(nextPower,MIN_POWER,MAX_POWER)),x,y,nx:limit?x/limit:0,ny:limit?y/limit:0};
}
