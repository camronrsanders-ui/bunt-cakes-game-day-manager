(()=>{
  const FOUNDER='those-dirty-bunt-cakes';
  const current=()=>window.__teamSlug||FOUNDER;
  let session=null;

  async function jsonFetch(url,opt={}){
    const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||`Request failed (${r.status})`);
    return j;
  }

  function neutralizeLinkText(){
    const slug=current();
    const values={teamLink:`/team/${slug}`,captainLink:`/captain/${slug}`,settingsPlayerLink:`/team/${slug}`};
    Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value});
  }

  function mountDangerZone(){
    const section=document.getElementById('team-settings');
    if(!section||!session||document.getElementById('accountDangerZone'))return false;
    const isOwner=session.team&&session.team.role==='owner';
    const owned=(session.teams||[]).filter(t=>t.role==='owner');
    const card=document.createElement('div');
    card.id='accountDangerZone';
    card.className='card';
    card.style.cssText='border:2px solid #fecaca;background:#fff7f7';
    card.innerHTML=`<div><strong style="color:#991b1b">Danger Zone</strong><div class="muted">Permanent actions. These cannot be undone.</div></div>
      ${isOwner?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid #fecaca"><strong>Delete this team</strong><div class="muted">Deletes this team workspace, roster, schedule, lineups, responses, resources, links, and captain memberships.</div><button id="deleteCurrentTeam" class="danger" type="button" style="margin-top:9px;border-color:#dc2626;color:#b91c1c">Delete this team</button><div id="deleteTeamMsg" class="muted"></div></div>`:''}
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #fecaca"><strong>Delete my account</strong><div class="muted">Removes your login from every team. It also permanently deletes every team you own${owned.length?` (${owned.length} team${owned.length===1?'':'s'})`:''}.</div><button id="deleteMyAccount" class="danger" type="button" style="margin-top:9px;border-color:#dc2626;color:#b91c1c">Delete my account</button><div id="deleteAccountMsg" class="muted"></div></div>`;
    section.appendChild(card);

    const deleteTeam=document.getElementById('deleteCurrentTeam');
    if(deleteTeam)deleteTeam.onclick=async()=>{
      const slug=current();
      const typed=prompt(`This permanently deletes this team.\n\nType ${slug} to confirm:`);
      if(typed===null)return;
      if(typed!==slug){alert('Team was not deleted. The confirmation did not match.');return;}
      deleteTeam.disabled=true;deleteTeam.textContent='Deleting team…';
      const msg=document.getElementById('deleteTeamMsg');if(msg)msg.textContent='Deleting…';
      try{
        const r=await jsonFetch(`/api/account?team=${encodeURIComponent(slug)}`,{method:'POST',body:JSON.stringify({action:'delete-team',confirmSlug:typed})});
        location.href=r.nextCaptainUrl||'/start';
      }catch(e){if(msg)msg.textContent=e.message;deleteTeam.disabled=false;deleteTeam.textContent='Delete this team'}
    };

    const deleteAccount=document.getElementById('deleteMyAccount');
    if(deleteAccount)deleteAccount.onclick=async()=>{
      const typed=prompt('This permanently deletes your account and every team you own.\n\nType DELETE MY ACCOUNT to confirm:');
      if(typed===null)return;
      if(typed!=='DELETE MY ACCOUNT'){alert('Account was not deleted. The confirmation did not match.');return;}
      deleteAccount.disabled=true;deleteAccount.textContent='Deleting account…';
      const msg=document.getElementById('deleteAccountMsg');if(msg)msg.textContent='Deleting…';
      try{
        await jsonFetch('/api/account',{method:'POST',body:JSON.stringify({action:'delete-account',confirm:typed})});
        location.href='/start';
      }catch(e){if(msg)msg.textContent=e.message;deleteAccount.disabled=false;deleteAccount.textContent='Delete my account'}
    };
    return true;
  }

  async function init(){
    try{session=await jsonFetch('/api/session')}catch(_){return}
    if(!session.accountAuthenticated)return;
    neutralizeLinkText();
    const observer=new MutationObserver(neutralizeLinkText);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    const timer=setInterval(()=>{neutralizeLinkText();if(mountDangerZone())clearInterval(timer)},180);
  }

  const wait=setInterval(()=>{if(document.body){clearInterval(wait);init()}},80);
})();
