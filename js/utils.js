/* ============================================
   CrickDesk - Utility Functions
   ============================================ */

window.CrickDeskUtils = {

  /**
   * Generate a unique ID string
   */
  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  },

  /**
   * Format ISO date string to readable date
   */
  formatDate(iso) {
    if (!iso) return '—';
    try {
      const date = new Date(iso);
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return iso;
    }
  },

  /**
   * Format ISO date string to readable date + time
   */
  formatDateTime(iso) {
    if (!iso) return '—';
    try {
      const date = new Date(iso);
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (e) {
      return iso;
    }
  },

  /**
   * Format total balls into overs display
   * e.g. 25 balls at 6bpo = '4.1'
   */
  formatOvers(totalBalls, bpo = 6) {
    if (!totalBalls || totalBalls <= 0) return '0.0';
    const completedOvers = Math.floor(totalBalls / bpo);
    const remainingBalls = totalBalls % bpo;
    return `${completedOvers}.${remainingBalls}`;
  },

  /**
   * Calculate batting strike rate
   */
  calculateStrikeRate(runs, balls) {
    if (!balls || balls === 0) return '—';
    return ((runs / balls) * 100).toFixed(1);
  },

  /**
   * Calculate bowling economy rate (runs per over)
   */
  calculateEconomy(runs, totalBalls, bpo = 6) {
    if (!totalBalls || totalBalls === 0) return '—';
    const overs = totalBalls / bpo;
    return (runs / overs).toFixed(2);
  },

  /**
   * Calculate batting average
   */
  calculateAverage(runs, dismissals) {
    if (!dismissals || dismissals === 0) return '—';
    return (runs / dismissals).toFixed(2);
  },

  /**
   * Show a toast notification
   */
  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
      <span class="toast-message">${msg}</span>
      <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300);">✕</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }
    }, 3000);
  },

  /**
   * Show a modal with HTML content
   */
  showModal(htmlString) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = `
      <div class="modal-overlay" id="active-modal-overlay">
        ${htmlString}
      </div>
    `;

    // Trigger reflow then add active class for animation
    const overlay = document.getElementById('active-modal-overlay');
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    // Close on overlay click (not on modal content click)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        CrickDeskUtils.closeModal();
      }
    });

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        CrickDeskUtils.closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },

  /**
   * Close the active modal
   */
  closeModal() {
    const overlay = document.getElementById('active-modal-overlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    setTimeout(() => {
      const container = document.getElementById('modal-container');
      if (container) container.innerHTML = '';
    }, 300);
  },

  /**
   * Show a confirm dialog, returns a Promise<boolean>
   */
  confirmDialog(msg) {
    return new Promise((resolve) => {
      const html = `
        <div class="modal modal-sm">
          <div class="modal-header">
            <h2>Confirm</h2>
            <button class="modal-close" id="confirm-close">✕</button>
          </div>
          <div class="modal-body">
            <p style="color: var(--text-primary); font-size: 15px; line-height: 1.6;">${msg}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" id="confirm-no">Cancel</button>
            <button class="btn btn-primary" id="confirm-yes">Yes, Confirm</button>
          </div>
        </div>
      `;

      CrickDeskUtils.showModal(html);

      // Attach handlers after modal is shown
      setTimeout(() => {
        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');
        const closeBtn = document.getElementById('confirm-close');

        const cleanup = (result) => {
          CrickDeskUtils.closeModal();
          resolve(result);
        };

        if (yesBtn) yesBtn.addEventListener('click', () => cleanup(true));
        if (noBtn) noBtn.addEventListener('click', () => cleanup(false));
        if (closeBtn) closeBtn.addEventListener('click', () => cleanup(false));
      }, 50);
    });
  },

  /**
   * Standard debounce function
   */
  debounce(fn, ms = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  /**
   * Get team color by team ID
   */
  getTeamColor(teamId) {
    const data = CrickDeskData.load();
    const team = data.teams.find(t => t.id === teamId);
    return team ? team.color : '#6b7280';
  },

  /**
   * Get player initials (first letter of first and last name)
   */
  getPlayerInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  },

  /**
   * Get role badge HTML
   */
  getRoleBadge(role) {
    const config = {
      'batsman': { label: 'Batsman', class: 'badge-blue', icon: '🏏' },
      'bowler': { label: 'Bowler', class: 'badge-red', icon: '🎯' },
      'all-rounder': { label: 'All-Rounder', class: 'badge-purple', icon: '⭐' },
      'wicket-keeper': { label: 'WK', class: 'badge-amber', icon: '🧤' }
    };
    const c = config[role] || { label: role, class: 'badge-gray', icon: '👤' };
    return `<span class="badge ${c.class}">${c.icon} ${c.label}</span>`;
  },

  /**
   * Get match status badge HTML
   */
  getStatusBadge(status) {
    const config = {
      'upcoming': { label: 'Upcoming', class: 'badge-blue' },
      'live': { label: 'Live', class: 'badge-green' },
      'completed': { label: 'Completed', class: 'badge-green' },
      'abandoned': { label: 'Abandoned', class: 'badge-red' },
      'no-result': { label: 'No Result', class: 'badge-gray' },
      'tied': { label: 'Tied', class: 'badge-amber' }
    };
    const c = config[status] || { label: status, class: 'badge-gray' };
    return `<span class="badge ${c.class}">${c.label}</span>`;
  },

  /**
   * Animate a counter from 0 to target value
   */
  animateCounter(el, target, duration = 1000) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    target = parseInt(target, 10) || 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);

      el.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  },

  /**
   * Sort array by key
   */
  sortBy(arr, key, dir = 'desc') {
    return [...arr].sort((a, b) => {
      let valA = typeof key === 'function' ? key(a) : a[key];
      let valB = typeof key === 'function' ? key(b) : b[key];

      // Handle numeric strings
      if (typeof valA === 'string' && !isNaN(valA)) valA = parseFloat(valA);
      if (typeof valB === 'string' && !isNaN(valB)) valB = parseFloat(valB);

      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /**
   * Group array by key into object
   */
  groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const val = typeof key === 'function' ? key(item) : item[key];
      if (!groups[val]) groups[val] = [];
      groups[val].push(item);
      return groups;
    }, {});
  }
};
