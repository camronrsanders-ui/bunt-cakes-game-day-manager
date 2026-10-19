/* FeildHaus Umpire Game Tracker
   A phone-local game clock + inning tracker that lives next to the Umpire
   Console. Built after a game ran long because the crew lost count of the
   innings and extra innings changed the score: this tracker makes the
   current inning impossible to miss, walks half-inning by half-inning, and
   stops the game at the end of regulation unless it is tied.
   It never writes to team state — the official score/inning stay with the
   captain. Everything persists in localStorage so a refresh mid-game loses
   nothing. */
(function(){
  'use strict';
  var REGULATION_INNINGS=7;
  var STALE_MS=12*60*60*1000;

  function createState(){
    return {inning:1,half:'top',away:0,home:0,limitMin:0,elapsedBase:0,runningSince:0,over:false,extra:false,savedAt:0};
  }
  function elapsedMs(s,now){
    return (s.elapsedBase||0)+(s.runningSince?Math.max(0,now-s.runningSince):0);
  }
  function fmt(ms){
    var total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),sec=total%60;
    return (h>0?h+':':'')+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  }
  function ordinal(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
  // Advance one half-inning. Returns a transition tag so the UI can banner it.
  function endHalf(s){
    if(s.over)return 'over';
    if(s.half==='top'){s.half='bottom';return 'half';}
    // Bottom of an inning just ended.
    if(s.inning>=REGULATION_INNINGS){
      if(s.away!==s.home){
        s.over=true;
        if(s.runningSince){s.elapsedBase=elapsedMs(s,Date.now());s.runningSince=0;}
        return 'final';
      }
      s.extra=true;s.inning+=1;s.half='top';return 'extra';
    }
    s.inning+=1;s.half='top';return 'inning';
  }
  function adjustInning(s,delta){
    s.inning=Math.max(1,(s.inning||1)+delta);
    if(s.inning<=REGULATION_INNINGS)s.extra=false;
    if(delta<0)s.over=false;
    return s;
  }
  function adjustScore(s,side,delta){
    if(side==='away')s.away=Math.max(0,(s.away||0)+delta);
    if(side==='home')s.home=Math.max(0,(s.home||0)+delta);
    return s;
  }
  function toggleClock(s,now){
    if(s.over)return s;
    if(s.runningSince){s.elapsedBase=elapsedMs(s,now);s.runningSince=0;}
    else s.runningSince=now;
    return s;
  }
  function statusLine(s){
    if(s.over)return 'Game over';
    if(s.extra)return 'Extra innings — tied after '+REGULATION_INNINGS;
    return (s.half==='top'?'Top':'Bottom')+' of the '+ordinal(s.inning)+' — '+(s.half==='top'?'Away':'Home')+' kicking';
  }

  var core={REGULATION_INNINGS:REGULATION_INNINGS,createState:createState,elapsedMs:elapsedMs,fmt:fmt,ordinal:ordinal,endHalf:endHalf,adjustInning:adjustInning,adjustScore:adjustScore,toggleClock:toggleClock,statusLine:statusLine};
  if(typeof window!=='undefined')window.UmpireGameTrackerCore=core;
  if(typeof document==='undefined')return;

  var slug=(typeof window!=='undefined'&&window.__teamSlug)||'default';
  var KEY='feildhaus-umpire-tracker-v1:'+slug;
  var S=createState();
  try{
    var raw=localStorage.getItem(KEY);
    if(raw){var parsed=JSON.parse(raw);if(parsed&&Date.now()-(parsed.savedAt||0)<STALE_MS)S=Object.assign(createState(),parsed);}
  }catch(_){}
  function save(){S.savedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}}
  function buzz(){try{if(navigator.vibrate)navigator.vibrate(200);}catch(_){}}
  var limitBuzzed=false;

  var STYLE_ID='umpire-tracker-styles';
  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    var st=document.createElement('style');st.id=STYLE_ID;
    st.textContent='.ut-card{border:2px solid #071926}.ut-clock{font-size:2.2rem;font-weight:950;line-height:1;font-variant-numeric:tabular-nums}.ut-inning{font-size:1.35rem;font-weight:950}.ut-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ut-row button{min-height:48px;font-weight:800}.ut-big{flex:1;min-height:56px;font-size:1.05rem}.ut-score{display:grid;grid-template-columns:1fr auto auto auto;gap:7px;align-items:center}.ut-score button{min-width:48px}.ut-score .n{font-size:1.3rem;font-weight:950;min-width:2ch;text-align:center}.ut-banner{border-radius:12px;padding:10px 12px;font-weight:800;margin-top:10px}.ut-banner.final{background:#ecfdf3;color:#14532d;border:1px solid #15803d}.ut-banner.warn{background:#fef2f2;color:#991b1b;border:1px solid #fca5a5}.ut-banner.extra{background:#fff7ed;color:#9a3412;border:1px solid #fdba74}.ut-chip.on{background:#071926;color:#fff;border-color:#071926}.ut-prog{display:flex;gap:4px;margin-top:8px}.ut-prog span{flex:1;height:8px;border-radius:99px;background:#e5e7eb}.ut-prog span.done{background:#15803d}.ut-prog span.now{background:#f59e0b}';
    document.head.appendChild(st);
  }

  var card=null;
  function buildCard(){
    ensureStyles();
    card=document.createElement('div');
    card.className='card ut-card';card.id='umpireTrackerCard';
    card.innerHTML=
      '<div class="muted">GAME CLOCK & INNINGS — THIS PHONE ONLY</div>'+
      '<div class="ut-row" style="justify-content:space-between;margin-top:4px"><div><div class="ut-clock" id="utClock">00:00</div><div class="muted" id="utClockState">Clock not started</div></div>'+
      '<div style="text-align:right"><div class="ut-inning" id="utInning">Inning 1 of 7</div><div id="utStatus" style="font-weight:800">Top of the 1st — Away kicking</div></div></div>'+
      '<div class="ut-prog" id="utProg"></div>'+
      '<div id="utBanner"></div>'+
      '<div class="ut-row" style="margin-top:10px"><button type="button" id="utClockBtn">▶ Start clock</button><button type="button" id="utHalfBtn" class="primary ut-big">End half-inning</button></div>'+
      '<div class="ut-score" style="margin-top:10px"><strong>Away runs</strong><button type="button" id="utAwayMinus" aria-label="Away runs minus">−</button><span class="n" id="utAway">0</span><button type="button" id="utAwayPlus" aria-label="Away runs plus">+</button></div>'+
      '<div class="ut-score" style="margin-top:6px"><strong>Home runs</strong><button type="button" id="utHomeMinus" aria-label="Home runs minus">−</button><span class="n" id="utHome">0</span><button type="button" id="utHomePlus" aria-label="Home runs plus">+</button></div>'+
      '<div class="ut-row" style="margin-top:10px"><span class="muted">Fix the inning:</span><button type="button" id="utInnMinus">− Inning</button><button type="button" id="utInnPlus">+ Inning</button></div>'+
      '<div class="ut-row" style="margin-top:10px"><span class="muted">Time target:</span><span id="utLimits"></span></div>'+
      '<div class="ut-row" style="margin-top:10px"><button type="button" id="utReset">Reset / new game</button></div>'+
      '<div class="muted" style="margin-top:8px">The tracker keeps this game\u2019s clock and count on this phone. It does not change the official team score — the captain\u2019s page does that.</div>';
    var limits=card.querySelector('#utLimits');
    [0,45,50,60,75].forEach(function(m){
      var b=document.createElement('button');b.type='button';b.className='ut-chip';b.dataset.min=String(m);b.textContent=m===0?'None':m+' min';
      b.onclick=function(){S.limitMin=m;limitBuzzed=false;save();render();};
      limits.appendChild(b);
    });
    card.querySelector('#utClockBtn').onclick=function(){toggleClock(S,Date.now());save();render();};
    card.querySelector('#utHalfBtn').onclick=function(){
      var t=endHalf(S);save();render();
      if(t==='final'||t==='extra')buzz();
    };
    card.querySelector('#utAwayMinus').onclick=function(){adjustScore(S,'away',-1);save();render();};
    card.querySelector('#utAwayPlus').onclick=function(){adjustScore(S,'away',1);save();render();};
    card.querySelector('#utHomeMinus').onclick=function(){adjustScore(S,'home',-1);save();render();};
    card.querySelector('#utHomePlus').onclick=function(){adjustScore(S,'home',1);save();render();};
    card.querySelector('#utInnMinus').onclick=function(){adjustInning(S,-1);save();render();};
    card.querySelector('#utInnPlus').onclick=function(){adjustInning(S,1);save();render();};
    card.querySelector('#utReset').onclick=function(){
      if(!window.confirm('Reset the tracker for a new game? Clock, inning, and runs go back to zero.'))return;
      S=createState();limitBuzzed=false;save();render();
    };
    return card;
  }

  function render(){
    if(!card)return;
    var now=Date.now(),ms=elapsedMs(S,now);
    card.querySelector('#utClock').textContent=fmt(ms);
    card.querySelector('#utClockState').textContent=S.over?'Final':(S.runningSince?'Clock running':(ms>0?'Clock paused — tap Start to resume':'Clock not started'));
    card.querySelector('#utClockBtn').textContent=S.runningSince?'⏸ Pause clock':'▶ Start clock';
    card.querySelector('#utInning').textContent=S.extra?('Inning '+S.inning+' — EXTRA'):('Inning '+Math.min(S.inning,REGULATION_INNINGS)+' of '+REGULATION_INNINGS);
    card.querySelector('#utStatus').textContent=statusLine(S);
    card.querySelector('#utAway').textContent=String(S.away);
    card.querySelector('#utHome').textContent=String(S.home);
    var prog=card.querySelector('#utProg');var html='';
    var halvesDone=(Math.min(S.inning,REGULATION_INNINGS)-1)*2+(S.half==='bottom'?1:0);
    for(var i=0;i<REGULATION_INNINGS*2;i++)html+='<span class="'+(i<halvesDone||S.over?'done':(i===halvesDone?'now':''))+'"></span>';
    prog.innerHTML=html;
    var banner=card.querySelector('#utBanner'),overLimit=S.limitMin>0&&ms>=S.limitMin*60000;
    if(S.over){
      var winner=S.away===S.home?'Tied':(S.away>S.home?'Away':'Home');
      banner.innerHTML='<div class="ut-banner final">🏁 GAME OVER — Final: Away '+S.away+', Home '+S.home+(S.away===S.home?'':' — '+winner+' wins')+'. No more innings.</div>';
    }else if(S.extra){
      banner.innerHTML='<div class="ut-banner extra">⚠️ Tied after '+REGULATION_INNINGS+' — extra innings. Play full innings until someone leads after the bottom half.</div>';
    }else if(overLimit){
      banner.innerHTML='<div class="ut-banner warn">⏰ Time target reached ('+S.limitMin+' min). Finish this half-inning — do not start a new inning.</div>';
      if(!limitBuzzed){limitBuzzed=true;buzz();}
    }else if(S.inning===REGULATION_INNINGS&&S.half==='bottom'){
      banner.innerHTML='<div class="ut-banner warn">Bottom of the '+ordinal(REGULATION_INNINGS)+' — last half-inning of regulation'+(S.away===S.home?' (tied: a run here wins it; no run means extra innings)':'')+'.</div>';
    }else banner.innerHTML='';
    card.querySelectorAll('#utLimits .ut-chip').forEach(function(b){b.classList.toggle('on',Number(b.dataset.min)===S.limitMin);});
    card.querySelector('#utHalfBtn').textContent=S.over?'Game over':(S.half==='top'?'End top half →':'End bottom half →');
    card.querySelector('#utHalfBtn').disabled=!!S.over;
  }

  function anchor(){
    var playerSection=document.getElementById('umpire');
    if(playerSection)return{el:playerSection,mode:'player'};
    var disclosure=document.getElementById('captainUmpireDisclosure');
    if(disclosure)return{el:disclosure,mode:'captain'};
    return null;
  }
  function sync(){
    var a=anchor();
    if(!a){if(card)card.style.display='none';return;}
    if(!card)card=buildCard();
    if(card.parentElement!==a.el.parentElement||card.nextElementSibling!==a.el){
      a.el.parentElement.insertBefore(card,a.el);
    }
    if(a.mode==='player')card.style.display=a.el.classList.contains('hidden')?'none':'';
    else card.style.display='';
    render();
  }
  setInterval(sync,500);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();
})();
