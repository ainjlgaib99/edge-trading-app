/* ═══════════════════════════════════════════
   EDGE App — Database Layer
   All Supabase queries live here.
   No raw _sb calls outside this file.

   ─── SUPABASE SCHEMA (run once in SQL editor) ───

   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";

   -- user_profiles
   CREATE TABLE user_profiles (
     id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     username    TEXT,
     avatar_url  TEXT,
     plan        TEXT DEFAULT 'free',
     created_at  TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_own_profile" ON user_profiles
     USING (id = auth.uid()) WITH CHECK (id = auth.uid());

   -- user_settings
   CREATE TABLE user_settings (
     user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     accent_color TEXT DEFAULT '#c8ff00',
     font_size    TEXT DEFAULT 'medium',
     spacing      TEXT DEFAULT 'comfortable',
     updated_at   TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_own_settings" ON user_settings
     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

   -- trading_profile
   CREATE TABLE trading_profile (
     user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     risk_per_trade NUMERIC DEFAULT 200,
     max_risk       NUMERIC DEFAULT 500,
     daily_limit    NUMERIC DEFAULT 500,
     max_trades     INT     DEFAULT 2,
     session_start  TEXT    DEFAULT '06:30',
     session_end    TEXT    DEFAULT '08:00',
     firm           TEXT,
     account_size   NUMERIC,
     instruments    TEXT    DEFAULT 'MNQ,MES',
     min_trade_days INT     DEFAULT 10,
     updated_at     TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE trading_profile ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_own_trading_profile" ON trading_profile
     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

   -- journal_entries
   CREATE TABLE journal_entries (
     id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     date            DATE NOT NULL,
     instrument      TEXT,
     setup_type      TEXT,
     entry_price     NUMERIC,
     stop_price      NUMERIC,
     target_price    NUMERIC,
     planned_rr      NUMERIC,
     actual_exit     NUMERIC,
     actual_rr       NUMERIC,
     pnl             NUMERIC,
     followed_rules  BOOLEAN DEFAULT TRUE,
     emotional_state INT,
     notes           TEXT,
     created_at      TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_own_journal" ON journal_entries
     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

   -- timeline_progress
   CREATE TABLE timeline_progress (
     user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     phase_number INT,
     phase_name   TEXT,
     started_at   DATE,
     completed_at DATE,
     notes        TEXT,
     PRIMARY KEY (user_id, phase_number)
   );
   ALTER TABLE timeline_progress ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_own_timeline" ON timeline_progress
     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

   -- playbook_notes
   CREATE TABLE playbook_notes (
     user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     section_id TEXT,
     notes      TEXT,
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     PRIMARY KEY (user_id, section_id)
   );
   ALTER TABLE playbook_notes ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_own_playbook_notes" ON playbook_notes
     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

═══════════════════════════════════════════ */

/* ── JOURNAL ── */

async function getJournalEntries(userId, filters = {}) {
  let q = _sb.from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.startDate) q = q.gte('date', filters.startDate);
  if (filters.endDate)   q = q.lte('date', filters.endDate);
  if (filters.instrument && filters.instrument !== 'all')
    q = q.eq('instrument', filters.instrument);
  if (filters.setup && filters.setup !== 'all')
    q = q.eq('setup_type', filters.setup);
  if (filters.result === 'win')  q = q.gt('pnl', 0);
  if (filters.result === 'loss') q = q.lt('pnl', 0);
  if (filters.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function createJournalEntry(data) {
  const { data: row, error } = await _sb.from('journal_entries').insert(data).select().single();
  if (error) throw error;
  return row;
}

async function updateJournalEntry(id, data) {
  const { data: row, error } = await _sb
    .from('journal_entries').update(data).eq('id', id).select().single();
  if (error) throw error;
  return row;
}

async function deleteJournalEntry(id) {
  const { error } = await _sb.from('journal_entries').delete().eq('id', id);
  if (error) throw error;
}

async function getJournalStats(userId) {
  const { data, error } = await _sb
    .from('journal_entries')
    .select('pnl, actual_rr, followed_rules, date')
    .eq('user_id', userId);
  if (error) throw error;
  if (!data || data.length === 0) return { total: 0, wins: 0, winRate: 0, avgRR: 0, totalPnl: 0 };

  const wins    = data.filter(r => r.pnl > 0).length;
  const totalPnl = data.reduce((s, r) => s + (r.pnl || 0), 0);
  const rrValues = data.filter(r => r.actual_rr != null).map(r => r.actual_rr);
  const avgRR   = rrValues.length ? rrValues.reduce((s,v) => s+v,0) / rrValues.length : 0;

  // Month P&L
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const monthPnl = data.filter(r => r.date >= monthStart).reduce((s,r) => s + (r.pnl||0), 0);

  // Today's trades
  const today = new Date().toISOString().slice(0,10);
  const todayTrades = data.filter(r => r.date === today).length;

  return {
    total:       data.length,
    wins,
    winRate:     data.length ? (wins / data.length) * 100 : 0,
    avgRR,
    totalPnl,
    monthPnl,
    todayTrades
  };
}

/* ── TIMELINE ── */

async function getTimelineProgress(userId) {
  const { data, error } = await _sb
    .from('timeline_progress')
    .select('*')
    .eq('user_id', userId)
    .order('phase_number');
  if (error) throw error;
  return data || [];
}

async function updateTimelinePhase(userId, phaseNumber, updates) {
  const { data, error } = await _sb
    .from('timeline_progress')
    .upsert({ user_id: userId, phase_number: phaseNumber, ...updates })
    .select().single();
  if (error) throw error;
  return data;
}

/* ── USER PROFILE ── */

async function getUserProfile(userId) {
  const { data, error } = await _sb
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateUserProfile(userId, updates) {
  const { data, error } = await _sb
    .from('user_profiles')
    .upsert({ id: userId, ...updates })
    .select().single();
  if (error) throw error;
  return data;
}

async function getTradingProfile(userId) {
  const { data, error } = await _sb
    .from('trading_profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateTradingProfile(userId, updates) {
  const { data, error } = await _sb
    .from('trading_profile')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

/* ── PLAYBOOK NOTES ── */

async function getPlaybookNote(userId, sectionId) {
  const { data, error } = await _sb
    .from('playbook_notes')
    .select('notes, updated_at')
    .eq('user_id', userId)
    .eq('section_id', sectionId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.notes || '';
}

async function getPlaybookNotes(userId) {
  const { data, error } = await _sb
    .from('playbook_notes')
    .select('section_id, notes')
    .eq('user_id', userId);
  if (error) throw error;
  // Return as map: { sectionId: notes }
  return Object.fromEntries((data || []).map(r => [r.section_id, r.notes]));
}

async function savePlaybookNote(userId, sectionId, notes) {
  const { error } = await _sb
    .from('playbook_notes')
    .upsert({ user_id: userId, section_id: sectionId, notes, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ── USER SETTINGS ── */

async function getUserSettings(userId) {
  const { data, error } = await _sb
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || { accent_color: '#c8ff00', font_size: 'medium', spacing: 'comfortable' };
}

async function saveUserSettings(userId, settings) {
  const { error } = await _sb
    .from('user_settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ══════════════════════════════
   TRADER SETTINGS
══════════════════════════════ */

const DEFAULT_TRADER_SETTINGS = {
  name: '',
  instruments: ['MNQ', 'MES'],
  strategy: 'FRVP + AMT',
  max_risk_per_trade: 250,
  absolute_max_risk: 500,
  min_rr: 2.0,
  max_trades_per_day: 2,
  max_losses_per_day: 2,
  prop_firm: 'Topstep',
  account_size: 50000,
  profit_target: 3000,
  max_drawdown: 2500,
  daily_loss_limit: 2000,
  min_trading_days: 15,
  session_1_start: '6:30 AM',
  session_1_end: '8:00 AM',
  session_2_start: null,
  session_2_end: null,
  eval_status: 'Paper Trading',
  airtable_api_key: null,
  airtable_base_id: null,
  airtable_table_id: null,
  slack_webhook_url: null,
};

async function getTraderSettings(userId) {
  const { data, error } = await _sb
    .from('trader_settings').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function saveTraderSettings(userId, updates) {
  const { data, error } = await _sb
    .from('trader_settings')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

async function initTraderSettings(userId, profile) {
  // Creates default settings on first login if none exist
  const existing = await getTraderSettings(userId);
  if (existing) return existing;
  const defaults = { ...DEFAULT_TRADER_SETTINGS };
  if (profile?.username) defaults.name = profile.username;
  return await saveTraderSettings(userId, defaults);
}

/* ══════════════════════════════
   TRADES (new copilot table)
══════════════════════════════ */

async function getTrades(userId, filters = {}) {
  let q = _sb.from('trades').select('*').eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (filters.startDate) q = q.gte('date', filters.startDate);
  if (filters.endDate)   q = q.lte('date', filters.endDate);
  if (filters.instrument && filters.instrument !== 'all') q = q.eq('instrument', filters.instrument);
  if (filters.setup && filters.setup !== 'all') q = q.eq('setup_type', filters.setup);
  if (filters.result && filters.result !== 'all') q = q.eq('result', filters.result);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function getTodayTrades(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await _sb.from('trades').select('*')
    .eq('user_id', userId).eq('date', today);
  if (error) throw error;
  return data || [];
}

async function createTrade(data) {
  const { data: row, error } = await _sb.from('trades').insert(data).select().single();
  if (error) throw error;
  return row;
}

async function updateTrade(id, data) {
  const { data: row, error } = await _sb.from('trades').update(data).eq('id', id).select().single();
  if (error) throw error;
  return row;
}

async function deleteTrade(id) {
  const { error } = await _sb.from('trades').delete().eq('id', id);
  if (error) throw error;
}

async function getTradeStats(userId) {
  const { data, error } = await _sb.from('trades')
    .select('pnl, actual_rr, result, date, setup_type, emotional_state')
    .eq('user_id', userId);
  if (error) throw error;
  if (!data || data.length === 0) return {
    total: 0, wins: 0, losses: 0, winRate: 0, avgRR: 0,
    totalPnl: 0, todayPnl: 0, todayTrades: 0, todayLosses: 0,
    streak: 0, bestSetup: '—'
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = data.filter(r => r.date === today);
  const todayPnl = todayTrades.reduce((s, r) => s + (r.pnl || 0), 0);
  const todayLosses = todayTrades.filter(r => r.result === 'Loss').length;

  const wins = data.filter(r => r.result === 'Win').length;
  const losses = data.filter(r => r.result === 'Loss').length;
  const totalPnl = data.reduce((s, r) => s + (r.pnl || 0), 0);
  const rrVals = data.filter(r => r.actual_rr != null && r.result === 'Win').map(r => r.actual_rr);
  const avgRR = rrVals.length ? rrVals.reduce((s, v) => s + v, 0) / rrVals.length : 0;

  // Streak (consecutive wins or losses from most recent)
  const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  if (sorted.length > 0) {
    const dir = sorted[0].result === 'Win' ? 'Win' : 'Loss';
    for (const t of sorted) {
      if (t.result === dir) streak++;
      else break;
    }
    if (dir === 'Loss') streak = -streak;
  }

  // Best setup by total P&L
  const bySetup = {};
  data.forEach(t => {
    const s = t.setup_type || 'Other';
    bySetup[s] = (bySetup[s] || 0) + (t.pnl || 0);
  });
  const bestSetup = Object.entries(bySetup).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  return {
    total: data.length, wins, losses,
    winRate: data.length ? (wins / data.length) * 100 : 0,
    avgRR, totalPnl, todayPnl,
    todayTrades: todayTrades.length,
    todayLosses, streak, bestSetup
  };
}

async function getEquityCurve(userId) {
  const { data, error } = await _sb.from('trades')
    .select('date, pnl, created_at').eq('user_id', userId)
    .order('date', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  let cum = 0;
  return (data || []).map(t => {
    cum += t.pnl || 0;
    return { date: t.date, pnl: t.pnl || 0, cumPnl: cum };
  });
}

/* ══════════════════════════════
   DAILY LEVELS
══════════════════════════════ */

async function getTodayLevels(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await _sb.from('daily_levels').select('*')
    .eq('user_id', userId).eq('date', today).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function getRecentLevels(userId, limit = 5) {
  const { data, error } = await _sb.from('daily_levels').select('*')
    .eq('user_id', userId).order('date', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

async function saveDailyLevels(userId, levels) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await _sb.from('daily_levels')
    .upsert({ user_id: userId, date: today, ...levels })
    .select().single();
  if (error) throw error;
  return data;
}

/* ══════════════════════════════
   PROP FIRM ACCOUNTS
══════════════════════════════ */

async function getPropFirmAccounts(userId) {
  const { data, error } = await _sb.from('prop_firm_accounts').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function savePropFirmAccount(userId, account) {
  const payload = { user_id: userId, ...account, updated_at: new Date().toISOString() };
  if (account.id) {
    const { data, error } = await _sb.from('prop_firm_accounts').update(payload).eq('id', account.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await _sb.from('prop_firm_accounts').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}

async function deletePropFirmAccount(id) {
  const { error } = await _sb.from('prop_firm_accounts').delete().eq('id', id);
  if (error) throw error;
}

/* ── WEEKLY P&L for chart ── */

async function getWeeklyPnl(userId) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const monStr = mon.toISOString().slice(0,10);

  const { data, error } = await _sb
    .from('journal_entries')
    .select('date, pnl')
    .eq('user_id', userId)
    .gte('date', monStr);
  if (error) throw error;

  // Group by weekday
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  const result = days.map((label, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = d.toISOString().slice(0,10);
    const entries = (data || []).filter(r => r.date === dateStr);
    const pnl = entries.reduce((s,r) => s + (r.pnl||0), 0);
    return { label, pnl, date: dateStr };
  });

  return result;
}
