import test from 'node:test';
import assert from 'node:assert/strict';
import {BIOME_IDS,BIOMES,materialAt} from '../web/biomes.js';
import {createMatch,createTeamMatch,terrainHeightAt} from '../web/engine.js';

test('approved six concepts retain long water, distinct identities and seeded variation',()=>{
  assert.deepEqual(BIOME_IDS.map(id=>BIOMES[id].name),['潮汐长滩','碧湾断岸','群峰砾谷','断峡鸣瀑','云顶雪原','蓝镜长湖']);
  for(const id of BIOME_IDS){
    const widths=new Set(),positions=new Set(),profiles=new Set();
    for(let seed=1;seed<=100;seed++){
      const s=createMatch({seed,themeId:id}),t=s.terrain;
      assert.deepEqual(s,createMatch({seed,themeId:id}));
      widths.add(t.width);positions.add(s.tanks.player.x);profiles.add(JSON.stringify(t.landmarks));
      const wet=t.regions.filter(r=>['shallow','deep','ice'].includes(r.material));
      assert.ok(wet.length>=2&&wet.length<=3);
      const fraction=wet.reduce((sum,r)=>sum+r.to-r.from,0)/t.width;
      assert.ok(fraction>.20&&fraction<.65,id+' water fraction '+fraction);
      assert.equal(t.regions[0].from,0);assert.equal(t.regions.at(-1).to,t.width);
      for(let i=1;i<t.regions.length;i++)assert.equal(t.regions[i].from,t.regions[i-1].to);
      for(const tank of Object.values(s.tanks)){
        assert.ok(Number.isFinite(tank.x)&&Number.isFinite(tank.y));
        assert.ok(!materialAt(t,tank.x).blocked);
      }
      assert.ok(Math.abs(s.tanks.player.y-s.tanks.enemy.y)<12);
      if(id!=='alpine')assert.ok(!t.regions.some(r=>r.material==='snow'));
      assert.equal(t.regions.some(r=>r.material==='deep'),id==='bay');
      assert.equal(t.regions.some(r=>r.material==='canyon'),id==='canyon');
      for(let i=1;i<t.points.length;i++){
        if(!materialAt(t,i*t.step).blocked&&!materialAt(t,(i-1)*t.step).blocked)
          assert.ok(Math.abs(t.points[i]-t.points[i-1])<=12,id+' unexpected impassable shore');
      }
      for(const r of t.regions.filter(r=>r.material==='shallow')){
        const x=(r.from+r.to)/2;
        assert.ok(terrainHeightAt(t,x)-r.level>=24&&terrainHeightAt(t,x)-r.level<40);
      }
      const room=createTeamMatch({seed,themeId:id});
      for(const x of Object.values(room.battlePositions))assert.ok(!materialAt(room.battleTerrain,x).blocked);
    }
    assert.ok(widths.size>50&&positions.size>40&&profiles.size===100,id+' variation');
  }
});
