/* ═══════════════════════════════════════════
   EDGE App — Client-side Router
   Hash-based SPA routing, page fragment loading
═══════════════════════════════════════════ */

const ROUTES = {
  dashboard:               { path: 'pages/dashboard.html',              label: 'Dashboard',      parent: 'EDGE' },
  log:                     { path: 'pages/log.html',                    label: 'Log Trade',      parent: 'EDGE' },
  journal:                 { path: 'pages/journal.html',                label: 'Journal',        parent: 'EDGE' },
  levels:                  { path: 'pages/levels.html',                 label: 'Levels',         parent: 'EDGE' },
  eval:                    { path: 'pages/eval.html',                   label: 'Eval Tracker',   parent: 'EDGE' },
  timeline:                { path: 'pages/timeline.html',               label: 'Timeline',       parent: 'EDGE' },
  settings:                { path: 'pages/settings.html',               label: 'Settings',       parent: 'EDGE' },
  profile:                 { path: 'pages/profile.html',                label: 'Profile',        parent: 'EDGE' },
  'playbook/routine':      { path: 'pages/playbook/routine.html',        label: 'Morning Routine',  parent: 'Playbook' },
  'playbook/levels':       { path: 'pages/playbook/levels.html',         label: 'Picking Levels',   parent: 'Playbook' },
  'playbook/entry':        { path: 'pages/playbook/entry.html',          label: 'The Entry',        parent: 'Playbook' },
  'playbook/manage':       { path: 'pages/playbook/manage.html',         label: 'Trade Management', parent: 'Playbook' },
  'playbook/stayout':      { path: 'pages/playbook/stayout.html',        label: 'Stay Out',         parent: 'Playbook' },
  'playbook/eval':         { path: 'pages/playbook/eval.html',           label: 'Passing Evals',    parent: 'Playbook' },
  'playbook/mistakes':     { path: 'pages/playbook/mistakes.html',       label: 'Common Mistakes',  parent: 'Playbook' },
  'playbook/risk':         { path: 'pages/playbook/risk.html',           label: 'Risk Rules',       parent: 'Playbook' },
  'playbook/timeline-guide': { path: 'pages/playbook/timeline-guide.html', label: 'Timeline Guide', parent: 'Playbook' },
  'playbook/journal-guide':  { path: 'pages/playbook/journal-guide.html',  label: 'Journal Guide',  parent: 'Playbook' },
};

let _currentRoute  = null;
const _pageCache   = {};

async function navigate(route, pushState = true) {
  const config = ROUTES[route];
  if (!config) {
    console.warn('[router] Unknown route:', route);
    return navigate('dashboard', pushState);
  }

  const content = document.getElementById('content');
  if (!content) return;

  // Fade out
  content.style.opacity = '0.3';
  content.style.transition = 'opacity 0.1s ease';

  try {
    let html = _pageCache[route];
    if (!html) {
      const res = await fetch(config.path + '?v=' + APP_VERSION);
      if (!res.ok) throw new Error(`Failed to load ${config.path} (${res.status})`);
      html = await res.text();
      _pageCache[route] = html;
    }

    content.innerHTML = html;

    // Fade in
    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.15s ease';
      content.style.opacity    = '1';
      const inner = content.querySelector('.page-inner');
      if (inner) inner.classList.add('page-enter');
    });

    // Update nav + breadcrumb
    _updateNav(route);
    _updateBreadcrumb(config.parent, config.label);
    if (typeof _syncMobileNav === 'function') _syncMobileNav(route);

    // Push hash
    if (pushState) history.pushState({ route }, '', '#' + route);

    _currentRoute = route;
    content.scrollTo({ top: 0, behavior: 'instant' });

    // Run page-specific init
    const key    = 'init_' + route.replace(/\//g, '_');
    const initFn = window[key];
    if (typeof initFn === 'function') {
      try { await initFn(); } catch(e) { console.error('[router] init error:', e); }
    }

  } catch (err) {
    content.innerHTML = `
      <div class="page-inner">
        <div class="empty-state">
          <div class="empty-icon">⚠</div>
          <div class="empty-title">Page failed to load</div>
          <div class="empty-msg">${err.message}</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('dashboard')">Go to Dashboard</button>
        </div>
      </div>`;
    content.style.opacity = '1';
  }
}

function _updateNav(route) {
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    const r = item.dataset.route;
    item.classList.toggle('active', route === r);
  });
}

function _updateBreadcrumb(parent, label) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  bc.innerHTML = `
    <span>${parent}</span>
    <span class="breadcrumb-sep">/</span>
    <span class="breadcrumb-current">${label}</span>
  `;
}

function getCurrentRoute() { return _currentRoute; }

// Handle browser back/forward
window.addEventListener('popstate', e => {
  const route = location.hash.slice(1) || 'dashboard';
  navigate(route, false);
});
