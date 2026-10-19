/* FeildHaus Umpire Game Tracker — Stonewall Sports Boston rules edition.
   Phone-local official game clock + inning tracker for the umpire crew,
   built to SSB Kickball Rules (updated 8/23/26), Section 4:
   - Rule 4.1: a game is at most FIVE innings and the clock is 40 minutes.
     No new inning may start at or after 40:00; the inning in progress is
     finished. The clock starts on the first pitch.
   - Rule 4.1.4: league-declared turf games use a 30-minute clock.
   - Rule 13.1: the clock runs through substitutions; the umpire may stop
     it and add time back at their discretion.
   - Rule 4.4: home leading after the top of the final inning ends the game
     (no bottom); a home lead taken in the bottom of the final inning ends
     the game on that play.
   - Rule 4.4.1: if 40:00 arrives during the bottom with Home winning, the
     game ends at the conclusion of that play, score as of 40:00.
   - Rule 4.5: regular-season ties stand; playoff ties go to extra innings
     (last kicker on 2nd base, one out assessed).
   - Rule 4.3.1: 6-run cap per half-inning (not playoffs; trailing team's
     final at-bat may pass it only to tie — Rule 4.3.1.1).
   - Rule 4.3.2: slaughter check at 30:00 or 3 innings with a 10+ run gap.
   It never writes to team state. Everything persists in localStorage so a
   refresh mid-game loses nothing. */
(function(){
  'use strict';
  var REGULATION_INNINGS=5;
  var GAME_MINUTES=40;
  var TURF_MINUTES=30;
  var RUN_CAP=6;
  var SLAUGHTER_MIN_MS=30*60000, SLAUGHTER_INNINGS=3, SLAUGHTER_DIFF=10;
  var STALE_MS=12*60*60*1000;

  function createState(){
    return {mode:'regular',durationMin:GAME_MINUTES,inning:1,half:'top',away:0,home:0,runsThisHalf:0,
      elapsedBase:0,runningSince:0,addedMs:0,timeUp:false,scoreAtTimeUp:null,over:false,extra:false,
      finalReason:'',savedAt:0};
  }
  function elapsedMs(s,now){return (s.elapsedBase||0)+(s.runningSince?Math.max(0,now-s.runningSince):0);}
  function limitMs(s){return (s.durationMin||GAME_MINUTES)*60000+(s.addedMs||0);}
  function remainingMs(s,now){return Math.max(0,limitMs(s)-elapsedMs(s,now));}
  function fmtClock(ms){var t=Math.max(0,Math.ceil(ms/1000));var m=Math.floor(t/60),sec=t%60;return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}
  function fmtElapsed(ms){var t=Math.floor(ms/1000);var m=Math.floor(t/60),sec=t%60;return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}
  function ordinal(n){var suf=['th','st','nd','rd'],v=n%100;return n+(suf[(v-20)%10]||suf[v]||suf[0]);}
  function isFinalInning(s){return !s.extra&&(s.inning>=REGULATION_INNINGS||!!s.timeUp);}
  function freezeClock(s,now){if(s.runningSince){s.elapsedBase=elapsedMs(s,now);s.runningSince=0;}}
  function finish(s,reason,now){s.over=true;s.finalReason=reason;freezeClock(s,now||Date.now());return 'final';}
  function endHalf(s,now){
    now=now||Date.now();
    if(s.over)return 'over';
    if(s.half==='top'){
      if(isFinalInning(s)&&s.home>s.away)return finish(s,'home-held',now);
      s.half='bottom';s.runsThisHalf=0;return 'half';
    }
    // Bottom of an inning just ended.
    if(s.extra){
      if(s.away!==s.home)return finish(s,'extra-decided',now);
      s.inning+=1;s.half='top';s.runsThisHalf=0;return 'extra-continues';
    }
    if(isFinalInning(s)){
      if(s.away!==s.home)return finish(s,'regulation',now);
      if(s.mode==='playoffs'){s.extra=true;s.inning+=1;s.half='top';s.runsThisHalf=0;return 'extra-start';}
      return finish(s,'tie',now);
    }
    s.inning+=1;s.half='top';s.runsThisHalf=0;return 'inning';
  }
  function adjustInning(s,delta){
    s.inning=Math.max(1,(s.inning||1)+delta);
    if(s.inning<=REGULATION_INNINGS)s.extra=false;
    if(delta<0){s.over=false;s.finalReason='';}
    return s;
  }
  function kickingSide(s){return s.half==='top'?'away':'home';}
  function adjustScore(s,side,delta){
    var before=s[side]||0;
    s[side]=Math.max(0,before+delta);
    if(side===kickingSide(s))s.runsThisHalf=Math.max(0,(s.runsThisHalf||0)+(s[side]-before));
    return s;
  }
  function toggleClock(s,now){
    if(s.over)return s;
    if(s.runningSince)freezeClock(s,now);else s.runningSince=now;
    return s;
  }
  function addTime(s,ms){s.addedMs=(s.addedMs||0)+ms;if(limitMs(s)>elapsedMs(s,Date.now()))s.timeUp=false;return s;}
  function capReached(s){return s.mode!=='playoffs'&&(s.runsThisHalf||0)>=RUN_CAP;}
  function completedInnings(s){return Math.max(0,(s.inning||1)-1);}
  function slaughterMet(s,now){
    if(s.over)return false;
    var diff=Math.abs((s.away||0)-(s.home||0));
    return diff>=SLAUGHTER_DIFF&&(elapsedMs(s,now||Date.now())>=SLAUGHTER_MIN_MS||completedInnings(s)>=SLAUGHTER_INNINGS);
  }
  function statusLine(s){
    if(s.over)return s.finalReason==='tie'?'Game over — tie game':'Game over';
    if(s.extra)return 'Extra innings — last kicker on 2nd, 1 out (Rule 4.5)';
    return (s.half==='top'?'Top':'Bottom')+' of the '+ordinal(s.inning)+' — '+(s.half==='top'?'Away':'Home')+' kicking';
  }

  var core={REGULATION_INNINGS:REGULATION_INNINGS,GAME_MINUTES:GAME_MINUTES,RUN_CAP:RUN_CAP,createState:createState,
    elapsedMs:elapsedMs,limitMs:limitMs,remainingMs:remainingMs,fmtClock:fmtClock,fmtElapsed:fmtElapsed,ordinal:ordinal,
    isFinalInning:isFinalInning,endHalf:endHalf,adjustInning:adjustInning,adjustScore:adjustScore,toggleClock:toggleClock,
    addTime:addTime,capReached:capReached,slaughterMet:slaughterMet,statusLine:statusLine};
  if(typeof window!=='undefined')window.UmpireGameTrackerCore=core;
  if(typeof document==='undefined')return;

  var slug=(typeof window!=='undefined'&&window.__teamSlug)||'default';
  var KEY='feildhaus-umpire-tracker-v2:'+slug;
  var S=createState();
  try{
    var raw=localStorage.getItem(KEY);
    if(raw){var parsed=JSON.parse(raw);if(parsed&&Date.now()-(parsed.savedAt||0)<STALE_MS)S=Object.assign(createState(),parsed);}
  }catch(_){}
  function save(){S.savedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}
  }
  function buzz(){try{if(navigator.vibrate)navigator.vibrate(200);}catch(_){}}
  var timeUpBuzzed=false;

  var STYLE_ID='umpire-tracker-styles';
  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    var st=document.createElement('style');st.id=STYLE_ID;
    st.textContent='.ut-card{border:2px solid #071926}.ut-clock{font-size:2.4rem;font-weight:950;line-height:1;font-variant-numeric:tabular-nums}.ut-clock.up{color:#b91c1c}.ut-inning{font-size:1.3rem;font-weight:950}.ut-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ut-row button{min-height:48px;font-weight:800}.ut-big{flex:1;min-height:56px;font-size:1.05rem}.ut-score{display:grid;grid-template-columns:1fr auto auto auto;gap:7px;align-items:center}.ut-score button{min-width:48px}.ut-score .n{font-size:1.3rem;font-weight:950;min-width:2ch;text-align:center}.ut-banner{border-radius:12px;padding:10px 12px;font-weight:800;margin-top:10px}.ut-banner.final{background:#ecfdf3;color:#14532d;border:1px solid #15803d}.ut-banner.warn{background:#fef2f2;color:#991b1b;border:1px solid #fca5a5}.ut-banner.extra{background:#fff7ed;color:#9a3412;border:1px solid #fdba74}.ut-chip.on{background:#071926;color:#fff;border-color:#071926}.ut-prog{display:flex;gap:4px;margin-top:8px}.ut-prog span{flex:1;height:8px;border-radius:99px;background:#e5e7eb}.ut-prog span.done{background:#15803d}.ut-prog span.now{background:#f59e0b}';
    document.head.appendChild(st);
  }

  var card=null;
  function buildCard(){
    ensureStyles();
    card=document.createElement('div');
    card.className='card ut-card';card.id='umpireTrackerCard';
    card.innerHTML=
      '<div class="muted">OFFICIAL GAME CLOCK & INNINGS — STONEWALL BOSTON RULES</div>'+
      '<div class="ut-row" style="margin-top:6px"><span class="muted">Game type:</span><span id="utModes"></span><span class="muted">Clock:</span><span id="utDurations"></span></div>'+
      '<div class="ut-row" style="justify-content:space-between;margin-top:6px"><div><div class="ut-clock" id="utClock">40:00</div><div class="muted" id="utClockState">Clock starts on the first pitch (Rule 4.1)</div></div>'+
      '<div style="text-align:right"><div class="ut-inning" id="utInning">Inning 1 of 5</div><div id="utStatus" style="font-weight:800">Top of the 1st — Away kicking</div></div></div>'+
      '<div class="ut-prog" id="utProg"></div>'+
      '<div id="utBanner"></div>'+
      '<div class="ut-row" style="margin-top:10px"><button type="button" id="utClockBtn">▶ Start clock — first pitch</button><button type="button" id="utAddBtn">+1:00</button><button type="button" id="utHalfBtn" class="primary ut-big">End half-inning</button></div>'+
      '<div class="ut-score" style="margin-top:10px"><strong>Away runs</strong><button type="button" id="utAwayMinus" aria-label="Away runs minus">−</button><span class="n" id="utAway">0</span><button type="button" id="utAwayPlus" aria-label="Away runs plus">+</button></div>'+
      '<div class="ut-score" style="margin-top:6px"><strong>Home runs</strong><button type="button" id="utHomeMinus" aria-label="Home runs minus">−</button><span class="n" id="utHome">0</span><button type="button" id="utHomePlus" aria-label="Home runs plus">+</button></div>'+
      '<div class="muted" id="utHalfRuns" style="margin-top:4px"></div>'+
      '<div class="ut-row" style="margin-top:10px"><span class="muted">Fix the inning:</span><button type="button" id="utInnMinus">− Inning</button><button type="button" id="utInnPlus">+ Inning</button><button type="button" id="utEndBtn">End game now</button></div>'+
      '<div class="ut-row" style="margin-top:10px"><button type="button" id="utReset">Reset / new game</button></div>'+
      '<div class="muted" style="margin-top:8px">This is the umpire crew\u2019s tracker for this game, kept on this phone. It follows the SSB rulebook — it does not change the captain\u2019s team page.</div>';
    var modes=card.querySelector('#utModes');
    [['regular','Regular season'],['playoffs','Playoffs']].forEach(function(pair){
      var b=document.createElement('button');b.type='button';b.className='ut-chip';b.dataset.mode=pair[0];b.textContent=pair[1];
      b.onclick=function(){S.mode=pair[0];save();render();};
      modes.appendChild(b);
    });
    var durs=card.querySelector('#utDurations');
    [[GAME_MINUTES,'40 min'],[TURF_MINUTES,'30 min (turf)']].forEach(function(pair){
      var b=document.createElement('button');b.type='button';b.className='ut-chip';b.dataset.dur=String(pair[0]);b.textContent=pair[1];
      b.onclick=function(){
        if(elapsedMs(S,Date.now())>0&&!S.over&&!window.confirm('Change the official clock length mid-game? Only for a league-declared turf game (Rule 4.1.4).'))return;
        S.durationMin=pair[0];save();render();
      };
      durs.appendChild(b);
    });
    card.querySelector('#utClockBtn').onclick=function(){toggleClock(S,Date.now());save();render();};
    card.querySelector('#utAddBtn').onclick=function(){addTime(S,60000);save();render();};
    card.querySelector('#utHalfBtn').onclick=function(){var t=endHalf(S);save();render();if(t==='final'||t==='extra-start')buzz();};
    card.querySelector('#utAwayMinus').onclick=function(){adjustScore(S,'away',-1);save();render();};
    card.querySelector('#utAwayPlus').onclick=function(){adjustScore(S,'away',1);save();render();};
    card.querySelector('#utHomeMinus').onclick=function(){adjustScore(S,'home',-1);save();render();};
    card.querySelector('#utHomePlus').onclick=function(){adjustScore(S,'home',1);save();render();};
    card.querySelector('#utInnMinus').onclick=function(){adjustInning(S,-1);save();render();};
    card.querySelector('#utInnPlus').onclick=function(){adjustInning(S,1);save();render();};
    card.querySelector('#utEndBtn').onclick=function(){
      if(S.over)return;
      if(!window.confirm('End the game now? Use for umpire-called games, walk-offs, and Rule 4.4.1. If the game is called early, the recorded score is the end of the last completed inning (Rule 4.4).'))return;
      finish(S,'umpire-ended');save();render();buzz();
    };
    card.querySelector('#utReset').onclick=function(){
      if(!window.confirm('Reset the tracker for a new game? Clock, inning, and runs go back to zero.'))return;
      var keepMode=S.mode,keepDur=S.durationMin;S=createState();S.mode=keepMode;S.durationMin=keepDur;timeUpBuzzed=false;save();render();
    };
    return card;
  }

  function checkTimeUp(now){
    if(S.over||S.timeUp)return;
    if(elapsedMs(S,now)>=limitMs(S)){
      S.timeUp=true;S.scoreAtTimeUp={away:S.away,home:S.home};save();
      if(!timeUpBuzzed){timeUpBuzzed=true;buzz();}
    }
  }

  function render(){
    if(!card)return;
    var now=Date.now();checkTimeUp(now);
    var ms=elapsedMs(S,now),rem=remainingMs(S,now);
    var clockEl=card.querySelector('#utClock');
    clockEl.textContent=fmtClock(rem);
    clockEl.classList.toggle('up',S.timeUp&&!S.over);
    card.querySelector('#utClockState').textContent=S.over?'Final — '+fmtElapsed(ms)+' played':(S.timeUp?'Time reached — finish this inning, no new inning (Rule 4.1)':(S.runningSince?'Official clock running — stops only for an umpire time out':(ms>0?'Clock stopped (umpire time out) — tap Resume':'Clock starts on the first pitch (Rule 4.1)')));
    card.querySelector('#utClockBtn').textContent=S.runningSince?'⏸ Time out':'▶ '+(ms>0?'Resume clock':'Start clock — first pitch');
    card.querySelector('#utInning').textContent=S.extra?('Inning '+S.inning+' — EXTRA'):('Inning '+Math.min(S.inning,REGULATION_INNINGS)+' of '+REGULATION_INNINGS);
    card.querySelector('#utStatus').textContent=statusLine(S);
    card.querySelector('#utAway').textContent=String(S.away);
    card.querySelector('#utHome').textContent=String(S.home);
    card.querySelector('#utHalfRuns').textContent=S.mode==='playoffs'?'No run cap in the playoffs (Rule 4.3.1).':('Runs this half-inning: '+(S.runsThisHalf||0)+' of '+RUN_CAP+' max (Rule 4.3.1)');
    var prog=card.querySelector('#utProg'),html='';
    var halvesDone=(Math.min(S.inning,REGULATION_INNINGS)-1)*2+(S.half==='bottom'?1:0);
    for(var i=0;i<REGULATION_INNINGS*2;i++)html+='<span class="'+(i<halvesDone||S.over?'done':(i===halvesDone?'now':''))+'"></span>';
    prog.innerHTML=html;
    var banner=card.querySelector('#utBanner'),diff=Math.abs(S.away-S.home);
    if(S.over){
      var result=S.finalReason==='tie'?'Tie game — ties stand in the regular season (Rule 4.5).':('Final: Away '+S.away+', Home '+S.home+' — '+(S.away>S.home?'Away':S.home>S.away?'Home':'Tied')+(S.away===S.home?'':' wins')+'.');
      var extraNote=S.finalReason==='home-held'?' Home led after the top of the last inning, so no bottom was played (Rule 4.4).':(S.finalReason==='slaughter'?' Ended by the slaughter rule — report the score at the end of the last completed inning (Rule 4.3.2).':(S.finalReason==='umpire-ended'?' Ended by the umpire — if called early, report the score at the end of the last completed inning (Rule 4.4).':''));
      var scrimmage=(S.finalReason==='regulation'||S.finalReason==='home-held')&&ms<limitMs(S)?' Under the time limit with 5 innings played: teams may agree to scrimmage innings — runs do not count (Rule 4.1.3).':'';
      banner.innerHTML='<div class="ut-banner final">🏁 GAME OVER — '+result+extraNote+scrimmage+'</div>';
    }else if(S.extra){
      banner.innerHTML='<div class="ut-banner extra">⚠️ Playoff extra innings (Rule 4.5): last kicker starts on 2nd base, kicking team assessed 1 out. Full innings until someone leads after the bottom half — or Home wins the moment they take the lead.</div>';
    }else if(S.timeUp&&S.half==='bottom'&&S.home>S.away&&S.scoreAtTimeUp){
      banner.innerHTML='<div class="ut-banner warn">⏰ Rule 4.4.1: time reached '+S.durationMin+':00 during the bottom with Home winning. The game ends at the conclusion of the current play — record the score as of the time limit: Away '+S.scoreAtTimeUp.away+', Home '+S.scoreAtTimeUp.home+'. Use “End game now” when the play concludes.</div>';
    }else if(S.timeUp){
      banner.innerHTML='<div class="ut-banner warn">⏰ '+S.durationMin+':00 reached — this is the final inning. Finish it; no new inning may start (Rule 4.1).</div>';
    }else if(capReached(S)){
      banner.innerHTML='<div class="ut-banner warn">6-run cap reached — this half-inning is complete (Rule 4.3.1). Tap “End half-inning.”'+(isFinalInning(S)&&S.half==='bottom'?' Exception: the trailing team\u2019s final at-bat may pass 6 only to tie (Rule 4.3.1.1).':'')+'</div>';
    }else if(slaughterMet(S,now)){
      banner.innerHTML='<div class="ut-banner warn">Slaughter rule conditions met (Rule 4.3.2): '+diff+'-run gap at '+(ms>=SLAUGHTER_MIN_MS?'30:00+':'3+ innings')+'. Ask the trailing captain if they want to end the game; if yes, end it after this inning and report the last completed inning\u2019s score.</div>';
    }else if(isFinalInning(S)&&S.half==='bottom'&&S.home>S.away){
      banner.innerHTML='<div class="ut-banner warn">Home leads in the bottom of the final inning — if they just took the lead, the game is already over (Rule 4.4). Use “End game now.”</div>';
    }else if(isFinalInning(S)&&S.half==='top'){
      banner.innerHTML='<div class="ut-banner extra">Final inning. If Home still leads after this top half, the game ends — no bottom (Rule 4.4).</div>';
    }else banner.innerHTML='';
    card.querySelectorAll('#utModes .ut-chip').forEach(function(b){b.classList.toggle('on',b.dataset.mode===S.mode);});
    card.querySelectorAll('#utDurations .ut-chip').forEach(function(b){b.classList.toggle('on',Number(b.dataset.dur)===S.durationMin);});
    var halfBtn=card.querySelector('#utHalfBtn');
    halfBtn.textContent=S.over?'Game over':(S.half==='top'?'End top half →':'End bottom half →');
    halfBtn.disabled=!!S.over;
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
