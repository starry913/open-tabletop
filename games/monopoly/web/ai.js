import {MONEY_SCALE,cash,interest,redemption} from './economy.js';
import {BOARD,actor,ownsSet,groupIds,canBuild,canSell,canMortgage,canRedeem,liquidation,applyAction,clone} from './engine.js';

function value(g,id,at){const b=BOARD[at],x=g.properties[at];let result=x.mortgaged?b.mortgage:b.price;
  if(b.type==='street'){const owned=groupIds(at).filter(i=>g.properties[i].owner===id).length;result+=owned*cash(85);if(groupIds(at).every(i=>i===at||g.properties[i].owner===id))result+=cash(260);}
  if(b.type==='rail')result+=BOARD.filter(b=>b.type==='rail'&&g.properties[b.id].owner===id).length*cash(35);
  return result;
}
function accepts(g,t){const after=clone(g);for(const at of t.take)after.properties[at].owner=t.from;for(const at of t.give)after.properties[at].owner=t.to;
  const gain=t.giveCash+t.give.reduce((n,at)=>n+value(after,t.to,at),0);
  const loss=t.takeCash+t.take.reduce((n,at)=>n+value(g,t.to,at),0);
  const dangerous=t.take.some(at=>ownsSet(after,t.from,at))&&!t.give.some(at=>ownsSet(after,t.to,at));
  const fees=t.give.reduce((n,at)=>n+(g.properties[at].mortgaged?interest(BOARD[at].mortgage):0),0);
  return gain/MONEY_SCALE>=(loss/MONEY_SCALE)*(dangerous?1.25:1.03)+fees/MONEY_SCALE&&g.players[t.to].cash+t.giveCash-t.takeCash>=fees;
}
function offer(g,id){
  if(g.tradeAttempts>=2)return null;const p=g.players[id];
  for(const b of BOARD){const x=g.properties[b.id];if(b.type!=='street'||x.owner===null||x.owner===id||x.mortgaged||!groupIds(b.id).every(i=>i===b.id||g.properties[i].owner===id)||!groupIds(b.id).every(i=>g.properties[i].level===0))continue;
    const offerCash=cash(Math.ceil((b.price/MONEY_SCALE+85)*1.3));if(p.cash>offerCash+cash(100))return {type:'trade',to:x.owner,give:[],take:[b.id],giveCash:offerCash,takeCash:0};
    const other=BOARD.find(o=>o.type==='street'&&g.properties[o.id].owner===id&&!g.properties[o.id].mortgaged&&o.group!==b.group&&groupIds(o.id).every(i=>g.properties[i].level===0)&&groupIds(o.id).every(i=>i===o.id||g.properties[i].owner===x.owner));
    if(other)return {type:'trade',to:x.owner,give:[other.id],take:[b.id],giveCash:0,takeCash:0};
  }return null;
}
export function chooseAction(g){
  const id=actor(g);if(id===null)return null;const p=g.players[id];
  if(g.phase==='trade')return {type:accepts(g,g.trade)?'acceptTrade':'rejectTrade'};
  if(g.phase==='buy'){const b=BOARD[g.pending],reserve=p.cash>cash(400)?cash(100):0;return {type:p.cash-b.price>=reserve?'buy':'skipBuy'};}
  if(g.phase==='debt'){
    const mortgage=BOARD.filter(b=>canMortgage(g,id,b.id)).sort((a,b)=>Number(ownsSet(g,id,a.id))-Number(ownsSet(g,id,b.id))||a.price-b.price)[0];
    if(mortgage)return {type:'mortgage',property:mortgage.id};
    const sell=BOARD.filter(b=>canSell(g,id,b.id)).sort((a,b)=>b.build-a.build)[0];if(sell)return {type:'sell',property:sell.id};
    const group=BOARD.find(b=>g.properties[b.id]?.owner===id&&g.properties[b.id].level>0);if(group)return {type:'sellGroup',property:group.id};
    if(liquidation(g,id)<g.debt.amount)return {type:'bankrupt'};
    throw Error('No legal liquidation action');
  }
  if(g.phase==='roll'){
    if(p.jail&&p.cards.length)return {type:'jailCard'};
    if(p.jail&&p.cash>cash(250)&&g.round<12)return {type:'jailPay'};
    return {type:'roll'};
  }
  const build=BOARD.filter(b=>canBuild(g,id,b.id)&&p.cash-b.build>=cash(100)).sort((a,b)=>a.build-b.build||g.properties[a.id].level-g.properties[b.id].level)[0];if(build)return {type:'build',property:build.id};
  const redeem=BOARD.find(b=>canRedeem(g,id,b.id)&&p.cash-redemption(b.mortgage)>cash(350));if(redeem)return {type:'redeem',property:redeem.id};
  return offer(g,id)||{type:'end'};
}
export function botStep(g,rng){return applyAction(g,actor(g),chooseAction(g),rng);}
