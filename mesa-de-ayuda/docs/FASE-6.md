# Fase 6: Autenticación, Usuarios y Roles

## Objetivo
Implementar un sistema de autenticación seguro, modular y sin registro público para la extensión **Mesa de Ayuda**, garantizando el aislamiento de datos por usuario (historial, favoritos y plantillas privadas), control de acceso basado en roles (`ADMIN` y `USER`), hashing criptográfico con **Argon2id**, sesiones basadas en tokens JWT y refresh tokens rotativos almacenados mediante hash SHA-256 en PostgreSQL (Supabase).

---

## 1. Arquitectura de Autenticación

```text
┌──────────────────────────────┐
│  Side Panel (Chrome MV3)     │
└──────────────┬───────────────┘
               │  1. POST /api/v1/auth/login (email + password)
               ▼
┌──────────────────────────────┐
│  Express Backend API         │ ────► Argon2id verify ────► AuthSession (SHA-256)
└──────────────┬───────────────┘
               │  2. Devuelve: { user, accessToken (15m), refreshToken (7d) }
               ▼
┌──────────────────────────────┐
│  Almacenamiento en Chrome    │
│  - Access: chrome.storage.session (Memoria segura de extensión)
│  - Refresh: chrome.storage.local (Persistencia entre aperturas)
└──────────────────────────────┘
```

---

## 2. Contraseñas y Política de Seguridad

* **Algoritmo de Hashing**: **Argon2id** (`memoryCost: 64MB`, `timeCost: 3`, `parallelism: 4`).
  * Estándar moderno de máxima resistencia contra ataques de fuerza bruta y GPU/ASIC.
* **Política de Contraseña**:
  * Mínimo 10 caracteres, máximo 128 caracteres.
  * Al menos una letra (`[a-zA-Z]`).
  * Al menos un número (`[0-9]`).
  * Permite pegar desde gestores de contraseñas.
* **Flujo de Primer Acceso**:
  * Todo usuario creado por un administrador nace con `mustChangePassword: true`.
  * Al iniciar sesión, la interfaz bloquea el acceso operativo y redirige obligatoriamente a la vista de **Cambio de Contraseña**.
  * Una vez cambiada, se actualiza `passwordChangedAt`, se apaga `mustChangePassword` y se revocan sesiones anteriores.

---

## 3. Manejo de Sesiones y Tokens

| Token | Formato | Vida Útil | Almacenamiento | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **Access Token** | JWT firmado (`HS256`) | 15 minutos (`15m`) | `chrome.storage.session` | Autorizar peticiones en cabecera `Authorization: Bearer <token>`. |
| **Refresh Token** | Cadena aleatoria de 48 bytes | 7 días (`7d`) | `chrome.storage.local` / PostgreSQL (`AuthSession`) | Rotar tokens y renovar sesión sin pedir contraseña. |

### Rotación de Refresh Tokens en PostgreSQL (`AuthSession`)
* El backend **nunca** guarda el refresh token en texto plano; almacena su hash **SHA-256**.
* Cada vez que se solicita `POST /api/v1/auth/refresh`, se ejecuta una **transacción atómica en Prisma** que revoca el token anterior (`revokedAt = now()`) y genera un nuevo par de tokens.
* Al cerrar sesión (`POST /api/v1/auth/logout`), se revoca la sesión activa.

---

## 4. Endpoints de la API REST

### Autenticación (`/api/v1/auth`)
* `POST /api/v1/auth/login`: Inicia sesión con rate limit estricto (10 intentos / 15 min).
* `POST /api/v1/auth/refresh`: Renueva y rota el par de tokens.
* `POST /api/v1/auth/logout`: Revoca la sesión actual.
* `GET /api/v1/auth/me`: Devuelve el perfil público del usuario autenticado.
* `POST /api/v1/auth/change-password`: Cambia la contraseña (requiere contraseña actual y nueva).

### Administración de Usuarios (`/api/v1/admin/users`) *(Solo ADMIN)*
* `GET /api/v1/admin/users`: Lista todos los usuarios registrados.
* `POST /api/v1/admin/users`: Crea un nuevo usuario con contraseña temporal (`mustChangePassword: true`).
* `PATCH /api/v1/admin/users/:id/status`: Activa o desactiva (`ACTIVE` / `INACTIVE`). Si pasa a `INACTIVE`, revoca todas sus sesiones activas de inmediato.
* `POST /api/v1/admin/users/:id/reset-password`: Asigna una nueva contraseña temporal y revoca sesiones previas.

---

## 5. Control de Acceso y Ownership

* **Inferencia de IA (`POST /api/v1/ai/process`)**: Requiere autenticación obligatoria y asocia automáticamente el registro a `AiHistory.userId = req.user.id`.
* **Historial (`GET /api/v1/history`)**: Cada usuario solo puede consultar sus propias inferencias.
* **Biblioteca (`/api/v1/library`)**:
  * Un usuario normal solo puede ver y gestionar sus textos personales (`userId = req.user.id`) y consultar las plantillas compartidas (`isShared = true`).
  * Un usuario no puede editar ni borrar plantillas privadas de otros usuarios (HTTP 403 `FORBIDDEN`).
  * Solo los administradores pueden crear o marcar plantillas como compartidas para todo el equipo.

---

## 6. Inicialización de Usuario Administrador (Bootstrap)

Para crear el primer administrador en una base de datos limpia:

```bash
cd mesa-de-ayuda/backend
npm run admin:create
```

El script solicitará por terminal de forma interactiva:
1. Correo electrónico del Administrador.
2. Nombre completo.
3. Contraseña inicial segura.

*(Hashea con Argon2id, crea el usuario con rol `ADMIN`, estado `ACTIVE` y `mustChangePassword: false`).*

---

## 7. Variables de Entorno

En `backend/.env`:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
GROQ_API_KEY=gsk_tu_clave_aqui
GROQ_MODEL=llama-3.1-8b-instant
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require"

# Secretos y tiempos de vida de JWT
JWT_ACCESS_SECRET=clave_secreta_para_access_tokens_minimo_32_caracteres
JWT_REFRESH_SECRET=clave_secreta_para_refresh_tokens_minimo_32_caracteres
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
```

---

## 8. Verificación y Pruebas Automatizadas

```bash
cd mesa-de-ayuda/backend
npm run test
```
*Ejecuta 30 pruebas unitarias y de integración en 7 suites:*
* `auth.test.ts`: Login correcto, credenciales inválidas, usuarios inactivos, `/me`.
* `admin-user.test.ts`: Creación de usuarios por ADMIN, rechazo a rol USER (403), desactivación y revocación de sesiones.
* `ai.test.ts`: Validación de autenticación obligatoria y mock de inferencia.
* `history.test.ts`: Aislamiento de historial por usuario autenticado.
* `library.test.ts`: Control de ownership y permisos de edición/eliminación.
* `health.test.ts` y `test.test.ts`.

---

## 9. Consideraciones para Producción Futura
1. **HTTPS / TLS Obligatorio**: En producción, el tráfico entre la extensión y el backend debe circular exclusivamente bajo TLS/HTTPS.
2. **CORS Restringido**: Sustituir `CORS_ORIGIN=*` por el ID exacto de la extensión empaquetada (`chrome-extension://<EXTENSION_ID>`).
3. **Rotación Periódica de Claves JWT**: Definir secretos criptográficos de alta entropía generados aleatoriamente (`crypto.randomBytes(64).toString('hex')`).
