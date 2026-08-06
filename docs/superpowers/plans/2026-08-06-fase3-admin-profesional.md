# FASE 3: Admin Profesional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Basic Auth with token-based login and build professional admin dashboard

**Architecture:** Token auth via crypto.randomBytes, in-memory token store, login UI with localStorage persistence

**Tech Stack:** Node.js, Express, vanilla HTML/CSS/JS, PostgreSQL (Neon)

## Global Constraints

- Only modify `server.js` and `admin.html`
- No npm dependencies added
- Vanilla JS only, no frameworks
- Do not modify `index.html` or `styles.css`
- Token-based auth replaces Basic Auth entirely

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server.js` | Modify | Token auth system, login endpoint, rate limiting |
| `admin.html` | Modify | Login UI, dashboard, settings form |

---

### Task 1: Backend - Token Auth System

**Files:**
- Modify: `server.js:1-50` (imports and config)
- Modify: `server.js:32-44` (auth constants and stores)
- Modify: `server.js:151-184` (replace basicAuth with tokenAuth)
- Create: POST /api/admin/login endpoint

**Interfaces:**
- Consumes: `ADMIN_USER`, `ADMIN_PASSWORD` env vars
- Produces: `tokenAuth` middleware, `POST /api/admin/login` endpoint

- [ ] **Step 1: Add crypto import and token store**

Add at top of server.js after existing requires:

```javascript
const crypto = require('crypto');
```

Add after `authAttempts` Map:

```javascript
const adminTokens = new Map();
const LOGIN_RATE_LIMIT_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();
```

- [ ] **Step 2: Replace basicAuth with tokenAuth middleware**

Replace the entire `basicAuth` function (lines ~151-184) with:

```javascript
function tokenAuth(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (attempts && attempts.count >= LOGIN_MAX_ATTEMPTS && now < attempts.resetTime) {
    const remaining = Math.ceil((attempts.resetTime - now) / 60000);
    return res.status(429).json({ error: `Demasiados intentos. Intenta en ${remaining} minutos.` });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  const session = adminTokens.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  loginAttempts.delete(ip);
  req.adminUser = session.user;
  next();
}
```

- [ ] **Step 3: Add POST /api/admin/login endpoint**

Add before the existing `/api/admin/leads` endpoint:

```javascript
app.post('/api/admin/login', async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (attempts && attempts.count >= LOGIN_MAX_ATTEMPTS && now < attempts.resetTime) {
    const remaining = Math.ceil((attempts.resetTime - now) / 60000);
    return res.status(429).json({ error: `Demasiados intentos. Intenta en ${remaining} minutos.` });
  }

  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  if (user !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    if (!attempts || now >= attempts.resetTime) {
      loginAttempts.set(ip, { count: 1, resetTime: now + LOGIN_RATE_LIMIT_MS });
    } else {
      attempts.count++;
    }
    log('warn', `Login fallido desde IP ${ip}`);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, { user: adminUser, createdAt: new Date().toISOString() });

  log('log', `Login exitoso desde IP ${ip}`);
  res.json({ token });
});
```

- [ ] **Step 4: Update all /api/admin/* endpoints to use tokenAuth**

Replace `basicAuth` with `tokenAuth` in all admin routes:

```javascript
// Lines to change (find and replace):
app.get('/api/admin/leads', basicAuth, ...  →  app.get('/api/admin/leads', tokenAuth, ...
app.get('/api/admin/stats', basicAuth, ...  →  app.get('/api/admin/stats', tokenAuth, ...
app.get('/api/admin/settings', basicAuth, ...  →  app.get('/api/admin/settings', tokenAuth, ...
app.put('/api/admin/settings', basicAuth, ...  →  app.put('/api/admin/settings', tokenAuth, ...
```

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: token auth system, login endpoint, rate limiting"
```

---

### Task 2: Frontend - Login UI

**Files:**
- Modify: `admin.html` (entire file rewrite)

**Interfaces:**
- Consumes: POST /api/admin/login endpoint
- Produces: Login form, token storage in localStorage

- [ ] **Step 1: Create login screen HTML**

Replace entire admin.html with:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - Mentoría Binance</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
    .login-container { max-width: 400px; margin: 100px auto; padding: 40px; background: #1a1a1a; border-radius: 12px; border: 1px solid #333; }
    .login-container h1 { text-align: center; margin-bottom: 30px; color: #f0b90b; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; color: #aaa; font-size: 14px; }
    .form-group input { width: 100%; padding: 12px; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 16px; }
    .form-group input:focus { outline: none; border-color: #f0b90b; }
    .btn { width: 100%; padding: 14px; background: #f0b90b; color: #000; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:hover { background: #d4a50a; }
    .error { color: #ff4444; text-align: center; margin-top: 15px; display: none; }
    .dashboard { display: none; }
    .dashboard.active { display: block; }
    .login-container.hidden { display: none; }
  </style>
</head>
<body>
  <div class="login-container" id="loginScreen">
    <h1>Panel Admin</h1>
    <form id="loginForm">
      <div class="form-group">
        <label>Usuario</label>
        <input type="text" id="username" required autocomplete="username">
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <input type="password" id="password" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn">Entrar</button>
    </form>
    <div class="error" id="loginError"></div>
  </div>

  <div class="dashboard" id="dashboard">
    <!-- Dashboard content will be added in Task 3 -->
  </div>

  <script>
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    const API_BASE = window.location.origin;
    let authToken = localStorage.getItem('adminToken');

    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');

    function showError(msg) {
      loginError.textContent = msg;
      loginError.style.display = 'block';
    }

    function hideError() {
      loginError.style.display = 'none';
    }

    async function login(user, password) {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de autenticación');
      return data.token;
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();
      const user = document.getElementById('username').value;
      const pass = document.getElementById('password').value;
      try {
        const token = await login(user, pass);
        localStorage.setItem('adminToken', token);
        authToken = token;
        showDashboard();
      } catch (err) {
        showError(err.message);
      }
    });

    function showDashboard() {
      loginScreen.classList.add('hidden');
      dashboard.classList.add('active');
      loadDashboard();
    }

    async function loadDashboard() {
      // Will be implemented in Task 3
    }

    async function logout() {
      localStorage.removeItem('adminToken');
      authToken = null;
      location.reload();
    }

    // Check if already logged in
    if (authToken) {
      showDashboard();
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add admin.html
git commit -m "feat: login UI with token auth"
```

---

### Task 3: Frontend - Dashboard & Settings

**Files:**
- Modify: `admin.html` (dashboard content)

**Interfaces:**
- Consumes: GET /api/admin/stats, GET /api/admin/leads, GET /api/admin/settings, PUT /api/admin/settings
- Produces: Dashboard UI with stats, leads table, settings form

- [ ] **Step 1: Add dashboard HTML content**

Replace `<div class="dashboard" id="dashboard">` content with:

```html
<div class="dashboard" id="dashboard">
  <header style="display:flex;justify-content:space-between;align-items:center;padding:20px 40px;background:#1a1a1a;border-bottom:1px solid #333;">
    <h1 style="color:#f0b90b;">Panel Admin</h1>
    <button onclick="logout()" style="padding:10px 20px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;">Cerrar sesión</button>
  </header>

  <main style="max-width:1200px;margin:0 auto;padding:40px;">
    <section id="statsSection" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px;">
      <div style="background:#1a1a1a;padding:24px;border-radius:12px;border:1px solid #333;">
        <div style="color:#aaa;font-size:14px;">Total Leads</div>
        <div id="totalLeads" style="font-size:32px;font-weight:bold;color:#f0b90b;">0</div>
      </div>
      <div style="background:#1a1a1a;padding:24px;border-radius:12px;border:1px solid #333;">
        <div style="color:#aaa;font-size:14px;">Total Visitas</div>
        <div id="totalVisits" style="font-size:32px;font-weight:bold;color:#f0b90b;">0</div>
      </div>
    </section>

    <section style="margin-bottom:40px;">
      <h2 style="margin-bottom:20px;color:#fff;">Leads</h2>
      <div style="overflow-x:auto;">
        <table id="leadsTable" style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#333;">
              <th style="padding:12px 16px;text-align:left;color:#aaa;">Nombre</th>
              <th style="padding:12px 16px;text-align:left;color:#aaa;">Apellido</th>
              <th style="padding:12px 16px;text-align:left;color:#aaa;">Correo</th>
              <th style="padding:12px 16px;text-align:left;color:#aaa;">Precio</th>
              <th style="padding:12px 16px;text-align:left;color:#aaa;">Fecha</th>
            </tr>
          </thead>
          <tbody id="leadsBody"></tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 style="margin-bottom:20px;color:#fff;">Configuración</h2>
      <form id="settingsForm" style="background:#1a1a1a;padding:24px;border-radius:12px;border:1px solid #333;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;">
          <div class="form-group">
            <label>Precio (USDT)</label>
            <input type="number" id="settingPrecio" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label>Badge</label>
            <input type="text" id="settingBadge">
          </div>
          <div class="form-group">
            <label>Fecha</label>
            <input type="text" id="settingFecha">
          </div>
          <div class="form-group">
            <label>WhatsApp</label>
            <input type="text" id="settingWhatsapp">
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="settingDescuentoActivo"> Descuento activo
            </label>
          </div>
          <div class="form-group">
            <label>Porcentaje descuento (1-100)</label>
            <input type="number" id="settingDescuentoPercent" min="1" max="100">
          </div>
        </div>
        <button type="submit" class="btn" style="margin-top:20px;">Guardar cambios</button>
        <div id="settingsMessage" style="margin-top:15px;display:none;padding:12px;border-radius:8px;"></div>
      </form>
    </section>
  </main>
</div>
```

- [ ] **Step 2: Add dashboard JavaScript**

Add after `showDashboard()` function:

```javascript
async function loadDashboard() {
  try {
    const [statsRes, leadsRes, settingsRes] = await Promise.all([
      fetch(`${API_BASE}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/api/admin/leads`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/api/admin/settings`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    ]);

    if (statsRes.status === 401 || leadsRes.status === 401 || settingsRes.status === 401) {
      logout();
      return;
    }

    const stats = await statsRes.json();
    const leads = await leadsRes.json();
    const settings = await settingsRes.json();

    document.getElementById('totalLeads').textContent = stats.total_leads;
    document.getElementById('totalVisits').textContent = stats.total_visits;

    const leadsBody = document.getElementById('leadsBody');
    leadsBody.innerHTML = leads.map(lead => `
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:12px 16px;">${escapeHtml(lead.nombre)}</td>
        <td style="padding:12px 16px;">${escapeHtml(lead.apellido)}</td>
        <td style="padding:12px 16px;">${escapeHtml(lead.correo)}</td>
        <td style="padding:12px 16px;">${escapeHtml(String(lead.precio_final))}</td>
        <td style="padding:12px 16px;">${new Date(lead.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');

    document.getElementById('settingPrecio').value = settings.precio || '';
    document.getElementById('settingBadge').value = settings.badge || '';
    document.getElementById('settingFecha').value = settings.fecha || '';
    document.getElementById('settingWhatsapp').value = settings.whatsapp || '';
    document.getElementById('settingDescuentoActivo').checked = settings.descuento_activo === 'true';
    document.getElementById('settingDescuentoPercent').value = settings.descuento_percent || '';
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('settingsMessage');

  const settings = {
    precio: document.getElementById('settingPrecio').value,
    badge: document.getElementById('settingBadge').value,
    fecha: document.getElementById('settingFecha').value,
    whatsapp: document.getElementById('settingWhatsapp').value,
    descuento_activo: document.getElementById('settingDescuentoActivo').checked ? 'true' : 'false',
    descuento_percent: document.getElementById('settingDescuentoPercent').value
  };

  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(settings)
    });

    if (res.status === 401) {
      logout();
      return;
    }

    if (res.ok) {
      msgEl.textContent = 'Configuración guardada correctamente';
      msgEl.style.background = '#1a3a1a';
      msgEl.style.color = '#4ade80';
      msgEl.style.display = 'block';
      setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
    } else {
      const data = await res.json();
      msgEl.textContent = data.error || 'Error al guardar';
      msgEl.style.background = '#3a1a1a';
      msgEl.style.color = '#f87171';
      msgEl.style.display = 'block';
    }
  } catch (err) {
    msgEl.textContent = 'Error de conexión';
    msgEl.style.background = '#3a1a1a';
    msgEl.style.color = '#f87171';
    msgEl.style.display = 'block';
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat: dashboard with stats, leads table, settings form"
```

---

### Task 4: Deploy & Verify

**Files:**
- None (deployment only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working production deployment

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Deploy to Railway**

```bash
railway up
```

- [ ] **Step 3: Wait for deployment**

```bash
Start-Sleep -Seconds 90
```

- [ ] **Step 4: Verify deployment**

```bash
# Health check
curl.exe -s https://binance-mentoria-production.up.railway.app/api/health

# Test login
$body = '{"user":"admin","password":"admin123"}'
Invoke-WebRequest -Uri "https://binance-mentoria-production.up.railway.app/api/admin/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: FASE 3 complete - admin profesional con token auth"
```
