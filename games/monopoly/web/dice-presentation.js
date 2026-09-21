export const DICE_ROLL_MS=1100;

// Reveal the complete result together, after the animation. Never sample RNG here.
export function createDicePresentation({onReveal=()=>{},duration=()=>DICE_ROLL_MS,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let shown=null,pending=null,timer=null,rolling=false,elapsed=false,generation=0;
  function finish(){if(!rolling||!elapsed||!pending)return;shown=pending;pending=null;rolling=false;onReveal();}
  function begin(){
    if(rolling||!shown)return false;
    rolling=true;elapsed=false;const current=++generation;
    timer=setTimer(()=>{if(current!==generation)return;timer=null;elapsed=true;finish();},duration());
    return true;
  }
  function reset(next){
    if(timer!==null)clearTimer(timer);
    generation++;timer=null;rolling=false;elapsed=false;pending=null;shown=structuredClone(next);
    return shown;
  }
  return {get rolling(){return rolling;},begin,reset,sync(next){
    if(!shown||next.diceId<shown.diceId)return reset(next);
    if(next.diceId>shown.diceId){
      begin();pending=structuredClone(next);
      if(elapsed){shown=pending;pending=null;rolling=false;}
    }else if(!rolling)shown=structuredClone(next);
    return shown;
  }};
}

const pipMap={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const angles={1:[-16,-20],2:[-16,-110],3:[-106,-20],4:[74,-20],5:[-16,70],6:[-16,160]};
export function paintDice(root,values,rolling){
  if(root.children.length!==values.length||!root.querySelector('.dice-cube')){
    root.innerHTML=values.map((_,i)=>`<div class="die-shell" style="--die-index:${i}" aria-hidden="true"><div class="dice-cube">${[1,2,3,4,5,6].map(n=>`<div class="cube-face face-${n}">${Array.from({length:9},(_,p)=>`<i class="${pipMap[n].includes(p)?'pip':''}"></i>`).join('')}</div>`).join('')}</div></div>`).join('');
  }
  if(!rolling)for(const [i,value]of values.entries()){
    const cube=root.children[i].querySelector('.dice-cube'),[x,y]=angles[value];
    cube.style.setProperty('--rest-x',x+'deg');cube.style.setProperty('--rest-y',y+'deg');cube.dataset.value=String(value);
  }
  root.classList.toggle('is-rolling',rolling);
  root.setAttribute('aria-busy',String(rolling));
  root.setAttribute('aria-live','polite');
  root.setAttribute('aria-label',rolling?'骰子旋转中，等待停稳':`骰子 ${values.join(' 和 ')} 点`);
}
