# Fase 5: Persistencia en PostgreSQL mediante Prisma ORM (Supabase)

## Objetivo
Implementar la capa de persistencia remota para la aplicación **Mesa de Ayuda** utilizando **PostgreSQL** alojado en el plan gratuito de **Supabase** y gestionado mediante **Prisma ORM**. Esta fase permite almacenar y consultar de forma persistente el historial de inferencias de IA, las categorías y la biblioteca de plantillas/respuestas de soporte técnico.

---

## Proveedor y Plan Gratuito (Supabase Free)

* **Proveedor**: [Supabase](https://supabase.com) (Plan *Free Tier*).
* **Motor**: PostgreSQL 15+.
* **Límites Gratuitos Considerados**:
  * Hasta 500 MB de base de datos relacional (más que suficiente para miles de registros de texto de soporte).
  * 2 proyectos gratuitos activos sin costo.
  * Sin cargos por almacenamiento de archivos externos (solo almacenamos texto relacional estructurado).

---

## Modelo de Datos y Relaciones

El esquema en [backend/prisma/schema.prisma](file:///c:/Users/Micha/Desktop/Extension/mesa-de-ayuda/backend/prisma/schema.prisma) define las siguientes entidades:

```text
  ┌──────────────┐
  │     User     │
  └──────┬───────┘
         │ 1:N (Opcional temporalmente)
         ├─────────────────────────────┐
         ▼                             ▼
  ┌──────────────┐              ┌──────────────┐         N:1        ┌──────────────┐
  │  AiHistory   │              │ LibraryItem  │ ──────────────────►│   Category   │
  └──────────────┘              └──────────────┘                    └──────────────┘
```

### 1. `User` (Preparado para fase de autenticación futura)
* `id` (UUID): Identificador único.
* `email` (String, Unique): Correo electrónico corporativo.
* `displayName` (String): Nombre visible del usuario.
* `role` (Enum: `ADMIN`, `USER`): Nivel de acceso.
* `status` (Enum: `ACTIVE`, `INACTIVE`): Estado de la cuenta.

### 2. `AiHistory` (Historial de Procesamiento de IA)
* `id` (UUID): Identificador del registro.
* `userId` (UUID, Nullable): Usuario que solicitó la transformación (opcional en esta fase).
* `action` (Enum: `CORRECT`, `PARAPHRASE`, `PROFESSIONALIZE`, `SUMMARIZE`, `REPLY`).
* `originalText` (Text): Texto original ingresado por el agente.
* `resultText` (Text): Respuesta generada por Llama 3.1.
* `tone` (Enum: `PROFESSIONAL`, `FORMAL`, `FRIENDLY`, `TECHNICAL`, `CASUAL`).
* `paraphraseLevel` (Enum: `SOFT`, `MEDIUM`, `COMPLETE`).
* `model` (String): Modelo utilizado (`llama-3.1-8b-instant`).
* `inputTokens`, `outputTokens`, `totalTokens` (Int, Nullable): Métricas de consumo.
* `latencyMs` (Int, Nullable): Tiempo de respuesta en milisegundos.
* `createdAt` (DateTime): Fecha y hora del registro.
* **Índices**: `@@index([createdAt])`, `@@index([userId])`, `@@index([action])`.

### 3. `Category` (Categorías de Soporte)
* `id` (UUID): Identificador.
* `name` (String, Unique): Nombre de la categoría (*Contraseñas*, *Accesos*, *Cierre*, *Redes*, *Hardware*, *General*).

### 4. `LibraryItem` (Biblioteca de Plantillas y Guardados)
* `id` (UUID): Identificador único.
* `categoryId` (UUID): Clave foránea a `Category`.
* `title` (String): Título descriptivo de la plantilla.
* `content` (Text): Contenido redactado.
* `isShared` (Boolean): `true` para plantillas de equipo, `false` para guardados personales.
* `isFavorite` (Boolean): Marca de favorito para acceso rápido.
* **Índices**: `@@index([userId])`, `@@index([categoryId])`, `@@index([isShared])`, `@@index([isFavorite])`, `@@index([createdAt])`.

---

## Variables de Entorno

En `backend/.env` (archivo protegido e ignorado por Git):
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
GROQ_API_KEY=gsk_tu_clave_aqui
GROQ_MODEL=llama-3.1-8b-instant

# Conexión agrupada (Session / Transaction Pooler para consultas de la app)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"

# Conexión directa (utilizada por Prisma Migrate en el puerto 5432)
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"
```

---

## Endpoints de la API REST

* `GET /api/v1/history?limit=20&offset=0`: Lista el historial de consultas de IA ordenado cronológicamente.
* `GET /api/v1/categories`: Lista las categorías disponibles para clasificación.
* `GET /api/v1/library?categoryId=&isShared=&isFavorite=`: Lista las plantillas con filtros opcionales.
* `POST /api/v1/library`: Crea una nueva plantilla o guarda un texto generado en PostgreSQL.
* `PATCH /api/v1/library/:id`: Actualiza campos o el estado `isFavorite` de una plantilla.
* `DELETE /api/v1/library/:id`: Elimina una plantilla existente.

---

## Scripts Disponibles

Desde `mesa-de-ayuda/backend`:

* `npm run prisma:generate`: Genera el cliente tipado de Prisma Client.
* `npm run prisma:migrate`: Aplica las migraciones a la base de datos PostgreSQL en Supabase.
* `npm run prisma:seed`: Carga las categorías iniciales y plantillas compartidas base.
* `npm run prisma:studio`: Abre una interfaz web local para inspeccionar y editar tablas de PostgreSQL.
* `npm run test:db`: Comprueba de forma segura la conexión con PostgreSQL sin exponer credenciales.
* `npm run test`: Ejecuta la suite de 20 tests unitarios y de integración con mocks seguros.

---

## Seguridad y Privacidad

1. **Protección de Datos Laborales**: Los endpoints no exponen registros confidenciales en logs de consola (solo se registran rutas, estados y duraciones).
2. **Resiliencia de Inferencia**: Si la base de datos experimenta micro-cortes, el servicio de IA devuelve la respuesta al usuario sin interrumpir la operación laboral y registra la advertencia técnica internamente.
3. **Aislamiento de Pruebas**: Los tests automáticos (`npm run test`) utilizan mocks completos de repositorios y no modifican ni saturan la base de datos de producción/cloud.
