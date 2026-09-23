import {MONEY_SCALE,cash,START_CASH,GO_SALARY,JAIL_FEE,interest,redemption,validCash} from './economy.js';
import {BOARD,CARDS,BOT_NAMES} from './data.js';
export {BOARD,CARDS} from './data.js';
export const RULES_VERSION=5;
export const clone=value=>structuredClone(value);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
const die=rng=>Math.floor(rng()*6)+1;
const shuffle=(xs,rng)=>{for(let i=xs.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[xs[i],xs[j]]=[xs[j],xs[i]];}return xs;};
export const groupIds=id=>BOARD.filter(b=>b.type==='street'&&b.group===BOARD[id]?.group).map(b=>b.id);
export const alive=g=>g.players.filter(p=>!p.bankrupt);
export const ownsSet=(g,p,id)=>BOARD[id]?.type==='street'&&groupIds(id).every(i=>g.properties[i].owner===p);
export function log(g,text){g.events.push({id:++g.eventId,text});g.events=g.events.slice(-100);}
export function createGame({playerCount=4,mode='solo',names=[]}={},rng=random){
  need(Number.isInteger(playerCount)&&playerCount>=2&&playerCount<=6,'请选择 2–6 位玩家。');
  return {schema:5,rulesVersion:RULES_VERSION,moneyScale:MONEY_SCALE,mode,turn:0,round:1,phase:'roll',doubles:0,extra:false,dice:[1],diceId:0,
    players:Array.from({length:playerCount},(_,id)=>({id,name:String(names[id]||((mode==='solo'&&id===0)?'你':mode==='local'?`玩家 ${id+1}`:BOT_NAMES[id])).slice(0,16),cash:START_CASH,pos:0,jail:false,jailTurns:0,cards:[],bankrupt:false,isBot:mode==='solo'?id!==0:mode==='online'})),
    properties:BOARD.map(b=>b.price?{owner:null,level:0,mortgaged:false}:null),houses:32,hotels:12,
    decks:Object.fromEntries(Object.entries(CARDS).map(([key,cards])=>[key,shuffle(cards.map((_,i)=>i),rng)])),
    queue:[],resume:'end',debt:null,auction:null,trade:null,tradeAttempts:0,pending:null,winner:null,events:[],eventId:0,lastCard:null};
}
export function actor(g){if(g.phase==='finished')return null;if(g.phase==='debt')return g.debt.from;if(g.phase==='trade')return g.trade.to;return g.turn;}
export function rent(g,id,diceTotal=7,multiplier=1){
  const b=BOARD[id],p=g.properties[id];if(!p||p.owner===null||p.mortgaged)return 0;
  if(b.type==='street')return b.rent[p.level]*(p.level===0&&ownsSet(g,p.owner,id)?2:1);
  const n=BOARD.filter(x=>x.type===b.type&&g.properties[x.id].owner===p.owner).length;
  return b.type==='rail'?cash(25)*2**(n-1)*multiplier:cash(diceTotal*(multiplier===10?10:n===2?10:4));
}
export function netWorth(g,id){return g.players[id].cash+BOARD.reduce((sum,b)=>{const p=g.properties[b.id];return !p||p.owner!==id?sum:sum+(p.mortgaged?b.mortgage:b.price)+(p.level===5?5:p.level)*(b.build||0);},0);}
function assetAllowed(g,id){return actor(g)===id&&['roll','end','debt'].includes(g.phase);}
export function canBuild(g,id,at){
  const b=BOARD[at],p=g.properties[at];if(!b||!p||g.phase!=='end'||g.turn!==id||g.players[id]?.pos!==at||g.players[id]?.jail||p.owner!==id||b.type!=='street'||!ownsSet(g,id,at)||p.level>=5)return false;
  const group=groupIds(at).map(i=>g.properties[i]);
  return group.every(x=>!x.mortgaged)&&p.level===Math.min(...group.map(x=>x.level))&&g.players[id].cash>=b.build&&(p.level===4?g.hotels>0:g.houses>0);
}
export function canSell(g,id,at){const p=g.properties[at];return !!p&&assetAllowed(g,id)&&p.owner===id&&p.level>0&&p.level===Math.max(...groupIds(at).map(i=>g.properties[i].level))&&(p.level<5||g.houses>=4);}
export function canMortgage(g,id,at){const p=g.properties[at];return !!p&&assetAllowed(g,id)&&p.owner===id&&!p.mortgaged&&p.level===0&&(BOARD[at].type!=='street'||groupIds(at).every(i=>g.properties[i].level===0));}
export function canRedeem(g,id,at){const p=g.properties[at];return !!p&&assetAllowed(g,id)&&g.phase!=='debt'&&p.owner===id&&p.mortgaged&&g.players[id].cash>=redemption(BOARD[at].mortgage);}
function finished(g){const ps=alive(g);if(ps.length<=1){g.phase='finished';g.winner=ps[0]?.id??null;g.queue=[];g.debt=null;g.auction=null;g.trade=null;log(g,ps.length?`${ps[0].name} 成为最后的地产大亨。`:'本局结束。');return true;}return false;}
function jail(g,id){const p=g.players[id];p.pos=10;p.jail=true;p.jailTurns=0;g.extra=false;g.doubles=0;log(g,`${p.name} 进入监狱。`);}
function transfer(g,from,to,amount){g.players[from].cash-=amount;if(to!==null)g.players[to].cash+=amount;log(g,`${g.players[from].name} 向${to===null?'银行':g.players[to].name}支付 ${amount}。`);}
function drain(g){
  g.debt=null;
  if(finished(g))return;
  while(g.queue.length){
    const task=g.queue.shift();
    if(task.kind==='auction')continue; // Ignore legacy queued auctions.
    if(task.kind==='move'){if(!g.players[task.player].bankrupt){move(g,task.player,task.steps);landing(g,task.player);return;}continue;}
    if(g.players[task.from].bankrupt||(task.to!==null&&g.players[task.to].bankrupt))continue;
    if(g.players[task.from].cash<task.amount){g.debt=task;g.phase='debt';log(g,`${g.players[task.from].name} 需要筹款 ${task.amount}。`);return;}
    transfer(g,task.from,task.to,task.amount);
  }
  g.phase=g.resume;
  if(g.players[g.turn].bankrupt)nextTurn(g);
}
function charges(g,tasks,resume='end'){g.resume=resume;g.queue.push(...tasks.filter(t=>t.kind!=='pay'||t.amount>0));drain(g);}
const pay=(from,to,amount)=>({kind:'pay',from,to,amount});
function move(g,id,steps){const p=g.players[id],raw=p.pos+steps;if(steps>0&&raw>=40){p.cash+=GO_SALARY;log(g,`${p.name} 经过起点，领取 ${GO_SALARY}。`);}p.pos=(raw%40+40)%40;log(g,`${p.name} 抵达${BOARD[p.pos].name}。`);}
function moveTo(g,id,to){move(g,id,(to-g.players[id].pos+40)%40);}
function draw(g,id,deck,rng){
  const index=g.decks[deck].shift(),card=CARDS[deck][index];g.lastCard={deck,index,text:card.text};log(g,`${g.players[id].name} · ${card.text}`);
  if(card.kind!=='jailFree')g.decks[deck].push(index);else g.players[id].cards.push({deck,index});
  const p=g.players[id];
  switch(card.kind){
    case 'gain':p.cash+=card.amount;break;
    case 'pay':charges(g,[pay(id,null,card.amount)]);return;
    case 'move':moveTo(g,id,card.to);landing(g,id,rng);return;
    case 'back':move(g,id,-card.steps);landing(g,id,rng);return;
    case 'jail':jail(g,id);break;
    case 'nearest':{let steps=1;while(BOARD[(p.pos+steps)%40].type!==card.type)steps++;move(g,id,steps);landing(g,id,rng,card.type==='rail'?2:10);return;}
    case 'repairs':{const amount=g.properties.reduce((n,x)=>!x||x.owner!==id?n:n+(x.level===5?card.hotel:x.level*card.house),0);charges(g,[pay(id,null,amount)]);return;}
    case 'payEach':charges(g,alive(g).filter(x=>x.id!==id).map(x=>pay(id,x.id,card.amount)));return;
    case 'collectEach':charges(g,alive(g).filter(x=>x.id!==id).map(x=>pay(x.id,id,card.amount)));return;
  }
  g.phase='end';
}
function landing(g,id,rng=random,multiplier=1){
  const p=g.players[id],b=BOARD[p.pos],asset=g.properties[p.pos];
  if(asset){
    if(asset.owner===null){g.pending=b.id;g.phase='buy';return;}
    if(asset.owner!==id&&!asset.mortgaged){
      // Single-roll variant: utilities reuse the movement result, never roll again.
      const total=g.dice[0];
      if(b.type==='utility')log(g,`公用事业按本回合 ${total} 点计租。`);
      charges(g,[pay(id,asset.owner,rent(g,b.id,total,multiplier))]);return;
    }
  }else if(b.type==='chance'||b.type==='chest'){draw(g,id,b.type,rng);return;}
  else if(b.type==='tax'){charges(g,[pay(id,null,b.amount)]);return;}
  else if(b.type==='goJail')jail(g,id);
  g.phase='end';
}
function nextTurn(g){
  if(finished(g))return;
  let next=g.turn;do{next=(next+1)%g.players.length;if(next===0)g.round++;}while(g.players[next].bankrupt);
  g.turn=next;g.phase='roll';g.extra=false;g.doubles=0;g.pending=null;g.lastCard=null;g.tradeAttempts=0;
}
function roll(g,rng){
  const p=g.players[g.turn],value=die(rng);g.dice=[value];g.diceId++;g.extra=false;g.doubles=0;log(g,`${p.name} 掷出 ${value} 点。`);
  if(p.jail){
    p.jailTurns++;g.extra=false;
    if(value===6){p.jail=false;p.jailTurns=0;move(g,p.id,value);landing(g,p.id,rng);}
    else if(p.jailTurns>=3){p.jail=false;p.jailTurns=0;g.resume='end';g.queue=[pay(p.id,null,JAIL_FEE),{kind:'move',player:p.id,steps:value}];drain(g);}
    else g.phase='end';
    return;
  }
  move(g,p.id,value);landing(g,p.id,rng);
}
function bankrupt(g){
  const {from:id,to}=g.debt,p=g.players[id];
  let value=p.cash;
  for(const b of BOARD){const x=g.properties[b.id];if(!x||x.owner!==id)continue;
    if(x.level){value+=(x.level===5?5:x.level)*b.build/2;if(x.level===5)g.hotels++;else g.houses+=x.level;x.level=0;}
  }
  p.cash=0;p.bankrupt=true;p.jail=false;g.extra=id===g.turn?false:g.extra;
  const fees=[];
  for(const b of BOARD){const x=g.properties[b.id];if(!x||x.owner!==id)continue;x.owner=to;if(to===null){x.mortgaged=false;}else if(x.mortgaged)fees.push(pay(to,null,interest(b.mortgage)));}
  if(to!==null){g.players[to].cash+=value;g.players[to].cards.push(...p.cards);}else for(const card of p.cards)g.decks[card.deck].push(card.index);
  p.cards=[];g.debt=null;g.queue.unshift(...fees);log(g,`${p.name} 宣告破产，资产交给${to===null?'银行':g.players[to].name}。`);drain(g);
}
export function liquidation(g,id){return g.players[id].cash+BOARD.reduce((sum,b)=>{const p=g.properties[b.id];return !p||p.owner!==id?sum:sum+(p.mortgaged?0:b.mortgage)+(p.level===5?5:p.level)*(b.build||0)/2;},0);}
function tradeAssets(g,from,ids){need(Array.isArray(ids)&&ids.length<=28&&new Set(ids).size===ids.length,'地产列表无效。');for(const id of ids){const p=g.properties[id];need(Number.isInteger(id)&&p&&p.owner===from,'交易地产不属于该玩家。');need(BOARD[id].type!=='street'||groupIds(id).every(i=>g.properties[i].level===0),'交易前需卖清该色组的建筑。');}}
function tradeCheck(g,t){
  need(Number.isInteger(t.to)&&t.to!==t.from&&g.players[t.to]&&!g.players[t.to].bankrupt,'请选择有效交易对象。');
  for(const n of [t.giveCash,t.takeCash])need(validCash(n),'交易金额须为 10 的非负整数倍。');
  need(t.giveCash<=g.players[t.from].cash&&t.takeCash<=g.players[t.to].cash,'交易金额超过现金。');
  tradeAssets(g,t.from,t.give);tradeAssets(g,t.to,t.take);
  for(const [who,received,cash] of [[t.from,t.take,g.players[t.from].cash-t.giveCash+t.takeCash],[t.to,t.give,g.players[t.to].cash-t.takeCash+t.giveCash]]){
    const fee=received.reduce((n,id)=>n+(g.properties[id].mortgaged?interest(BOARD[id].mortgage):0),0);need(cash>=fee,`${g.players[who].name} 无法支付抵押转让费。`);
  }
  need(t.give.length+t.take.length+t.giveCash+t.takeCash>0,'请选择要交换的地产或现金。');
}
function tradeAction(g,id,a){
  const t=g.trade;
  if(a.type==='cancelTrade'){need(id===t.from,'只有发起者可撤回。');}
  else{need(id===t.to,'等待对方回应。');need(['acceptTrade','rejectTrade'].includes(a.type),'请接受或拒绝交易。');}
  if(a.type==='acceptTrade'){
    tradeCheck(g,t);g.players[t.from].cash+=t.takeCash-t.giveCash;g.players[t.to].cash+=t.giveCash-t.takeCash;
    for(const [who,ids] of [[t.to,t.give],[t.from,t.take]])for(const at of ids){g.properties[at].owner=who;if(g.properties[at].mortgaged)g.players[who].cash-=interest(BOARD[at].mortgage);}
    log(g,`${g.players[t.from].name} 与 ${g.players[t.to].name} 完成交易。`);
  }else log(g,'交易未成交。');
  g.phase=t.returnPhase;g.trade=null;
  if(g.phase==='debt'&&g.players[g.debt.from].cash>=g.debt.amount){g.queue.unshift(g.debt);drain(g);}
}
// Actions are transactional: an invalid action leaves the original state untouched.
export function applyAction(original,id,a,rng=random){
  need(a&&typeof a.type==='string','行动无效。');const g=upgradeGame(original);need(g.phase!=='finished','本局已经结束。');
  if(g.phase==='trade'){tradeAction(g,id,a);return g;}
  need(actor(g)===id,'还没有轮到你。');
  const p=g.players[id],at=a.property,b=BOARD[at],x=g.properties[at];
  switch(a.type){
    case 'roll':need(g.phase==='roll','当前不能掷骰。');roll(g,rng);break;
    case 'end':need(g.phase==='end','请先完成当前行动。');nextTurn(g);break;
    case 'buy':need(g.phase==='buy','当前没有待购买地产。');{const price=BOARD[g.pending].price;need(p.cash>=price,'现金不足，可以选择不买并跳过。');p.cash-=price;g.properties[g.pending].owner=id;log(g,`${p.name} 买下${BOARD[g.pending].name}，支付 ${price}。`);g.pending=null;g.phase='end';}break;
    case 'skipBuy':need(g.phase==='buy','当前没有待购买地产。');log(g,`${p.name} 放弃购买${BOARD[g.pending].name}，地产保持无主。`);g.pending=null;g.phase='end';break;
    case 'build':need(canBuild(g,id,at),'只能在本回合到达的自有地产建设，且需满足色组、均匀建设及库存条件。');p.cash-=b.build;if(x.level===4){g.hotels--;g.houses+=4;}else g.houses--;x.level++;log(g,`${p.name} 建设${b.name}至 ${x.level===5?'酒店':x.level+' 房'}。`);break;
    case 'sell':need(canSell(g,id,at),'需均匀出售；拆酒店需要银行有四间房。');p.cash+=b.build/2;if(x.level===5){g.hotels++;g.houses-=4;}else g.houses++;x.level--;log(g,`${p.name} 出售${b.name}的一层建筑。`);break;
    case 'sellGroup':{need(assetAllowed(g,id)&&b?.type==='street'&&ownsSet(g,id,at),'请选择自己的完整色组。');let amount=0;for(const i of groupIds(at)){const prop=g.properties[i];amount+=(prop.level===5?5:prop.level)*BOARD[i].build/2;if(prop.level===5)g.hotels++;else g.houses+=prop.level;prop.level=0;}need(amount>0,'这组没有建筑。');p.cash+=amount;log(g,`${p.name} 整组出售建筑，收回 ${amount}。`);}break;
    case 'mortgage':need(canMortgage(g,id,at),'抵押前需卖清同组建筑。');x.mortgaged=true;p.cash+=b.mortgage;log(g,`${p.name} 抵押${b.name}，取得 ${b.mortgage}。`);break;
    case 'redeem':need(canRedeem(g,id,at),'现金不足或地产无需赎回。');x.mortgaged=false;p.cash-=redemption(b.mortgage);log(g,`${p.name} 赎回${b.name}。`);break;
    case 'jailPay':need(g.phase==='roll'&&p.jail&&p.cash>=JAIL_FEE,'无法支付保释金。');p.cash-=JAIL_FEE;p.jail=false;p.jailTurns=0;log(g,`${p.name} 支付 ${JAIL_FEE} 出狱。`);break;
    case 'jailCard':need(g.phase==='roll'&&p.jail&&p.cards.length,'没有可用出狱卡。');{const card=p.cards.shift();g.decks[card.deck].push(card.index);p.jail=false;p.jailTurns=0;log(g,`${p.name} 使用出狱卡。`);}break;
    case 'bankrupt':need(g.phase==='debt'&&liquidation(g,id)<g.debt.amount,'请先通过资产筹款，当前尚未达到破产条件。');bankrupt(g);break;
    case 'trade':need(assetAllowed(g,id),'此阶段不能发起交易。');need(g.tradeAttempts<2,'每回合最多发起两次交易。');{const offer={from:id,to:a.to,give:a.give??[],take:a.take??[],giveCash:a.giveCash??0,takeCash:a.takeCash??0,returnPhase:g.phase};tradeCheck(g,offer);g.tradeAttempts++;g.trade=offer;g.phase='trade';log(g,`${p.name} 向 ${g.players[a.to].name} 发起交易。`);}break;
    default:throw Error('行动类型无效。');
  }
  if(g.phase==='debt'&&g.players[g.debt.from].cash>=g.debt.amount){g.queue.unshift(g.debt);drain(g);}
  return g;
}
export function projectGame(g){const view=clone(g);delete view.decks;delete view.queue;return view;}
export function upgradeGame(original){
  const g=clone(original);
  if(g.schema===5){need(g.moneyScale===MONEY_SCALE&&g.rulesVersion===RULES_VERSION,'存档规则版本无效。');return g;}
  need([1,2,3,4].includes(g.schema),'存档版本无效。');
  if(g.schema===1){
  need(g.moneyScale===undefined||g.moneyScale===1,'存档金额版本无效。');
  for(const p of g.players)p.cash=cash(p.cash);
  if(g.debt)g.debt.amount=cash(g.debt.amount);
  for(const task of g.queue??[])if(task.kind==='pay')task.amount=cash(task.amount);
  if(g.auction)g.auction.bid=cash(g.auction.bid);
  if(g.trade){g.trade.giveCash=cash(g.trade.giveCash);g.trade.takeCash=cash(g.trade.takeCash);}
  if(g.lastCard)g.lastCard.text=CARDS[g.lastCard.deck][g.lastCard.index].text;
  // Preserve original history verbatim for audit; start a new visible currency era.
  g.legacyEvents=[...(g.legacyEvents??[]),...(g.events??[])];g.events=[];
  g.schema=2;g.moneyScale=MONEY_SCALE;
  log(g,'本局金额已等比例换算为十倍币值，棋盘进度保持不变。');
  }
  need(g.moneyScale===MONEY_SCALE,'存档金额版本无效。');
  if(g.schema===2){
  const cancelExtraRoll=g.phase==='roll'&&g.doubles>0;
  g.schema=3;g.rulesVersion=3;g.dice=[g.dice?.[0]??1];g.extra=false;g.doubles=0;
  if(cancelExtraRoll)nextTurn(g);
  log(g,'已切换为单颗骰子，每回合只掷一次；六点不续掷，坐牢时六点可出狱。');
  }
  if(g.schema===3){
  // Bids in legacy auctions were never debited; cancel without moving money or deeds.
  g.schema=4;g.rulesVersion=4;g.auction=null;
  g.queue=g.queue.filter(task=>task.kind!=='auction');
  if(g.phase==='auction'){g.pending=null;drain(g);}
  log(g,'购地规则已更新：只有落地玩家可选择购买，不购买则保留为空地。');
  }
  g.schema=5;g.rulesVersion=RULES_VERSION;
  log(g,'建设规则已更新：本回合走到自己的地产后，才能在该地建房或升级酒店。');
  return g;
}
export function validSavedGame(g){
  if(!g||![1,2,3,4,5].includes(g.schema)||!Array.isArray(g.players)||g.players.length<2||g.players.length>6||!Array.isArray(g.properties)||g.properties.length!==40||!g.decks||!Array.isArray(g.queue)||!Array.isArray(g.events))return false;
  if(!['roll','buy','end','auction','debt','trade','finished'].includes(g.phase)||!Number.isInteger(g.turn)||!g.players[g.turn])return false;
  if(g.players.some((p,i)=>p.id!==i||!Number.isSafeInteger(p.cash)||p.cash<0||!Number.isInteger(p.pos)||p.pos<0||p.pos>39||!Array.isArray(p.cards)))return false;
  if(g.schema>=2&&(g.moneyScale!==MONEY_SCALE||g.players.some(p=>!validCash(p.cash))))return false;
  if(g.schema>=4&&(g.phase==='auction'||g.auction||g.queue.some(task=>task.kind==='auction')))return false;
  if(g.schema>=3&&(g.rulesVersion!==g.schema||!Array.isArray(g.dice)||g.dice.length!==1||!Number.isInteger(g.dice[0])||g.dice[0]<1||g.dice[0]>6))return false;
  if(g.schema===1&&g.moneyScale!==undefined&&g.moneyScale!==1)return false;
  return Object.keys(CARDS).every(key=>Array.isArray(g.decks[key])&&g.decks[key].every(i=>Number.isInteger(i)&&CARDS[key][i]));
}
