window.Scoring = (function() {
  let state = {
    view: 'match-list', // 'match-list' | 'toss' | 'lineups' | 'scoring' | 'innings-break' | 'match-end'
    matchId: null,
    match: null,
    inningsIdx: 0, // 0 for 1st innings, 1 for 2nd
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    pendingWicket: null,
    pendingExtra: null
  };

  function loadState() {
    try {
      const saved = localStorage.getItem('crickdesk_scoring_state');
      if (saved) {
        state = JSON.parse(saved);
        if(state.matchId) {
          // ensure match still exists
          if(!window.CrickDeskData.getMatch(state.matchId)) {
            state.view = 'match-list';
            state.matchId = null;
          }
        }
      }
    } catch(e) {}
  }

  function saveState() {
    localStorage.setItem('crickdesk_scoring_state', JSON.stringify(state));
  }

  function clearState() {
    localStorage.removeItem('crickdesk_scoring_state');
    state = { view: 'match-list', matchId: null, match: null, inningsIdx: 0, strikerId: null, nonStrikerId: null, bowlerId: null, pendingWicket: null, pendingExtra: null };
  }

  function renderMatchList() {
    const matches = window.CrickDeskData.getMatches();
    const upcoming = matches.filter(m => m.status === 'upcoming');
    const live = matches.filter(m => m.status === 'live');

    let html = `
      <div class="page-header">
        <h1 class="section-title">Live Scoring</h1>
      </div>
    `;

    if (live.length > 0) {
      html += `
        <h3 class="section-subtitle" style="margin-bottom:16px;">Live Matches</h3>
        <div class="bento-grid grid-2" style="margin-bottom:32px;">
      `;
      live.forEach(m => {
        const t1 = window.CrickDeskData.getTeam(m.team1Id);
        const t2 = window.CrickDeskData.getTeam(m.team2Id);
        html += `
          <div class="card glass hover-glow">
            <div class="card-body" style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span class="badge badge-green" style="margin-bottom:8px;"><span class="animate-pulse" style="display:inline-block; margin-right:4px;">●</span> LIVE</span>
                <h4>${t1.shortName} vs ${t2.shortName}</h4>
                <p class="text-muted" style="font-size:12px;">${window.CrickDeskUtils.formatDate(m.date)}</p>
              </div>
              <button class="btn btn-primary btn-resume" data-id="${m.id}">Resume Scoring</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    html += `<h3 class="section-subtitle" style="margin-bottom:16px;">Upcoming Matches</h3>`;
    
    if (upcoming.length === 0) {
      html += `<div class="empty-state"><h3>No upcoming matches</h3><p class="text-muted">Create a match in Fixtures to start scoring.</p></div>`;
    } else {
      html += `<div class="bento-grid grid-3">`;
      upcoming.forEach(m => {
        const t1 = window.CrickDeskData.getTeam(m.team1Id);
        const t2 = window.CrickDeskData.getTeam(m.team2Id);
        html += `
          <div class="card glass">
            <div class="card-body">
              <div style="display:flex; justify-content:center; align-items:center; gap:16px; margin-bottom:16px;">
                <div class="avatar" style="background:${t1.color};">${t1.shortName}</div>
                <div class="text-muted">vs</div>
                <div class="avatar" style="background:${t2.color};">${t2.shortName}</div>
              </div>
              <h4 style="text-align:center;">${t1.name} vs ${t2.name}</h4>
              <p class="text-muted" style="text-align:center; font-size:12px; margin-bottom:16px;">${window.CrickDeskUtils.formatDate(m.date)} • ${m.overs} Overs</p>
              <button class="btn btn-primary btn-start" style="width:100%;" data-id="${m.id}">Start Match</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    return html;
  }

  function startMatch(id) {
    state.matchId = id;
    state.match = window.CrickDeskData.getMatch(id);
    state.view = 'toss';
    state.match.status = 'live';
    state.inningsIdx = 0;
    
    // Initialize empty innings structures
    state.match.innings = [createEmptyInnings(), createEmptyInnings()];
    window.CrickDeskData.saveMatch(state.match);
    saveState();
    refreshContent();
  }

  function createEmptyInnings() {
    return {
      battingTeamId: null, bowlingTeamId: null,
      totalRuns: 0, totalWickets: 0, totalBalls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, bonus: 0 },
      balls: [], battingScorecard: [], bowlingScorecard: [], fallOfWickets: [], partnerships: [], commentary: []
    };
  }

  function renderToss() {
    const t1 = window.CrickDeskData.getTeam(state.match.team1Id);
    const t2 = window.CrickDeskData.getTeam(state.match.team2Id);
    
    return `
      <div class="page-header"><h1 class="section-title">Toss</h1></div>
      <div class="card glass" style="max-width:500px; margin:0 auto; padding:32px; text-align:center;">
        <div id="coin" style="font-size:80px; margin-bottom:32px; display:inline-block;">🪙</div>
        <div style="margin-bottom:24px;">
          <button class="btn btn-secondary" id="btn-flip">Flip Coin</button>
        </div>
        
        <div id="toss-result" style="display:none; animation:fadeIn 0.5s;">
          <h3 style="margin-bottom:16px;">Who won the toss?</h3>
          <div style="display:flex; gap:12px; justify-content:center; margin-bottom:24px;">
            <button class="btn btn-secondary toss-winner" data-id="${t1.id}" style="border-color:${t1.color}; color:${t1.color};">${t1.name}</button>
            <button class="btn btn-secondary toss-winner" data-id="${t2.id}" style="border-color:${t2.color}; color:${t2.color};">${t2.name}</button>
          </div>
          
          <div id="toss-decision-area" style="display:none;">
            <h3 style="margin-bottom:16px;">Decision</h3>
            <div style="display:flex; gap:12px; justify-content:center; margin-bottom:24px;">
              <button class="btn btn-secondary toss-decision" data-dec="bat">🏏 Bat</button>
              <button class="btn btn-secondary toss-decision" data-dec="bowl">⚾ Bowl</button>
            </div>
            
            <button class="btn btn-primary btn-lg" id="btn-confirm-toss" style="display:none; width:100%;">Confirm & Next</button>
          </div>
        </div>
      </div>
    `;
  }

  function setToss(winnerId, decision) {
    state.match.tossWonBy = winnerId;
    state.match.tossDecision = decision;
    
    const loserId = winnerId === state.match.team1Id ? state.match.team2Id : state.match.team1Id;
    
    if (decision === 'bat') {
      state.match.innings[0].battingTeamId = winnerId;
      state.match.innings[0].bowlingTeamId = loserId;
      state.match.innings[1].battingTeamId = loserId;
      state.match.innings[1].bowlingTeamId = winnerId;
    } else {
      state.match.innings[0].battingTeamId = loserId;
      state.match.innings[0].bowlingTeamId = winnerId;
      state.match.innings[1].battingTeamId = winnerId;
      state.match.innings[1].bowlingTeamId = loserId;
    }
    
    window.CrickDeskData.saveMatch(state.match);
    state.view = 'lineups';
    saveState();
    refreshContent();
  }

  function renderLineups() {
    const batTeamId = state.match.innings[state.inningsIdx].battingTeamId;
    const bowlTeamId = state.match.innings[state.inningsIdx].bowlingTeamId;
    
    const batTeam = window.CrickDeskData.getTeam(batTeamId);
    const batPlayers = window.CrickDeskData.getPlayersByTeam(batTeamId);
    
    const bowlTeam = window.CrickDeskData.getTeam(bowlTeamId);
    const bowlPlayers = window.CrickDeskData.getPlayersByTeam(bowlTeamId);

    return `
      <div class="page-header"><h1 class="section-title">Innings ${state.inningsIdx + 1} Openers</h1></div>
      <div class="bento-grid grid-2">
        <div class="card glass">
          <div class="card-header" style="background:${batTeam.color}22; border-bottom-color:${batTeam.color};">
            <h3 style="margin:0; color:${batTeam.color};">🏏 Batting: ${batTeam.name}</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Striker (Facing first ball)</label>
              <select class="form-select" id="select-striker">
                <option value="">-- Select Batsman --</option>
                ${batPlayers.map(p => `<option value="${p.id}">${p.name} (${p.role})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Non-Striker</label>
              <select class="form-select" id="select-nonstriker">
                <option value="">-- Select Batsman --</option>
                ${batPlayers.map(p => `<option value="${p.id}">${p.name} (${p.role})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        
        <div class="card glass">
          <div class="card-header" style="background:${bowlTeam.color}22; border-bottom-color:${bowlTeam.color};">
            <h3 style="margin:0; color:${bowlTeam.color};">⚾ Bowling: ${bowlTeam.name}</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Opening Bowler</label>
              <select class="form-select" id="select-bowler">
                <option value="">-- Select Bowler --</option>
                ${bowlPlayers.map(p => `<option value="${p.id}">${p.name} (${p.role})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:24px; text-align:right;">
        <button class="btn btn-primary btn-lg" id="btn-start-scoring">Start Scoring</button>
      </div>
    `;
  }

  function initBattingCard(playerId) {
    const inn = state.match.innings[state.inningsIdx];
    if (!inn.battingScorecard.find(b => b.playerId === playerId)) {
      inn.battingScorecard.push({
        playerId, runs: 0, balls: 0, fours: 0, sixes: 0, dotBalls: 0, howOut: 'not out', bowlerId: null, fielderId: null
      });
    }
    // Also add to current partnership if it's new
    if(inn.partnerships.length === 0 || inn.partnerships[inn.partnerships.length-1].isBroken) {
      inn.partnerships.push({
        bat1Id: state.strikerId, bat2Id: state.nonStrikerId, runs: 0, balls: 0, isBroken: false
      });
    }
  }

  function initBowlingCard(playerId) {
    const inn = state.match.innings[state.inningsIdx];
    if (!inn.bowlingScorecard.find(b => b.playerId === playerId)) {
      inn.bowlingScorecard.push({
        playerId, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, dotBalls: 0
      });
    }
  }

  function renderScoring() {
    const inn = state.match.innings[state.inningsIdx];
    const batTeam = window.CrickDeskData.getTeam(inn.battingTeamId);
    const bowlTeam = window.CrickDeskData.getTeam(inn.bowlingTeamId);
    const tournament = window.CrickDeskData.getTournament();
    const bpo = tournament.ballsPerOver || 6;
    
    let targetHtml = '';
    if (state.inningsIdx === 1) {
      const target = state.match.innings[0].totalRuns + 1;
      const req = target - inn.totalRuns;
      const ballsRem = (state.match.overs * bpo) - inn.totalBalls;
      const rr = ballsRem > 0 ? (req / (ballsRem/bpo)).toFixed(2) : '-';
      targetHtml = `
        <div style="background: var(--bg-tertiary); padding: 8px 16px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px;">
          <div>Target: <strong>${target}</strong></div>
          <div>Need <strong>${req}</strong> from <strong>${ballsRem}</strong> balls</div>
          <div>Req RR: <strong>${rr}</strong></div>
        </div>
      `;
    }

    const striker = inn.battingScorecard.find(b => b.playerId === state.strikerId);
    const nonStriker = inn.battingScorecard.find(b => b.playerId === state.nonStrikerId);
    const bowler = inn.bowlingScorecard.find(b => b.playerId === state.bowlerId);
    
    const strikerName = window.CrickDeskData.getPlayer(state.strikerId)?.name || '';
    const nonStrikerName = window.CrickDeskData.getPlayer(state.nonStrikerId)?.name || '';
    const bowlerName = window.CrickDeskData.getPlayer(state.bowlerId)?.name || '';

    let overDotsHtml = '';
    // simple dots for last 6 balls
    const lastBalls = inn.balls.slice(-bpo);
    lastBalls.forEach(b => {
      let cls = 'dot-0', txt = '0';
      if(b.wicket) { cls = 'dot-W'; txt = 'W'; }
      else if(b.extras.wides > 0) { cls = 'dot-w'; txt = b.extras.wides+'wd'; }
      else if(b.extras.noBalls > 0) { cls = 'dot-w'; txt = b.extras.noBalls+'nb'; }
      else if(b.runs === 4) { cls = 'dot-4'; txt = '4'; }
      else if(b.runs === 6) { cls = 'dot-6'; txt = '6'; }
      else if(b.runs > 0) { cls = 'dot-1'; txt = b.runs; }
      overDotsHtml += `<div class="score-dot ${cls}" style="width:24px; height:24px; line-height:24px; text-align:center; font-size:11px; font-weight:bold; color:white; border-radius:50%; margin-right:4px;">${txt}</div>`;
    });

    const crr = inn.totalBalls > 0 ? (inn.totalRuns / (inn.totalBalls/bpo)).toFixed(2) : '0.00';

    return `
      <div style="display:flex; gap:24px; height:calc(100vh - 100px);">
        <!-- LEFT: Controls (60%) -->
        <div style="flex:6; display:flex; flex-direction:column; gap:16px; overflow-y:auto;">
          <div class="card glass">
            <div class="card-body">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                <div>
                  <h3 style="margin:0;">${batTeam.shortName} <span class="text-muted" style="font-weight:normal; font-size:14px;">vs ${bowlTeam.shortName}</span></h3>
                  <div class="text-muted" style="font-size:12px;">Innings ${state.inningsIdx + 1}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:48px; font-weight:800; font-family:var(--font-heading); line-height:1;">${inn.totalRuns}<span style="font-size:24px; color:var(--text-muted);">/${inn.totalWickets}</span></div>
                  <div style="font-size:16px; font-weight:600;">Overs: ${window.CrickDeskUtils.formatOvers(inn.totalBalls, bpo)} <span class="text-muted" style="font-weight:normal; font-size:13px; margin-left:8px;">CRR: ${crr}</span></div>
                </div>
              </div>
              
              ${targetHtml}

              <div style="display:flex; border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:16px;">
                <div style="flex:1; padding:12px; border-right:1px solid var(--border-color);">
                  <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase;">Batting</div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:600;">
                    <div>${strikerName} *</div>
                    <div>${striker?.runs || 0} (${striker?.balls || 0})</div>
                  </div>
                  <div style="display:flex; justify-content:space-between; color:var(--text-secondary);">
                    <div>${nonStrikerName}</div>
                    <div>${nonStriker?.runs || 0} (${nonStriker?.balls || 0})</div>
                  </div>
                </div>
                <div style="flex:1; padding:12px;">
                  <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase;">Bowling</div>
                  <div style="display:flex; justify-content:space-between; font-weight:600;">
                    <div>${bowlerName}</div>
                    <div>${window.CrickDeskUtils.formatOvers(bowler?.balls || 0, bpo)}-${bowler?.maidens || 0}-${bowler?.runs || 0}-${bowler?.wickets || 0}</div>
                  </div>
                  <div style="margin-top:8px; display:flex;">
                    ${overDotsHtml}
                  </div>
                </div>
              </div>

              <!-- Scoring Pad -->
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:12px;">
                <button class="btn btn-secondary score-btn" style="height:60px; font-size:24px; font-weight:bold; color:var(--text-primary); border-color:var(--border-color);" data-runs="0">0</button>
                <button class="btn btn-secondary score-btn" style="height:60px; font-size:24px; font-weight:bold; color:var(--text-primary);" data-runs="1">1</button>
                <button class="btn btn-secondary score-btn" style="height:60px; font-size:24px; font-weight:bold; color:var(--text-primary);" data-runs="2">2</button>
                <button class="btn btn-secondary score-btn" style="height:60px; font-size:24px; font-weight:bold; color:var(--text-primary);" data-runs="3">3</button>
                <button class="btn btn-primary score-btn" style="height:60px; font-size:24px; font-weight:bold; background:var(--accent-green);" data-runs="4">4</button>
                <button class="btn btn-secondary score-btn" style="height:60px; font-size:24px; font-weight:bold; color:var(--text-primary);" data-runs="5">5</button>
                <button class="btn btn-primary score-btn" style="height:60px; font-size:24px; font-weight:bold; background:var(--accent-amber); grid-column:span 2;" data-runs="6">6</button>
              </div>
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:12px;">
                <button class="btn btn-secondary score-extra" data-type="wide">Wide</button>
                <button class="btn btn-secondary score-extra" data-type="noball">No Ball</button>
                <button class="btn btn-secondary score-extra" data-type="bye">Bye</button>
                <button class="btn btn-secondary score-extra" data-type="legbye">Leg Bye</button>
              </div>
              <div style="display:grid; grid-template-columns:3fr 1fr; gap:12px;">
                <button class="btn btn-danger score-wicket" style="height:50px; font-size:18px;">OUT!</button>
                <button class="btn btn-secondary score-undo" style="height:50px;">↩ Undo</button>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Live Info (40%) -->
        <div style="flex:4; display:flex; flex-direction:column; gap:16px; overflow-y:auto;">
          <div class="card glass">
            <div class="card-header" style="padding:12px 16px;"><h3 style="margin:0; font-size:14px;">Batting Card</h3></div>
            <div class="card-body" style="padding:0;">
              <table class="data-table" style="font-size:12px;">
                <thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
                <tbody>
                  ${inn.battingScorecard.map(b => `
                    <tr style="${b.howOut==='not out'?'font-weight:600;':''}">
                      <td>${window.CrickDeskData.getPlayer(b.playerId).name}${b.playerId===state.strikerId?' *':''}</td>
                      <td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td>
                      <td>${window.CrickDeskUtils.calculateStrikeRate(b.runs,b.balls)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card glass">
            <div class="card-header" style="padding:12px 16px;"><h3 style="margin:0; font-size:14px;">Bowling Card</h3></div>
            <div class="card-body" style="padding:0;">
              <table class="data-table" style="font-size:12px;">
                <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
                <tbody>
                  ${inn.bowlingScorecard.map(b => `
                    <tr style="${b.playerId===state.bowlerId?'font-weight:600;':''}">
                      <td>${window.CrickDeskData.getPlayer(b.playerId).name}</td>
                      <td>${window.CrickDeskUtils.formatOvers(b.balls, bpo)}</td><td>${b.maidens}</td><td>${b.runs}</td><td>${b.wickets}</td>
                      <td>${window.CrickDeskUtils.calculateEconomy(b.runs, b.balls, bpo)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card glass" style="flex:1; display:flex; flex-direction:column;">
            <div class="card-header" style="padding:12px 16px;"><h3 style="margin:0; font-size:14px;">Commentary</h3></div>
            <div class="card-body" style="padding:12px; overflow-y:auto; flex:1; font-size:13px; font-family:var(--font-body); display:flex; flex-direction:column; gap:8px;">
              ${inn.commentary.slice().reverse().map(c => `
                <div style="padding-bottom:8px; border-bottom:1px solid var(--border-color); display:flex; gap:8px;">
                  <span style="font-weight:600; color:var(--accent-green); min-width:30px;">${c.over}</span>
                  <span>${c.text}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function recordBall(runs, isWide=false, isNoBall=false, isBye=false, isLegBye=false, wicketObj=null, isPenalty=false) {
    const inn = state.match.innings[state.inningsIdx];
    const tournament = window.CrickDeskData.getTournament();
    const bpo = tournament.ballsPerOver || 6;
    
    // Create ball record
    const ball = {
      over: Math.floor(inn.totalBalls/bpo) + '.' + ((inn.totalBalls%bpo)+1),
      batsmanId: state.strikerId,
      bowlerId: state.bowlerId,
      runs: 0,
      extras: { wides:0, noBalls:0, byes:0, legByes:0 },
      wicket: wicketObj,
      shotRegion: null
    };

    let totalRunsForBall = 0;
    let countsAsBall = true;
    let countsForBatsman = true;

    if (isPenalty) {
      // e.g. -5 runs
      inn.totalRuns += runs;
      inn.extras.bonus += runs;
      saveMatchState();
      return;
    }

    if (isWide) {
      ball.extras.wides = 1 + runs;
      inn.extras.wides += ball.extras.wides;
      totalRunsForBall = ball.extras.wides;
      countsAsBall = false;
      countsForBatsman = false;
    } else if (isNoBall) {
      ball.extras.noBalls = 1;
      inn.extras.noBalls += 1;
      totalRunsForBall = 1;
      countsAsBall = false;
      if (isBye || isLegBye) {
        countsForBatsman = false;
        if(isBye) { ball.extras.byes = runs; inn.extras.byes += runs; }
        else { ball.extras.legByes = runs; inn.extras.legByes += runs; }
        totalRunsForBall += runs;
      } else {
        ball.runs = runs;
        totalRunsForBall += runs;
      }
    } else if (isBye || isLegBye) {
      countsForBatsman = false;
      if(isBye) { ball.extras.byes = runs; inn.extras.byes += runs; }
      else { ball.extras.legByes = runs; inn.extras.legByes += runs; }
      totalRunsForBall = runs;
    } else {
      ball.runs = runs;
      totalRunsForBall = runs;
    }

    inn.totalRuns += totalRunsForBall;
    if (countsAsBall) {
      inn.totalBalls++;
      ball.over = Math.floor((inn.totalBalls-1)/bpo) + '.' + (((inn.totalBalls-1)%bpo)+1);
    }
    
    // Update Batsman
    const bat = inn.battingScorecard.find(b => b.playerId === state.strikerId);
    if(countsAsBall) bat.balls++;
    if(countsForBatsman) {
      bat.runs += ball.runs;
      if(ball.runs === 4) bat.fours++;
      if(ball.runs === 6) bat.sixes++;
      if(ball.runs === 0 && !wicketObj) bat.dotBalls++;
    }

    // Update Bowler
    const bowl = inn.bowlingScorecard.find(b => b.playerId === state.bowlerId);
    if(countsAsBall) bowl.balls++;
    bowl.runs += totalRunsForBall;
    if(isBye || isLegBye) bowl.runs -= runs; // byes don't count against bowler
    if(isWide) bowl.wides++;
    if(isNoBall) bowl.noBalls++;
    if(totalRunsForBall === 0 && !isWide && !isNoBall && !wicketObj) bowl.dotBalls++;
    if(wicketObj && !['Run Out', 'Retired Hurt'].includes(wicketObj.type)) bowl.wickets++;

    // Wicket logic
    if (wicketObj) {
      inn.totalWickets++;
      bat.howOut = wicketObj.type;
      bat.bowlerId = state.bowlerId;
      bat.fielderId = wicketObj.fielderId;
      
      inn.fallOfWickets.push({
        wicketNumber: inn.totalWickets,
        runs: inn.totalRuns,
        overs: window.CrickDeskUtils.formatOvers(inn.totalBalls, bpo),
        playerId: state.strikerId
      });

      // Break partnership
      if(inn.partnerships.length > 0) {
        inn.partnerships[inn.partnerships.length-1].isBroken = true;
      }
    }

    // Partnership runs
    if(inn.partnerships.length > 0 && !inn.partnerships[inn.partnerships.length-1].isBroken) {
      inn.partnerships[inn.partnerships.length-1].runs += totalRunsForBall;
      if(countsAsBall) inn.partnerships[inn.partnerships.length-1].balls++;
    }

    // Generate commentary
    const strName = window.CrickDeskData.getPlayer(state.strikerId).name;
    const bwlName = window.CrickDeskData.getPlayer(state.bowlerId).name;
    let txt = `${bwlName} to ${strName}, `;
    if(wicketObj) txt += `WICKET! ${wicketObj.type}`;
    else if(isWide) txt += `Wide ball (${ball.extras.wides} runs)`;
    else if(isNoBall) txt += `No ball (${totalRunsForBall} runs)`;
    else if(ball.runs === 4) txt += `FOUR! Great shot`;
    else if(ball.runs === 6) txt += `SIX! Massive hit`;
    else if(ball.runs === 0) txt += `no run`;
    else txt += `${ball.runs} run${ball.runs>1?'s':''}`;
    
    inn.commentary.push({ over: ball.over, text: txt, timestamp: new Date().toISOString() });
    
    inn.balls.push(ball);

    // End of over logic
    const isEndOfOver = countsAsBall && (inn.totalBalls % bpo === 0);
    
    // Strike rotation
    let rotate = false;
    if(!isWide && !isNoBall) {
      if(runs % 2 !== 0) rotate = true;
    }
    if(isEndOfOver) rotate = !rotate; // Swap at end of over
    
    if(rotate && !wicketObj) {
      let temp = state.strikerId;
      state.strikerId = state.nonStrikerId;
      state.nonStrikerId = temp;
    }

    saveMatchState();

    // Check Match End or Innings End
    if(checkInningsEnd()) return;

    if (wicketObj && inn.totalWickets < tournament.playersPerTeam - 1) {
      promptNewBatsman(rotate);
    } else if (isEndOfOver) {
      promptNewBowler();
    } else {
      refreshContent();
    }
  }

  function checkInningsEnd() {
    const inn = state.match.innings[state.inningsIdx];
    const tournament = window.CrickDeskData.getTournament();
    const maxBalls = state.match.overs * (tournament.ballsPerOver || 6);
    const allOut = inn.totalWickets >= tournament.playersPerTeam - 1;
    const oversDone = inn.totalBalls >= maxBalls;
    
    if (state.inningsIdx === 1) {
      const target = state.match.innings[0].totalRuns + 1;
      if (inn.totalRuns >= target || allOut || oversDone) {
        // Match Over
        endMatch();
        return true;
      }
    } else {
      if (allOut || oversDone) {
        // End of 1st innings
        state.view = 'innings-break';
        saveState();
        refreshContent();
        return true;
      }
    }
    return false;
  }

  function endMatch() {
    const i1 = state.match.innings[0];
    const i2 = state.match.innings[1];
    let res = { winnerId: null, isTie: false, text: '' };
    
    if (i2.totalRuns > i1.totalRuns) {
      res.winnerId = i2.battingTeamId;
      const wRem = (window.CrickDeskData.getTournament().playersPerTeam - 1) - i2.totalWickets;
      res.text = `${window.CrickDeskData.getTeam(i2.battingTeamId).name} won by ${wRem} wickets`;
    } else if (i1.totalRuns > i2.totalRuns) {
      res.winnerId = i1.battingTeamId;
      res.text = `${window.CrickDeskData.getTeam(i1.battingTeamId).name} won by ${i1.totalRuns - i2.totalRuns} runs`;
    } else {
      res.isTie = true;
      res.text = "Match Tied";
    }
    
    state.match.result = res;
    state.match.status = 'completed';
    window.CrickDeskData.saveMatch(state.match);
    
    // Find Man of Match (simple auto logic based on MVP points)
    // For now, let user select in Match Detail page, or just leave null
    
    clearState();
    window.location.hash = '#fixtures';
    window.CrickDeskApp.navigate('fixtures');
    window.CrickDeskUtils.showToast("Match Completed!", "success");
  }

  function promptNewBatsman(rotated) {
    const inn = state.match.innings[state.inningsIdx];
    const teamId = inn.battingTeamId;
    const allPlayers = window.CrickDeskData.getPlayersByTeam(teamId);
    const battedIds = inn.battingScorecard.map(b => b.playerId);
    const available = allPlayers.filter(p => !battedIds.includes(p.id));
    
    let html = `
      <div class="modal">
        <div class="modal-header"><h3>Select Next Batsman</h3></div>
        <div class="modal-body">
          <select class="form-select" id="new-batsman-select">
            ${available.map(p => `<option value="${p.id}">${p.name} (${p.role})</option>`).join('')}
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="btn-confirm-batsman">Confirm</button>
        </div>
      </div>
    `;
    window.CrickDeskUtils.showModal(html);
    setTimeout(() => {
      document.getElementById('btn-confirm-batsman').onclick = () => {
        const id = document.getElementById('new-batsman-select').value;
        if(rotated) {
          state.nonStrikerId = state.strikerId;
          state.strikerId = id;
        } else {
          state.strikerId = id;
        }
        initBattingCard(id);
        window.CrickDeskUtils.closeModal();
        saveMatchState();
        
        // check if over ended on wicket
        const tournament = window.CrickDeskData.getTournament();
        const bpo = tournament.ballsPerOver || 6;
        if(inn.totalBalls > 0 && inn.totalBalls % bpo === 0) {
          promptNewBowler();
        } else {
          refreshContent();
        }
      };
    }, 10);
  }

  function promptNewBowler() {
    const inn = state.match.innings[state.inningsIdx];
    const teamId = inn.bowlingTeamId;
    const allPlayers = window.CrickDeskData.getPlayersByTeam(teamId);
    
    let html = `
      <div class="modal">
        <div class="modal-header"><h3>Select New Bowler</h3></div>
        <div class="modal-body">
          <select class="form-select" id="new-bowler-select">
            ${allPlayers.filter(p => p.id !== state.bowlerId).map(p => `<option value="${p.id}">${p.name} (${p.role})</option>`).join('')}
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="btn-confirm-bowler">Confirm</button>
        </div>
      </div>
    `;
    window.CrickDeskUtils.showModal(html);
    setTimeout(() => {
      document.getElementById('btn-confirm-bowler').onclick = () => {
        state.bowlerId = document.getElementById('new-bowler-select').value;
        initBowlingCard(state.bowlerId);
        window.CrickDeskUtils.closeModal();
        saveMatchState();
        refreshContent();
      };
    }, 10);
  }

  function showWicketModal() {
    const inn = state.match.innings[state.inningsIdx];
    const teamId = inn.bowlingTeamId;
    const fielders = window.CrickDeskData.getPlayersByTeam(teamId);
    
    let html = `
      <div class="modal">
        <div class="modal-header"><h3>Wicket Details</h3><button class="modal-close" onclick="window.CrickDeskUtils.closeModal()">×</button></div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Dismissal Type</label>
            <select class="form-select" id="wicket-type" onchange="document.getElementById('fielder-group').style.display = ['Caught','Run Out','Stumped'].includes(this.value) ? 'block' : 'none'">
              <option value="Bowled">Bowled</option>
              <option value="Caught">Caught</option>
              <option value="LBW">LBW</option>
              <option value="Run Out">Run Out</option>
              <option value="Stumped">Stumped</option>
              <option value="Hit Wicket">Hit Wicket</option>
              <option value="Retired Hurt">Retired Hurt</option>
            </select>
          </div>
          <div class="form-group" id="fielder-group" style="display:none;">
            <label class="form-label">Fielder</label>
            <select class="form-select" id="wicket-fielder">
              <option value="">-- Unknown / Substitute --</option>
              ${fielders.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="btn-confirm-wicket">Confirm Wicket</button>
        </div>
      </div>
    `;
    window.CrickDeskUtils.showModal(html);
    setTimeout(() => {
      document.getElementById('btn-confirm-wicket').onclick = () => {
        const type = document.getElementById('wicket-type').value;
        const fielderId = document.getElementById('wicket-fielder').value || null;
        recordBall(0, false, false, false, false, {type, fielderId});
        window.CrickDeskUtils.closeModal();
      };
    }, 10);
  }

  function saveMatchState() {
    window.CrickDeskData.saveMatch(state.match);
    saveState();
  }

  function attachEvents() {
    const container = document.getElementById('page-scoring');
    
    container.addEventListener('click', (e) => {
      if (e.target.closest('.btn-start')) {
        startMatch(e.target.closest('.btn-start').dataset.id);
      }
      if (e.target.closest('.btn-resume')) {
        startMatch(e.target.closest('.btn-resume').dataset.id);
        // It will load existing innings if they exist. Needs small fix in real logic to find current batsmen/bowlers.
      }
      
      if (e.target.id === 'btn-flip') {
        const coin = document.getElementById('coin');
        coin.style.animation = 'coinFlip 1.5s ease-out forwards';
        setTimeout(() => {
          document.getElementById('toss-result').style.display = 'block';
        }, 1500);
      }
      
      if (e.target.closest('.toss-winner')) {
        document.querySelectorAll('.toss-winner').forEach(b => b.classList.remove('btn-primary'));
        document.querySelectorAll('.toss-winner').forEach(b => b.classList.add('btn-secondary'));
        e.target.closest('.toss-winner').classList.remove('btn-secondary');
        e.target.closest('.toss-winner').classList.add('btn-primary');
        document.getElementById('toss-decision-area').style.display = 'block';
      }
      
      if (e.target.closest('.toss-decision')) {
        document.querySelectorAll('.toss-decision').forEach(b => b.classList.remove('btn-primary'));
        document.querySelectorAll('.toss-decision').forEach(b => b.classList.add('btn-secondary'));
        e.target.closest('.toss-decision').classList.remove('btn-secondary');
        e.target.closest('.toss-decision').classList.add('btn-primary');
        document.getElementById('btn-confirm-toss').style.display = 'block';
      }
      
      if (e.target.id === 'btn-confirm-toss') {
        const winner = document.querySelector('.toss-winner.btn-primary').dataset.id;
        const decision = document.querySelector('.toss-decision.btn-primary').dataset.dec;
        setToss(winner, decision);
      }
      
      if (e.target.id === 'btn-start-scoring') {
        state.strikerId = document.getElementById('select-striker').value;
        state.nonStrikerId = document.getElementById('select-nonstriker').value;
        state.bowlerId = document.getElementById('select-bowler').value;
        
        if(!state.strikerId || !state.nonStrikerId || !state.bowlerId || state.strikerId===state.nonStrikerId) {
          window.CrickDeskUtils.showToast("Select all players correctly", "error");
          return;
        }
        
        initBattingCard(state.strikerId);
        initBattingCard(state.nonStrikerId);
        initBowlingCard(state.bowlerId);
        
        state.view = 'scoring';
        saveMatchState();
        refreshContent();
      }

      if (e.target.closest('.score-btn')) {
        const runs = parseInt(e.target.closest('.score-btn').dataset.runs);
        recordBall(runs);
      }

      if (e.target.closest('.score-wicket')) {
        showWicketModal();
      }

      if (e.target.closest('.score-extra')) {
        const type = e.target.closest('.score-extra').dataset.type;
        window.CrickDeskUtils.showModal(`
          <div class="modal">
            <div class="modal-header"><h3>Extra: ${type}</h3><button class="modal-close" onclick="window.CrickDeskUtils.closeModal()">×</button></div>
            <div class="modal-body">
              <p>Additional runs scored off the bat/running?</p>
              <div style="display:flex; gap:12px;">
                <button class="btn btn-secondary flex-1" onclick="window.confirmExtra('${type}', 0)">0</button>
                <button class="btn btn-secondary flex-1" onclick="window.confirmExtra('${type}', 1)">1</button>
                <button class="btn btn-secondary flex-1" onclick="window.confirmExtra('${type}', 2)">2</button>
                <button class="btn btn-secondary flex-1" onclick="window.confirmExtra('${type}', 3)">3</button>
                <button class="btn btn-secondary flex-1" onclick="window.confirmExtra('${type}', 4)">4</button>
              </div>
            </div>
          </div>
        `);
      }

      if (e.target.closest('.score-undo')) {
        window.CrickDeskUtils.showToast("Undo not implemented in demo", "info");
      }
    });

    window.confirmExtra = (type, runs) => {
      window.CrickDeskUtils.closeModal();
      if(type==='wide') recordBall(runs, true, false);
      else if(type==='noball') recordBall(runs, false, true);
      else if(type==='bye') recordBall(runs, false, false, true);
      else if(type==='legbye') recordBall(runs, false, false, false, true);
    };
  }

  function refreshContent() {
    const container = document.getElementById('page-scoring');
    if (!container) return;
    if (state.view === 'match-list') container.innerHTML = renderMatchList();
    else if (state.view === 'toss') container.innerHTML = renderToss();
    else if (state.view === 'lineups') container.innerHTML = renderLineups();
    else if (state.view === 'scoring') container.innerHTML = renderScoring();
    else if (state.view === 'innings-break') {
      container.innerHTML = `
        <div class="page-header"><h1 class="section-title">Innings Break</h1></div>
        <div class="empty-state">
          <h3>1st Innings Completed</h3>
          <p class="text-muted">Target: <strong>${state.match.innings[0].totalRuns + 1}</strong></p>
          <button class="btn btn-primary" id="btn-next-innings">Start 2nd Innings</button>
        </div>
      `;
      setTimeout(() => {
        document.getElementById('btn-next-innings').onclick = () => {
          state.inningsIdx = 1;
          state.view = 'lineups';
          state.strikerId = null; state.nonStrikerId = null; state.bowlerId = null;
          saveState();
          refreshContent();
        };
      }, 10);
    }
  }

  return {
    init() {
      loadState();
      refreshContent();
      const container = document.getElementById('page-scoring');
      if (container && !container.dataset.eventsAttached) {
        attachEvents();
        container.dataset.eventsAttached = 'true';
      }
    }
  };
})();
