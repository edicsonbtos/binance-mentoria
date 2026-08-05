const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false
});

const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VISIT_COOLDOWN_MS = 5 * 60 * 1000;
const VISIT_CACHE_MAX = 5000;
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_BLOCK_MS = 15 * 60 * 1000;
const ALLOWED_SETTINGS = ['precio', 'badge', 'fecha', 'whatsapp', 'descuento_activo', 'descuento_percent'];

const visitCache = new Map();
const authAttempts = new Map();

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

async function initDB() {
  try {
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(45),
        user_agent TEXT,
        path VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        discount_percent INT NOT NULL DEFAULT 0,
        max_uses INT NOT NULL DEFAULT 100,
        uses_count INT NOT NULL DEFAULT 0,
        active BOOLEAN DEFAULT true
      )
    `);

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

    console.log('Tablas inicializadas');
  } catch (err) {
    console.error('Error inicializando DB:', err.message);
  }
}

function basicAuth(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const attempts = authAttempts.get(ip);

  if (attempts && attempts.count >= AUTH_MAX_ATTEMPTS && now < attempts.resetTime) {
    const remaining = Math.ceil((attempts.resetTime - now) / 60000);
    return res.status(429).json({ error: `Demasiados intentos. Intenta en ${remaining} minutos.` });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: 'Autenticación requerida' });
  }

  const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [user, pass] = decoded.split(':');

  if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
    authAttempts.delete(ip);
    return next();
  }

  if (!attempts || now >= attempts.resetTime) {
    authAttempts.set(ip, { count: 1, resetTime: now + AUTH_BLOCK_MS });
  } else {
    attempts.count++;
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).json({ error: 'Credenciales inválidas' });
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
    console.error('Error enviando Telegram:', err.message);
  }
}

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || process.env.RAILWAY_PUBLIC_URL || false)
    : '*'
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
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
    console.error('Error registrando visita:', err.message);
  }

  next();
});

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Error leyendo settings' });
  }
});

app.post('/api/leads', async (req, res) => {
  const { nombre, apellido, correo } = req.body;
  const errors = [];

  if (!nombre || nombre.trim().length < 2) errors.push('Nombre debe tener al menos 2 caracteres');
  if (!apellido || apellido.trim().length < 2) errors.push('Apellido debe tener al menos 2 caracteres');
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errors.push('Correo inválido');

  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const existing = await pool.query('SELECT id FROM leads WHERE correo = $1', [correo.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya estás registrado. Te contactaremos pronto.' });
    }
  } catch (err) {
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
  } catch (err) {}

  if (descuentoActivo && descuentoPercent > 0) {
    precioFinal = Math.max(0, precioFinal * (1 - descuentoPercent / 100));
  }

  try {
    const result = await pool.query(
      'INSERT INTO leads (nombre, apellido, correo, coupon_code, precio_final) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, precio_final',
      [nombre.trim(), apellido.trim(), correo.trim().toLowerCase(), null, precioFinal]
    );

    const lead = result.rows[0];
    const msgParts = [`Nuevo lead: ${nombre.trim()} ${apellido.trim()} | ${correo.trim()}`];
    if (descuentoActivo && descuentoPercent > 0) {
      msgParts.push(`Precio promocional: ${precioFinal} USDT (descuento ${descuentoPercent}%)`);
    } else {
      msgParts.push(`Precio: ${precioFinal} USDT`);
    }
    sendTelegram(msgParts.join('\n'));

    res.status(201).json({ id: lead.id, created_at: lead.created_at, precio_final: lead.precio_final });
  } catch (err) {
    console.error('Error guardando lead:', err.message);
    res.status(500).json({ error: 'Error al guardar el lead' });
  }
});

app.get('/api/admin/leads', basicAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo leads' });
  }
});

app.get('/api/admin/stats', basicAuth, async (req, res) => {
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
    res.status(500).json({ error: 'Error obteniendo stats' });
  }
});

app.get('/api/admin/settings', basicAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo settings' });
  }
});

app.put('/api/admin/settings', basicAuth, async (req, res) => {
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
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando settings' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
});
