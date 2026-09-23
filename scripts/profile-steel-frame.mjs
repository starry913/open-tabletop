import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {createTabletopServer} from '../server/index.mjs';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH||import.meta.url),{chromium}=require('playwright');
await mkdir('_qa/steel-frame',{recursive:true});
const app=await createTabletopServer({dataDir:await mkdtemp('_qa/steel-frame/data-')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
let browser;const results=[];
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${app.server.address().port}/games/steel-arc/`);
 await page.locator('#battle-map').selectOption('falls');await page.locator('[data-action="practice"]').click();await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled);await page.waitForTimeout(1500);
 async function sample(label){
  const result=await page.evaluate(()=>new Promise(resolve=>{let last;const dt=[];function frame(now){if(last!==undefined)dt.push(now-last);last=now;if(dt.length<120)requestAnimationFrame(frame);else{dt.sort((a,b)=>a-b);const c=document.querySelector('#game');resolve({median:dt[60],p95:dt[114],over50:dt.filter(v=>v>50).length,canvas:[c.width,c.height]});}}requestAnimationFrame(frame);}));
  results.push({label,...result});console.log(results.at(-1));
 }
 await sample('idle');
 if(process.argv.includes('--stress')){
  for(const id of ['falls','bay','river','canyon','alpine','ice']){
   await page.locator('#practice-map').selectOption(id);await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled);await page.waitForTimeout(1200);
   await page.locator('#practice-map').blur();await page.keyboard.down('KeyD');await sample(`${id}:moving`);await page.keyboard.up('KeyD');
   await page.locator('[data-weapon="meteor"]').click();await page.locator('#fire-button').click();await sample(`${id}:shot`);
   await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled,{},{timeout:25000});
   await page.screenshot({path:`_qa/steel-frame/${id}.png`});
  }
 }
 if(process.argv.includes('--ablate')){
  await page.evaluate(()=>{const c=document.querySelector('#game');c.width=1280;c.height=720;window.dispatchEvent(new Event('resize'));});
  await page.evaluate(()=>{Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});window.dispatchEvent(new Event('resize'));});await sample('DPR1');
  await page.addStyleTag({content:'*{backdrop-filter:none!important;filter:none!important;box-shadow:none!important}'});await sample('no-css-effects');
  await page.evaluate(()=>{const proto=CanvasRenderingContext2D.prototype;proto._fillRect=proto.fillRect;proto.fillRect=function(...a){if(a[2]===1280&&a[3]===720)return;return this._fillRect(...a);};});await sample('no-fullscreen-gradients');
 }
 await page.screenshot({path:`_qa/steel-frame/${process.argv.includes('--ablate')?'diagnostic':'game'}.png`});
 await writeFile(`_qa/steel-frame/${process.argv.includes('--ablate')?'before':process.argv.includes('--stress')?'after-stress':'after'}.json`,JSON.stringify({results,errors},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser?.close();await new Promise(r=>app.server.close(r));}
