/* ============================================
   CrickDesk - Main App Controller
   ============================================ */

window.CrickDeskApp = {

  currentPage: 'dashboard',

  // Page name → module name mapping
  pageModules: {
    dashboard: 'Dashboard',
    teams: 'Teams',
    players: 'Players',
    tournament: 'Tournament',
    fixtures: 'Fixtures',
    scoring: 'Scoring',
    stats: 'Stats',
    share: 'Share',
    halloffame: 'HallOfFame'
  },

  /**
   * Initialize the application
   */
  init() {
    // Load persisted data
    CrickDeskData.load();

    // Set up sidebar navigation (event delegation)
    this.setupNavigation();

    // Set up mobile sidebar toggle
    this.setupSidebarToggle();

    // Set up sidebar footer buttons (export/import/seed)
    this.setupSidebarActions();

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (this.pageModules[hash]) {
        this.navigate(hash, false);
      }
    });

    // Navigate to initial page (from hash or default)
    const initialPage = window.location.hash.replace('#', '') || 'dashboard';
    const page = this.pageModules[initialPage] ? initialPage : 'dashboard';
    this.navigate(page);
  },

  /**
   * Navigate to a page
   */
  navigate(pageName, updateHash = true) {
    if (!this.pageModules[pageName]) {
      console.warn(`[CrickDesk] Unknown page: ${pageName}`);
      return;
    }

    this.currentPage = pageName;

    // Hide all pages, show target
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
      targetPage.classList.add('active');
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeNav) {
      activeNav.classList.add('active');
    }

    // Update URL hash
    if (updateHash) {
      history.pushState(null, '', `#${pageName}`);
    }

    // Initialize the page module (with error boundary)
    const moduleName = this.pageModules[pageName];
    const module = window[moduleName];

    if (module && typeof module.init === 'function') {
      try {
        module.init();
      } catch (err) {
        console.error(`[CrickDesk] Error initializing ${moduleName}:`, err);
        const page = document.getElementById(`page-${pageName}`);
        if (page) {
          page.innerHTML = `
            <div class="page-header">
              <h1>${moduleName}</h1>
            </div>
            <div class="page-content">
              <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <h3>Something went wrong</h3>
                <p>There was an error loading this page. Please try again or check the console for details.</p>
                <button class="btn btn-primary" onclick="CrickDeskApp.navigate('${pageName}')">Retry</button>
              </div>
            </div>
          `;
        }
      }
    } else {
      // Module not yet loaded — show placeholder
      if (targetPage) {
        targetPage.innerHTML = `
          <div class="page-header">
            <h1>${moduleName}</h1>
          </div>
          <div class="page-content">
            <div class="empty-state">
              <span class="empty-icon">🚧</span>
              <h3>Coming Soon</h3>
              <p>This module is being built. Check back shortly!</p>
            </div>
          </div>
        `;
      }
    }

    // Close mobile sidebar after navigation
    this.closeSidebar();

    // Scroll to top of main content
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;
  },

  /**
   * Set up sidebar navigation via event delegation
   */
  setupNavigation() {
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (!sidebarNav) return;

    sidebarNav.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (!navItem) return;

      const page = navItem.getAttribute('data-page');
      if (page) {
        this.navigate(page);
      }
    });
  },

  /**
   * Set up mobile sidebar toggle
   */
  setupSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');

    if (toggle) {
      toggle.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeSidebar();
      });
    }
  },

  /**
   * Toggle sidebar open/close (mobile)
   */
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  },

  /**
   * Close sidebar (mobile)
   */
  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  /**
   * Set up sidebar footer action buttons
   */
  setupSidebarActions() {
    // Export Data
    const exportBtn = document.getElementById('btn-export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          const json = CrickDeskData.exportJSON();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `crickdesk-backup-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          CrickDeskUtils.showToast('Data exported successfully!', 'success');
        } catch (err) {
          console.error('[CrickDesk] Export error:', err);
          CrickDeskUtils.showToast('Failed to export data.', 'error');
        }
      });
    }

    // Import Data
    const importBtn = document.getElementById('btn-import-data');
    const importInput = document.getElementById('import-file-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });

      importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const confirmed = await CrickDeskUtils.confirmDialog(
          'Importing data will overwrite ALL existing data. Are you sure you want to continue?'
        );

        if (!confirmed) {
          importInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const success = CrickDeskData.importJSON(event.target.result);
          if (success) {
            CrickDeskUtils.showToast('Data imported successfully! Reloading...', 'success');
            setTimeout(() => {
              this.navigate(this.currentPage);
            }, 500);
          } else {
            CrickDeskUtils.showToast('Invalid data file. Import failed.', 'error');
          }
          importInput.value = '';
        };
        reader.onerror = () => {
          CrickDeskUtils.showToast('Error reading file.', 'error');
          importInput.value = '';
        };
        reader.readAsText(file);
      });
    }

    // Seed Demo Data
    const seedBtn = document.getElementById('btn-seed-demo');
    if (seedBtn) {
      seedBtn.addEventListener('click', async () => {
        const data = CrickDeskData.load();
        const hasData = data.teams.length > 0 || data.matches.length > 0;

        if (hasData) {
          const confirmed = await CrickDeskUtils.confirmDialog(
            'This will replace ALL existing data with demo data. Are you sure?'
          );
          if (!confirmed) return;
        }

        try {
          CrickDeskData.seedDemoData();
          CrickDeskUtils.showToast('Demo data loaded successfully! 🎉', 'success');
          this.navigate(this.currentPage);
        } catch (err) {
          console.error('[CrickDesk] Seed error:', err);
          CrickDeskUtils.showToast('Failed to seed demo data.', 'error');
        }
      });
    }
  }
};

// Boot the app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  CrickDeskApp.init();
});
