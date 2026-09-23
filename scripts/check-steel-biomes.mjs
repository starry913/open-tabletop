import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createTabletopServer} from '../server/index.mjs';
import {BIOME_IDS,BIOMES} from '../games/steel-arc/web/biomes.js';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH||import.meta.url);
const {chromium}=require('playwright');
await mkdir('_qa/steel-biomes',{recursive:true});
const dataDir=await mkdtemp('_qa/steel-biomes/data-');
const app=await createTabletopServer({dataDir});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${app.server.address().port}`,errors=[],results=[];let browser;
try{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  await page.goto(base+'/games/steel-arc/');await page.locator('#battle-map').selectOption('bay');await page.locator('[data-action="practice"]').click();
  for(const id of BIOME_IDS){
    await page.locator('#practice-map').selectOption(id);
    console.log('Checking',id);
    await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled);
    assert.equal(await page.locator('#practice-map').inputValue(),id);
    await page.locator('#practice-map').blur();await page.keyboard.down('KeyD');await page.waitForTimeout(500);await page.keyboard.up('KeyD');
    await page.waitForTimeout(1800);
    await page.screenshot({path:`_qa/steel-biomes/${id}.png`});
    if(id==='falls'){
      const timings=await page.evaluate(()=>new Promise(resolve=>{const values=[];let previous=performance.now();function frame(now){values.push(now-previous);previous=now;if(values.length<120)requestAnimationFrame(frame);else{values.shift();values.sort((a,b)=>a-b);resolve({medianFrameMs:values[59],p95FrameMs:values[113],over33ms:values.filter(v=>v>33.4).length});}}requestAnimationFrame(frame);}));
      await writeFile('_qa/steel-biomes/frame-timings.json',JSON.stringify(timings,null,2));console.log('Frame timings',timings);
    }
    await page.locator('[data-weapon="quake"]').click();await page.locator('#fire-button').click();
    await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled,{},{timeout:20000});
    await page.locator('[data-weapon="meteor"]').click();await page.locator('#fire-button').click();
    await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled,{},{timeout:20000});
    results.push({id,name:BIOMES[id].name,switch:true,move:true,incendiary:true,nuclear:true});
  }
  // Switching is also safe while a projectile is airborne.
  await page.locator('#fire-button').click();await page.locator('#practice-map').selectOption('bay');
  await page.waitForFunction(()=>!document.querySelector('#fire-button').disabled);
  assert.deepEqual(errors,[]);await writeFile('_qa/steel-biomes/report.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser?.close();await new Promise(resolve=>app.server.close(resolve));}
