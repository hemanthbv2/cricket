window.Players = (function() {
  let state = {
    view: 'grid', // 'grid' | 'detail'
    selectedPlayerId: null,
    searchQuery: '',
    teamFilter: 'all',
    roleFilter: 'all',
    activeTab: 'overview',
    vsTeamId: ''
  };

  function getPlayerStats(playerId) {
    const matches = window.CrickDeskData.getMatches().filter(m => m.status === 'completed');
    const pastScores = window.CrickDeskData.getPastScores(playerId);
    
    let stats = {
      matches: pastScores.length,
      batting: { inn: 0, runs: 0, balls: 0, fours: 0, sixes: 0, no: 0, dots: 0, hs: 0, fifties: 0, hundreds: 0, scores: [] },
      bowling: { inn: 0, balls: 0, runs: 0, wkts: 0, maidens: 0, dots: 0, wides: 0, noBalls: 0, bestWkts: 0, bestRuns: Infinity, bbi: '-', threeWkts: 0, fiveWkts: 0, spells: [] },
      fielding: { catches: 0, runOuts: 0, stumpings: 0 },
      awards: { mom: 0 },
      matchLog: []
    };

    // Add past scores manually entered
    pastScores.forEach(ps => {
      if(ps.runs > 0 || ps.balls > 0) {
        stats.batting.inn++;
        stats.batting.runs += ps.runs;
        stats.batting.balls += ps.balls;
        stats.batting.fours += ps.fours;
        stats.batting.sixes += ps.sixes;
        if(ps.runs > stats.batting.hs) stats.batting.hs = ps.runs;
        if(ps.runs >= 100) stats.batting.hundreds++;
        else if(ps.runs >= 50) stats.batting.fifties++;
        stats.batting.scores.push(ps.runs);
      }
      if(ps.oversBowled > 0) {
        stats.bowling.inn++;
        stats.bowling.balls += (ps.oversBowled * 6);
        stats.bowling.runs += ps.runsConceded;
        stats.bowling.wkts += ps.wickets;
        if(ps.wickets > stats.bowling.bestWkts || (ps.wickets === stats.bowling.bestWkts && ps.runsConceded < stats.bowling.bestRuns)) {
          stats.bowling.bestWkts = ps.wickets;
          stats.bowling.bestRuns = ps.runsConceded;
          stats.bowling.bbi = `${ps.wickets}/${ps.runsConceded}`;
        }
        if(ps.wickets >= 5) stats.bowling.fiveWkts++;
        else if(ps.wickets >= 3) stats.bowling.threeWkts++;
      }
      stats.fielding.catches += ps.catches;
    });

    matches.forEach(m => {
      let played = false;
      let logEntry = { date: m.date, opponent: '', bat: '-', bowl: '-', result: '' };
      
      const pTeam = window.CrickDeskData.getPlayer(playerId).teamId;
      if (m.team1Id !== pTeam && m.team2Id !== pTeam) return;
      
      const oppTeamId = m.team1Id === pTeam ? m.team2Id : m.team1Id;
      const oppTeam = window.CrickDeskData.getTeam(oppTeamId);
      logEntry.opponent = oppTeam ? oppTeam.shortName : 'Unknown';
      
      if(m.result) {
        logEntry.result = m.result.winnerId === pTeam ? 'Won' : (m.result.isTie ? 'Tie' : 'Lost');
      }

      if(m.manOfMatch === playerId) stats.awards.mom++;

      m.innings.forEach(inn => {
        // Batting
        if(inn.battingTeamId === pTeam) {
          const batCard = inn.battingScorecard.find(b => b.playerId === playerId);
          if(batCard) {
            played = true;
            stats.batting.inn++;
            stats.batting.runs += batCard.runs;
            stats.batting.balls += batCard.balls;
            stats.batting.fours += batCard.fours;
            stats.batting.sixes += batCard.sixes;
            stats.batting.dots += batCard.dotBalls || 0;
            if(batCard.howOut === 'not out' || batCard.howOut === 'retired hurt') {
              stats.batting.no++;
              logEntry.bat = `${batCard.runs}* (${batCard.balls})`;
            } else {
              logEntry.bat = `${batCard.runs} (${batCard.balls})`;
            }
            if(batCard.runs > stats.batting.hs) stats.batting.hs = batCard.runs;
            if(batCard.runs >= 100) stats.batting.hundreds++;
            else if(batCard.runs >= 50) stats.batting.fifties++;
            stats.batting.scores.push(batCard.runs);
          }
        }
        
        // Bowling
        if(inn.bowlingTeamId === pTeam) {
          const bowlCard = inn.bowlingScorecard.find(b => b.playerId === playerId);
          if(bowlCard) {
            played = true;
            stats.bowling.inn++;
            stats.bowling.balls += bowlCard.balls;
            stats.bowling.runs += bowlCard.runs;
            stats.bowling.wkts += bowlCard.wickets;
            stats.bowling.maidens += bowlCard.maidens || 0;
            stats.bowling.dots += bowlCard.dotBalls || 0;
            stats.bowling.wides += bowlCard.wides || 0;
            stats.bowling.noBalls += bowlCard.noBalls || 0;
            logEntry.bowl = `${bowlCard.wickets}/${bowlCard.runs} (${window.CrickDeskUtils.formatOvers(bowlCard.balls)})`;
            
            if(bowlCard.wickets > stats.bowling.bestWkts || (bowlCard.wickets === stats.bowling.bestWkts && bowlCard.runs < stats.bowling.bestRuns)) {
              stats.bowling.bestWkts = bowlCard.wickets;
              stats.bowling.bestRuns = bowlCard.runs;
              stats.bowling.bbi = `${bowlCard.wickets}/${bowlCard.runs}`;
            }
            if(bowlCard.wickets >= 5) stats.bowling.fiveWkts++;
            else if(bowlCard.wickets >= 3) stats.bowling.threeWkts++;
            stats.bowling.spells.push(bowlCard.wickets);
          }
        }

        // Fielding
        if(inn.bowlingTeamId === pTeam) {
          inn.balls.forEach(b => {
            if(b.wicket && b.wicket.fielderId === playerId) {
              if(b.wicket.type === 'Caught') stats.fielding.catches++;
              else if(b.wicket.type === 'Run Out') stats.fielding.runOuts++;
              else if(b.wicket.type === 'Stumped') stats.fielding.stumpings++;
            }
          });
        }
      });
      
      if(played) {
        stats.matches++;
        stats.matchLog.push(logEntry);
      }
    });

    stats.batting.avg = window.CrickDeskUtils.calculateAverage(stats.batting.runs, stats.batting.inn - stats.batting.no);
    stats.batting.sr = window.CrickDeskUtils.calculateStrikeRate(stats.batting.runs, stats.batting.balls);
    stats.bowling.econ = window.CrickDeskUtils.calculateEconomy(stats.bowling.runs, stats.bowling.balls);
    stats.bowling.avg = window.CrickDeskUtils.calculateAverage(stats.bowling.runs, stats.bowling.wkts);

    return stats;
  }

  function renderGrid() {
    let players = window.CrickDeskData.getPlayers() || [];
    const teams = window.CrickDeskData.getTeams() || [];

    if(state.searchQuery) {
      players = players.filter(p => p.name.toLowerCase().includes(state.searchQuery.toLowerCase()));
    }
    if(state.teamFilter !== 'all') {
      players = players.filter(p => p.teamId === state.teamFilter);
    }
    if(state.roleFilter !== 'all') {
      players = players.filter(p => p.role.toLowerCase().replace('-', '') === state.roleFilter.toLowerCase().replace('-', ''));
    }

    let html = `
      <div class="page-header" style="flex-wrap: wrap; gap: 16px;">
        <h1 class="section-title" style="margin:0;">Players</h1>
        <div style="display: flex; gap: 12px; flex: 1; justify-content: flex-end;">
          <div class="search-input-wrapper" style="max-width: 300px;">
            <span style="position:absolute; left:14px; top:12px;">🔍</span>
            <input type="text" class="search-input" id="player-search" placeholder="Search players..." value="${state.searchQuery}">
          </div>
          <button class="btn btn-primary" id="btn-add-player">➕ Add Player</button>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">Teams</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
          <span class="chip ${state.teamFilter === 'all' ? 'active' : ''}" data-type="team" data-val="all">All Teams</span>
          ${teams.map(t => `<span class="chip ${state.teamFilter === t.id ? 'active' : ''}" data-type="team" data-val="${t.id}" style="${state.teamFilter === t.id ? `background:${t.color}22; border-color:${t.color}; color:${t.color};` : ''}">${t.shortName}</span>`).join('')}
        </div>
        
        <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">Roles</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span class="chip ${state.roleFilter === 'all' ? 'active' : ''}" data-type="role" data-val="all">All Roles</span>
          <span class="chip ${state.roleFilter === 'batsman' ? 'active' : ''}" data-type="role" data-val="batsman">Batsmen</span>
          <span class="chip ${state.roleFilter === 'bowler' ? 'active' : ''}" data-type="role" data-val="bowler">Bowlers</span>
          <span class="chip ${state.roleFilter === 'allrounder' ? 'active' : ''}" data-type="role" data-val="allrounder">All-rounders</span>
          <span class="chip ${state.roleFilter === 'wicketkeeper' ? 'active' : ''}" data-type="role" data-val="wicketkeeper">Wicket Keepers</span>
        </div>
      </div>
    `;

    if (players.length === 0) {
      html += `<div class="empty-state"><h3>No players found</h3><p class="text-muted">Try adjusting your filters or adding a new player.</p></div>`;
      return html;
    }

    html += `<div class="bento-grid grid-4">`;
    players.forEach(p => {
      const team = teams.find(t => t.id === p.teamId);
      const color = team ? team.color : '#888';
      const stats = getPlayerStats(p.id);
      
      let mainStat = '';
      if(p.role === 'Batsman' || p.role === 'Wicket-Keeper') {
        mainStat = `<div style="text-align:center;"><div style="font-size:18px; font-weight:700;">${stats.batting.runs}</div><div style="font-size:10px; color:var(--text-muted);">RUNS</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:700;">${stats.batting.avg}</div><div style="font-size:10px; color:var(--text-muted);">AVG</div></div>`;
      } else {
        mainStat = `<div style="text-align:center;"><div style="font-size:18px; font-weight:700; color:var(--accent-red);">${stats.bowling.wkts}</div><div style="font-size:10px; color:var(--text-muted);">WKTS</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:700;">${stats.bowling.econ}</div><div style="font-size:10px; color:var(--text-muted);">ECON</div></div>`;
      }

      html += `
        <div class="card glass hover-lift player-card" data-id="${p.id}" style="cursor: pointer;">
          <div class="card-body" style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
            <div class="avatar avatar-lg" style="background: ${color}; margin-bottom: 12px; font-size: 20px;">
              ${window.CrickDeskUtils.getPlayerInitials(p.name)}
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 16px;">${p.name}</h4>
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
              ${team ? `<span class="badge" style="background:${color}22; color:${color};">${team.shortName}</span>` : ''}
              ${window.CrickDeskUtils.getRoleBadge(p.role)}
            </div>
            <div style="display: flex; gap: 24px; width: 100%; justify-content: center; border-top: 1px solid var(--border-color); padding-top: 16px;">
              ${mainStat}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  function renderProfile() {
    const player = window.CrickDeskData.getPlayer(state.selectedPlayerId);
    if(!player) { state.view = 'grid'; return renderGrid(); }
    
    const team = window.CrickDeskData.getTeam(player.teamId);
    const color = team ? team.color : '#888';
    const stats = getPlayerStats(player.id);
    
    let html = `
      <div class="page-header" style="justify-content: flex-start; gap: 16px; margin-bottom: 24px;">
        <button class="btn btn-ghost btn-icon" id="btn-back-players" style="font-size: 20px;">←</button>
      </div>

      <div class="card glass" style="margin-bottom: 24px; overflow: visible;">
        <div style="height: 100px; background: linear-gradient(to right, ${color}44, transparent); border-radius: var(--radius-lg) var(--radius-lg) 0 0;"></div>
        <div class="card-body" style="display: flex; gap: 24px; align-items: flex-end; padding-top: 0; margin-top: -50px;">
          <div class="avatar" style="width: 100px; height: 100px; font-size: 40px; background: ${color}; box-shadow: 0 8px 16px rgba(0,0,0,0.4); border: 4px solid var(--bg-card);">
            ${window.CrickDeskUtils.getPlayerInitials(player.name)}
          </div>
          <div style="flex: 1; padding-bottom: 8px;">
            <h1 style="margin: 0 0 8px 0; font-family: var(--font-heading); font-size: 28px;">${player.name}</h1>
            <div style="display: flex; gap: 12px; align-items: center;">
              ${team ? `<span class="badge" style="background:${color}22; color:${color}; font-size: 14px;">${team.name}</span>` : ''}
              ${window.CrickDeskUtils.getRoleBadge(player.role)}
              <span class="text-muted" style="font-size: 13px;">Bat: ${player.battingStyle} | Bowl: ${player.bowlingStyle}</span>
            </div>
          </div>
          <div style="padding-bottom: 8px;">
            <button class="btn btn-secondary btn-sm" id="btn-edit-player">✏️ Edit</button>
            <button class="btn btn-secondary btn-sm" id="btn-add-past-score">📊 Add Past Score</button>
          </div>
        </div>
      </div>

      <div class="tab-group" style="margin-bottom: 24px;">
        <button class="tab ${state.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
        <button class="tab ${state.activeTab === 'batting' ? 'active' : ''}" data-tab="batting">Batting</button>
        <button class="tab ${state.activeTab === 'bowling' ? 'active' : ''}" data-tab="bowling">Bowling</button>
        <button class="tab ${state.activeTab === 'fielding' ? 'active' : ''}" data-tab="fielding">Fielding & Awards</button>
        <button class="tab ${state.activeTab === 'log' ? 'active' : ''}" data-tab="log">Match Log</button>
      </div>
      
      <div id="tab-content">
        ${renderTabContent(player, stats)}
      </div>
    `;

    return html;
  }

  function renderTabContent(player, stats) {
    if(state.activeTab === 'overview') {
      const recentScores = stats.batting.scores.slice(-5).reverse();
      const recentSpells = stats.bowling.spells.slice(-5).reverse();
      
      return `
        <div class="bento-grid grid-4" style="margin-bottom: 24px;">
          <div class="stat-card card glass"><div class="stat-value">${stats.matches}</div><div class="stat-label">Matches</div></div>
          <div class="stat-card card glass"><div class="stat-value" style="color:var(--accent-green);">${stats.batting.runs}</div><div class="stat-label">Runs</div></div>
          <div class="stat-card card glass"><div class="stat-value" style="color:var(--accent-red);">${stats.bowling.wkts}</div><div class="stat-label">Wickets</div></div>
          <div class="stat-card card glass"><div class="stat-value" style="color:var(--accent-blue);">${stats.fielding.catches}</div><div class="stat-label">Catches</div></div>
        </div>
        <div class="bento-grid grid-2">
          <div class="card glass">
            <div class="card-header"><h3 class="section-title" style="margin:0; font-size:16px;">Recent Batting Form</h3></div>
            <div class="card-body" style="display:flex; gap:8px; height:120px; align-items:flex-end;">
              ${recentScores.length ? recentScores.map(s => {
                const h = Math.min(100, Math.max(10, (s/50)*100));
                return `<div style="flex:1; background:var(--accent-green); height:${h}%; border-radius:4px 4px 0 0; position:relative; min-width:30px;">
                  <span style="position:absolute; top:-20px; width:100%; text-align:center; font-size:12px; font-weight:bold;">${s}</span>
                </div>`;
              }).join('') : '<div class="text-muted">No recent batting data</div>'}
            </div>
          </div>
          <div class="card glass">
            <div class="card-header"><h3 class="section-title" style="margin:0; font-size:16px;">Recent Bowling Form (Wickets)</h3></div>
            <div class="card-body" style="display:flex; gap:8px; height:120px; align-items:flex-end;">
              ${recentSpells.length ? recentSpells.map(w => {
                const h = Math.max(10, (w/5)*100);
                return `<div style="flex:1; background:var(--accent-red); height:${h}%; border-radius:4px 4px 0 0; position:relative; min-width:30px;">
                  <span style="position:absolute; top:-20px; width:100%; text-align:center; font-size:12px; font-weight:bold;">${w}</span>
                </div>`;
              }).join('') : '<div class="text-muted">No recent bowling data</div>'}
            </div>
          </div>
        </div>
      `;
    } 
    else if (state.activeTab === 'batting') {
      return `
        <div class="bento-grid grid-4" style="margin-bottom: 24px;">
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.inn}</div><div class="stat-label">Innings</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.runs}</div><div class="stat-label">Runs</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.avg}</div><div class="stat-label">Average</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.sr}</div><div class="stat-label">Strike Rate</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.hs}</div><div class="stat-label">Highest Score</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.fifties}/${stats.batting.hundreds}</div><div class="stat-label">50s / 100s</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.fours}/${stats.batting.sixes}</div><div class="stat-label">4s / 6s</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.batting.no}</div><div class="stat-label">Not Outs</div></div>
        </div>
      `;
    }
    else if (state.activeTab === 'bowling') {
      return `
        <div class="bento-grid grid-4" style="margin-bottom: 24px;">
          <div class="stat-card card glass"><div class="stat-value">${stats.bowling.inn}</div><div class="stat-label">Innings</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.bowling.wkts}</div><div class="stat-label">Wickets</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.bowling.econ}</div><div class="stat-label">Economy</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.bowling.avg}</div><div class="stat-label">Average</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.bowling.bbi}</div><div class="stat-label">Best Bowling</div></div>
          <div class="stat-card card glass"><div class="stat-value">${window.CrickDeskUtils.formatOvers(stats.bowling.balls)}</div><div class="stat-label">Overs</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.bowling.threeWkts}/${stats.bowling.fiveWkts}</div><div class="stat-label">3W / 5W</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.bowling.maidens}</div><div class="stat-label">Maidens</div></div>
        </div>
      `;
    }
    else if (state.activeTab === 'fielding') {
      return `
        <div class="bento-grid grid-3" style="margin-bottom: 24px;">
          <div class="stat-card card glass"><div class="stat-value">${stats.fielding.catches}</div><div class="stat-label">Catches</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.fielding.runOuts}</div><div class="stat-label">Run Outs</div></div>
          <div class="stat-card card glass"><div class="stat-value">${stats.awards.mom}</div><div class="stat-label">Man of Match</div></div>
        </div>
      `;
    }
    else if (state.activeTab === 'log') {
      return `
        <div class="card glass">
          <div class="card-body" style="padding:0;">
            <div class="data-table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Batting</th>
                    <th>Bowling</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.matchLog.length ? stats.matchLog.reverse().map(l => `
                    <tr>
                      <td>${new Date(l.date).toLocaleDateString()}</td>
                      <td>${l.opponent}</td>
                      <td>${l.bat}</td>
                      <td>${l.bowl}</td>
                      <td><span class="badge ${l.result==='Won'?'badge-green':(l.result==='Lost'?'badge-red':'badge-amber')}">${l.result}</span></td>
                    </tr>
                  `).join('') : '<tr><td colspan="5" style="text-align:center;">No matches played</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }
  }

  function renderModal(playerId = null) {
    let p = { name: '', teamId: '', role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium' };
    if (playerId) p = window.CrickDeskData.getPlayer(playerId) || p;
    
    return `
      <div class="modal">
        <div class="modal-header">
          <h3 style="margin:0;">${playerId ? 'Edit' : 'Add'} Player</h3>
          <button class="modal-close" onclick="window.CrickDeskUtils.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <form id="player-form">
            <input type="hidden" id="p-id" value="${playerId || ''}">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input type="text" class="form-input" id="p-name" value="${p.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Team</label>
              <select class="form-select" id="p-team" required>
                <option value="">-- Select Team --</option>
                ${window.CrickDeskData.getTeams().map(t => `<option value="${t.id}" ${t.id === p.teamId ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-select" id="p-role">
                <option value="Batsman" ${p.role==='Batsman'?'selected':''}>Batsman</option>
                <option value="Bowler" ${p.role==='Bowler'?'selected':''}>Bowler</option>
                <option value="All-rounder" ${p.role==='All-rounder'?'selected':''}>All-rounder</option>
                <option value="Wicket-Keeper" ${p.role==='Wicket-Keeper'?'selected':''}>Wicket-Keeper</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Batting Style</label>
                <select class="form-select" id="p-bat">
                  <option value="Right-hand bat" ${p.battingStyle==='Right-hand bat'?'selected':''}>Right-hand bat</option>
                  <option value="Left-hand bat" ${p.battingStyle==='Left-hand bat'?'selected':''}>Left-hand bat</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Bowling Style</label>
                <select class="form-select" id="p-bowl">
                  <option value="None" ${p.bowlingStyle==='None'?'selected':''}>None</option>
                  <option value="Right-arm fast" ${p.bowlingStyle==='Right-arm fast'?'selected':''}>Right-arm fast</option>
                  <option value="Right-arm medium" ${p.bowlingStyle==='Right-arm medium'?'selected':''}>Right-arm medium</option>
                  <option value="Right-arm offbreak" ${p.bowlingStyle==='Right-arm offbreak'?'selected':''}>Right-arm offbreak</option>
                  <option value="Right-arm legbreak" ${p.bowlingStyle==='Right-arm legbreak'?'selected':''}>Right-arm legbreak</option>
                  <option value="Left-arm fast" ${p.bowlingStyle==='Left-arm fast'?'selected':''}>Left-arm fast</option>
                  <option value="Left-arm orthodox" ${p.bowlingStyle==='Left-arm orthodox'?'selected':''}>Left-arm orthodox</option>
                  <option value="Left-arm chinaman" ${p.bowlingStyle==='Left-arm chinaman'?'selected':''}>Left-arm chinaman</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.CrickDeskUtils.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-save-player">Save</button>
        </div>
      </div>
    `;
  }

  function renderPastScoreModal() {
    return `
      <div class="modal">
        <div class="modal-header">
          <h3 style="margin:0;">Add Past Score</h3>
          <button class="modal-close" onclick="window.CrickDeskUtils.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <form id="past-score-form">
            <div class="form-row">
              <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="ps-date" required></div>
              <div class="form-group"><label class="form-label">Opponent</label><input type="text" class="form-input" id="ps-opp" required></div>
            </div>
            <h4 class="section-subtitle">Batting</h4>
            <div class="form-row">
              <div class="form-group"><label class="form-label">Runs</label><input type="number" class="form-input" id="ps-runs" value="0" min="0"></div>
              <div class="form-group"><label class="form-label">Balls</label><input type="number" class="form-input" id="ps-balls" value="0" min="0"></div>
              <div class="form-group"><label class="form-label">4s</label><input type="number" class="form-input" id="ps-4s" value="0" min="0"></div>
              <div class="form-group"><label class="form-label">6s</label><input type="number" class="form-input" id="ps-6s" value="0" min="0"></div>
            </div>
            <h4 class="section-subtitle">Bowling & Fielding</h4>
            <div class="form-row">
              <div class="form-group"><label class="form-label">Overs</label><input type="number" step="0.1" class="form-input" id="ps-overs" value="0" min="0"></div>
              <div class="form-group"><label class="form-label">Wickets</label><input type="number" class="form-input" id="ps-wkts" value="0" min="0"></div>
              <div class="form-group"><label class="form-label">Runs Conc</label><input type="number" class="form-input" id="ps-rcon" value="0" min="0"></div>
              <div class="form-group"><label class="form-label">Catches</label><input type="number" class="form-input" id="ps-ctch" value="0" min="0"></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.CrickDeskUtils.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-save-past-score">Save Score</button>
        </div>
      </div>
    `;
  }

  function attachEvents() {
    const container = document.getElementById('page-players');
    
    container.addEventListener('click', (e) => {
      if (e.target.closest('#btn-add-player')) {
        window.CrickDeskUtils.showModal(renderModal());
        setTimeout(() => setupModalEvents(), 10);
      }
      if (e.target.closest('.player-card')) {
        state.selectedPlayerId = e.target.closest('.player-card').dataset.id;
        state.view = 'detail';
        state.activeTab = 'overview';
        refreshContent();
      }
      if (e.target.closest('#btn-back-players')) {
        state.view = 'grid';
        state.selectedPlayerId = null;
        refreshContent();
      }
      if (e.target.closest('.chip')) {
        const chip = e.target.closest('.chip');
        if (chip.dataset.type === 'team') state.teamFilter = chip.dataset.val;
        if (chip.dataset.type === 'role') state.roleFilter = chip.dataset.val;
        refreshContent();
      }
      if (e.target.closest('.tab')) {
        state.activeTab = e.target.closest('.tab').dataset.tab;
        refreshContent();
      }
      if (e.target.closest('#btn-edit-player')) {
        window.CrickDeskUtils.showModal(renderModal(state.selectedPlayerId));
        setTimeout(() => setupModalEvents(), 10);
      }
      if (e.target.closest('#btn-add-past-score')) {
        window.CrickDeskUtils.showModal(renderPastScoreModal());
        setTimeout(() => setupPastScoreModalEvents(), 10);
      }
    });

    container.addEventListener('input', (e) => {
      if (e.target.id === 'player-search') {
        state.searchQuery = e.target.value;
        window.CrickDeskUtils.debounce(() => refreshContent(), 300)();
      }
    });
  }

  function setupModalEvents() {
    const btn = document.getElementById('btn-save-player');
    if(!btn) return;
    btn.addEventListener('click', () => {
      const id = document.getElementById('p-id').value;
      const name = document.getElementById('p-name').value.trim();
      const teamId = document.getElementById('p-team').value;
      if(!name || !teamId) {
        window.CrickDeskUtils.showToast("Name and Team are required", "error");
        return;
      }
      const player = {
        id: id || window.CrickDeskUtils.generateId(),
        name,
        teamId,
        role: document.getElementById('p-role').value,
        battingStyle: document.getElementById('p-bat').value,
        bowlingStyle: document.getElementById('p-bowl').value
      };
      window.CrickDeskData.savePlayer(player);
      window.CrickDeskUtils.showToast("Player saved", "success");
      window.CrickDeskUtils.closeModal();
      refreshContent();
    });
  }

  function setupPastScoreModalEvents() {
    const btn = document.getElementById('btn-save-past-score');
    if(!btn) return;
    btn.addEventListener('click', () => {
      const date = document.getElementById('ps-date').value;
      const opp = document.getElementById('ps-opp').value.trim();
      if(!date || !opp) {
        window.CrickDeskUtils.showToast("Date and Opponent required", "error");
        return;
      }
      const score = {
        id: window.CrickDeskUtils.generateId(),
        playerId: state.selectedPlayerId,
        date,
        opponent: opp,
        runs: parseInt(document.getElementById('ps-runs').value) || 0,
        balls: parseInt(document.getElementById('ps-balls').value) || 0,
        fours: parseInt(document.getElementById('ps-4s').value) || 0,
        sixes: parseInt(document.getElementById('ps-6s').value) || 0,
        oversBowled: parseFloat(document.getElementById('ps-overs').value) || 0,
        wickets: parseInt(document.getElementById('ps-wkts').value) || 0,
        runsConceded: parseInt(document.getElementById('ps-rcon').value) || 0,
        catches: parseInt(document.getElementById('ps-ctch').value) || 0
      };
      window.CrickDeskData.savePastScore(score);
      window.CrickDeskUtils.showToast("Score added", "success");
      window.CrickDeskUtils.closeModal();
      refreshContent();
    });
  }

  function refreshContent() {
    const container = document.getElementById('page-players');
    if (container) {
      container.innerHTML = state.view === 'grid' ? renderGrid() : renderProfile();
    }
  }

  return {
    init() {
      const container = document.getElementById('page-players');
      if (!container) return;
      container.innerHTML = state.view === 'grid' ? renderGrid() : renderProfile();
      if (!container.dataset.eventsAttached) {
        attachEvents();
        container.dataset.eventsAttached = 'true';
      }
    }
  };
})();
