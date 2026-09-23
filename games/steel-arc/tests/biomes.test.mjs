import test from 'node:test';
import assert from 'node:assert/strict';
import {BIOME_IDS,materialAt,materialIdAt} from '../web/biomes.js';
import {createMatch,createTeamMatch,completeCalibration,resolveCalibrationShot,advanceCalibrationTurn,moveTank,settleTank,deformTerrain,resolveExplosion,applyFireContact,fireWeapon,createProjectile,stepProjectile,BASE_FUEL,dropSupply,stepSupplyDrops} from '../web/engine.js';
import {stepTankControls} from '../web/controls.js';
import {PredictedMovement} from '../web/movement.js';

function flat(material='rock'){
  const s=createMatch({seed:42,themeId:'river'});s.terrain.points.fill(500);s.terrain.regions=[{from:0,to:s.terrain.width,material,level:491}];
  s.tanks.player.x=300;s.tanks.enemy.x=700;for(const tank of Object.values(s.tanks))settleTank(tank,s.terrain);return s;
}
test('six themes are deterministic and have valid separated spawn locations',()=>{
  for(const themeId of BIOME_IDS)for(let seed=1;seed<=30;seed++){
    const a=createMatch({seed,themeId}),b=createMatch({seed,themeId});assert.deepEqual(a.terrain,b.terrain);
    assert.equal(a.terrain.themeId,themeId);assert.ok(a.terrain.points.every(Number.isFinite));
    for(const tank of Object.values(a.tanks))assert.equal(Boolean(materialAt(a.terrain,tank.x).blocked),false);
    const room=createTeamMatch({seed,themeId});assert.equal(room.terrain.calibrationSurface,true);
    for(const id of room.turnOrder){resolveCalibrationShot(room,id,{heading:90,power:20});advanceCalibrationTurn(room);}completeCalibration(room);
    assert.equal(room.terrain.themeId,themeId);assert.equal(room.terrain.calibrationSurface,undefined);
    for(const tank of Object.values(room.tanks))assert.equal(Boolean(materialAt(room.terrain,tank.x).blocked),false);
  }
});
test('shallow and sand apply independent speed and per-distance fuel factors',()=>{
  for(const [mat,speed,cost] of [['shallow',.8,1.1],['sand',.95,1.05],['snow',1,1.05]]){
    const s=flat(mat),tank=s.tanks.player,before=tank.fuel;
    const moved=moveTank(s,'player',10);assert.ok(Math.abs(moved-10*speed)<1e-8);assert.ok(Math.abs(before-tank.fuel-moved*.34*cost)<1e-8);
  }
});
test('water is indestructible; sand widens and deepens only its own crater',()=>{
  for(const mat of ['shallow','deep']){const s=flat(mat),before=[...s.terrain.points];deformTerrain(s.terrain,{x:400,y:491,radius:90});assert.deepEqual(s.terrain.points,before);}
  const rock=flat(),sand=flat('sand');deformTerrain(rock.terrain,{x:400,y:500,radius:50});deformTerrain(sand.terrain,{x:400,y:500,radius:50});
  assert.equal(rock.terrain.points[200],550);assert.equal(sand.terrain.points[200],560);assert.equal(rock.terrain.points[227],500);assert.ok(sand.terrain.points[227]>500);
});
test('swept movement and recoil cannot enter or tunnel through forbidden zones',()=>{
  const s=flat();s.practice=true;s.terrain.regions=[{from:0,to:500,material:'ice'},{from:500,to:650,material:'deep',level:490},{from:650,to:2560,material:'ice'}];
  for(let i=0;i<400;i++)moveTank(s,'player',74/60);assert.ok(s.tanks.player.x<=460);
  s.tanks.player.heading=180;s.tanks.player.power=100;fireWeapon(s,'player');assert.ok(s.tanks.player.x<=460);
});
test('ice and gravel coast after release; reverse input brakes; practice fuel remains full',()=>{
  for(const mat of ['ice','gravel']){const s=flat(mat);s.practice=true;for(let i=0;i<60;i++)stepTankControls(s,'player',new Set(['KeyD']),1/60);
    const x=s.tanks.player.x;for(let i=0;i<60;i++)stepTankControls(s,'player',new Set(),1/60);assert.ok(s.tanks.player.x>x+50);assert.ok(s.tanks.player.x<x+70);
    for(let i=0;i<40;i++)stepTankControls(s,'player',new Set(['KeyA']),1/60);assert.ok(s.tanks.player.slideVelocity<0);assert.equal(s.tanks.player.fuel,BASE_FUEL);
  }
});
test('recoil uses original muzzle position, points backwards, and is smaller on snow',()=>{
  for(const [mat,expected] of [['ice',80],['gravel',80],['snow',24]]){const s=flat(mat),tank=s.tanks.player;tank.heading=0;tank.power=100;const before=createProjectile(s,'player'),x=tank.x;const [shot]=fireWeapon(s,'player');assert.equal(shot.x,before.x);assert.ok(Math.abs(x-tank.x-expected)<1e-8);}
});

test('doubled inertia halves glide drag and powered velocity response',()=>{
  for(const mat of ['ice','gravel']){
    const s=flat(mat);s.practice=true;const tank=s.tanks.player;
    moveTank(s,'player',111/60);
    assert.ok(Math.abs(tank.slideVelocity-111*(1-Math.exp(-4.5/60)))<1e-8);
    tank.slideVelocity=100;
    for(let i=0;i<60;i++)moveTank(s,'player',0);
    assert.ok(Math.abs(tank.slideVelocity-100*Math.exp(-1.25))<1e-8);
  }
});
test('incendiary has no damage in water, damage without fire on snow/ice',()=>{
  for(const mat of ['shallow','deep','snow','ice','rock']){const s=flat(mat),enemy=s.tanks.enemy;
    resolveExplosion(s,{x:enemy.x,y:enemy.y,owner:'player',weaponId:'quake',volleyId:1});
    assert.equal(enemy.hp<100,!['shallow','deep'].includes(mat));assert.equal(s.fireZones.length,mat==='rock'?1:0);assert.equal(enemy.status.burnTurns,0);
  }
});
test('fire contact costs ten once per entry, never per frame; allies are immune',()=>{
  const s=flat();s.fireZones=[{id:'fire',x:600,y:497,radius:72,owner:'player'}];const enemy=s.tanks.enemy;s.turn='enemy';
  moveTank(s,'enemy',-70);assert.equal(enemy.hp,90);for(let i=0;i<20;i++)applyFireContact(s,enemy);assert.equal(enemy.hp,90);
  moveTank(s,'enemy',90);moveTank(s,'enemy',-90);assert.equal(enemy.hp,80);
  enemy.team='A';s.tanks.player.team='A';enemy.fireContacts=[];applyFireContact(s,enemy);assert.equal(enemy.hp,80);
});
test('water collision occurs at surface and prism does not bounce off water',()=>{
  const s=flat('shallow'),p=createProjectile(s,'player',{weaponId:'armorPiercing'});Object.assign(p,{x:1000,y:480,vx:0,vy:200});
  let result;for(let i=0;i<20&&p.alive;i++)result=stepProjectile(p,s,1/120);assert.equal(result.type,'terrain');assert.ok(p.y<500);assert.equal(p.bounces,0);
});
test('fire entry death resolves solo victory and skips a destroyed teammate',()=>{
  const solo=flat();solo.turn='enemy';solo.tanks.enemy.hp=10;solo.fireZones=[{id:'lethal',x:600,y:497,radius:72,owner:'player'}];moveTank(solo,'enemy',-70);assert.equal(solo.phase,'ended');assert.equal(solo.winner,'player');
  const team=createTeamMatch({seed:6});team.phase='aim';team.terrain.points.fill(500);team.tanks.A1.x=300;team.tanks.A1.hp=10;settleTank(team.tanks.A1,team.terrain);team.fireZones=[{id:'lethal',x:360,y:497,radius:30,owner:'B1'}];moveTank(team,'A1',50);assert.equal(team.tanks.A1.hp,0);assert.equal(team.turn,'B1');assert.equal(team.phase,'aim');
});
test('prediction replays coast inputs identically to authority',()=>{
  const server=flat('ice'),prediction=new PredictedMovement();prediction.accept(server,'player');
  for(let i=0;i<90;i++)prediction.record(stepTankControls(prediction.state,'player',new Set(i<60?['KeyD']:[]),1/60).steps);
  while(prediction.pending.length){const batch=prediction.batch();for(const {distance} of batch)moveTank(server,'player',distance);prediction.acknowledge(batch);prediction.accept(server,'player');}
  assert.equal(prediction.state.tanks.player.x,server.tanks.player.x);assert.equal(prediction.state.tanks.player.fuel,server.tanks.player.fuel);
});
test('supplies across all themes can be collected within two actual fuel budgets',()=>{
  for(const themeId of BIOME_IDS)for(let seed=1;seed<=20;seed++){
    const s=createMatch({seed,themeId}),supply=dropSupply(s),tank=s.tanks[supply.targetTankId];stepSupplyDrops(s,1);s.turn=tank.id;
    assert.equal(Boolean(materialAt(s.terrain,supply.x).blocked),false);
    for(let turn=0;turn<2&&s.supplies.length;turn++){tank.fuel=BASE_FUEL;for(let frame=0;frame<1000&&s.supplies.length;frame++){const delta=supply.x-tank.x;if(Math.abs(delta)<1)break;if(!moveTank(s,tank.id,Math.sign(delta)*Math.min(74/60,Math.abs(delta))))break;}}
    assert.equal(s.supplies.length,0,themeId+' seed '+seed);
  }
});
