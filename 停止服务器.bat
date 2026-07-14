@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "停止服务器.ps1"
