require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

let poolConfig = {};
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
      ssl: (url.hostname.includes('neon.tech') || url.hostname.includes('railway.app'))
        ? { rejectUnauthorized: false }
        : false
    };
  } catch (e) {
    poolConfig = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  }
}
const pool = new Pool(poolConfig);

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VISIT_COOLDOWN_MS = 5 * 60 * 1000;
const VISIT_CACHE_MAX = 5000;
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_BLOCK_MS = 15 * 60 * 1000;
const ALLOWED_SETTINGS = ['precio', 'badge', 'fecha', 'whatsapp', 'descuento_activo', 'descuento_percent'];
const LEAD_RATE_LIMIT_MS = 5 * 60 * 1000;
const LEAD_MAX_LENGTH = { nombre: 100, apellido: 100, correo: 254 };
const RATE_LIMIT_CACHE_MAX = 10000;
const LOGIN_RATE_LIMIT_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

const visitCache = new Map();
const authAttempts = new Map();
const leadRateLimit = new Map();
const adminTokens = new Map();
const loginAttempts = new Map();
let lastDbError = null;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

function visitCacheSet(key, value) {
  if (visitCache.size >= VISIT_CACHE_MAX) {
    const firstKey = visitCache.keys().next().value;
    visitCache.delete(firstKey);
  }
  visitCache.set(key, value);
}

function leadRateLimitSet(key, value) {
  if (leadRateLimit.size >= RATE_LIMIT_CACHE_MAX) {
    const firstKey = leadRateLimit.keys().next().value;
    leadRateLimit.delete(firstKey);
  }
  leadRateLimit.set(key, value);
}

function timestamp() {
  return new Date().toISOString();
}

function log(level, msg, extra) {
  const entry = `[${timestamp()}] [${level}] ${msg}`;
  if (extra) {
    console[level === 'error' ? 'error' : 'log'](entry, extra);
  } else {
    console[level === 'error' ? 'error' : 'log'](entry);
  }
}

async function initDB() {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log('log', `Intento ${attempt}/${MAX_RETRIES} de conexión a DB...`);
      const client = await pool.connect();
      log('log', 'DB conectada exitosamente');
      client.release();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      log('log', 'Tabla settings OK');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          apellido VARCHAR(255) NOT NULL,
          correo VARCHAR(255) NOT NULL UNIQUE,
          coupon_code VARCHAR(50),
          precio_final DECIMAL(10,2) DEFAULT 150,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50)");
      await pool.query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS precio_final DECIMAL(10,2) DEFAULT 150");
      log('log', 'Migración leads OK');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS visits (
          id SERIAL PRIMARY KEY,
          ip VARCHAR(45),
          user_agent TEXT,
          path VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log('log', 'Tabla visits OK');

      const defaults = {
        precio: '150',
        badge: 'Mentoría Exclusiva',
        fecha: 'Por confirmar',
        whatsapp: '584123456789',
        descuento_activo: 'false',
        descuento_percent: '0'
      };

      for (const [key, value] of Object.entries(defaults)) {
        await pool.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
          [key, value]
        );
      }
      log('log', 'Settings defaults insertados');

      log('log', 'Tablas inicializadas correctamente');
      lastDbError = null;
      return true;

    } catch (err) {
      lastDbError = err.message;
      log('error', `Error en intento ${attempt}/${MAX_RETRIES}:`, err.stack);
      if (attempt < MAX_RETRIES) {
        log('log', `Reintentando en ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  log('error', 'FATAL: No se pudo conectar a la DB después de 3 intentos');
  process.exit(1);
}

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

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch (err) {
    log('error', 'Error enviando Telegram:', err.message);
  }
}

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || process.env.RAILWAY_PUBLIC_URL || false)
    : '*'
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

// HTTPS enforcement (Railway handles TLS, but enforce at app level too)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(async (req, res, next) => {
  if (req.method !== 'GET' || req.path !== '/') return next();

  const ip = getClientIp(req);
  const now = Date.now();
  const lastVisit = visitCache.get(ip);

  if (lastVisit && (now - lastVisit) < VISIT_COOLDOWN_MS) {
    return next();
  }

  visitCacheSet(ip, now);
  setTimeout(() => visitCache.delete(ip), VISIT_COOLDOWN_MS);

  try {
    await pool.query(
      'INSERT INTO visits (ip, user_agent, path) VALUES ($1, $2, $3)',
      [ip, req.headers['user-agent'] || '', req.path]
    );
  } catch (err) {
    log('error', 'Error registrando visita:', err.message);
  }

  next();
});

app.get('/api/debug', async (req, res) => {
  const debug = {
    db_connected: false,
    tables: [],
    settings_count: 0,
    leads_count: 0,
    last_db_error: lastDbError
  };

  try {
    await pool.query('SELECT 1');
    debug.db_connected = true;

    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    debug.tables = tablesResult.rows.map(r => r.table_name);

    const settingsResult = await pool.query('SELECT COUNT(*) as count FROM settings');
    debug.settings_count = parseInt(settingsResult.rows[0].count);

    const leadsResult = await pool.query('SELECT COUNT(*) as count FROM leads');
    debug.leads_count = parseInt(leadsResult.rows[0].count);

  } catch (err) {
    debug.last_db_error = err.message;
    lastDbError = err.message;
  }

  res.json(debug);
});

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    log('error', 'Error leyendo settings:', err.message);
    res.status(500).json({ error: 'Error leyendo settings' });
  }
});

app.post('/api/leads', async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const lastLead = leadRateLimit.get(ip);

  if (lastLead && (now - lastLead) < LEAD_RATE_LIMIT_MS) {
    const remaining = Math.ceil((LEAD_RATE_LIMIT_MS - (now - lastLead)) / 1000);
    return res.status(429).json({ error: `Demasiadas solicitudes. Intenta en ${remaining} segundos.` });
  }

  let { nombre, apellido, correo } = req.body;

  if (typeof nombre !== 'string' || typeof apellido !== 'string' || typeof correo !== 'string') {
    return res.status(400).json({ errors: ['Campos inválidos'] });
  }

  nombre = nombre.trim().replace(/[<>]/g, '');
  apellido = apellido.trim().replace(/[<>]/g, '');
  correo = correo.trim().toLowerCase();

  const errors = [];
  if (!nombre || nombre.length < 2 || nombre.length > LEAD_MAX_LENGTH.nombre) errors.push('Nombre debe tener entre 2 y 100 caracteres');
  if (!apellido || apellido.length < 2 || apellido.length > LEAD_MAX_LENGTH.apellido) errors.push('Apellido debe tener entre 2 y 100 caracteres');
  if (!correo || !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(correo) || correo.length > LEAD_MAX_LENGTH.correo) errors.push('Correo inválido');
  if (req.body.coupon_code && typeof req.body.coupon_code === 'string' && req.body.coupon_code.length > 50) errors.push('Código de cupón muy largo');

  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const existing = await pool.query('SELECT id FROM leads WHERE correo = $1', [correo.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya estás registrado. Te contactaremos pronto.' });
    }
  } catch (err) {
    log('error', 'Error verificando duplicados:', err.message);
    return res.status(500).json({ error: 'Error verificando duplicados' });
  }

  let precioFinal = 150;
  let descuentoActivo = false;
  let descuentoPercent = 0;

  try {
    const settingsResult = await pool.query("SELECT key, value FROM settings WHERE key IN ('precio', 'descuento_activo', 'descuento_percent')");
    const settingsMap = {};
    settingsResult.rows.forEach(row => { settingsMap[row.key] = row.value; });

    const parsedPrecio = parseFloat(settingsResult.rows.find(r => r.key === 'precio')?.value);
    if (!isNaN(parsedPrecio) && parsedPrecio > 0) {
      precioFinal = parsedPrecio;
    }

    descuentoActivo = settingsMap.descuento_activo === 'true';
    const parsedDesc = parseInt(settingsMap.descuento_percent);
    if (!isNaN(parsedDesc) && parsedDesc >= 0 && parsedDesc <= 100) {
      descuentoPercent = parsedDesc;
    }
  } catch (err) {
    log('error', 'Error leyendo settings para lead:', err.message);
  }

  if (descuentoActivo && descuentoPercent > 0) {
    precioFinal = Math.max(0, precioFinal * (1 - descuentoPercent / 100));
  }

  try {
    const result = await pool.query(
      'INSERT INTO leads (nombre, apellido, correo, coupon_code, precio_final) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, precio_final',
      [nombre.trim(), apellido.trim(), correo.trim().toLowerCase(), null, precioFinal]
    );

    const lead = result.rows[0];
    log('log', `Nuevo lead: ${nombre} ${apellido} | ${correo} | ${precioFinal} USDT`);
    leadRateLimitSet(ip, now);

    const msgParts = [`Nuevo lead: ${nombre.trim()} ${apellido.trim()} | ${correo.trim()}`];
    if (descuentoActivo && descuentoPercent > 0) {
      msgParts.push(`Precio promocional: ${precioFinal} USDT (descuento ${descuentoPercent}%)`);
    } else {
      msgParts.push(`Precio: ${precioFinal} USDT`);
    }
    sendTelegram(msgParts.join('\n'));

    res.status(201).json({ id: lead.id, created_at: lead.created_at, precio_final: lead.precio_final });
  } catch (err) {
    log('error', 'Error guardando lead:', err.stack);
    res.status(500).json({ error: 'Error al guardar el lead' });
  }
});

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
  adminTokens.set(token, { user: user, createdAt: new Date().toISOString() });

  log('log', `Login exitoso desde IP ${ip}`);
  res.json({ token });
});

app.get('/api/admin/leads', tokenAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    log('error', 'Error obteniendo leads:', err.message);
    res.status(500).json({ error: 'Error obteniendo leads' });
  }
});

app.get('/api/admin/stats', tokenAuth, async (req, res) => {
  try {
    const totalLeads = await pool.query('SELECT COUNT(*) as count FROM leads');
    const totalVisits = await pool.query('SELECT COUNT(*) as count FROM visits');

    const visitsByDay = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM visits
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({
      total_leads: parseInt(totalLeads.rows[0].count),
      total_visits: parseInt(totalVisits.rows[0].count),
      visits_by_day: visitsByDay.rows
    });
  } catch (err) {
    log('error', 'Error obteniendo stats:', err.message);
    res.status(500).json({ error: 'Error obteniendo stats' });
  }
});

app.get('/api/admin/settings', tokenAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    log('error', 'Error obteniendo settings:', err.message);
    res.status(500).json({ error: 'Error obteniendo settings' });
  }
});

app.put('/api/admin/settings', tokenAuth, async (req, res) => {
  const updates = req.body;
  try {
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_SETTINGS.includes(key)) continue;
      const strValue = String(value).slice(0, 500);
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, strValue]
      );
    }
    log('log', 'Settings actualizados');
    res.json({ ok: true });
  } catch (err) {
    log('error', 'Error actualizando settings:', err.message);
    res.status(500).json({ error: 'Error actualizando settings' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

process.on('SIGTERM', () => {
  log('log', 'SIGTERM recibido, cerrando servidor...');
  pool.end().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  log('log', 'SIGINT recibido, cerrando servidor...');
  pool.end().then(() => process.exit(0));
});

initDB().then(() => {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of leadRateLimit.entries()) {
      if (now - value >= LEAD_RATE_LIMIT_MS) {
        leadRateLimit.delete(key);
      }
    }
  }, LEAD_RATE_LIMIT_MS);

  app.listen(PORT, () => {
    log('log', `Servidor corriendo en puerto ${PORT}`);
  });
});
