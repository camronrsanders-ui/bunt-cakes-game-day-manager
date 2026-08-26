(function(){
  const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
  const teamSlug=()=>String(window.__teamSlug||'').trim().toLowerCase();
  const captainPath=()=>window.__teamPath&&window.__teamPath.captain||('/captain/'+teamSlug());

  async function jsonFetch(url,opt={}){
    const response=await fetch(url,{credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
    return data;
  }

  async function copyText(value){
    if(navigator.clipboard&&typeof navigator.clipboard.writeText==='function'){
      try{await navigator.clipboard.writeText(value);return true}catch(_){}
    }
    let area=null;
    try{
      area=document.createElement('textarea');
      area.value=value;
      area.setAttribute('readonly','');
      area.style.position='fixed';
      area.style.opacity='0';
      document.body.appendChild(area);
      area.select();
      if(document.execCommand('copy'))return true;
    }catch(_){}finally{if(area)area.remove();}
    window.prompt('Copy this Captain invite link:',value);
    return false;
  }

  function inviteToken(){
    try{return new URLSearchParams(location.hash.slice(1)).get('captain-invite')||''}catch(_){return''}
  }

  function clearInviteHash(path){
    const next=path||captainPath()||location.pathname;
    history.replaceState(null,'',next+location.search);
  }

  function mountInviteAcceptance(){
    const token=inviteToken();
    if(!token)return false;
    const login=document.getElementById('login');
    if(!login)return false;
    if(!TOKEN_RE.test(token)){
      const msg=document.getElementById('loginMsg');
      if(msg)msg.textContent='This Captain invite is invalid or expired.';
      clearInviteHash();
      return true;
    }
    if(login.dataset.captainInviteMounted==='1')return true;
    login.dataset.captainInviteMounted='1';
    const currentTeam=teamSlug();
    login.innerHTML=`
      <h1>Join as Captain</h1>
      <p class="muted">This one-time invite adds your Captain account to this team only. It expires after 7 days.</p>
      <form id="captainInviteForm" class="stack">
        <label>Name <span class="muted">(required for a new account)</span><input id="captainInviteName" autocomplete="name"></label>
        <label>Email<input id="captainInviteEmail" type="email" autocomplete="username" required></label>
        <label>Password<input id="captainInvitePassword" type="password" autocomplete="current-password" required></label>
        <button id="captainInviteJoin" class="primary" type="submit">Join team as Captain</button>
        <div class="muted">Already have a Captain account? Use its current email and password. New Captains need a name and a password of at least 10 characters.</div>
        <div id="captainInviteMessage" class="muted"></div>
      </form>`;
    const form=document.getElementById('captainInviteForm');
    const button=document.getElementById('captainInviteJoin');
    const message=document.getElementById('captainInviteMessage');
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!currentTeam){message.textContent='This team link is invalid.';return;}
      button.disabled=true;button.textContent='Joining…';message.textContent='';
      try{
        const result=await jsonFetch('/api/captains',{method:'POST',body:JSON.stringify({
          action:'accept-invite',teamSlug:currentTeam,inviteToken:token,
          displayName:document.getElementById('captainInviteName').value.trim(),
          email:document.getElementById('captainInviteEmail').value.trim(),
          password:document.getElementById('captainInvitePassword').value
        })});
        clearInviteHash(result.captainUrl||captainPath());
        location.reload();
      }catch(error){
        message.textContent=error.message||'Could not accept this Captain invite.';
        button.disabled=false;button.textContent='Join team as Captain';
      }
    };
    return true;
  }

  function mountCreateCard(){
    const manager=document.getElementById('manager'),access=document.getElementById('access');
    if(!manager||manager.classList.contains('hidden')||!access||document.getElementById('captainInviteCard'))return false;
    const card=document.createElement('div');
    card.id='captainInviteCard';card.className='card';
    card.innerHTML=`<div class="row wrap"><div><strong>Captain invite link</strong><div class="muted">Create a one-time, 7-day link for a new or existing Captain. It grants access to this team only.</div></div><button id="createCaptainInvite" class="primary" type="button">Create & copy invite</button></div><div id="captainInviteNotice" class="muted" style="margin-top:8px"></div>`;
    const share=access.querySelector('.card');
    if(share&&share.nextSibling)access.insertBefore(card,share.nextSibling);else access.appendChild(card);
    const button=document.getElementById('createCaptainInvite'),notice=document.getElementById('captainInviteNotice');
    button.onclick=async()=>{
      button.disabled=true;button.textContent='Creating…';notice.textContent='';
      try{
        const result=await jsonFetch('/api/captains',{method:'POST',body:JSON.stringify({action:'create-invite'})});
        const absolute=new URL(String(result.inviteUrl||''),location.origin);
        const token=new URLSearchParams(absolute.hash.slice(1)).get('captain-invite')||'';
        const expectedPath=captainPath().replace(/\/$/,'');
        if(absolute.origin!==location.origin||absolute.pathname.replace(/\/$/,'')!==expectedPath||!TOKEN_RE.test(token))throw new Error('Could not create a valid Captain invite link.');
        const copied=await copyText(absolute.href);
        const expires=result.expiresAt?new Date(result.expiresAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}):'';
        notice.textContent=(copied?'Captain invite copied.':'Captain invite created.')+(expires?' Expires '+expires+'.':'');
        button.textContent=copied?'Copied':'Invite created';
        setTimeout(()=>{button.disabled=false;button.textContent='Create & copy invite';},1600);
      }catch(error){
        notice.textContent=error.message||'Could not create a Captain invite.';
        button.disabled=false;button.textContent='Create & copy invite';
      }
    };
    return true;
  }

  mountInviteAcceptance();
  const timer=setInterval(()=>{
    mountInviteAcceptance();
    if(mountCreateCard()&&!inviteToken())clearInterval(timer);
  },180);
})();
