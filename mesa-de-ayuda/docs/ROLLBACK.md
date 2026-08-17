# Protocolo de Rollback — Mesa de Ayuda

Si una versión recién distribuida presenta una incidencia crítica no prevista, sigue este procedimiento para restaurar la versión estable anterior en menos de 1 minuto:

---

## Procedimiento de Reversión en la Extensión (PC del Usuario)

1. Cierra el panel lateral de **Mesa de Ayuda**.
2. Reemplaza los archivos de la carpeta de la extensión por los de la versión estable previa (ej. `mesa-de-ayuda-v1.0.0`).
3. Abre Chrome y ve a `chrome://extensions`.
4. Haz clic en el botón de **Recargar (⟳)** en la tarjeta de **Mesa de Ayuda**.
5. Verifica que la versión coincida con la anterior y reabre el Side Panel.

---

## Procedimiento de Reversión en el Backend (Render)

1. Ingresa al [Dashboard de Render](https://dashboard.render.com/).
2. Accede al Web Service `mesa-de-ayuda-api`.
3. Ve a la pestaña **Events / Deploys**.
4. Ubica el despliegue anterior estable y haz clic en **Rollback to this deploy**.
5. Render repondrá la versión previa en producción de forma automática en ~30 segundos.

---

## Política de Conservación de Releases

El repositorio y el servidor mantendrán siempre disponibles al menos:
* La versión actual en producción.
* La versión inmediata anterior estable (`v1.0.0-previous`).
