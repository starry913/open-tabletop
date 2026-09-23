// Shared authoritative 2D geometry, also used by the training camp.
export const RANGE_DISTANCE=Object.freeze({min:1600,max:2400,minChange:300});
export const RANGE_WIDTH={min:3400,max:5080};
export function separatedValue(rng,min,max,previous,minChange,step=2){
  const values=[];for(let n=min;n<=max;n+=step)if(!Number.isFinite(previous)||Math.abs(n-previous)>=minChange)values.push(n);
  if(!values.length)throw new Error('No valid non-repeating distance');
  return values[Math.floor(rng()*values.length)];
}
export function buildTidalRange(terrain,rng,{previousRangeDistance}={}){
  const step=terrain.step,distance=separatedValue(rng,1600,2400,previousRangeDistance,300);
  const leftMargin=100+Math.floor(rng()*21)*2,rightMargin=100+Math.floor(rng()*21)*2;
  const width=distance*2+leftMargin+rightMargin,center=leftMargin+distance,depth=24+rng()*10;
  Object.assign(terrain,{width,themeId:'range',calibrationSurface:true,spawnLevel:520,regions:[{from:0,to:width,material:'sand'}],waterfalls:[],landmarks:[]});
  terrain.points=Array.from({length:width/step+1},(_,i)=>{
    const x=i*step,u=Math.max(0,1-Math.abs(x-center)/(width*.36));
    return 520+depth*u*u*(3-2*u);
  });
  terrain.rangeTarget={targetX:center,radius:260,coreRadius:36,distance};
  return terrain;
}
export function rangeScore(distance,radius=260,coreRadius=36){
  const d=Math.abs(distance);
  if(d<=coreRadius)return 100-10*d/coreRadius;
  return Math.max(0,90*(1-(d-coreRadius)/(radius-coreRadius)));
}
