import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createTabletopServer} from '../server/index.mjs';
const require=createRequire(process.env.PLAYWRIGHT_MODULE_PATH||import.meta.url),{chromium}=require('playwright');
await mkdir('_qa/steel-biomes-online',{recursive:true});
const app=await createTabletopServer({dataDir:await mkdtemp('_qa/steel-biomes-online/data-')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${app.server.address().port}`,errors=[];let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1440,height:900}});
  for(const p of [a,b]){
    p.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
    await p.route('**/renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('function setFrame(frame){','function setFrame(frame){window.__qaFrame=frame;')});});
  }
  await a.goto(base+'/games/steel-arc/online.html');await a.locator('#name').fill('地貌测试 A');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});const code=(await a.locator('#room-code').textContent()).trim();
  await b.goto(base+'/games/steel-arc/online.html?room='+code);await b.locator('#name').fill('地貌测试 B');await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});await b.locator('#ready').click();await a.locator('#start').click();
  for(const p of [a,b]){await p.bringToFront();await p.getByRole('button',{name:'开始打靶',exact:true}).click();}
  await a.bringToFront();await a.screenshot({path:'_qa/steel-biomes-online/calibration.png'});await a.locator('#fire').click();
  await b.bringToFront();await b.waitForFunction(()=>!document.querySelector('#fire').disabled);await b.locator('#fire').click();
  for(const p of [a,b]){await p.bringToFront();await p.getByRole('button',{name:'开始决斗',exact:true}).waitFor({timeout:25000});await p.waitForTimeout(1200);await p.getByRole('button',{name:'开始决斗',exact:true}).click();}
  let first;
  await Promise.race([a.waitForFunction(()=>!document.querySelector('#fire').disabled).then(()=>first=a),b.waitForFunction(()=>!document.querySelector('#fire').disabled).then(()=>first=b)]);
  async function checkMovement(p){
    await p.bringToFront();const slot=p===b?'B1':'A1',sign=p===b?-1:1;
    const read=()=>p.evaluate(id=>window.__qaFrame.state.tanks[id].x,slot);
    assert.equal(await p.evaluate(id=>window.__qaFrame.state.tanks[id].maxFuel,slot),400);
    const x=await read();await p.keyboard.down('KeyD');await p.waitForTimeout(600);await p.keyboard.up('KeyD');const right=await read();assert.ok((right-x)*sign>5,slot+' D moves screen right');
    await p.keyboard.down('KeyA');await p.waitForTimeout(700);await p.keyboard.up('KeyA');const left=await read();assert.ok((left-right)*sign< -5,slot+' A moves screen left');await p.waitForTimeout(300);
  }
  const second=first===a?b:a;await checkMovement(first);await first.locator('#fire').click();
  await second.bringToFront();await second.waitForFunction(()=>!document.querySelector('#fire').disabled,{},{timeout:20000});await checkMovement(second);await second.locator('#fire').click();
  await first.waitForFunction(()=>!document.querySelector('#fire').disabled,{},{timeout:20000});
  for(const [p,id] of [[a,'A'],[b,'B']])await p.screenshot({path:`_qa/steel-biomes-online/${id}.png`});
  const stored=await app.stores.steelArc.get(code,Date.now());assert.ok(stored.room.engine.terrain.themeId);assert.ok(stored.room.engine.completedTurns>=2);assert.deepEqual(errors,[]);
  const result={theme:stored.room.engine.terrain.themeId,calibration:true,bothShots:true,completedTurns:stored.room.engine.completedTurns,errors};await writeFile('_qa/steel-biomes-online/report.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser?.close();await new Promise(r=>app.server.close(r));}
