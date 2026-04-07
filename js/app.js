/* ═══════════════════════════════════════════
   EDGE App — Main Entry Point
   Initializes auth → profile → settings → router
═══════════════════════════════════════════ */

/* ── State ── */
let _session = null;
let _profile = null;
let _tradingProfile = null;
let _traderSettings = null;

/* ══════════════════════════════
   INIT
══════════════════════════════ */

async function initApp() {
  // 1. Check auth
  _session = await requireAuth();
  if (!_session) return; // redirected to login

  const userId = _session.user.id;

  // 2. Load profile + settings in parallel
  try {
    const [profile, tradingProf, settings, traderSettings] = await Promise.all([
      getUserProfile(userId),
      getTradingProfile(userId),
      getUserSettings(userId),
      getTraderSettings(userId)
    ]);

    _profile = profile;
    _tradingProfile = tradingProf;

    // Auto-init trader_settings on first login
    if (!traderSettings) {
      _traderSettings = await initTraderSettings(userId, profile);
    } else {
      _traderSettings = traderSettings;
    }

    // 3. Apply user settings
    if (settings.accent_color) applyAccentColor(settings.accent_color);

    // 4. Update sidebar user chip
    _renderUserChip(profile, _session.user.email);

    // 5. Start session timer
    if (_traderSettings?.session_1_end) {
      const timeStr = _traderSettings.session_1_end.replace(' AM','').replace(' PM','');
      const [h, m] = timeStr.split(':').map(Number);
      startSessionTimer(h, m);
    } else if (tradingProf?.session_end) {
      const [h, m] = tradingProf.session_end.split(':').map(Number);
      startSessionTimer(h, m);
    } else {
      startSessionTimer(8, 0);
    }

    // 6. Update rule chips
    if (_traderSettings) _renderRuleChips(_traderSettings);
    else if (tradingProf) _renderRuleChips(tradingProf);

  } catch (err) {
    console.error('[app] profile load error:', err);
  }

  // 7. Init router + navigate to initial route
  const initialRoute = location.hash.slice(1) || 'dashboard';
  await navigate(initialRoute, false);

  // 8. Mobile sidebar
  _initMobileSidebar();
}

/* ══════════════════════════════
   USER CHIP
══════════════════════════════ */

function _renderUserChip(profile, email) {
  const name     = profile?.username || email?.split('@')[0] || 'Trader';
  const initials = getInitials(name);

  const avatarEl = document.getElementById('userAvatar');
  const nameEl   = document.getElementById('userName');
  const planEl   = document.getElementById('userPlan');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = name;
  if (planEl)   planEl.textContent   = _tradingProfile?.firm || 'EDGE Trader';
}

/* ══════════════════════════════
   RULE CHIPS
══════════════════════════════ */

function _renderRuleChips(tp) {
  const el = document.getElementById('sidebarRuleChips');
  if (!el || !tp) return;

  // Support both old trading_profile and new trader_settings schema
  const risk = tp.max_risk_per_trade || tp.risk_per_trade || 250;
  const maxRisk = tp.absolute_max_risk || tp.max_risk || 500;
  const trades = tp.max_trades_per_day || tp.max_trades || 2;
  const sess = tp.session_1_start ? `${tp.session_1_start}–${tp.session_1_end}` : `${tp.session_start||'6:30'}–${tp.session_end||'8:00'}`;
  const losses = tp.max_losses_per_day || 2;

  const chips = [
    { label: 'Risk',   val: `$${risk}–${maxRisk}` },
    { label: 'Min RR', val: `1:${tp.min_rr || 2}` },
    { label: 'Trades', val: `${trades}/day` },
    { label: 'Losses', val: `${losses} max` },
    { label: 'Session', val: sess },
  ];

  el.innerHTML = chips.map(c => `
    <div class="chip">
      <span class="chip-label">${c.label}</span>
      <span class="chip-val">${c.val}</span>
    </div>
  `).join('');
}

/* ══════════════════════════════
   MOBILE SIDEBAR
══════════════════════════════ */

function _initMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const hamburger = document.getElementById('hamburger');

  if (!sidebar || !backdrop || !hamburger) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('visible');
  });

  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('visible');
  });

  // Close sidebar when nav item clicked on mobile
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        backdrop.classList.remove('visible');
      }
    });
  });
}

// Sync mobile bottom nav active state (called by router)
function _syncMobileNav(route) {
  document.querySelectorAll('.mbn-item[data-route]').forEach(item => {
    const r = item.dataset.route;
    // Match exact route or prefix for playbook
    const match = route === r || (r === 'playbook/routine' && route.startsWith('playbook/'));
    item.classList.toggle('active', match);
  });
}

/* ══════════════════════════════
   GLOBAL HELPERS (called from HTML)
══════════════════════════════ */

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar?.classList.toggle('open');
  backdrop?.classList.toggle('visible');
}

function getAppSession()        { return _session; }
function getAppProfile()        { return _profile; }
function getAppTradingProfile() { return _tradingProfile; }
function getTraderConfig()      { return _traderSettings; }

/* ══════════════════════════════
   PLAYBOOK NOTES HELPER
   (shared by all playbook pages)
══════════════════════════════ */

async function initPlaybookNotes(sectionId) {
  const textarea  = document.getElementById('playbookNotes');
  const savedEl   = document.getElementById('notesSaved');
  if (!textarea) return;

  const userId = _session?.user?.id;
  if (!userId) return;

  // Load existing note
  try {
    const notes = await getPlaybookNote(userId, sectionId);
    textarea.value = notes;

    // Mark sidebar nav item as having notes
    if (notes.trim()) {
      const navItem = document.querySelector(`[data-route="playbook/${sectionId}"]`);
      if (navItem) navItem.classList.add('has-notes');
    }
  } catch(e) { /* ignore */ }

  // Save on blur (debounced)
  let saveTimer;
  textarea.addEventListener('input', () => {
    if (savedEl) savedEl.classList.remove('visible');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await savePlaybookNote(userId, sectionId, textarea.value);
        if (savedEl) {
          savedEl.classList.add('visible');
          setTimeout(() => savedEl.classList.remove('visible'), 2000);
        }
        // Update sidebar indicator
        const navItem = document.querySelector(`[data-route="playbook/${sectionId}"]`);
        if (navItem) navItem.classList.toggle('has-notes', !!textarea.value.trim());
      } catch(e) {
        toast('Failed to save note', 'error');
      }
    }, 800);
  });
}

/* ── Kick off ── */
initApp();
