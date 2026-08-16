# Fase 2: Frontend Funcional del Side Panel (Asistente de Redacción)

## Objetivo
Implementar la interfaz completa y funcional del panel lateral (*Side Panel*) para la extensión **Mesa de Ayuda**, proporcionando una experiencia fluida, responsiva y profesional para agentes de soporte técnico, con simulación de inferencia local (*Mock AI*), biblioteca de plantillas, historial, textos guardados y configuración de preferencias con persistencia local.

---

## Arquitectura Frontend

La arquitectura sigue una separación modular limpia en Vanilla TypeScript / DOM / CSS sin frameworks externos:

```text
mesa-de-ayuda/extension/src/
├── background/
│   └── service-worker.ts               # Service Worker V3 (manejo de apertura de Side Panel)
├── sidepanel/
│   ├── index.html                      # Estructura semántica con navegación de 5 vistas
│   ├── sidepanel.ts                    # Punto de entrada y orquestador de componentes
│   ├── sidepanel.css                   # Sistema de diseño sobrio (blanco, gris, slate, morado de acción)
│   ├── types/
│   │   └── index.ts                    # Interfaces de datos y tipos estrictos
│   ├── storage/
│   │   └── storage-service.ts          # Capa de persistencia (chrome.storage.local con fallback)
│   ├── services/
│   │   ├── mock-ai-service.ts          # Simulación local determinista de IA
│   │   └── library-data.ts             # Datos base y categorías de soporte técnico
│   └── components/
│       ├── navigation.ts               # Control de pestañas y sincronización de vistas
│       ├── assistant-view.ts           # Pantalla Asistente (textarea, 5 acciones, resultado)
│       ├── library-view.ts             # Pantalla Biblioteca (buscador, chips, favoritos)
│       ├── history-view.ts             # Pantalla Historial (tiempo relativo, reuso de texto)
│       ├── saved-view.ts               # Pantalla Guardados (plantillas y favoritos)
│       ├── settings-view.ts            # Pantalla Configuración (tonos, temas, confirmaciones)
│       └── toast.ts                    # Notificaciones visuales no intrusivas
└── public/
    ├── manifest.json                   # Manifiesto V3 (permisos: sidePanel, storage)
    └── icons/                          # Iconos oficiales (16px, 48px, 128px)
```

---

## Pantallas Implementadas

1. **Asistente (Pantalla Principal)**:
   - Textarea de entrada con límite estricto de 5000 caracteres y contador dinámico `0 / 5000`.
   - Selector de tono: *Profesional*, *Formal*, *Amable*, *Técnico*, *Casual*.
   - Selector de nivel de parafraseo: *Suave*, *Medio*, *Completo*.
   - 5 Acciones principales de procesamiento:
     * **Corregir**: Normaliza ortografía, mayúsculas, términos de soporte y puntuación.
     * **Parafrasear**: Reescribe el texto según el nivel seleccionado manteniendo el sentido.
     * **Profesionalizar**: Transforma reportes coloquiales en redacciones corporativas pulidas.
     * **Resumir**: Genera una síntesis ejecutiva estructurada con puntos clave.
     * **Responder**: Redacta una plantilla de contestación formal orientada al usuario final.
   - Estado de carga animado (*spinner* y pulso con latencia simulada de 350ms).
   - Bloque de **Resultado**: Textarea editable con botones para *Copiar* al portapapeles, *Guardar* en favoritos, *Regenerar* o *Limpiar*.

2. **Biblioteca**:
   - Buscador en tiempo real por término, categoría o contenido.
   - Filtros rápidos por chips: *Todos*, *Contraseñas*, *Accesos*, *Cierre*, *Redes*, *Hardware*, *General*.
   - Tarjetas con contenido listo para *Copiar*, marcar como *Favorito* o *Usar en Asistente*.

3. **Historial**:
   - Registro cronológico de consultas realizadas durante la sesión.
   - Visualización de acción efectuada, resumen del texto original, resultado y tiempo relativo transcurrido.
   - Acciones para *Copiar resultado*, *Cargar en Asistente* o *Vaciar historial*.

4. **Guardados**:
   - Listado de respuestas y plantillas marcadas como favoritas.
   - Acciones para *Copiar*, *Quitar de guardados* o *Usar como plantilla* directa en el Asistente.

5. **Configuración**:
   - Preferencia de tono predeterminado.
   - Preferencia de nivel de parafraseo predeterminado.
   - Opción para solicitar confirmación antes de limpiar campos.
   - Selector de tema visual (*Adaptar al sistema*, *Modo Claro*, *Modo Oscuro*).
   - Guardado persistente en `chrome.storage.local`.

---

## Almacenamiento Local Utilizado

Se utiliza **`chrome.storage.local`** a través de la clase [storage-service.ts](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/extension/src/sidepanel/storage/storage-service.ts) con las siguientes claves:
* `mda_settings`: Objeto de configuración general.
* `mda_history`: Lista de los últimos 50 registros de consultas.
* `mda_saved`: Lista de textos y plantillas guardadas.
* `mda_favorite_lib_ids`: Lista de identificadores de plantillas de biblioteca marcadas como favoritas.

---

## Comandos de Ejecución

Situarse en la carpeta `extension/`:

```bash
cd mesa-de-ayuda/extension
```

### Verificación de tipos TypeScript
```bash
npm run typecheck
```

### Compilación para producción (Vite + TS)
```bash
npm run build
```

### Modo observador para desarrollo
```bash
npm run dev
```

---

## Pruebas Realizadas

1. **Compilación estricta**: `npm run typecheck` completado con 0 errores.
2. **Build de producción**: `npm run build` completado con éxito generando archivos optimizados en `dist/`.
3. **Flujo de Asistente**: Verificación de validación al presionar acciones sin texto (*"Ingresa un texto antes de continuar."*), procesamiento de los 5 botones con simulación mock y actualización del contador de caracteres (límite 5000).
4. **Navegación e interoperabilidad**: Verificación de envío de texto desde Biblioteca e Historial directamente hacia el Asistente.
5. **Persistencia**: Verificación de almacenamiento y recuperación de opciones de configuración, historial y elementos favoritos.
6. **Seguridad**: Cero llamadas externas, cero inserciones directas de `innerHTML` con datos de usuario y cero dependencias pesadas.

---

## Limitaciones Actuales

* **Sin IA real**: Las transformaciones son generadas por algoritmos y plantillas locales de simulación (*Mock AI*), preparando la interfaz para la integración futura con Groq API en fases posteriores.
* **Sin backend / base de datos**: Toda la persistencia es local en el almacenamiento de la extensión (`chrome.storage.local`).
