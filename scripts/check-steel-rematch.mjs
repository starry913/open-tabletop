import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createTabletopServer} from '../server/index.mjs';
import {DEFAULT_NICKNAMES} from '../games/steel-arc/web/nicknames.js';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH||import.meta.url),{chromium}=require('playwright');
await mkdir('_qa/steel-rematch',{recursive:true});const app=await createTabletopServer({dataDir:await mkdtemp('_qa/steel-rematch/data-')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const a=await browser.newPage(),b=await browser.newPage(),errors=[];const base=`http://127.0.0.1:${app.server.address().port}/games/steel-arc/online.html`;
 for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 await a.goto(base);assert.ok(DEFAULT_NICKNAMES.includes(await a.locator('#name').inputValue()));await a.locator('#name').fill('房主测试');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});const code=(await a.locator('#room-code').textContent()).trim();
 await b.goto(base+'?room='+code);assert.ok(DEFAULT_NICKNAMES.includes(await b.locator('#name').inputValue()));await b.locator('#name').fill('客人测试');await b.locator('#join').click();await b.locator('#ready').click();await a.locator('#start').click();
 let previousDistance;
 for(let round=0;round<2;round++){
   const current=await app.stores.steelArc.get(code,Date.now());const distance=current.room.engine.calibration.distance;if(previousDistance!==undefined)assert.ok(Math.abs(distance-previousDistance)>=300);previousDistance=distance;
   for(const p of [a,b]){await p.bringToFront();await p.getByRole('button',{name:'开始打靶',exact:true}).click();}
   await a.bringToFront();await a.locator('#battle-leave').click();await a.locator('#surrender').click();
   await a.locator('#result').waitFor({state:'visible'});assert.equal(await a.locator('#winner').textContent(),'B 队胜利');
   await b.bringToFront();await b.locator('#result-rematch').click();assert.ok(await b.locator('#result-start').isHidden());
   await a.bringToFront();assert.ok(await a.locator('#result-start').isDisabled());await a.locator('#result-rematch').click();await a.waitForFunction(()=>!document.querySelector('#result-start').disabled);await a.locator('#result-start').click();
   await a.getByRole('button',{name:'开始打靶',exact:true}).waitFor();
 }
 const stored=await app.stores.steelArc.get(code,Date.now());assert.equal(stored.room.engine.phase,'calibration');assert.deepEqual(stored.room.engine.calibration.shots,{});assert.deepEqual(errors,[]);console.log({nicknamePool:true,surrender:true,rematches:2,restartsWithCalibration:true,errors});
}finally{await browser?.close();await new Promise(r=>app.server.close(r));}
