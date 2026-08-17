import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

console.log('🚀 Iniciando proceso de Release Oficial — Mesa de Ayuda v1.0.0\n');

const extensionDir = resolve('.');
const workspaceDir = resolve('..');
const releaseDir = join(workspaceDir, 'release');
const versionDir = join(releaseDir, 'mesa-de-ayuda-v1.0.0');
const distDir = join(extensionDir, 'dist');
const zipPath = join(releaseDir, 'mesa-de-ayuda-v1.0.0.zip');
const shaPath = join(releaseDir, 'mesa-de-ayuda-v1.0.0.sha256');

// 1. Limpiar carpetas previas
console.log('1. Limpiando directorios de release previos...');
rmSync(versionDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
rmSync(shaPath, { force: true });
mkdirSync(versionDir, { recursive: true });

// 2. Compilación limpia para producción
console.log('2. Ejecutando compilación limpia con Vite en modo production...');
execSync('npm run build', { stdio: 'inherit', cwd: extensionDir });

// 3. Copiar dist/ a release/mesa-de-ayuda-v1.0.0/
console.log('3. Copiando artefactos a la carpeta de release final...');
cpSync(distDir, versionDir, { recursive: true });

// 4. Generar metadatos y guía para el usuario
console.log('4. Generando RELEASE-INFO.txt y LEEME.txt...');
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: workspaceDir }).toString().trim();
} catch {}

const releaseInfo = `=====================================================
MESA DE AYUDA - ASISTENTE DE SOPORTE TÉCNICO
Release Oficial v1.0.0 (Manifest V3)
=====================================================
Versión: 1.0.0
Fecha de Compilación: ${new Date().toISOString()}
Git Commit: ${gitCommit}
Backend Cloud: https://mesa-de-ayuda-j6uw.onrender.com
Entorno: Producción (HTTPS)
Requisitos del Usuario: Google Chrome + Internet
=====================================================
`;
writeFileSync(join(versionDir, 'RELEASE-INFO.txt'), releaseInfo, 'utf-8');

const leemeContent = `=====================================================
MESA DE AYUDA - GUÍA RÁPIDA DE INSTALACIÓN (v1.0.0)
=====================================================

1. GUARDA ESTA CARPETA
   Guarda esta carpeta ("mesa-de-ayuda-v1.0.0") en una ubicación
   permanente de tu PC (por ejemplo en Documentos o en tu carpeta de usuario).
   ¡IMPORTANTE: No muevas ni borres esta carpeta después de instalarla!

2. ABRIR EXTENSIONES EN CHROME
   Abre Google Chrome y escribe en la barra de direcciones:
   chrome://extensions

3. ACTIVAR MODO DESARROLLADOR
   Activa el interruptor "Modo de desarrollador" en la esquina superior derecha.

4. CARGAR LA EXTENSIÓN
   Haz clic en el botón "Cargar extensión sin empaquetar" (o "Cargar descomprimida")
   en la esquina superior izquierda.
   Selecciona exactamente esta carpeta ("mesa-de-ayuda-v1.0.0").

5. FIJAR EL ICONO
   Haz clic en el icono de la pieza de rompecabezas (Extensiones) en la barra de Chrome
   y fija "Mesa de Ayuda" para tenerla siempre visible.

6. INICIAR SESIÓN
   Abre el panel lateral, ingresa con tu correo corporativo y tu contraseña
   proporcionada por el administrador.

Soporte Técnico: Contactar al administrador del sistema.
`;
writeFileSync(join(versionDir, 'LEEME.txt'), leemeContent, 'utf-8');

// 5. Escaneo de Secretos y Localhost en la carpeta de release
console.log('5. Ejecutando auditoría de seguridad y escaneo de secretos en el release...');
function scanDir(dir: string) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.json')) {
      const content = readFileSync(fullPath, 'utf-8');

      // Escaneo de secretos reales (no regexes de validación de SensitiveDataGuard)
      const realGroqKey = /gsk_[a-zA-Z0-9]{25,}/.test(content);
      const realOpenAiKey = /sk-[a-zA-Z0-9]{30,}/.test(content);
      const realDbUrl = /postgres(?:ql)?:\/\/[a-zA-Z0-9_]+:[^@]+@/.test(content);
      const realJwtSecret = /JWT_ACCESS_SECRET\s*=\s*[a-zA-Z0-9_]{10,}/.test(content);

      if (realGroqKey || realOpenAiKey || realDbUrl || realJwtSecret) {
        throw new Error(`🚨 ERROR CRÍTICO: Se detectó un secreto real expuesto en ${file}`);
      }

      // Escaneo de localhost
      if (content.includes('localhost:3000') && !file.endsWith('.json')) {
        console.warn(`⚠️ Advertencia: referencia a localhost detectada en ${file}`);
      }
    }
  }
}
scanDir(versionDir);
console.log('✅ Escaneo de seguridad superado: 0 secretos detectados.');

// 6. Generar archivo ZIP y Checksum SHA-256
console.log('6. Generando archivo ZIP y Checksum SHA-256...');
try {
  execSync(`powershell -command "Compress-Archive -Path '${versionDir}\\*' -DestinationPath '${zipPath}' -Force"`, { cwd: releaseDir });
  const zipBuffer = readFileSync(zipPath);
  const sha256 = createHash('sha256').update(zipBuffer).digest('hex');
  writeFileSync(shaPath, `${sha256}  mesa-de-ayuda-v1.0.0.zip\n`, 'utf-8');
  console.log(`📦 Paquete ZIP creado: ${zipPath}`);
  console.log(`🔑 SHA-256: ${sha256}`);
} catch (err) {
  console.warn('Nota: No se pudo comprimir ZIP automáticamente, la carpeta unpacked está lista.');
}

console.log('\n🎉 ¡Release v1.0.0 generado con éxito en release/mesa-de-ayuda-v1.0.0!');
