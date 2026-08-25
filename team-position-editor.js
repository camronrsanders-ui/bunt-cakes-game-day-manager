(()=>{
  const POS=['Pitcher','Catcher','First Base','Second Base','Third Base','Shortstop','Left Field','Left Center Field','Center Field','Right Center Field','Right Field'];
  const STYLE_ID='team-position-editor-style';
  let saving=false;

  function authenticatedName(){
    const access=typeof state!=='undefined'&&state&&state.playerAccess;
    return access&&access.paired===true?String(access.playerName||'').trim():'';
  }
  function liveInning(){return Math.min(7,Math.max(1,Number(state&&state.gameInning)||1));}
  function currentPosition(name,inning){
    const inn=(state&&state.innings&&state.innings[inning])||{};
    return POS.find(pos=>inn[pos]===name)||'';
  }
  function occupant(pos,inning){return ((state&&state.innings&&state.innings[inning])||{})[pos]||'';}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .team-position-editor{border:2px solid #b7d7b8;background:#fbfff8}
      .team-position-editor .position-editor-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .team-position-editor .position-editor-kicker{font-size:.76rem;font-weight:900;letter-spacing:.08em;color:#166534;margin-bottom:3px}
      .team-position-editor .position-editor-current{font-size:1.15rem;font-weight:900;color:#0f5132}
      .team-position-editor select{width:100%;min-height:48px;margin-top:10px;border:1px solid #a7c9aa;border-radius:12px;padding:10px 12px;background:#fff;font:inherit}
      .team-position-editor .position-editor-status{margin-top:8px;font-size:.9rem}
      .team-position-editor .position-editor-note{margin-top:7px;font-size:.86rem;color:#66736b}
      .team-position-editor .position-editor-saving{color:#166534;font-weight:800}
      .team-position-editor .position-editor-error{color:#991b1b;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  function optionHtml(name,inning,current){
    let html='<option value="Rest" '+(!current?'selected':'')+'>Rest / not fielding this inning</option>';
    for(const pos of POS){
      const who=occupant(pos,inning);
      let label=pos;
      if(who&&who!==name)label+=' — '+who+' (swap)';
      else if(!who)label+=' — open';
      else label+=' — you';
      html+='<option value="'+escapeHtml(pos)+'" '+(current===pos?'selected':'')+'>'+escapeHtml(label)+'</option>';
    }
    return html;
  }

  function mount(){
    if(typeof state==='undefined'||!state)return;
    const section=document.getElementById('lineup');
    if(!section)return;
    const name=authenticatedName();
    let card=document.getElementById('teamPositionEditor');
    ensureStyle();
    if(!card){
      card=document.createElement('div');
      card.id='teamPositionEditor';
      card.className='card team-position-editor';
      const first=section.querySelector('.card');
      if(first)first.insertAdjacentElement('afterend',card);else section.prepend(card);
    }
    if(!name){
      card.innerHTML='<div class="position-editor-kicker">MY LIVE FIELD POSITION</div><strong>Player access required</strong><div class="position-editor-note">Player access is required to change your live field position. Ask your captain for a new setup link.</div>';
      return;
    }
    const roster=(state.players||[]).some(p=>p&&p.name===name);
    if(!roster){card.innerHTML='<div class="position-editor-kicker">MY LIVE FIELD POSITION</div><strong>Player access required</strong><div class="position-editor-note">Your paired player is no longer on this roster. Ask your captain for a new setup link.</div>';return;}
    const inning=liveInning();
    const current=currentPosition(name,inning);
    card.innerHTML='<div class="position-editor-top"><div><div class="position-editor-kicker">MY LIVE FIELD POSITION</div><div><strong>'+escapeHtml(name)+'</strong> • Inning '+inning+'</div><div class="position-editor-current">'+escapeHtml(current||'Rest / not fielding')+'</div></div><span class="pill">Updates both views</span></div><label><span class="muted">Change my position</span><select id="teamPositionSelect" '+(saving?'disabled':'')+'>'+optionHtml(name,inning,current)+'</select></label><div id="teamPositionStatus" class="position-editor-status muted">Choose an open spot, or choose an occupied spot to swap positions.</div><div class="position-editor-note">Only your live-inning assignment changes. The captain sees the same lineup automatically.</div>';
    const select=document.getElementById('teamPositionSelect');
    if(select)select.onchange=()=>changePosition(select.value);
  }

  async function changePosition(position){
    if(saving)return;
    const name=authenticatedName();
    if(!name){mount();return;}
    const inning=liveInning();
    const current=currentPosition(name,inning);
    const target=position==='Rest'?'':position;
    if(target===current||(!target&&!current)){mount();return;}
    const who=target?occupant(target,inning):'';
    if(who&&who!==name){
      if(!current){
        alert(target+' is currently assigned to '+who+'. Choose an open position because you are not currently fielding.');
        mount();
        return;
      }
      if(!confirm(target+' is currently '+who+'. Swap your '+current+' assignment with '+who+'?')){mount();return;}
    }
    saving=true;
    mount();
    const status=document.getElementById('teamPositionStatus');
    if(status){status.className='position-editor-status position-editor-saving';status.textContent='Updating live lineup…';}
    try{
      const response=await fetch('/api/team-state',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        cache:'no-store',
        body:JSON.stringify({action:'field-position',playerName:name,position:position})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not update your position');
      if(data.inningState&&state&&state.innings)state.innings[data.inning]=data.inningState;
      if(typeof renderLineup==='function')renderLineup();
      const nextStatus=document.getElementById('teamPositionStatus');
      if(nextStatus){
        nextStatus.className='position-editor-status position-editor-saving';
        nextStatus.textContent=data.swappedWith?'Saved live • swapped with '+data.swappedWith:'Saved live • captain updated';
      }
      if(typeof window.teamGameDayRefresh==='function')await window.teamGameDayRefresh();
    }catch(error){
      const failed=document.getElementById('teamPositionStatus');
      if(failed){failed.className='position-editor-status position-editor-error';failed.textContent=error.message||'Could not update your position';}
      setTimeout(()=>{if(typeof window.teamGameDayRefresh==='function')window.teamGameDayRefresh();},500);
    }finally{
      saving=false;
      setTimeout(mount,150);
    }
  }

  const wait=setInterval(()=>{
    if(typeof state!=='undefined'&&state&&document.getElementById('lineup')){clearInterval(wait);mount();}
  },200);
  window.addEventListener('teamplayeraccesschange',mount);
  window.addEventListener('buntpreferrednamesrefresh',mount);
  window.addEventListener('pageshow',mount);
  window.addEventListener('focus',mount);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)mount();});
})();
