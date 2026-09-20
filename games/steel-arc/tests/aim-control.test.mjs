import test from 'node:test';
import assert from 'node:assert/strict';
import {mapAimPointer} from '../web/aim-control.js';

test('aim disk keeps a calm center and gives more low-power precision',()=>{
  const center=mapAimPointer(2,2,80,{heading:45,power:68});
  assert.equal(center.heading,45);assert.ok(center.power<68&&center.power>20);
  const quarter=mapAimPointer(-20,20,80,{heading:45,power:40});
  const half=mapAimPointer(-40,40,80,{heading:45,power:40});
  assert.ok(quarter.power<half.power);assert.ok(half.power<100);
});

test('holding shift makes angle and power changes finer',()=>{
  const normal=mapAimPointer(70,-20,80,{heading:45,power:60});
  const precise=mapAimPointer(70,-20,80,{heading:45,power:60,precision:true});
  assert.ok(Math.abs(precise.heading-45)<Math.abs(normal.heading-45));
  assert.ok(Math.abs(precise.power-60)<Math.abs(normal.power-60));
});
