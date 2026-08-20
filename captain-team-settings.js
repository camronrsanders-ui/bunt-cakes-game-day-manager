(()=>{
  const DEFAULT_TEAM={name:'',shortName:'',organization:'',sport:'Kickball',location:'',primaryColor:'#15803d',accentColor:'#f7fff8',logoDataUrl:'',logoUrl:'',chatUrl:'',announcement:'',arrivalMinutes:60,secondReminderMinutes:30,leagueAppsEnabled:false,timeZone:'America/New_York'};
  const DEFAULT_VIS={schedule:true,lineup:true,pods:true,kicking:true,officials:true,resources:true,attendance:true};
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const $id=id=>document.getElementById(id);
  let mounted=false;

  function team(){
    if(typeof state==='undefined'||!state)return {...DEFAULT_TEAM};
    state.team={...DEFAULT_TEAM,...(state.team||{})};
    state.playerVisibility={...DEFAULT_VIS,...(state.playerVisibility||{})};
    if(!Array.isArray(state.resources))state.resources=[];
    return state.team;
  }
  function logoSrc(t){return t.logoDataUrl||t.logoUrl||'/generic-team-icon.svg'}
  function applyBrand(t){
    document.documentElement.style.setProperty('--a',t.primaryColor||'#15803d');
    document.documentElement.style.setProperty('--bg',t.accentColor||'#f7fff8');
    document.title=(t.name||'Team')+' Captain';
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content=t.primaryColor||'#15803d';
    document.querySelectorAll('.brand-logo,.login-logo').forEach(img=>{img.src=logoSrc(t);img.alt=(t.name||'Team')+' logo'});
    const h=document.querySelector('#manager .brand h1');if(h)h.textContent=t.name||'Your Team';
    const loginTitle=document.querySelector('#login h1');if(loginTitle&&t.name)loginTitle.textContent=t.name+' Captain Access';
    const manifest=document.querySelector('link[rel="manifest"]');if(manifest)manifest.href='/api/team-state?manifest=1';
    const touch=document.querySelector('link[rel="apple-touch-icon"]');if(touch)touch.href='/api/team-state?logo=1';
    const cards=document.querySelectorAll('#dashboard .grid.g3 .card .muted');if(cards[0])cards[0].textContent=t.shortName||t.name||'Team';
  }
  function syncHalfOptions(t,save=false){
    const sel=$id('half');if(!sel)return;
    const name=t.shortName||t.name||'Team';
    const mode=String((typeof state!=='undefined'&&state&&state.half)||'').toLowerCase().includes('field')?'fielding':'kicking';
    const kick=name+' kicking',field=name+' fielding';
    sel.innerHTML='<option>'+esc(kick)+'</option><option>'+esc(field)+'</option>';
    const next=mode==='fielding'?field:kick;
    sel.value=next;
    if(typeof state!=='undefined'&&state&&state.half!==next){state.half=next;if(save&&typeof queueSave==='function')queueSave();}
  }
  function leagueAppsVisibility(t){
    const sync=$id('sync');if(!sync)return;
    const card=sync.closest('.card');if(card)card.style.display=t.leagueAppsEnabled?'':'none';
  }
  async function compressLogo(file){
    if(!file||!file.type.startsWith('image/'))throw new Error('Choose an image file.');
    if(file.size>8*1024*1024)throw new Error('Choose an image smaller than 8 MB.');
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=()=>reject(new Error('Could not read that image.'));x.src=url});
      const max=512,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
      const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);
      let data=c.toDataURL('image/webp',.82);if(!data.startsWith('data:image/webp'))data=c.toDataURL('image/jpeg',.82);
      if(data.length>520000)data=c.toDataURL('image/jpeg',.62);
      if(data.length>700000)throw new Error('That image is still too large after compression. Try a simpler or smaller photo.');
      return data;
    }finally{URL.revokeObjectURL(url)}
  }
  function resourceRow(r,i){return `<div class="card team-resource-row" data-resource="${i}"><div class="grid g2"><label>Resource name<input class="r-title" value="${esc(r.title||'')}"></label><label>Link<input class="r-url" type="url" value="${esc(r.url||'')}"></label></div><label>Description<input class="r-desc" value="${esc(r.description||'')}"></label><button class="danger r-remove" type="button">Remove resource</button></div>`}
  function renderResources(){const box=$id('teamSettingsResources');if(!box||typeof state==='undefined'||!state)return;box.innerHTML=(state.resources||[]).map(resourceRow).join('')||'<div class="card muted">No player resources yet.</div>';box.querySelectorAll('[data-resource]').forEach(row=>{const i=+row.dataset.resource;row.querySelector('.r-title').onchange=e=>{state.resources[i].title=e.target.value.trim();queueSave()};row.querySelector('.r-url').onchange=e=>{state.resources[i].url=e.target.value.trim();queueSave()};row.querySelector('.r-desc').onchange=e=>{state.resources[i].description=e.target.value.trim();queueSave()};row.querySelector('.r-remove').onclick=()=>{state.resources.splice(i,1);queueSave();renderResources()}})}
  function bind(){
    const t=team();applyBrand(t);syncHalfOptions(t,false);leagueAppsVisibility(t);
    const fields={teamName:'name',teamShortName:'shortName',teamOrg:'organization',teamSport:'sport',teamLocation:'location',teamChat:'chatUrl',teamAnnouncement:'announcement',teamTimezone:'timeZone'};
    Object.entries(fields).forEach(([id,key])=>{const el=$id(id);if(!el)return;el.value=t[key]||'';el.onchange=()=>{t[key]=el.value.trim();if(key==='name'||key==='shortName'){syncHalfOptions(t,true);applyBrand(t)}queueSave();renderSettingsSummary()}});
    [['teamPrimary','primaryColor'],['teamAccent','accentColor']].forEach(([id,key])=>{const el=$id(id);if(!el)return;el.value=t[key]||DEFAULT_TEAM[key];el.oninput=()=>{t[key]=el.value;applyBrand(t)};el.onchange=()=>queueSave()});
    [['teamArrival','arrivalMinutes'],['teamSecondReminder','secondReminderMinutes']].forEach(([id,key])=>{const el=$id(id);if(!el)return;el.value=Number(t[key]??DEFAULT_TEAM[key]);el.onchange=()=>{t[key]=Math.max(0,Math.min(180,Number(el.value)||0));queueSave()}});
    const league=$id('teamLeagueApps');if(league){league.checked=!!t.leagueAppsEnabled;league.onchange=()=>{t.leagueAppsEnabled=league.checked;leagueAppsVisibility(t);queueSave()}};
    const season=$id('teamSeason');if(season){season.value=state.season?.name||'';season.onchange=()=>{state.season=state.season||{};state.season.name=season.value.trim();queueSave()}};
    const div=$id('teamDivision');if(div){div.value=state.season?.division||'';div.onchange=()=>{state.season=state.season||{};state.season.division=div.value.trim();queueSave()}};
    const file=$id('teamLogoFile');if(file)file.onchange=async()=>{try{const data=await compressLogo(file.files&&file.files[0]);t.logoDataUrl=data;t.logoUrl='';applyBrand(t);queueSave();renderLogoPreview()}catch(e){alert(e.message)}finally{file.value=''}};
    const remove=$id('removeTeamLogo');if(remove)remove.onclick=()=>{t.logoDataUrl='';t.logoUrl='';applyBrand(t);queueSave();renderLogoPreview()};
    document.querySelectorAll('[data-player-visibility]').forEach(cb=>{const key=cb.dataset.playerVisibility;cb.checked=state.playerVisibility[key]!==false;cb.onchange=()=>{state.playerVisibility[key]=cb.checked;queueSave()}});
    const add=$id('addTeamResource');if(add)add.onclick=()=>{state.resources.push({title:'',description:'',url:''});renderResources();queueSave()};
    const save=$id('saveTeamSettings');if(save)save.onclick=()=>{queueSave();save.textContent='Saved';setTimeout(()=>save.textContent='Save team settings',900)};
    renderResources();renderLogoPreview();renderSettingsSummary();
  }
  function renderLogoPreview(){const t=team(),img=$id('teamLogoPreview');if(img)img.src=logoSrc(t)}
  function renderSettingsSummary(){const t=team(),box=$id('teamSetupSummary');if(box)box.textContent=t.name?`${t.name}${t.sport?' • '+t.sport:''}${state.season?.name?' • '+state.season.name:''}`:'New teams start blank — add your team details below.'}
  function openSettings(){const b=document.querySelector('[data-tab="team-settings"]');if(b)b.click()}
  function mount(){
    if(mounted||typeof state==='undefined'||!state||!document.querySelector('#manager .tabs'))return false;
    mounted=true;team();
    const style=document.createElement('style');style.textContent='.team-settings-logo{width:120px;height:120px;object-fit:contain;border:1px solid var(--l);border-radius:20px;background:#fff;padding:8px}.team-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.team-setting-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.team-setting-check{display:flex;align-items:center;gap:8px;border:1px solid var(--l);border-radius:12px;padding:10px;background:#fff}.team-setting-check input{width:auto;margin:0}@media(max-width:650px){.team-settings-grid,.team-setting-checks{grid-template-columns:1fr}}';document.head.appendChild(style);
    const tabs=document.querySelector('#manager .tabs'),access=tabs.querySelector('[data-tab="access"]'),btn=document.createElement('button');btn.dataset.tab='team-settings';btn.textContent='Team Settings';tabs.insertBefore(btn,access||null);
    const section=document.createElement('section');section.id='team-settings';section.className='stack hidden';section.innerHTML=`<div class="card"><strong>Team Setup & Branding</strong><div id="teamSetupSummary" class="muted">Captain-controlled settings for everything players see.</div></div><div class="card"><div class="row wrap"><div><strong>Team identity</strong><div class="muted">New customers start blank. Your current team data stays yours.</div></div><img id="teamLogoPreview" class="team-settings-logo" src="/generic-team-icon.svg" alt="Team logo"></div><div class="team-settings-grid" style="margin-top:10px"><label>Team name<input id="teamName" placeholder="Example: Sunday Sluggers"></label><label>Short name<input id="teamShortName" placeholder="Example: Sluggers"></label><label>Organization / league<input id="teamOrg" placeholder="League or organization"></label><label>Sport<input id="teamSport" placeholder="Kickball"></label><label>City / location<input id="teamLocation" placeholder="Boston, MA"></label><label>Season<input id="teamSeason" placeholder="Fall 2026"></label><label>Division<input id="teamDivision" placeholder="B Division"></label><label>Time zone<input id="teamTimezone" placeholder="America/New_York"></label></div><div class="team-settings-grid" style="margin-top:10px"><label>Primary color<input id="teamPrimary" type="color"></label><label>Background color<input id="teamAccent" type="color"></label></div><div style="margin-top:10px"><label>Team photo / logo<input id="teamLogoFile" type="file" accept="image/*"></label><button id="removeTeamLogo" type="button">Remove custom logo</button></div></div><div class="card"><strong>Player experience</strong><div class="team-settings-grid" style="margin-top:8px"><label>Team chat link<input id="teamChat" type="url" placeholder="WhatsApp, GroupMe, Discord, etc."></label><label>Arrive before game (minutes)<input id="teamArrival" type="number" min="0" max="180"></label><label>Second game reminder (minutes)<input id="teamSecondReminder" type="number" min="0" max="180"></label><label class="team-setting-check"><input id="teamLeagueApps" type="checkbox">Show LeagueApps sync to captains</label></div><label style="margin-top:8px;display:block">Captain announcement<textarea id="teamAnnouncement" rows="3" placeholder="Game-day note players should see on Home"></textarea></label></div><div class="card"><strong>What players can see</strong><div class="muted">Turn off anything your team does not use.</div><div class="team-setting-checks" style="margin-top:8px">${[['schedule','Schedule'],['lineup','Live field lineup'],['pods','Field rotation'],['kicking','Kicking order'],['officials','Officiating'],['resources','Resources'],['attendance','Weekly Sunday RSVP']].map(([k,l])=>`<label class="team-setting-check"><input type="checkbox" data-player-visibility="${k}">${l}</label>`).join('')}</div></div><div class="card"><div class="row wrap"><div><strong>Player resources</strong><div class="muted">Add your own league forms, rules, fee help, medical forms, or team links.</div></div><button id="addTeamResource" type="button">Add resource</button></div></div><div id="teamSettingsResources" class="stack"></div><button id="saveTeamSettings" class="primary" type="button">Save team settings</button>`;
    const accessSection=$id('access');if(accessSection)accessSection.parentNode.insertBefore(section,accessSection);else $id('manager').appendChild(section);
    btn.onclick=()=>{document.querySelectorAll('#manager .tabs button').forEach(x=>x.classList.toggle('on',x===btn));document.querySelectorAll('#manager section').forEach(s=>s.classList.add('hidden'));section.classList.remove('hidden')};
    bind();
    if(!team().name)setTimeout(openSettings,250);
    return true;
  }
  async function brandLogin(){
    try{const r=await fetch('/api/team-state?fresh='+Date.now(),{cache:'no-store'}),j=await r.json();if(r.ok&&j.state&&j.state.team)applyBrand({...DEFAULT_TEAM,...j.state.team})}catch(e){}
  }
  brandLogin();
  const wait=setInterval(()=>{if(mount())clearInterval(wait)},120);
  window.addEventListener('buntpreferrednamesrefresh',()=>{if(mounted){applyBrand(team());renderResources();leagueAppsVisibility(team())}});
})();
