# Fase 9: Hardening de Seguridad y Privacidad

## Objetivo
Revisar, robustecer, proteger y auditar exhaustivamente toda la superficie de seguridad, autenticación, mensajería de extensión y protección de datos antes del despliegue en producción.

---

## 1. Detección y Bloqueo de Datos Sensibles (`SensitiveDataGuard`)

Se implementó el módulo [backend/src/utils/sensitive-data.guard.ts](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/backend/src/utils/sensitive-data.guard.ts) y su contraparte en frontend [extension/src/utils/sensitive-data.guard.ts](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/extension/src/utils/sensitive-data.guard.ts):

* **Categoría `BLOCKED` (Bloqueo Inmediato)**:
  * Contraseñas o credenciales explícitas (`password: ...`, `clave=...`).
  * API Keys (`gsk_`, `sk-`, `ghp_`, `AKIA`).
  * Tokens JWT (`eyJ...`) y encabezados `Bearer`.
  * Cadenas de conexión a base de datos (`postgres://`, `mongodb://`, `mysql://`).
  * Claves privadas PEM (`BEGIN PRIVATE KEY`).
  * Tarjetas de crédito probables (Luhn pattern).
  * **Comportamiento**: La solicitud se detiene antes de Groq (HTTP 400 `SENSITIVE_DATA_BLOCKED`), no se persiste texto en la base de datos y se registra auditoría con los tipos detectados sin exponer valores.
* **Categoría `WARNING` y Anonimización**:
  * DNI peruano (8 dígitos), teléfonos y correos electrónicos.
  * Se ofrece al usuario la opción de **"Anonimizar datos personales antes de enviar"**, sustituyendo los datos por marcadores `[EMAIL_1]`, `[TEL_2]`, `[DNI_3]` antes de viajar a Groq y restaurándolos determinísticamente en la respuesta.

---

## 2. Hardening de Autenticación y Sesiones

1. **Token Family & Reuse Detection**:
   * Cada sesión pertenece a un `familyId`.
   * Si un atacante intenta reutilizar un refresh token antiguo/revocado, el backend detecta el reuse, revoca de inmediato **toda la familia de sesiones activas** y registra el incidente en `AuditLog`.
2. **Protección de Contraseñas (Argon2id)**:
   * Validación para impedir que la nueva contraseña sea idéntica a la actual.
   * Respuestas genéricas de error (`Credenciales incorrectas`) para evitar enumeración de usuarios.
3. **Control de Consentimiento de Historial (`saveAiHistory`)**:
   * Cada usuario puede activar o desactivar el guardado de historial (`PATCH /api/v1/auth/privacy`).
   * Si está desactivado (`saveAiHistory: false`), Groq procesa normalmente pero `originalText` y `resultText` se almacenan como `null` en PostgreSQL, preservando el conteo de tokens para auditoría y límites sin retener contenido.

---

## 3. Hardening de la Extensión Chrome (Manifest V3)

1. **Content Script con Cero Privilegios**:
   * No tiene acceso a tokens JWT, credenciales ni claves de API.
   * No interactúa directamente con el backend ni con `chrome.storage` seguro.
2. **Validación de Mensajes y Sender**:
   * Service Worker valida `sender.id === chrome.runtime.id`.
   * Lista blanca estricta de mensajes permitidos (`GET_SELECTED_TEXT`, `REPLACE_SELECTION`, `LOAD_SELECTION`, `PING`).
3. **Protección de Reemplazo en DOM**:
   * Prohibición absoluta de captura y reemplazo en `input[type="password"]`, `input[type="hidden"]`, `input[type="file"]`, campos `readonly`, `disabled` o campos de tarjeta de crédito.

---

## 4. Hardening de Red y Cabeceras HTTP

* **CORS Allowlist**: Bloqueo de comodín `*` en entornos restringidos y validación de IDs de extensión (`ALLOWED_EXTENSION_IDS`) y dominios configurados.
* **Request ID (`X-Request-Id`)**: Inyección de UUID v4 en cada solicitud para trazabilidad y soporte técnico.
* **Helmet**: Configurado con cabeceras de protección HTTP.
* **Rate Limiting Multicapa**:
  * `apiLimiter`: 200 req / 15 min.
  * `authLimiter`: 15 intentos / 15 min.
  * `aiLimiter`: 20 consultas / 1 min por usuario/IP (`AI_RATE_LIMIT_MAX`).

---

## 5. Scripts de Auditoría y Verificación

* `npm run security:check`: Comprueba variables de entorno críticas, longitud de secretos JWT (>= 32 caracteres) y configuración de producción.
* `npm run security:secrets`: Escanea el repositorio descartando posibles secretos hardcodeados.
* `npm run history:cleanup:dry-run`: Simula la purga de historiales mayores a `AI_HISTORY_RETENTION_DAYS`.

---

## 6. Resultados de Verificación

* **Tests de Seguridad y Aplicación**: **64/64 tests aprobados (100%)** en 10 suites.
* **Typecheck Backend y Extensión**: **0 errores**.
* **Builds**: **0 errores**.
* **npm audit**: **0 vulnerabilidades**.
* **Escaneo de secretos**: **0 secretos detectados**.
