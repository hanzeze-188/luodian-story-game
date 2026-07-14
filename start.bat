@echo off
chcp 65001 >nul
title 匣中珠光 · 螺钿非遗互动剧情
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   匣中珠光 · 螺钿非遗互动剧情            ║
echo  ║   正在启动本地服务器...                   ║
echo  ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM 尝试 Python
where python >nul 2>nul
if %errorlevel%==0 (
    echo  使用 Python 启动服务器...
    echo  浏览器即将打开，请勿关闭此窗口。
    echo  关闭此窗口即可停止服务器。
    echo.
    start "" "http://127.0.0.1:8765/index.html"
    python -m http.server 8765 --bind 127.0.0.1
    goto :end
)

REM 尝试 Python3
where python3 >nul 2>nul
if %errorlevel%==0 (
    echo  使用 Python3 启动服务器...
    start "" "http://127.0.0.1:8765/index.html"
    python3 -m http.server 8765 --bind 127.0.0.1
    goto :end
)

REM 尝试 Node.js (npx http-server)
where npx >nul 2>nul
if %errorlevel%==0 (
    echo  使用 Node.js 启动服务器...
    start "" "http://127.0.0.1:8765/index.html"
    npx http-server -p 8765 -a 127.0.0.1
    goto :end
)

echo  [错误] 未找到 Python 或 Node.js，请先安装其中之一。
echo  推荐：https://www.python.org/downloads/
echo.
pause

:end
