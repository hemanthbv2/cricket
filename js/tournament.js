/* ===== CrickDesk — Tournament Module ===== */
window.Tournament = (function () {
  'use strict';

  let activeTab = 'points';
  let editingVenueId = null;
  let editingPointsCell = null;

  /* ────── helpers ────── */
  const D = () => window.CrickDeskData;
  const U = () => window.CrickDeskUtils;

  function getTeamMatchStats(teamId) {
    const matches = D().getMatches().filter(
      m => m.status === 'completed' && (m.team1Id === teamId || m.team2Id === teamId)
    );
    let w = 0, l = 0, t = 0, nr = 0, played = 0;
    let runsScoredTotal = 0, oversFacedTotal = 0;
    let runsConcededTotal = 0, oversBowledTotal = 0;
    const bpo = D().getTournament().ballsPerOver || 6;

    matches.forEach(m => {
      played++;
      if (m.status === 'no-result' || m.status === 'abandoned') { nr++; return; }

      const isTeam1 = m.team1Id === teamId;
      const battingInningsIdx = m.innings ? m.innings.findIndex(inn => inn.battingTeamId === teamId) : -1;
      const bowlingInningsIdx = m.innings ? m.innings.findIndex(inn => inn.bowlingTeamId === teamId) : -1;

      if (battingInningsIdx !== -1 && m.innings[battingInningsIdx]) {
        const bi = m.innings[battingInningsIdx];
        runsScoredTotal += bi.totalRuns || 0;
        oversFacedTotal += (bi.totalBalls || 0) / bpo;
      }
      if (bowlingInningsIdx !== -1 && m.innings[bowlingInningsIdx]) {
        const boi = m.innings[bowlingInningsIdx];
        runsConcededTotal += boi.totalRuns || 0;
        oversBowledTotal += (boi.totalBalls || 0) / bpo;
      }

      if (m.result) {
        const resultLower = (m.result || '').toLowerCase();
        const team = D().getTeam(teamId);
        const teamName = team ? team.name.toLowerCase() : '';
        const teamShort = team ? (team.shortName || '').toLowerCase() : '';
        if (resultLower.includes('tied') || resultLower.includes('tie')) {
          t++;
        } else if (resultLower.includes('no result') || resultLower.includes('abandoned')) {
          nr++;
        } else if (
          resultLower.includes(teamName + ' won') ||
          resultLower.includes(teamShort + ' won') ||
          (m.winnerId && m.winnerId === teamId)
        ) {
          w++;
        } else {
          l++;
        }
      }
    });

    const pts = computePoints(w, l, t, nr);
    const nrr = oversFacedTotal > 0 && oversBowledTotal > 0
      ? (runsScoredTotal / oversFacedTotal) - (runsConcededTotal / oversBowledTotal)
      : 0;

    return { played, w, l, t, nr, pts, nrr: Math.round(nrr * 1000) / 1000, runsScoredTotal, oversFacedTotal, runsConcededTotal, oversBowledTotal };
  }

  function computePoints(w, l, t, nr) {
    const ps = D().getTournament().pointsSystem || { win: 2, loss: 0, tie: 1, nr: 1, bonus: 1 };
    return w * (ps.win || 2) + l * (ps.loss || 0) + t * (ps.tie || 1) + nr * (ps.nr || 1);
  }

  function buildPointsTable() {
    const teams = D().getTeams();
    const rows = teams.map(t => {
      const s = getTeamMatchStats(t.id);
      return { team: t, ...s };
    });
    rows.sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
    return rows;
  }

  /* ────── render ────── */
  function render() {
    return `
      <div class="page-header">
        <div>
          <h1 class="page-title" style="font-family:var(--font-heading);font-size:1.75rem;font-weight:700;color:var(--text-primary);margin:0;">Tournament</h1>
          <p class="page-subtitle" style="color:var(--text-secondary);margin:4px 0 0;font-size:0.9rem;">Configure, track, and manage your tournament</p>
        </div>
      </div>
      <div class="page-content">
        <div class="tab-group" id="tournament-tabs" style="margin-bottom:24px;">
          <button class="tab${activeTab === 'points' ? ' active' : ''}" data-tab="points">Points Table</button>
          <button class="tab${activeTab === 'settings' ? ' active' : ''}" data-tab="settings">Settings</button>
          <button class="tab${activeTab === 'bracket' ? ' active' : ''}" data-tab="bracket">Bracket</button>
          <button class="tab${activeTab === 'venues' ? ' active' : ''}" data-tab="venues">Venues</button>
        </div>
        <div id="tournament-tab-content">
          ${renderTabContent()}
        </div>
      </div>`;
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'settings': return renderSettings();
      case 'points': return renderPointsTable();
      case 'bracket': return renderBracket();
      case 'venues': return renderVenues();
      default: return renderPointsTable();
    }
  }

  /* ─── Settings Tab ─── */
  function renderSettings() {
    const t = D().getTournament();
    const ps = t.pointsSystem || { win: 2, loss: 0, tie: 1, nr: 1, bonus: 1 };
    const mvp = t.mvpWeights || { runs: 1, wickets: 25, catches: 10, runOuts: 10, momAward: 25 };

    return `
    <form id="tournament-settings-form" autocomplete="off">
      <!-- Tournament Info -->
      <h3 class="section-title">Tournament Info</h3>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label" for="ts-name">Tournament Name</label>
          <input class="form-input" type="text" id="ts-name" value="${U().escapeHTML ? U().escapeHTML(t.name || '') : (t.name || '').replace(/</g,'&lt;')}" placeholder="e.g. Office Premier League 2026" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-format">Format</label>
          <select class="form-select" id="ts-format">
            <option value="round-robin"${t.format === 'round-robin' ? ' selected' : ''}>Round Robin</option>
            <option value="knockout"${t.format === 'knockout' ? ' selected' : ''}>Knockout</option>
            <option value="round-robin-knockout"${t.format === 'round-robin-knockout' ? ' selected' : ''}>Round Robin + Knockout</option>
          </select>
        </div>
      </div>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label" for="ts-start">Start Date</label>
          <input class="form-input" type="date" id="ts-start" value="${t.startDate || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-end">End Date</label>
          <input class="form-input" type="date" id="ts-end" value="${t.endDate || ''}">
        </div>
      </div>

      <div class="divider" style="border-top:1px solid var(--border-color);margin:24px 0;"></div>

      <!-- Match Rules -->
      <h3 class="section-title">Match Rules</h3>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div class="form-group">
          <label class="form-label" for="ts-overs">Overs per Match</label>
          <input class="form-input" type="number" id="ts-overs" value="${t.oversPerMatch || 6}" min="1" max="50">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-bpo">Balls per Over</label>
          <select class="form-select" id="ts-bpo">
            <option value="6"${(t.ballsPerOver || 6) === 6 ? ' selected' : ''}>6</option>
            <option value="7"${t.ballsPerOver === 7 ? ' selected' : ''}>7</option>
            <option value="8"${t.ballsPerOver === 8 ? ' selected' : ''}>8</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-ppt">Players per Team</label>
          <input class="form-input" type="number" id="ts-ppt" value="${t.playersPerTeam || 8}" min="2" max="15">
        </div>
      </div>

      <div class="divider" style="border-top:1px solid var(--border-color);margin:24px 0;"></div>

      <!-- Special Rules -->
      <h3 class="section-title">Special Rules</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 32px;">
        ${renderToggle('ts-lms', 'Last Man Stands', t.lastManStands)}
        ${renderToggle('ts-wides', 'Wides Enabled', t.widesEnabled !== false)}
        ${renderToggle('ts-nb', 'No Balls Enabled', t.noBallsEnabled !== false)}
        ${renderToggle('ts-bonus', 'Bonus Runs Mode', t.bonusRunsEnabled)}
      </div>

      <div class="divider" style="border-top:1px solid var(--border-color);margin:24px 0;"></div>

      <!-- Points System -->
      <h3 class="section-title">Points System</h3>
      <div class="form-row" style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;">
        <div class="form-group">
          <label class="form-label" for="ts-pts-win">Win</label>
          <input class="form-input" type="number" id="ts-pts-win" value="${ps.win}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-pts-loss">Loss</label>
          <input class="form-input" type="number" id="ts-pts-loss" value="${ps.loss}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-pts-tie">Tie</label>
          <input class="form-input" type="number" id="ts-pts-tie" value="${ps.tie}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-pts-nr">No Result</label>
          <input class="form-input" type="number" id="ts-pts-nr" value="${ps.nr}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-pts-bonus">Bonus Point</label>
          <input class="form-input" type="number" id="ts-pts-bonus" value="${ps.bonus}" min="0">
        </div>
      </div>

      <div class="divider" style="border-top:1px solid var(--border-color);margin:24px 0;"></div>

      <!-- MVP Weights -->
      <h3 class="section-title">MVP Weights</h3>
      <div class="form-row" style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;">
        <div class="form-group">
          <label class="form-label" for="ts-mvp-runs">Runs</label>
          <input class="form-input" type="number" id="ts-mvp-runs" value="${mvp.runs}" min="0" step="0.1">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-mvp-wickets">Wickets</label>
          <input class="form-input" type="number" id="ts-mvp-wickets" value="${mvp.wickets}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-mvp-catches">Catches</label>
          <input class="form-input" type="number" id="ts-mvp-catches" value="${mvp.catches}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-mvp-runouts">Run Outs</label>
          <input class="form-input" type="number" id="ts-mvp-runouts" value="${mvp.runOuts}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="ts-mvp-mom">MoM Award</label>
          <input class="form-input" type="number" id="ts-mvp-mom" value="${mvp.momAward}" min="0">
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-top:32px;">
        <button type="submit" class="btn btn-primary" id="tournament-save-btn">💾 Save Settings</button>
        <button type="button" class="btn btn-secondary" id="tournament-generate-fixtures-btn">📅 Auto-Generate Fixtures</button>
      </div>
    </form>`;
  }

  function renderToggle(id, label, checked) {
    return `
      <div class="form-group" style="display:flex;align-items:center;justify-content:space-between;">
        <label class="form-label" for="${id}" style="margin-bottom:0;">${label}</label>
        <label class="toggle-switch" style="position:relative;display:inline-block;width:48px;height:26px;flex-shrink:0;">
          <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="opacity:0;width:0;height:0;">
          <span class="toggle-slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:var(--bg-tertiary);border-radius:26px;transition:.3s;border:1px solid var(--border-color);">
            <span style="position:absolute;content:'';height:20px;width:20px;left:2px;bottom:2px;background:var(--text-secondary);border-radius:50%;transition:.3s;${checked ? 'transform:translateX(22px);background:var(--accent-green);' : ''}"></span>
          </span>
        </label>
      </div>`;
  }

  /* ─── Points Table Tab ─── */
  function renderPointsTable() {
    const rows = buildPointsTable();
    const teams = D().getTeams();
    if (!teams.length) {
      return `<div class="empty-state" style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">🏆</div>
        <h3 style="color:var(--text-primary);margin:0 0 8px;">No Teams Yet</h3>
        <p style="color:var(--text-secondary);margin:0 0 20px;">Add teams to see the points table.</p>
        <button class="btn btn-primary" onclick="window.CrickDeskApp.navigate('teams')">👥 Add Teams</button>
      </div>`;
    }

    const qualifyCount = Math.ceil(rows.length / 2);

    let tableHtml = `
    <div class="data-table-responsive" style="overflow-x:auto;">
      <table class="data-table" id="points-table">
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th style="text-align:left;">Team</th>
            <th>P</th><th>W</th><th>L</th><th>T</th><th>NR</th>
            <th>Pts</th><th>NRR</th>
          </tr>
        </thead>
        <tbody>`;

    rows.forEach((r, i) => {
      const teamColor = r.team.color || 'var(--accent-green)';
      const isQualified = i < qualifyCount;
      const borderStyle = isQualified
        ? `border-left:3px solid var(--accent-green);`
        : `border-left:3px solid var(--accent-red);background:rgba(239,68,68,0.03);`;
      const nrrStr = r.nrr >= 0 ? '+' + r.nrr.toFixed(3) : r.nrr.toFixed(3);

      tableHtml += `
          <tr style="${borderStyle}" data-team-id="${r.team.id}">
            <td style="color:var(--text-muted);font-weight:600;">${i + 1}</td>
            <td style="text-align:left;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="avatar avatar-sm" style="background:${teamColor};color:#fff;font-weight:700;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;">
                  ${(r.team.shortName || r.team.name.substring(0, 2)).toUpperCase()}
                </div>
                <span style="font-weight:600;color:var(--text-primary);">${r.team.name}</span>
              </div>
            </td>
            <td>${r.played}</td>
            <td style="color:var(--accent-green);font-weight:600;">${r.w}</td>
            <td style="color:var(--accent-red);">${r.l}</td>
            <td>${r.t}</td>
            <td>${r.nr}</td>
            <td class="pts-cell" data-team-id="${r.team.id}" style="font-weight:700;color:var(--accent-amber);cursor:pointer;" title="Click to edit">${r.pts}</td>
            <td class="nrr-cell" data-team-id="${r.team.id}" style="color:${r.nrr >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};cursor:pointer;" title="Click to edit">${nrrStr}</td>
          </tr>`;
    });

    tableHtml += `
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:20px;margin-top:16px;padding:0 4px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:12px;height:12px;border-radius:2px;background:var(--accent-green);display:inline-block;"></span>
        <span style="font-size:0.8rem;color:var(--text-secondary);">Qualified Zone</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:12px;height:12px;border-radius:2px;background:var(--accent-red);display:inline-block;"></span>
        <span style="font-size:0.8rem;color:var(--text-secondary);">Elimination Zone</span>
      </div>
      <div style="margin-left:auto;font-size:0.8rem;color:var(--text-muted);">💡 Click Pts or NRR to override values</div>
    </div>`;

    return tableHtml;
  }

  /* ─── Bracket Tab ─── */
  function renderBracket() {
    const t = D().getTournament();
    if (t.format === 'round-robin') {
      return `<div class="empty-state" style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">🌿</div>
        <h3 style="color:var(--text-primary);margin:0 0 8px;">No Knockout Stage</h3>
        <p style="color:var(--text-secondary);margin:0;">Your tournament format is Round Robin — no bracket needed.</p>
      </div>`;
    }

    const matches = D().getMatches();
    const knockoutMatches = matches.filter(m => m.stage === 'knockout' || m.stage === 'semifinal' || m.stage === 'final' || m.stage === 'qualifier');

    if (!knockoutMatches.length) {
      const teams = D().getTeams();
      const rows = buildPointsTable();
      const qualifyCount = Math.min(4, Math.ceil(rows.length / 2));

      return `<div style="text-align:center;padding:40px 20px;">
        <div style="font-size:2.5rem;margin-bottom:16px;">🏆</div>
        <h3 style="color:var(--text-primary);margin:0 0 8px;">Knockout Bracket</h3>
        <p style="color:var(--text-secondary);margin:0 0 24px;">No knockout matches scheduled yet. Top ${qualifyCount} teams from the points table will qualify.</p>
        ${rows.length >= 4 ? `<button class="btn btn-primary" id="generate-knockout-btn">🎯 Generate Knockout Matches</button>` : `<p style="color:var(--text-muted);font-size:0.85rem;">Complete the group stage first to generate the bracket.</p>`}
        ${renderBracketPreview(rows, qualifyCount)}
      </div>`;
    }

    return renderBracketTree(knockoutMatches);
  }

  function renderBracketPreview(rows, qualifyCount) {
    const qualified = rows.slice(0, qualifyCount);
    if (qualified.length < 4) return '';

    return `
    <div style="margin-top:32px;">
      <div style="display:flex;justify-content:center;align-items:center;gap:40px;flex-wrap:wrap;">
        <!-- Semi Final 1 -->
        <div class="card glass" style="padding:16px;min-width:200px;">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Semi Final 1</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${renderBracketTeam(qualified[0]?.team, '1st')}
            <div style="text-align:center;color:var(--text-muted);font-size:0.75rem;">vs</div>
            ${renderBracketTeam(qualified[3]?.team, '4th')}
          </div>
        </div>
        <!-- Final -->
        <div class="card glass glow" style="padding:16px;min-width:200px;border:1px solid var(--accent-amber);">
          <div style="font-size:0.75rem;color:var(--accent-amber);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">🏆 Final</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);color:var(--text-muted);text-align:center;font-size:0.85rem;">Winner SF1</div>
            <div style="text-align:center;color:var(--text-muted);font-size:0.75rem;">vs</div>
            <div style="padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);color:var(--text-muted);text-align:center;font-size:0.85rem;">Winner SF2</div>
          </div>
        </div>
        <!-- Semi Final 2 -->
        <div class="card glass" style="padding:16px;min-width:200px;">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Semi Final 2</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${renderBracketTeam(qualified[1]?.team, '2nd')}
            <div style="text-align:center;color:var(--text-muted);font-size:0.75rem;">vs</div>
            ${renderBracketTeam(qualified[2]?.team, '3rd')}
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderBracketTeam(team, seed) {
    if (!team) return `<div style="padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);color:var(--text-muted);font-size:0.85rem;">TBD</div>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);">
      <div class="avatar avatar-sm" style="background:${team.color || 'var(--accent-green)'};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;flex-shrink:0;">${(team.shortName || team.name.substring(0, 2)).toUpperCase()}</div>
      <span style="font-size:0.85rem;color:var(--text-primary);font-weight:500;">${team.name}</span>
      <span style="margin-left:auto;font-size:0.7rem;color:var(--text-muted);">${seed}</span>
    </div>`;
  }

  function renderBracketTree(knockoutMatches) {
    const semis = knockoutMatches.filter(m => m.stage === 'semifinal' || m.stage === 'qualifier');
    const finals = knockoutMatches.filter(m => m.stage === 'final');

    function matchCard(m) {
      const t1 = D().getTeam(m.team1Id);
      const t2 = D().getTeam(m.team2Id);
      const isCompleted = m.status === 'completed';
      const inn1 = m.innings && m.innings[0];
      const inn2 = m.innings && m.innings[1];
      return `
        <div class="card glass" style="padding:14px;min-width:220px;${isCompleted ? 'border:1px solid var(--accent-green);' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:1px;">${m.stage || 'Knockout'}</span>
            ${U().getStatusBadge ? U().getStatusBadge(m.status) : `<span class="badge">${m.status}</span>`}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;${m.winnerId === m.team1Id ? 'font-weight:700;' : ''}">
              <span style="color:var(--text-primary);font-size:0.9rem;">${t1 ? t1.name : 'TBD'}</span>
              <span style="color:var(--text-primary);font-weight:600;">${inn1 ? inn1.totalRuns + '/' + inn1.totalWickets : '-'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;${m.winnerId === m.team2Id ? 'font-weight:700;' : ''}">
              <span style="color:var(--text-primary);font-size:0.9rem;">${t2 ? t2.name : 'TBD'}</span>
              <span style="color:var(--text-primary);font-weight:600;">${inn2 ? inn2.totalRuns + '/' + inn2.totalWickets : '-'}</span>
            </div>
          </div>
          ${m.result ? `<div style="font-size:0.75rem;color:var(--accent-green);margin-top:8px;">${m.result}</div>` : ''}
        </div>`;
    }

    let html = `<div style="display:flex;justify-content:center;align-items:center;gap:40px;flex-wrap:wrap;padding:20px 0;">`;
    if (semis.length) {
      html += `<div style="display:flex;flex-direction:column;gap:20px;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;text-align:center;margin-bottom:4px;">Semi Finals</div>
        ${semis.map(m => matchCard(m)).join('')}
      </div>`;
    }

    html += `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:2px;height:40px;background:var(--border-color);margin-bottom:8px;"></div>
      <span style="font-size:1.5rem;">➡️</span>
      <div style="width:2px;height:40px;background:var(--border-color);margin-top:8px;"></div>
    </div>`;

    if (finals.length) {
      html += `<div style="display:flex;flex-direction:column;gap:20px;">
        <div style="font-size:0.75rem;color:var(--accent-amber);text-transform:uppercase;letter-spacing:1px;text-align:center;margin-bottom:4px;font-weight:700;">🏆 Final</div>
        ${finals.map(m => matchCard(m)).join('')}
      </div>`;
    } else {
      html += `<div class="card glass glow" style="padding:20px;min-width:220px;border:1px solid var(--accent-amber);">
        <div style="font-size:0.75rem;color:var(--accent-amber);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">🏆 Final</div>
        <div style="text-align:center;color:var(--text-muted);padding:16px 0;">To be decided</div>
      </div>`;
    }

    html += `</div>`;
    return html;
  }

  /* ─── Venues Tab ─── */
  function renderVenues() {
    const venues = D().getVenues();
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 class="section-title" style="margin:0;">Venues</h3>
        <button class="btn btn-primary btn-sm" id="add-venue-btn">+ Add Venue</button>
      </div>`;

    if (!venues.length) {
      html += `<div class="empty-state" style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">🏟️</div>
        <h3 style="color:var(--text-primary);margin:0 0 8px;">No Venues Added</h3>
        <p style="color:var(--text-secondary);margin:0;">Add match venues to organize your fixtures.</p>
      </div>`;
      return html;
    }

    html += `<div class="bento-grid grid-3" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">`;
    venues.forEach(v => {
      html += `
        <div class="card glass" style="padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <h4 style="color:var(--text-primary);margin:0 0 6px;font-weight:600;">${v.name}</h4>
              <p style="color:var(--text-secondary);margin:0;font-size:0.85rem;">📍 ${v.location || 'No location specified'}</p>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-ghost btn-icon btn-sm venue-edit-btn" data-id="${v.id}" title="Edit" style="font-size:0.85rem;">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm venue-delete-btn" data-id="${v.id}" title="Delete" style="font-size:0.85rem;">🗑️</button>
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
    return html;
  }

  /* ────── Event Handlers ────── */
  function attachEvents() {
    const container = document.getElementById('page-tournament');
    if (!container || container.dataset.eventsAttached) return;
    container.dataset.eventsAttached = 'true';

    container.addEventListener('click', function (e) {
      /* Tabs */
      const tab = e.target.closest('.tab[data-tab]');
      if (tab && tab.closest('#tournament-tabs')) {
        activeTab = tab.dataset.tab;
        refreshContent();
        return;
      }

      /* Save settings */
      if (e.target.id === 'tournament-save-btn' || e.target.closest('#tournament-save-btn')) {
        e.preventDefault();
        saveSettings();
        return;
      }

      /* Generate fixtures */
      if (e.target.id === 'tournament-generate-fixtures-btn' || e.target.closest('#tournament-generate-fixtures-btn')) {
        e.preventDefault();
        generateFixtures();
        return;
      }

      /* Generate knockout */
      if (e.target.id === 'generate-knockout-btn') {
        generateKnockout();
        return;
      }

      /* Add venue */
      if (e.target.id === 'add-venue-btn' || e.target.closest('#add-venue-btn')) {
        showVenueModal();
        return;
      }

      /* Edit venue */
      const editBtn = e.target.closest('.venue-edit-btn');
      if (editBtn) {
        const venueId = editBtn.dataset.id;
        const venue = D().getVenues().find(v => v.id === venueId);
        if (venue) showVenueModal(venue);
        return;
      }

      /* Delete venue */
      const delBtn = e.target.closest('.venue-delete-btn');
      if (delBtn) {
        const venueId = delBtn.dataset.id;
        if (U().confirmDialog) {
          U().confirmDialog('Are you sure you want to delete this venue?').then(ok => {
            if (ok) {
              D().deleteVenue(venueId);
              refreshContent();
              U().showToast('Venue deleted', 'success');
            }
          });
        } else {
          if (confirm('Delete this venue?')) {
            D().deleteVenue(venueId);
            refreshContent();
          }
        }
        return;
      }

      /* Editable points/NRR cells */
      const ptsCell = e.target.closest('.pts-cell');
      if (ptsCell) {
        makeEditable(ptsCell, 'pts');
        return;
      }
      const nrrCell = e.target.closest('.nrr-cell');
      if (nrrCell) {
        makeEditable(nrrCell, 'nrr');
        return;
      }
    });

    /* Form submission */
    container.addEventListener('submit', function (e) {
      if (e.target.id === 'tournament-settings-form') {
        e.preventDefault();
        saveSettings();
      }
    });

    /* Toggle switches visual feedback */
    container.addEventListener('change', function (e) {
      if (e.target.type === 'checkbox' && e.target.closest('.toggle-switch')) {
        const slider = e.target.nextElementSibling;
        if (slider) {
          const dot = slider.querySelector('span');
          if (dot) {
            if (e.target.checked) {
              dot.style.transform = 'translateX(22px)';
              dot.style.background = 'var(--accent-green)';
            } else {
              dot.style.transform = 'translateX(0)';
              dot.style.background = 'var(--text-secondary)';
            }
          }
        }
      }
    });
  }

  function makeEditable(cell, type) {
    if (cell.querySelector('input')) return;
    const currentVal = cell.textContent.trim();
    const teamId = cell.dataset.teamId;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = type === 'nrr' ? '0.001' : '1';
    input.value = parseFloat(currentVal);
    input.className = 'form-input';
    input.style.cssText = 'width:70px;padding:2px 6px;font-size:0.85rem;text-align:center;';
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    function finishEdit() {
      const val = parseFloat(input.value) || 0;
      /* Store override in localStorage */
      const overrides = JSON.parse(localStorage.getItem('crickdesk_points_overrides') || '{}');
      if (!overrides[teamId]) overrides[teamId] = {};
      overrides[teamId][type] = val;
      localStorage.setItem('crickdesk_points_overrides', JSON.stringify(overrides));
      refreshContent();
      U().showToast(`${type.toUpperCase()} updated for team`, 'success');
    }

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
      if (e.key === 'Escape') refreshContent();
    });
  }

  function saveSettings() {
    const t = D().getTournament();
    t.name = document.getElementById('ts-name')?.value?.trim() || t.name;
    t.startDate = document.getElementById('ts-start')?.value || t.startDate;
    t.endDate = document.getElementById('ts-end')?.value || t.endDate;
    t.format = document.getElementById('ts-format')?.value || t.format;
    t.oversPerMatch = parseInt(document.getElementById('ts-overs')?.value) || 6;
    t.ballsPerOver = parseInt(document.getElementById('ts-bpo')?.value) || 6;
    t.playersPerTeam = parseInt(document.getElementById('ts-ppt')?.value) || 8;
    t.lastManStands = document.getElementById('ts-lms')?.checked || false;
    t.widesEnabled = document.getElementById('ts-wides')?.checked !== false;
    t.noBallsEnabled = document.getElementById('ts-nb')?.checked !== false;
    t.bonusRunsEnabled = document.getElementById('ts-bonus')?.checked || false;
    t.pointsSystem = {
      win: parseInt(document.getElementById('ts-pts-win')?.value) || 2,
      loss: parseInt(document.getElementById('ts-pts-loss')?.value) || 0,
      tie: parseInt(document.getElementById('ts-pts-tie')?.value) || 1,
      nr: parseInt(document.getElementById('ts-pts-nr')?.value) || 1,
      bonus: parseInt(document.getElementById('ts-pts-bonus')?.value) || 1
    };
    t.mvpWeights = {
      runs: parseFloat(document.getElementById('ts-mvp-runs')?.value) || 1,
      wickets: parseInt(document.getElementById('ts-mvp-wickets')?.value) || 25,
      catches: parseInt(document.getElementById('ts-mvp-catches')?.value) || 10,
      runOuts: parseInt(document.getElementById('ts-mvp-runouts')?.value) || 10,
      momAward: parseInt(document.getElementById('ts-mvp-mom')?.value) || 25
    };
    D().saveTournament(t);
    U().showToast('Tournament settings saved!', 'success');
  }

  /* ─── Auto-Generate Fixtures ─── */
  function generateFixtures() {
    const teams = D().getTeams();
    if (teams.length < 2) {
      U().showToast('Need at least 2 teams to generate fixtures', 'error');
      return;
    }

    const existingMatches = D().getMatches();
    if (existingMatches.length > 0) {
      if (U().confirmDialog) {
        U().confirmDialog('This will delete all existing fixtures and generate new ones. Continue?').then(ok => {
          if (ok) doGenerateFixtures(teams);
        });
      } else {
        if (confirm('This will delete existing fixtures. Continue?')) doGenerateFixtures(teams);
      }
    } else {
      doGenerateFixtures(teams);
    }
  }

  function doGenerateFixtures(teams) {
    const t = D().getTournament();
    const venues = D().getVenues();
    const startDate = t.startDate ? new Date(t.startDate) : new Date();
    const overs = t.oversPerMatch || 6;

    /* Clear existing matches */
    const existing = D().getMatches();
    existing.forEach(m => D().deleteMatch(m.id));

    /* Round-robin: N*(N-1)/2 matches */
    const matchups = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matchups.push([teams[i].id, teams[j].id]);
      }
    }

    /* Shuffle for variety */
    for (let i = matchups.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [matchups[i], matchups[j]] = [matchups[j], matchups[i]];
    }

    /* Distribute 2 matches per day */
    const matchesPerDay = 2;
    let dayOffset = 0;
    let matchIdx = 0;

    matchups.forEach((pair, idx) => {
      if (idx > 0 && idx % matchesPerDay === 0) dayOffset++;
      const matchDate = new Date(startDate);
      matchDate.setDate(matchDate.getDate() + dayOffset);

      const timeSlot = (idx % matchesPerDay === 0) ? 'T10:00:00' : 'T14:00:00';
      const venue = venues.length ? venues[idx % venues.length].name : 'Main Ground';

      const match = {
        id: U().generateId(),
        team1Id: pair[0],
        team2Id: pair[1],
        date: matchDate.toISOString().split('T')[0] + timeSlot,
        venue: venue,
        overs: overs,
        status: 'upcoming',
        tossWonBy: null,
        tossDecision: null,
        result: null,
        manOfMatch: null,
        commentary: [],
        innings: [],
        stage: 'group'
      };
      D().saveMatch(match);
    });

    U().showToast(`Generated ${matchups.length} fixtures!`, 'success');
    refreshContent();
  }

  function generateKnockout() {
    const rows = buildPointsTable();
    const qualifyCount = Math.min(4, rows.length);
    if (qualifyCount < 4) {
      U().showToast('Need at least 4 teams for knockout stage', 'error');
      return;
    }

    const t = D().getTournament();
    const venues = D().getVenues();
    const overs = t.oversPerMatch || 6;
    const baseDate = t.endDate ? new Date(t.endDate) : new Date();
    baseDate.setDate(baseDate.getDate() - 2);

    const qualified = rows.slice(0, 4).map(r => r.team);

    /* SF1: 1st vs 4th */
    const sf1 = {
      id: U().generateId(),
      team1Id: qualified[0].id,
      team2Id: qualified[3].id,
      date: new Date(baseDate).toISOString().split('T')[0] + 'T10:00:00',
      venue: venues.length ? venues[0].name : 'Main Ground',
      overs, status: 'upcoming', tossWonBy: null, tossDecision: null,
      result: null, manOfMatch: null, commentary: [], innings: [],
      stage: 'semifinal'
    };

    /* SF2: 2nd vs 3rd */
    const sf2 = {
      id: U().generateId(),
      team1Id: qualified[1].id,
      team2Id: qualified[2].id,
      date: new Date(baseDate).toISOString().split('T')[0] + 'T14:00:00',
      venue: venues.length > 1 ? venues[1].name : (venues.length ? venues[0].name : 'Main Ground'),
      overs, status: 'upcoming', tossWonBy: null, tossDecision: null,
      result: null, manOfMatch: null, commentary: [], innings: [],
      stage: 'semifinal'
    };

    /* Final */
    const finalDate = new Date(baseDate);
    finalDate.setDate(finalDate.getDate() + 2);
    const finalMatch = {
      id: U().generateId(),
      team1Id: null, team2Id: null,
      date: finalDate.toISOString().split('T')[0] + 'T14:00:00',
      venue: venues.length ? venues[0].name : 'Main Ground',
      overs, status: 'upcoming', tossWonBy: null, tossDecision: null,
      result: null, manOfMatch: null, commentary: [], innings: [],
      stage: 'final'
    };

    D().saveMatch(sf1);
    D().saveMatch(sf2);
    D().saveMatch(finalMatch);

    U().showToast('Knockout bracket generated!', 'success');
    refreshContent();
  }

  /* ─── Venue Modal ─── */
  function showVenueModal(venue) {
    const isEdit = !!venue;
    const modalHtml = `
        <div class="modal" style="max-width:440px;width:90%;">
          <div class="modal-header">
            <h3 style="margin:0;color:var(--text-primary);font-family:var(--font-heading);">${isEdit ? 'Edit' : 'Add'} Venue</h3>
            <button class="modal-close btn btn-ghost btn-icon" id="venue-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="venue-name">Venue Name</label>
              <input class="form-input" type="text" id="venue-name" value="${isEdit ? venue.name : ''}" placeholder="e.g. Office Terrace Ground" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="venue-location">Location</label>
              <input class="form-input" type="text" id="venue-location" value="${isEdit ? (venue.location || '') : ''}" placeholder="e.g. Building A, 5th Floor">
            </div>
          </div>
          <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-secondary" id="venue-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="venue-modal-save" data-venue-id="${isEdit ? venue.id : ''}">${isEdit ? 'Update' : 'Add'} Venue</button>
          </div>
        </div>`;

    if (U().showModal) {
      U().showModal(modalHtml);
    } else {
      const mc = document.getElementById('modal-container');
      if (mc) mc.innerHTML = modalHtml;
    }

    /* Attach modal events */
    setTimeout(() => {
      const closeBtn = document.getElementById('venue-modal-close');
      const cancelBtn = document.getElementById('venue-modal-cancel');
      const saveBtn = document.getElementById('venue-modal-save');

      function closeVenueModal() {
        if (U().closeModal) { U().closeModal(); }
        else { const mc = document.getElementById('modal-container'); if (mc) mc.innerHTML = ''; }
      }

      if (closeBtn) closeBtn.addEventListener('click', closeVenueModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeVenueModal);

      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          const name = document.getElementById('venue-name')?.value?.trim();
          const location = document.getElementById('venue-location')?.value?.trim();
          if (!name) { U().showToast('Venue name is required', 'error'); return; }

          const venueId = saveBtn.dataset.venueId;
          const venueObj = {
            id: venueId || U().generateId(),
            name,
            location: location || ''
          };
          D().saveVenue(venueObj);
          closeVenueModal();
          refreshContent();
          U().showToast(`Venue ${venueId ? 'updated' : 'added'}!`, 'success');
        });
      }
    }, 50);
  }

  /* ─── Refresh ─── */
  function refreshContent() {
    const tabContent = document.getElementById('tournament-tab-content');
    if (tabContent) tabContent.innerHTML = renderTabContent();

    /* Update tab active states */
    const tabs = document.querySelectorAll('#tournament-tabs .tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === activeTab);
    });
  }

  /* ────── Public API ────── */
  return {
    init() {
      const container = document.getElementById('page-tournament');
      if (!container) return;
      container.innerHTML = render();
      attachEvents();
    },
    render,
    attachEvents,
    refresh: refreshContent
  };
})();
