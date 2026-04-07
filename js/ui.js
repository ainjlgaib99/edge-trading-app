/* ═══════════════════════════════════════════
   EDGE App — UI Helpers
   toast · modal · loading · formatters
═══════════════════════════════════════════ */

/* ══════════════════════════════
   TOAST
══════════════════════════════ */

function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: '→' };
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(el);

  // Auto-dismiss after 3s
  const dismiss = () => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  const timer = setTimeout(dismiss, 3000);
  el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

/* ══════════════════════════════
   MODAL
══════════════════════════════ */

function modal(title, contentHTML, actions = []) {
  const overlay = document.getElementById('modalOverlay');
  const modalEl = document.getElementById('modal');
  const titleEl = document.getElementById('modalTitle');
  const contentEl = document.getElementById('modalContent');
  const footerEl = document.getElementById('modalFooter');

  if (!overlay) return;

  titleEl.textContent   = title;
  contentEl.innerHTML   = contentHTML;
  footerEl.innerHTML    = '';

  // Build action buttons
  actions.forEach(({ label, onClick, type = 'secondary' }) => {
    const btn = document.createElement('button');
    btn.className   = `btn btn-${type}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (onClick) onClick();
    });
    footerEl.appendChild(btn);
  });

  // Add cancel if no actions
  if (actions.length === 0) {
    footerEl.innerHTML = `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`;
  }

  overlay.classList.add('visible');
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('visible');
}

/* ══════════════════════════════
   LOADING
══════════════════════════════ */

function showLoading(container) {
  if (!container) return;
  container.innerHTML = `<div class="loading-container"><div class="loading-spinner"></div></div>`;
}

function hideLoading(container) {
  const spinner = container?.querySelector('.loading-container');
  if (spinner) spinner.remove();
}

/* ══════════════════════════════
   CONFIRM DIALOG
══════════════════════════════ */

function confirmDialog(message) {
  return new Promise(resolve => {
    modal('Confirm', `<p style="font-size:var(--text-sm);line-height:1.6;color:var(--muted)">${message}</p>`, [
      {
        label: 'Cancel',
        type:  'secondary',
        onClick: () => { closeModal(); resolve(false); }
      },
      {
        label: 'Confirm',
        type:  'danger',
        onClick: () => { closeModal(); resolve(true); }
      }
    ]);
  });
}

/* ══════════════════════════════
   FORMATTERS
══════════════════════════════ */

function formatCurrency(num) {
  if (num == null) return '—';
  const n = Number(num);
  const abs = Math.abs(n);
  const formatted = abs >= 1000
    ? '$' + (abs / 1000).toFixed(1) + 'K'
    : '$' + abs.toFixed(0);
  return n < 0 ? '-' + formatted : formatted;
}

function formatCurrencyFull(num) {
  if (num == null) return '—';
  const n = Number(num);
  return (n < 0 ? '-$' : '+$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatRR(num) {
  if (num == null) return '—';
  return '1:' + Number(num).toFixed(1);
}

function formatPct(num) {
  if (num == null) return '—';
  return Number(num).toFixed(1) + '%';
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function pnlClass(val) {
  const n = Number(val);
  if (n > 0) return 'pnl-pos';
  if (n < 0) return 'pnl-neg';
  return 'text-muted';
}

/* ══════════════════════════════
   SESSION TIMER
══════════════════════════════ */

let _sessionEnd = null;
let _timerInterval = null;

function startSessionTimer(endHour = 8, endMinute = 0) {
  const timerEl = document.getElementById('sessionTimer');
  if (!timerEl) return;

  _sessionEnd = new Date();
  _sessionEnd.setHours(endHour, endMinute, 0, 0);

  // If session end already passed today, it's done
  if (_sessionEnd < new Date()) {
    timerEl.textContent = 'SESSION CLOSED';
    timerEl.className = 'badge badge-danger';
    return;
  }

  timerEl.className = 'badge badge-accent';

  _timerInterval = setInterval(() => {
    const now   = new Date();
    const diff  = _sessionEnd - now;
    if (diff <= 0) {
      clearInterval(_timerInterval);
      timerEl.textContent = 'SESSION CLOSED';
      timerEl.className = 'badge badge-danger';
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    timerEl.textContent = h > 0
      ? `${h}h ${m}m`
      : `${m}:${String(s).padStart(2,'0')}`;
  }, 1000);
}

/* ══════════════════════════════
   ACCENT COLOR SYNC
══════════════════════════════ */

function applyAccentColor(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const root = document.documentElement;
  root.style.setProperty('--accent',      hex);
  root.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.10)`);
  root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);
}

/* ══════════════════════════════
   GREETING
══════════════════════════════ */

function getGreeting() {
  const h = new Date().getHours();
  switch (true) {
    case h < 12: return 'Good morning';
    case h < 17: return 'Good afternoon';
    default:     return 'Good evening';
  }
}
