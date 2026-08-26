@echo off
setlocal
pushd "%~dp0"
title Mesa de Ayuda - Actualizacion
color 0A
cls

set "BASE_DIR=%~dp0"
set "EXT_DIR=%BASE_DIR%extension"

:: Validar que exista la carpeta de la extension
if not exist "%EXT_DIR%\manifest.json" (
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
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%LocalAppData%\Google\Chrome\Application\chrome.exe"
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
