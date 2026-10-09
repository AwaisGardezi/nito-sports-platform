@echo off
rem ===========================================================================
rem  NITO SPORTS - one-click platform launcher
rem ---------------------------------------------------------------------------
rem  Double-click this file. It starts tools\server.js, which serves BOTH the
rem  website (frontend) and the API the console talks to (backend) from one
rem  process, then opens your browser at the site.
rem
rem  Your data is saved to data\platform-db.json and survives a restart.
rem  Close this window (or press Ctrl+C) to stop the platform.
rem
rem  Everything here is plain ASCII on purpose - a .cmd with non-ASCII text can
rem  be mangled by the console code page and fail in confusing ways.
rem ===========================================================================

setlocal
title NITO SPORTS - Platform
cd /d "%~dp0"

set "NODE="

rem 1. Node on PATH is the normal case.
where node >nul 2>nul && set "NODE=node"

rem 2. The standard installer location.
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"

rem 3. Nothing else — install Node from nodejs.org if both checks fail.

if not defined NODE (
  echo.
  echo   Node.js was not found on this machine.
  echo.
  echo   Install it from  https://nodejs.org  ^(the "LTS" button^),
  echo   then double-click this file again. Nothing else is needed -
  echo   the platform has no other dependencies.
  echo.
  pause
  exit /b 1
)

"%NODE%" "tools\server.js" %*

set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (
  echo.
  echo   The platform stopped with an error ^(exit code %CODE%^).
  echo   The message above says why.
  echo.
  pause
)

endlocal
