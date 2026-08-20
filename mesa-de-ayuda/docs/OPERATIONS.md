# Manual de Operaciones y Resolución de Incidencias — Mesa de Ayuda

Este manual proporciona instrucciones directas y sencillas para que el administrador técnico opere el sistema en producción sin requerir conocimientos avanzados de DevOps.

---

## 1. Escenarios Comunes y Plan de Acción

### Escenario A: Render está caído o no responde
1. Ingresa a [https://dashboard.render.com](https://dashboard.render.com).
2. Selecciona el servicio **mesa-de-ayuda-api**.
3. Revisa la pestaña **Logs** para identificar si el servicio falló por memoria o error no controlado.
4. Si el servicio está congelado, haz clic en **Manual Deploy** -> **Deploy latest commit** o en **Restart service**.
5. Verifica que `GET /health` retorne `200 OK` (`"status": "healthy"`).

---

### Escenario B: Supabase (Base de Datos) no responde
1. Ingresa al [Dashboard de Supabase](https://supabase.com/dashboard).
2. Verifica si el proyecto está pausado o en mantenimiento. En el plan gratuito, proyectos inactivos pueden pausarse automáticamente; pulsa **Restore** si está pausado.
3. Comprueba el pool de conexiones (Transaction vs Session mode). La URL de Render debe usar el puerto `6543` del Session Pooler con `?sslmode=require`.
4. Tras restablecer la DB, el backend recuperará la conexión automáticamente en la siguiente petición.

---

### Escenario C: La API de Groq Cloud falla
1. Ingresa a [https://console.groq.com](https://console.groq.com).
2. Verifica el estado del servicio de Groq y tus límites de cuota (Rate Limits por minuto / día).
3. Si la clave caducó o fue revocada:
   - Genera una nueva API Key en la consola de Groq.
   - En Render -> **Environment**, actualiza la variable `GROQ_API_KEY`.
   - Render reiniciará la instancia con la nueva clave en ~30 segundos.

---

### Escenario D: Un usuario no puede iniciar sesión / Olvido de contraseña
1. Abre el **Panel de Administración** de **Mesa de Ayuda** en tu navegador.
2. Ve a la pestaña **👥 Usuarios**.
3. Ubica al usuario y haz clic en el botón **Resetear Clave**.
4. Ingresa una nueva contraseña temporal segura (mínimo 10 caracteres con letras y números).
5. Comparte la contraseña temporal con el usuario de forma privada. Al ingresar, el sistema le exigirá crear su propia contraseña personal.

---

### Escenario E: Una cuenta queda bloqueada o debe ser desactivada
1. En el **Panel de Administración** -> pestaña **👥 Usuarios**.
2. Haz clic en el botón **Desactivar** junto al usuario correspondiente.
3. En la pestaña **🔒 Seguridad y Sesiones**, pulsa **Revocar Sesiones** para invalidar de inmediato todos sus refresh tokens activos.

---

### Escenario F: Rotación de Secretos JWT o Credenciales Críticas
1. En tu máquina local, en `mesa-de-ayuda/backend`:
   ```bash
   npm run secrets:generate
   ```
2. Copia los nuevos valores generados para `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`.
3. En el [Dashboard de Render](https://dashboard.render.com) -> **Environment**, actualiza las variables.
4. Render desplegará la actualización. Todos los usuarios deberán volver a iniciar sesión con sus credenciales habituales.
