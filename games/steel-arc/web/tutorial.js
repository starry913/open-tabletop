// One manual for solo battles and friend rooms.
export function createTutorial({online=false,onOpen=()=>{},onClose=()=>{}}={}){
  const dialog=document.createElement('dialog');
  dialog.className='steel-tutorial';dialog.setAttribute('aria-labelledby','steel-tutorial-title');
  dialog.innerHTML=`<header><span>钢铁远征 · 全模式通用</span><h2 id="steel-tutorial-title">先移动，再瞄准，最后开火。</h2><p>轮到你时行动，击毁敌方全部坦克就获胜。</p></header>
    <div class="steel-tutorial-grid">
      <article><b>01 · 找位置</b><h3>A / D 左右移动</h3><p>移动消耗燃料，自己的新回合会补满。停下来，镜头会拉远，让你看见敌人。</p></article>
      <article><b>02 · 拉圆盘</b><h3>向后拉，往反方向打</h3><p>拖动左下瞄准盘：<strong>往左下拉 ↙，炮弹往右上飞 ↗</strong>。拉得越远，力度越大。</p><small>也可用 W / S 调方向，Q / E 调力度。</small></article>
      <article><b>03 · 选弹开火</b><h3>点“开火”或按空格</h3><p>底部点选炮弹，也可按 1–7 切换。<strong>松开瞄准盘不会发射</strong>；确认后再开火，随后轮到下一辆坦克。</p></article>
    </div>
    <div class="steel-tutorial-tips"><p><b>炮弹图鉴</b></p><p><strong>共同弹道规则</strong>：所有炮弹都沿校准弹的同一条基础弹道飞行；相同角度和力度下，飞行速度、重力和落点一致。差异只发生在命中后的伤害、范围和特殊效果，方便用校准弹练习后切换炮弹。</p><p><strong>1 · 校准弹</strong>：无限弹药，稳定试射，适合练习和修正角度。</p><p><strong>2 · 反弹棱镜弹</strong>：沿相同弹道飞行，碰到地形后最多反弹两次，再寻找角度命中掩体后的敌人。</p><p><strong>3 · 黏着燃烧弹</strong>：沿相同弹道命中后灼烧目标两回合；坦克着火时会显示持续火焰。</p><p><strong>4 · 地脉裂变弹</strong>：沿相同弹道飞行，爆炸范围和削地形能力强，适合切断高地、破坏敌人脚下的平台。</p><p><strong>5 · 引力坍缩弹</strong>：第三档特殊弹，沿相同弹道命中后制造引力核心，把附近敌人拉向中心再爆炸；它不会自动追踪，仍需要瞄准。</p><p><strong>6 · 核爆弹</strong>：四档终极爆发，沿相同弹道飞行，伤害、范围和地形破坏最高，但爆炸范围也可能波及自己。</p><p><strong>7 · 蜂巢母弹</strong>：四档高风险覆盖弹，沿相同弹道飞到最高点后分裂成 5 枚子弹，覆盖一整片区域。</p><p><b>解锁与补给</b>第 1～2 回合只有校准弹；第 3～4 回合开放两种二档弹；第 5 回合开放两种三档弹。补给有 50% 概率恢复 30 生命，50% 概率随机给一发核爆弹或蜂巢母弹；生命已满时，治疗补给会自动转换为一发四档炮弹，不会空拿。</p></div>
    <footer><p>${online?'好友房不会暂停，回合倒计时继续。':'查看教程时，单人战斗暂停。'}<br>按 Esc 或点击右侧按钮关闭。</p><button type="button" autofocus>知道了，返回游戏</button></footer>`;
  document.body.append(dialog);
  let previousFocus=null;
  const close=()=>{if(!dialog.open)return;dialog.close();onClose();if(previousFocus?.isConnected)previousFocus.focus();};
  dialog.querySelector('button').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  // Capture before game hotkeys: reading must never move a tank or fire a shell.
  window.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    event.stopImmediatePropagation();
    if(event.code==='Escape'){event.preventDefault();close();}
  },true);
  window.addEventListener('keyup',event=>{if(dialog.open)event.stopImmediatePropagation();},true);
  return {get isOpen(){return dialog.open;},open(){if(dialog.open)return;previousFocus=document.activeElement;onOpen();dialog.showModal();},close};
}
