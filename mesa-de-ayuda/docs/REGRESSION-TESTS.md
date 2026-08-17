# Checklist Maestro de Pruebas de Regresión — Mesa de Ayuda

Este checklist debe ejecutarse y completarse antes de liberar cualquier nueva versión o despliegue a producción.

---

## 1. Verificaciones Automatizadas (CI/Pre-Deploy)

- [ ] **TypeScript Check**: `npm run typecheck` en backend y extensión (0 errores).
- [ ] **Prisma Schema**: `npx prisma validate` en backend (esquema válido).
- [ ] **Unit & Integration Tests**: `npm run test` en backend (100% de tests aprobados).
- [ ] **Security Checks**: `npm run security:check` y `npm run security:secrets` (0 secretos ni advertencias).
- [ ] **npm audit**: `npm audit` en backend y extensión (0 vulnerabilidades críticas/altas).
- [ ] **Production Build**: `npm run build` en backend (`dist/server.js`) y extensión (`dist/` generado).

---

## 2. Autenticación y Control de Sesiones

- [ ] **Login Exitoso**: Login con credenciales válidas redirige al Side Panel con nombre de usuario visible.
- [ ] **Credenciales Inválidas**: Mensaje genérico `Credenciales incorrectas` sin revelar existencia de correos.
- [ ] **Token Expirado / Refresh**: El token de acceso expira en 15m y se refresca automáticamente sin desconectar al usuario.
- [ ] **Token Reuse Detection**: Reutilizar un refresh token revocado invalida inmediatamente todas las sesiones del usuario (`TOKEN_REUSE_DETECTED`).
- [ ] **Primer Inicio de Sesión (`mustChangePassword`)**: Forzar cambio de contraseña antes de acceder a la aplicación.
- [ ] **Cambio de Contraseña**: Rechazar cambio si la nueva clave es idéntica a la anterior.
- [ ] **Logout**: Cierre de sesión revoca token en backend y limpia storage local/sesión en Chrome.

---

## 3. Integración con Páginas Web y Menú Contextual

- [ ] **Captura desde Textarea**: Seleccionar texto en textarea corporativo y abrir Side Panel con el texto cargado.
- [ ] **Captura desde Input**: Seleccionar texto en input de texto/email/búsqueda.
- [ ] **Reemplazo Seguro**: Sustituir texto en input/textarea preservando el texto anterior y posterior sin romper eventos DOM (`input`, `change`).
- [ ] **Bloqueo en Campos Protegidos**: Imposibilidad de seleccionar o reemplazar en `input[type="password"]`, `hidden`, `file`, tarjetas de crédito, `readonly` o `disabled`.
- [ ] **Invalidación por Cambio de Pestaña**: Cambiar de pestaña activa desactiva el botón de Reemplazar de forma segura.
- [ ] **Menú Contextual Chrome**: Las 6 opciones del menú contextual (*Corregir, Parafrasear, Profesionalizar, Resumir, Responder, Enviar al asistente*) abren el panel y ejecutan/cargan la acción indicada.

---

## 4. Transformaciones de IA (Groq + Llama 3.1)

- [ ] **Corregir**: Corrige ortografía, sintaxis y puntuación sin alterar el sentido ni inventar hechos.
- [ ] **Parafrasear (Niveles Soft / Medium / Complete)**: Varía la estructura y léxico manteniendo el significado.
- [ ] **Profesionalizar**: Eleva el tono a estándar corporativo sin inventar diagnósticos, causas ni soluciones no mencionadas.
- [ ] **Resumir**: Condensa el contenido preservando datos clave (nombres, errores, IDs).
- [ ] **Generar Respuesta**: Redacta respuesta cordial y estructurada sin comprometer tiempos ni acciones falsas.
- [ ] **Doble Clic / Concurrencia**: Los botones de acción se deshabilitan durante el procesamiento para evitar doble envío.
- [ ] **Límite de Caracteres**: 5000 caracteres permitidos; 5001 caracteres rechazados con alerta visible.
- [ ] **Unicode y Emojis**: Caracteres especiales, tildes, `ñ` y emojis procesados sin corrupción.

---

## 5. Privacidad y Detección de Datos Sensibles (`SensitiveDataGuard`)

- [ ] **Bloqueo Inmediato (`BLOCKED`)**: Contraseñas explícitas, API keys (`gsk_`, `sk-`, `ghp_`, `AKIA`), JWTs y cadenas de conexión a base de datos son bloqueadas antes de enviar a Groq (HTTP 400).
- [ ] **Auditoría Limpia**: Los bloqueos registran auditoría con los tipos de detección sin persistir el texto sensible.
- [ ] **Anonimización / Redacción (`WARNING`)**: DNI, teléfonos y correos se sustituyen por marcadores `[EMAIL_1]`, `[TEL_2]`, `[DNI_3]` y se restauran determinísticamente en el resultado.
- [ ] **Opt-Out de Historial (`saveAiHistory: false`)**: Procesa normalmente con Groq pero guarda `originalText: null` y `resultText: null` en PostgreSQL.

---

## 6. Panel de Administración y Control de Consumo

- [ ] **Restricción de Acceso (403)**: Usuarios con rol `USER` reciben 403 y no pueden acceder al panel ni a sus endpoints.
- [ ] **Gestión de Usuarios**: Creación con contraseña temporal, edición de rol y desactivación de cuentas.
- [ ] **Protección del Último Admin (`LAST_ADMIN_PROTECTED`)**: Imposibilidad de desactivar o degradar al único administrador activo.
- [ ] **Métricas de Consumo**: Visualización precisa de tokens de entrada, salida, totales y costo estimado.
- [ ] **Límites Mensuales**: Usuarios que superan su `monthlyTokenLimit` reciben HTTP 429 sin invocar a Groq.
- [ ] **Biblioteca Compartida**: Plantillas compartidas creadas por el admin son visibles para todos los agentes.
- [ ] **Revocación de Sesiones**: El admin puede forzar el cierre de todas las sesiones de cualquier usuario.

---

## 7. Rendimiento, Cloud y Resiliencia

- [ ] **Cold Start de Render Free**: La extensión muestra aviso informativo si el backend demora unos segundos en despertar.
- [ ] **Manejo Offline / Servidor Caído**: Mensajes de error claros sin colapsar la interfaz.
- [ ] **Aislamiento Multiusuario**: Usuario A no puede acceder, modificar ni borrar recursos privados de Usuario B.
- [ ] **Instalación Multi-PC**: La extensión funciona en cualquier PC con Chrome conectada a Internet sin requerir Node.js ni herramientas locales.
