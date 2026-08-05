# Mentoría Binance Venezuela — Landing Page

Landing page con captura de leads, panel admin, sistema de cupones y notificaciones.

## Estructura

```
/
├── server.js          # Express + PostgreSQL (API completa)
├── package.json
├── .env.example
├── railway.json
└── public/
    ├── index.html     # Landing page
    ├── styles.css     # Estilos
    ├── app.js         # Frontend: formulario, cupones, settings
    └── admin.html     # Panel administrativo
```

## Correr local

```bash
npm install
cp .env.example .env   # Editar con tus datos
npm start
```

El servidor arranca en `http://localhost:3000`.

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | 3000 |
| `DATABASE_URL` | Connection string PostgreSQL | requerido |
| `WHATSAPP_NUMBER` | Número de WhatsApp (código país + número) | 584123456789 |
| `ADMIN_PASSWORD` | Password para /admin | admin123 |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (opcional) | vacío |
| `TELEGRAM_CHAT_ID` | Chat ID de Telegram (opcional) | vacío |

## Endpoints

### Públicos
- `GET /` — Landing page
- `GET /api/health` — Health check
- `GET /api/settings` — Settings de la landing (precio, badge, fecha, whatsapp)
- `GET /api/coupons/:code` — Validar cupón
- `POST /api/leads` — Registrar lead (con validación y cupones)

### Admin (requiere HTTP Basic Auth)
- `GET /admin` — Panel administrativo
- `GET /api/admin/leads` — Lista de leads
- `GET /api/admin/stats` — Estadísticas (visitas, leads, gráfico 7 días)
- `GET /api/admin/settings` — Obtener settings
- `PUT /api/admin/settings` — Actualizar settings
- `GET /api/admin/coupons` — Lista de cupones
- `POST /api/admin/coupons` — Crear cupón
- `DELETE /api/admin/coupons/:id` — Eliminar cupón

## Features

### Landing dinámica
La landing carga settings del backend al iniciar. El admin puede cambiar precio, badge, fecha y número de WhatsApp sin tocar código.

### Sistema de cupones
- Crear cupones desde /admin con descuento porcentaje y máximo de usos
- El formulario tiene campo "Código de descuento" opcional
- Al aplicar cupón: muestra precio tachado y precio final
- Al enviar lead: calcula precio_final basado en descuento

### Validación de leads
- Nombre y apellido: mínimo 2 caracteres
- Correo: formato válido, no duplicados (409 si ya existe)
- Errores devueltos como array

### Panel admin
- Acceso: `http://localhost:3000/admin` (Basic Auth)
- Dashboard: leads, visitas, gráfico de barras 7 días
- Settings: editar precio, badge, fecha, WhatsApp
- Cupones: crear, listar, eliminar

### Notificaciones Telegram
Si `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están seteados, envía mensaje a Telegram cada vez que se registra un lead.

## Deploy en Railway

1. Crear repo GitHub y pushear
2. Railway: New Project → Deploy from GitHub
3. Railway: New → Database → PostgreSQL
4. Copiar `DATABASE_URL` del servicio PostgreSQL al servicio de la app
5. Setear variables: `ADMIN_PASSWORD`, `WHATSAPP_NUMBER`, opcionalmente `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`
6. Deploy automático

## Tablas PostgreSQL

- `leads` — id, nombre, apellido, correo (unique), coupon_code, precio_final, created_at
- `settings` — key (PK), value
- `visits` — id, ip, user_agent, path, created_at
- `coupons` — id, code (unique), discount_percent, max_uses, uses_count, active
