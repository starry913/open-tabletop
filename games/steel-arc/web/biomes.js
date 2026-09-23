// Shared, serializable map definitions. No browser APIs: the room server uses
// exactly the same material queries and seeded layouts as the renderer.
import {buildTidalRange} from './tidal-range.js';
export const MATERIALS=Object.freeze({
  rock:{name:'山岩',speed:1,fuel:1,color:'#697d79',edge:'#c0cdb7',recoil:0},
  sand:{name:'沙滩',speed:.95,fuel:1.05,color:'#b98a57',edge:'#ffe2a0',recoil:0},
  shallow:{name:'浅水',speed:.8,fuel:1.1,color:'#246c78',edge:'#a9f0df',water:true,recoil:0},
  deep:{name:'深水 · 禁入',speed:0,fuel:1,color:'#164957',edge:'#64bec4',water:true,blocked:true,recoil:0},
  canyon:{name:'断谷 · 禁入',speed:0,fuel:1,color:'#304653',edge:'#648087',blocked:true,recoil:0},
  gravel:{name:'悬浮河床',speed:1,fuel:.7,color:'#738585',edge:'#d4dfd5',glide:true,hover:7,recoil:80},
  snow:{name:'雪原',speed:1,fuel:1.05,color:'#617f9b',edge:'#f2fcff',snow:true,recoil:24},
  ice:{name:'冰岸',speed:1,fuel:.7,color:'#387b9b',edge:'#caf9ff',snow:true,glide:true,recoil:80},
});
export const BIOMES=Object.freeze({
  range:{name:'潮汐试射场',time:'09:10 · 海风',sky:['#69a8d9','#b5d8eb','#eff0d9'],ground:['#d7b384','#7b6453'],distant:['#c3dce7','#aecad8','#9bbdc9'],light:'#fff4cf',sun:[1060,120],ambient:'surf',description:'长距试射 · 沙地靶区 · 信号烟',practiceOnly:true},
  falls:{name:'潮汐长滩',time:'15:20 · 暖潮',sky:['#7aaace','#c5dce4','#f4dfba'],ground:['#b6a182','#555450'],distant:['#d4ddd8','#bdcecf','#a6c0c4'],light:'#fff1cb',sun:[960,148],ambient:'surf',description:'长浅滩 · 金沙坡 · 可翻越岩丘'},
  bay:{name:'碧湾断岸',time:'10:20 · 海晴',sky:['#649acb','#b2d9ed','#e5f0e8'],ground:['#b8ab8b','#4c5e66'],distant:['#d3e1e8','#b6cedb','#a6bfcd'],light:'#fff5d9',sun:[910,115],ambient:'surf',description:'长浅岸 · 深水禁入 · 隔湾对射'},
  river:{name:'群峰砾谷',time:'13:10 · 山风',sky:['#759fbd','#b8d1d9','#e5e9dc'],ground:['#839284','#424c4b'],distant:['#d1ddd5','#bdcec3','#a3bbb0'],light:'#fff8d6',sun:[690,82],ambient:'river',description:'无雪高山 · 长砾石河床 · 惯性'},
  canyon:{name:'断峡鸣瀑',time:'08:40 · 雾瀑',sky:['#a6b5bd','#d2dcdb','#e7e8df'],ground:['#829080','#354747'],distant:['#d8dfda','#c3d0cb','#b1c4bc'],light:'#fffae8',sun:[1080,160],ambient:'falls',description:'断峡禁入 · 长浅水岩台 · 实体瀑布'},
  alpine:{name:'云顶雪原',time:'09:40 · 晴雪',sky:['#719ec8','#c1d7e7','#edf0ed'],ground:['#89949d','#424b59'],distant:['#dce4e9','#c5d3de','#b4c6d4'],light:'#fff9e6',sun:[870,96],ambient:'snow',description:'高山雪原 · 长冰岸 · 浅融水'},
  ice:{name:'蓝镜长湖',time:'18:15 · 蓝暮',sky:['#737fae','#b1aed0','#eccac0'],ground:['#798592','#354552'],distant:['#c9c5d7','#b4b7d0','#9ba8c2'],light:'#ffe1ce',sun:[220,215],ambient:'ice',description:'长冰面 · 裸岩丘 · 悬浮砾石岸'},
});
export const BIOME_IDS=Object.freeze(Object.keys(BIOMES).filter(id=>!BIOMES[id].practiceOnly));
export function biomeFor(terrain){return BIOMES[terrain?.themeId]||null;}
export function materialIdAt(terrain,x){
  if(terrain?.calibrationSurface)return terrain.themeId==='range'?'sand':'rock';
  return terrain?.regions?.find(r=>x>=r.from&&x<=r.to)?.material||'rock';
}
export function materialAt(terrain,x){return MATERIALS[materialIdAt(terrain,x)];}
export function regionAt(terrain,x){return terrain?.regions?.find(r=>x>=r.from&&x<=r.to);}
export function collisionHeight(terrain,x,ground){const r=regionAt(terrain,x);return !terrain.calibrationSurface&&MATERIALS[r?.material]?.water?Math.min(ground,r.level):ground;}
export function canBurnAt(terrain,x){const m=materialAt(terrain,x);return !m.water&&!m.snow&&!m.blocked;}

export function applyBiome(terrain,themeId,rng,options={}){
  if(themeId==='range')return buildTidalRange(terrain,rng,options);
  if(!BIOMES[themeId])return terrain;
  const {width:w,step,points}=terrain;
  // Small monotonic horizontal warps preserve map identity and material order.
  // Every random value comes from the authoritative match seed, never the painter.
  const knots=[0,.25+(rng()-.5)*.10,.5+(rng()-.5)*.12,.75+(rng()-.5)*.10,1];
  const warp=t=>{const n=Math.min(3,Math.floor(t*4)),f=t*4-n;return knots[n]+(knots[n+1]-knots[n])*f;};
  const base=558+(rng()-.5)*18,relief=.72+rng()*.48,phase=rng()*Math.PI*2;
  const plans={
    falls:{segments:[[.12,'sand'],[.31,'shallow'],[.48,'rock'],[.53,'gravel'],[.78,'shallow'],[.94,'sand'],[1,'rock']],peaks:[[.395,.085,300],[.865,.085,105]]},
    bay:{segments:[[.12,'sand'],[.30,'rock'],[.32,'sand'],[.51,'shallow'],[.75,'deep'],[.79,'sand'],[.94,'rock'],[1,'sand']],peaks:[[.21,.09,155],[.865,.075,165]]},
    river:{segments:[[.12,'gravel'],[.32,'rock'],[.35,'gravel'],[.46,'shallow'],[.50,'gravel'],[.77,'rock'],[.80,'gravel'],[.92,'shallow'],[1,'gravel']],peaks:[[.23,.09,360],[.54,.04,135],[.675,.095,420]]},
    canyon:{segments:[[.08,'gravel'],[.24,'shallow'],[.38,'rock'],[.51,'canyon'],[.63,'rock'],[.80,'shallow'],[.94,'rock'],[1,'gravel']],peaks:[[.31,.07,120],[.57,.06,100],[.87,.07,145]]},
    alpine:{segments:[[.29,'snow'],[.46,'ice'],[.52,'rock'],[.73,'snow'],[.89,'shallow'],[1,'snow']],peaks:[[.205,.085,370],[.625,.105,430],[.945,.045,65]]},
    ice:{segments:[[.09,'gravel'],[.29,'ice'],[.42,'rock'],[.46,'gravel'],[.71,'ice'],[.83,'rock'],[.95,'shallow'],[1,'gravel']],peaks:[[.355,.065,95],[.77,.06,160]]},
  };
  const plan=plans[themeId];
  // Preserve each concept's long water stretches when the horizontal warp is large.
  for(let attempt=0;attempt<10;attempt++){
    let previous=0,wet=0;
    for(const [end,material] of plan.segments){const next=warp(end);if(['shallow','deep','ice'].includes(material))wet+=next-previous;previous=next;}
    if(wet>.205&&wet<.645)break;
    for(let k=1;k<4;k++)knots[k]=k/4+(knots[k]-k/4)*.65;
  }
  terrain.themeId=themeId;terrain.biomeVersion=3;terrain.spawnLevel=base-6;terrain.regions=[];terrain.waterfalls=[];
  let from=0;
  for(const [end,material] of plan.segments){
    const to=warp(end)*w;
    terrain.regions.push({from,to,material,...(MATERIALS[material].water?{level:base-8}: {})});from=to;
  }
  terrain.landmarks=plan.peaks.map(([c,r,h])=>({x:warp(c)*w,radius:r*w*(.8+rng()*.4),height:h*relief*(.88+rng()*.24),skew:.65+rng()*.7,phase:rng()*6.28}));
  for(let i=0;i<points.length;i++){
    const x=i*step;
    // Broad dunes and terraces continue between the major summits. The same
    // contour drives drawing, driving and shell collision (not scenery props).
    let y=base-10+Math.sin(x*.009+phase)*13+Math.sin(x*.023+phase*.7)*5+Math.sin(x*.053+phase)*1.4;
    for(const peak of terrain.landmarks){
      const signed=(x-peak.x)/peak.radius,d=Math.abs(signed)/(signed<0?peak.skew:2-peak.skew);
      if(d<1){
        const envelope=(1-d*d)*(1-d*d);
        const ridges=1+.10*Math.sin(signed*10+peak.phase)+.045*Math.sin(signed*23+peak.phase);
        y-=peak.height*envelope*ridges;
      }
    }
    const mat=materialIdAt(terrain,x);
    if(mat==='deep'||mat==='canyon')y=710;
    const region=regionAt(terrain,x);
    if(mat==='shallow'){
      const u=(x-region.from)/(region.to-region.from);
      // Water stays level; the *bed* is a shallow curved bowl with real banks.
      y=region.level+2+Math.pow(Math.sin(Math.PI*u),.65)*(30+6*Math.sin(u*9+phase));
    }
    if(mat==='ice'){
      const u=(x-region.from)/(region.to-region.from);
      y=base-5+Math.sin(u*Math.PI)*5+Math.sin(u*10+phase)*1.3;
    }
    if(!MATERIALS[mat].water&&!MATERIALS[mat].blocked){
      // Ease land into each waterline, rather than a vertical material seam.
      for(const shore of terrain.regions.filter(r=>MATERIALS[r.material].water&&!MATERIALS[r.material].blocked)){
        const distance=Math.min(Math.abs(x-shore.from),Math.abs(x-shore.to));
        if(distance<100){const t=distance/100,blend=t*t*(3-2*t);y=(shore.level+1)*(1-blend)+y*blend;}
      }
    }
    points[i]=Math.max(90,y);
  }
  // Shore transitions must remain traversable after peak-width jitter. Pin the
  // water/ice beds, grade the adjacent dry rock rather than creating a step.
  const grade=(i,j)=>{
    const m=materialAt(terrain,i*step),other=materialAt(terrain,j*step);
    if(m.water||m.blocked||m===MATERIALS.ice||other.blocked)return;
    points[i]=Math.max(points[j]-step*1.8,Math.min(points[j]+step*1.8,points[i]));
  };
  for(let i=1;i<points.length;i++)grade(i,i-1);
  for(let i=points.length-2;i>=0;i--)grade(i,i+1);
  if(themeId==='canyon'){
    const gap=terrain.regions.find(r=>r.material==='canyon');
    terrain.waterfalls=[{x:gap.from-3,level:base-8,bottom:716,width:22},{x:gap.to+3,level:base-8,bottom:716,width:29}];
  }else if(themeId==='river'){
    const pool=terrain.regions.find(r=>r.material==='shallow');
    terrain.waterfalls=[{x:pool.to-8,level:pool.level,bottom:base+105,width:14}];
  }
  return terrain;
}

// Spawn pads are selected from safe traversable stretches, not hard-coded fractions
// that can land inside a newly widened pool. Team partners remain separated.
export function biomeSpawns(terrain,rng,count=2){
  if(!terrain.regions)return {left:[terrain.width*.18,terrain.width*.25].slice(0,count),right:[terrain.width*.82,terrain.width*.75].slice(0,count)};
  const w=terrain.width,base=terrain.spawnLevel??terrain.points[0],result=[];
  const safe=x=>terrain.regions.every(r=>!MATERIALS[r.material].blocked||x<r.from-90||x>r.to+90);
  for(let side=0;side<2;side++){
    const candidates=[];
    for(let x=56;x<Math.min(400,w*.14);x+=8){
      const p=side?w-x:x;
      if(safe(p))candidates.push(p);
    }
    const chosen=[];
    for(let n=0;n<count;n++){
      const available=candidates.filter(x=>chosen.every(p=>Math.abs(p-x)>=124)&&(n||count===1||candidates.some(p=>Math.abs(p-x)>=128)));
      const dry=available.filter(x=>!materialAt(terrain,x).water);
      const preferred=(dry.length?dry:available).sort((a,b)=>Math.min(a,w-a)-Math.min(b,w-b));
      // Use the outermost safe band, with small seeded variation, not the
      // entire outer third of the map. Teammates use the next safe pad inward.
      const nearest=preferred.length?Math.min(preferred[0],w-preferred[0]):0;
      const pool=preferred.filter(x=>Math.min(x,w-x)<=nearest+24);
      const x=pool[Math.floor(rng()*pool.length)]+(rng()-.5)*4;
      if(!Number.isFinite(x))throw new Error(`No safe biome spawn pad: ${terrain.themeId}, side ${side}, chosen ${chosen}, candidates ${candidates}`);
      chosen.push(x);
    }
    result.push(chosen.sort((a,b)=>side?b-a:a-b));
  }
  for(const x of result.flat()){
    for(let i=0;i<terrain.points.length;i++){
      const d=Math.abs(i*terrain.step-x);
      if(d<140&&!materialAt(terrain,i*terrain.step).water){const t=Math.max(0,(d-48)/92),blend=t*t*(3-2*t);terrain.points[i]=base*(1-blend)+terrain.points[i]*blend;}
    }
  }
  return {left:result[0],right:result[1]};
}
