@echo off
chcp 65001 >nul 2>&1
title Claude Code + CC-Switch 一键安装器
echo.
echo   正在启动安装器，请稍候...
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0install.ps1"
echo.
echo   按任意键退出...
pause >nul
