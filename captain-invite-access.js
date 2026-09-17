(function(){
  const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
  const teamSlug=()=>String(window.__teamSlug||'').trim().toLowerCase();
  const captainPath=()=>window.__teamPath&&window.__teamPath.captain||('/captain/'+teamSlug());
  let viewerRole='';
  let roleLoading=false;

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
      area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
      if(document.execCommand('copy'))return true;
    }catch(_){}finally{if(area)area.remove();}
    window.prompt('Copy this Captain invite link:',value);return false;
  }

  function inviteToken(){try{return new URLSearchParams(location.hash.slice(1)).get('captain-invite')||''}catch(_){return''}}
  function clearInviteHash(path){const next=path||captainPath()||location.pathname;history.replaceState(null,'',next+location.search)}

  function mountInviteAcceptance(){
    const token=inviteToken();if(!token)return false;
    const login=document.getElementById('login');if(!login)return false;
    if(!TOKEN_RE.test(token)){const msg=document.getElementById('loginMsg');if(msg)msg.textContent='This Captain invite is no longer valid. Ask your team owner to send a fresh invite.';clearInviteHash();return true}
    if(login.dataset.captainInviteMounted==='1')return true;
    login.dataset.captainInviteMounted='1';const currentTeam=teamSlug();
    login.innerHTML=`
      <h1>You're invited as a Captain</h1>
      <p class="muted">Use this page once and FeildHaus will add Captain access to this team.</p>
      <div style="padding:10px 12px;border-radius:12px;background:#ecfdf5;margin:10px 0 14px"><strong>Already have a FeildHaus Captain account?</strong><div class="muted">Enter the same email and password you normally use. You do not need to make another account.</div></div>
      <form id="captainInviteForm" class="stack">
        <label>Your name <span class="muted">— only needed if this is your first Captain account</span><input id="captainInviteName" autocomplete="name" placeholder="Your name"></label>
        <label>Email<input id="captainInviteEmail" type="email" inputmode="email" autocapitalize="none" autocomplete="username" required placeholder="you@example.com"></label>
        <label>Password<input id="captainInvitePassword" type="password" autocomplete="current-password" required placeholder="Your password"></label>
        <button id="captainInviteJoin" class="primary" type="submit">Accept Captain Invite</button>
        <div class="muted">First time here? Enter your name, email, and create a password with at least 10 characters.</div>
        <div id="captainInviteMessage" role="status" aria-live="polite" style="font-weight:700"></div>
      </form>`;
    const form=document.getElementById('captainInviteForm'),button=document.getElementById('captainInviteJoin'),message=document.getElementById('captainInviteMessage');
    form.onsubmit=async event=>{
      event.preventDefault();if(!currentTeam){message.textContent='This team link is invalid. Ask the team owner for a new invite.';return}
      button.disabled=true;button.textContent='Adding you…';message.textContent='';
      try{
        const result=await jsonFetch('/api/captains',{method:'POST',body:JSON.stringify({action:'accept-invite',teamSlug:currentTeam,inviteToken:token,displayName:document.getElementById('captainInviteName').value.trim(),email:document.getElementById('captainInviteEmail').value.trim(),password:document.getElementById('captainInvitePassword').value})});
        message.textContent='Success! Opening your Captain page…';clearInviteHash(result.captainUrl||captainPath());location.assign(result.captainUrl||captainPath());
      }catch(error){
        const raw=String(error.message||'');
        if(/invalid or expired/i.test(raw))message.textContent='This invite is no longer valid. Ask the team owner to send a fresh invite.';
        else if(/email and password/i.test(raw))message.textContent='Enter your email and password, then tap Accept Captain Invite.';
        else if(/that email and password/i.test(raw))message.textContent='That email/password did not match an existing Captain account. Check the spelling and try again.';
        else if(/name and password of at least 10/i.test(raw))message.textContent='For a new Captain account, add your name and choose a password with at least 10 characters.';
        else message.textContent=raw||'Could not accept this invite. Please try again.';
        button.disabled=false;button.textContent='Accept Captain Invite';
      }
    };return true;
  }

  async function loadViewerRole(){if(viewerRole||roleLoading)return;roleLoading=true;try{const data=await jsonFetch('/api/captains');viewerRole=String(data.viewerRole||'')}catch(_){viewerRole='captain'}finally{roleLoading=false}}
  function hideLegacyCaptainEditor(){const save=document.getElementById('saveCaptain');const card=save&&save.closest('.card');if(card)card.style.display='none'}

  function mountCreateCard(){
    const manager=document.getElementById('manager'),access=document.getElementById('access');hideLegacyCaptainEditor();
    if(!manager||manager.classList.contains('hidden')||!access||document.getElementById('captainInviteCard'))return false;
    if(viewerRole!=='owner'){loadViewerRole();return false}
    const card=document.createElement('div');card.id='captainInviteCard';card.className='card';
    card.innerHTML=`<div><strong>Add another Captain</strong><div class="muted">Tap below, then send the link by text or message. Only the newest link works; making a new one automatically replaces the old one.</div></div><div class="row wrap" style="margin-top:10px"><button id="createCaptainInvite" class="primary" type="button">Create Captain Invite</button><button id="shareCaptainInvite" type="button" style="display:none">Share Invite</button></div><div id="captainInviteNotice" class="muted" style="margin-top:8px" aria-live="polite"></div>`;
    const share=access.querySelector('.card');if(share&&share.nextSibling)access.insertBefore(card,share.nextSibling);else access.appendChild(card);
    const button=document.getElementById('createCaptainInvite'),shareButton=document.getElementById('shareCaptainInvite'),notice=document.getElementById('captainInviteNotice');let latestUrl='';
    async function createInvite(){
      button.disabled=true;button.textContent='Creating…';notice.textContent='';
      try{
        const result=await jsonFetch('/api/captains',{method:'POST',body:JSON.stringify({action:'create-invite'})});
        const absolute=new URL(String(result.inviteUrl||''),location.origin),token=new URLSearchParams(absolute.hash.slice(1)).get('captain-invite')||'',expectedPath=captainPath().replace(/\/$/,'');
        if(absolute.origin!==location.origin||absolute.pathname.replace(/\/$/,'')!==expectedPath||!TOKEN_RE.test(token))throw new Error('Could not create a valid Captain invite link.');
        latestUrl=absolute.href;const expires=result.expiresAt?new Date(result.expiresAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}):'';
        if(navigator.share){shareButton.style.display='';shareButton.onclick=async()=>{try{await navigator.share({title:'FeildHaus Captain Invite',text:'Tap this link to join our team as a Captain in FeildHaus:',url:latestUrl})}catch(_){}}}
        const copied=await copyText(latestUrl);notice.textContent=(copied?'Invite copied — paste it into a text to the Captain.':'Invite ready — tap Share Invite to send it.')+(expires?' It expires '+expires+'.':'')+' If you create another invite, this one will stop working.';
        button.textContent='Create New Invite';button.disabled=false;
      }catch(error){notice.textContent=error.message||'Could not create a Captain invite.';button.disabled=false;button.textContent='Create Captain Invite'}
    }
    button.onclick=createInvite;return true;
  }

  mountInviteAcceptance();hideLegacyCaptainEditor();loadViewerRole();
  const timer=setInterval(()=>{mountInviteAcceptance();if(mountCreateCard()&&!inviteToken())clearInterval(timer)},180);
})();
