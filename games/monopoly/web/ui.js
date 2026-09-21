import {createDicePresentation,paintDice,DICE_ROLL_MS} from './dice-presentation.js';
import {MONEY_SCALE,JAIL_FEE,redemption} from './economy.js';
import {createGame,applyAction,actor,BOARD,netWorth,groupIds,canBuild,canSell,canMortgage,canRedeem,liquidation,validSavedGame,upgradeGame,RULES_VERSION} from './engine.js';
import {GROUPS,TOKENS,COLORS} from './data.js';
import {botStep} from './ai.js';
import {tileMarkup,cityMarkup,updateBoard,tileArt} from './board.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const online=/\/online(?:\.html)?$/.test(location.pathname),SAVE='monopoly.local.v1',IDENTITY='monopoly.room.v1';
const read=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}},save=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
let state=createGame(),room=null,identity=online?read(IDENTITY):null,selected=1,busy=false,botTimer=null,pollTimer=null,pending=null,joinAttempt=null,disposed=false,skipRollReplay=false,sound=false,audio=null,networkBusy=false,generation=0;
const dicePresentation=createDicePresentation({onReveal:()=>{tone();render();},duration:()=>matchMedia('(prefers-reduced-motion: reduce)').matches?120:DICE_ROLL_MS});
const money=n=>Number(n).toLocaleString('en-US');
function error(msg=''){$('error').textContent=msg;$('error').hidden=!msg;}
function own(){const id=actor(state);return !busy&&!dicePresentation.rolling&&id!==null&&(!online?!state.players[id].isBot:room?.status==='playing'&&room.selfSeat===id);}
function mySeat(view=state){return online?room?.selfSeat:actor(view);}
function playable(){return !online||!!room&&['playing','finished'].includes(room.status);}
function tone(){if(!sound)return;try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),gain=audio.createGain();o.type='sine';o.frequency.setValueAtTime(420,audio.currentTime);o.frequency.exponentialRampToValueAtTime(650,audio.currentTime+.1);gain.gain.setValueAtTime(.04,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+.2);}catch{}}
function makeBoard(){
  $('board').insertAdjacentHTML('beforeend',BOARD.map(tileMarkup).join(''));
  $('city-scene').innerHTML=cityMarkup();
  $('property-select').innerHTML=BOARD.filter(b=>b.price).map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
  $('district-legend').innerHTML=GROUPS.map((g,i)=>`<button data-district="${i}" style="--group:${g.color}"><i></i>${g.name}<span></span></button>`).join('');
}
function button(type,label,primary=false,disabled=false){return `<button data-action="${type}" ${disabled?'disabled':''} class="${primary?'primary':''}">${label}</button>`;}
function render(){
  const view=dicePresentation.sync(state),rolling=dicePresentation.rolling;
  const id=actor(view),p=view.players[id??view.turn],mine=own(),active=playable();
  $('mode-label').textContent=online?`好友房${room?' · '+room.code:''}`:view.mode==='local'?`${view.players.length} 人 · 同屏轮流`:`你与 ${view.players.length-1} 位 AI`;
  updateBoard($('board'),view,selected);
  paintDice($('dice'),view.dice,rolling);
  for(const el of $('district-legend').querySelectorAll('[data-district]')){
    const group=Number(el.dataset.district),all=BOARD.filter(b=>b.group===group&&b.type==='street');
    const held=all.filter(b=>view.properties[b.id].owner!==null).length;
    el.querySelector('span').textContent=held+'/'+all.length;
    el.classList.toggle('selected',BOARD[selected].group===group);
    el.setAttribute('aria-pressed',String(BOARD[selected].group===group));
  }
  $('map-selection').textContent=BOARD[selected].name+(view.properties[selected]?.owner!=null?' / '+view.players[view.properties[selected].owner].name:'');
  $('center-turn').textContent=view.phase==='finished'?`${view.players[view.winner]?.name??'无人'} 赢得本局`:active?`${p.name} · ${view.phase==='trade'?'正在谈判':'轮到你规划'}`:'等待朋友入座';
  $('bank-stock').textContent=`银行库存 · ${view.houses} 房屋 / ${view.hotels} 酒店`;
  $('round').textContent=`第 ${view.round} 轮`;
  $('players').innerHTML=view.players.map(p=>`<div class="player ${p.id===id?'active':''} ${p.bankrupt?'out':''}" style="--player:${COLORS[p.id]}"><span class="token">${TOKENS[p.id]}</span><span>${esc(p.name)}<small>${p.bankrupt?'已破产':p.jail?'在狱中':p.isBot?'本地策略 AI':online&&room?.selfSeat===p.id?'你':'玩家'} · ${view.properties.filter(x=>x?.owner===p.id).length} 块地</small></span><span class="balance">${money(p.cash)}<small>总资产 ${money(netWorth(view,p.id))}</small></span></div>`).join('');
  $('log').innerHTML=view.events.length?[...view.events].reverse().slice(0,12).map(e=>`<li>${esc(e.text)}</li>`).join(''):'<li>每人 15000。第一席先手，从一条街开始。</li>';
  let title='',hint='',controls='';$('trade-summary').hidden=true;
  const labels={roll:'掷骰前',buy:'地产购入',end:'资产管理',debt:'债务清算',trade:'交易报价',finished:'本局结束'};
  $('phase-label').textContent=active?`${labels[view.phase]} · ${p.name}`:'好友房';
  if(!active){title='等大家都准备好';hint='房主开局后，空位由 AI 入座。';}
  else if(view.phase==='finished'){title=`${view.players[view.winner]?.name??'无人'} 赢了`;hint='城市记住了你的每一次选择。';if(!online)controls=button('restart','再开一桌',true);}
  else if(view.phase==='roll'){title=p.jail?'一次出狱的机会':mine?'轮到你了':'等待下一步';hint=p.jail?`已尝试 ${p.jailTurns} 次。可付 500、使用出狱卡，或尝试掷出 6 点。`:'掷出一颗骰子，看看下一站。也可以先管理资产或谈一笔交易。';controls=button('roll',p.jail?'尝试 6 点出狱':'掷骰子 →',true,!mine);if(p.jail){controls+=button('jailPay','支付 500',false,!mine||p.cash<JAIL_FEE)+button('jailCard','使用出狱卡',false,!mine||!p.cards.length);}if(mine)controls+=button('openTrade','发起交易',false,view.tradeAttempts>=2);}
  else if(view.phase==='buy'){const b=BOARD[view.pending];title=`买下${b.name}？`;hint=`标价 ${money(b.price)} · 你的现金 ${money(p.cash)}。只有到达这里的玩家可以购买；不买则保持无主。`;controls=button('buy',`购买 · ${money(b.price)}`,true,!mine||p.cash<b.price)+button('skipBuy','不买，跳过',false,!mine);}
  else if(view.phase==='end'){title=mine?'这一回合，如何收尾？':'等待资产规划';hint='仅可在本回合到达的自有地产建设；也可以抵押、赎回或交易，再结束回合。';controls=button('end','结束回合',true,!mine);if(mine)controls+=button('openTrade','发起交易',false,view.tradeAttempts>=2);}
  else if(view.phase==='debt'){const d=view.debt;title=`需要支付 ${money(d.amount)}`;hint=`收款方：${d.to===null?'银行':view.players[d.to].name}。现金 ${money(p.cash)}，尚差 ${money(d.amount-p.cash)}。在产权簿选择地产筹款。`;controls=button('bankrupt','宣告破产',false,!mine||liquidation(view,id)>=d.amount);if(mine)controls+=button('openTrade','协商出售',false,view.tradeAttempts>=2);}
  else if(view.phase==='trade'){const t=view.trade;title=`${view.players[t.from].name} 的交易提案`;hint=`等待 ${view.players[t.to].name} 确认。抵押地产转让费由接收者另付。`;$('trade-summary').hidden=false;$('trade-summary').innerHTML=`<p><b>${esc(view.players[t.from].name)} 给出</b>：${money(t.giveCash)} 现金${t.give.map(i=>' · '+BOARD[i].name).join('')}</p><p><b>${esc(view.players[t.to].name)} 给出</b>：${money(t.takeCash)} 现金${t.take.map(i=>' · '+BOARD[i].name).join('')}</p>`;controls=button('acceptTrade','接受交易',true,!mine)+button('rejectTrade','拒绝',false,!mine);if((online?room?.selfSeat===t.from:!view.players[t.from].isBot)&&!busy)controls+=button('cancelTrade','撤回提案');}
  if(active&&!mine&&view.phase!=='finished')hint+=online?' · 行动超时后自动处理。':p.isBot?' · AI 正在思考。':'';
  if(rolling){title='骰子旋转中…';hint='等骰子停稳后再显示点数并移动棋子。';controls=button('roll','等待骰子停稳',true,true);$('trade-summary').hidden=true;$('phase-label').textContent='掷骰中';$('center-turn').textContent=p.name+' · 骰子旋转中';}
  $('action-title').textContent=title;$('action-hint').textContent=hint;$('actions').innerHTML=controls;
  renderProperty(view);renderRoom();requestAnimationFrame(fitBoard);scheduleBot();
}
function renderProperty(view=state){
  const b=BOARD[selected],x=view.properties[selected],id=mySeat(view),mine=own()&&playable();if(b.price)$('property-select').value=String(selected);
  const color=GROUPS[b.group]?.color||'#8ba38d';
  $('property-detail').innerHTML=`<img class="property-art" src="${tileArt(b)}" alt="${esc(b.name)}" width="320" height="220"><div class="property-title" style="--group:${color}"><h3>${esc(b.name)}</h3><p>${x?`${x.owner===null?'银行持有':esc(view.players[x.owner].name)+' 所有'} · ${x.mortgaged?'已抵押':x.level===5?'酒店':x.level?x.level+' 房屋':'未建设'}`:'功能地块'}</p>${b.price?`<p>售价 ${b.price} · 抵押 ${b.mortgage}${b.build?' · 建筑每层 '+b.build:''}</p>`:''}</div>${b.type==='street'?`<div class="rents">${b.rent.map((r,i)=>`<span class="${i===x.level?'current':''}"><small>${['空地','1 房','2 房','3 房','4 房','酒店'][i]}</small>${r}</span>`).join('')}</div><p class="muted">完整色组的未建设地产租金翻倍。建房或升级酒店必须本回合走到该地，并满足完整色组与均匀建设条件。</p>`:b.type==='rail'?'<p>持有 1 / 2 / 3 / 4 站<br>租金 250 / 500 / 1000 / 2000</p>':b.type==='utility'?'<p>按本回合骰子点数计租：一家 40 倍、两家 100 倍点数。</p>':`<p>${b.type==='parking'?'休息一格，不发奖金。':b.type==='go'?'正常经过或抵达，领取 2000。':b.type==='goJail'?'直接入狱，不领取起点收入。':b.type==='tax'?'向银行支付 '+b.amount+'。':b.type==='jail'?'正常踩中只是探访。': '抽取一张事件牌并结算。'}</p>`}`;
  const actions=[];if(mine&&x?.owner===id&&['roll','end','debt'].includes(view.phase)){
    if(b.type==='street'){actions.push(['build',view.players[id].pos!==selected?'走到此地后建设':view.phase!=='end'?'本回合落地后建设':x.level===4?'升酒店':'建一间房',canBuild(view,id,selected)],['sell','出售一层',canSell(view,id,selected)]);if(groupIds(selected).some(i=>view.properties[i].level>0))actions.push(['sellGroup','整组建筑清仓',true]);}
    actions.push(x.mortgaged?['redeem',`赎回 ${redemption(b.mortgage)}`,canRedeem(view,id,selected)]:['mortgage',`抵押 ＋${b.mortgage}`,canMortgage(view,id,selected)]);
  }
  $('property-actions').innerHTML=actions.map(([type,label,enabled])=>button(type,label,false,!enabled)).join('');
}
function persist(){if(!online&&!save(SAVE,state))error('本地存档不可用，请保持页面打开。');}
function scheduleBot(){clearTimeout(botTimer);if(online||disposed||busy||dicePresentation.rolling||document.hidden||document.querySelector('dialog[open]')||state.phase==='finished'||!state.players[actor(state)]?.isBot)return;botTimer=setTimeout(()=>{try{state=botStep(state);persist();render();}catch(e){error(e.message);}},950);}
async function action(a){
  if(busy||dicePresentation.rolling||!playable())return;error();
  if(a.type==='roll'){dicePresentation.begin();render();}
  if(online){pending??={...a,moneyScale:MONEY_SCALE,rulesVersion:RULES_VERSION,version:room.version,requestId:crypto.randomUUID()};await command('action',pending);}
  else{try{const id=a.type==='cancelTrade'?state.trade.from:actor(state);state=applyAction(state,id,a);persist();render();if(a.type!=='roll')tone();}catch(e){dicePresentation.reset(state);render();error(e.message);}}
}
function openTrade(){if(!own())return;clearTimeout(botTimer);const id=mySeat();$('trade-partner').innerHTML=state.players.filter(p=>p.id!==id&&!p.bankrupt).map(p=>`<option value="${p.id}">${esc(p.name)} · ${money(p.cash)}</option>`).join('');$('give-cash').value=0;$('take-cash').value=0;tradeOptions();$('trade-dialog').showModal();}
function tradeOptions(){for(const [name,id] of [['give',mySeat()],['take',Number($('trade-partner').value)]]){$(`${name}-properties`).innerHTML=BOARD.filter(b=>state.properties[b.id]?.owner===id).map(b=>{const allowed=b.type!=='street'||groupIds(b.id).every(i=>state.properties[i].level===0);return `<label class="check"><input type="checkbox" value="${b.id}" ${allowed?'':'disabled'}>${b.name}${state.properties[b.id].mortgaged?'（抵押）':''}${allowed?'':' · 需先卖房'}</label>`;}).join('')||'<p class="muted">暂无地产</p>';}}
async function api(path,{body,token}={}){let r;try{r=await fetch('/api/monopoly'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}catch{throw Error('网络暂时中断，座位已保留。');}let data;try{data=await r.json();}catch{throw Error('服务未响应，请重试。');}if(!r.ok){const e=Error(data.error||'请求失败');e.status=r.status;throw e;}return data;}
function snapshot(data){const initial=!room||room.code!==data.room.code;if(room&&room.code===data.room.code&&data.room.version<room.version)return;room=data.room;if(data.game)state=data.game;else{state=createGame({playerCount:room.playerCount,mode:'online'});for(const p of state.players){const m=room.roster.find(m=>m.seat===p.id);if(m){p.name=m.name;p.isBot=false;}}}if(initial||document.hidden||skipRollReplay){dicePresentation.reset(state);skipRollReplay=false;}if(pending&&room.version>pending.version)pending=null;$('connection').textContent='已连接';error();render();}
function failure(e){dicePresentation.reset(state);if([403,404].includes(e.status)){identity=null;room=null;pending=null;generation++;save(IDENTITY,null);}if(e.status===409)pending=null;error(e.message);$('connection').textContent='重连中 · 座位已保存';render();}
function schedulePoll(){clearTimeout(pollTimer);if(online&&identity&&!disposed)pollTimer=setTimeout(poll,document.hidden?5000:1000);}
async function poll(){if(busy||networkBusy){schedulePoll();return;}if(!identity)return;networkBusy=true;const gen=generation;try{const data=await api(`/rooms/${identity.code}`,{token:identity.token});if(gen===generation)snapshot(data);}catch(e){if(gen===generation)failure(e);}finally{networkBusy=false;schedulePoll();}}
async function command(op,body={}){if(busy||!identity)return;busy=true;clearTimeout(pollTimer);render();try{const data=await api(`/rooms/${identity.code}/${op}`,{body,token:identity.token});if(op==='leave'){identity=null;room=null;pending=null;generation++;save(IDENTITY,null);state=createGame();dicePresentation.reset(state);}else{snapshot(data);if(op==='action')pending=null;}}catch(e){failure(e);}finally{busy=false;render();schedulePoll();}}
async function enter(joining){if(busy||identity)return;const name=$('nickname').value.trim(),code=$('room-code').value.trim().toUpperCase();if(!name)return error('请填写昵称。');busy=true;renderRoom();try{if(joining&&(!joinAttempt||joinAttempt.code!==code||joinAttempt.name!==name))joinAttempt={code,name,seatKey:Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('')};const data=await api(joining?`/rooms/${code}/join`:'/rooms',{body:joining?{name,seatKey:joinAttempt.seatKey}:{name,playerCount:Number($('room-count').value)}});identity={code:data.room.code,token:data.token};generation++;if(!save(IDENTITY,identity))error('无法保存座位，请勿关闭页面。');snapshot(data);const url=new URL(location.href);url.searchParams.set('room',identity.code);history.replaceState(null,'',url);}catch(e){failure(e);}finally{busy=false;render();schedulePoll();}}
function renderRoom(){if(!online)return;$('room-panel').hidden=false;$('room-entry').hidden=!!room;$('room-waiting').hidden=!room||room.status==='playing'||dicePresentation.rolling;$('room-tools').hidden=!room;$('resume-room').hidden=!identity||!!room;for(const id of ['create-room','join-room'])$(id).disabled=busy||!!identity;if(!room)return;$('waiting-code').textContent=room.code;$('waiting-roster').innerHTML=Array.from({length:room.playerCount},(_,i)=>{const m=room.roster.find(m=>m.seat===i);return `<li>${i+1} · ${esc(m?.name||'AI 补位')} ${m?m.ready?'✓ 已准备':'待准备':''}</li>`;}).join('');$('ready-room').textContent=room.selfReady?'取消准备':'我准备好了';$('ready-room').disabled=busy;$('start-room').hidden=!room.isOwner;$('start-room').disabled=busy||!room.roster.every(m=>m.ready&&m.connected);$('start-room').textContent=room.status==='finished'?'开始下一局':'开始游戏';}

$('board').addEventListener('click',e=>{const b=e.target.closest('[data-space]');if(b){selected=Number(b.dataset.space);render();}});
$('property-select').addEventListener('change',()=>{selected=Number($('property-select').value);render();});
for(const id of ['actions','property-actions'])$(id).addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const type=b.dataset.action;if(type==='restart')return $('setup-dialog').showModal();if(type==='openTrade')return openTrade();action({type,...(['build','sell','sellGroup','mortgage','redeem'].includes(type)?{property:selected}:{})});});
$('trade-partner').addEventListener('change',tradeOptions);
$('trade-form').addEventListener('submit',e=>{e.preventDefault();const a={type:'trade',to:Number($('trade-partner').value),giveCash:Number($('give-cash').value),takeCash:Number($('take-cash').value),give:[...$('give-properties').querySelectorAll('input:checked')].map(x=>Number(x.value)),take:[...$('take-properties').querySelectorAll('input:checked')].map(x=>Number(x.value))};$('trade-dialog').close();action(a);});
$('rules').addEventListener('click',()=>{clearTimeout(botTimer);$('rules-dialog').showModal();});$('new').addEventListener('click',()=>{clearTimeout(botTimer);$('setup-dialog').showModal();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',scheduleBot));
$('setup-form').addEventListener('submit',e=>{e.preventDefault();state=createGame({playerCount:Number($('player-count').value),mode:$('local-mode').value});dicePresentation.reset(state);selected=1;persist();$('setup-dialog').close();render();});
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=`音效：${sound?'开':'关'}`;tone();});
$('create-room').addEventListener('click',()=>enter(false));$('join-room').addEventListener('click',()=>enter(true));$('resume-room').addEventListener('click',poll);$('ready-room').addEventListener('click',()=>command('ready',{ready:!room.selfReady}));$('start-room').addEventListener('click',()=>command('start'));$('leave-room').addEventListener('click',()=>command('leave'));
$('copy-invite').addEventListener('click',async()=>{const url=new URL('./online.html',location.href);url.searchParams.set('room',room.code);try{await navigator.clipboard.writeText(url.href);$('copy-invite').textContent='已复制';}catch{error(`请分享房间码 ${room.code}。`);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(botTimer);dicePresentation.reset(state);skipRollReplay=true;}else{render();if(online)poll();}});
addEventListener('pagehide',()=>{disposed=true;clearTimeout(botTimer);clearTimeout(pollTimer);dicePresentation.reset(state);});addEventListener('pageshow',()=>{disposed=false;dicePresentation.reset(state);render();schedulePoll();});
function fitBoard(){
  const viewport=$('board-viewport'),frame=viewport.querySelector('.board-frame');
  const top=viewport.getBoundingClientRect().top+window.scrollY;
  const available=window.innerHeight-top-18;
  const frameStyle=getComputedStyle(frame),viewportStyle=getComputedStyle(viewport);
  const inset=parseFloat(frameStyle.paddingTop)+parseFloat(frameStyle.paddingBottom)+2+parseFloat(viewportStyle.paddingTop)+parseFloat(viewportStyle.paddingBottom);
  const height=Math.max(180,Math.min(740,frame.clientWidth,available)-inset);
  viewport.style.setProperty('--map-height',Math.round(height)+'px');
}
const mapResizeObserver=new ResizeObserver(()=>requestAnimationFrame(fitBoard));
for(const el of [document.querySelector('header'),document.querySelector('.page-title'),$('room-panel'),document.querySelector('.board-controls')])mapResizeObserver.observe(el);
window.addEventListener('resize',()=>requestAnimationFrame(fitBoard));
$('inspect-property').addEventListener('click',()=>document.querySelector('.property-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}));
$('focus-piece').addEventListener('click',()=>{
  const id=online&&room?room.selfSeat:actor(state)??state.turn;
  const at=state.players[id].pos;
  selected=at;render();

});
$('district-legend').addEventListener('click',e=>{const b=e.target.closest('[data-district]');if(!b)return;selected=BOARD.find(x=>x.group===Number(b.dataset.district)).id;render();});
makeBoard();
if(online){$('new').hidden=true;$('mode-link').textContent='单人 / 同屏';$('mode-link').href='./index.html';$('room-code').value=new URL(location.href).searchParams.get('room')||'';render();if(identity)poll();}
else{const saved=read(SAVE);if(validSavedGame(saved)){state=upgradeGame(saved);if(saved.schema!==state.schema)persist();}dicePresentation.reset(state);render();if(!validSavedGame(saved)){$('setup-dialog').showModal();clearTimeout(botTimer);}}
