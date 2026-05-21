/* ===== CrickDesk — Fixtures Module ===== */
window.Fixtures = (function () {
  'use strict';

  let activeView = 'list';
  let activeFilter = 'all';
  let calendarMonth = new Date().getMonth();
  let calendarYear = new Date().getFullYear();
  let detailMatchId = null;
  let detailInningsTab = 0;

  const D = () => window.CrickDeskData;
  const U = () => window.CrickDeskUtils;

  /* ─────── Helpers ─────── */
  function getFilteredMatches() {
    let matches = D().getMatches();
    if (activeFilter !== 'all') {
      matches = matches.filter(m => m.status === activeFilter);
    }
    matches.sort((a, b) => new Date(a.date) - new Date(b.date));
    return matches;
  }

  function groupByDate(matches) {
    const groups = {};
    matches.forEach(m => {
      const day = m.date ? m.date.split('T')[0] : 'Unknown';
      if (!groups[day]) groups[day] = [];
      groups[day].push(m);
    });
    return groups;
  }

  function formatScore(innings) {
    if (!innings) return '';
    const bpo = D().getTournament().ballsPerOver || 6;
    const overs = U().formatOvers ? U().formatOvers(innings.totalBalls || 0, bpo) : Math.floor((innings.totalBalls || 0) / bpo) + '.' + ((innings.totalBalls || 0) % bpo);
    return `${innings.totalRuns || 0}/${innings.totalWickets || 0} (${overs} ov)`;
  }

  function getTeamScore(match, teamId) {
    if (!match.innings || !match.innings.length) return null;
    const inn = match.innings.find(i => i.battingTeamId === teamId);
    return inn || null;
  }

  function statusBadgeHtml(status) {
    if (U().getStatusBadge) return U().getStatusBadge(status);
    const colors = { live: 'green', upcoming: 'blue', completed: 'purple', abandoned: 'red', 'no-result': 'amber', tied: 'amber' };
    const color = colors[status] || 'blue';
    const pulse = status === 'live' ? 'animation:pulse 2s infinite;' : '';
    return `<span class="badge badge-${color}" style="${pulse}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
  }

  /* ─────── Main Render ─────── */
  function render() {
    if (detailMatchId) return renderMatchDetail();

    return `
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
        <div>
          <h1 class="page-title" style="font-family:var(--font-heading);font-size:1.75rem;font-weight:700;color:var(--text-primary);margin:0;">Fixtures & Results</h1>
          <p class="page-subtitle" style="color:var(--text-secondary);margin:4px 0 0;font-size:0.9rem;">View all matches, scores, and detailed scorecards</p>
        </div>
        <button class="btn btn-primary" id="add-match-btn">+ Add Match</button>
      </div>
      <div class="page-content">
        <!-- View Toggle -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div class="tab-group" id="fixtures-view-tabs">
            <button class="tab${activeView === 'list' ? ' active' : ''}" data-view="list">📋 List View</button>
            <button class="tab${activeView === 'calendar' ? ' active' : ''}" data-view="calendar">📅 Calendar View</button>
          </div>
          <!-- Status Filter Chips -->
          <div id="fixtures-filter-chips" style="display:flex;gap:8px;flex-wrap:wrap;">
            ${['all', 'upcoming', 'live', 'completed', 'abandoned'].map(f =>
              `<button class="chip${activeFilter === f ? ' active' : ''}" data-filter="${f}" style="padding:6px 14px;border-radius:20px;border:1px solid ${activeFilter === f ? 'var(--accent-green)' : 'var(--border-color)'};background:${activeFilter === f ? 'rgba(16,185,129,0.15)' : 'transparent'};color:${activeFilter === f ? 'var(--accent-green)' : 'var(--text-secondary)'};cursor:pointer;font-size:0.8rem;transition:all .2s;">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
            ).join('')}
          </div>
        </div>
        <div id="fixtures-content">
          ${activeView === 'list' ? renderListView() : renderCalendarView()}
        </div>
      </div>`;
  }

  /* ─────── List View ─────── */
  function renderListView() {
    const matches = getFilteredMatches();
    if (!matches.length) {
      return `<div class="empty-state" style="text-align:center;padding:60px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">📅</div>
        <h3 style="color:var(--text-primary);margin:0 0 8px;">No Matches Found</h3>
        <p style="color:var(--text-secondary);margin:0 0 20px;">${activeFilter !== 'all' ? 'No ' + activeFilter + ' matches.' : 'Create your first match to get started.'}</p>
        <button class="btn btn-primary" id="add-match-empty-btn">+ Add Match</button>
      </div>`;
    }

    const grouped = groupByDate(matches);
    let html = '';

    Object.keys(grouped).sort().forEach(dateStr => {
      const displayDate = U().formatDate ? U().formatDate(dateStr) : new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      html += `<div style="margin-bottom:24px;">
        <h3 style="color:var(--text-secondary);font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;padding-left:4px;">${displayDate}</h3>
        <div style="display:flex;flex-direction:column;gap:12px;">`;

      grouped[dateStr].forEach(match => {
        html += renderMatchCard(match);
      });

      html += `</div></div>`;
    });

    return html;
  }

  function renderMatchCard(match) {
    const t1 = D().getTeam(match.team1Id);
    const t2 = D().getTeam(match.team2Id);
    const t1Name = t1 ? t1.name : 'TBD';
    const t2Name = t2 ? t2.name : 'TBD';
    const t1Color = t1 ? (t1.color || 'var(--accent-blue)') : 'var(--accent-blue)';
    const t2Color = t2 ? (t2.color || 'var(--accent-purple)') : 'var(--accent-purple)';
    const t1Short = t1 ? (t1.shortName || t1.name.substring(0, 3)).toUpperCase() : 'TBD';
    const t2Short = t2 ? (t2.shortName || t2.name.substring(0, 3)).toUpperCase() : 'TBD';

    const inn1 = getTeamScore(match, match.team1Id);
    const inn2 = getTeamScore(match, match.team2Id);
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'live';
    const isUpcoming = match.status === 'upcoming';

    const time = match.date && match.date.includes('T')
      ? new Date(match.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '';

    const mom = match.manOfMatch ? D().getPlayer(match.manOfMatch) : null;

    return `
    <div class="card glass match-card" data-match-id="${match.id}" style="padding:20px;cursor:${isCompleted ? 'pointer' : 'default'};transition:all .2s;border:1px solid var(--glass-border);${isLive ? 'border-left:3px solid var(--accent-green);' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        ${statusBadgeHtml(match.status)}
        <div style="display:flex;align-items:center;gap:8px;">
          ${match.venue ? `<span style="color:var(--text-muted);font-size:0.8rem;">📍 ${match.venue}</span>` : ''}
          ${time ? `<span style="color:var(--text-muted);font-size:0.8rem;">🕐 ${time}</span>` : ''}
        </div>
      </div>

      <!-- Teams Row -->
      <div style="display:flex;align-items:center;justify-content:center;gap:20px;padding:8px 0;">
        <!-- Team 1 -->
        <div style="display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end;">
          <div style="text-align:right;">
            <div style="font-weight:600;color:var(--text-primary);font-size:1rem;">${t1Name}</div>
            ${inn1 ? `<div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-top:2px;">${formatScore(inn1)}</div>` : ''}
          </div>
          <div class="avatar" style="width:44px;height:44px;border-radius:50%;background:${t1Color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.8rem;flex-shrink:0;">${t1Short}</div>
        </div>

        <div style="color:var(--text-muted);font-weight:700;font-size:0.9rem;padding:0 4px;">VS</div>

        <!-- Team 2 -->
        <div style="display:flex;align-items:center;gap:12px;flex:1;">
          <div class="avatar" style="width:44px;height:44px;border-radius:50%;background:${t2Color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.8rem;flex-shrink:0;">${t2Short}</div>
          <div>
            <div style="font-weight:600;color:var(--text-primary);font-size:1rem;">${t2Name}</div>
            ${inn2 ? `<div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-top:2px;">${formatScore(inn2)}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color);flex-wrap:wrap;gap:8px;">
        <div style="display:flex;flex-direction:column;gap:2px;">
          ${match.result ? `<span style="color:var(--accent-green);font-size:0.85rem;font-weight:500;">${match.result}</span>` : ''}
          ${mom ? `<span style="color:var(--accent-amber);font-size:0.8rem;">⭐ ${mom.name}</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;">
          ${isUpcoming ? `<button class="btn btn-primary btn-sm score-match-btn" data-match-id="${match.id}">🎯 Score Match</button>` : ''}
          ${isLive ? `<button class="btn btn-primary btn-sm score-match-btn" data-match-id="${match.id}">▶️ Resume</button>` : ''}
          ${isCompleted ? `<button class="btn btn-secondary btn-sm view-scorecard-btn" data-match-id="${match.id}">📊 Scorecard</button>` : ''}
          <button class="btn btn-ghost btn-sm btn-icon share-match-btn" data-match-id="${match.id}" title="Share">📤</button>
          ${isUpcoming ? `<button class="btn btn-ghost btn-sm btn-icon delete-match-btn" data-match-id="${match.id}" title="Delete" style="color:var(--accent-red);">🗑️</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* ─────── Calendar View ─────── */
  function renderCalendarView() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    /* Get matches for this month */
    const allMatches = D().getMatches();
    const monthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const matchesByDay = {};
    allMatches.forEach(m => {
      if (m.date && m.date.startsWith(monthKey)) {
        const day = parseInt(m.date.split('T')[0].split('-')[2]);
        if (!matchesByDay[day]) matchesByDay[day] = [];
        matchesByDay[day].push(m);
      }
    });

    let html = `
    <div class="card glass" style="padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <button class="btn btn-ghost btn-icon" id="cal-prev-month">◀</button>
        <h3 style="color:var(--text-primary);font-family:var(--font-heading);margin:0;">${monthNames[calendarMonth]} ${calendarYear}</h3>
        <button class="btn btn-ghost btn-icon" id="cal-next-month">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">`;

    /* Day headers */
    dayNames.forEach(d => {
      html += `<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.75rem;font-weight:600;text-transform:uppercase;">${d}</div>`;
    });

    /* Empty cells for padding */
    for (let i = 0; i < startPad; i++) {
      html += `<div style="padding:8px;min-height:70px;"></div>`;
    }

    /* Day cells */
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === today.getDate() && calendarMonth === today.getMonth() && calendarYear === today.getFullYear();
      const dayMatches = matchesByDay[day] || [];
      const hasMatches = dayMatches.length > 0;

      html += `
        <div class="cal-day${hasMatches ? ' cal-day-has-match' : ''}" data-cal-day="${day}" style="padding:8px;min-height:70px;border-radius:var(--radius-sm);border:1px solid ${isToday ? 'var(--accent-green)' : 'var(--border-color)'};background:${isToday ? 'rgba(16,185,129,0.05)' : 'transparent'};cursor:${hasMatches ? 'pointer' : 'default'};transition:all .2s;">
          <div style="font-size:0.85rem;font-weight:${isToday ? '700' : '500'};color:${isToday ? 'var(--accent-green)' : 'var(--text-primary)'};margin-bottom:4px;">${day}</div>
          ${dayMatches.length ? `<div style="display:flex;flex-wrap:wrap;gap:3px;">
            ${dayMatches.map(m => {
              const dotColor = m.status === 'completed' ? 'var(--accent-purple)' : m.status === 'live' ? 'var(--accent-green)' : m.status === 'upcoming' ? 'var(--accent-blue)' : 'var(--accent-red)';
              return `<span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;" title="${m.status}"></span>`;
            }).join('')}
          </div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">${dayMatches.length} match${dayMatches.length > 1 ? 'es' : ''}</div>` : ''}
        </div>`;
    }

    html += `</div></div>`;

    /* Calendar day detail popup */
    html += `<div id="cal-day-detail" style="display:none;margin-top:16px;"></div>`;
    return html;
  }

  function showCalendarDayDetail(day) {
    const monthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    const allMatches = D().getMatches();
    const dayMatches = allMatches.filter(m => m.date && m.date.startsWith(dayKey));

    const container = document.getElementById('cal-day-detail');
    if (!container) return;

    if (!dayMatches.length) {
      container.style.display = 'none';
      return;
    }

    const displayDate = U().formatDate ? U().formatDate(dayKey) : new Date(dayKey).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    container.style.display = 'block';
    container.innerHTML = `
      <div class="card glass" style="padding:20px;">
        <h4 style="color:var(--text-primary);margin:0 0 16px;font-family:var(--font-heading);">📅 ${displayDate}</h4>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${dayMatches.map(m => renderMatchCard(m)).join('')}
        </div>
      </div>`;
  }

  /* ─────── Match Detail View ─────── */
  function renderMatchDetail() {
    const match = D().getMatch(detailMatchId);
    if (!match) {
      detailMatchId = null;
      return render();
    }

    const t1 = D().getTeam(match.team1Id);
    const t2 = D().getTeam(match.team2Id);
    const t1Name = t1 ? t1.name : 'TBD';
    const t2Name = t2 ? t2.name : 'TBD';
    const mom = match.manOfMatch ? D().getPlayer(match.manOfMatch) : null;
    const innings = match.innings || [];
    const bpo = D().getTournament().ballsPerOver || 6;

    let tossText = '';
    if (match.tossWonBy) {
      const tossTeam = D().getTeam(match.tossWonBy);
      tossText = tossTeam ? `${tossTeam.name} won the toss and chose to ${match.tossDecision || 'bat'}` : '';
    }

    return `
    <div class="page-header">
      <button class="btn btn-ghost" id="fixtures-back-btn" style="margin-bottom:12px;">← Back to Fixtures</button>
    </div>
    <div class="page-content">
      <!-- Match Header Card -->
      <div class="card glass glow" style="padding:24px;margin-bottom:24px;text-align:center;">
        <div style="display:flex;align-items:center;justify-content:center;gap:32px;flex-wrap:wrap;">
          <div style="text-align:center;">
            <div class="avatar avatar-lg" style="width:56px;height:56px;border-radius:50%;background:${t1?.color || 'var(--accent-blue)'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;margin:0 auto 8px;">${(t1?.shortName || 'T1').toUpperCase()}</div>
            <div style="font-weight:600;color:var(--text-primary);font-size:1.1rem;">${t1Name}</div>
            ${innings[0] ? `<div style="font-size:1.4rem;font-weight:700;color:var(--text-primary);margin-top:4px;">${formatScore(innings.find(i => i.battingTeamId === match.team1Id))}</div>` : ''}
          </div>
          <div style="font-size:1.2rem;color:var(--text-muted);font-weight:700;">VS</div>
          <div style="text-align:center;">
            <div class="avatar avatar-lg" style="width:56px;height:56px;border-radius:50%;background:${t2?.color || 'var(--accent-purple)'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;margin:0 auto 8px;">${(t2?.shortName || 'T2').toUpperCase()}</div>
            <div style="font-weight:600;color:var(--text-primary);font-size:1.1rem;">${t2Name}</div>
            ${innings[1] ? `<div style="font-size:1.4rem;font-weight:700;color:var(--text-primary);margin-top:4px;">${formatScore(innings.find(i => i.battingTeamId === match.team2Id))}</div>` : ''}
          </div>
        </div>

        ${match.result ? `<div style="margin-top:16px;padding:10px 20px;background:rgba(16,185,129,0.1);border-radius:var(--radius-md);display:inline-block;"><span style="color:var(--accent-green);font-weight:600;font-size:0.95rem;">${match.result}</span></div>` : ''}

        <div style="display:flex;justify-content:center;gap:24px;margin-top:16px;flex-wrap:wrap;">
          ${match.venue ? `<span style="color:var(--text-secondary);font-size:0.85rem;">📍 ${match.venue}</span>` : ''}
          ${match.date ? `<span style="color:var(--text-secondary);font-size:0.85rem;">📅 ${U().formatDate ? U().formatDate(match.date.split('T')[0]) : match.date.split('T')[0]}</span>` : ''}
          ${tossText ? `<span style="color:var(--text-secondary);font-size:0.85rem;">🪙 ${tossText}</span>` : ''}
          ${mom ? `<span style="color:var(--accent-amber);font-size:0.85rem;">⭐ MoM: ${mom.name}</span>` : ''}
        </div>
      </div>

      <!-- Innings Tabs -->
      ${innings.length ? `
      <div class="tab-group" id="innings-tabs" style="margin-bottom:20px;">
        ${innings.map((inn, idx) => {
          const battingTeam = D().getTeam(inn.battingTeamId);
          const label = battingTeam ? battingTeam.name + ' Innings' : 'Innings ' + (idx + 1);
          return `<button class="tab${detailInningsTab === idx ? ' active' : ''}" data-innings-idx="${idx}">${label}</button>`;
        }).join('')}
        <button class="tab${detailInningsTab === -1 ? ' active' : ''}" data-innings-idx="-1">Summary</button>
      </div>
      <div id="innings-tab-content">
        ${detailInningsTab === -1 ? renderSummaryTab(match) : renderInningsTab(innings[detailInningsTab], match)}
      </div>` : '<div style="text-align:center;padding:40px;color:var(--text-muted);">No innings data available</div>'}
    </div>`;
  }

  function renderInningsTab(inn, match) {
    if (!inn) return '<div style="color:var(--text-muted);text-align:center;padding:20px;">No data</div>';
    const bpo = D().getTournament().ballsPerOver || 6;

    /* Batting Scorecard */
    let battingHtml = `
    <div class="card glass" style="padding:20px;margin-bottom:20px;">
      <h4 style="color:var(--text-primary);margin:0 0 16px;font-family:var(--font-heading);">🏏 Batting</h4>
      <div class="data-table-responsive" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th style="text-align:left;">Batter</th><th style="text-align:left;">How Out</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
          </thead>
          <tbody>`;

    const batters = inn.battingScorecard || [];
    batters.forEach(b => {
      const player = D().getPlayer(b.playerId);
      const pName = player ? player.name : 'Unknown';
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
      const howOut = b.howOut || 'not out';
      const bowler = b.bowlerId ? D().getPlayer(b.bowlerId) : null;
      const fielder = b.fielderId ? D().getPlayer(b.fielderId) : null;

      let dismissalText = howOut;
      if (howOut === 'not out' || howOut === 'yet to bat') {
        dismissalText = `<span style="color:var(--accent-green);">${howOut}</span>`;
      } else {
        let parts = [howOut];
        if (bowler && howOut !== 'run out') parts.push('b ' + bowler.name);
        if (fielder) parts.push('c ' + fielder.name);
        dismissalText = parts.join(' ');
      }

      const isNotOut = howOut === 'not out';
      battingHtml += `
            <tr style="${isNotOut ? 'font-weight:600;' : ''}">
              <td style="text-align:left;font-weight:500;color:var(--text-primary);">${pName}</td>
              <td style="text-align:left;font-size:0.8rem;color:var(--text-secondary);">${dismissalText}</td>
              <td style="font-weight:700;color:var(--text-primary);">${b.runs}</td>
              <td>${b.balls}</td>
              <td style="color:var(--accent-green);">${b.fours || 0}</td>
              <td style="color:var(--accent-amber);">${b.sixes || 0}</td>
              <td style="color:${parseFloat(sr) > 150 ? 'var(--accent-green)' : parseFloat(sr) < 80 ? 'var(--accent-red)' : 'var(--text-secondary)'};">${sr}</td>
            </tr>`;
    });

    /* Extras & Total */
    const extras = inn.extras || {};
    const extrasTotal = (extras.wides || 0) + (extras.noBalls || 0) + (extras.byes || 0) + (extras.legByes || 0);
    const oversStr = U().formatOvers ? U().formatOvers(inn.totalBalls || 0, bpo) : Math.floor((inn.totalBalls || 0) / bpo) + '.' + ((inn.totalBalls || 0) % bpo);

    battingHtml += `
          </tbody>
          <tfoot>
            <tr style="border-top:1px solid var(--border-color);">
              <td style="text-align:left;color:var(--text-secondary);" colspan="2">Extras (w ${extras.wides || 0}, nb ${extras.noBalls || 0}, b ${extras.byes || 0}, lb ${extras.legByes || 0})</td>
              <td style="font-weight:600;" colspan="5">${extrasTotal}</td>
            </tr>
            <tr style="background:rgba(16,185,129,0.05);font-weight:700;">
              <td style="text-align:left;color:var(--text-primary);" colspan="2">Total (${inn.totalWickets || 0} wkts, ${oversStr} ov)</td>
              <td style="color:var(--accent-green);font-size:1.1rem;" colspan="5">${inn.totalRuns || 0}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;

    /* Fall of Wickets */
    const fow = inn.fallOfWickets || [];
    if (fow.length) {
      battingHtml += `
      <div class="card glass" style="padding:16px;margin-bottom:20px;">
        <h4 style="color:var(--text-primary);margin:0 0 12px;font-family:var(--font-heading);font-size:0.9rem;">Fall of Wickets</h4>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${fow.map(f => {
            const player = f.playerId ? D().getPlayer(f.playerId) : null;
            const overStr = U().formatOvers ? U().formatOvers(f.overs || 0, bpo) : f.overs;
            return `<span style="padding:4px 10px;background:var(--bg-input);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-secondary);">${f.wicketNumber}-${f.runs}${player ? ' (' + player.name + ', ' + overStr + ')' : ''}</span>`;
          }).join('')}
        </div>
      </div>`;
    }

    /* Bowling Scorecard */
    battingHtml += `
    <div class="card glass" style="padding:20px;margin-bottom:20px;">
      <h4 style="color:var(--text-primary);margin:0 0 16px;font-family:var(--font-heading);">🎳 Bowling</h4>
      <div class="data-table-responsive" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th style="text-align:left;">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Dots</th><th>Wd</th><th>NB</th></tr>
          </thead>
          <tbody>`;

    const bowlers = inn.bowlingScorecard || [];
    bowlers.forEach(b => {
      const player = D().getPlayer(b.playerId);
      const pName = player ? player.name : 'Unknown';
      const oversStr = U().formatOvers ? U().formatOvers(b.balls || 0, bpo) : (b.overs || '0');
      const econ = (b.balls || 0) > 0 ? U().calculateEconomy ? U().calculateEconomy(b.runs || 0, b.balls || 0, bpo) : ((b.runs || 0) / ((b.balls || 1) / bpo)).toFixed(2) : '0.00';

      battingHtml += `
            <tr>
              <td style="text-align:left;font-weight:500;color:var(--text-primary);">${pName}</td>
              <td>${oversStr}</td>
              <td>${b.maidens || 0}</td>
              <td>${b.runs || 0}</td>
              <td style="font-weight:700;color:${(b.wickets || 0) >= 3 ? 'var(--accent-green)' : 'var(--text-primary)'};">${b.wickets || 0}</td>
              <td style="color:${parseFloat(econ) < 6 ? 'var(--accent-green)' : parseFloat(econ) > 10 ? 'var(--accent-red)' : 'var(--text-secondary)'};">${econ}</td>
              <td>${b.dotBalls || 0}</td>
              <td>${b.wides || 0}</td>
              <td>${b.noBalls || 0}</td>
            </tr>`;
    });

    battingHtml += `</tbody></table></div></div>`;

    /* Partnerships */
    const partnerships = inn.partnerships || [];
    if (partnerships.length) {
      battingHtml += `
      <div class="card glass" style="padding:20px;">
        <h4 style="color:var(--text-primary);margin:0 0 16px;font-family:var(--font-heading);">🤝 Partnerships</h4>
        <div class="data-table-responsive" style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th style="text-align:left;">Partners</th><th>Runs</th><th>Balls</th></tr></thead>
            <tbody>
              ${partnerships.map(p => {
                const b1 = p.bat1Id ? D().getPlayer(p.bat1Id) : null;
                const b2 = p.bat2Id ? D().getPlayer(p.bat2Id) : null;
                return `<tr>
                  <td style="text-align:left;color:var(--text-primary);">${b1 ? b1.name : '?'} & ${b2 ? b2.name : '?'}</td>
                  <td style="font-weight:600;">${p.runs || 0}</td>
                  <td>${p.balls || 0}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    return battingHtml;
  }

  function renderSummaryTab(match) {
    const innings = match.innings || [];
    const bpo = D().getTournament().ballsPerOver || 6;

    let html = '';

    /* Over-by-over dot visualization */
    innings.forEach((inn, innIdx) => {
      const battingTeam = D().getTeam(inn.battingTeamId);
      const balls = inn.balls || [];

      html += `
      <div class="card glass" style="padding:20px;margin-bottom:20px;">
        <h4 style="color:var(--text-primary);margin:0 0 16px;font-family:var(--font-heading);">📊 ${battingTeam ? battingTeam.name : 'Innings ' + (innIdx + 1)} - Ball by Ball</h4>
        <div style="display:flex;flex-wrap:wrap;gap:12px;">`;

      /* Group balls by over */
      const overGroups = {};
      balls.forEach(b => {
        const ov = b.over || 0;
        if (!overGroups[ov]) overGroups[ov] = [];
        overGroups[ov].push(b);
      });

      Object.keys(overGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(ov => {
        const overBalls = overGroups[ov];
        const overRuns = overBalls.reduce((s, b) => s + (b.runs || 0) + (b.extras?.runs || 0), 0);

        html += `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <span style="font-size:0.7rem;color:var(--text-muted);">Ov ${parseInt(ov) + 1}</span>
          <div style="display:flex;gap:3px;">`;

        overBalls.forEach(b => {
          const totalRuns = (b.runs || 0) + (b.extras?.runs || 0);
          const isWicket = !!b.wicket;
          let dotClass = 'dot-' + totalRuns;
          if (isWicket) dotClass = 'dot-W';
          if (totalRuns === 0 && !isWicket) dotClass = 'dot-0';

          const dotColorMap = {
            'dot-0': 'var(--text-muted)', 'dot-1': 'var(--text-primary)', 'dot-2': 'var(--accent-blue)',
            'dot-3': 'var(--accent-blue)', 'dot-4': 'var(--accent-green)', 'dot-6': 'var(--accent-amber)',
            'dot-W': 'var(--accent-red)', 'dot-w': 'var(--accent-red)'
          };
          const color = dotColorMap[dotClass] || 'var(--text-primary)';
          const label = isWicket ? 'W' : (b.extras?.type === 'wide' ? 'Wd' : (b.extras?.type === 'noBall' ? 'NB' : totalRuns));

          html += `<span class="score-dot ${dotClass}" style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;background:${isWicket ? 'var(--accent-red)' : 'var(--bg-input)'};color:${isWicket ? '#fff' : color};border:1px solid ${color}30;">${label}</span>`;
        });

        html += `</div>
          <span style="font-size:0.7rem;color:var(--text-secondary);font-weight:600;">${overRuns} runs</span>
        </div>`;
      });

      html += `</div></div>`;
    });

    /* Run Rate Graph */
    if (innings.length) {
      html += `
      <div class="card glass" style="padding:20px;">
        <h4 style="color:var(--text-primary);margin:0 0 16px;font-family:var(--font-heading);">📈 Run Rate Comparison</h4>
        <canvas id="run-rate-canvas" width="700" height="300" style="width:100%;max-height:300px;"></canvas>
      </div>`;
    }

    return html;
  }

  function drawRunRateChart(match) {
    const canvas = document.getElementById('run-rate-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const bpo = D().getTournament().ballsPerOver || 6;
    const innings = match.innings || [];
    if (!innings.length) return;

    ctx.clearRect(0, 0, W, H);
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    /* Compute cumulative runs per over for each innings */
    const datasets = [];
    const colors = ['#10b981', '#3b82f6'];
    let maxRuns = 0;
    let maxOvers = 0;

    innings.forEach((inn, innIdx) => {
      const balls = inn.balls || [];
      const overRuns = {};
      balls.forEach(b => {
        const ov = b.over || 0;
        if (!overRuns[ov]) overRuns[ov] = 0;
        overRuns[ov] += (b.runs || 0) + (b.extras?.runs || 0);
      });

      let cumulative = 0;
      const points = [{ over: 0, runs: 0 }];
      const maxOver = Math.max(...Object.keys(overRuns).map(Number), 0);
      for (let o = 0; o <= maxOver; o++) {
        cumulative += overRuns[o] || 0;
        points.push({ over: o + 1, runs: cumulative });
      }
      if (cumulative > maxRuns) maxRuns = cumulative;
      if (maxOver + 1 > maxOvers) maxOvers = maxOver + 1;
      datasets.push(points);
    });

    if (maxRuns === 0) maxRuns = 10;
    if (maxOvers === 0) maxOvers = 1;

    /* Draw grid */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartH / 5) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(W - padding.right, y); ctx.stroke();
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxRuns - (maxRuns / 5) * i), padding.left - 8, y + 4);
    }

    /* X axis labels */
    ctx.textAlign = 'center';
    for (let o = 0; o <= maxOvers; o++) {
      const x = padding.left + (chartW / maxOvers) * o;
      ctx.fillStyle = '#6b7280';
      ctx.fillText(o, x, H - padding.bottom + 20);
    }
    ctx.fillText('Overs', W / 2, H - 5);

    /* Draw lines */
    datasets.forEach((points, idx) => {
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = padding.left + (chartW / maxOvers) * p.over;
        const y = padding.top + chartH - (chartH / maxRuns) * p.runs;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      /* Draw dots */
      points.forEach(p => {
        const x = padding.left + (chartW / maxOvers) * p.over;
        const y = padding.top + chartH - (chartH / maxRuns) * p.runs;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fill();
      });
    });

    /* Legend */
    innings.forEach((inn, idx) => {
      const team = D().getTeam(inn.battingTeamId);
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(padding.left + idx * 140, 8, 14, 14);
      ctx.fillStyle = '#f9fafb';
      ctx.font = '12px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(team ? team.name : 'Innings ' + (idx + 1), padding.left + idx * 140 + 20, 19);
    });
  }

  /* ─────── Add Match Modal ─────── */
  function showAddMatchModal() {
    const teams = D().getTeams();
    const venues = D().getVenues();
    const t = D().getTournament();

    if (teams.length < 2) {
      U().showToast('Need at least 2 teams to create a match', 'error');
      return;
    }

    const teamOptions = teams.map(tm => `<option value="${tm.id}">${tm.name}</option>`).join('');
    const venueOptions = venues.map(v => `<option value="${v.name}">${v.name}</option>`).join('');

    const modalHtml = `
        <div class="modal" style="max-width:500px;width:90%;">
          <div class="modal-header">
            <h3 style="margin:0;color:var(--text-primary);font-family:var(--font-heading);">Add Match</h3>
            <button class="modal-close btn btn-ghost btn-icon" id="add-match-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="form-group">
                <label class="form-label" for="match-team1">Team 1</label>
                <select class="form-select" id="match-team1">${teamOptions}</select>
              </div>
              <div class="form-group">
                <label class="form-label" for="match-team2">Team 2</label>
                <select class="form-select" id="match-team2">${teams.length > 1 ? teams.slice(1).map(tm => `<option value="${tm.id}">${tm.name}</option>`).join('') + teams.slice(0, 1).map(tm => `<option value="${tm.id}">${tm.name}</option>`).join('') : teamOptions}</select>
              </div>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="form-group">
                <label class="form-label" for="match-date">Date</label>
                <input class="form-input" type="date" id="match-date" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label class="form-label" for="match-time">Time</label>
                <input class="form-input" type="time" id="match-time" value="10:00">
              </div>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="form-group">
                <label class="form-label" for="match-venue">Venue</label>
                <select class="form-select" id="match-venue">
                  <option value="">-- Select Venue --</option>
                  ${venueOptions}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="match-overs">Overs</label>
                <input class="form-input" type="number" id="match-overs" value="${t.oversPerMatch || 6}" min="1" max="50">
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-secondary" id="add-match-cancel">Cancel</button>
            <button class="btn btn-primary" id="add-match-save">Create Match</button>
          </div>
        </div>`;

    if (U().showModal) { U().showModal(modalHtml); }
    else { const mc = document.getElementById('modal-container'); if (mc) mc.innerHTML = modalHtml; }

    setTimeout(() => {
      const closeModal = () => { if (U().closeModal) U().closeModal(); else { const mc = document.getElementById('modal-container'); if (mc) mc.innerHTML = ''; } };

      document.getElementById('add-match-modal-close')?.addEventListener('click', closeModal);
      document.getElementById('add-match-cancel')?.addEventListener('click', closeModal);

      document.getElementById('add-match-save')?.addEventListener('click', () => {
        const team1Id = document.getElementById('match-team1')?.value;
        const team2Id = document.getElementById('match-team2')?.value;
        const date = document.getElementById('match-date')?.value;
        const time = document.getElementById('match-time')?.value || '10:00';
        const venue = document.getElementById('match-venue')?.value || '';
        const overs = parseInt(document.getElementById('match-overs')?.value) || 6;

        if (team1Id === team2Id) {
          U().showToast('Teams must be different!', 'error');
          return;
        }
        if (!date) {
          U().showToast('Please select a date', 'error');
          return;
        }

        const match = {
          id: U().generateId(),
          team1Id, team2Id,
          date: date + 'T' + time + ':00',
          venue, overs,
          status: 'upcoming',
          tossWonBy: null, tossDecision: null,
          result: null, manOfMatch: null,
          commentary: [], innings: []
        };
        D().saveMatch(match);
        closeModal();
        refreshContent();
        U().showToast('Match created!', 'success');
      });
    }, 50);
  }

  /* ─────── Events ─────── */
  function attachEvents() {
    const container = document.getElementById('page-fixtures');
    if (!container || container.dataset.eventsAttached) return;
    container.dataset.eventsAttached = 'true';

    container.addEventListener('click', function (e) {
      /* View tabs */
      const viewTab = e.target.closest('.tab[data-view]');
      if (viewTab && viewTab.closest('#fixtures-view-tabs')) {
        activeView = viewTab.dataset.view;
        refreshContent();
        return;
      }

      /* Filter chips */
      const chip = e.target.closest('.chip[data-filter]');
      if (chip && chip.closest('#fixtures-filter-chips')) {
        activeFilter = chip.dataset.filter;
        refreshContent();
        return;
      }

      /* Add match button */
      if (e.target.id === 'add-match-btn' || e.target.closest('#add-match-btn') || e.target.id === 'add-match-empty-btn') {
        showAddMatchModal();
        return;
      }

      /* Score match button */
      const scoreBtn = e.target.closest('.score-match-btn');
      if (scoreBtn) {
        const matchId = scoreBtn.dataset.matchId;
        if (window.CrickDeskApp) window.CrickDeskApp.navigate('scoring');
        /* Store match ID for scoring module to pick up */
        localStorage.setItem('crickdesk_score_match_id', matchId);
        return;
      }

      /* View scorecard button */
      const scorecardBtn = e.target.closest('.view-scorecard-btn');
      if (scorecardBtn) {
        detailMatchId = scorecardBtn.dataset.matchId;
        detailInningsTab = 0;
        refreshContent();
        return;
      }

      /* Match card click for completed */
      const matchCard = e.target.closest('.match-card');
      if (matchCard && !e.target.closest('.btn')) {
        const matchId = matchCard.dataset.matchId;
        const match = D().getMatch(matchId);
        if (match && match.status === 'completed') {
          detailMatchId = matchId;
          detailInningsTab = 0;
          refreshContent();
          return;
        }
      }

      /* Share button */
      const shareBtn = e.target.closest('.share-match-btn');
      if (shareBtn) {
        const matchId = shareBtn.dataset.matchId;
        const match = D().getMatch(matchId);
        if (match) {
          const text = generateShareText(match);
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => U().showToast('Match details copied to clipboard!', 'success'));
          } else {
            U().showToast('Could not copy to clipboard', 'error');
          }
        }
        return;
      }

      /* Delete match */
      const deleteBtn = e.target.closest('.delete-match-btn');
      if (deleteBtn) {
        const matchId = deleteBtn.dataset.matchId;
        const doDelete = () => {
          D().deleteMatch(matchId);
          refreshContent();
          U().showToast('Match deleted', 'success');
        };
        if (U().confirmDialog) {
          U().confirmDialog('Delete this match?').then(ok => { if (ok) doDelete(); });
        } else {
          if (confirm('Delete this match?')) doDelete();
        }
        return;
      }

      /* Back button from detail */
      if (e.target.id === 'fixtures-back-btn' || e.target.closest('#fixtures-back-btn')) {
        detailMatchId = null;
        detailInningsTab = 0;
        refreshContent();
        return;
      }

      /* Innings tabs */
      const innTab = e.target.closest('.tab[data-innings-idx]');
      if (innTab && innTab.closest('#innings-tabs')) {
        detailInningsTab = parseInt(innTab.dataset.inningsIdx);
        refreshContent();
        return;
      }

      /* Calendar navigation */
      if (e.target.id === 'cal-prev-month' || e.target.closest('#cal-prev-month')) {
        calendarMonth--;
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        refreshContent();
        return;
      }
      if (e.target.id === 'cal-next-month' || e.target.closest('#cal-next-month')) {
        calendarMonth++;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        refreshContent();
        return;
      }

      /* Calendar day click */
      const calDay = e.target.closest('.cal-day-has-match');
      if (calDay) {
        const day = parseInt(calDay.dataset.calDay);
        showCalendarDayDetail(day);
        return;
      }
    });
  }

  function generateShareText(match) {
    const t1 = D().getTeam(match.team1Id);
    const t2 = D().getTeam(match.team2Id);
    const inn1 = getTeamScore(match, match.team1Id);
    const inn2 = getTeamScore(match, match.team2Id);

    let text = `🏏 ${t1?.name || 'Team 1'} vs ${t2?.name || 'Team 2'}\n`;
    if (inn1) text += `${t1?.name}: ${formatScore(inn1)}\n`;
    if (inn2) text += `${t2?.name}: ${formatScore(inn2)}\n`;
    if (match.result) text += `\n🏆 ${match.result}\n`;
    if (match.venue) text += `📍 ${match.venue}\n`;
    text += `\n— CrickDesk`;
    return text;
  }

  function refreshContent() {
    const container = document.getElementById('page-fixtures');
    if (!container) return;
    container.innerHTML = render();
    attachEvents();

    /* Draw run rate chart if in summary view */
    if (detailMatchId && detailInningsTab === -1) {
      const match = D().getMatch(detailMatchId);
      if (match) setTimeout(() => drawRunRateChart(match), 100);
    }
  }

  /* ─────── Public API ─────── */
  return {
    init() {
      const container = document.getElementById('page-fixtures');
      if (!container) return;
      container.innerHTML = render();
      attachEvents();
    },
    render,
    attachEvents,
    refresh: refreshContent,
    showMatchDetail(matchId) {
      detailMatchId = matchId;
      detailInningsTab = 0;
      refreshContent();
    }
  };
})();
