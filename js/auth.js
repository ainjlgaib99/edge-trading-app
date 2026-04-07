/* ═══════════════════════════════════════════
   EDGE App — Auth Module
   All Supabase auth operations in one place.
   Requires: config.js loaded first.
═══════════════════════════════════════════ */

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Core auth functions ── */

async function login(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signup(email, password, username) {
  const { data, error } = await _sb.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });
  if (error) throw error;

  if (data.user) {
    // Create user profile row
    await _sb.from('user_profiles').upsert({
      id:         data.user.id,
      username,
      created_at: new Date().toISOString()
    });
  }
  return data;
}

async function logout() {
  await _sb.auth.signOut();
  window.location.href = '/auth/login.html';
}

async function resetPassword(email) {
  const { error } = await _sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/auth/reset.html'
  });
  if (error) throw error;
}

async function updatePassword(newPassword) {
  const { error } = await _sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function getSession() {
  const { data: { session } } = await _sb.auth.getSession();
  return session;
}

async function getUser() {
  const { data: { user } } = await _sb.auth.getUser();
  return user;
}

function onAuthChange(callback) {
  return _sb.auth.onAuthStateChange(callback);
}

/* ── Route protection ── */

// Call at top of every protected page
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/auth/login.html';
    return null;
  }
  return session;
}

// Call at top of auth pages (login/signup) — redirect away if already logged in
async function redirectIfAuth() {
  const session = await getSession();
  if (session) {
    window.location.href = '/';
  }
}
