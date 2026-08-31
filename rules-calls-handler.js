function clean(value){return String(value||'').trim();}
function boundedQuery(value){return clean(value).slice(0,120);}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveActiveVersion(sql,teamId){
  const rows=await sql`
    SELECT rv.id AS ruleset_version_id,rv.version,rs.name,l.name AS league_name
    FROM team_ruleset_bindings tb
    JOIN ruleset_versions rv ON rv.id=tb.active_ruleset_version_id
    JOIN rulesets rs ON rs.id=rv.ruleset_id
    JOIN leagues l ON l.id=rs.league_id
    WHERE tb.team_id=${String(teamId)}::text
      AND tb.active_to IS NULL
      AND rv.status='active'
    ORDER BY tb.active_from DESC
    LIMIT 1
  `;
  return rows[0]||null;
}

async function loadCounts(sql,versionId){
  const rows=await sql`
    SELECT key,value
    FROM rule_values
    WHERE ruleset_version_id=${String(versionId)}::uuid
      AND key IN ('balls_for_walk','strikes_for_out','fouls_for_out','outs_per_half_inning','innings','regulation_minutes')
  `;
  const values={};for(const row of rows)values[row.key]=Number(row.value);
  return {
    balls:Number.isFinite(values.balls_for_walk)?values.balls_for_walk:4,
    strikes:Number.isFinite(values.strikes_for_out)?values.strikes_for_out:3,
    fouls:Number.isFinite(values.fouls_for_out)?values.fouls_for_out:4,
    outs:Number.isFinite(values.outs_per_half_inning)?values.outs_per_half_inning:3,
    innings:Number.isFinite(values.innings)?values.innings:5,
    regulationMinutes:Number.isFinite(values.regulation_minutes)?values.regulation_minutes:40
  };
}

async function activeMetadata(sql,teamId){
  const active=await resolveActiveVersion(sql,teamId);if(!active)return null;
  return {rulesetVersionId:active.ruleset_version_id,name:active.name,leagueName:active.league_name,version:Number(active.version),counts:await loadCounts(sql,active.ruleset_version_id)};
}

async function searchScenarios(sql,versionId,query){
  const q=boundedQuery(query);if(!q)return [];
  return sql`
    SELECT s.id AS scenario_id,s.title,s.call_label,s.call_type,c.name AS category,r.rule_key,r.source_section,
      ts_rank(s.search_text,websearch_to_tsquery('english',${q}::text)) AS rank
    FROM ruling_scenarios s
    JOIN rules r ON r.id=s.rule_id
    LEFT JOIN rule_categories c ON c.id=s.category_id
    WHERE s.ruleset_version_id=${String(versionId)}::uuid
      AND r.ruleset_version_id=${String(versionId)}::uuid
      AND r.verification_status='verified'
      AND s.search_text @@ websearch_to_tsquery('english',${q}::text)
    ORDER BY rank DESC,s.display_priority DESC,s.title
    LIMIT 12
  `;
}

async function loadRuling(sql,versionId,scenarioId){
  const rows=await sql`
    SELECT s.id AS scenario_id,s.title,s.call_label,s.call_type,s.what_happened,s.what_to_do,s.why,
      r.id AS rule_id,r.rule_key,r.title AS rule_title,r.official_text,r.quick_summary,r.source_section,c.name AS category,
      v.definition_json AS visual_definition,v.alt_text AS visual_alt_text
    FROM ruling_scenarios s
    JOIN rules r ON r.id=s.rule_id
    LEFT JOIN rule_categories c ON c.id=s.category_id
    LEFT JOIN rule_visuals v ON v.scenario_id=s.id AND v.ruleset_version_id=s.ruleset_version_id
    WHERE s.id=${String(scenarioId)}::uuid
      AND s.ruleset_version_id=${String(versionId)}::uuid
      AND r.ruleset_version_id=${String(versionId)}::uuid
      AND r.verification_status='verified'
    LIMIT 1
  `;
  const ruling=rows[0];if(!ruling)return null;
  const sources=await sql`
    SELECT src.name,src.publisher,
      CASE WHEN src.url ~* '^https?://' THEN src.url ELSE NULL END AS url,
      src.citation,src.verification_status
    FROM rule_source_links link
    JOIN rule_sources src ON src.id=link.source_id
    WHERE link.rule_id=${String(ruling.rule_id)}::uuid
      AND src.ruleset_version_id=${String(versionId)}::uuid
      AND src.verification_status='verified'
    ORDER BY src.name
  `;
  const related=await sql`
    SELECT s.id AS scenario_id,s.title,s.call_label
    FROM ruling_scenarios s
    JOIN rules r ON r.id=s.rule_id
    WHERE s.ruleset_version_id=${String(versionId)}::uuid
      AND r.verification_status='verified'
      AND s.category_id=(SELECT category_id FROM ruling_scenarios WHERE id=${String(scenarioId)}::uuid AND ruleset_version_id=${String(versionId)}::uuid)
      AND s.id<>${String(scenarioId)}::uuid
    ORDER BY s.display_priority DESC,s.title
    LIMIT 5
  `;
  return {...ruling,sources,relatedCalls:related};
}

async function handleRulesCalls({req,res,sql,row,actor}){
  if(!actor)return res.status(401).json({error:'Umpire or Captain access is required'});
  try{
    const active=await activeMetadata(sql,String(row.id));
    if(!active)return res.status(404).json({error:'No active ruleset is configured for this team'});
    const action=clean(req.query&&req.query.rules).toLowerCase();
    if(action==='active')return res.status(200).json({ok:true,activeRuleset:active});
    if(action==='search'){
      const query=boundedQuery(req.query&&req.query.q);
      if(!query)return res.status(200).json({ok:true,activeRuleset:active,query:'',results:[]});
      return res.status(200).json({ok:true,activeRuleset:active,query,results:await searchScenarios(sql,active.rulesetVersionId,query)});
    }
    if(action==='ruling'){
      const scenarioId=clean(req.query&&req.query.scenarioId);
      if(!UUID_RE.test(scenarioId))return res.status(400).json({error:'A valid scenario is required'});
      const ruling=await loadRuling(sql,active.rulesetVersionId,scenarioId);
      if(!ruling)return res.status(404).json({error:'That ruling was not found in this team ruleset'});
      return res.status(200).json({ok:true,activeRuleset:active,ruling});
    }
    return res.status(400).json({error:'Unknown rules action'});
  }catch(error){
    if(String(error&&error.code)==='42P01')return res.status(503).json({error:'Rules & Calls is not available for this team yet.'});
    throw error;
  }
}

module.exports={handleRulesCalls,boundedQuery,resolveActiveVersion,activeMetadata,searchScenarios,loadRuling};
