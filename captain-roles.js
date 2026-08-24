(()=>{
  const STANDARD=['Captain','Co-Captain','Umpire','First Aid'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function normalizedRoles(player){
    const raw=Array.isArray(player?.roles)?player.roles:[];
    const legacy=String(player?.role||'').split(/\s*(?:\/|,|•|\|)\s*/).filter(Boolean);
    const roles=[...new Set([...raw,...legacy].map(x=>String(x).trim()).filter(Boolean))];
    return roles.map(r=>/^med[ií]c$/i.test(r)?'First Aid':r);
  }
  function syncLegacy(player){
    player.roles=[...new Set(normalizedRoles(player))];
    player.role=player.roles.join(' / ');
    player.firstAidVolunteer=player.roles.includes('First Aid');
    return player;
  }
  function saveAndRender(player){
    syncLegacy(player);
    if(typeof queueSave==='function')queueSave();
    if(typeof renderRoster==='function')renderRoster();
  }
  function decorate(){
    if(typeof state==='undefined'||!state)return;
    const box=document.getElementById('players');if(!box)return;
    [...box.children].forEach(card=>{
      const nameInput=card.querySelector('input.n');const roleInput=card.querySelector('input.r');
      if(!nameInput||!roleInput||card.dataset.rolesEnhanced==='1')return;
      const player=(state.players||[]).find(p=>p.name===nameInput.value);if(!player)return;
      syncLegacy(player);
      card.dataset.rolesEnhanced='1';roleInput.style.display='none';
      const label=roleInput.closest('label');if(label){const text=[...label.childNodes].find(n=>n.nodeType===3);if(text)text.textContent='Roles';}
      const wrap=document.createElement('div');wrap.className='multi-role-editor';
      const roles=normalizedRoles(player);const custom=roles.filter(r=>!STANDARD.includes(r));
      wrap.innerHTML='<div class="role-chip-grid">'+STANDARD.map(role=>'<label class="role-chip"><input type="checkbox" value="'+esc(role)+'" '+(roles.includes(role)?'checked':'')+'><span>'+esc(role)+'</span></label>').join('')+'</div><label class="role-custom-label">Other role(s)<input class="role-custom" placeholder="Coach, Medic, etc." value="'+esc(custom.join(' / '))+'"></label>'+(player.officiatingBackupOnly?'<div class="role-note">Backup umpire preference: ON</div>':'');
      roleInput.insertAdjacentElement('afterend',wrap);
      wrap.querySelectorAll('.role-chip input').forEach(cb=>cb.onchange=()=>{
        const selected=[...wrap.querySelectorAll('.role-chip input:checked')].map(x=>x.value);
        const extra=String(wrap.querySelector('.role-custom').value||'').split(/\s*(?:\/|,|•|\|)\s*/).map(x=>x.trim()).filter(Boolean);
        player.roles=[...new Set([...selected,...extra])];saveAndRender(player);
      });
      wrap.querySelector('.role-custom').onchange=e=>{
        const selected=[...wrap.querySelectorAll('.role-chip input:checked')].map(x=>x.value);
        const extra=String(e.target.value||'').split(/\s*(?:\/|,|•|\|)\s*/).map(x=>x.trim()).filter(Boolean);
        player.roles=[...new Set([...selected,...extra])];saveAndRender(player);
      };
    });
  }
  const style=document.createElement('style');style.textContent='.multi-role-editor{margin-top:6px}.role-chip-grid{display:flex;flex-wrap:wrap;gap:6px}.role-chip{display:inline-flex!important;align-items:center;gap:6px;border:1px solid var(--l);border-radius:999px;padding:7px 10px;background:#fff;font-weight:700}.role-chip input{width:auto;margin:0}.role-chip:has(input:checked){background:#ecfdf3;border-color:#34d399;color:#166534}.role-custom-label{display:block;margin-top:8px}.role-note{margin-top:7px;color:#9a3412;font-size:.85rem;font-weight:700}';document.head.appendChild(style);
  const timer=setInterval(()=>{if(typeof state!=='undefined'&&state&&document.getElementById('players'))decorate()},200);setTimeout(()=>clearInterval(timer),30000);
  new MutationObserver(()=>requestAnimationFrame(decorate)).observe(document.documentElement,{childList:true,subtree:true});
  window.BuntRoles={normalizedRoles,syncLegacy};
})();
