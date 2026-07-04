@echo off
REM ---------------------------------------------------------------------
REM Suit les logs d'un service Supabase en direct (tail + follow).
REM A lancer depuis le dossier supabase\docker (ou copie-le dedans).
REM
REM Usage :
REM   logs.cmd                 -> functions, 50 dernieres lignes puis suivi
REM   logs.cmd db              -> service "db", 50 lignes puis suivi
REM   logs.cmd functions 200   -> functions, 200 lignes puis suivi
REM   logs.cmd functions 50 lyrics generate-audio create-payment
REM        -> functions filtre sur ces mots-cles (findstr)
REM
REM Ctrl+C pour arreter.
REM ---------------------------------------------------------------------
setlocal enabledelayedexpansion

set "SERVICE=%~1"
if "%SERVICE%"=="" set "SERVICE=functions"

set "LINES=%~2"
if "%LINES%"=="" set "LINES=50"

REM Mots-cles de filtrage optionnels (a partir du 3e argument)
set "FILTER="
shift & shift
:collect
if not "%~1"=="" (
  if defined FILTER (set "FILTER=!FILTER! %~1") else (set "FILTER=%~1")
  shift
  goto collect
)

if defined FILTER (
  echo [logs] service=%SERVICE% tail=%LINES% filtre="%FILTER%"
  docker compose logs -f --tail=%LINES% %SERVICE% ^| findstr /i "%FILTER%"
) else (
  echo [logs] service=%SERVICE% tail=%LINES%
  docker compose logs -f --tail=%LINES% %SERVICE%
)

endlocal
