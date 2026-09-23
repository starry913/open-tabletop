import {MIN_POWER,MAX_POWER,POWER_SPAN} from './aim-limits.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createFineAimControls({container,getValues,onChange}){
  const root=document.createElement('div');root.className='fine-aim-controls';root.setAttribute('aria-label','角度和力度精确调整');
  root.innerHTML=['heading','power'].map((id,index)=>`<div class="fine-step" data-fine="${id}"><button type="button" data-step="-1" aria-label="${index?'力度':'角度'}减一">−</button><button type="button" data-step="1" aria-label="${index?'力度':'角度'}加一">＋</button></div>`).join('');
  container.append(root);
  // Keep native button activation, without also triggering the global fire shortcut.
  root.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter')event.stopPropagation();});
  const apply=(kind,delta)=>{const values=getValues(),next=kind==='heading'?{heading:(Math.round(values.heading)+delta+360)%360}:{power:clamp(Math.round(values.power)+delta,MIN_POWER,MAX_POWER)};const accepted=onChange(next)!==false;update(accepted?{...values,...next}:getValues());};
  for(const group of root.querySelectorAll('.fine-step')){
    const kind=group.dataset.fine;
    group.addEventListener('click',event=>{const button=event.target.closest('[data-step]');if(button)apply(kind,Number(button.dataset.step));});
    group.addEventListener('wheel',event=>{event.preventDefault();apply(kind,event.deltaY>0?-1:1);},{passive:false});
  }
  function update({heading,power}=getValues()){
    const force=Math.round(power);root.querySelector('[data-fine="power"] [data-step="-1"]').disabled=force<=20;root.querySelector('[data-fine="power"] [data-step="1"]').disabled=force>=MAX_POWER;
  }
  update();return {root,update};
}
