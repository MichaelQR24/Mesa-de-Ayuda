# Fase 7: Integración con Páginas Web y Menú Contextual

## Objetivo
Permitir que la extensión **Mesa de Ayuda** interactúe con el contenido de las páginas web abiertas en el navegador, capturando texto seleccionado de forma explícita por el usuario mediante un **Menú Contextual nativo de Chrome** o mediante el botón de captura en el Side Panel, precargando el texto y la acción sugerida en el Asistente sin autoprocesar, y permitiendo reemplazar directamente el texto seleccionado en campos editables compatibles (`<input>`, `<textarea>`, `contenteditable="true"`) o copiarlo al portapapeles.

---

## 1. Arquitectura de Integración

```text
┌─────────────────────────────────────────────────────────────┐
│  Página Web (DOM)                                           │
│  - Input / Textarea / ContentEditable / Párrafos           │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Clic derecho / Selección activa)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Background Service Worker (service-worker.ts)              │
│  - Menús contextuales (contextMenus API)                    │
│  - Apertura controlada de Side Panel (sidePanel.open)       │
│  - Preservación de pendingSelection en session storage      │
└──────────────────────────────┬──────────────────────────────┘
                               │ chrome.storage.session / LOAD_SELECTION
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Side Panel (AssistantView)                                 │
│  - Si no hay login: abre Login y conserva pendingSelection  │
│  - Si hay login: carga texto + enfoca acción sugerida       │
│  - Usuario confirma manualmente (NO autoprocesa IA)         │
│  - Botón Copiar (Universal) / Botón Reemplazar (Editable)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP POST (Bearer JWT)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Express (http://localhost:3000) ──► Groq API       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Menú Contextual de Chrome

### Estructura e Identificadores (IDs)

* **Menú Padre**: `mesa-ayuda-root` (Título: `Mesa de Ayuda`, Contexto: `['selection']`)
* **Opciones Hijas**:

| ID Interno | Título Visible | Acción Mapeada | Comportamiento |
| :--- | :--- | :--- | :--- |
| `mesa-ayuda-correct` | Corregir | `corregir` | Abre Side Panel, precarga texto y selecciona **Corregir**. |
| `mesa-ayuda-paraphrase` | Parafrasear | `parafrasear` | Abre Side Panel, precarga texto y selecciona **Parafrasear**. |
| `mesa-ayuda-professionalize` | Profesionalizar | `profesionalizar` | Abre Side Panel, precarga texto y selecciona **Profesionalizar**. |
| `mesa-ayuda-summarize` | Resumir | `resumir` | Abre Side Panel, precarga texto y selecciona **Resumir**. |
| `mesa-ayuda-reply` | Generar respuesta | `responder` | Abre Side Panel, precarga texto y selecciona **Responder**. |
| `mesa-ayuda-open` | Enviar al asistente | `null` | Abre Side Panel y precarga texto sin preseleccionar acción. |

### Flujo Operativo y Consentimiento
1. El usuario selecciona texto en cualquier página web.
2. Hace clic derecho -> **Mesa de Ayuda** -> Elige una opción (ej. *Profesionalizar*).
3. El Service Worker ejecuta `chrome.sidePanel.open({ tabId })` y guarda `pendingSelection`.
4. El Side Panel recibe la selección, navega a la pestaña Asistente, actualiza el textarea y contador de caracteres, y enfoca el botón de acción correspondiente.
5. **No se ejecuta automáticamente la IA**: El usuario revisa el texto cargado y confirma haciendo clic en el botón deseado, garantizando privacidad total y evitando consumo involuntario de tokens.

### Preservación de Selección sin Autenticación
Si el usuario hace clic derecho antes de iniciar sesión:
* El Side Panel se abre y muestra la pantalla de **Iniciar Sesión**.
* `pendingSelection` se conserva de forma segura en `chrome.storage.session`.
* Al completar el login exitosamente, el Asistente se abre automáticamente con el texto seleccionado precargado.

---

## 3. Tipos de Elementos Soportados y No Soportados

| Tipo de Elemento | Captura | Reemplazo Directo | Observaciones |
| :--- | :---: | :---: | :--- |
| **Párrafos / Texto estático de página** | ✅ Sí | ❌ No | Solo lectura. Fallback seguro: botón **Copiar**. |
| **`<textarea>`** | ✅ Sí | ✅ Sí | Reemplaza el fragmento exacto conservando texto anterior y posterior. Dispara `input` y `change`. |
| **`<input type="text\|search\|url\|tel\|email">`** | ✅ Sí | ✅ Sí | Actualiza valor, cursor y eventos. |
| **`contenteditable="true"`** | ✅ Sí | ✅ Sí | Reemplazo mediante Range API (`deleteContents` + `insertNode`). |
| **`<input type="password">`** | 🚫 **PROHIBIDO** | 🚫 **PROHIBIDO** | Bloqueado por diseño para máxima seguridad. |
| **Páginas `chrome://` o Web Store** | 🚫 **PROHIBIDO** | 🚫 **PROHIBIDO** | Restricción de seguridad del motor Chromium. |

---

## 4. Mensajería Tipada (Discriminated Unions)

Se implementó el contrato `ExtensionMessage` en [src/types/messaging.types.ts](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/extension/src/types/messaging.types.ts):

```typescript
export type ExtensionMessage =
  | { type: 'GET_SELECTED_TEXT' }
  | { type: 'GET_SELECTED_TEXT_RESPONSE'; payload: { success: boolean; data?: SelectedTextContext; error?: string } }
  | { type: 'REPLACE_SELECTION'; payload: { replacementText: string } }
  | { type: 'REPLACE_SELECTION_RESPONSE'; payload: { success: boolean; error?: string } }
  | { type: 'LOAD_SELECTION'; payload: SelectedTextContext }
  | { type: 'CLEAR_SELECTION_CONTEXT' }
  | { type: 'PING' };
```

---

## 5. Permisos en Manifest V3

* `sidePanel`: Apertura y control del panel lateral.
* `storage`: Almacenamiento seguro en `session` (tokens y contexto efímero) y `local` (refresh token y configuración).
* `contextMenus`: Creación de menús contextuales en selecciones de texto.
* `activeTab` y `scripting`: Acceso e inyección bajo demanda en la pestaña activa del usuario.
* `host_permissions`: `http://localhost:3000/*` para comunicación con el backend de la API.

---

## 6. Banco de Pruebas Manuales

Se incluye el archivo [docs/manual-test-page.html](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/docs/manual-test-page.html) con escenarios listos para probar:
1. **Párrafo Estándar**: Seleccionar texto -> Menú contextual o botón de captura -> Procesar -> Botón Reemplazar permanece oculto.
2. **Textarea de Tickets**: Seleccionar fragmento -> Clic derecho -> *Profesionalizar* -> Reemplazar -> Comprobar que solo sustituye la selección.
3. **Input de Asunto**: Seleccionar -> Procesar -> Reemplazar.
4. **Editor ContentEditable**: Seleccionar -> Procesar -> Reemplazar.
5. **Input Password**: Seleccionar -> Verificar que la extensión se niega a capturarlo.
