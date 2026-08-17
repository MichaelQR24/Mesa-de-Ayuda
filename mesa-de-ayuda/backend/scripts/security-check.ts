import dotenv from 'dotenv';
dotenv.config();

console.log('🔒 Verificando configuración de seguridad del sistema...\n');

let issuesFound = 0;

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtAccess = process.env.JWT_ACCESS_SECRET || '';
const jwtRefresh = process.env.JWT_REFRESH_SECRET || '';
const groqKey = process.env.GROQ_API_KEY || '';
const dbUrl = process.env.DATABASE_URL || '';
const corsOrigin = process.env.CORS_ORIGIN || '';

console.log(`[+] Entorno detectado (NODE_ENV): ${nodeEnv}`);

// 1. Verificación de Secrets JWT
if (jwtAccess.length < 32) {
  console.error('❌ ERROR: JWT_ACCESS_SECRET debe tener al menos 32 caracteres.');
  issuesFound++;
} else {
  console.log('✅ JWT_ACCESS_SECRET: Longitud adecuada (>= 32 caracteres).');
}

if (jwtRefresh.length < 32) {
  console.error('❌ ERROR: JWT_REFRESH_SECRET debe tener al menos 32 caracteres.');
  issuesFound++;
} else {
  console.log('✅ JWT_REFRESH_SECRET: Longitud adecuada (>= 32 caracteres).');
}

if (nodeEnv === 'production') {
  if (jwtAccess.includes('development') || jwtAccess.includes('secret')) {
    console.error('❌ ERROR: JWT_ACCESS_SECRET utiliza un valor de desarrollo en producción.');
    issuesFound++;
  }
  if (jwtRefresh.includes('development') || jwtRefresh.includes('secret')) {
    console.error('❌ ERROR: JWT_REFRESH_SECRET utiliza un valor de desarrollo en producción.');
    issuesFound++;
  }
}

// 2. Verificación de Groq API Key
if (!groqKey) {
  console.warn('⚠️ ADVERTENCIA: GROQ_API_KEY no está configurada.');
  if (nodeEnv === 'production') issuesFound++;
} else {
  console.log('✅ GROQ_API_KEY: Configurada correctamente.');
}

// 3. Verificación de Base de Datos
if (!dbUrl) {
  console.error('❌ ERROR: DATABASE_URL no está configurada.');
  issuesFound++;
} else {
  console.log('✅ DATABASE_URL: Configurada correctamente.');
}

// 4. Verificación de CORS
if (nodeEnv === 'production' && (corsOrigin === '*' || corsOrigin === '')) {
  console.error('❌ ERROR: CORS_ORIGIN no puede ser "*" en producción.');
  issuesFound++;
} else {
  console.log(`✅ CORS: Configurado para entorno ${nodeEnv}.`);
}

console.log('\n----------------------------------------');
if (issuesFound === 0) {
  console.log('🎉 Verificación de seguridad EXITOSA: 0 problemas encontrados.');
  process.exit(0);
} else {
  console.error(`❌ Verificación de seguridad FALLIDA: ${issuesFound} problemas encontrados.`);
  process.exit(1);
}
