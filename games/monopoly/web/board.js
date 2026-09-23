import {BOARD,GROUPS,COLORS,TOKENS} from './data.js';
import {TILE_ART} from './tile-art-map.js';

const paths={
  rail:'<rect x="7" y="3" width="18" height="23" rx="5"/><path d="M7 15h18M12 26l-3 4m11-4 3 4M12 7h8"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>',
  electric:'<path d="m18 2-11 17h8l-1 11 11-18h-8z"/>',
  water:'<path d="M16 3C13 9 6 15 6 21a10 10 0 0 0 20 0c0-6-7-12-10-18zM11 20c0 4 2 6 5 6"/>',
  chance:'<path d="M10 10a6 6 0 1 1 9 5c-3 2-3 3-3 6"/><circle cx="16" cy="27" r="1"/>',
  chest:'<path d="M4 13h24v15H4zM3 8h26v6H3zM16 8v20M16 8C6 9 5 1 10 2c4 0 6 6 6 6s2-6 6-6c5-1 4 7-6 6z"/>',
  tax:'<path d="M8 3h16v27l-4-3-4 3-4-3-4 3zM12 9h8m-8 5h8m-8 5h5"/>',
  parking:'<path d="M5 25h22M9 24V11a7 7 0 0 1 14 0v13M14 11h4a3 3 0 0 1 0 6h-4zm0 6v4"/>',
  jail:'<path d="M4 29V9l12-7 12 7v20M2 29h28M9 10v19m7-19v19m7-19v19M5 16h22"/>',
  goJail:'<path d="M3 25h17V9m-6 5 6-6 6 6M4 5h6v9H4z"/>',
  go:'<path d="M28 16H5m8-8-8 8 8 8"/>',
  street:'<path d="M4 28V14l8-7 8 7v14M18 28V7l6-4 5 4v21M9 28v-8h6v8M22 10h3m-3 5h3m-3 5h3"/>',
};
export function icon(type){return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type]||paths.street}</svg>`;}
export function position(i){if(i<=10)return [11,11-i];if(i<=20)return [21-i,1];if(i<=30)return [1,i-19];return [i-29,11];}
export function tileArt(b){
  const file=TILE_ART[b.id];
  if(!file)throw new RangeError('Unknown board location');
  return `./assets/illustrations/${file}`;
}
export function tileMarkup(b){
  const [row,col]=position(b.id),color=GROUPS[b.group]?.color||'#839d91',type=b.type==='utility'?(b.id===12?'electric':'water'):b.type;
  return `<button class="space space--${b.type} ${b.id%10===0?'space--corner':col===1||col===11?'space--side':'space--horizontal'}" data-space="${b.id}" style="grid-row:${row};grid-column:${col};--group:${color}" aria-label="${b.name}"><span class="color"></span><span class="tile-art"><img src="${tileArt(b)}" alt="" decoding="async" width="256" height="256" draggable="false"></span><span class="tile-icon">${icon(type)}</span><span class="space-name">${b.name}</span><small>${b.price?b.price:b.type==='go'?'+2000':b.type==='tax'?'−'+b.amount:b.type==='jail'?'探访':b.type==='goJail'?'入狱':b.type==='parking'?'休息':''}</small><span class="building"></span><span class="owner"></span><span class="pieces"></span></button>`;
}
const pipMap={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export function diceFace(value){return `<span class="die-face" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="${pipMap[value].includes(i)?'pip':''}"></i>`).join('')}</span>`;}

// Deterministic SVG geometry. Decorative buildings never consume game randomness.
const iso=(x,y,z=0)=>[320+(x-y)*.82,48+(x+y)*.42-z];
const points=coords=>coords.map(c=>iso(...c).map(n=>n.toFixed(1)).join(',')).join(' ');
const poly=(coords,fill,extra='')=>`<polygon points="${points(coords)}" fill="${fill}" ${extra}/>`;
function shade(hex,n){return '#'+hex.slice(1).match(/../g).map(s=>Math.max(0,Math.min(255,parseInt(s,16)+n)).toString(16).padStart(2,'0')).join('');}
function slab(x,y,w,d,z,fill,extra=''){return poly([[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],fill,extra);}
function building(x,y,w,d,h,color){
  let s=slab(x+4,y+5,w+4,d+6,0,'#486356', 'opacity=".13"');
  s+=poly([[x,y+d,0],[x+w,y+d,0],[x+w,y+d,h],[x,y+d,h]],shade(color,-18));
  s+=poly([[x+w,y,0],[x+w,y+d,0],[x+w,y+d,h],[x+w,y,h]],shade(color,-43));
  s+=slab(x,y,w,d,h,shade(color,33));
  s+=slab(x+3,y+3,w-6,d-6,h+1,shade(color,16));
  for(let z=8;z<h-3;z+=11){
    for(let a=5;a<w-3;a+=9)s+=poly([[x+a,y+d+.15,z],[x+a+4,y+d+.15,z],[x+a+4,y+d+.15,z+5],[x+a,y+d+.15,z+5]],'#f5edd2','opacity=".88"');
    for(let a=5;a<d-3;a+=9)s+=poly([[x+w+.15,y+a,z],[x+w+.15,y+a+4,z],[x+w+.15,y+a+4,z+5],[x+w+.15,y+a,z+5]],'#d3e2cf','opacity=".68"');
  }
  return s;
}
function tree(x,y,size=7){const [cx,cy]=iso(x,y);return `<ellipse cx="${cx+3}" cy="${cy+3}" rx="${size}" ry="${size*.45}" fill="#456e57" opacity=".16"/><path d="M${cx} ${cy}v-${size*1.3}" stroke="#7a8666" stroke-width="2"/><ellipse cx="${cx}" cy="${cy-size*1.5}" rx="${size*.8}" ry="${size*1.2}" fill="#719774"/><ellipse cx="${cx-2}" cy="${cy-size*1.7}" rx="${size*.5}" ry="${size*.8}" fill="#9ab58a"/>`;}
function park(){let s=slab(113,113,85,85,1,'#aac296');s+=slab(120,147,70,12,2,'#e4dcbf')+slab(148,120,12,70,2,'#e4dcbf');const [x,y]=iso(154,154);s+=`<ellipse cx="${x}" cy="${y}" rx="23" ry="12" fill="#f2ebda"/><ellipse cx="${x}" cy="${y-2}" rx="17" ry="8" fill="#8cbec0"/><path d="M${x} ${y-1}v-20m-7 11q7-20 14 0" fill="none" stroke="#e9f5e8" stroke-width="2"/>`;for(const [a,b] of [[125,125],[183,125],[125,183],[183,183]])s+=tree(a,b,10);return s;}
export function cityMarkup(){
  let s=`<svg class="city-map" viewBox="0 0 640 370" aria-hidden="true"><defs><pattern id="water-lines" width="24" height="14" patternUnits="userSpaceOnUse"><path d="M2 7h10m4 7h6" stroke="#c5e3da" stroke-width="1" opacity=".65"/></pattern></defs>`;
  s+=`<ellipse cx="325" cy="231" rx="246" ry="114" fill="#294e3c" opacity=".055"/>`;
  s+=poly([[0,0,-8],[320,0,-8],[320,320,-8],[0,320,-8]],'#9aaf97');
  s+=slab(0,0,320,320,0,'#d2dfc3');
  s+=slab(6,6,308,308,1,'#b8cdab');
  for(const i of [98,202]){s+=slab(i,8,13,300,1,'#f2eddf');s+=slab(8,i,300,13,1,'#f2eddf');}
  s+=slab(289,8,23,300,2,'#90bfc0');s+=slab(289,8,23,300,3,'url(#water-lines)');
  for(const y of [98,202]){s+=slab(283,y-3,35,20,5,'#d8c5a2');s+=poly([[283,y-3,5],[318,y-3,5],[318,y-3,10],[283,y-3,10]],'#b19c7a');}
  const districts=[{x:16,y:16,g:0},{x:119,y:16,g:1},{x:222,y:16,g:2},{x:16,y:119,g:3},{x:222,y:119,g:4},{x:16,y:222,g:5},{x:119,y:222,g:6},{x:222,y:222,g:7}];
  s+=park();
  // Draw back-to-front so the city has real, consistent occlusion.
  for(const {x,y,g} of districts.sort((a,b)=>(a.x+a.y)-(b.x+b.y))){
    const color=GROUPS[g].color,w=g===2||g===4||g===7?61:77;
    s+=`<g class="city-district" data-city-group="${g}">`;
    s+=slab(x-3,y-3,w+6,82,2,'#c4d5b4',`class="district-plinth" stroke="${color}" stroke-width="1" stroke-opacity=".3"`);
    s+=building(x+4,y+5,w>65?30:24,23,22+(g%3)*8,color);
    s+=building(x+(w>65?43:34),y+8,w>65?27:20,26,30+(g%4)*9,color);
    s+=building(x+9,y+44,w>65?41:36,25,g===7?69:g===4?54:26+(g%3)*11,color);
    s+=tree(x+w-8,y+67,7)+tree(x+3,y+34,5);
    s+='</g>';
  }
  for(const [x,y] of [[8,88],[8,195],[98,311],[202,311],[317,62],[317,163],[317,271]])s+=tree(x,y,6);
  for(const [x,y,color] of [[105,61,'#d09264'],[167,105,'#7299a1'],[209,258,'#c67764']])s+=building(x,y,8,15,4,color);
  const [bx,by]=iso(300,169);s+=`<g class="river-boat"><path d="M${bx-8} ${by}l8 4 8-4-8-4z" fill="#faf4dc"/><path d="M${bx} ${by}v-12l7 11z" fill="#c37862"/></g>`;
  s+='</svg>';return s;
}
export function updateBoard(root,state,selected){
  for(const cell of root.querySelectorAll('[data-space]')){
    const at=Number(cell.dataset.space),x=state.properties[at],occupants=state.players.filter(p=>p.pos===at&&!p.bankrupt);
    cell.classList.toggle('selected',at===selected);cell.classList.toggle('mortgaged',!!x?.mortgaged);cell.classList.toggle('occupied',occupants.length>0);cell.classList.toggle('owned',x?.owner!==null&&!!x);
    cell.style.setProperty('--owner',x?.owner===null||!x?'transparent':COLORS[x.owner]);
    cell.querySelector('.building').innerHTML=x?.level===5?'<b>H</b>':x?.level?Array.from({length:x.level},()=>'<i></i>').join(''):'';
    cell.querySelector('.pieces').innerHTML=occupants.map(p=>`<span class="piece ${p.id===state.turn?'piece--active':''}" style="--player:${COLORS[p.id]}" title="${String(p.name).replace(/[&<>"']/g,'')} · ${p.id+1}">${TOKENS[p.id]}</span>`).join('');
    cell.setAttribute('aria-pressed',String(at===selected));
    cell.setAttribute('aria-label',`${BOARD[at].name}${x?`, ${x.owner===null?'无主':state.players[x.owner].name+'所有'}${x.mortgaged?'，已抵押':''}${x.level?'，'+(x.level===5?'酒店':x.level+' 间房'):''}`:''}`);
  }
  for(const district of root.querySelectorAll('[data-city-group]'))district.classList.toggle('is-selected',Number(district.dataset.cityGroup)===BOARD[selected].group);
}
