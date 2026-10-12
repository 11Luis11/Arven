# Carrillo Store — Tienda + POS

React 19 + Vite + Supabase. Tienda pública (catálogo con compra por WhatsApp) y panel administrativo (POS, caja, inventario, reportes, finanzas).

## Puesta en marcha con una base nueva (≈10 minutos)

### 1. Crear el proyecto en Supabase (gratis)
1. Entra a https://supabase.com → **New project**.
2. **Region: South America (São Paulo) `sa-east-1`** — es la de menor latencia desde Perú.
3. Guarda la contraseña de la base en un lugar seguro.

### 2. Crear las tablas y la seguridad
Supabase → **SQL Editor** → New query → pega todo `supabase/schema.sql` → **Run**.
Luego ejecuta, en orden, los archivos de `supabase/migrations/` (por ejemplo `002_comprobantes_detallados.sql`).

### 3. Ajustes de autenticación
Supabase → **Authentication → Sign In / Providers → Email**:
- **Confirm email: desactivado** (las cuentas las crea el administrador).
- **Allow new users to sign up: activado** (necesario para crear colaboradores desde el panel; quien se registre por su cuenta queda *sin acceso* hasta que un admin lo active).

### 4. Crear tu usuario administrador
Supabase → **Authentication → Users → Add user → Create new user** (email + contraseña, marca *Auto Confirm User*).
El **primer** usuario del proyecto queda automáticamente como administrador activo.

### 5. Conectar la app
Supabase → **Project Settings → API**: copia *Project URL* y *anon public key* en un archivo `.env` (ver `.env.example`):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

En **Vercel → Settings → Environment Variables** agrega las mismas dos variables y vuelve a desplegar.

### 6. Probar
```
npm install
npm run dev
```
Entra a `/admin` con el usuario del paso 4. Los colaboradores se crean desde **Configuración → Usuarios**.

## Seguridad
- Contraseñas gestionadas por Supabase Auth (cifradas; nunca pasan por tablas públicas).
- Row Level Security: el público solo lee catálogo y configuración de la tienda; ventas, clientes y caja requieren sesión activa.
- Ventas, anulaciones y movimientos de caja se ejecutan en funciones del servidor (`create_sale`, `void_sale`, `add_cash_movement`): correlativo por secuencia, stock con bloqueo de fila y todo en una transacción.
- Solo puede haber una caja abierta a la vez.

## Plan gratuito de Supabase
- Límites: 500 MB de base, 1 GB de archivos, 5 GB de transferencia/mes.
- **Se pausa tras 1 semana sin actividad**: `api/keepalive.js` + el cron de `vercel.json` consultan la base una vez al día para evitarlo.
- **No incluye backups automáticos**: exporta periódicamente (Reportes → CSV, o Supabase → Database → Backups manuales).

> `supabase_setup.sql` es el esquema antiguo e inseguro; no lo uses.
