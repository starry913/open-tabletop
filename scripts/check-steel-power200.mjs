import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createTabletopServer} from '../server/index.mjs';
import {MAX_POWER} from '../games/steel-arc/web/aim-limits.js';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH||import.meta.url),{chromium}=require('playwright');
await mkdir('_qa/steel-power200',{recursive:true});
const app=await createTabletopServer({dataDir:await mkdtemp('_qa/steel-power200/data-')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 // Read-only observation in the test-served renderer, never shipped to players.
 await p.route('**/renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('function setFrame(frame){','function setFrame(frame){window.__qaFrame=frame;')});});
 await p.goto(`http://127.0.0.1:${app.server.address().port}/games/steel-arc/`);await p.locator('#battle-map').selectOption('alpine');await p.locator('[data-action="practice"]').click();await p.waitForFunction(()=>!document.querySelector('#fire-button').disabled);
 const initial=await p.evaluate(()=>{const s=window.__qaFrame.state;return {x:s.tanks.enemy.x,width:s.terrain.width,left:s.tanks.player.x};});assert.ok(initial.left<84&&initial.width-initial.x<84);
 await p.keyboard.down('KeyE');await p.waitForFunction(max=>document.querySelector('#power-value').textContent===String(max),MAX_POWER,{timeout:12000});await p.keyboard.up('KeyE');
 await p.getByRole('button',{name:'力度减一',exact:true}).click();assert.equal(await p.locator('#power-value').textContent(),String(MAX_POWER-1));await p.getByRole('button',{name:'力度加一',exact:true}).click();assert.equal(await p.locator('#power-value').textContent(),String(MAX_POWER));assert.ok(await p.getByRole('button',{name:'力度加一',exact:true}).isDisabled());
 for(let shot=0;shot<2;shot++){
  await p.locator('#fire-button').click();await p.waitForFunction(()=>window.__qaFrame.projectiles?.some(p=>p.alive));
  const velocity=await p.evaluate(()=>{const s=window.__qaFrame.projectiles.find(p=>p.alive);return Math.abs(s.vx);});assert.ok(Math.abs(velocity-(300+5*MAX_POWER)*Math.SQRT1_2)<1);
  await p.waitForFunction(()=>!document.querySelector('#fire-button').disabled,{},{timeout:25000});assert.equal(await p.evaluate(()=>window.__qaFrame.state.tanks.enemy.x),initial.x);
 }
 await p.waitForTimeout(2000);await p.screenshot({path:'_qa/steel-power200/alpine.png'});assert.deepEqual(errors,[]);
 const report={power:MAX_POWER,edgeSpawns:initial,targetRespawnStable:true,shots:2,errors};await writeFile('_qa/steel-power200/report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser?.close();await new Promise(r=>app.server.close(r));}
