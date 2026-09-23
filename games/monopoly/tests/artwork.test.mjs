import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BOARD} from '../web/data.js';
import {tileArt} from '../web/board.js';

test('all 40 locations have distinct existing image files and distinct image contents',async()=>{
  const urls=BOARD.map(tileArt);
  assert.equal(new Set(urls).size,40,'A location must not reuse another tile image');
  const images=await Promise.all(urls.map(path=>readFile(new URL(path,new URL('../web/index.html',import.meta.url)))));
  for(const bytes of images){assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');}
  assert.equal(new Set(images.map(bytes=>createHash('sha256').update(bytes).digest('hex'))).size,40,'Different filenames must not conceal duplicate artwork');
  const manifest=JSON.parse(await readFile(new URL('../web/assets/illustrations/ARTWORK.json',import.meta.url),'utf8'));
  assert.equal(manifest.assets.length,40);
  for(const tile of BOARD){const entries=manifest.assets.filter(a=>a.tileId===tile.id);assert.equal(entries.length,1);assert.equal(tileArt(tile),`./assets/illustrations/${entries[0].file}`);assert.ok(entries[0].prompt.length>100);}
});
