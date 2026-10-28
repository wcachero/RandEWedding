@echo off
REM ============================================================================
REM  Fix IIS 403.503 (IpRestrictionModule) — allow unlisted clients.
REM  RUN AS ADMINISTRATOR.
REM ============================================================================
setlocal
set "APPCMD=%windir%\System32\inetsrv\appcmd.exe"

net session >nul 2>&1
if errorlevel 1 ( echo [ERROR] Run this as Administrator. & exit /b 1 )

echo(
echo === BEFORE: server-level IP restriction config ===
"%APPCMD%" list config /section:system.webServer/security/ipSecurity

echo(
echo === Allowing unlisted clients (this fixes 403.503) ===
"%APPCMD%" set config /section:system.webServer/security/ipSecurity /allowUnlisted:true /commit:apphost

echo(
echo === AFTER ===
"%APPCMD%" list config /section:system.webServer/security/ipSecurity
echo(
echo   NOTE: If the list above still shows any entries with allowed="false",
echo   those are explicit DENY rules. Tell me the ipAddress values and I'll
echo   give you the exact command to remove them.

echo(
echo === Recycling IIS ===
iisreset /noforce

echo(
echo Done. Reload  http://localhost/
endlocal
