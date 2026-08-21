(function(){
  function prefs(player){return Array.isArray(player?.preferences)?player.preferences:[];}
  function flexible(player){return player?.flexible===true||player?.flexibleAnywhere===true||player?.preferenceMode==='flexible';}
  function willing(player){return player?.willingElsewhere===true||player?.flexibleElsewhere===true;}
  function submitted(player){return player?.surveySubmitted===true;}
  function ready(player){
    if(!player)return false;
    if(typeof player.fieldProfileReady==='boolean')return player.fieldProfileReady;
    return submitted(player)||prefs(player).length>0||flexible(player)||willing(player);
  }
  function source(player){
    if(!player)return'none';
    if(player.fieldPreferenceSource==='survey'||player.fieldPreferenceSource==='captain')return player.fieldPreferenceSource;
    if(submitted(player))return'survey';
    return ready(player)?'captain':'none';
  }
  function sync(player,reason){
    if(!player)return player;
    const hasGuidance=prefs(player).length>0||flexible(player)||willing(player);
    player.surveyComplete=submitted(player);
    player.fieldProfileReady=submitted(player)||hasGuidance;
    if(reason==='survey')player.fieldPreferenceSource='survey';
    else if(reason==='captain'&&!submitted(player)&&hasGuidance)player.fieldPreferenceSource='captain';
    else if(!player.fieldProfileReady)delete player.fieldPreferenceSource;
    return player;
  }
  window.BuntFieldProfile={prefs,flexible,willing,submitted,ready,source,sync};
})();
