/* =========================================================
   CrickDesk — Dashboard Module  (window.Dashboard)
   Renders into #page-dashboard
   ========================================================= */
window.Dashboard = {

  /* ---- Lifecycle ---- */
  _countdownTimer: null,

  init() {
    const container = document.getElementById('page-dashboard');
    container.innerHTML = this.render();
    this.attachEvents();
    this.animateCounters();
    this.startCountdown();
    this.staggerReveal();
  },

  /* ---- Helpers ---- */
  _getTeamStats() {
    const data = CrickDeskData.load();
    const teams = data.teams || [];
    const matches = (data.matches || []).filter(m => m.status === 'completed');
    const bpo = (data.tournament && data.tournament.ballsPerOver) || 6;
    const stats = {};

    teams.forEach(t => {
      stats[t.id] = { id: t.id, name: t.name, shortName: t.shortName, color: t.color, played: 0, won: 0, lost: 0, tied: 0, nr: 0, points: 0, nrr: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0 };
    });

    const ps = (data.tournament && data.tournament.pointsSystem) || { win: 2, loss: 0, tie: 1, nr: 1 };

    matches.forEach(m => {
      const t1 = stats[m.team1Id];
      const t2 = stats[m.team2Id];
      if (!t1 || !t2) return;
      t1.played++; t2.played++;

      if (m.innings && m.innings.length >= 2) {
        const inn1 = m.innings[0];
        const inn2 = m.innings[1];

        /* runs for / against */
        if (inn1.battingTeamId === m.team1Id) {
          t1.runsFor += inn1.totalRuns || 0; t1.ballsFaced += inn1.totalBalls || 0;
          t1.runsAgainst += inn2.totalRuns || 0; t1.ballsBowled += inn2.totalBalls || 0;
          t2.runsFor += inn2.totalRuns || 0; t2.ballsFaced += inn2.totalBalls || 0;
          t2.runsAgainst += inn1.totalRuns || 0; t2.ballsBowled += inn1.totalBalls || 0;
        } else {
          t2.runsFor += inn1.totalRuns || 0; t2.ballsFaced += inn1.totalBalls || 0;
          t2.runsAgainst += inn2.totalRuns || 0; t2.ballsBowled += inn2.totalBalls || 0;
          t1.runsFor += inn2.totalRuns || 0; t1.ballsFaced += inn2.totalBalls || 0;
          t1.runsAgainst += inn1.totalRuns || 0; t1.ballsBowled += inn1.totalBalls || 0;
        }
      }

      if (m.status === 'no-result' || m.status === 'abandoned') {
        t1.nr++; t2.nr++;
        t1.points += ps.nr; t2.points += ps.nr;
      } else if (m.status === 'tied') {
        t1.tied++; t2.tied++;
        t1.points += ps.tie; t2.points += ps.tie;
      } else if (m.result) {
        const winnerId = m.result.winnerId || null;
        if (winnerId === m.team1Id) { t1.won++; t2.lost++; t1.points += ps.win; t2.points += ps.loss; }
        else if (winnerId === m.team2Id) { t2.won++; t1.lost++; t2.points += ps.win; t1.points += ps.loss; }
        else { t1.tied++; t2.tied++; t1.points += ps.tie; t2.points += ps.tie; }
      }
    });

    Object.values(stats).forEach(t => {
      const rrFor = t.ballsFaced > 0 ? (t.runsFor / (t.ballsFaced / bpo)) : 0;
      const rrAg = t.ballsBowled > 0 ? (t.runsAgainst / (t.ballsBowled / bpo)) : 0;
      t.nrr = rrFor - rrAg;
    });

    return stats;
  },

  _getPlayerMVP() {
    const data = CrickDeskData.load();
    const players = data.players || [];
    const matches = (data.matches || []).filter(m => m.status === 'completed');
    const weights = (data.tournament && data.tournament.mvpWeights) || { runs: 1, wickets: 25, catches: 10, runOuts: 10, momAward: 25 };

    const mvp = {};
    players.forEach(p => { mvp[p.id] = { id: p.id, name: p.name, teamId: p.teamId, runs: 0, wickets: 0, catches: 0, runOuts: 0, mom: 0 }; });

    matches.forEach(m => {
      if (m.innings) {
        m.innings.forEach(inn => {
          (inn.battingScorecard || []).forEach(b => {
            if (mvp[b.playerId]) mvp[b.playerId].runs += b.runs || 0;
          });
          (inn.bowlingScorecard || []).forEach(b => {
            if (mvp[b.playerId]) mvp[b.playerId].wickets += b.wickets || 0;
          });
          (inn.balls || []).forEach(ball => {
            if (ball.wicket) {
              if (ball.wicket.fielderId && mvp[ball.wicket.fielderId]) {
                if (ball.wicket.type === 'caught') mvp[ball.wicket.fielderId].catches++;
                if (ball.wicket.type === 'run-out' || ball.wicket.type === 'run out') mvp[ball.wicket.fielderId].runOuts++;
              }
            }
          });
        });
      }
      if (m.manOfMatch && mvp[m.manOfMatch]) mvp[m.manOfMatch].mom++;
    });

    Object.values(mvp).forEach(p => {
      p.points = (p.runs * weights.runs) + (p.wickets * weights.wickets) + (p.catches * weights.catches) + (p.runOuts * weights.runOuts) + (p.mom * weights.momAward);
    });

    return Object.values(mvp).sort((a, b) => b.points - a.points);
  },

  _getTopBatsman() {
    const data = CrickDeskData.load();
    const matches = (data.matches || []).filter(m => m.status === 'completed');
    const agg = {};
    matches.forEach(m => {
      if (!m.innings) return;
      m.innings.forEach(inn => {
        (inn.battingScorecard || []).forEach(b => {
          if (!agg[b.playerId]) agg[b.playerId] = { id: b.playerId, runs: 0, balls: 0, innings: 0, outs: 0, fours: 0, sixes: 0, hs: 0 };
          const a = agg[b.playerId];
          a.runs += b.runs || 0;
          a.balls += b.balls || 0;
          a.innings++;
          a.fours += b.fours || 0;
          a.sixes += b.sixes || 0;
          if (b.howOut && b.howOut !== 'not out' && b.howOut !== 'not-out' && b.howOut !== '') a.outs++;
          if ((b.runs || 0) > a.hs) a.hs = b.runs;
        });
      });
    });
    const list = Object.values(agg).sort((a, b) => b.runs - a.runs);
    if (list.length === 0) return null;
    const top = list[0];
    const p = CrickDeskData.getPlayer(top.id);
    return { ...top, name: p ? p.name : 'Unknown', teamId: p ? p.teamId : null, avg: top.outs > 0 ? (top.runs / top.outs).toFixed(2) : top.runs.toFixed(2), sr: top.balls > 0 ? ((top.runs / top.balls) * 100).toFixed(1) : '0.0' };
  },

  _getTopBowler() {
    const data = CrickDeskData.load();
    const matches = (data.matches || []).filter(m => m.status === 'completed');
    const bpo = (data.tournament && data.tournament.ballsPerOver) || 6;
    const agg = {};
    matches.forEach(m => {
      if (!m.innings) return;
      m.innings.forEach(inn => {
        (inn.bowlingScorecard || []).forEach(b => {
          if (!agg[b.playerId]) agg[b.playerId] = { id: b.playerId, wickets: 0, runs: 0, balls: 0, innings: 0, maidens: 0 };
          const a = agg[b.playerId];
          a.wickets += b.wickets || 0;
          a.runs += b.runs || 0;
          a.balls += (b.balls || 0);
          a.innings++;
          a.maidens += b.maidens || 0;
        });
      });
    });
    const list = Object.values(agg).sort((a, b) => b.wickets - a.wickets);
    if (list.length === 0) return null;
    const top = list[0];
    const p = CrickDeskData.getPlayer(top.id);
    const overs = top.balls > 0 ? Math.floor(top.balls / bpo) + '.' + (top.balls % bpo) : '0';
    return { ...top, name: p ? p.name : 'Unknown', teamId: p ? p.teamId : null, economy: top.balls > 0 ? (top.runs / (top.balls / bpo)).toFixed(2) : '0.00', avg: top.wickets > 0 ? (top.runs / top.wickets).toFixed(2) : '-', overs };
  },

  _getTotalStats() {
    const matches = CrickDeskData.getMatches() || [];
    const completed = matches.filter(m => m.status === 'completed');
    let totalRuns = 0, totalWickets = 0, totalSixes = 0;
    completed.forEach(m => {
      if (!m.innings) return;
      m.innings.forEach(inn => {
        totalRuns += inn.totalRuns || 0;
        totalWickets += inn.totalWickets || 0;
        (inn.battingScorecard || []).forEach(b => { totalSixes += b.sixes || 0; });
      });
    });
    return { matches: completed.length, totalRuns, totalWickets, totalSixes };
  },

  _getRecentResults() {
    const matches = (CrickDeskData.getMatches() || []).filter(m => m.status === 'completed');
    matches.sort((a, b) => new Date(b.date) - new Date(a.date));
    return matches.slice(0, 3);
  },

  _getUpcomingMatches() {
    const matches = (CrickDeskData.getMatches() || []).filter(m => m.status === 'upcoming');
    matches.sort((a, b) => new Date(a.date) - new Date(b.date));
    return matches.slice(0, 3);
  },

  _getLiveMatch() {
    return (CrickDeskData.getMatches() || []).find(m => m.status === 'live') || null;
  },

  _getNextMatch() {
    const upcoming = (CrickDeskData.getMatches() || []).filter(m => m.status === 'upcoming');
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    return upcoming[0] || null;
  },

  _teamBadge(teamId, size) {
    size = size || 36;
    const team = CrickDeskData.getTeam(teamId);
    if (!team) return `<span class="avatar" style="width:${size}px;height:${size}px;background:var(--bg-tertiary);font-size:${size * 0.4}px">?</span>`;
    const letter = team.shortName ? team.shortName.charAt(0) : team.name.charAt(0);
    return `<span class="avatar" style="width:${size}px;height:${size}px;background:${team.color || 'var(--accent-green)'};color:#fff;font-size:${size * 0.4}px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;font-family:var(--font-heading)">${letter}</span>`;
  },

  _teamName(teamId) {
    const t = CrickDeskData.getTeam(teamId);
    return t ? t.name : 'TBD';
  },

  _teamShort(teamId) {
    const t = CrickDeskData.getTeam(teamId);
    return t ? (t.shortName || t.name.substring(0, 3).toUpperCase()) : 'TBD';
  },

  _formatScore(inn) {
    if (!inn) return '-';
    const bpo = (CrickDeskData.getTournament() && CrickDeskData.getTournament().ballsPerOver) || 6;
    const overs = CrickDeskUtils.formatOvers(inn.totalBalls || 0, bpo);
    return `${inn.totalRuns || 0}/${inn.totalWickets || 0} (${overs})`;
  },

  /* ---- Main Render ---- */
  render() {
    const data = CrickDeskData.load();
    const tournament = data.tournament || {};
    const teamStats = this._getTeamStats();
    const mvpList = this._getPlayerMVP();
    const topBat = this._getTopBatsman();
    const topBowl = this._getTopBowler();
    const totalStats = this._getTotalStats();
    const recentResults = this._getRecentResults();
    const upcomingMatches = this._getUpcomingMatches();
    const liveMatch = this._getLiveMatch();
    const nextMatch = this._getNextMatch();

    /* Points table — sort by points, then NRR */
    const sortedTeams = Object.values(teamStats).sort((a, b) => b.points - a.points || b.nrr - a.nrr).slice(0, 4);

    /* Format badge */
    const fmtMap = { 'round-robin': 'Round Robin', 'knockout': 'Knockout', 'round-robin-knockout': 'RR + Knockout' };
    const formatLabel = fmtMap[tournament.format] || tournament.format || 'Not Set';

    /* Tournament status */
    let tournamentStatus = 'upcoming';
    let statusLabel = 'Upcoming';
    let statusClass = 'badge-blue';
    if (tournament.startDate && tournament.endDate) {
      const now = new Date();
      const start = new Date(tournament.startDate);
      const end = new Date(tournament.endDate);
      if (now >= start && now <= end) { tournamentStatus = 'active'; statusLabel = 'Active'; statusClass = 'badge-green'; }
      else if (now > end) { tournamentStatus = 'completed'; statusLabel = 'Completed'; statusClass = 'badge-amber'; }
    }

    return `
      <div class="page-header">
        <h1 class="page-title" style="font-family:var(--font-heading);font-weight:800;font-size:1.8rem">Dashboard</h1>
      </div>
      <div class="page-content">
        <div class="bento-grid dashboard-bento">

          <!-- 1. Tournament Header Card -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-tournament-header" style="grid-column:1/-1">
            <div class="tournament-header-gradient"></div>
            <div class="card-body" style="padding:28px 32px 24px">
              <div class="flex-between" style="align-items:flex-start;flex-wrap:wrap;gap:16px">
                <div>
                  <h2 style="font-family:var(--font-heading);font-size:1.75rem;font-weight:800;color:var(--text-primary);margin:0 0 8px">${tournament.name || 'CrickDesk Tournament'}</h2>
                  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                    <span style="color:var(--text-secondary);font-size:0.9rem">${tournament.startDate ? CrickDeskUtils.formatDate(tournament.startDate) : '—'} — ${tournament.endDate ? CrickDeskUtils.formatDate(tournament.endDate) : '—'}</span>
                    <span class="badge ${statusClass}">${statusLabel}</span>
                    <span class="badge badge-purple">${formatLabel}</span>
                    ${tournament.oversPerMatch ? `<span class="badge badge-blue">${tournament.oversPerMatch} Overs</span>` : ''}
                  </div>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-secondary btn-sm" id="dashboard-btn-tournament" title="Tournament Settings">🏆 Settings</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Live / Next Match Card -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-live-match" style="grid-column:span 2">
            <div class="card-header"><h3 class="card-title">${liveMatch ? '🔴 Live Match' : '📅 Next Match'}</h3></div>
            <div class="card-body" style="padding:16px 24px 24px">
              ${this._renderLiveOrNext(liveMatch, nextMatch)}
            </div>
          </div>

          <!-- 3. Points Table Mini -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-points-table">
            <div class="card-header"><h3 class="card-title">🏆 Points Table</h3></div>
            <div class="card-body" style="padding:0 16px 16px">
              ${sortedTeams.length > 0 ? `
              <table class="data-table" style="font-size:0.82rem;width:100%">
                <thead><tr><th style="text-align:left">Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr></thead>
                <tbody>
                  ${sortedTeams.map((t, i) => `
                    <tr style="border-left:3px solid ${t.color || 'var(--accent-green)'}">
                      <td style="text-align:left;display:flex;align-items:center;gap:6px">
                        <span class="rank-badge rank-${i + 1}" style="font-size:0.7rem;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;background:var(--bg-tertiary);color:var(--text-secondary)">${i + 1}</span>
                        ${t.shortName || t.name.substring(0, 3).toUpperCase()}
                      </td>
                      <td>${t.played}</td><td>${t.won}</td><td>${t.lost}</td>
                      <td style="font-weight:700;color:var(--accent-green)">${t.points}</td>
                      <td style="color:${t.nrr >= 0 ? 'var(--accent-green-light)' : 'var(--accent-red)'}">${t.nrr >= 0 ? '+' : ''}${t.nrr.toFixed(3)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>` : '<div class="empty-state" style="padding:24px;text-align:center"><p style="color:var(--text-muted)">No matches played yet</p></div>'}
              <div style="text-align:center;margin-top:8px">
                <button class="btn btn-ghost btn-sm" id="dashboard-goto-fixtures" style="font-size:0.8rem;color:var(--accent-green)">View Full Table →</button>
              </div>
            </div>
          </div>

          <!-- 4. Super Stars Card -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-superstars">
            <div class="card-header"><h3 class="card-title">⭐ Super Stars (MVP)</h3></div>
            <div class="card-body" style="padding:8px 20px 20px">
              ${mvpList.length > 0 ? mvpList.slice(0, 3).map((p, i) => {
                const team = CrickDeskData.getTeam(p.teamId);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                const labels = ['🥇', '🥈', '🥉'];
                const maxPts = mvpList[0].points || 1;
                const pct = Math.round((p.points / maxPts) * 100);
                return `
                <div class="mvp-row" style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < 2 ? 'border-bottom:1px solid var(--border-color);' : ''}">
                  <span style="font-size:1.3rem;min-width:28px;text-align:center">${labels[i]}</span>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span style="font-weight:600;color:var(--text-primary);font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</span>
                      ${team ? `<span class="badge" style="background:${team.color};color:#fff;font-size:0.65rem;padding:1px 6px">${team.shortName || team.name.substring(0, 3)}</span>` : ''}
                    </div>
                    <div class="progress-bar" style="height:6px;border-radius:3px;overflow:hidden;background:var(--bg-tertiary)">
                      <div class="progress-fill mvp-progress" data-target="${pct}" style="width:0%;height:100%;border-radius:3px;background:${colors[i]};transition:width 1s ease"></div>
                    </div>
                  </div>
                  <span style="font-weight:700;color:${colors[i]};font-size:0.9rem;min-width:40px;text-align:right">${p.points}</span>
                </div>`;
              }).join('') : '<div class="empty-state" style="padding:24px;text-align:center"><p style="color:var(--text-muted)">No match data available</p></div>'}
            </div>
          </div>

          <!-- 5. Top Run Scorer Card -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-top-batsman">
            <div class="card-header"><h3 class="card-title">🏏 Top Run Scorer</h3></div>
            <div class="card-body" style="padding:12px 24px 24px">
              ${topBat ? (() => {
                const team = CrickDeskData.getTeam(topBat.teamId);
                return `
                <div style="text-align:center;margin-bottom:12px">
                  ${this._teamBadge(topBat.teamId, 48)}
                  <div style="font-weight:700;font-size:1.05rem;color:var(--text-primary);margin-top:8px">${topBat.name}</div>
                  ${team ? `<span class="badge" style="background:${team.color};color:#fff;font-size:0.7rem;margin-top:4px">${team.shortName || team.name}</span>` : ''}
                </div>
                <div class="stat-value" style="text-align:center;font-size:2.2rem;color:var(--accent-green);font-family:var(--font-heading);font-weight:800">${topBat.runs}</div>
                <div style="text-align:center;color:var(--text-muted);font-size:0.8rem;margin-bottom:12px">runs</div>
                <div class="progress-bar" style="height:6px;border-radius:3px;overflow:hidden;background:var(--bg-tertiary);margin-bottom:16px">
                  <div style="width:100%;height:100%;border-radius:3px;background:var(--accent-green);"></div>
                </div>
                <div style="display:flex;justify-content:space-around;text-align:center">
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBat.innings}</div><div style="font-size:0.7rem;color:var(--text-muted)">Inn</div></div>
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBat.avg}</div><div style="font-size:0.7rem;color:var(--text-muted)">Avg</div></div>
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBat.sr}</div><div style="font-size:0.7rem;color:var(--text-muted)">SR</div></div>
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBat.hs}</div><div style="font-size:0.7rem;color:var(--text-muted)">HS</div></div>
                </div>`;
              })() : '<div class="empty-state" style="padding:32px;text-align:center"><p style="color:var(--text-muted)">No batting data yet</p></div>'}
            </div>
          </div>

          <!-- 6. Top Wicket Taker Card -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-top-bowler">
            <div class="card-header"><h3 class="card-title">🎯 Top Wicket Taker</h3></div>
            <div class="card-body" style="padding:12px 24px 24px">
              ${topBowl ? (() => {
                const team = CrickDeskData.getTeam(topBowl.teamId);
                return `
                <div style="text-align:center;margin-bottom:12px">
                  ${this._teamBadge(topBowl.teamId, 48)}
                  <div style="font-weight:700;font-size:1.05rem;color:var(--text-primary);margin-top:8px">${topBowl.name}</div>
                  ${team ? `<span class="badge" style="background:${team.color};color:#fff;font-size:0.7rem;margin-top:4px">${team.shortName || team.name}</span>` : ''}
                </div>
                <div class="stat-value" style="text-align:center;font-size:2.2rem;color:var(--accent-amber);font-family:var(--font-heading);font-weight:800">${topBowl.wickets}</div>
                <div style="text-align:center;color:var(--text-muted);font-size:0.8rem;margin-bottom:12px">wickets</div>
                <div class="progress-bar" style="height:6px;border-radius:3px;overflow:hidden;background:var(--bg-tertiary);margin-bottom:16px">
                  <div style="width:100%;height:100%;border-radius:3px;background:var(--accent-amber);"></div>
                </div>
                <div style="display:flex;justify-content:space-around;text-align:center">
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBowl.overs}</div><div style="font-size:0.7rem;color:var(--text-muted)">Overs</div></div>
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBowl.economy}</div><div style="font-size:0.7rem;color:var(--text-muted)">Econ</div></div>
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBowl.avg}</div><div style="font-size:0.7rem;color:var(--text-muted)">Avg</div></div>
                  <div><div style="font-weight:600;color:var(--text-primary)">${topBowl.maidens}</div><div style="font-size:0.7rem;color:var(--text-muted)">Mdn</div></div>
                </div>`;
              })() : '<div class="empty-state" style="padding:32px;text-align:center"><p style="color:var(--text-muted)">No bowling data yet</p></div>'}
            </div>
          </div>

          <!-- 7. Quick Stats Row -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-quick-stats" style="grid-column:1/-1">
            <div class="card-body" style="padding:24px 32px">
              <div class="grid-4" style="gap:24px">
                <div class="stat-card" style="text-align:center;padding:20px;background:var(--glass-bg);border-radius:var(--radius-md);border:1px solid var(--glass-border)">
                  <div style="font-size:1.6rem;margin-bottom:4px">🏏</div>
                  <div class="stat-value counter-animate" data-target="${totalStats.matches}" style="font-size:2rem;font-family:var(--font-heading);font-weight:800;color:var(--accent-green)">0</div>
                  <div class="stat-label" style="color:var(--text-muted);font-size:0.8rem;margin-top:4px">Total Matches</div>
                </div>
                <div class="stat-card" style="text-align:center;padding:20px;background:var(--glass-bg);border-radius:var(--radius-md);border:1px solid var(--glass-border)">
                  <div style="font-size:1.6rem;margin-bottom:4px">📊</div>
                  <div class="stat-value counter-animate" data-target="${totalStats.totalRuns}" style="font-size:2rem;font-family:var(--font-heading);font-weight:800;color:var(--accent-blue)">0</div>
                  <div class="stat-label" style="color:var(--text-muted);font-size:0.8rem;margin-top:4px">Total Runs</div>
                </div>
                <div class="stat-card" style="text-align:center;padding:20px;background:var(--glass-bg);border-radius:var(--radius-md);border:1px solid var(--glass-border)">
                  <div style="font-size:1.6rem;margin-bottom:4px">🎯</div>
                  <div class="stat-value counter-animate" data-target="${totalStats.totalWickets}" style="font-size:2rem;font-family:var(--font-heading);font-weight:800;color:var(--accent-amber)">0</div>
                  <div class="stat-label" style="color:var(--text-muted);font-size:0.8rem;margin-top:4px">Total Wickets</div>
                </div>
                <div class="stat-card" style="text-align:center;padding:20px;background:var(--glass-bg);border-radius:var(--radius-md);border:1px solid var(--glass-border)">
                  <div style="font-size:1.6rem;margin-bottom:4px">💥</div>
                  <div class="stat-value counter-animate" data-target="${totalStats.totalSixes}" style="font-size:2rem;font-family:var(--font-heading);font-weight:800;color:var(--accent-purple)">0</div>
                  <div class="stat-label" style="color:var(--text-muted);font-size:0.8rem;margin-top:4px">Total Sixes</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 8. Recent Results Card -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-recent-results" style="grid-column:span 2">
            <div class="card-header"><h3 class="card-title">📋 Recent Results</h3></div>
            <div class="card-body" style="padding:8px 20px 20px">
              ${recentResults.length > 0 ? recentResults.map(m => {
                const inn1 = m.innings && m.innings[0] ? m.innings[0] : null;
                const inn2 = m.innings && m.innings[1] ? m.innings[1] : null;
                const mom = m.manOfMatch ? CrickDeskData.getPlayer(m.manOfMatch) : null;
                return `
                <div class="recent-result-item" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color)">
                  <div style="flex:1;display:flex;align-items:center;gap:8px;justify-content:flex-end;text-align:right">
                    <div>
                      <div style="font-weight:600;font-size:0.85rem;color:var(--text-primary)">${this._teamShort(m.team1Id)}</div>
                      <div style="font-size:0.8rem;color:var(--text-secondary)">${this._formatScore(inn1 && inn1.battingTeamId === m.team1Id ? inn1 : inn2)}</div>
                    </div>
                    ${this._teamBadge(m.team1Id, 30)}
                  </div>
                  <span style="font-weight:700;color:var(--text-muted);font-size:0.75rem;padding:4px 8px;background:var(--bg-tertiary);border-radius:var(--radius-sm)">vs</span>
                  <div style="flex:1;display:flex;align-items:center;gap:8px">
                    ${this._teamBadge(m.team2Id, 30)}
                    <div>
                      <div style="font-weight:600;font-size:0.85rem;color:var(--text-primary)">${this._teamShort(m.team2Id)}</div>
                      <div style="font-size:0.8rem;color:var(--text-secondary)">${this._formatScore(inn2 && inn2.battingTeamId === m.team2Id ? inn2 : inn1)}</div>
                    </div>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;padding:4px 0 6px;font-size:0.72rem;color:var(--text-muted)">
                  <span>${m.result && m.result.summary ? m.result.summary : ''}</span>
                  ${mom ? `<span>🏅 ${mom.name}</span>` : ''}
                </div>`;
              }).join('') : '<div class="empty-state" style="padding:24px;text-align:center"><p style="color:var(--text-muted)">No completed matches yet</p></div>'}
            </div>
          </div>

          <!-- 9. Upcoming Fixtures Card -->
          <div class="card glass dashboard-card dashboard-card-reveal" id="dashboard-upcoming-fixtures">
            <div class="card-header"><h3 class="card-title">📅 Upcoming Fixtures</h3></div>
            <div class="card-body" style="padding:4px 16px 16px">
              ${upcomingMatches.length > 0 ? upcomingMatches.map(m => {
                const venue = m.venue || '';
                return `
                <div class="upcoming-item" style="padding:12px 4px;border-bottom:1px solid var(--border-color)">
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">${m.date ? CrickDeskUtils.formatDateTime(m.date) : 'TBD'}</div>
                  <div style="display:flex;align-items:center;gap:8px">
                    ${this._teamBadge(m.team1Id, 26)}
                    <span style="font-weight:600;font-size:0.85rem;color:var(--text-primary)">${this._teamShort(m.team1Id)}</span>
                    <span style="color:var(--text-muted);font-size:0.75rem;margin:0 4px">vs</span>
                    <span style="font-weight:600;font-size:0.85rem;color:var(--text-primary)">${this._teamShort(m.team2Id)}</span>
                    ${this._teamBadge(m.team2Id, 26)}
                  </div>
                  ${venue ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">📍 ${venue}</div>` : ''}
                </div>`;
              }).join('') : '<div class="empty-state" style="padding:24px;text-align:center"><p style="color:var(--text-muted)">No upcoming matches</p></div>'}
            </div>
          </div>

        </div><!-- /bento-grid -->
      </div><!-- /page-content -->`;
  },

  /* ---- Render helpers ---- */
  _renderLiveOrNext(live, next) {
    if (live) {
      const inn = live.innings && live.innings.length > 0 ? live.innings[live.innings.length - 1] : null;
      const battingTeam = inn ? this._teamShort(inn.battingTeamId) : '';
      const bpo = (CrickDeskData.getTournament() && CrickDeskData.getTournament().ballsPerOver) || 6;
      const overs = inn ? CrickDeskUtils.formatOvers(inn.totalBalls || 0, bpo) : '0.0';
      return `
        <div style="text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:32px;margin-bottom:16px">
            <div style="text-align:center">
              ${this._teamBadge(live.team1Id, 52)}
              <div style="margin-top:8px;font-weight:700;color:var(--text-primary)">${this._teamShort(live.team1Id)}</div>
            </div>
            <div>
              <span class="live-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--accent-red);animation:livePulse 1.5s ease-in-out infinite;margin-right:6px"></span>
              <span style="font-weight:700;color:var(--accent-red);font-size:0.85rem;text-transform:uppercase;letter-spacing:1px">Live</span>
            </div>
            <div style="text-align:center">
              ${this._teamBadge(live.team2Id, 52)}
              <div style="margin-top:8px;font-weight:700;color:var(--text-primary)">${this._teamShort(live.team2Id)}</div>
            </div>
          </div>
          ${inn ? `
          <div style="font-family:var(--font-heading);font-size:1.8rem;font-weight:800;color:var(--accent-green)">${inn.totalRuns || 0}/${inn.totalWickets || 0}</div>
          <div style="color:var(--text-secondary);font-size:0.85rem">${battingTeam} · ${overs} overs</div>
          ` : '<div style="color:var(--text-muted)">Match in progress</div>'}
          <button class="btn btn-primary btn-sm" id="dashboard-goto-scoring" style="margin-top:16px">Go to Scoring →</button>
        </div>`;
    }

    if (next) {
      const diff = next.date ? new Date(next.date) - new Date() : 0;
      const days = Math.max(0, Math.floor(diff / 86400000));
      const hrs = Math.max(0, Math.floor((diff % 86400000) / 3600000));
      const mins = Math.max(0, Math.floor((diff % 3600000) / 60000));
      return `
        <div style="text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:32px;margin-bottom:16px">
            <div style="text-align:center">
              ${this._teamBadge(next.team1Id, 52)}
              <div style="margin-top:8px;font-weight:700;color:var(--text-primary)">${this._teamShort(next.team1Id)}</div>
            </div>
            <span style="font-weight:700;color:var(--text-muted);font-size:1.1rem">vs</span>
            <div style="text-align:center">
              ${this._teamBadge(next.team2Id, 52)}
              <div style="margin-top:8px;font-weight:700;color:var(--text-primary)">${this._teamShort(next.team2Id)}</div>
            </div>
          </div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px">${next.date ? CrickDeskUtils.formatDateTime(next.date) : 'TBD'}${next.venue ? ' · 📍 ' + next.venue : ''}</div>
          <div id="dashboard-countdown" style="display:flex;justify-content:center;gap:16px;margin-top:8px">
            <div class="countdown-unit" style="text-align:center;padding:10px 16px;background:var(--bg-tertiary);border-radius:var(--radius-md);min-width:60px">
              <div class="stat-value" id="countdown-days" style="font-family:var(--font-heading);font-size:1.5rem;font-weight:800;color:var(--accent-green)">${days}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Days</div>
            </div>
            <div class="countdown-unit" style="text-align:center;padding:10px 16px;background:var(--bg-tertiary);border-radius:var(--radius-md);min-width:60px">
              <div class="stat-value" id="countdown-hours" style="font-family:var(--font-heading);font-size:1.5rem;font-weight:800;color:var(--accent-green)">${hrs}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Hours</div>
            </div>
            <div class="countdown-unit" style="text-align:center;padding:10px 16px;background:var(--bg-tertiary);border-radius:var(--radius-md);min-width:60px">
              <div class="stat-value" id="countdown-mins" style="font-family:var(--font-heading);font-size:1.5rem;font-weight:800;color:var(--accent-green)">${mins}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Mins</div>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="empty-state" style="padding:32px;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:12px">🏏</div>
        <p style="color:var(--text-muted);margin-bottom:12px">No matches scheduled yet</p>
        <button class="btn btn-primary btn-sm" id="dashboard-goto-fixtures-empty">Create Fixtures</button>
      </div>`;
  },

  /* ---- Events ---- */
  attachEvents() {
    const container = document.getElementById('page-dashboard');
    if (!container || container.dataset.eventsAttached) return;
    container.dataset.eventsAttached = 'true';
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'dashboard-btn-tournament') CrickDeskApp.navigate('tournament');
      if (btn.id === 'dashboard-goto-fixtures' || btn.id === 'dashboard-goto-fixtures-empty') CrickDeskApp.navigate('fixtures');
      if (btn.id === 'dashboard-goto-scoring') CrickDeskApp.navigate('scoring');
    });
  },

  /* ---- Animated counters ---- */
  animateCounters() {
    const els = document.querySelectorAll('#page-dashboard .counter-animate');
    els.forEach(el => {
      const target = parseInt(el.dataset.target, 10) || 0;
      if (target === 0) { el.textContent = '0'; return; }
      CrickDeskUtils.animateCounter(el, target, 1200);
    });

    /* MVP progress bars */
    setTimeout(() => {
      document.querySelectorAll('#page-dashboard .mvp-progress').forEach(bar => {
        bar.style.width = bar.dataset.target + '%';
      });
    }, 300);
  },

  /* ---- Countdown timer ---- */
  startCountdown() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    const nextMatch = this._getNextMatch();
    if (!nextMatch || !nextMatch.date) return;
    this._countdownTimer = setInterval(() => {
      const diff = new Date(nextMatch.date) - new Date();
      if (diff <= 0) { clearInterval(this._countdownTimer); return; }
      const d = document.getElementById('countdown-days');
      const h = document.getElementById('countdown-hours');
      const m = document.getElementById('countdown-mins');
      if (d) d.textContent = Math.floor(diff / 86400000);
      if (h) h.textContent = Math.floor((diff % 86400000) / 3600000);
      if (m) m.textContent = Math.floor((diff % 3600000) / 60000);
    }, 60000);
  },

  /* ---- Stagger reveal ---- */
  staggerReveal() {
    const cards = document.querySelectorAll('#page-dashboard .dashboard-card-reveal');
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 80 * i);
    });
  }
};
