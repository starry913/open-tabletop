import {createRequire} from 'node:module';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createTabletopServer} from '../server/index.mjs';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH||import.meta.url);
const {chromium}=require('playwright');
const folder='_qa/steel-terrain';await mkdir(folder,{recursive:true});
const app=await createTabletopServer({dataDir:await mkdtemp(folder+'/data-')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 await page.goto(`http://127.0.0.1:${app.server.address().port}/games/steel-arc/`);
 const result=await page.evaluate(async()=>{
  const {createMatch,terrainHeightAt,deformTerrain}=await import('./engine.js');
  const {createBiomePainter}=await import('./biome-renderer.js');
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext('2d'),painter=createBiomePainter(ctx,terrainHeightAt);
  const state=createMatch({seed:42,themeId:'falls'});ctx.scale(.6,.6);
  const times=[];for(let i=0;i<100;i++){const start=performance.now();painter.ground(state,0);times.push(performance.now()-start);}
  const start=performance.now();deformTerrain(state.terrain,{x:state.terrain.landmarks[0].x,y:400,radius:80});painter.ground(state,0);
  const rebuild=performance.now()-start;times.sort((a,b)=>a-b);
  return {medianMs:times[50],p95Ms:times[95],rebuildMs:rebuild};
 });
 await writeFile(`${folder}/${process.argv[2]||'performance'}.json`,JSON.stringify(result,null,2));console.log(result);
 if(['final','frames'].includes(process.argv[2])){
  await page.locator('#battle-map').selectOption('falls');await page.locator('[data-action="practice"]').click();
  await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled);await page.waitForTimeout(2000);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const frames=await page.evaluate(()=>new Promise(resolve=>{let last=performance.now();const times=[];function frame(now){times.push(now-last);last=now;if(times.length<180)requestAnimationFrame(frame);else{times.shift();times.sort((a,b)=>a-b);resolve({medianFrameMs:times[89],p95FrameMs:times[170],over33ms:times.filter(v=>v>33.4).length});}}requestAnimationFrame(frame);}));
  const {profile}=await cdp.send('Profiler.stop');const counts=new Map();for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
  console.log('CPU samples',profile.nodes.map(n=>({name:n.callFrame.functionName,count:counts.get(n.id)||0})).sort((a,b)=>b.count-a.count).slice(0,12));
  console.log('Actual game',frames);await writeFile(`${folder}/frames-final.json`,JSON.stringify(frames,null,2));
  for(const id of process.argv[2]==='frames'?['falls']:['falls','bay','river','canyon','alpine','ice']){
   await page.locator('#practice-map').selectOption(id);await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled);await page.waitForTimeout(2300);await page.screenshot({path:`${folder}/${id}-final.png`});
  }
 }
}finally{await browser?.close();await new Promise(r=>app.server.close(r));}
