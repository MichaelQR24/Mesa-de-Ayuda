# Modelo de Seguridad y Threat Modeling — Mesa de Ayuda

## 1. Alcance y Arquitectura de Confianza (Trust Boundaries)

```text
┌─────────────────────────────────────────────────────────────┐
│  Páginas Web Externas (DOM) ──► [NO CONFIABLE]              │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mensajes Tipados / Sender Validation
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Content Script ──────────────► [NO CONFIABLE]              │
│  - Sin acceso a tokens JWT, API keys ni storage persistente │
└──────────────────────────────┬──────────────────────────────┘
                               │ runtime.sendMessage (Whitelist)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Side Panel & Service Worker ─► [SEMI-CONFIABLE]            │
│  - Access token en memoria efímera / SensitiveDataGuard UI   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS Bearer JWT / CORS Allowlist
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Express (Node.js) ──► [ZONA CONFIABLE]             │
│  - Zero Trust, SensitiveDataGuard backend, Rate Limiting    │
│  - Argon2id, Token Family Reuse Detection, Request ID       │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│  PostgreSQL (Supabase SSL)   │ │  Groq API (Llama 3.1)       │
│  - Secretos e IPs aisladas   │ │  - Texto sanitizado/redact  │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Threat Model (Matriz de Amenazas y Mitigaciones)

| # | Amenaza | Nivel de Riesgo | Controles Implementados | Riesgo Residual |
| :--- | :--- | :---: | :--- | :---: |
| **1** | **Usuario no autenticado / no autorizado** | Alto | Middleware `authenticate` (JWT) y `requireRole('ADMIN')` en todas las rutas operativas y administrativas. | Mínimo |
| **2** | **Cuenta comprometida / Fuerza bruta** | Alto | Hashing de contraseñas con **Argon2id**, rate limiting estricto (`authLimiter` de 15 intentos/15 min) y respuestas genéricas *("Credenciales incorrectas")*. | Mínimo |
| **3** | **Robo de Refresh Token / Session Hijacking** | Alto | **Token Family Reuse Detection**: Si un refresh token revocado intenta reutilizarse, se invalida toda la familia de sesiones activas del usuario de forma inmediata. | Bajo |
| **4** | **Página web hostil manipulando Content Script** | Alto | El Content Script no posee tokens ni credenciales. El Service Worker valida `sender.id === chrome.runtime.id` y aplica una lista blanca estricta de tipos de mensaje. | Bajo |
| **5** | **Cross-Site Scripting (Stored/DOM XSS)** | Alto | Eliminación de `innerHTML` para interpolación de datos dinámicos; uso sistemático de `escapeHtml`, `textContent` y creación segura de nodos DOM. | Mínimo |
| **6** | **Fuga de datos confidenciales hacia Groq** | Alto | **`SensitiveDataGuard`**: Bloquea contraseñas, API keys (`gsk_`, `sk-`, `ghp_`), JWTs, connection strings y claves privadas antes de salir del backend. Permite redacción y anonimización de DNI, emails y teléfonos. | Bajo |
| **7** | **Excedente de costos / Abuso de API Groq** | Medio | **Límites Mensuales por Usuario (`monthlyTokenLimit`)** y **Rate Limiting por minuto (`aiLimiter`)**. Verificación previa en backend que impide invocar a Groq si se supera la cuota. | Mínimo |
| **8** | **Insecure Direct Object Reference (IDOR)** | Medio | Verificación estricta de propiedad de objetos (`userId`) en consultas y mutaciones de historial y biblioteca. | Mínimo |
| **9** | **Inyección SQL** | Alto | Uso exclusivo de **Prisma ORM** con consultas parametrizadas. Prohibición total de `$queryRawUnsafe`. | Mínimo |
| **10** | **Filtración de secretos en logs** | Medio | Política estricta de logging: se registran `requestId`, `method`, `path`, `status` y duración; nunca se imprimen passwords, tokens ni cuerpos de texto. | Mínimo |
| **11** | **Prompt Injection** | Medio | Separación rígida entre `system instruction` y texto de usuario (`userText`). El modelo de Groq opera en modo de inferencia pura de redacción sin herramientas ejecutables (function calling desactivado). | Bajo |
| **12** | **Bloqueo del sistema por eliminación del último Admin** | Alto | **Protección `LAST_ADMIN_PROTECTED`**: El backend rechaza cualquier intento de desactivar o degradar al único administrador activo. | Mínimo |

---

## 3. Protocolo de Respuesta ante Incidentes y Rotación de Secretos

1. **Compromiso de `JWT_ACCESS_SECRET` o `JWT_REFRESH_SECRET`**:
   * Cambiar los secrets en las variables de entorno de producción.
   * Reiniciar el servidor backend (todas las sesiones previas quedarán invalidadas automáticamente forzando nuevo login).
2. **Compromiso de `GROQ_API_KEY`**:
   * Revocar la clave inmediatamente en la consola de Groq Cloud.
   * Generar una nueva clave y actualizar `GROQ_API_KEY` en el entorno seguro.
3. **Detección de Reutilización de Tokens (`REFRESH_TOKEN_REUSE_DETECTED`)**:
   * El sistema revoca automáticamente la familia de sesiones asociada y registra el evento en `AuditLog`.
   * El administrador puede inspeccionar la actividad en el Panel de Administración y revocar todas las sesiones del usuario afectado.
