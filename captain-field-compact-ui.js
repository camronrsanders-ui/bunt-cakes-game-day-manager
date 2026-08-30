(()=>{
  const STYLE_ID='captainFieldCompactUi';
  function install(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #pods .switch-hero > .muted,
      #pods #switchRules,
      #pods .switch-explain{display:none!important}
      #pods .switch-hero h2{margin:0!important}
      #pods .switch-actions{margin-top:12px!important}
      #pods .switch-hero{padding:16px!important}
      #pods #switchStatus{margin-top:8px!important}
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
