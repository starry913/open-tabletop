import {biomeFor,materialAt,MATERIALS} from './biomes.js';

// Canvas-only terrain. Cached chunks are cosmetic: collision always samples
// the authoritative height field. Content hashes also handle network snapshots
// that clone the terrain object on every poll, and in-place crater deformation.
export function createTerrainArt(ctx,heightAt){
  const chunks=new Map(),SIZE=512,SCALE=1.5,HEIGHT=920,PAD=40;
  let identity='';
  const noise=(i,s)=>{let n=Math.imul(i^(s||1),1597334677);n^=n>>>15;return(n>>>0)/4294967295;};
  const polygon=(c,p)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
  function signature(t,left,right){
    let hash=2166136261;
    for(let i=Math.max(0,Math.floor((left-PAD)/t.step));i<=Math.min(t.points.length-1,Math.ceil((right+PAD)/t.step));i++)hash=Math.imul(hash^Math.round(t.points[i]*1024),16777619);
    return hash;
  }
  function terrainPath(c,t,left,right){
    c.beginPath();c.moveTo(left,HEIGHT);c.lineTo(left,heightAt(t,left));
    for(let x=left;x<=right;x+=t.step)c.lineTo(x,heightAt(t,x));
    c.lineTo(right,HEIGHT);c.closePath();
  }
  function build(c,state,left,right){
    const t=state.terrain,theme=biomeFor(t),seed=state.seed;
    if(t.themeId==='range'){
      const dust=(i,s)=>{let n=Math.imul(i^s,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return((n^(n>>>16))>>>0)/4294967295;};
      c.save();terrainPath(c,t,left,right);c.clip();
      const g=c.createLinearGradient(0,510,0,840);g.addColorStop(0,'#e1bf8b');g.addColorStop(.3,'#b3916c');g.addColorStop(.7,'#706251');g.addColorStop(1,'#333940');c.fillStyle=g;c.fillRect(left,0,right-left,HEIGHT);
      for(let layer=0;layer<7;layer++){
        c.beginPath();for(let x=left;x<=right;x+=6){const y=heightAt(t,x)+12+layer*24+Math.sin(x*.018+layer*3)*5;x===left?c.moveTo(x,y):c.lineTo(x,y);}
        c.strokeStyle=layer%2?'#f9deb22a':'#6a503932';c.lineWidth=3+layer;c.stroke();
      }
      for(let i=0;i<(right-left)*2;i++){
        const x=left+dust(i,seed+21)*(right-left),d=dust(i,seed+53)*230,y=heightAt(t,x)+d;
        c.fillStyle=i%3?'#ffe3ae38':'#54453440';c.fillRect(x,y,1+noise(i,17)*3,1);
        if(i%23===0){const s=3+noise(i,seed+9)*13;c.beginPath();c.ellipse(x,y,s,s*.55,noise(i,31),0,Math.PI*2);c.fillStyle=i%2?'#bca889':'#8e8069';c.fill();c.beginPath();c.ellipse(x-1,y-2,s*.8,s*.3,0,Math.PI,Math.PI*2);c.strokeStyle='#ebd4aa88';c.lineWidth=1;c.stroke();}
      }
      c.restore();c.beginPath();for(let x=left;x<=right;x+=2){const y=heightAt(t,x);x===left?c.moveTo(x,y):c.lineTo(x,y);}c.strokeStyle='#ffe6b0';c.lineWidth=2;c.stroke();
      return;
    }
    c.save();terrainPath(c,t,left,right);c.clip();
    const bed=c.createLinearGradient(0,220,0,820);bed.addColorStop(0,theme.ground[0]);bed.addColorStop(.65,theme.ground[1]);bed.addColorStop(1,'#333940');c.fillStyle=bed;c.fillRect(left,0,right-left,HEIGHT);
    // Interlocking, irregular rock faces. Shared jittered vertices prevent the
    // old repeated diamond texture and vertical striping. Upper-left facets
    // catch the light; deep rock is quieter than the playable surface.
    const vertex=(col,row)=>{
      const id=col*7907+row*131;
      return [col*29+(noise(id,seed)-.5)*21,row*25+(noise(id+93,seed)-.5)*18+Math.sin(col*.36)*10];
    };
    for(let row=0;row<Math.ceil(HEIGHT/25);row++)for(let col=Math.floor(left/29)-1;col<=Math.ceil(right/29);col++){
      const p=[vertex(col,row),vertex(col+1,row),vertex(col+1,row+1),vertex(col,row+1)];
      const x=col*29,y=row*25,depth=y-heightAt(t,x);if(depth< -55)continue;
      const id=col*113+row*3187,n=noise(id,seed),fade=Math.max(.16,1-Math.max(0,depth)/420);
      const shade=Math.round(118+n*35),snow=t.themeId==='alpine',warm=['falls','bay'].includes(t.themeId);
      const stone=c.createLinearGradient(x-9,y-12,x+21,y+29);
      stone.addColorStop(0,`rgba(${shade+22},${shade+22},${shade+(snow?31:12)},${fade})`);
      stone.addColorStop(.45,`rgba(${shade+(warm?8:0)},${shade+3},${shade+(snow?12:-8)},${fade})`);
      stone.addColorStop(1,`rgba(${shade-28},${shade-25},${shade-25},${fade})`);
      c.fillStyle=stone;
      polygon(c,p);c.fill();c.strokeStyle=`rgba(43,46,39,${fade*.38})`;c.lineWidth=.7;c.stroke();
      const center=[(p[0][0]+p[2][0])/2,(p[0][1]+p[2][1])/2];
      // Shallow fissures and mineral seams, not triangular low-poly faces.
      for(let seam=0;seam<3;seam++){
        const sy=center[1]-8+seam*6,sx=center[0]-9+noise(id+seam,seed)*5;
        c.beginPath();c.moveTo(sx,sy+2);c.lineTo(sx+5,sy);c.lineTo(sx+13,sy+2);c.strokeStyle=seam%2?'#f1ebd528':'#292f3428';c.lineWidth=.6;c.stroke();
      }
      c.beginPath();c.moveTo(p[0][0]+1,p[0][1]+1);c.lineTo(p[1][0]-1,p[1][1]+1);c.strokeStyle=`rgba(244,239,212,${fade*.34})`;c.lineWidth=.7;c.stroke();
      if(n>.65){c.beginPath();c.moveTo(...center);c.lineTo(center[0]+5,center[1]+7);c.lineTo(...p[2]);c.strokeStyle='#26313755';c.stroke();}
    }
    // Surface deposits follow the contour, never fill a vertical region column.
    const regions=t.calibrationSurface?[{from:-t.width,to:t.width*2,material:'rock'}]:t.regions.map((r,i)=>({...r,from:i===0?-t.width:r.from,to:i===t.regions.length-1?t.width*2:r.to}));
    for(const r of regions){
      const start=Math.max(left,r.from-16),end=Math.min(right,r.to+16);if(start>=end)continue;
      const material=r.material,water=MATERIALS[material].water;
      const depths={sand:34,shallow:13,deep:7,snow:15,ice:25,gravel:15,rock:5,canyon:0};
      const colors={sand:'#d9b675',shallow:'#b3a784',deep:'#536d71',snow:'#e3edf0',ice:'#83b8cb',gravel:'#9c9d91',rock:'#7d8465',canyon:'#425357'};
      c.beginPath();c.moveTo(start,heightAt(t,start));
      for(let x=start;x<=end;x+=2)c.lineTo(x,heightAt(t,x));
      for(let x=end;x>=start;x-=2){
        const edge=Math.min(1,Math.max(0,Math.min(x-r.from+16,r.to+16-x)/32));
        const depth=depths[material]*edge*(.8+.22*Math.sin(x*.041)+.13*Math.sin(x*.117));
        c.lineTo(x,heightAt(t,x)+depth);
      }
      c.closePath();c.fillStyle=colors[material];c.fill();
      // Granular deposits and tiny stones merge the cap into its rock substrate.
      for(let x=Math.ceil(start/5)*5;x<end;x+=5){
        const n=noise(x|0,seed),y=heightAt(t,x);
        if(n>.25){c.fillStyle=material==='snow'?'#ffffff85':material==='ice'?'#dcf8ff66':n>.6?'#fff0bb50':'#30373540';c.fillRect(x,y+2+n*depths[material],1+n*2,.7+n);}
        if(['rock','gravel','shallow'].includes(material)&&n>.47){
          const size=1+n*4;polygon(c,[[x-size,y+3],[x-1,y+1],[x+size,y+2],[x+size*.7,y+5]]);c.fillStyle=n>.75?'#d4d1b5':'#656e68';c.fill();
        }
        if(material==='ice'&&n>.9){c.beginPath();c.moveTo(x,y+3);c.lineTo(x+11,y+12);c.lineTo(x+8,y+19);c.strokeStyle='#dcfaff80';c.lineWidth=.65;c.stroke();}
      }
      if(!water){
        c.beginPath();for(let x=start;x<=end;x+=2){const y=heightAt(t,x)+.8;x===start?c.moveTo(x,y):c.lineTo(x,y);}
        c.strokeStyle=material==='snow'?'#fffdf1':material==='sand'?'#f8d89b':material==='ice'?'#ceecf0':'#bec3a4';c.lineWidth=1.3;c.stroke();
      }
    }
    // Fine grain is baked once, not regenerated each animation frame.
    for(let i=0;i<(right-left)*6;i++){
      const x=left+noise(i,seed+71)*(right-left),y=noise(i,seed+89)*HEIGHT;
      c.fillStyle=i%2?'#fff8df18':'#14243220';c.fillRect(x,y,.65+noise(i,61),.65);
    }
    const deepFade=c.createLinearGradient(0,730,0,HEIGHT);deepFade.addColorStop(0,'#33394000');deepFade.addColorStop(1,'#333940');c.fillStyle=deepFade;c.fillRect(left,730,right-left,HEIGHT-730);
    c.restore();
    // Sparse ground cover hugs the real edge. No tall fake collision silhouette.
    for(let x=Math.ceil(left/13)*13;x<right;x+=13){
      const m=materialAt(t,x),n=noise(x,seed);if(m.water||m.blocked||m.snow||m===MATERIALS.gravel||n<.5)continue;
      const y=heightAt(t,x);c.strokeStyle=m===MATERIALS.sand?'#9a987061':'#6d8054ae';c.lineWidth=.9;c.beginPath();
      c.moveTo(x-3,y+1);c.quadraticCurveTo(x-2,y-5-n*2,x-5,y-6);c.moveTo(x,y+1);c.quadraticCurveTo(x+1,y-5,x+4,y-3);c.stroke();
    }
  }
  function waterAndFalls(state){
    const t=state.terrain;if(t.calibrationSurface)return;
    const now=performance.now()*.001;
    for(const r of t.regions){
      const m=MATERIALS[r.material];
      if(m.water){
        ctx.save();ctx.beginPath();ctx.moveTo(r.from,r.level);ctx.lineTo(r.to,r.level);
        for(let x=r.to;x>=r.from;x-=t.step)ctx.lineTo(x,Math.max(r.level,heightAt(t,x)));ctx.closePath();ctx.clip();
        const g=ctx.createLinearGradient(0,r.level,0,r.level+(m.blocked?140:40));g.addColorStop(0,m.blocked?'#369fbaa0':'#48d5d5c4');g.addColorStop(1,m.blocked?'#17394ce6':'#218eab9e');ctx.fillStyle=g;ctx.fillRect(r.from,r.level,r.to-r.from,HEIGHT-r.level);
        ctx.strokeStyle='#eaffef9c';ctx.lineWidth=.7;ctx.beginPath();
        for(let x=r.from;x<r.to;x+=22){const drift=Math.sin(now*.7+x)*3,y=r.level+1.5+noise(x|0,17)*7;ctx.moveTo(x+drift,y);ctx.lineTo(x+9+drift,y);}
        ctx.stroke();ctx.restore();
        ctx.beginPath();ctx.moveTo(r.from,r.level);ctx.lineTo(r.to,r.level);ctx.strokeStyle='#c6f5eac0';ctx.lineWidth=1;ctx.stroke();
      }
      if(m.blocked)for(const x of [r.from-42,r.to+42]){
        const y=heightAt(t,x);ctx.strokeStyle='#ffe8b4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-25);ctx.stroke();polygon(ctx,[[x,y-26],[x+12,y-22],[x,y-18]]);ctx.fillStyle='#e7ab65';ctx.fill();
      }
    }
    for(const f of t.waterfalls||[]){
      const top=Math.max(f.level,heightAt(t,f.x)-2),bottom=f.bottom;if(top>=bottom)continue;
      const g=ctx.createLinearGradient(f.x-f.width,0,f.x+f.width,0);g.addColorStop(0,'#c0e5e500');g.addColorStop(.5,'#ebffffcd');g.addColorStop(1,'#b8e4ec00');ctx.fillStyle=g;ctx.fillRect(f.x-f.width,top,f.width*2,bottom-top);
      ctx.strokeStyle='#e8ffff90';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<9;i++){const y=top+(now*92+i*31)%(bottom-top),x=f.x+(noise(i,13)-.5)*f.width;ctx.moveTo(x,y);ctx.lineTo(x,Math.min(bottom,y+19));}ctx.stroke();
    }
  }
  function ground(state){
    const t=state.terrain,theme=biomeFor(t);if(!theme)return false;
    const key=`${state.seed}:${t.themeId}:${t.width}:${!!t.calibrationSurface}:${JSON.stringify(t.regions)}`;
    if(identity!==key){for(const chunk of chunks.values()){chunk.bitmap?.close();chunk.overview?.close?.();}chunks.clear();identity=key;}
    const matrix=ctx.getTransform?.(),valid=Number.isFinite(matrix?.a)&&matrix.a!==0&&ctx.canvas?.width;
    const visibleLeft=valid?Math.min(-matrix.e/matrix.a,(ctx.canvas.width-matrix.e)/matrix.a):-Infinity;
    const visibleRight=valid?Math.max(-matrix.e/matrix.a,(ctx.canvas.width-matrix.e)/matrix.a):Infinity;
    // Extend only below the playable edge, for wide/zoomed-out cameras.
    ctx.fillStyle='#333940';ctx.fillRect(-t.width,HEIGHT,t.width*3,4000);
    const first=valid?Math.floor(Math.min(0,visibleLeft)/SIZE)*SIZE:-SIZE*2;
    const last=valid?Math.max(t.width,visibleRight):t.width+SIZE*2;
    for(let left=first;left<last;left+=SIZE){
      if(left+SIZE<visibleLeft||left>visibleRight)continue;
      const right=left+SIZE,hash=signature(t,left,right)^Math.round(t.points[0]*1024)^Math.round(t.points.at(-1)*1024);let chunk=chunks.get(left);
      if(typeof OffscreenCanvas==='undefined'){build(ctx,state,left,right);continue;}
      if(!chunk||chunk.hash!==hash){
        const surface=chunk?.surface||new OffscreenCanvas(Math.ceil((right-left)*SCALE),HEIGHT*SCALE),c=surface.getContext('2d');
        c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,surface.width,surface.height);c.setTransform(SCALE,0,0,SCALE,-left*SCALE,0);build(c,state,left-PAD,right+PAD);
        chunk?.bitmap?.close();chunk?.overview?.close?.();
        const bitmap=surface.transferToImageBitmap?.();
        chunk={surface,bitmap,hash};chunks.set(left,chunk);
      }
      const top=valid&&matrix.d>0?Math.max(0,-matrix.f/matrix.d):0;
      const bottom=valid&&matrix.d>0?Math.min(HEIGHT,(ctx.canvas.height-matrix.f)/matrix.d):HEIGHT;
      // Overview frames used to resample many full-resolution rock textures
      // every frame. Bake a matching mip once; close movement keeps full detail.
      const overview=valid&&Math.abs(matrix.a)<=.65;
      if(overview&&!chunk.overview){
        const small=new OffscreenCanvas(SIZE/2,HEIGHT/2),c=small.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
        c.drawImage(chunk.bitmap||chunk.surface,0,0,small.width,small.height);
        chunk.overview=small.transferToImageBitmap?.()||small;
      }
      const source=overview?chunk.overview:chunk.bitmap||chunk.surface,scale=overview?0.5:SCALE;
      if(bottom>top)ctx.drawImage(source,0,top*scale,(right-left)*scale,(bottom-top)*scale,left,top,right-left,bottom-top);
    }
    waterAndFalls(state);return true;
  }
  return {ground};
}
