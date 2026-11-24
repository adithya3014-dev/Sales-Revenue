@echo off
title REVORA Intelligence - MySQL to GitHub Live Bridge
echo Starting REVORA Live Connector...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0connect-live.ps1"
pause
