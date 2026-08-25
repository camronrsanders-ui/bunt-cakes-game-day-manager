(()=>{
  const FOUNDER='those-dirty-bunt-cakes';
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeExternalUrl=value=>{const raw=String(value||'').trim();if(!raw)return'';try{const parsed=new URL(raw);return parsed.protocol==='https:'||parsed.protocol==='http:'?parsed.href:''}catch(_){return''}};
  const current=()=>window.__teamSlug||FOUNDER;
  const tz=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  let session=null;

  async function jsonFetch(url,opt={}){const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`Request failed (${r.status})`);return j}
  function setShareLinks(){const slug=current(),team=`${location.origin}/team/${slug}`,captain=`${location.origin}/captain/${slug}`;const t=document.getElementById('teamLink'),c=document.getElementById('captainLink');if(t)t.textContent=team;if(c)c.textContent=captain;const copy=document.getElementById('copyTeam');if(copy)copy.onclick=()=>navigator.clipboard.writeText(team)}

  function mountSwitcher(){
    const header=document.querySelector('#manager > .row.wrap');if(!header||!session||!session.teams?.length||document.getElementById('teamWorkspaceSwitcher'))return;
    const right=header.lastElementChild;if(!right)return;const wrap=document.createElement('span');wrap.id='teamWorkspaceSwitcher';wrap.style.cssText='display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;margin-right:6px';
    const select=document.createElement('select');select.setAttribute('aria-label','Team workspace');select.style.cssText='width:auto;max-width:220px;margin:0;padding:8px';select.innerHTML=session.teams.map(t=>`<option value="${esc(t.slug)}" ${t.slug===current()?'selected':''}>${esc(t.name||'Untitled Team')}</option>`).join('');select.onchange=()=>location.href=`/captain/${encodeURIComponent(select.value)}`;
    const add=document.createElement('button');add.type='button';add.textContent='+ New team';add.style.minHeight='38px';add.onclick=async()=>{add.disabled=true;add.textContent='Creating…';try{const r=await jsonFetch('/api/captains',{method:'POST',body:JSON.stringify({action:'create-team',timeZone:tz()})});location.href=r.captainUrl}catch(e){alert(e.message);add.disabled=false;add.textContent='+ New team'}};wrap.append(select,add);right.prepend(wrap);
  }

  function mountSlugEditor(){
    const section=document.getElementById('team-settings');if(!section||document.getElementById('teamSlugCard'))return false;const card=document.createElement('div');card.className='card';card.id='teamSlugCard';
    card.innerHTML=`<div class="row wrap"><div><strong>Team links</strong><div class="muted">Your team gets its own player and captain URLs. Only the owner can change this link.</div></div><span class="pill">${esc(session?.team?.role||'captain')}</span></div><div class="grid g2" style="margin-top:9px"><label>Team link code<input id="teamSlugInput" value="${esc(current())}" ${session?.team?.role==='owner'?'':'disabled'}></label><div><div class="muted">Player link</div><code id="settingsPlayerLink">${esc(location.origin+'/team/'+current())}</code></div></div><button id="saveTeamSlug" type="button" ${session?.team?.role==='owner'?'':'disabled'} style="margin-top:9px">Save team link</button><div id="teamSlugMsg" class="muted"></div>`;
    section.insertBefore(card,section.children[1]||null);const btn=document.getElementById('saveTeamSlug');if(btn)btn.onclick=async()=>{const input=document.getElementById('teamSlugInput'),msg=document.getElementById('teamSlugMsg');btn.disabled=true;msg.textContent='Saving…';try{const next=String(input.value||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');const r=await jsonFetch('/api/captains',{method:'POST',body:JSON.stringify({action:'update-slug',slug:next})});msg.textContent='Team link updated. Redirecting…';location.href=r.captainUrl}catch(e){msg.textContent=e.message;btn.disabled=false}};return true;
  }

  function renderCaptainResources(){
    const section=document.getElementById('resources');if(!section||typeof state==='undefined'||!state)return;const list=Array.isArray(state.resources)?state.resources.filter(r=>r&&r.title&&r.url).map(r=>({...r,safeUrl:safeExternalUrl(r.url)})).filter(r=>r.safeUrl):[];
    section.innerHTML='<div class="card row wrap"><div><strong>Team Resources</strong><div class="muted">These are the same links players see. Edit them in Team Settings.</div></div><button id="editResourcesSettings" type="button">Edit resources</button></div><div class="grid g2">'+(list.length?list.map(r=>`<a class="card" style="text-decoration:none;color:inherit" target="_blank" rel="noopener" href="${esc(r.safeUrl)}"><strong>${esc(r.title)}</strong><div class="muted">${esc(r.description||'Open resource')}</div></a>`).join(''):'<div class="card muted">No team resources have been added yet.</div>')+'</div>';
    const edit=document.getElementById('editResourcesSettings');if(edit)edit.onclick=()=>{const b=document.querySelector('[data-tab="team-settings"]');if(b)b.click()};
  }

  function restrictFounderConnector(){
    if(current()===FOUNDER)return;const cb=document.getElementById('teamLeagueApps');if(!cb)return;cb.checked=false;cb.disabled=true;
    if(state?.team?.leagueAppsEnabled){state.team.leagueAppsEnabled=false;if(typeof queueSave==='function')queueSave()}
    const label=cb.closest('label');if(label&&!label.querySelector('.connector-note')){const note=document.createElement('small');note.className='muted connector-note';note.style.display='block';note.textContent='LeagueApps sync is not connected for this workspace yet. Use Add event or your team schedule settings.';label.appendChild(note)}
  }

  function overrideAccess(){
    if(typeof window.renderAccess!=='function'||window.renderAccess.__tenantAware)return;const fn=async function(){setShareLinks();const list=document.getElementById('captainList');if(!list)return;try{const r=await jsonFetch('/api/captains');list.innerHTML=r.captains.map(c=>`<div class="card row wrap"><div><strong>${esc(c.display_name)}</strong><div class="muted">${esc(c.email)} • ${esc(c.role)}</div></div>${c.role==='owner'?'<span class="pill">Owner</span>':`<button class="danger removeCaptain" data-email="${esc(c.email)}">Remove</button>`}</div>`).join('');list.querySelectorAll('.removeCaptain').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this captain from this team?'))return;try{await jsonFetch('/api/captains',{method:'POST',body:JSON.stringify({action:'remove-member',email:b.dataset.email})});fn()}catch(e){alert(e.message)}})}catch(e){list.innerHTML='<div class="error">'+esc(e.message)+'</div>'}};fn.__tenantAware=true;window.renderAccess=fn;renderAccess=fn;
  }

  async function init(){
    try{session=await jsonFetch('/api/session')}catch(e){return}
    if(session.accountAuthenticated&&session.accessDenied){const msg=document.getElementById('loginMsg');if(msg){const first=session.teams&&session.teams[0];msg.innerHTML=`You are signed in, but this account does not have access to this team.${first?` <a href="/captain/${esc(first.slug)}">Open ${esc(first.name||'your team')}</a>`:''}`;}return}
    if(!session.authenticated)return;mountSwitcher();setShareLinks();overrideAccess();renderCaptainResources();
    const timer=setInterval(()=>{const done=mountSlugEditor();restrictFounderConnector();if(done&&document.getElementById('teamLeagueApps'))clearInterval(timer)},200);
    setInterval(()=>{setShareLinks();renderCaptainResources();restrictFounderConnector()},2500);
  }
  const wait=setInterval(()=>{if(document.getElementById('loginMsg')){clearInterval(wait);init()}},100);
})();
