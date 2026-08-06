# FASE 3: Admin Profesional - Design Spec

## Overview
Replace Basic Auth with token-based authentication and build a professional admin dashboard with login UI, stats, leads management, and settings editor.

## Architecture

### Backend Changes (server.js)

#### Auth System
- **POST /api/admin/login**: Validates `{user, password}` against `ADMIN_USER/ADMIN_PASSWORD`
  - Rate limit: 5 attempts per IP, 15min block
  - Success: generate 64-char hex token via `crypto.randomBytes(32).toString('hex')`
  - Store in `Map<token, {user, createdAt}>`
  - Return `{token}`
- **Middleware `tokenAuth`**: Replaces `basicAuth`
  - Read `Authorization: Bearer <token>` header
  - Look up in token Map
  - 401 if invalid/missing
- Tokens do not expire (MVP simplicity)

#### Endpoints Updated
All `/api/admin/*` endpoints use `tokenAuth` instead of `basicAuth`:
- `GET /api/admin/leads` → list leads
- `GET /api/admin/stats` → {total_leads, total_visits, visits_by_day}
- `GET /api/admin/settings` → settings object
- `PUT /api/admin/settings` → update settings (whitelist)

### Frontend Changes (admin.html)

#### Login Screen
- Form: username input, password input, "Entrar" button
- Error display: red text for invalid credentials
- On success: store token in `localStorage`, load dashboard
- On load: check `localStorage` for token, skip login if exists

#### Dashboard
- Header: "Panel Admin" + "Cerrar sesión" button
- Stats cards: total leads, total visits
- Leads table: nombre, apellido, correo, precio_final, created_at
- Settings form: precio (number), badge (text), fecha (text), whatsapp (text), descuento_activo (checkbox), descuento_percent (number 1-100)
- "Guardar cambios" button → PUT /api/admin/settings
- Confirmation message on save

#### Security
- `escapeHtml()` function for all API data injection
- Token stored in localStorage (cleared on logout)

## Files Modified
- `server.js` — auth system, middleware replacement
- `admin.html` — login UI, dashboard, settings form

## Constraints
- No npm dependencies added
- Vanilla JS only
- Do not modify index.html or styles.css
