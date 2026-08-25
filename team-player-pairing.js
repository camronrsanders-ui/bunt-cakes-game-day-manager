(function(){
  const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
  const SUCCESS_KEY=window.__teamStorageKey?window.__teamStorageKey('playerPairSuccess'):'teamgameday:playerPairSuccess';
  const PLAYER_KEY=window.__teamStorageKey?window.__teamStorageKey('playerName'):'teamgameday:playerName';
  const FAILURE='This player setup link is invalid or expired. Ask your captain for a new setup link.';

  function onReady(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function showNotice(message,kind){
    onReady(function(){
      const host=document.querySelector('.app')||document.body;
      if(!host)return;
      let box=document.getElementById('playerPairNotice');
      if(!box){
        box=document.createElement('div');
        box.id='playerPairNotice';
        box.className='card';
        box.style.position='fixed';
        box.style.zIndex='10040';
        box.style.top='12px';
        box.style.left='12px';
        box.style.right='12px';
        box.style.maxWidth='620px';
        box.style.margin='0 auto';
        box.style.boxShadow='0 12px 32px rgba(0,0,0,.22)';
        host.prepend(box);
      }
      box.dataset.noticeKind=kind;
      box.setAttribute('role',kind==='success'?'status':'alert');
      box.style.borderColor=kind==='success'?'#86efac':'#fecaca';
      box.style.background=kind==='success'?'#f0fdf4':'#fef2f2';
      box.textContent=message;
      if(kind==='success')setTimeout(function(){if(box.dataset.noticeKind==='success')box.remove();},6000);
    });
  }

  function takeSuccessMarker(){
    try{
      const name=sessionStorage.getItem(SUCCESS_KEY)||'';
      sessionStorage.removeItem(SUCCESS_KEY);
      return name;
    }catch(_){return'';}
  }

  const successName=takeSuccessMarker();
  if(successName)showNotice('Player access connected for '+successName+'.','success');

  const hash=String(location.hash||'');
  if(!hash)return;
  const params=new URLSearchParams(hash.slice(1));
  const rawToken=params.get('pair');
  if(rawToken===null)return;

  try{
    history.replaceState(history.state,'',location.pathname+location.search);
  }catch(_){
    return;
  }

  if(!TOKEN_RE.test(rawToken)){
    showNotice(FAILURE,'error');
    return;
  }

  fetch('/api/team-state',{
    method:'POST',
    credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'pair-player',inviteToken:rawToken})
  }).then(async function(response){
    const data=await response.json().catch(function(){return{};});
    if(!response.ok||!data||data.paired!==true||typeof data.playerName!=='string'||!data.playerName.trim())throw new Error('PAIR_FAILED');
    const playerName=data.playerName.trim();
    try{localStorage.setItem(PLAYER_KEY,playerName);}catch(_){}
    try{sessionStorage.setItem(SUCCESS_KEY,playerName);}catch(_){}
    const next=new URL(location.href);
    next.hash='';
    next.searchParams.set('player',playerName);
    location.replace(next.pathname+next.search);
  }).catch(function(){
    showNotice(FAILURE,'error');
  });
})();
