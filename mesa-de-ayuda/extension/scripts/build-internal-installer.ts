import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../..');
const EXTENSION_DIR = path.resolve(ROOT_DIR, 'extension');
const DIST_DIR = path.resolve(EXTENSION_DIR, 'dist');
const RELEASE_DIR = path.resolve(ROOT_DIR, 'release');
const INSTALLER_ROOT = path.resolve(RELEASE_DIR, 'internal-installer');
const PACKAGE_DIR = path.resolve(INSTALLER_ROOT, 'Mesa-de-Ayuda-Installer');
const TARGET_EXT_DIR = path.resolve(PACKAGE_DIR, 'extension');

console.log('🚀 INICIANDO CONSTRUCCIÓN DEL INSTALADOR INTERNO...');

// 1. Limpiar y compilar producción de la extensión
console.log('📦 1. Compilando extensión en modo producción...');
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}

execSync('npm run build', { cwd: EXTENSION_DIR, stdio: 'inherit' });

// 2. Preparar directorios de release
console.log('📁 2. Preparando estructura del instalador...');
if (fs.existsSync(INSTALLER_ROOT)) {
  fs.rmSync(INSTALLER_ROOT, { recursive: true, force: true });
}

fs.mkdirSync(TARGET_EXT_DIR, { recursive: true });

// Función recursiva para copiar directorios
function copyRecursive(src: string, dest: string) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copiar dist a extension/
console.log('📋 3. Copiando build limpio de extensión a release/internal-installer/...');
copyRecursive(DIST_DIR, TARGET_EXT_DIR);

// 4. Crear INSTALAR.bat
const instalarBat = `@echo off
setlocal
pushd "%~dp0"
title Mesa de Ayuda - Instalacion
color 0B
cls

set "BASE_DIR=%~dp0"
set "EXT_DIR=%BASE_DIR%extension"

:: Validar que exista la carpeta de la extension y su manifest
if not exist "%EXT_DIR%\\manifest.json" (
    echo ================================================================
    echo               MESA DE AYUDA - ERROR DE ARCHIVOS
    echo ================================================================
    echo.
    echo  [ERROR] No se encontro la carpeta de la extension o sus archivos.
    echo.
    echo  Causas comunes:
    echo   1. Has movido el archivo "INSTALAR.bat" fuera de su carpeta original.
    echo   2. El archivo ZIP no se descomprimio completamente antes de ejecutar.
    echo.
    echo  Solucion:
    echo   Asegurate de extraer todo el contenido del archivo ZIP en una carpeta
    echo   y ejecuta INSTALAR.bat sin mover los archivos.
    echo.
    echo ================================================================
    echo.
    pause
    popd
    endlocal
    exit /b 1
)

echo ================================================================
echo               MESA DE AYUDA - INSTALACION
echo ================================================================
echo.

:: 1. Copiar ruta al portapapeles de Windows de forma segura
echo %EXT_DIR%| clip

:: 2. Detectar ejecutable de Google Chrome en ubicaciones estandar
set "CHROME_BIN="
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (
    set "CHROME_BIN=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"
)

:: 3. Abrir pagina de extensiones en Chrome con --new-tab
if defined CHROME_BIN (
    start "" "%CHROME_BIN%" --new-tab "chrome://extensions/"
) else (
    start "" chrome.exe --new-tab "chrome://extensions/" 2>nul
)

:: 4. Abrir carpeta extension en el Explorador de Windows
start "" explorer.exe "%EXT_DIR%"

echo  [OK] Se abrio Chrome y la carpeta "extension" en el Explorador.
echo  [OK] Ruta copiada al portapapeles: "%EXT_DIR%"
echo.
echo ================================================================
echo                     PASOS PARA COMPLETAR LA INSTALACION
echo ================================================================
echo.
echo  1. EN CHROME:
echo     Si no se abrio automaticamente la pagina de extensiones, escribe:
echo.
echo        chrome://extensions
echo.
echo     en la barra de direcciones de Chrome y presiona ENTER.
echo.
echo  2. EN LA ESQUINA SUPERIOR DERECHA:
echo     Activa la casilla: [ Modo de desarrollador ]
echo.
echo  3. EN LA ESQUINA SUPERIOR IZQUIERDA:
echo     Haz clic en el boton: [ Cargar descomprimida ]
echo.
echo  4. SELECCIONA LA CARPETA:
echo     Selecciona la carpeta "extension" que se abrio en el Explorador
echo     (o pega la ruta que ya tienes en el portapapeles con Ctrl + V).
echo.
echo  5. FINALIZAR:
echo     Haz clic en el icono de Extensiones (pieza de rompecabezas)
echo     en Chrome, fija "Mesa de Ayuda" e inicia sesion.
echo.
echo ================================================================
echo.
echo  Presiona cualquier tecla para cerrar esta ventana...
pause >nul
popd
endlocal
`;

fs.writeFileSync(path.join(PACKAGE_DIR, 'INSTALAR.bat'), instalarBat, 'utf-8');

// 5. Crear ACTUALIZAR.bat
const actualizarBat = `@echo off
setlocal
pushd "%~dp0"
title Mesa de Ayuda - Actualizacion
color 0A
cls

set "BASE_DIR=%~dp0"
set "EXT_DIR=%BASE_DIR%extension"

:: Validar que exista la carpeta de la extension
if not exist "%EXT_DIR%\\manifest.json" (
    echo ================================================================
    echo               MESA DE AYUDA - ERROR DE ARCHIVOS
    echo ================================================================
    echo.
    echo  [ERROR] No se encontro la carpeta de la extension o sus archivos.
    echo  Por favor descomprime el paquete completo antes de actualizar.
    echo.
    echo ================================================================
    echo.
    pause
    popd
    endlocal
    exit /b 1
)

echo ================================================================
echo               MESA DE AYUDA - ACTUALIZACION
echo ================================================================
echo.

:: Detectar ejecutable de Google Chrome en ubicaciones estandar
set "CHROME_BIN="
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (
    set "CHROME_BIN=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"
)

:: Abrir pagina de extensiones en Chrome con --new-tab
if defined CHROME_BIN (
    start "" "%CHROME_BIN%" --new-tab "chrome://extensions/"
) else (
    start "" chrome.exe --new-tab "chrome://extensions/" 2>nul
)

echo  [OK] Abriendo pagina de extensiones en Chrome...
echo.
echo ================================================================
echo                     PASOS DE ACTUALIZACION
echo ================================================================
echo.
echo  1. EN CHROME:
echo     Si no se abrio automaticamente, ve a: chrome://extensions
echo.
echo  2. LOCALIZA LA TARJETA:
echo     Busca la tarjeta "Mesa de Ayuda".
echo.
echo  3. ACTUALIZAR:
echo     Haz clic en el boton circular de recargar (o pulsa "Actualizar").
echo.
echo  4. LISTO:
echo     La extension se habra actualizado con los nuevos cambios.
echo.
echo ================================================================
echo.
echo  Presiona cualquier tecla para cerrar esta ventana...
pause >nul
popd
endlocal
`;

fs.writeFileSync(path.join(PACKAGE_DIR, 'ACTUALIZAR.bat'), actualizarBat, 'utf-8');

// 6. Crear LEEME.txt
const leemeTxt = `================================================================
               MESA DE AYUDA - GUIA DE USO
================================================================

QUE ES MESA DE AYUDA?
Es un asistente inteligente de soporte tecnico que te ayuda a redactar,
parafrasear y estructurar respuestas a usuarios con rapidez y estilo
profesional.

----------------------------------------------------------------
COMO INSTALAR (PRIMERA VEZ):
----------------------------------------------------------------
1. Haz doble clic en el archivo "INSTALAR.bat".
2. Google Chrome se abrira en la pagina de extensiones y el Explorador
   mostrara la carpeta "extension".
3. Si Chrome no se posiciona automaticamente en extensiones, escribe:
   chrome://extensions  en la barra de Chrome y presiona Enter.
4. En la esquina superior derecha de Chrome, activa el interruptor:
   [ Modo de desarrollador ]
5. En la esquina superior izquierda, haz clic en:
   [ Cargar descomprimida ]
6. Pega la ruta de la carpeta (ya esta copiada en tu portapapeles con Ctrl+V)
   o selecciona la carpeta "extension" abierta en el Explorador.
7. Listo! En la barra de herramientas de Chrome haz clic en el icono
   de pieza de rompecabezas y fija "Mesa de Ayuda".
8. Abre la extension e inicia sesion con tus credenciales de soporte.

----------------------------------------------------------------
COMO ACTUALIZAR (FUTURAS VERSIONES):
----------------------------------------------------------------
1. Cuando recibas una nueva version, descomprimela y reemplaza
   la carpeta actual.
2. Ejecuta "ACTUALIZAR.bat" y presiona el boton de recargar
   en la tarjeta de Mesa de Ayuda dentro de Chrome.

----------------------------------------------------------------
SOPORTE Y AYUDA:
----------------------------------------------------------------
Si tienes dudas o inconvenientes con tus credenciales de acceso,
comunicate con el administrador de Mesa de Ayuda.
`;

fs.writeFileSync(path.join(PACKAGE_DIR, 'LEEME.txt'), leemeTxt, 'utf-8');

// 7. Crear VERSION.txt
const versionTxt = `Mesa de Ayuda
Version: 1.1.0
Extension ID: fmjogpnhmmmplalbhmgdglgpijhnfddl
Build Date: 2026-08-25
Backend Environment: Production (Render Cloud)
Manifest: V3 (Unpacked / Fixed Key)
`;

fs.writeFileSync(path.join(PACKAGE_DIR, 'VERSION.txt'), versionTxt, 'utf-8');

// 8. Crear ZIP con PowerShell
console.log('🗜️ 4. Comprimiendo paquete ZIP...');
const zipFile = path.resolve(RELEASE_DIR, 'Mesa-de-Ayuda-Installer-v1.1.0.zip');
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

const powershellCmd = `Compress-Archive -Path "${PACKAGE_DIR}" -DestinationPath "${zipFile}" -Force`;
execSync(`powershell -NoProfile -Command "${powershellCmd}"`, { stdio: 'inherit' });

// 9. Generar SHA-256
console.log('🔒 5. Calculando hash SHA-256...');
const fileBuffer = fs.readFileSync(zipFile);
const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const sha256File = path.resolve(RELEASE_DIR, 'Mesa-de-Ayuda-Installer-v1.1.0.sha256');
fs.writeFileSync(sha256File, `${hashSum}  Mesa-de-Ayuda-Installer-v1.1.0.zip\n`, 'utf-8');

console.log('----------------------------------------------------');
console.log('✅ INSTALADOR INTERNO GENERADO EXITOSAMENTE');
console.log(`📁 Paquete: ${PACKAGE_DIR}`);
console.log(`📦 Archivo ZIP: ${zipFile}`);
console.log(`🔑 SHA-256: ${hashSum}`);
console.log('----------------------------------------------------');
