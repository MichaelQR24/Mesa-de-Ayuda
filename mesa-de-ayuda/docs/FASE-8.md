# Fase 8: Panel de Administración

## Objetivo
Implementar una interfaz de administración completa y profesional para usuarios con rol `ADMIN`, accesible como una página dedicada dentro de la extensión de Chrome (`chrome-extension://<id>/src/admin/index.html`), permitiendo la gestión integral de usuarios, cuotas y límites de consumo de tokens de IA, biblioteca compartida, registro de auditoría y revocación de sesiones, sin necesidad de interactuar directamente con la consola de Supabase.

---

## 1. Arquitectura del Panel Administrativo

```text
┌─────────────────────────────────────────────────────────────┐
│  Panel de Administración (Página Completa de Extensión)     │
│  - src/admin/index.html + admin.css + admin.ts              │
│  - Sidebar: Resumen | Usuarios | Consumo | Biblioteca |     │
│             Actividad | Seguridad                           │
└──────────────────────────────┬──────────────────────────────┘
                               │ admin-api-client.ts (Bearer JWT + Auto-refresh)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Express (http://localhost:3000)                    │
│  - Middleware: authenticate + requireRole('ADMIN')          │
│  - Rutas: /api/v1/admin/*                                   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│  Supabase PostgreSQL         │ │  AiService (Groq Llama 3.1) │
│  - users (monthlyTokenLimit) │ │  - Chequeo de límite previo │
│  - audit_logs (Auditoría)    │ │  - HTTP 429 si excede cuota │
│  - ai_histories / sessions   │ └─────────────────────────────┘
└──────────────────────────────┘
```

---

## 2. Control de Acceso y Roles (RBAC)

* **Restricción Estricta**: Todas las rutas bajo `/api/v1/admin/*` requieren token JWT válido y rol `ADMIN`.
* **Respuesta para `USER`**: Si un usuario estándar intenta invocar un endpoint administrativo, recibe:
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "No cuentas con los permisos necesarios para realizar esta acción."
    }
  }
  ```
* **Frontend**: Si un usuario `USER` abre directamente la URL de administración, la interfaz detecta el rol y bloquea el acceso mostrando un mensaje de acceso denegado y la opción de volver al Asistente.

---

## 3. Modelo de Datos y Migraciones Prisma

### Modificaciones en `schema.prisma`:
1. **`User`**:
   - `monthlyTokenLimit Int?`: Límite mensual de tokens de IA (nullable; `null` indica cuota ilimitada).
   - Relación `auditLogs AuditLog[]`.
2. **`AuditLog`**:
   - `id String @id @default(uuid())`
   - `actorUserId String`
   - `action String` (`USER_CREATED`, `USER_UPDATED`, `USER_ROLE_CHANGED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_PASSWORD_RESET`, `USER_LIMIT_CHANGED`, `SHARED_TEMPLATE_CREATED`, `SHARED_TEMPLATE_UPDATED`, `SHARED_TEMPLATE_DELETED`, `SESSIONS_REVOKED`)
   - `targetType String` (`USER`, `LIBRARY_ITEM`, `SESSION`)
   - `targetId String?`
   - `metadata Json?` (mínima y segura: **NUNCA contraseñas ni tokens**)
   - `createdAt DateTime @default(now())`
   - Índices optimizados: `@@index([createdAt])`, `@@index([actorUserId])`, `@@index([action])`.
3. **`AiHistory`**:
   - Índice compuesto: `@@index([userId, createdAt])` para agregación mensual eficiente.

---

## 4. Endpoints Administrativos Implementados

### Gestión de Usuarios (`/api/v1/admin/users`)
* `GET /api/v1/admin/users`: Listado paginado con búsqueda (`displayName`, `email`) y filtros por `role` y `status`.
* `POST /api/v1/admin/users`: Creación de nuevo usuario con contraseña temporal y `mustChangePassword = true`.
* `PATCH /api/v1/admin/users/:id`: Edición de nombre y rol (con protección del último admin).
* `PATCH /api/v1/admin/users/:id/status`: Activación o desactivación. Al desactivar, revoca inmediatamente todas las sesiones activas del usuario.
* `POST /api/v1/admin/users/:id/reset-password`: Reseteo de contraseña temporal con revocación de sesiones.
* `PATCH /api/v1/admin/users/:id/usage-limit`: Asignación o eliminación de límite mensual de tokens.

### Consumo y Métricas (`/api/v1/admin/usage`)
* `GET /api/v1/admin/usage/summary`: Métricas globales (usuarios activos/inactivos, consultas hoy, consultas mes, tokens mes entrada/salida/total, costo estimado USD y plantillas compartidas).
* `GET /api/v1/admin/usage/users`: Consumo detallado por usuario con límite, porcentaje de uso y costo individual.

### Biblioteca Compartida (`/api/v1/admin/library`)
* `GET /api/v1/admin/library`: Lista todas las plantillas de equipo (`isShared = true`).
* `POST /api/v1/admin/library`: Creación de plantilla forzando `isShared = true` desde el backend.
* `PATCH /api/v1/admin/library/:id`: Edición de plantilla compartida.
* `DELETE /api/v1/admin/library/:id`: Eliminación de plantilla compartida.

### Auditoría (`/api/v1/admin/audit`)
* `GET /api/v1/admin/audit`: Consulta paginada del registro de auditoría con filtros por acción y fecha.

### Sesiones y Seguridad (`/api/v1/admin/sessions`)
* `GET /api/v1/admin/sessions/summary`: Conteo de sesiones activas y revocadas.
* `POST /api/v1/admin/sessions/users/:id/revoke-sessions`: Revocación total inmediata de todas las sesiones de un usuario.

---

## 5. Medidas de Seguridad y Protección Crítica

1. **Protección del Último Administrador (`LAST_ADMIN_PROTECTED`)**:
   - El backend cuenta cuántos administradores activos existen (`userRepository.countActiveAdmins()`).
   - Si solo queda 1 administrador activo, se bloquea cualquier intento de desactivarlo o cambiar su rol a `USER`, evitando el bloqueo del sistema.
2. **Aplicación Estricta de Límites en Backend**:
   - Antes de llamar a la API de Groq, `AiService` calcula los tokens consumidos por el usuario en el mes en curso.
   - Si `usedTokens >= user.monthlyTokenLimit`, la llamada se detiene antes de enviar la petición a Groq y responde `429 Too Many Requests` con código `MONTHLY_AI_LIMIT_REACHED`.
3. **Cero Exposición de Secretos**:
   - Ningún endpoint administrativo serializa `passwordHash`, `tokenHash`, `GROQ_API_KEY` ni cadenas de conexión.
   - Los registros de auditoría almacenan únicamente metadatos no sensibles.

---

## 6. Configuración Centralizada de Precios de IA

En `backend/src/config/pricing.config.ts`:
* Modelo `llama-3.1-8b-instant`:
  * Entrada: $0.05 por millón de tokens.
  * Salida: $0.08 por millón de tokens.
* Función de cálculo: `calculateEstimatedCostUsd(model, inputTokens, outputTokens)`.

---

## 7. Pruebas y Validación

* **Tests Backend (`vitest run`)**: **52/52 tests pasando al 100%** en 9 suites.
* **Backend Typecheck (`tsc --noEmit`)**: **0 errores**.
* **Backend Build (`tsc`)**: **0 errores**.
* **Extensión Typecheck (`tsc --noEmit`)**: **0 errores**.
* **Extensión Build (`vite build`)**: **0 errores** (`dist/src/admin/index.html` y assets generados).
