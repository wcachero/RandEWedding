@echo off
REM ============================================================================
REM  Build + redeploy the myika-letter app to the existing IIS site folder.
REM  No admin required (just copies files). Run from the project folder.
REM ============================================================================
setlocal

set "PROJ=%~dp0"
set "SRC=%PROJ%dist\myika-letter\browser"
set "DEST=C:\wwwroot\gw"

echo === Building production bundle ===
call ng build --configuration production || ( echo [ERROR] Build failed. & exit /b 1 )

if not exist "%SRC%\index.html" ( echo [ERROR] Build output missing at "%SRC%". & exit /b 1 )

echo(
echo === Mirroring "%SRC%" -^> "%DEST%" ===
robocopy "%SRC%" "%DEST%" /MIR /NFL /NDL /NJH /NJS /NP
if %ERRORLEVEL% GEQ 8 ( echo [ERROR] Copy failed. & exit /b 1 )

echo(
echo === Done ===  Reload  http://localhost/
endlocal
