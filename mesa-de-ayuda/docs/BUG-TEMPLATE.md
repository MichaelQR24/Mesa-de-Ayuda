# Plantilla de Reporte de Bugs — Mesa de Ayuda

Usa esta plantilla para documentar cualquier error o comportamiento anómalo detectado durante las fases de pruebas y operación.

---

```markdown
## [BUG-ID]: Título breve y descriptivo del problema

* **Severidad**: [BLOCKER | CRITICAL | HIGH | MEDIUM | LOW]
* **Versión del Sistema**: [Ej. v0.9.0 / v1.0.0]
* **Entorno**: [Producción Render | Desarrollo Local | Extensión Chrome]
* **Navegador y SO**: [Ej. Google Chrome 128 / Windows 11]
* **Rol de Usuario**: [ADMIN | USER | No autenticado]

---

### 1. Precondiciones
* [Ej. Usuario logueado con rol USER]
* [Ej. Base de datos con al menos 1 plantilla creada]

---

### 2. Pasos para Reproducir
1. Ir a ...
2. Seleccionar el texto ...
3. Hacer clic en ...
4. Observar el resultado.

---

### 3. Resultado Esperado
* [Descripción clara de lo que el sistema debió hacer según las especificaciones de diseño]

---

### 4. Resultado Actual
* [Descripción del comportamiento erróneo o mensaje de error visualizado]

---

### 5. Logs y Trazas Técnicas
```text
[Pegar aquí la traza de consola de Chrome DevTools o log del servidor backend]
```

---

### 6. Causa Raíz Identificada (Root Cause)
* [Explicación técnica del porqué ocurrió el fallo en el código]

---

### 7. Solución Aplicada / Plan de Corrección
* [Detalle de los cambios en archivos y pruebas añadidas para evitar regresión]

---

### 8. Estado del Bug
* **Estado**: [ABIERTO | EN PROGRESO | RESUELTO | CERRADO]
* **Verificado por**: [Nombre de QA / Desarrollador]
* **Fecha**: [AAAA-MM-DD]
```
