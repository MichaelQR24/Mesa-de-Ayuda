# Estrategia de Backup y Restauración — Mesa de Ayuda (Supabase PostgreSQL)

Este documento detalla el procedimiento formal para realizar respaldos seguros, verificar la integridad de las copias y restaurar la base de datos PostgreSQL de **Mesa de Ayuda** en caso de incidente crítico.

---

## 1. Alcance de los Datos

| Modelo / Tabla | Prioridad | Justificación |
| :--- | :---: | :--- |
| **`User`** | 🔴 **Crítica** | Cuentas, credenciales Argon2id, roles y límites de consumo. |
| **`Category`** | 🔴 **Crítica** | Categorías compartidas del sistema. |
| **`LibraryItem`** | 🔴 **Crítica** | Plantillas predeterminadas y compartidas de la biblioteca. |
| **`AuditLog`** | 🟡 **Media** | Registro inmutable de acciones administrativas y eventos. |
| **`AiHistory`** | 🟢 **Baja** | Historial de interacciones de IA (sujeto a política de retención). |
| **`AuthSession`** | 🟢 **Baja** | Sesiones temporales y refresh tokens (se regeneran al volver a iniciar sesión). |

---

## 2. Requisitos Previos

* **Herramienta**: Utilidad `pg_dump` y `psql` (incluidas en la instalación de PostgreSQL para Windows/Linux).
* **Cadena de Conexión (`DATABASE_URL`)**: Obtenida de forma segura desde las variables de entorno de Render o desde el Dashboard de Supabase.
* ⚠️ **ADVERTENCIA DE SEGURIDAD**: Nunca almacenes contraseñas ni cadenas de conexión completas en archivos de texto dentro del repositorio Git ni las compartas por chat no cifrado.

---

## 3. Procedimiento para Generar un Backup Manual (Windows / PowerShell)

1. Abre **PowerShell** en tu PC.
2. Configura temporalmente la variable de conexión (esta variable solo existirá en tu sesión actual de terminal):
   ```powershell
   $env:SUPABASE_DB_URL = "postgresql://postgres.[TU_PROYECTO]:[TU_PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
   ```
3. Genera el volcado de la base de datos con compresión:
   ```powershell
   # Crear directorio local seguro fuera del repo
   New-Item -ItemType Directory -Force -Path "$HOME\Backups\MesaDeAyuda"

   # Generar backup con timestamp
   $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
   pg_dump "$env:SUPABASE_DB_URL" --format=custom --file="$HOME\Backups\MesaDeAyuda\backup-$timestamp.dump"
   ```

---

## 4. Verificación de Integridad del Backup

Para certificar que el archivo generado no está corrupto:
```powershell
pg_restore --list "$HOME\Backups\MesaDeAyuda\backup-$timestamp.dump"
```
Si el comando lista correctamente las tablas (`User`, `Category`, `LibraryItem`, `AuditLog`, etc.), el archivo es válido.

---

## 5. Procedimiento de Restauración (Disaster Recovery)

> [!CAUTION]
> **ATENCIÓN**: La restauración sobreescribirá o insertará registros en la base de datos de destino. Ejecuta este procedimiento únicamente en caso de contingencia o en una base de datos de pruebas/staging.

1. **Restauración selectiva o completa usando `pg_restore`**:
   ```powershell
   pg_restore --clean --if-exists --no-owner --no-privileges -d "$env:SUPABASE_DB_URL" "$HOME\Backups\MesaDeAyuda\backup-2026-xx-xx.dump"
   ```
2. **Validación post-restauración**:
   - Comprueba la conexión mediante el endpoint público:
     ```bash
     curl https://mesa-de-ayuda-j6uw.onrender.com/health
     ```
   - Inicia sesión con la cuenta ADMIN y verifica que la lista de usuarios y la biblioteca compartida contengan sus datos.
   - Ejecuta las pruebas automatizadas del backend (`npm run test`).
