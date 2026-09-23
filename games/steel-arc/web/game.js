import {MIN_POWER,MAX_POWER,POWER_SPAN} from './aim-limits.js';
import {BASE_MOVE_SPEED} from './motion-config.js';
import {BIOMES,BIOME_IDS,biomeFor,materialAt} from './biomes.js';
import {rangeScore} from './tidal-range.js';
import {BattleCamera} from './camera.js';
import {createTutorial} from './tutorial.js';
import {AI_LEVELS,normalizeDifficulty} from './engine.js';
import {createBattleRenderer} from './renderer.js';
import {stepTankControls} from './controls.js';
import {WORLD_WIDTH,WORLD_HEIGHT,GRAVITY,WEAPONS,WEAPON_IDS,createMatch,seededRandom,terrainHeightAt,setAim,moveTank,selectWeapon,createProjectile,stepProjectile,splitHiveProjectile,resolveExplosion,fireWeapon,finishTurn,chooseAiAction,isWeaponAvailable,consumeEvents,stepSupplyDrops,hasFallingSupply,settleSupplies} from './engine.js';
import {audio} from './audio.js';
import {mapAimPointer} from './aim-control.js';
import {createFineAimControls} from './aim-fine-controls.js';
import {renderSize} from './render-budget.js';

const VIEW_WIDTH=1280,VIEW_HEIGHT=720,WORLD_ZOOM=.88,WORLD_VIEW_WIDTH=VIEW_WIDTH/WORLD_ZOOM;
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
const $=selector=>document.querySelector(selector);
const hud=$('#battle-hud'),aimPanel=$('#aim-panel'),deck=$('#command-deck'),overlay=$('#overlay'),menu=$('#menu');
const announcer=$('#announcer'),callout=$('#status-callout');
const weaponRack=$('#weapon-rack'),fireButton=$('#fire-button'),pauseButton=$('#pause-button');
const aimControl=$('#aim-control'),aimKnob=$('#aim-knob'),aimPullVector=$('#aim-pull-vector'),aimShotVector=$('#aim-shot-vector');
const ui={playerHp:$('#player-hp'),enemyHp:$('#enemy-hp'),playerHpText:$('#player-hp-text'),enemyHpText:$('#enemy-hp-text'),enemyName:$('#enemy-name'),round:$('#round-label'),turn:$('#turn-label'),angle:$('#angle-value'),power:$('#power-value'),fuel:$('#fuel-value'),fuelBar:$('#fuel-bar'),fireState:$('#fire-state')};
const keys=new Set();
let mode='title',menuIndex=0,returnMode='title',state=createMatch({seed:7126}),rng=seededRandom(7126),practiceMode=false;
let projectiles=[],particles=[],shockwaves=[],damageLabels=[],lastTime=performance.now(),accumulator=0,settleAt=0,aiPlan=null,aiAimStart=0,calloutTimer=0,shake=0,moveSoundAt=0,introAt=0;
let cameraX=0,renderScale=1;
let practiceBaseline=null,practiceNextAt=0;
const battleCamera=new BattleCamera();
const mapLabel=document.createElement('label');mapLabel.className='difficulty-setting';mapLabel.textContent='战场 ';
const mapSelect=document.createElement('select');mapSelect.id='battle-map';mapSelect.setAttribute('aria-label','选择战场');mapSelect.add(new Option('随机战场','random'));for(const [id,theme] of Object.entries(BIOMES))mapSelect.add(new Option(theme.name+' · '+(theme.practiceOnly?'仅训练':theme.time),id));mapLabel.append(mapSelect);menu.before(mapLabel);
mapSelect.onchange=()=>drawMenu(mode);
const practiceLabel=document.createElement('div');practiceLabel.className='practice-map-switch';practiceLabel.textContent='训练营 ';
const practiceSelect=document.createElement('select');practiceSelect.id='practice-map';practiceSelect.setAttribute('aria-label','训练营切换地图');for(const [id,theme] of Object.entries(BIOMES))practiceSelect.add(new Option(theme.name,id));practiceLabel.append(practiceSelect);document.querySelector('.solo-battle-tools').append(practiceLabel);practiceLabel.hidden=true;
practiceSelect.onchange=()=>{keys.clear();startGame(true,practiceSelect.value);};
const practiceTools=document.createElement('div');practiceTools.className='practice-actions';practiceTools.innerHTML='<button id="practice-reset" type="button">重置靶场</button><button id="practice-new" type="button">换个距离</button><label><input id="practice-auto" type="checkbox">每发换位</label>';practiceLabel.append(practiceTools);
$('#practice-reset').onclick=()=>{if(practiceBaseline)startGame(true,practiceSelect.value,practiceBaseline);};
$('#practice-new').onclick=()=>startGame(true,practiceSelect.value);
$('#practice-auto').onchange=()=>{if(!$('#practice-auto').checked)practiceNextAt=0;};
let difficulty=normalizeDifficulty(localStorage.getItem('steelArcDifficulty'));
const difficultyLabel=document.createElement('label');difficultyLabel.className='difficulty-setting';difficultyLabel.textContent='AI 难度 ';
const difficultySelect=document.createElement('select');difficultySelect.id='ai-difficulty';difficultySelect.setAttribute('aria-label','AI 难度');
for(const [value,level] of Object.entries(AI_LEVELS)){const option=new Option(level.label,value);difficultySelect.add(option);}difficultySelect.value=difficulty;
difficultySelect.onchange=()=>{difficulty=difficultySelect.value;localStorage.setItem('steelArcDifficulty',difficulty);};difficultyLabel.append(difficultySelect);menu.before(difficultyLabel);
const INTRO_DURATION=3600,INTRO_SCAN_END=.78;
let tutorialOpenedAt=0;
const tutorial=createTutorial({onOpen(){
  returnMode=mode;tutorialOpenedAt=performance.now();setMode('guide');aimControl.classList.remove('dragging');
},onClose(){
  keys.clear();const elapsed=performance.now()-tutorialOpenedAt;
  introAt+=elapsed;if(settleAt)settleAt+=elapsed;if(aiAimStart)aiAimStart+=elapsed;
  if(mode==='guide')setMode(returnMode);
}});
$('#battle-tutorial').onclick=()=>tutorial.open();

function resizeCanvas(){
  const {width,height,scale}=renderSize(canvas.getBoundingClientRect().width,window.devicePixelRatio);
  renderScale=scale;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}
}
window.addEventListener('resize',resizeCanvas);
resizeCanvas();

const menus={
  title:[['开始对战','start'],['练习场','practice'],['作战手册','guide'],['声音：开启','sound'],['返回游戏合集','exit']],
  paused:[['继续战斗','resume'],['重新部署','restart'],['作战手册','guide'],['声音：开启','sound'],['返回主菜单','title'],['返回游戏合集','exit']],
  ended:[['再来一局','restart'],['返回主菜单','title'],['返回游戏合集','exit']],
};

function announce(text){if(!announcer)return;announcer.textContent='';requestAnimationFrame(()=>{if(announcer)announcer.textContent=text;});}
function showCallout(text,duration=1300){if(!callout)return;callout.textContent=text;callout.classList.remove('hidden');clearTimeout(calloutTimer);calloutTimer=setTimeout(()=>{if(callout)callout.classList.add('hidden');},duration);}
function processEngineEvents(){
  for(const event of consumeEvents(state)){
    if(event.type==='fireContact'){damageLabels.push({x:event.x,y:event.y-50,text:`-${event.amount}`,life:1.2});audio.burn();}
    else if(event.type==='unlock'){showCallout(`第 ${event.tier} 档武器已开放 · 每种 2 发`,1800);audio.unlock();}
    else if(event.type==='supplyDrop'){showCallout('空投信标锁定 · 补给正在下降',1500);audio.supplyDrop();}
    else if(event.type==='supplyLanded'){showCallout('补给已落地 · 靠近自动拾取',1200);audio.supplyLand();}
    else if(event.type==='pickup'){
      const owner=event.tankId==='player'?'先锋号':'守垒者';
      showCallout(event.reward==='health'?`${owner} · 生命 +${event.amount}`:`${owner} · 获得 ${WEAPONS[event.weaponId].name} ×1`,1800);audio.pickup(event.reward);
    }else if(event.type==='supplyDestroyed'){showCallout('补给被爆炸摧毁',1000);audio.supplyBreak();}
  }
}
function syncSoundLabels(){for(const group of Object.values(menus))for(const item of group)if(item[1]==='sound')item[0]=`声音：${audio.muted?'关闭':'开启'}`;}
function drawMenu(type=mode){
  const trainingOnly=Boolean(BIOMES[mapSelect.value]?.practiceOnly);
  difficultyLabel.hidden=type==='paused'||trainingOnly;syncSoundLabels();const items=menus[type]||menus.title;menu.innerHTML=items.map(([label,action],index)=>`<button type="button" class="menu-item ${index===menuIndex?'selected':''}" role="menuitem" data-index="${index}" data-action="${action}" aria-current="${index===menuIndex?'true':'false'}">${action==='start'&&trainingOnly?'进入试射场':label}</button>`).join('');
  const overlayKicker=$('#overlay-kicker');if(overlayKicker)overlayKicker.textContent=type==='paused'?'战斗暂停':type==='ended'?(state.winner==='player'?'阵地已突破':state.winner==='enemy'?'先锋号被击毁':'双方同时失去战斗力'):'2D 回合制炮术对决';
  $('#overlay-title').innerHTML=type==='ended'?(state.winner==='player'?'<span>胜利</span>归航':state.winner==='enemy'?'<span>任务</span>失败':'<span>平局</span>停火'):'<span>钢铁</span>远征';
  const titleMeta=$('.title-lockup>p');if(titleMeta)titleMeta.textContent=type==='ended'?`造成 ${state.tanks.player.damageDone} 伤害 · 命中 ${state.tanks.player.hits} 次`:'STEEL EXPEDITION';
}

function setMode(next){
  audio.setBattle(next==='intro'||next==='playing'||next==='practice');
  mode=next;keys.clear();practiceLabel.hidden=!practiceMode||!['intro','playing','practice','paused'].includes(next);mapLabel.hidden=next==='paused';
  const showOverlay=['title','paused','ended'].includes(next);overlay.classList.toggle('hidden',!showOverlay);
  const fighting=['intro','playing','practice','paused','ended'].includes(next)||(next==='guide'&&returnMode!=='title');hud.classList.toggle('hidden',!fighting);aimPanel.classList.toggle('hidden',!fighting);deck.classList.toggle('hidden',!fighting);
  if(showOverlay){menuIndex=0;drawMenu(next);}
  if(next==='playing'||next==='practice')announce(practiceMode?'练习场：可以反复试射':state.turn==='player'?'你的回合':'守垒者回合');
}

function startGame(practice=false,chosenTheme=mapSelect.value,restore=null){
  const retainedAim=restore?{heading:state.tanks.player.heading,power:state.tanks.player.power,weapon:state.tanks.player.weapon}:null;
  practiceNextAt=0;keys.clear();practiceMode=practice;const seed=restore?.seed??((Date.now()^(Math.random()*0xffffffff))>>>0);
  const previousRangeDistance=state.terrain.rangeTarget?.distance,previousBattleWidth=state.terrain.rangeTarget?undefined:state.terrain.width;
  state=restore?structuredClone(restore):createMatch({seed,difficulty,themeId:chosenTheme==='random'?undefined:chosenTheme,previousRangeDistance,previousBattleWidth});audio.setEnvironment(state.terrain.themeId);practiceSelect.value=state.terrain.themeId;state.practice=practice;
  if(practice){const player=state.tanks.player,target=state.tanks.enemy;player.unlockedTiers=[1,2,3,4];for(const id of WEAPON_IDS)player.ammo[id]=Infinity;if(state.terrain.rangeTarget){target.x=state.terrain.rangeTarget.targetX;target.y=terrainHeightAt(state.terrain,target.x)-15;}target.spawnX=target.x;target.isTarget=true;target.name='固定靶';target.hp=100;target.maxHp=100;target.heading=180;target.angle=0;target.power=0;}
  if(practice)practiceBaseline=structuredClone(state);
  if(retainedAim)Object.assign(state.tanks.player,retainedAim);
  battleCamera.reset();renderer.resetEffects();accumulator=0;rng=seededRandom(seed^0xa51c);projectiles=[];particles=[];shockwaves=[];damageLabels=[];settleAt=0;aiPlan=null;shake=0;
  cameraX=Math.max(0,Math.min(WORLD_WIDTH-WORLD_VIEW_WIDTH,state.tanks.player.x-WORLD_VIEW_WIDTH*.32));
  cameraX=0;introAt=performance.now();setMode('intro');showCallout('战场侦察 · 视野扫描中',INTRO_DURATION);audio.confirm();updateUI();
}

function activate(action){
  audio.confirm();
  if(action==='start'){startGame(Boolean(BIOMES[mapSelect.value]?.practiceOnly));return;}
  if(action==='restart'){startGame(practiceMode,practiceMode?practiceSelect.value:mapSelect.value);return;}
  if(action==='practice'){startGame(true);return;}
  if(action==='resume'){setMode(practiceMode?'practice':'playing');return;}
  if(action==='guide'){tutorial.open();return;}
  if(action==='sound'){audio.toggle();drawMenu(mode);return;}
  if(action==='title'){setMode('title');return;}
  if(action==='exit')location.href='/';
}

function fireCurrent(){
  if(practiceNextAt)return;
  if((mode!=='playing'&&mode!=='practice')||state.turn!=='player'||state.phase!=='aim'||hasFallingSupply(state))return;
  const shots=fireWeapon(state,'player');if(!shots.length){showCallout('该弹种已经用完');return;}
  projectiles=shots.map(p=>({...p,trail:[]}));audio.fire(state.tanks.player.weapon);shake=6;showCallout(`${WEAPONS[state.tanks.player.weapon].name} · 发射`,700);announce('炮弹发射');updateUI();
}

function canControlPlayer(){
  return !practiceNextAt&&(mode==='playing'||mode==='practice')&&state.turn==='player'&&state.phase==='aim'&&!hasFallingSupply(state);
}

function attemptSelectWeapon(weaponId){
  if(!canControlPlayer()||!WEAPONS[weaponId])return false;
  if(!selectWeapon(state,'player',weaponId)){
    const weapon=WEAPONS[weaponId],locked=weapon.tier<4&&!state.tanks.player.unlockedTiers.includes(weapon.tier);
    showCallout(locked?`第 ${weapon.tier} 档将在第 ${weapon.tier===2?3:5} 回合开放`:weapon.tier===4&&state.round<3?'四档弹药已存入 · 第 3 回合可用':weapon.tier===4?'只能通过空投补给获得':'该弹种已经用完');
    return false;
  }
  audio.navigate();updateUI();return true;
}

function markMenuSelection(index){
  const items=menus[mode];if(!items||index<0||index>=items.length||index===menuIndex)return;
  menuIndex=index;audio.navigate();
  menu.querySelectorAll('.menu-item').forEach((item,itemIndex)=>{
    const selected=itemIndex===menuIndex;item.classList.toggle('selected',selected);item.setAttribute('aria-current',String(selected));
  });
}

menu.addEventListener('pointerover',event=>{
  const item=event.target.closest('.menu-item');if(item)markMenuSelection(Number(item.dataset.index));
});
menu.addEventListener('click',event=>{
  const item=event.target.closest('.menu-item');if(item)activate(item.dataset.action);
});
function updateAimFromPointer(event){
  if(!canControlPlayer())return;
  const rect=aimControl.getBoundingClientRect(),limit=rect.width*.4,rawX=event.clientX-(rect.left+rect.width/2),rawY=event.clientY-(rect.top+rect.height/2),tank=state.tanks.player;
  const mapped=mapAimPointer(rawX,rawY,limit,{heading:tank.heading,power:tank.power,precision:event.shiftKey});
  setAim(state,'player',mapped);updateUI();
}
aimControl.addEventListener('pointerdown',event=>{
  if(!canControlPlayer())return;event.preventDefault();aimControl.setPointerCapture(event.pointerId);aimControl.classList.add('dragging');updateAimFromPointer(event);
});
aimControl.addEventListener('pointermove',event=>{if(aimControl.hasPointerCapture(event.pointerId))updateAimFromPointer(event);});
aimControl.addEventListener('pointerup',event=>{if(aimControl.hasPointerCapture(event.pointerId))aimControl.releasePointerCapture(event.pointerId);aimControl.classList.remove('dragging');});
aimControl.addEventListener('pointercancel',()=>aimControl.classList.remove('dragging'));
const fineAim=createFineAimControls({container:aimPanel,getValues:()=>{
  const tank=state.tanks.player;
  return {heading:Number.isFinite(tank.heading)?tank.heading:tank.direction===1?tank.angle:180-tank.angle,power:tank.power};
},onChange:values=>{if(!canControlPlayer())return false;setAim(state,'player',values);updateUI();return true;}});
weaponRack.addEventListener('click',event=>{const card=event.target.closest('.weapon-card');if(card)attemptSelectWeapon(card.dataset.weapon);});
weaponRack.addEventListener('keydown',event=>{const card=event.target.closest('.weapon-card');if(card&&(event.code==='Enter'||event.code==='Space')){event.preventDefault();event.stopPropagation();attemptSelectWeapon(card.dataset.weapon);}});
fireButton.addEventListener('click',fireCurrent);
pauseButton.addEventListener('click',()=>{if(mode==='playing'||mode==='practice')setMode('paused');});

window.addEventListener('keydown',event=>{
  if(event.target.closest?.('select,input'))return;
  const code=event.code;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(code))event.preventDefault();
  if(mode==='guide')return;
  if(['title','paused','ended'].includes(mode)){
    const items=menus[mode];
    const focusedMenuItem=event.target.closest?.('.menu-item');
    if(focusedMenuItem&&(code==='Enter'||code==='Space')){event.preventDefault();activate(focusedMenuItem.dataset.action);return;}
    if(['KeyW','ArrowUp'].includes(code)){menuIndex=(menuIndex-1+items.length)%items.length;audio.navigate();drawMenu(mode);}
    else if(['KeyS','ArrowDown'].includes(code)){menuIndex=(menuIndex+1)%items.length;audio.navigate();drawMenu(mode);}
    else if(code==='Enter'||code==='Space')activate(items[menuIndex][1]);
    else if(mode==='paused'&&code==='Escape')setMode(practiceMode?'practice':'playing');
    else if(mode==='ended'&&code==='KeyR')startGame();
    return;
  }
  if(mode!=='playing'&&mode!=='practice')return;
  if(code==='Escape'){setMode('paused');return;}
  if(state.turn==='player'&&state.phase==='aim'&&!hasFallingSupply(state)){
    const weaponId=WEAPON_IDS.find(id=>`Digit${WEAPONS[id].key}`===code);
    if(weaponId)attemptSelectWeapon(weaponId);
    if(code==='Space'){fireCurrent();return;}
  }
  keys.add(code);updateUI();
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();if(mode==='playing')setMode('paused');});

function spawnExplosion(explosion){
    renderer.setFrame({state,cameraX,projectiles,particles,shockwaves,damageLabels});
    renderer.spawnExplosion(explosion);audio.explode(explosion.weaponId,explosion.material);
    ({particles,shockwaves,damageLabels,shake}=renderer.effectState());
  }
  function updateProjectiles(dt){
  accumulator+=dt;let guard=0;
  while(accumulator>=1/120&&guard++<8){
    for(const projectile of projectiles){
      if(!projectile.alive)continue;projectile.trail.push({x:projectile.x,y:projectile.y});if(projectile.trail.length>18)projectile.trail.shift();
      const impact=stepProjectile(projectile,state,1/120);
      if(impact.type==='split'){const children=splitHiveProjectile(projectile).map(p=>({...p,trail:[]}));projectiles.push(...children);audio.split();showCallout('蜂巢母弹 · 五弹分裂',650);}
      else if(impact.type==='bounce'){audio.bounce();showCallout(`反弹棱镜弹 · 第 ${impact.bounces} 次反弹`,550);shake=Math.max(shake,3);}
      else if(impact.type==='drill'){audio.fissure();showCallout('地脉裂变 · 地形正在断裂',650);shake=Math.max(shake,8);}
      else if(impact.type==='terrain'||impact.type==='tank'){if(state.terrain.rangeTarget){const target=state.terrain.rangeTarget;state.rangeLastScore=rangeScore(impact.x-target.targetX,target.radius,target.coreRadius).toFixed(1);}spawnExplosion(resolveExplosion(state,projectile));settleSupplies(state);processEngineEvents();}
      else if(impact.type==='out')showCallout('炮弹飞出了战区',700);
    }
    accumulator-=1/120;
  }
  if(projectiles.length&&projectiles.every(p=>!p.alive)&&!settleAt)settleAt=performance.now()+850;
  if(settleAt&&performance.now()>=settleAt){settleAt=0;projectiles=[];
    if(practiceMode){if($('#practice-auto').checked)practiceNextAt=performance.now()+2000;state.phase='aim';state.turn='player';state.tanks.player.hp=state.tanks.player.maxHp;state.tanks.enemy.hp=state.tanks.enemy.maxHp;state.tanks.enemy.x=state.tanks.enemy.spawnX??(state.terrain.width-72);state.tanks.enemy.y=terrainHeightAt(state.terrain,state.tanks.enemy.x)-15;state.tanks.enemy.slope=0;processEngineEvents();updateUI();showCallout(state.terrain.rangeTarget?`试射得分 ${state.rangeLastScore??'0.0'} · 继续练习`:'靶子已复位 · 继续试射',1800);return;}
    const result=finishTurn(state);processEngineEvents();updateUI();
    if(result){setTimeout(()=>{setMode('ended');result==='player'?audio.win():audio.lose();announce(result==='player'?'战斗胜利':result==='enemy'?'战斗失败':'平局');},450);return;}
    if(state.turn==='enemy'){showCallout('守垒者正在校准弹道',1300);aiPlan=null;aiAimStart=performance.now()+550;}
    else{showCallout('你的回合 · 可以行动',1200);announce('你的回合');}
  }
}

function updateAI(now,dt){
  if(practiceMode||state.turn!=='enemy'||state.phase!=='aim'||hasFallingSupply(state))return;
  const enemy=state.tanks.enemy;
  if(!aiPlan&&now>=aiAimStart){aiPlan=chooseAiAction(state,rng);selectWeapon(state,'enemy',aiPlan.weaponId);aiAimStart=now;}
  if(!aiPlan)return;
  if(Math.abs(aiPlan.move)>1){const wanted=Math.sign(aiPlan.move)*Math.min(Math.abs(aiPlan.move),BASE_MOVE_SPEED*dt),moved=moveTank(state,'enemy',wanted);aiPlan.move-=moved;if(moved===0)aiPlan.move=0;else if(Math.abs(aiPlan.move)<=1){aiPlan=null;aiAimStart=now+180;}processEngineEvents();updateUI();return;}
  const rate=36*dt,powerRate=48*dt;
  enemy.direction=aiPlan.heading<=90?1:-1;enemy.heading=undefined;
  enemy.angle+=Math.sign(aiPlan.angle-enemy.angle)*Math.min(Math.abs(aiPlan.angle-enemy.angle),rate);
  enemy.power+=Math.sign(aiPlan.power-enemy.power)*Math.min(Math.abs(aiPlan.power-enemy.power),powerRate);
  if(Math.abs(enemy.angle-aiPlan.angle)<.1&&Math.abs(enemy.power-aiPlan.power)<.1&&now-aiAimStart>950){
    const shots=fireWeapon(state,'enemy');projectiles=shots.map(p=>({...p,trail:[]}));audio.fire(enemy.weapon);shake=6;showCallout(`守垒者发射 ${WEAPONS[enemy.weapon].name}`,750);aiPlan=null;updateUI();
  }
}

function updateInput(dt,now){
  const {steps,changed}=stepTankControls(state,'player',keys,dt),moved=steps.length>0;
  if(moved&&now>moveSoundAt){audio.move(materialAt(state.terrain,state.tanks.player.x));moveSoundAt=now+105;}
  if(changed){processEngineEvents();updateUI();}
}

function updateIntro(now){
  const progress=Math.max(0,Math.min(1,(now-introAt)/INTRO_DURATION));
  if(progress<INTRO_SCAN_END){
    const t=progress/INTRO_SCAN_END,eased=t*t*(3-2*t);
    cameraX=(WORLD_WIDTH-WORLD_VIEW_WIDTH)*eased;
  }else{
    const t=(progress-INTRO_SCAN_END)/(1-INTRO_SCAN_END),eased=t*t*(3-2*t);
    cameraX=(WORLD_WIDTH-WORLD_VIEW_WIDTH)*(1-eased);
  }
  if(progress>=1){
    cameraX=0;battleCamera.reset();setMode(practiceMode?'practice':'playing');showCallout(`${biomeFor(state.terrain)?.name||'经典战场'} · ${biomeFor(state.terrain)?.time||''}${practiceMode?' · 弹药与体力无限':''}`,2200);updateUI();
  }
}

function updateEffects(dt){
    renderer.setFrame({state,cameraX,projectiles,particles,shockwaves,damageLabels});
    renderer.updateEffects(dt);
    ({particles,shockwaves,damageLabels,shake}=renderer.effectState());
  }
function updateCamera(dt){
  if(mode==='paused'||mode==='guide')return;
  battleCamera.update(state,projectiles,dt);cameraX=battleCamera.x;
}

let lastUiKey='';
function updateUI(){
  const player=state.tanks.player,enemy=state.tanks.enemy;
  const ready=canControlPlayer(),falling=hasFallingSupply(state);
  const uiKey=JSON.stringify([mode,practiceMode,state.phase,state.turn,state.round,ready,falling,player.hp,enemy.hp,player.heading,player.angle,player.direction,player.power,player.fuel,player.maxFuel,player.ammo,player.unlockedTiers,player.weapon]);
  if(uiKey===lastUiKey)return;
  lastUiKey=uiKey;
  ui.enemyName.textContent=practiceMode?'固定靶':'守垒者';
  ui.playerHp.style.width=`${player.hp}%`;ui.enemyHp.style.width=`${enemy.hp}%`;ui.playerHpText.textContent=player.hp;ui.enemyHpText.textContent=enemy.hp;
  ui.round.textContent=`回合 ${String(state.round).padStart(2,'0')}`;ui.turn.textContent=mode==='intro'?'战场侦察':state.phase==='ended'?'战斗结束':state.turn==='player'?'你的回合':'敌方回合';
  const playerHeading=Number.isFinite(player.heading)?player.heading:(player.direction===1?player.angle:180-player.angle);
  ui.angle.textContent=`${Math.round(playerHeading)%360}°`;ui.power.textContent=Math.round(player.power);
  fineAim.update({heading:playerHeading,power:player.power});
  ui.fuel.textContent=Math.ceil(player.fuel);ui.fuelBar.style.width=`${player.fuel/player.maxFuel*100}%`;
  document.querySelectorAll('[data-ammo]').forEach(label=>label.textContent=practiceMode?'∞':`×${player.ammo[label.dataset.ammo]??0}`);
  document.querySelectorAll('.weapon-card').forEach(card=>{const id=card.dataset.weapon,weapon=WEAPONS[id],locked=!practiceMode&&(weapon.tier<4&&!player.unlockedTiers.includes(weapon.tier)||(weapon.tier===4&&state.round<3)),empty=!practiceMode&&!locked&&id!=='calibration'&&(player.ammo[id]??0)<=0;card.classList.toggle('active',player.weapon===id);card.classList.toggle('locked',locked);card.classList.toggle('empty',empty);card.setAttribute('aria-disabled',String(!canControlPlayer()||locked||empty));card.setAttribute('aria-pressed',String(player.weapon===id));});
  fireButton.classList.toggle('locked',!ready);fireButton.disabled=!ready;pauseButton.disabled=mode!=='playing'&&mode!=='practice';
  const pull=(player.power-MIN_POWER)/POWER_SPAN*.36,pullRadians=playerHeading*Math.PI/180,pullX=-Math.cos(pullRadians)*pull,pullY=Math.sin(pullRadians)*pull,pullLength=Math.hypot(pullX,pullY)*100,pullAngle=Math.atan2(pullY,pullX)*180/Math.PI;
  aimKnob.style.left=`${50+pullX*100}%`;aimKnob.style.top=`${50+pullY*100}%`;
  aimPullVector.style.width=`${pullLength}%`;aimPullVector.style.transform=`rotate(${pullAngle}deg)`;
  aimShotVector.style.width=`${18+pullLength*.42}%`;aimShotVector.style.transform=`rotate(${pullAngle+180}deg)`;aimControl.disabled=!ready;
  ui.fireState.textContent=mode==='intro'?'扫描战场':hasFallingSupply(state)?'补给投放中':ready?'准备就绪':state.phase==='flight'?'弹道飞行中':'等待对手';
}

const renderer=createBattleRenderer(ctx);
const {drawSky,drawTerrain,drawTank,drawSupplies,drawFireZones,drawAimDots,drawProjectiles,drawEffects,drawVignette,roundedRect,polygon}=renderer;
function drawWorldLocator(){
  if(mode!=='playing'&&mode!=='practice')return;const worldWidth=state.terrain.width;const x=472,y=98,w=336,h=13;
  ctx.fillStyle='#061b28b8';roundedRect(x,y,w,h,7);ctx.fill();ctx.strokeStyle='#d8e7d22e';ctx.lineWidth=1;ctx.stroke();
  const left=Math.max(0,cameraX),right=Math.min(worldWidth,cameraX+VIEW_WIDTH/battleCamera.zoom),viewX=x+left/worldWidth*w,viewW=Math.max(0,right-left)/worldWidth*w;ctx.fillStyle='#f6e3a326';roundedRect(viewX,y+3,viewW,7,4);ctx.fill();
  for(const [tank,color] of [[state.tanks.player,'#ff9b42'],[state.tanks.enemy,'#5be1e1']]){const px=x+tank.x/worldWidth*w;ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,y+6.5,3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#071b27';ctx.lineWidth=1.5;ctx.stroke();}
  for(const supply of state.supplies){const px=x+supply.x/worldWidth*w;ctx.fillStyle='#ffe36f';ctx.fillRect(px-2,y+4.5,4,4);}
}
function render(){
  renderer.setFrame({state,cameraX,projectiles,particles,shockwaves,damageLabels});
  ctx.setTransform(renderScale,0,0,renderScale,0,0);ctx.clearRect(0,0,VIEW_WIDTH,VIEW_HEIGHT);drawSky();
  ctx.save();const zoom=mode==='intro'?WORLD_ZOOM:battleCamera.zoom;ctx.scale(zoom,zoom);ctx.translate(0,-(mode==='intro'?WORLD_HEIGHT-VIEW_HEIGHT/WORLD_ZOOM:battleCamera.y));ctx.translate(-cameraX+(shake?(rng()-.5)*shake:0),shake?(rng()-.5)*shake*.55:0);drawTerrain();renderer.drawCalibrationTarget();drawFireZones();drawSupplies();
  if(state.phase==='aim'&&!hasFallingSupply(state))drawAimDots(state.tanks[state.turn]);drawTank(state.tanks.player,true);if(!state.terrain.rangeTarget)drawTank(state.tanks.enemy,false);drawProjectiles();drawEffects();ctx.restore();
  drawVignette();drawWorldLocator();
}

function frame(now){
  const dt=Math.min(.033,(now-lastTime)/1000||0);lastTime=now;
  if(mode==='intro'){updateIntro(now);updateEffects(dt);updateUI();}
  if(mode==='practice'&&practiceNextAt&&now>=practiceNextAt)startGame(true,practiceSelect.value);
  if(mode==='playing'||mode==='practice'){stepSupplyDrops(state,dt);processEngineEvents();updateInput(dt,now);if(state.phase==='ended'&&!practiceMode){setMode('ended');return requestAnimationFrame(frame);}if(state.phase==='flight')updateProjectiles(dt);else updateAI(now,dt);updateEffects(dt);updateUI();}
  if(mode!=='intro')updateCamera(dt);render();requestAnimationFrame(frame);
}

drawMenu('title');updateUI();requestAnimationFrame(frame);
