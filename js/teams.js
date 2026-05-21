window.Teams = (function() {
  let state = {
    view: 'grid', // 'grid' | 'detail'
    selectedTeamId: null,
    editingTeamId: null,
    headToHeadOpponentId: ''
  };

  const COLORS = [
    { value: '#ef4444', label: 'Red' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#f59e0b', label: 'Yellow' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#f97316', label: 'Orange' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#10b981', label: 'Green' },
    { value: '#ec4899', label: 'Pink' }
  ];

  function getTeamStats(teamId) {
    const matches = window.CrickDeskData.getMatchesByTeam(teamId).filter(m => m.status === 'completed');
    let p = 0, w = 0, l = 0, t = 0, nr = 0;
    let runsScored = 0, oversFaced = 0;
    let runsConceded = 0, oversBowled = 0;

    matches.forEach(m => {
      p++;
      if (m.result && m.result.winnerId) {
        if (m.result.winnerId === teamId) w++;
        else l++;
      } else if (m.result && m.result.isTie) {
        t++;
      } else {
        nr++;
      }

      // NRR calculation simplified for brevity; in a real scenario we need exact balls
      m.innings.forEach(inn => {
        if (inn.battingTeamId === teamId) {
          runsScored += inn.totalRuns || 0;
          let ov = Math.floor((inn.totalBalls || 0) / 6) + ((inn.totalBalls || 0) % 6) / 6;
          oversFaced += ov;
        } else if (inn.bowlingTeamId === teamId) {
          runsConceded += inn.totalRuns || 0;
          let ov = Math.floor((inn.totalBalls || 0) / 6) + ((inn.totalBalls || 0) % 6) / 6;
          oversBowled += ov;
        }
      });
    });

    let nrr = 0;
    if (oversFaced > 0 && oversBowled > 0) {
      nrr = (runsScored / oversFaced) - (runsConceded / oversBowled);
    }

    return { p, w, l, t, nr, nrr: nrr.toFixed(3) };
  }

  function getHeadToHead(team1Id, team2Id) {
    const matches = window.CrickDeskData.getMatches().filter(m => 
      m.status === 'completed' && 
      ((m.team1Id === team1Id && m.team2Id === team2Id) || (m.team1Id === team2Id && m.team2Id === team1Id))
    );
    let t1w = 0, t2w = 0, d = 0;
    matches.forEach(m => {
      if(m.result?.winnerId === team1Id) t1w++;
      else if(m.result?.winnerId === team2Id) t2w++;
      else d++;
    });
    return { played: matches.length, t1w, t2w, d, matches };
  }

  function renderGrid() {
    const teams = window.CrickDeskData.getTeams() || [];
    
    let html = `
      <div class="page-header">
        <h1 class="section-title">Teams</h1>
        <button class="btn btn-primary" id="btn-add-team">
          ➕ Add Team
        </button>
      </div>
    `;

    if (teams.length === 0) {
      html += `
        <div class="empty-state">
          <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
          <h3>No Teams Yet</h3>
          <p class="text-muted">Get started by adding teams to your tournament.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" id="btn-add-team-empty">Add First Team</button>
        </div>
      `;
      return html;
    }

    html += `<div class="bento-grid grid-3">`;
    teams.forEach(t => {
      const stats = getTeamStats(t.id);
      const players = window.CrickDeskData.getPlayersByTeam(t.id) || [];
      const captain = players.find(p => p.id === t.captainId);
      const capName = captain ? captain.name : 'No Captain';

      html += `
        <div class="card glass hover-lift">
          <div style="height: 6px; background: ${t.color}; width: 100%;"></div>
          <div class="card-body" style="text-align: center; position: relative;">
            <div class="avatar avatar-lg" style="background: ${t.color}; margin: 0 auto 16px; font-size: 24px;">
              ${t.name.charAt(0)}
            </div>
            <h3 style="font-family: var(--font-heading); margin-bottom: 4px;">${t.name}</h3>
            <span class="badge" style="background: var(--bg-tertiary); color: var(--text-secondary); margin-bottom: 12px;">${t.shortName}</span>
            <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
              👑 ${capName}
            </div>
            
            <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 20px;">
              <div style="text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">P</div>
                <div style="font-weight: 600;">${stats.p}</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">W</div>
                <div style="font-weight: 600; color: var(--accent-green);">${stats.w}</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">L</div>
                <div style="font-weight: 600; color: var(--accent-red);">${stats.l}</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">NRR</div>
                <div style="font-weight: 600;">${stats.nrr}</div>
              </div>
            </div>

            <span class="badge badge-blue" style="position: absolute; top: 16px; left: 16px;">${players.length} Players</span>
          </div>
          <div class="card-footer" style="display: flex; justify-content: space-between; gap: 8px;">
            <button class="btn btn-secondary btn-sm flex-1 view-team" data-id="${t.id}">View Details</button>
            <button class="btn btn-ghost btn-icon edit-team" data-id="${t.id}">✏️</button>
            <button class="btn btn-ghost btn-icon delete-team" data-id="${t.id}" style="color: var(--accent-red);">🗑️</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  function renderDetail() {
    const team = window.CrickDeskData.getTeam(state.selectedTeamId);
    if (!team) {
      state.view = 'grid';
      return renderGrid();
    }
    
    const stats = getTeamStats(team.id);
    const players = window.CrickDeskData.getPlayersByTeam(team.id) || [];
    const captain = players.find(p => p.id === team.captainId);
    
    let html = `
      <div class="page-header" style="justify-content: flex-start; gap: 16px;">
        <button class="btn btn-ghost btn-icon" id="btn-back-teams" style="font-size: 20px;">←</button>
        <div class="avatar avatar-sm" style="background: ${team.color};">${team.name.charAt(0)}</div>
        <h1 class="section-title" style="margin: 0;">${team.name} <span class="badge" style="vertical-align: middle;">${team.shortName}</span></h1>
      </div>

      <div class="bento-grid grid-4" style="margin-bottom: 24px;">
        <div class="stat-card card glass">
          <div class="stat-value">${stats.p}</div>
          <div class="stat-label">Matches</div>
        </div>
        <div class="stat-card card glass">
          <div class="stat-value" style="color: var(--accent-green);">${stats.w}</div>
          <div class="stat-label">Wins</div>
        </div>
        <div class="stat-card card glass">
          <div class="stat-value" style="color: var(--accent-red);">${stats.l}</div>
          <div class="stat-label">Losses</div>
        </div>
        <div class="stat-card card glass">
          <div class="stat-value">${stats.nrr}</div>
          <div class="stat-label">Net RR</div>
        </div>
      </div>

      <div class="bento-grid grid-2" style="grid-template-columns: 2fr 1fr;">
        <div class="card">
          <div class="card-header">
            <h3 class="section-title" style="margin:0; font-size: 16px;">Squad (${players.length})</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="data-table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Role</th>
                    <th>Mat</th>
                  </tr>
                </thead>
                <tbody>
                  ${players.length === 0 ? '<tr><td colspan="3" style="text-align:center; padding: 20px;">No players assigned</td></tr>' : ''}
                  ${players.map(p => `
                    <tr>
                      <td style="font-weight: 500;">
                        ${p.name}
                        ${p.id === team.captainId ? ' 👑' : ''}
                      </td>
                      <td>${window.CrickDeskUtils.getRoleBadge(p.role)}</td>
                      <td>-</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="section-title" style="margin:0; font-size: 16px;">Head-to-Head</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Select Opponent</label>
              <select class="form-select" id="h2h-select">
                <option value="">-- Choose Team --</option>
                ${window.CrickDeskData.getTeams().filter(t => t.id !== team.id).map(t => `
                  <option value="${t.id}" ${state.headToHeadOpponentId === t.id ? 'selected' : ''}>${t.name}</option>
                `).join('')}
              </select>
            </div>
            <div id="h2h-result">
              ${renderHeadToHeadResult(team.id, state.headToHeadOpponentId)}
            </div>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  function renderHeadToHeadResult(teamId, oppId) {
    if (!oppId) return '<div class="text-muted" style="text-align:center; padding:20px;">Select an opponent to compare</div>';
    const h2h = getHeadToHead(teamId, oppId);
    if (h2h.played === 0) return '<div class="text-muted" style="text-align:center; padding:20px;">No matches played against this team</div>';
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-green);">${h2h.t1w}</div>
          <div style="font-size: 11px; color: var(--text-muted);">WINS</div>
        </div>
        <div style="text-align: center; color: var(--text-muted);">
          <div style="font-size: 16px;">${h2h.played}</div>
          <div style="font-size: 11px;">MATCHES</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--accent-red);">${h2h.t2w}</div>
          <div style="font-size: 11px; color: var(--text-muted);">LOSSES</div>
        </div>
      </div>
    `;
  }

  function renderModal(teamId = null) {
    let team = { name: '', shortName: '', color: COLORS[0].value, captainId: '' };
    if (teamId) {
      team = window.CrickDeskData.getTeam(teamId) || team;
    }
    const players = teamId ? window.CrickDeskData.getPlayersByTeam(teamId) : [];

    return `
      <div class="modal">
        <div class="modal-header">
          <h3 style="margin:0;">${teamId ? 'Edit' : 'Add'} Team</h3>
          <button class="modal-close" onclick="window.CrickDeskUtils.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <form id="team-form">
            <input type="hidden" id="team-id" value="${teamId || ''}">
            <div class="form-group">
              <label class="form-label">Team Name</label>
              <input type="text" class="form-input" id="team-name" value="${team.name}" required placeholder="e.g. Thunder Strikers">
            </div>
            <div class="form-group">
              <label class="form-label">Short Name</label>
              <input type="text" class="form-input" id="team-short" value="${team.shortName}" required maxlength="4" placeholder="e.g. THU">
            </div>
            <div class="form-group">
              <label class="form-label">Team Color</label>
              <div style="display:flex; gap:12px; flex-wrap:wrap;">
                ${COLORS.map(c => `
                  <label style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="radio" name="team-color" value="${c.value}" ${team.color === c.value ? 'checked' : ''} style="display:none;">
                    <div style="width:32px; height:32px; border-radius:50%; background:${c.value}; border: 2px solid ${team.color === c.value ? 'white' : 'transparent'}; transition:0.2s;" class="color-swatch"></div>
                  </label>
                `).join('')}
              </div>
            </div>
            ${teamId ? `
              <div class="form-group">
                <label class="form-label">Captain</label>
                <select class="form-select" id="team-captain">
                  <option value="">-- No Captain --</option>
                  ${players.map(p => `
                    <option value="${p.id}" ${p.id === team.captainId ? 'selected' : ''}>${p.name}</option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.CrickDeskUtils.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-save-team">Save Team</button>
        </div>
      </div>
    `;
  }

  function attachEvents() {
    const container = document.getElementById('page-teams');
    
    container.addEventListener('click', async (e) => {
      // Add/Edit team
      if (e.target.closest('#btn-add-team') || e.target.closest('#btn-add-team-empty')) {
        window.CrickDeskUtils.showModal(renderModal());
        setTimeout(() => {
          setupModalEvents();
        }, 10);
      }
      if (e.target.closest('.edit-team')) {
        const id = e.target.closest('.edit-team').dataset.id;
        window.CrickDeskUtils.showModal(renderModal(id));
        setTimeout(() => setupModalEvents(), 10);
      }
      
      // Delete team
      if (e.target.closest('.delete-team')) {
        const id = e.target.closest('.delete-team').dataset.id;
        const confirm = await window.CrickDeskUtils.confirmDialog("Are you sure? This will delete the team and orphan its players.");
        if (confirm) {
          window.CrickDeskData.deleteTeam(id);
          window.CrickDeskUtils.showToast("Team deleted", "success");
          refreshContent();
        }
      }

      // View details
      if (e.target.closest('.view-team')) {
        state.selectedTeamId = e.target.closest('.view-team').dataset.id;
        state.view = 'detail';
        state.headToHeadOpponentId = '';
        refreshContent();
      }

      // Back to grid
      if (e.target.closest('#btn-back-teams')) {
        state.view = 'grid';
        state.selectedTeamId = null;
        refreshContent();
      }
    });

    container.addEventListener('change', (e) => {
      if (e.target.id === 'h2h-select') {
        state.headToHeadOpponentId = e.target.value;
        const resDiv = document.getElementById('h2h-result');
        if (resDiv) {
          resDiv.innerHTML = renderHeadToHeadResult(state.selectedTeamId, state.headToHeadOpponentId);
        }
      }
    });
  }

  function setupModalEvents() {
    const modal = document.querySelector('.modal');
    if (!modal) return;
    
    const swatches = modal.querySelectorAll('input[name="team-color"]');
    swatches.forEach(s => {
      s.addEventListener('change', () => {
        modal.querySelectorAll('.color-swatch').forEach(el => el.style.borderColor = 'transparent');
        s.nextElementSibling.style.borderColor = 'white';
      });
    });

    const saveBtn = modal.querySelector('#btn-save-team');
    saveBtn.addEventListener('click', () => {
      const id = modal.querySelector('#team-id').value;
      const name = modal.querySelector('#team-name').value.trim();
      const shortName = modal.querySelector('#team-short').value.trim().toUpperCase();
      const color = modal.querySelector('input[name="team-color"]:checked').value;
      const captainId = modal.querySelector('#team-captain')?.value || null;

      if (!name || !shortName) {
        window.CrickDeskUtils.showToast("Please fill all required fields", "error");
        return;
      }

      const team = {
        id: id || window.CrickDeskUtils.generateId(),
        name,
        shortName,
        color,
        captainId
      };

      window.CrickDeskData.saveTeam(team);
      window.CrickDeskUtils.showToast("Team saved successfully", "success");
      window.CrickDeskUtils.closeModal();
      refreshContent();
    });
  }

  function refreshContent() {
    const container = document.getElementById('page-teams');
    if (container) {
      container.innerHTML = state.view === 'grid' ? renderGrid() : renderDetail();
    }
  }

  return {
    init() {
      const container = document.getElementById('page-teams');
      if (!container) return;
      container.innerHTML = state.view === 'grid' ? renderGrid() : renderDetail();
      
      // Ensure we only attach event listeners once
      if (!container.dataset.eventsAttached) {
        attachEvents();
        container.dataset.eventsAttached = 'true';
      }
    }
  };
})();
