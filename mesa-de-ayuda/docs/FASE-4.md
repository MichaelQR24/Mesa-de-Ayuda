# Fase 4: Integración Real con Groq (Llama 3.1 8B Instant)

## Objetivo
Conectar el flujo de asistencia de redacción de la extensión **Mesa de Ayuda** con un proveedor de Inteligencia Artificial real mediante **Groq API** y el modelo **Llama 3.1 8B Instant**, implementando una arquitectura backend por capas (*Route $\to$ Controller $\to$ AI Service $\to$ Groq Service*), prompts del sistema con reglas estrictas anti-alucinación, medición de latencia, captura de consumo de tokens y pruebas unitarias aisladas sin consumo de cuota.

---

## Arquitectura de IA

$$\text{Side Panel (Chrome)} \xrightarrow{\text{POST /api/v1/ai/process}} \text{Express Backend} \xrightarrow{\text{groq-sdk}} \text{Groq Cloud API (Llama 3.1 8B)} \xrightarrow{\text{Inferencia}} \text{Side Panel}$$

### Estructura Backend
```text
mesa-de-ayuda/backend/src/
├── routes/
│   └── ai.routes.ts                   # Endpoint POST /api/v1/ai/process
├── controllers/
│   └── ai.controller.ts               # Validación y respuesta HTTP con metadata de tokens
├── services/
│   ├── ai.service.ts                  # Orquestador de negocio y selección de prompts
│   └── groq.service.ts                # Cliente oficial groq-sdk, timeout (15s), temperatura (0.2)
├── prompts/
│   └── prompts.ts                     # Prompts de sistema centralizados por acción y tono
├── schemas/
│   └── ai.schema.ts                   # Validación estricta con Zod
├── types/
│   └── ai.types.ts                    # Interfaces de datos y tipos de IA
└── config/
    └── env.ts                         # Variables de entorno (GROQ_MODEL, GROQ_API_KEY)
```

---

## Configuración y Variables de Entorno

En `backend/.env`:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
GROQ_API_KEY=tu_clave_de_groq_aqui
GROQ_MODEL=llama-3.1-8b-instant
```

### Reglas de Seguridad de la API Key:
* `GROQ_API_KEY` reside **únicamente** en el servidor backend.
* El archivo `.env` se encuentra protegido e ignorado por Git.
* La extensión y el navegador **nunca** conocen ni reciben la API Key.
* Los logs y respuestas de error ocultan cualquier detalle sensible.

---

## Modelo y Parámetros

* **Modelo predeterminado**: `llama-3.1-8b-instant` (rápido, de alta fidelidad gramatical y gratuito en nivel base de Groq).
* **Temperatura**: `0.2` (temperatura baja para garantizar consistencia, precisión técnica y minimizar alucinaciones).
* **Max Tokens**: `1024` tokens de salida (suficiente para respuestas de mesa de ayuda).
* **Timeout**: `15000` ms (15 segundos de límite para evitar solicitudes colgadas).

---

## Endpoint y Formatos JSON

### `POST /api/v1/ai/process`

#### Solicitud (Body):
```json
{
  "text": "usuario llama porque no puede ingresar al sistema",
  "action": "professionalize",
  "tone": "professional",
  "paraphraseLevel": "medium"
}
```

* **Acciones permitidas (`action`)**: `correct`, `paraphrase`, `professionalize`, `summarize`, `reply`.
* **Tonos permitidos (`tone`)**: `professional`, `formal`, `friendly`, `technical`, `casual`.
* **Niveles de parafraseo (`paraphraseLevel`)**: `soft`, `medium`, `complete`.

#### Respuesta Exitosa (HTTP 200):
```json
{
  "success": true,
  "data": {
    "result": "El usuario se comunica solicitando asistencia debido a que presenta inconvenientes para acceder al sistema.",
    "model": "llama-3.1-8b-instant",
    "usage": {
      "inputTokens": 142,
      "outputTokens": 28,
      "totalTokens": 170
    }
  }
}
```

#### Respuesta de Error (Ejemplo: falta API Key o error del proveedor):
```json
{
  "success": false,
  "error": {
    "code": "API_KEY_MISSING",
    "message": "La clave de API de Groq (GROQ_API_KEY) no está configurada en el servidor."
  }
}
```

---

## Prompts del Sistema y Reglas Anti-Alucinación

Todos los prompts en [prompts.ts](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/backend/src/prompts/prompts.ts) aplican las siguientes reglas obligatorias:
1. Devolver **únicamente** el texto final resultante (sin fórmulas conversacionales como *"Claro, aquí tienes"* o *"Por supuesto"*).
2. Conservar datos técnicos, códigos de ticket, nombres propios, correos y números sin alterarlos.
3. No afirmar que una incidencia fue resuelta a menos que el texto original lo indique expresamente.
4. No inventar tiempos de respuesta (SLA) ni compromisos que no figuren en la consulta.

---

## Cómo Ejecutar y Probar

### 1. Pruebas Automatizadas (Sin consumo de tokens)
```bash
cd mesa-de-ayuda/backend
npm run test
```
*Ejecuta 13 pruebas con Vitest y Supertest utilizando mocks seguros de Groq.*

### 2. Prueba Real Directa con Groq
Configura tu clave en `backend/.env` y ejecuta:
```bash
cd mesa-de-ayuda/backend
npm run test:groq
```
*Envía una consulta corta de prueba a Groq y muestra la respuesta, latencia observada y desglose de tokens.*

### 3. Prueba en el Navegador con la Extensión
1. Inicia el servidor backend:
   ```bash
   cd mesa-de-ayuda/backend
   npm run dev
   ```
2. Abre Google Chrome y recarga la extensión en `chrome://extensions`.
3. Abre el Side Panel y escribe en el Asistente:
   `usuario llama porque no puede ingresar al sistema`
4. Pulsa **Profesionalizar**: la extensión enviará la petición al backend local y mostrará la respuesta devuelta por Groq.

---

## Limitaciones Actuales
* **Sin base de datos ni persistencia remota**: El historial y favoritos se mantienen en el almacenamiento local del navegador (`chrome.storage.local`).
* **Sin autenticación ni gestión de usuarios**: La API procesa las solicitudes de manera stateless.
