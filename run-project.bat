@echo off
title REVORA Intelligence - Total System Launcher
echo ============================================================
echo   Starting REVORA Intelligence + MySQL Workbench System...
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-project.ps1"
pause
