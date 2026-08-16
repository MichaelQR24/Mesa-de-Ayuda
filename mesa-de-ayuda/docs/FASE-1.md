# Fase 1: Extensión Mínima de Chrome (Manifest V3 + Side Panel)

## Objetivo
Implementar una extensión mínima de Google Chrome utilizando **Manifest V3**, **TypeScript**, **Vite** y la **Chrome Side Panel API**. Al pulsar el icono de la extensión en la barra de herramientas del navegador, debe abrirse automáticamente el panel lateral (*Side Panel*) mostrando la interfaz base del proyecto **Mesa de Ayuda**.

---

## Archivos Creados

```text
mesa-de-ayuda/
├── extension/
│   ├── package.json                   # Definición del proyecto, scripts y dependencias mínimas
│   ├── tsconfig.json                  # Configuración TypeScript para Manifest V3 y DOM
│   ├── vite.config.ts                 # Configuración de empaquetado multi-input con Vite
│   ├── manifest.json                  # Manifiesto V3 de referencia en raíz
│   ├── public/
│   │   ├── manifest.json              # Manifiesto V3 empaquetado en dist/
│   │   └── icons/                     # Iconos de la extensión (16px, 48px, 128px)
│   ├── src/
│   │   ├── background/
│   │   │   └── service-worker.ts      # Service worker para configurar apertura automática del Side Panel
│   │   └── sidepanel/
│   │       ├── index.html             # Estructura HTML de la interfaz del Side Panel
│   │       ├── sidepanel.ts           # Lógica TypeScript de inicialización
│   │       └── sidepanel.css          # Estilos profesionales, responsivos y tema claro/oscuro
│   └── dist/                          # Salida compilada lista para cargar en Chrome
└── docs/
    └── FASE-1.md                      # Esta documentación
```

---

## Cómo Ejecutar el Build

Desde la terminal, situarse en el directorio de la extensión:

```bash
cd mesa-de-ayuda/extension
```

### 1. Comprobación de tipos (TypeScript)
```bash
npm run typecheck
```

### 2. Compilación para producción
```bash
npm run build
```

Esto generará la carpeta `extension/dist/` optimizada y lista para ser consumida por Google Chrome.

### 3. Modo desarrollo (recopilación automática)
```bash
npm run dev
```

---

## Cómo Cargar la Extensión en Chrome

1. Abre **Google Chrome**.
2. Navega a `chrome://extensions/` o dirígete a: **Menú (tres puntos) > Extensiones > Administrar extensiones**.
3. Activa la casilla **Modo de desarrollador** (en la esquina superior derecha).
4. Haz clic en el botón **Cargar extensión sin empaquetar** (*Load unpacked*).
5. Selecciona la carpeta `dist/` ubicada en:
   ```text
   <ruta-del-proyecto>/mesa-de-ayuda/extension/dist
   ```
6. Verifica que la tarjeta de la extensión aparezca con el nombre **Mesa de Ayuda** y versión **1.0.0**.

---

## Cómo Probar el Side Panel

1. En la barra de herramientas superior de Chrome, haz clic en el icono del rompecabezas (**Extensiones**) y fija el icono de **Mesa de Ayuda** (pin).
2. Haz clic sobre el icono de **Mesa de Ayuda**.
3. El panel lateral (*Side Panel*) de Chrome se desplegará en el lateral del navegador.
4. Confirma que se visualice la siguiente información:
   - **Título**: `Mesa de Ayuda`
   - **Subtítulo**: `Asistente de redacción para soporte técnico`
   - **Estado**: Indicador visual verde con `Extensión funcionando correctamente`
   - **Detalle**: `Fase 1 completada`
5. Abre la consola de desarrollo del Side Panel (clic derecho sobre el contenido del Side Panel > *Inspeccionar*) y verifica que el mensaje `[Mesa de Ayuda] Side Panel cargado y listo (Fase 1).` aparezca sin errores.

---

## Problemas Conocidos
* Ninguno identificado. La compilación de TypeScript y empaquetado de Vite se ejecutan sin errores ni advertencias.
