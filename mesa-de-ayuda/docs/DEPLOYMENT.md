# Guía de Despliegue en Producción (Render Free + Supabase) — Mesa de Ayuda

Esta guía documenta el procedimiento paso a paso para desplegar el backend de **Mesa de Ayuda** en el plan gratuito de **Render** y conectarlo de forma segura con la **Extensión de Chrome Manifest V3**, **Supabase PostgreSQL** y **Groq Cloud**.

---

## 1. Arquitectura de Despliegue

```text
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3) — PC del Agente             │
│  - Sin Node.js ni dependencias locales                      │
│  - Conexión HTTPS hacia la URL pública de Render            │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / Bearer JWT
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Render Free Web Service (Node.js 22+ / Express 5)          │
│  - URL: https://<tu-servicio>.onrender.com                  │
│  - Build: npm ci && npm run build                           │
│  - Start: npm start (node dist/server.js)                   │
│  - Trust Proxy activado (1) / Rate Limit por IP real        │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│  Supabase PostgreSQL (Free)  │ │  Groq API (Llama 3.1 8B)    │
│  - Conexión Pooler SSL       │ │  - Inferencia en la nube    │
│  - Migraciones Prisma        │ │  - Clave en backend seguro  │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Paso a Paso: Crear el Web Service en Render

1. Inicia sesión en tu cuenta gratuita de [Render](https://dashboard.render.com).
2. Haz clic en **New +** y selecciona **Web Service**.
3. Conecta tu repositorio de GitHub: `https://github.com/MichaelQR24/Mesa-de-Ayuda.git`.
4. Configura los siguientes parámetros en el asistente de creación:
   * **Name**: `mesa-de-ayuda-api` (o el nombre de tu preferencia).
   * **Region**: `Oregon (US West)` u `Ohio (US East)` (de preferencia la más cercana a tu base de datos Supabase).
   * **Branch**: `main`.
   * **Root Directory**: `mesa-de-ayuda/backend` *(¡Crítico! Asegurarse de apuntar a la subcarpeta del backend)*.
   * **Runtime**: `Node`.
   * **Build Command**: `npm ci && npm run build`
   * **Start Command**: `npm start`
   * **Plan Type**: `Free`.

---

## 3. Matriz de Variables de Entorno en Render

En la pestaña **Environment** de tu servicio en Render, agrega las siguientes variables (sin comillas):

| Variable | Valor Recomendado / Descripción |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` *(Render asigna automáticamente el puerto en runtime)* |
| `GROQ_API_KEY` | `gsk_...` *(Tu clave de API de Groq Cloud)* |
| `GROQ_MODEL` | `llama-3.1-8b-instant` |
| `DATABASE_URL` | Tu URI de Supabase con Connection Pooler (PGBouncer): `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Tu URI directa de Supabase (puerto 5432): `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres` |
| `JWT_ACCESS_SECRET` | Token criptográfico aleatorio de 64 caracteres (ejecuta `npm run secrets:generate` localmente para obtener uno nuevo). |
| `JWT_REFRESH_SECRET` | Token criptográfico aleatorio de 64 caracteres distinto al anterior. |
| `ACCESS_TOKEN_TTL` | `15m` |
| `REFRESH_TOKEN_TTL` | `7d` |
| `ALLOWED_EXTENSION_IDS` | ID público de tu extensión de Chrome (ver sección 4). |
| `AI_RATE_LIMIT_WINDOW_MS` | `60000` |
| `AI_RATE_LIMIT_MAX` | `20` |
| `AI_HISTORY_RETENTION_DAYS`| `90` |

---

## 4. Obtener y Configurar el ID Real de la Extensión Chrome

1. Abre Google Chrome y dirígete a: `chrome://extensions/`.
2. Activa el interruptor **Modo de desarrollador** en la esquina superior derecha.
3. Localiza la extensión **Mesa de Ayuda**.
4. Copia el **ID** alfanumérico (ejemplo: `abcdefghijklmnopabcdefghijklmnop`).
5. En Render, coloca ese ID en la variable de entorno `ALLOWED_EXTENSION_IDS`. Si varios agentes tienen extensiones con diferentes IDs generados localmente, puedes separar múltiples IDs por coma: `id1,id2,id3`.

---

## 5. Compilar la Extensión para Producción

1. Abre `mesa-de-ayuda/extension/.env.production` y actualiza la URL con la dirección asignada por Render:
   ```env
   VITE_API_BASE_URL=https://mesa-de-ayuda-api.onrender.com
   ```
2. Compila el paquete para producción:
   ```bash
   cd mesa-de-ayuda/extension
   npm run build
   ```
3. La carpeta resultante `mesa-de-ayuda/extension/dist` contiene la extensión lista para ser distribuida o instalada en cualquier PC mediante **"Cargar descomprimida"** en `chrome://extensions`.

---

## 6. Limitaciones del Plan Gratuito y Manejo de Cold Start

* **Spin-down por inactividad**: Los Web Services de Render Free entran en modo de suspensión tras **15 minutos sin recibir solicitudes**.
* **Cold Start (Despertar del servicio)**: La primera solicitud tras un periodo de inactividad puede tardar entre **20 y 45 segundos** en responder mientras Render levanta la instancia.
* **UX en la Extensión**: La extensión incluye temporizadores visuales informativos que avisan al usuario: *"Conectando con el servidor en la nube... esto puede tardar unos segundos si el servicio estaba en reposo"*, garantizando que no se interrumpa el flujo ni se produzcan solicitudes duplicadas.
* **Pausa de Supabase Free**: Si la base de datos de Supabase no recibe consultas durante varios días, Supabase puede pausar el proyecto. Para restaurarlo, basta con presionar **"Restore project"** en el panel de control de Supabase.

---

## 7. Protocolo de Rollback

* **Backend**:
  * Si un despliegue falla, haz clic en **Deploy -> Deploy a specific commit** en el panel de Render para volver a un commit previo estable.
  * O realiza un `git revert <commit>` en tu rama `main` y haz push a GitHub.
* **Extensión**:
  * Reinstala el paquete `dist` de la versión anterior.
* **Base de Datos**:
  * Las migraciones en producción no deben contener operaciones destructivas (`DROP TABLE`/`DROP COLUMN`) sin un plan de respaldo previo.
