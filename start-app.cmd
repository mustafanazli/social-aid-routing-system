@echo off
title Pendik Sosyal Yardim ve Rota Optimizasyon Sistemi
cd /d "%~dp0"

echo.
echo   ============================================================
echo    Pendik Sosyal Yardim ve Rota Optimizasyon Sistemi
echo   ============================================================
echo.

rem Node'u standart kurulum klasorunden PATH'e ekle (Explorer PATH bayat olabilir).
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo   [HATA] Node.js bulunamadi. https://nodejs.org adresinden kurun.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   [1/2] Bagimliliklar yukleniyor ^(ilk calistirmada birkac dakika surebilir^)...
  call npm install
  if errorlevel 1 (
    echo   [HATA] npm install basarisiz oldu.
    pause
    exit /b 1
  )
)

echo   [2/2] Gelistirme sunucusu baslatiliyor...
echo   Tarayici birkac saniye icinde http://localhost:3000 adresini acacak.
echo   Durdurmak icin bu pencereyi kapatin ya da CTRL+C yapin.
echo.

start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:3000'"

call npm run dev