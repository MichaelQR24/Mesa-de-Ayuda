# Checklist de Mantenimiento y Operación — Mesa de Ayuda

Usa esta lista de control periódica para asegurar la disponibilidad, seguridad y costo cero de la infraestructura.

---

## 1. Rutina Semanal (5 minutos)

- [ ] **Comprobar Health Check**: Visitar `https://mesa-de-ayuda-j6uw.onrender.com/health` y confirmar `"status": "healthy"`.
- [ ] **Revisar Panel de Monitoreo**: Abrir Panel Admin -> pestaña **🩺 Estado del Sistema** y confirmar semáforos verdes en Backend, Supabase e IA.
- [ ] **Auditar Errores Recientes**: Revisar pestaña **📋 Actividad y Auditoría** para detectar anomalías o intentos fallidos de acceso.
- [ ] **Verificar Consumo de IA**: Comprobar el volumen de tokens consumidos en la semana y el costo acumulado en dólares.

---

## 2. Rutina Mensual (15 minutos)

- [ ] **Revisar Usuarios y Roles**: Verificar que no existan cuentas inactivas o de compañeros que ya no pertenezcan al equipo.
- [ ] **Limpieza de Base de Datos (Mantenimiento)**:
  - Ejecutar simulación previa:
    ```bash
    npm run maintenance:cleanup:dry-run
    ```
  - Ejecutar purga de sesiones expiradas e historial antiguo:
    ```bash
    npm run maintenance:cleanup
    ```
- [ ] **Generar Backup de Seguridad**:
  - Seguir el procedimiento de [docs/BACKUP-RESTORE.md](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/docs/BACKUP-RESTORE.md) y guardar el archivo `.dump` en ubicación segura externa.
- [ ] **Auditar Dependencias**:
  - Ejecutar `npm audit` en backend y extensión para detectar vulnerabilidades en librerías.

---

## 3. Rutina Pre-Release (Antes de Distribuir una Nueva Versión)

- [ ] `npm run typecheck` en backend y extensión (0 errores).
- [ ] `npm run test` en backend (100% tests aprobados).
- [ ] `npm run build` en backend y extensión (0 errores de compilación).
- [ ] `npm run security:check` y `npm run security:secrets` (0 secretos expuestos).
- [ ] `npm audit` en ambos proyectos (0 vulnerabilidades).
- [ ] Generar release empaquetado con `npm run release` en `extension/`.
- [ ] Verificar Checksum SHA-256 generado.
