# Arquitectura de Rendimiento y Eficiencia — Mesa de Ayuda

Este documento detalla las directrices de diseño, presupuestos de latencia, optimizaciones de prompts/tokens, estrategias de red y benchmarks de eficiencia para **Mesa de Ayuda**.

---

## 1. Presupuesto de Latencias (Latency Budget)

| Endpoint / Operación | Estado | Objetivo | Latencia Observada |
| :--- | :---: | :---: | :---: |
| `GET /health` | Warm | < 100 ms | **15 - 35 ms** |
| `GET /health` | Cold Start (Render Free) | < 45 s | **20 - 35 s** |
| `POST /api/v1/auth/login` | Warm | < 500 ms | **120 - 180 ms** *(Argon2id)* |
| `POST /api/v1/auth/refresh` | Warm | < 200 ms | **40 - 75 ms** |
| `POST /api/v1/ai/process` (Correct) | Warm | < 1500 ms | **350 - 650 ms** *(Groq)* |
| `POST /api/v1/ai/process` (Professionalize) | Warm | < 1500 ms | **400 - 800 ms** |
| `POST /api/v1/ai/process` (Summarize) | Warm | < 1500 ms | **300 - 600 ms** |
| `GET /api/v1/history` (Paginado 20) | Warm | < 300 ms | **40 - 90 ms** |
| `GET /api/v1/library` | Warm | < 300 ms | **35 - 80 ms** |
| `GET /api/v1/usage/summary` (Admin KPIs) | Warm | < 400 ms | **60 - 110 ms** *(Promise.all)* |

---

## 2. Optimización de Prompts y Presupuesto de Tokens (Groq Llama 3.1 8B)

### 2.1 Base Común Compacta (`GLOBAL_RULES`)
Se unificaron las instrucciones transversales del sistema (no alucinación, no preámbulos, formato en español) en un bloque base compacto compartido.

* **Ahorro de Tokens de Sistema**: Reducción de ~350 caracteres a ~160 caracteres por prompt de sistema (**~55% de ahorro en tokens de sistema** por cada petición).

### 2.2 Presupuesto y Calibración por Acción

| Acción | `max_tokens` | `temperature` | Justificación |
| :--- | :---: | :---: | :--- |
| **`correct`** | `1024` | `0.1` | Máxima fidelidad ortográfica; no debe alterar estructura. |
| **`professionalize`**| `1024` | `0.1` | Tono sobrio corporativo sin diagnósticos inventados. |
| **`paraphrase`** | `1024` | `0.3` | Permite fluidez léxica conservando hechos. |
| **`summarize`** | `512` | `0.1` | Salida sintética acotada a 2-3 viñetas. |
| **`reply`** | `512` | `0.2` | Respuesta concisa sin comprometer SLAs ficticios. |

---

## 3. Optimizaciones de Red y Frontend

1. **Request Coalescing (`authService.refreshTokens`)**:
   - Si múltiples solicitudes concurrentes detectan la expiración del Access Token, todas comparten la misma promesa de red en vuelo (`refreshPromise`), evitando que se ejecuten 3 o más llamadas simultáneas a `/api/v1/auth/refresh`.
2. **In-Memory Cache con TTL para Categorías**:
   - `fetchRemoteCategories()` almacena el resultado en memoria con un TTL de **5 minutos**, eliminando consultas innecesarias al backend cada vez que el usuario navega a la biblioteca.
3. **Prevención de Doble Envío e Idempotencia UI**:
   - Deshabilitación de botones durante el estado de carga (`isProcessing`), bloqueando clics rápidos sucesivos.
   - Cero reintentos automáticos en llamadas mutantes POST a la IA ante caídas de red para prevenir consumos dobles de tokens.

---

## 4. Consultas a Base de Datos y Prevención de N+1

1. **Singleton de Conexión Prisma**:
   - Una única instancia de `PrismaClient` compartida a nivel de proceso (`backend/src/lib/prisma.ts`), reutilizando el Session Pooler de Supabase.
2. **Paginación Acotada**:
   - Todas las consultas de historial (`GET /history`) aplican un límite estricto `take: Math.min(Math.max(limit, 1), 100)`.
3. **Agregaciones Paralelas**:
   - Los KPIs del Panel de Administración (`UsageService.getSummaryMetrics`) ejecutan sus conteos y sumatorias en paralelo mediante `Promise.all`.

---

## 5. Auditoría de Seguridad y Resistencia ReDoS

* **Tiempo de Ejecución en Textos Largos (5,000 chars)**: **< 1.5 ms**.
* **Tiempo de Ejecución en Textos Ambiguos (10,000 chars)**: **< 2.0 ms**.
* Todas las expresiones regulares de `SensitiveDataGuard` fueron validadas para garantizar evaluación en tiempo lineal $O(N)$ sin backtracking exponencial.

---

## 6. Tamaños de Bundle de la Extensión

* `sidepanel.js`: **~38.6 kB** (gzip: **~10.6 kB**)
* `admin.js`: **~21.4 kB** (gzip: **~5.2 kB**)
* `content-script.js`: **~4.5 kB** (gzip: **~1.7 kB**)
* `service-worker.js`: **~3.0 kB** (gzip: **~1.1 kB**)
* **Total del Paquete**: **< 90 kB** (carga instantánea en Chrome).
