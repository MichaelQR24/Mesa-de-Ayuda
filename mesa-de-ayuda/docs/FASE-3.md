# Fase 3: Backend Base (Node.js + Express 5 + TypeScript + Zod)

## Objetivo
Construir una API REST segura, modular y tipada en **Node.js** con **Express 5** y **TypeScript**, implementando validación de esquemas con **Zod**, cabeceras de seguridad con **Helmet**, control de acceso con **CORS**, limitación de tasa con **express-rate-limit** y pruebas automatizadas con **Vitest** y **Supertest**, permitiendo el flujo de comunicación:
$$\text{Side Panel (Chrome)} \longrightarrow \text{Backend Local (localhost:3000)} \longrightarrow \text{Respuesta JSON} \longrightarrow \text{Side Panel}$$

---

## Arquitectura Backend

```text
mesa-de-ayuda/backend/
├── src/
│   ├── app.ts                         # Configuración de Express, middlewares y montaje de rutas
│   ├── server.ts                      # Arranque del listener HTTP y manejo de graceful shutdown
│   ├── config/
│   │   └── env.ts                     # Validación tipada de variables de entorno con Zod
│   ├── routes/
│   │   ├── health.routes.ts           # Endpoint GET /health
│   │   └── test.routes.ts             # Endpoint POST /api/v1/test
│   ├── controllers/
│   │   └── test.controller.ts        # Controlador del endpoint de prueba
│   ├── middleware/
│   │   ├── rate-limit.ts              # Limitación de 100 reqs / 15 min en /api/
│   │   ├── not-found.ts               # Manejador 404 con JSON consistente
│   │   └── error-handler.ts           # Manejador centralizado de errores (Zod, JSON, 500)
│   └── schemas/
│       └── test.schema.ts             # Esquema Zod de validación de entrada
├── tests/
│   ├── health.test.ts                 # Test unitario/integración para /health (Vitest + Supertest)
│   └── test.test.ts                   # Suite de tests para /api/v1/test y manejo de errores 404/400
├── .env.example                       # Plantilla de variables de entorno
├── .env                               # Configuración local de entorno
├── package.json                       # Dependencias y scripts de backend
└── tsconfig.json                      # Configuración TypeScript para Node.js (NodeNext)
```

---

## Dependencias Instaladas

### Producción:
* `express` (^5.0.1): Framework web minimalista (versión 5).
* `zod` (^3.24.2): Validación de esquemas y tipos en tiempo de ejecución.
* `helmet` (^8.0.0): Configuración de cabeceras HTTP de seguridad.
* `cors` (^2.8.5): Control de acceso cruzado entre orígenes.
* `express-rate-limit` (^7.5.0): Prevención de saturación y abusos de peticiones.
* `dotenv` (^16.4.7): Carga de variables de entorno.

### Desarrollo y Pruebas:
* `typescript` (^5.8.2) & `@types/*`: Soporte estricto de tipado.
* `tsx` (^4.19.3): Ejecutor y observador TypeScript ultra-rápido para desarrollo.
* `vitest` (^3.0.7): Framework moderno de pruebas unitarias.
* `supertest` (^7.0.0): Cliente HTTP para tests de integración de Express.

---

## Endpoints y Formatos JSON

### 1. Health Check
* **Método**: `GET`
* **Ruta**: `/health`
* **Código de respuesta**: `200 OK`
* **Formato de respuesta**:
```json
{
  "success": true,
  "status": "ok",
  "service": "mesa-de-ayuda-api",
  "timestamp": "2026-08-16T21:07:11.392Z"
}
```

### 2. Prueba de Entrada (Versionado v1)
* **Método**: `POST`
* **Ruta**: `/api/v1/test`
* **Cabecera**: `Content-Type: application/json`
* **Cuerpo de solicitud (Ejemplo válido)**:
```json
{
  "text": "Prueba de conexión"
}
```
* **Respuesta Exitosa (200 OK)**:
```json
{
  "success": true,
  "data": {
    "receivedText": "Prueba de conexión",
    "message": "Backend conectado correctamente"
  }
}
```
* **Respuesta de Error de Validación (400 Bad Request)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos de entrada inválidos",
    "details": [
      {
        "field": "text",
        "message": "El texto debe contener al menos 1 carácter útil"
      }
    ]
  }
}
```

### 3. Rutas No Encontradas
* **Ruta**: Cualquier endpoint no declarado (ej. `GET /ruta-inexistente`)
* **Código de respuesta**: `404 Not Found`
* **Formato**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Ruta no encontrada"
  }
}
```

---

## Seguridad Aplicada

1. **Helmet**: Protección activa mediante headers como `X-DNS-Prefetch-Control`, `X-Frame-Options`, `Strict-Transport-Security`, `X-Download-Options` y `X-Content-Type-Options`.
2. **Límite de tamaño de Payload**: Parser restringido a `50kb` para evitar sobrecarga de memoria o ataques por denegación de servicio vía bodies gigantescos.
3. **CORS Centralizado**: Configurado para permitir peticiones locales y orígenes autorizados de extensiones Chrome (`chrome-extension://*`), evitando comodines indiscriminados en producción.
4. **Rate Limiting**: Aplicado a todas las rutas bajo `/api/` (máximo 100 solicitudes por cada 15 minutos por IP).
5. **Manejo Seguro de Errores y Logging**: Se ocultan los stack traces en las respuestas de error y el logger registra únicamente el método, ruta, status y tiempo de respuesta sin exponer los textos de redacción en los logs de consola.

---

## Cómo Ejecutar y Probar el Backend

Situarse en la carpeta `backend/`:

```bash
cd mesa-de-ayuda/backend
```

### 1. Iniciar en modo desarrollo
```bash
npm run dev
```
El servidor arrancará en: `http://localhost:3000`

### 2. Ejecutar la suite de tests (Vitest + Supertest)
```bash
npm run test
```

### 3. Comprobar tipos TypeScript
```bash
npm run typecheck
```

### 4. Compilar para producción
```bash
npm run build
```

---

## Cómo Probar la Comunicación: Side Panel $\to$ Backend

1. Inicia el servidor backend:
   ```bash
   cd mesa-de-ayuda/backend
   npm run dev
   ```
2. Abre Google Chrome y recarga la extensión en `chrome://extensions`.
3. Haz clic en el icono de **Mesa de Ayuda** para abrir el **Side Panel**.
4. Dirígete a la pestaña **Configuración**.
5. Localiza la sección **Diagnóstico de Conexión Backend**.
6. Haz clic en el botón **⚡ Probar backend**.
7. Verás la notificación verde y el estado:
   ```text
   ✅ Backend conectado correctamente (Texto: "Prueba de conexión desde Side Panel")
   ```

---

## Limitaciones Actuales
* **Sin base de datos ni persistencia remota**: No se han configurado conexiones ni esquemas en PostgreSQL/Prisma.
* **Sin IA real**: La inferencia sigue siendo simulada localmente (Mock AI) a la espera de la integración de Groq API en la fase correspondiente.
* **Sin autenticación**: No existen tokens JWT, roles de usuario ni cuentas.
