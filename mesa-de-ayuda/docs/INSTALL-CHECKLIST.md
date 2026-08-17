# Checklist de Instalación en Puestos de Trabajo (5 PCs) — Mesa de Ayuda

Usa este formato para verificar y registrar la instalación controlada en cada una de las 5 PCs del equipo.

---

| Puesto / Usuario | ID de Extensión (Chrome) | ID en Render (`ALLOWED_EXTENSION_IDS`) | Login Inicial | Cambio Clave | Menú Contextual | Test IA | Estado Final |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **PC 1 (Admin)** | `[Copiar de chrome://extensions]` | Configurado | [x] | [x] | [x] | [x] | **OPERATIVO** |
| **PC 2 (Agente A)**| `[Copiar de chrome://extensions]` | Configurado | [ ] | [ ] | [ ] | [ ] | **PENDIENTE** |
| **PC 3 (Agente B)**| `[Copiar de chrome://extensions]` | Configurado | [ ] | [ ] | [ ] | [ ] | **PENDIENTE** |
| **PC 4 (Agente C)**| `[Copiar de chrome://extensions]` | Configurado | [ ] | [ ] | [ ] | [ ] | **PENDIENTE** |
| **PC 5 (Agente D)**| `[Copiar de chrome://extensions]` | Configurado | [ ] | [ ] | [ ] | [ ] | **PENDIENTE** |

---

## Procedimiento para Autorizar Múltiples IDs de Extensión en Render

1. Cada usuario instala la carpeta de la extensión en su Chrome.
2. El usuario copia el ID alfanumérico que aparece en `chrome://extensions` debajo de "Mesa de Ayuda" (ej: `abcdefghijklmnop...`) y se lo envía al Administrador.
3. El Administrador abre el [Dashboard de Render](https://dashboard.render.com/) -> Web Service -> **Environment**.
4. En la variable `ALLOWED_EXTENSION_IDS`, agrega los IDs separados por coma:
   ```env
   ALLOWED_EXTENSION_IDS=id_pc1,id_pc2,id_pc3,id_pc4,id_pc5
   ```
5. Guarda los cambios. Render aplicará la actualización de inmediato sin interrumpir el servicio.
