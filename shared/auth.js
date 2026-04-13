// PT Medical System — Auth Helper (GAS HR API)
// Requires: config.js loaded before this, supabase-js CDN

const _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// --- Session helpers ---
function getUserMeta() {
  const raw = localStorage.getItem('pt_user_meta');
  return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() {
  return !!getUserMeta();
}

function getUserRole() {
  const meta = getUserMeta();
  return meta ? (meta.role || 'User') : 'User';
}

function getUserName() {
  const meta = getUserMeta();
  return meta ? (meta.full_name || meta.name || 'Unknown') : 'Unknown';
}

function getUserUsername() {
  const meta = getUserMeta();
  return meta ? (meta.username || '') : '';
}

// --- Login via GAS HR API ---
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  if (!username || !pass) {
    if (errEl) { errEl.textContent = 'กรุณากรอก Username และ Password'; errEl.classList.remove('d-none'); }
    return;
  }

  if (errEl) { errEl.classList.add('d-none'); errEl.textContent = ''; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังเข้าสู่ระบบ...'; }

  try {
    const res = await fetch(CONFIG.GAS_AUTH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ username: username, password: pass }),
      redirect: 'follow'
    });
    const result = await res.json();

    if (result.status === 'success') {
      localStorage.setItem('pt_user_meta', JSON.stringify({
        full_name: result.name || username,
        role: result.role || 'User',
        username: username,
        loginAt: new Date().toISOString()
      }));

      // Show app
      const loginView = document.getElementById('login-view');
      if (loginView) loginView.style.display = 'none';
      const wrapper = document.getElementById('app-main-wrapper');
      if (wrapper) wrapper.style.display = 'block';

      if (typeof onLoginSuccess === 'function') onLoginSuccess();
    } else {
      throw new Error(result.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  } catch (err) {
    const msg = err.message || 'ไม่สามารถเชื่อมต่อระบบได้';
    if (errEl) { errEl.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + msg; errEl.classList.remove('d-none'); }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = 'เข้าสู่ระบบ (Login)'; }
}

// --- Logout ---
function handleLogout() {
  localStorage.removeItem('pt_user_meta');
  window.location.href = CONFIG.BASE_URL + '/';
}

// --- Auth guard (for module pages) ---
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = CONFIG.BASE_URL + '/';
    return false;
  }
  return true;
}

// --- Check auth on page load ---
function checkAuth(onSuccess) {
  if (isLoggedIn()) {
    const loginView = document.getElementById('login-view');
    if (loginView) loginView.style.display = 'none';
    const wrapper = document.getElementById('app-main-wrapper');
    if (wrapper) wrapper.style.display = 'block';
    if (onSuccess) onSuccess();
  } else {
    // On module pages, redirect to root login
    const isRootPage = window.location.pathname === CONFIG.BASE_URL + '/' ||
                       window.location.pathname === CONFIG.BASE_URL + '/index.html' ||
                       window.location.pathname === '/';
    if (!isRootPage) {
      window.location.href = CONFIG.BASE_URL + '/';
    }
  }
}

// --- Escape HTML ---
function escapeHtml(text) {
  if (!text) return '';
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(text));
  return d.innerHTML;
}
