@echo off
setlocal
pushd "%~dp0"
title Mesa de Ayuda - Instalacion
color 0B
cls

set "BASE_DIR=%~dp0"
set "EXT_DIR=%BASE_DIR%extension"

:: Validar que exista la carpeta de la extension y su manifest
if not exist "%EXT_DIR%\manifest.json" (
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
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%LocalAppData%\Google\Chrome\Application\chrome.exe"
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
