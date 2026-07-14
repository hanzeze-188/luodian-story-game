@echo off
title Launch Game
cd /d "%~dp0"
echo Starting local server...
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start "" "http://127.0.0.1:8765/index.html"
    echo Server started. Do not close this window.
    echo.
    python -m http.server 8765 --bind 127.0.0.1
    goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
    start "" "http://127.0.0.1:8765/index.html"
    echo Server started. Do not close this window.
    echo.
    py -m http.server 8765 --bind 127.0.0.1
    goto :end
)

where npx >nul 2>nul
if %errorlevel%==0 (
    start "" "http://127.0.0.1:8765/index.html"
    echo Server started. Do not close this window.
    echo.
    npx http-server -p 8765 -a 127.0.0.1 -c-1
    goto :end
)

echo [ERROR] Python or Node.js not found.
echo Install Python: https://www.python.org/downloads/
echo Or Node.js: https://nodejs.org/
echo.
echo You can also double-click index.html to play in 2D mode.
echo.
pause

:end
