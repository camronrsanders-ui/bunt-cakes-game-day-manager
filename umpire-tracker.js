/* FeildHaus Umpire Game Bar — Stonewall Sports Boston rules edition.
   The game controls of the Umpire Console live in ONE place: this bar is
   mounted inside the console card and drives the console's shared game
   record (score, inning, kicking team), so there is exactly one scoreboard.
   The official clock and the SSB rules flow (Section 4) live here:
   - Rule 4.1: at most FIVE innings; official clock 40 minutes (30 for
     league-declared turf games, Rule 4.1.4). No new inning at/after time;
     the inning in progress is finished. Clock starts on the first pitch.
   - Rule 13.1 / 3.2.1.1: the clock runs continuously; only an umpire time
     out stops it, and the umpire may add time back.
   - Rule 4.4: home leading after the top of the final inning ends the game
     (no bottom); a home lead taken in the bottom ends it on that play.
   - Rule 4.4.1: time reached during the bottom with Home winning ends the
     game at the conclusion of that play, score as of the time limit.
   - Rule 4.5: regular-season ties stand; playoff ties go to extra innings
     (last kicker on 2nd base, one out assessed).
   - Rule 4.3.1: 6-run cap per half-inning (playoffs exempt; trailing team's
     final at-bat may pass it only to tie — 4.3.1.1).
   - Rule 4.3.2: slaughter check at 30:00 or 3 innings with a 10+ run gap.
   Clock/rules meta is kept per officiating slot in localStorage; the score
   itself is never stored here — the console's game record is the one book. */
(function(){
  'use strict';
  var REGULATION_INNINGS=5;
  var GAME_MINUTES=40;
  var TURF_MINUTES=30;
  var RUN_CAP=6;
  var SLAUGHTER_MIN_MS=30*60000, SLAUGHTER_INNINGS=3, SLAUGHTER_DIFF=10;
  var STALE_MS=12*60*60*1000;

  function createMeta(){
    return {mode:'regular',durationMin:GAME_MINUTES,elapsedBase:0,runningSince:0,addedMs:0,
      timeUp:false,scoreAtTimeUp:null,over:false,extra:false,finalReason:'',runsThisHalf:0,
      lastInning:1,lastHalf:'top',savedAt:0};
  }
  function elapsedMs(m,now){return (m.elapsedBase||0)+(m.runningSince?Math.max(0,now-m.runningSince):0);}
  function limitMs(m){return (m.durationMin||GAME_MINUTES)*60000+(m.addedMs||0);}
  function remainingMs(m,now){return Math.max(0,limitMs(m)-elapsedMs(m,now));}
  function fmtClock(ms){var t=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
  function fmtElapsed(ms){var t=Math.floor(ms/1000);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
  function ordinal(n){var suf=['th','st','nd','rd'],v=n%100;return n+(suf[(v-20)%10]||suf[v]||suf[0]);}
  function isFinalInning(v){return !v.extra&&(v.inning>=REGULATION_INNINGS||!!v.timeUp);}
  // v = {inning, half ('top'|'bottom'), away, home, mode, timeUp, extra, over, finalReason}
  function endHalfView(v){
    if(v.over)return 'over';
    if(v.half==='top'){
      if(isFinalInning(v)&&v.home>v.away){v.over=true;v.finalReason='home-held';return 'final';}
      return 'to-bottom';
    }
    if(v.extra){
      if(v.away!==v.home){v.over=true;v.finalReason='extra-decided';return 'final';}
      return 'extra-next';
    }
    if(isFinalInning(v)){
      if(v.away!==v.home){v.over=true;v.finalReason='regulation';return 'final';}
      if(v.mode==='playoffs'){v.extra=true;return 'extra-start';}
      v.over=true;v.finalReason='tie';return 'final';
    }
    return 'next-inning';
  }
  function capReached(v){return v.mode!=='playoffs'&&(v.runsThisHalf||0)>=RUN_CAP;}
  function slaughterMet(v,elapsed){
    if(v.over)return false;
    return Math.abs((v.away||0)-(v.home||0))>=SLAUGHTER_DIFF&&(elapsed>=SLAUGHTER_MIN_MS||(v.inning-1)>=SLAUGHTER_INNINGS);
  }
  function statusLine(v){
    if(v.over)return v.finalReason==='tie'?'Game over — tie game':'Game over';
    if(v.extra)return 'Extra innings — last kicker on 2nd, 1 out (Rule 4.5)';
    return (v.half==='top'?'Top':'Bottom')+' of the '+ordinal(v.inning)+' — '+(v.half==='top'?'Away':'Home')+' kicking';
  }

  var core={REGULATION_INNINGS:REGULATION_INNINGS,GAME_MINUTES:GAME_MINUTES,RUN_CAP:RUN_CAP,createMeta:createMeta,
    elapsedMs:elapsedMs,limitMs:limitMs,remainingMs:remainingMs,fmtClock:fmtClock,fmtElapsed:fmtElapsed,ordinal:ordinal,
    isFinalInning:isFinalInning,endHalfView:endHalfView,capReached:capReached,slaughterMet:slaughterMet,statusLine:statusLine};
  if(typeof window!=='undefined')window.UmpireGameTrackerCore=core;
  if(typeof document==='undefined')return;

  var STYLE_ID='umpire-gamebar-styles';
  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    var st=document.createElement('style');st.id=STYLE_ID;
    st.textContent='.utb{color:#1f2937}.utb-top{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.utb-clock{font-size:2.3rem;font-weight:950;line-height:1;font-variant-numeric:tabular-nums}.utb-clock.up{color:#b91c1c}.utb-clockstate{font-size:.8rem;color:#6b7280;max-width:210px}.utb-inning{font-size:1.25rem;font-weight:950;text-align:right}.utb-status{font-weight:800;text-align:right}.utb-prog{display:flex;gap:3px;margin-top:6px}.utb-prog span{flex:1;height:7px;border-radius:99px;background:#e5e7eb;min-width:14px}.utb-prog span.done{background:#15803d}.utb-prog span.now{background:#f59e0b}.utb-banner{border-radius:12px;padding:9px 11px;font-weight:800;margin-top:10px;font-size:.95rem}.utb-banner:empty{padding:0;margin:0}.utb-banner.final{background:#ecfdf3;color:#14532d;border:1px solid #15803d}.utb-banner.warn{background:#fef2f2;color:#991b1b;border:1px solid #fca5a5}.utb-banner.extra{background:#fff7ed;color:#9a3412;border:1px solid #fdba74}.utb-score{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.utb-team{border:1px solid #d1d5db;border-radius:14px;padding:9px;text-align:center}.utb-tname{font-weight:900;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.utb-runs{font-size:2.1rem;font-weight:950;line-height:1.05}.utb-team .utb-sbtns{display:grid;grid-template-columns:1fr 1.4fr;gap:6px;margin-top:6px}.utb-team button{min-height:46px;font-weight:900}.utb-halfrow{display:flex;gap:8px;align-items:center;margin-top:10px}.utb-half{flex:1;min-height:54px;font-size:1.02rem;font-weight:900}.utb-halfruns{font-size:.85rem;color:#6b7280;margin-top:6px}.utb-chip.on{background:#071926;color:#fff;border-color:#071926}.utb-setup{margin-top:10px;border-top:1px solid #e5e7eb;padding-top:8px}.utb-setup summary{font-weight:800;cursor:pointer;min-height:40px;display:flex;align-items:center}.utb-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:8px}.utb-row button{min-height:44px;font-weight:800}.utb-row label{flex:1;min-width:120px}.utb-row input{width:100%;min-height:44px}@media(max-width:430px){.utb-clock{font-size:1.9rem}.utb-clockstate{max-width:150px}.utb-inning{font-size:1.1rem}}';
    document.head.appendChild(st);
  }
  function buzz(){try{if(navigator.vibrate)navigator.vibrate(200);}catch(_){}}

  var sessions={}; // eventId -> {meta, io, el, timeUpBuzzed}
  function keyFor(eventId){return 'feildhaus-umpire-tracker-v3:'+((typeof window!=='undefined'&&window.__teamSlug)||'default')+':'+eventId;}
  function loadMeta(eventId){
    var m=createMeta();
    try{
      var raw=localStorage.getItem(keyFor(eventId));
      if(raw){var p=JSON.parse(raw);if(p&&Date.now()-(p.savedAt||0)<STALE_MS)m=Object.assign(createMeta(),p);}
    }catch(_){}
    return m;
  }
  function saveMeta(eventId,m){m.savedAt=Date.now();try{localStorage.setItem(keyFor(eventId),JSON.stringify(m));}catch(_){}}

  function viewOf(sess){
    var g=sess.io.getGame(),m=sess.meta;
    return {inning:g.inning||1,half:g.kickingTeam==='a'?'bottom':'top',away:g.teamBScore||0,home:g.teamAScore||0,
      mode:m.mode,timeUp:m.timeUp,extra:m.extra,over:m.over,finalReason:m.finalReason,runsThisHalf:m.runsThisHalf};
  }
  function checkTimeUp(sess,now){
    var m=sess.meta;
    if(m.over||m.timeUp)return;
    if(elapsedMs(m,now)>=limitMs(m)){
      var g=sess.io.getGame();
      m.timeUp=true;m.scoreAtTimeUp={away:g.teamBScore||0,home:g.teamAScore||0};saveMeta(sess.eventId,m);
      if(!sess.timeUpBuzzed){sess.timeUpBuzzed=true;buzz();}
    }
  }

  function render(sess){
    var el=sess.el;if(!el)return;
    var now=Date.now();checkTimeUp(sess,now);
    var m=sess.meta,g=sess.io.getGame(),v=viewOf(sess);
    var clockEl=el.querySelector('.utb-clock');
    clockEl.textContent=fmtClock(remainingMs(m,now));
    clockEl.classList.toggle('up',!!m.timeUp&&!m.over);
    el.querySelector('.utb-clockstate').textContent=m.over?'Final — '+fmtElapsed(elapsedMs(m,now))+' played':(m.timeUp?'Time reached — finish this inning, no new inning (Rule 4.1)':(m.runningSince?'Official clock running — stops only for an umpire time out':(elapsedMs(m,now)>0?'Clock stopped (umpire time out)':'Clock starts on the first pitch (Rule 4.1)')));
    el.querySelector('.utb-clockbtn').textContent=m.runningSince?'⏸ Time out':'▶ '+(elapsedMs(m,now)>0?'Resume':'Start clock');
    el.querySelector('.utb-inning').textContent=m.extra?('Inning '+v.inning+' — EXTRA'):('Inning '+Math.min(v.inning,REGULATION_INNINGS)+' of '+REGULATION_INNINGS);
    el.querySelector('.utb-status').textContent=statusLine(v);
    var doneIdx=(Math.min(v.inning,REGULATION_INNINGS)-1)*2+(v.half==='bottom'?1:0);
    el.querySelector('.utb-prog').innerHTML=Array.from({length:REGULATION_INNINGS*2},function(_,i){
      return '<span class="'+(i<doneIdx||m.over?'done':(i===doneIdx?'now':''))+'"></span>';
    }).join('');
    el.querySelector('.utb-away-name').textContent=(g.teamBName||'Away');
    el.querySelector('.utb-home-name').textContent=(g.teamAName||'Home');
    el.querySelector('.utb-away-runs').textContent=String(v.away);
    el.querySelector('.utb-home-runs').textContent=String(v.home);
    el.querySelector('.utb-halfruns').textContent=m.mode==='playoffs'?'No run cap in the playoffs (Rule 4.3.1).':('Runs this half-inning: '+(m.runsThisHalf||0)+' of '+RUN_CAP+' max (Rule 4.3.1)');
    var banner=el.querySelector('.utb-banner'),ms=elapsedMs(m,now),diff=Math.abs(v.away-v.home);
    if(m.over){
      var winner=v.away>v.home?(g.teamBName||'Away'):v.home>v.away?(g.teamAName||'Home'):'';
      var result=m.finalReason==='tie'?'Tie game — ties stand in the regular season (Rule 4.5).':('Final: '+(g.teamBName||'Away')+' '+v.away+', '+(g.teamAName||'Home')+' '+v.home+(winner?' — '+winner+' wins.':'.'));
      var note=m.finalReason==='home-held'?' Home led after the top of the last inning, so no bottom was played (Rule 4.4).':(m.finalReason==='umpire-ended'?' Ended by the umpire — if called early, report the score at the end of the last completed inning (Rule 4.4).':'');
      var scrim=(m.finalReason==='regulation'||m.finalReason==='home-held')&&ms<limitMs(m)?' Under the time limit with 5 innings played: teams may agree to scrimmage innings — runs do not count (Rule 4.1.3).':'';
      banner.className='utb-banner final';banner.textContent='🏁 GAME OVER — '+result+note+scrim;
    }else if(m.extra){
      banner.className='utb-banner extra';banner.textContent='⚠️ Playoff extra innings (Rule 4.5): last kicker starts on 2nd base, kicking team assessed 1 out. Full innings until someone leads after the bottom half — or Home wins the moment they take the lead.';
    }else if(m.timeUp&&v.half==='bottom'&&v.home>v.away&&m.scoreAtTimeUp){
      banner.className='utb-banner warn';banner.textContent='⏰ Rule 4.4.1: time reached during the bottom with Home winning. The game ends at the conclusion of the current play — record the score as of the time limit: Away '+m.scoreAtTimeUp.away+', Home '+m.scoreAtTimeUp.home+'. Use “End game now” in Game setup when the play concludes.';
    }else if(m.timeUp){
      banner.className='utb-banner warn';banner.textContent='⏰ Time reached — this is the final inning. Finish it; no new inning may start (Rule 4.1).';
    }else if(capReached(v)){
      banner.className='utb-banner warn';banner.textContent='6-run cap reached — this half-inning is complete (Rule 4.3.1). Tap “End bottom/top half.”'+(isFinalInning(v)&&v.half==='bottom'?' Exception: the trailing team\u2019s final at-bat may pass 6 only to tie (Rule 4.3.1.1).':'');
    }else if(slaughterMet(v,ms)){
      banner.className='utb-banner warn';banner.textContent='Slaughter rule conditions met (Rule 4.3.2): '+diff+'-run gap. Ask the trailing captain if they want to end the game; if yes, end it after this inning and report the last completed inning\u2019s score.';
    }else if(isFinalInning(v)&&v.half==='bottom'&&v.home>v.away){
      banner.className='utb-banner warn';banner.textContent='Home leads in the bottom of the final inning — if they just took the lead, the game is already over (Rule 4.4). Use “End game now” in Game setup.';
    }else if(isFinalInning(v)&&v.half==='top'){
      banner.className='utb-banner extra';banner.textContent='Final inning. If Home still leads after this top half, the game ends — no bottom (Rule 4.4).';
    }else{banner.className='utb-banner';banner.textContent='';}
    var det=el.querySelector('.utb-setup');
    if(det&&sess.setupOpen&&!det.open)det.open=true;
    var halfBtn=el.querySelector('.utb-half');
    halfBtn.textContent=m.over?'Game over':(v.half==='top'?'End top half →':'End bottom half →');
    halfBtn.disabled=!!m.over;
    el.querySelectorAll('.utb-chip[data-mode]').forEach(function(b){b.classList.toggle('on',b.dataset.mode===m.mode);});
    el.querySelectorAll('.utb-chip[data-dur]').forEach(function(b){b.classList.toggle('on',Number(b.dataset.dur)===m.durationMin);});
  }

  function endHalf(sess){
    var m=sess.meta,g=sess.io.getGame(),v=viewOf(sess);
    var t=endHalfView(v);
    m.over=v.over;m.extra=v.extra;m.finalReason=v.finalReason;
    if(t==='final'){if(m.runningSince){m.elapsedBase=elapsedMs(m,Date.now());m.runningSince=0;}buzz();}
    if(t==='extra-start')buzz();
    if(t==='over'){saveMeta(sess.eventId,m);render(sess);return;}
    m.runsThisHalf=0;
    var counts={balls:0,strikes:0,fouls:0,outs:0};
    if(t==='to-bottom')sess.io.patch(Object.assign({kickingTeam:'a'},counts));
    else if(t==='next-inning'||t==='extra-next'||t==='extra-start')sess.io.patch(Object.assign({kickingTeam:'b',inning:Math.min(12,(g.inning||1)+1)},counts));
    // 'final': the shared record already shows the final inning/half — no patch.
    saveMeta(sess.eventId,m);render(sess);
  }

  function mount(el,io){
    if(!el||!io||!io.eventId)return;
    ensureStyles();
    var sess=sessions[io.eventId];
    if(!sess){sess={eventId:io.eventId,meta:loadMeta(io.eventId),io:io,el:null,timeUpBuzzed:false,setupOpen:false};sessions[io.eventId]=sess;}
    sess.io=io;
    if(sess.el!==el||!el.querySelector('.utb')){
      sess.el=el;
      el.innerHTML='<div class="utb">'+
        '<div class="utb-top"><div><div class="utb-clock">40:00</div><div class="utb-clockstate"></div></div>'+
        '<div style="flex:1;min-width:150px"><div class="utb-inning"></div><div class="utb-status"></div><div class="utb-prog"></div></div>'+
        '<button type="button" class="utb-clockbtn"></button></div>'+
        '<div class="utb-banner"></div>'+
        '<div class="utb-score">'+
        '<div class="utb-team"><span class="utb-tname utb-away-name">Away</span><div class="utb-runs utb-away-runs">0</div><div class="utb-sbtns"><button type="button" data-score="away" data-d="-1">−</button><button type="button" class="primary" data-score="away" data-d="1">+ Run</button></div></div>'+
        '<div class="utb-team"><span class="utb-tname utb-home-name">Home</span><div class="utb-runs utb-home-runs">0</div><div class="utb-sbtns"><button type="button" data-score="home" data-d="-1">−</button><button type="button" class="primary" data-score="home" data-d="1">+ Run</button></div></div>'+
        '</div>'+
        '<div class="utb-halfruns"></div>'+
        '<div class="utb-halfrow"><button type="button" class="utb-half primary"></button><button type="button" class="utb-add">+1:00</button></div>'+
        '<details class="utb-setup"><summary>Game setup</summary>'+
        '<div class="utb-row"><span class="muted">Game type:</span><button type="button" class="utb-chip" data-mode="regular">Regular season</button><button type="button" class="utb-chip" data-mode="playoffs">Playoffs</button><span class="muted">Clock:</span><button type="button" class="utb-chip" data-dur="40">40 min</button><button type="button" class="utb-chip" data-dur="30">30 min (turf)</button></div>'+
        '<div class="utb-row"><label>Away team<input class="utb-name-away" autocomplete="off"></label><label>Home team<input class="utb-name-home" autocomplete="off"></label></div>'+
        '<div class="utb-row"><span class="muted">Fix the inning:</span><button type="button" class="utb-inn" data-d="-1">− Inning</button><button type="button" class="utb-inn" data-d="1">+ Inning</button><button type="button" class="utb-end">End game now</button><button type="button" class="utb-reset">Reset tracker</button></div>'+
        '<div class="muted" style="margin-top:6px">One scoreboard: these buttons update the same shared game record the captains see. The clock and rules prompts stay on this phone.</div>'+
        '</details></div>';
      var g0=io.getGame();
      el.querySelector('.utb-name-away').value=g0.teamBName||'';
      el.querySelector('.utb-name-home').value=g0.teamAName||'';
      // Game setup must survive console re-renders: remember open state.
      var setupEl=el.querySelector('.utb-setup');
      if(setupEl){setupEl.open=!!sess.setupOpen;setupEl.addEventListener('toggle',function(){sess.setupOpen=setupEl.open;});}
      el.querySelector('.utb-clockbtn').onclick=function(){
        var mm=sess.meta;if(mm.over)return;
        if(mm.runningSince){mm.elapsedBase=elapsedMs(mm,Date.now());mm.runningSince=0;}else mm.runningSince=Date.now();
        saveMeta(sess.eventId,mm);render(sess);
      };
      el.querySelector('.utb-add').onclick=function(){var mm=sess.meta;mm.addedMs=(mm.addedMs||0)+60000;if(limitMs(mm)>elapsedMs(mm,Date.now())){mm.timeUp=false;mm.scoreAtTimeUp=null;}saveMeta(sess.eventId,mm);render(sess);};
      el.querySelectorAll('[data-score]').forEach(function(b){b.onclick=function(){
        var side=b.dataset.score,delta=Number(b.dataset.d),gg=sess.io.getGame();
        var key=side==='away'?'teamBScore':'teamAScore';
        var next=Math.max(0,Math.min(99,(gg[key]||0)+delta));
        var actual=next-(gg[key]||0);
        if(actual!==0&&((gg.kickingTeam==='a'?'home':'away')===side)){
          sess.meta.runsThisHalf=Math.max(0,(sess.meta.runsThisHalf||0)+actual);
          saveMeta(sess.eventId,sess.meta);
        }
        sess.io.patch({[key]:next});
      };});
      el.querySelector('.utb-half').onclick=function(){endHalf(sess);};
      el.querySelectorAll('.utb-chip[data-mode]').forEach(function(b){b.onclick=function(){sess.meta.mode=b.dataset.mode;saveMeta(sess.eventId,sess.meta);render(sess);};});
      el.querySelectorAll('.utb-chip[data-dur]').forEach(function(b){b.onclick=function(){
        var mm=sess.meta;
        if(elapsedMs(mm,Date.now())>0&&!mm.over&&!window.confirm('Change the official clock length mid-game? Only for a league-declared turf game (Rule 4.1.4).'))return;
        mm.durationMin=Number(b.dataset.dur);saveMeta(sess.eventId,mm);render(sess);
      };});
      el.querySelector('.utb-name-away').addEventListener('change',function(e){sess.io.patch({teamBName:e.target.value});});
      el.querySelector('.utb-name-home').addEventListener('change',function(e){sess.io.patch({teamAName:e.target.value});});
      el.querySelectorAll('.utb-inn').forEach(function(b){b.onclick=function(){
        var gg=sess.io.getGame(),d=Number(b.dataset.d);
        sess.io.patch({inning:Math.max(1,Math.min(12,(gg.inning||1)+d))});
        if(d<0){sess.meta.over=false;sess.meta.finalReason='';saveMeta(sess.eventId,sess.meta);}
      };});
      el.querySelector('.utb-end').onclick=function(){
        if(sess.meta.over)return;
        if(!window.confirm('End the game now? Use for umpire-called games, walk-offs, and Rule 4.4.1. If the game is called early, the recorded score is the end of the last completed inning (Rule 4.4).'))return;
        var mm=sess.meta;mm.over=true;mm.finalReason='umpire-ended';
        if(mm.runningSince){mm.elapsedBase=elapsedMs(mm,Date.now());mm.runningSince=0;}
        saveMeta(sess.eventId,mm);render(sess);buzz();
      };
      el.querySelector('.utb-reset').onclick=function(){
        if(!window.confirm('Reset the tracker clock for a new game? The shared score is NOT changed by this — use the score − buttons if the score also needs resetting.'))return;
        var keepMode=sess.meta.mode,keepDur=sess.meta.durationMin;
        sess.meta=createMeta();sess.meta.mode=keepMode;sess.meta.durationMin=keepDur;sess.timeUpBuzzed=false;
        saveMeta(sess.eventId,sess.meta);render(sess);
      };
    }
    render(sess);
  }

  // Clock tick: refresh any mounted bar periodically.
  setInterval(function(){
    Object.values(sessions).forEach(function(sess){
      if(sess.el&&document.contains(sess.el))render(sess);
    });
  },500);

  window.UmpireGameBar={mount:mount};
})();
