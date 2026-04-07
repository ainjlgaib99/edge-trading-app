/* ═══════════════════════════════════════════
   EDGE App — Main Entry Point
   Initializes auth → profile → settings → router
═══════════════════════════════════════════ */

/* ── State ── */
let _session = null;
let _profile = null;
let _tradingProfile = null;

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
    const [profile, tradingProf, settings] = await Promise.all([
      getUserProfile(userId),
      getTradingProfile(userId),
      getUserSettings(userId)
    ]);

    _profile = profile;
    _tradingProfile = tradingProf;

    // 3. Apply user settings
    if (settings.accent_color) applyAccentColor(settings.accent_color);

    // 4. Update sidebar user chip
    _renderUserChip(profile, _session.user.email);

    // 5. Start session timer
    if (tradingProf?.session_end) {
      const [h, m] = tradingProf.session_end.split(':').map(Number);
      startSessionTimer(h, m);
    } else {
      startSessionTimer(8, 0);
    }

    // 6. Update rule chips if trading profile exists
    if (tradingProf) _renderRuleChips(tradingProf);

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

  const chips = [
    { label: 'Risk',  val: `$${tp.risk_per_trade}–${tp.max_risk}` },
    { label: 'Min RR', val: '1:2' },
    { label: 'Trades', val: `${tp.max_trades}/day` },
    { label: 'Session', val: `${tp.session_start}–${tp.session_end}` },
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
