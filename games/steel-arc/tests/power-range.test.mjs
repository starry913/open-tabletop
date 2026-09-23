import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,createTeamMatch,setAim,createProjectile,WEAPON_IDS,GRAVITY,validMatch} from '../web/engine.js';
import {mapAimPointer} from '../web/aim-control.js';
test('125 power is reachable and all ammunition keeps the same extended trajectory',()=>{
 const s=createMatch({seed:42});setAim(s,'player',{heading:45,power:125});assert.equal(s.tanks.player.power,125);assert.ok(validMatch(s));
 const shot=createProjectile(s,'player');assert.ok(shot.vx*shot.vx*2/GRAVITY>2400);
 for(const weaponId of WEAPON_IDS){const p=createProjectile(s,'player',{weaponId});assert.equal(p.vx,shot.vx);assert.equal(p.vy,shot.vy);}
 setAim(s,'player',{power:999});assert.equal(s.tanks.player.power,125);
 assert.equal(mapAimPointer(-80,0,80).power,125);
 const team=createTeamMatch({seed:42});team.phase='aim';team.turn='A1';setAim(team,'A1',{power:125});assert.equal(team.tanks.A1.power,125);assert.ok(Math.hypot(createProjectile(team,'A1').vx,createProjectile(team,'A1').vy)>874);
});
