import {biomeFor} from './biomes.js';
import {createTerrainArt} from './terrain-art.js';

// All scenery is procedural Canvas art. Geometry and waterlines come from the
// authoritative terrain; cosmetic animation never changes collisions.
export function createBiomePainter(ctx,heightAt){
  const {ground}=createTerrainArt(ctx,heightAt);
  let skyCache=null,skyKey=null;
  const poly=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
  const noise=(i,seed)=>{let n=Math.imul((i+13)^(seed||1),1597334677);n^=n>>>15;return(n>>>0)/4294967295;};
  function sky(state,camera){
    const t=biomeFor(state.terrain);if(!t)return false;
    const key=state.seed+':'+state.terrain.themeId,destination=ctx;
    if(typeof OffscreenCanvas!=='undefined'){
      if(skyKey===key&&skyCache){ctx.drawImage(skyCache,0,0);return true;}
      skyCache=new OffscreenCanvas(1280,720);ctx=skyCache.getContext('2d');camera=0;
    }
    const now=performance.now()*.001,night=false;
    const g=ctx.createLinearGradient(0,0,0,720);t.sky.forEach((c,i)=>g.addColorStop(i/2,c));ctx.fillStyle=g;ctx.fillRect(0,0,1280,720);
    const sx=t.sun[0]-camera*.025,sy=t.sun[1],glow=ctx.createRadialGradient(sx,sy,8,sx,sy,240);
    glow.addColorStop(0,t.light+'b0');glow.addColorStop(.3,t.light+'35');glow.addColorStop(1,t.light+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,1280,560);
    ctx.fillStyle=t.light;ctx.beginPath();ctx.arc(sx,sy,night?27:17,0,Math.PI*2);ctx.fill();
    // Soft cloud masses are cached with the sky, not blurred every frame.
    ctx.save();ctx.filter='blur(4px)';
    for(let bank=0;bank<12;bank++){
      const x=noise(bank,37)*1450-80,y=70+noise(bank,71)*230,s=.5+noise(bank,91);
      for(let puff=0;puff<9;puff++){
        const px=x+puff*16*s,py=y+Math.sin(puff*1.3+bank)*7*s;
        ctx.fillStyle=puff%3?'#fff9e528':'#eaf3f332';ctx.beginPath();ctx.ellipse(px,py,(15+noise(puff+bank*9,17)*16)*s,(4+noise(puff,31)*7)*s,0,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
    if(night){
      for(let i=0;i<75;i++){ctx.globalAlpha=.25+noise(i,7)*.5;ctx.fillStyle='#e7fcff';ctx.fillRect(noise(i,state.seed)*1280,noise(i,16)*290,1.5,1.5);}ctx.globalAlpha=1;
      const aurora=ctx.createLinearGradient(0,40,0,250);aurora.addColorStop(0,'#73efc000');aurora.addColorStop(.55,'#73efc024');aurora.addColorStop(1,'#8192ff00');ctx.fillStyle=aurora;
      for(let band=0;band<3;band++){const p=[];for(let x=0;x<=1280;x+=16)p.push([x,92+band*30+Math.sin(x*.006+now*.08+band)*35]);for(let x=1280;x>=0;x-=16)p.push([x,185+band*24+Math.sin(x*.006+now*.08+band)*30]);poly(p);}
    }
    ctx.save();ctx.filter='blur(7px)';ctx.globalAlpha=.65;
    for(let layer=0;layer<3;layer++){
      const base=360+layer*70,amp=90+layer*22,p=[];
      for(let x=-40;x<=1320;x+=20){const wx=x+camera*(.07+layer*.065),wave=Math.sin(wx*.006+layer*4)+Math.sin(wx*.012+1.2)*.34;let lift=Math.abs(wave)*amp;if(state.terrain.themeId==='bay')lift*=.48;if(state.terrain.themeId==='canyon')lift=Math.floor(lift/30)*30;if(state.terrain.themeId==='river')lift*=.65;p.push([x,base-lift]);}
      ctx.fillStyle=t.distant[layer];poly([...p,[1320,720],[-40,720]]);
      if(state.terrain.themeId==='alpine'){ctx.fillStyle=layer===0?'#e7f5f0aa':'#c9e7eb55';for(let i=1;i<p.length-1;i++)if(p[i][1]<p[i-1][1]&&p[i][1]<p[i+1][1])poly([[p[i][0]-33,p[i][1]+32],p[i],[p[i][0]+39,p[i][1]+32],[p[i][0]+10,p[i][1]+22],[p[i][0]-4,p[i][1]+29]]);}
    }
    if(['bay','ice','river','range'].includes(state.terrain.themeId)){
      const water=ctx.createLinearGradient(0,440,0,720);water.addColorStop(0,night?'#346a85':'#56a9b4');water.addColorStop(1,night?'#17334e':'#257285');ctx.fillStyle=water;ctx.fillRect(0,484,1280,236);
      if(state.terrain.themeId==='range'){
        const sea=ctx.createLinearGradient(0,392,0,575);sea.addColorStop(0,'#83b8cb');sea.addColorStop(.45,'#54a5bb');sea.addColorStop(1,'#83c7ca');ctx.fillStyle=sea;ctx.fillRect(0,392,1280,328);
        ctx.strokeStyle='#fff0cd30';ctx.lineWidth=1;
        for(let i=0;i<75;i++){const x=noise(i,73)*1280,y=398+noise(i,89)*190;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12+noise(i,33)*42,y);ctx.stroke();}
      }
      ctx.strokeStyle=t.light+'35';ctx.lineWidth=1;for(let i=0;i<24;i++){const y=490+i*8,x=sx-140+Math.sin(i*3+now*.3)*90,w=25+i*5;ctx.beginPath();ctx.moveTo(x-w,y);ctx.lineTo(x+w,y);ctx.stroke();}
    }
    if(['falls','alpine','river'].includes(state.terrain.themeId)){
      ctx.fillStyle=t.distant[2]+'a0';for(let i=0;i<32;i++){const x=((i*57-camera*.23)%1700+1700)%1700-100,y=460+Math.sin(i*.8)*18,h=18+noise(i,state.seed)*38;poly([[x,y-h],[x-11,y-9],[x-5,y-9],[x-15,y],[x+15,y],[x+5,y-9],[x+11,y-9]]);}
    }
    ctx.restore();
    if(state.terrain.themeId==='alpine'){ctx.fillStyle='#effaff99';for(let i=0;i<35;i++){const x=(noise(i,state.seed)*1450+Math.sin(now*.35+i)*14)%1450,y=(noise(i,77)*740+now*(8+noise(i,17)*12))%740;ctx.beginPath();ctx.arc(x,y,.8+noise(i,4)*1.3,0,Math.PI*2);ctx.fill();}}
    if(ctx!==destination){ctx=destination;skyKey=key;ctx.drawImage(skyCache,0,0);}
    return true;
  }
  return {sky,ground};
}
