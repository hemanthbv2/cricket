window.HallOfFame = (function() {

  function getPlayerStatAggregates() {
    const matches = window.CrickDeskData.getMatches().filter(m => m.status === 'completed');
    const players = window.CrickDeskData.getPlayers();
    
    let stats = {};
    players.forEach(p => {
      stats[p.id] = { 
        id: p.id, name: p.name, teamId: p.teamId,
        runs: 0, ballsFaced: 0, sixes: 0, fours: 0, inningsBatted: 0, 
        wickets: 0, runsConceded: 0, ballsBowled: 0, dotsBowled: 0, inningsBowled: 0,
        catches: 0, runOuts: 0, mom: 0, fifties: [], bbi: {w:0, r:Infinity, match:null}
      };
    });

    matches.forEach(m => {
      if(m.manOfMatch && stats[m.manOfMatch]) stats[m.manOfMatch].mom++;
      
      m.innings.forEach(inn => {
        inn.battingScorecard.forEach(b => {
          if(!stats[b.playerId]) return;
          stats[b.playerId].runs += b.runs;
          stats[b.playerId].ballsFaced += b.balls;
          stats[b.playerId].sixes += b.sixes;
          stats[b.playerId].fours += b.fours;
          stats[b.playerId].inningsBatted++;
          if(b.runs >= 50) stats[b.playerId].fifties.push({score: b.runs, balls: b.balls, date: m.date, oppId: m.team1Id === stats[b.playerId].teamId ? m.team2Id : m.team1Id});
        });
        
        inn.bowlingScorecard.forEach(b => {
          if(!stats[b.playerId]) return;
          stats[b.playerId].wickets += b.wickets;
          stats[b.playerId].runsConceded += b.runs;
          stats[b.playerId].ballsBowled += b.balls;
          stats[b.playerId].dotsBowled += (b.dotBalls || 0);
          stats[b.playerId].inningsBowled++;
          
          if(b.wickets > stats[b.playerId].bbi.w || (b.wickets === stats[b.playerId].bbi.w && b.runs < stats[b.playerId].bbi.r)) {
            stats[b.playerId].bbi = {w: b.wickets, r: b.runs, match: m.date};
          }
        });

        // Fielding
        inn.balls.forEach(b => {
          if(b.wicket && b.wicket.fielderId && stats[b.wicket.fielderId]) {
            if(b.wicket.type === 'Caught') stats[b.wicket.fielderId].catches++;
            else if(b.wicket.type === 'Run Out') stats[b.wicket.fielderId].runOuts++;
          }
        });
      });
    });

    return Object.values(stats);
  }

  function getTop(arr, filterFn, sortFn) {
    const filtered = filterFn ? arr.filter(filterFn) : arr;
    if(filtered.length === 0) return null;
    return filtered.sort(sortFn)[0];
  }

  function renderAwardCard(title, icon, color, p, statLabel, statValue) {
    if(!p) {
      return `
        <div class="card glass" style="border-top: 4px solid ${color};">
          <div class="card-body" style="text-align:center;">
            <div style="font-size:32px; margin-bottom:8px;">${icon}</div>
            <h4 style="margin:0 0 16px 0; color:var(--text-secondary);">${title}</h4>
            <div class="text-muted">Not awarded yet</div>
          </div>
        </div>
      `;
    }
    const team = window.CrickDeskData.getTeam(p.teamId);
    return `
      <div class="card glass hover-glow" style="border-top: 4px solid ${color}; position:relative; overflow:hidden;">
        <div style="position:absolute; top:-20px; right:-20px; font-size:100px; opacity:0.05;">${icon}</div>
        <div class="card-body" style="text-align:center;">
          <h4 style="margin:0 0 16px 0; color:var(--text-secondary); text-transform:uppercase; font-size:12px; letter-spacing:1px;">${title}</h4>
          <div class="avatar avatar-lg" style="margin:0 auto 12px; background:${team?team.color:'#888'};">
            ${window.CrickDeskUtils.getPlayerInitials(p.name)}
          </div>
          <h3 style="margin:0 0 4px 0;">${p.name}</h3>
          <span class="badge" style="background:${team?team.color+'22':'#333'}; color:${team?team.color:'#fff'}; margin-bottom:16px;">${team?team.shortName:'Unknown'}</span>
          <div class="stat-value" style="color:${color}; margin-bottom:4px; font-size:32px;">${statValue}</div>
          <div class="stat-label">${statLabel}</div>
        </div>
      </div>
    `;
  }

  function render() {
    const stats = getPlayerStatAggregates();
    const hof = window.CrickDeskData.getHallOfFame() || { manOfTournament: null };
    
    // Calculate top performers
    const topRuns = getTop(stats, p => p.runs > 0, (a,b) => b.runs - a.runs);
    const topWkts = getTop(stats, p => p.wickets > 0, (a,b) => b.wickets - a.wickets);
    const topSR = getTop(stats, p => p.ballsFaced >= 20, (a,b) => (b.runs/b.ballsFaced) - (a.runs/a.ballsFaced));
    const topEcon = getTop(stats, p => p.ballsBowled >= 30, (a,b) => (a.runsConceded/a.ballsBowled) - (b.runsConceded/b.ballsBowled));
    const topMom = getTop(stats, p => p.mom > 0, (a,b) => b.mom - a.mom);
    const topField = getTop(stats, p => (p.catches+p.runOuts) > 0, (a,b) => (b.catches+b.runOuts) - (a.catches+a.runOuts));
    const topSixes = getTop(stats, p => p.sixes > 0, (a,b) => b.sixes - a.sixes);
    const topDots = getTop(stats, p => p.dotsBowled > 0, (a,b) => b.dotsBowled - a.dotsBowled);

    // MVP Calculation based on tournament weights
    const t = window.CrickDeskData.getTournament();
    const w = t.mvpWeights || { runs: 1, wickets: 25, catches: 10, runOuts: 10, momAward: 25 };
    stats.forEach(p => {
      p.mvp = (p.runs*w.runs) + (p.wickets*w.wickets) + (p.catches*w.catches) + (p.runOuts*w.runOuts) + (p.mom*w.momAward);
    });
    const topMVP = getTop(stats, p => p.mvp > 0, (a,b) => b.mvp - a.mvp);
    
    const motId = hof.manOfTournament;
    const motPlayer = motId ? stats.find(p=>p.id===motId) : topMVP;
    const isFrontrunner = !motId && motPlayer;

    let html = `
      <div class="page-header" style="justify-content:center; text-align:center;">
        <h1 class="section-title" style="font-size:36px; background: linear-gradient(90deg, #f59e0b, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">🏅 Hall of Fame</h1>
      </div>
    `;

    // MVP Card
    html += `
      <div class="card glass hover-glow" style="margin-bottom:32px; border:1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 40px rgba(245, 158, 11, 0.1);">
        <div class="card-body" style="display:flex; align-items:center; gap:32px; padding:40px;">
          <div style="font-size:80px; filter:drop-shadow(0 0 20px rgba(245,158,11,0.5));">🏆</div>
          <div style="flex:1;">
            <h2 style="color:var(--accent-amber); margin:0 0 8px 0; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:2px;">
              ${motId ? 'Man of the Tournament' : 'MVP Frontrunner'}
            </h2>
            ${motPlayer ? `
              <h1 style="font-size:40px; margin:0 0 8px 0;">${motPlayer.name}</h1>
              <div style="display:flex; gap:24px; color:var(--text-secondary);">
                <div><strong>${motPlayer.runs}</strong> Runs</div>
                <div><strong>${motPlayer.wickets}</strong> Wickets</div>
                <div><strong>${motPlayer.catches}</strong> Catches</div>
                <div><strong>${Math.round(motPlayer.mvp)}</strong> Pts</div>
              </div>
            ` : `<h3 class="text-muted">To be announced</h3>`}
          </div>
          <div>
            <button class="btn btn-secondary" id="btn-set-mot">👑 Set Champion</button>
          </div>
        </div>
      </div>
    `;

    // Awards Grid
    html += `
      <h3 class="section-title" style="margin-bottom:24px;">Tournament Awards</h3>
      <div class="bento-grid grid-4" style="margin-bottom:40px;">
        ${renderAwardCard('Highest Run Scorer', '🏏', 'var(--accent-green)', topRuns, 'RUNS', topRuns?.runs)}
        ${renderAwardCard('Highest Wicket Taker', '🎯', 'var(--accent-red)', topWkts, 'WICKETS', topWkts?.wickets)}
        ${renderAwardCard('Best Strike Rate', '⚡', 'var(--accent-amber)', topSR, 'STRIKE RATE', topSR?window.CrickDeskUtils.calculateStrikeRate(topSR.runs, topSR.ballsFaced):'')}
        ${renderAwardCard('Best Economy', '💎', 'var(--accent-blue)', topEcon, 'ECONOMY', topEcon?window.CrickDeskUtils.calculateEconomy(topEcon.runsConceded, topEcon.ballsBowled):'')}
        ${renderAwardCard('Most MoM Awards', '🏅', 'var(--accent-purple)', topMom, 'AWARDS', topMom?.mom)}
        ${renderAwardCard('Best Fielder', '🧤', 'var(--accent-cyan)', topField, 'DISMISSALS', topField?(topField.catches+topField.runOuts):'')}
        ${renderAwardCard('Most Sixes', '💥', 'var(--accent-orange)', topSixes, 'SIXES', topSixes?.sixes)}
        ${renderAwardCard('Most Dot Balls', '🛑', '#14b8a6', topDots, 'DOTS BOWLED', topDots?.dotsBowled)}
      </div>
    `;

    // 50+ Club
    let fifties = [];
    stats.forEach(p => {
      p.fifties.forEach(f => {
        fifties.push({ name: p.name, teamId: p.teamId, score: f.score, balls: f.balls, date: f.date, oppId: f.oppId });
      });
    });
    fifties.sort((a,b) => b.score - a.score);

    if(fifties.length > 0) {
      html += `
        <h3 class="section-title" style="margin-bottom:24px;">💯 50+ Club</h3>
        <div class="bento-grid grid-3" style="margin-bottom:40px;">
          ${fifties.map(f => {
            const team = window.CrickDeskData.getTeam(f.teamId);
            const opp = window.CrickDeskData.getTeam(f.oppId);
            return `
              <div class="card glass">
                <div class="card-body" style="display:flex; align-items:center; gap:16px;">
                  <div style="font-size:32px; font-weight:800; color:var(--accent-green);">${f.score}</div>
                  <div>
                    <h4 style="margin:0 0 4px 0;">${f.name} <span style="font-size:12px; font-weight:normal;" class="text-muted">(${f.balls} b)</span></h4>
                    <div style="font-size:12px; color:var(--text-muted);">${team?.shortName||''} vs ${opp?.shortName||''}</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return html;
  }

  function renderSetMotModal() {
    const players = window.CrickDeskData.getPlayers();
    return `
      <div class="modal">
        <div class="modal-header"><h3>Set Man of the Tournament</h3></div>
        <div class="modal-body">
          <select class="form-select" id="mot-select">
            <option value="">-- None --</option>
            ${players.map(p => `<option value="${p.id}">${p.name} (${window.CrickDeskData.getTeam(p.teamId)?.name||''})</option>`).join('')}
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.CrickDeskUtils.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-save-mot">Save</button>
        </div>
      </div>
    `;
  }

  function attachEvents() {
    const container = document.getElementById('page-halloffame');
    container.addEventListener('click', (e) => {
      if(e.target.id === 'btn-set-mot') {
        window.CrickDeskUtils.showModal(renderSetMotModal());
        setTimeout(() => {
          document.getElementById('btn-save-mot').onclick = () => {
            const val = document.getElementById('mot-select').value;
            let hof = window.CrickDeskData.getHallOfFame() || { manOfTournament: null };
            hof.manOfTournament = val || null;
            window.CrickDeskData.saveHallOfFame(hof);
            window.CrickDeskUtils.closeModal();
            refreshContent();
            window.CrickDeskUtils.showToast("Champion updated", "success");
          };
        }, 10);
      }
    });
  }

  function refreshContent() {
    const container = document.getElementById('page-halloffame');
    if (container) container.innerHTML = render();
  }

  return {
    init() {
      const container = document.getElementById('page-halloffame');
      if (!container) return;
      container.innerHTML = render();
      if (!container.dataset.eventsAttached) {
        attachEvents();
        container.dataset.eventsAttached = 'true';
      }
    }
  };
})();
