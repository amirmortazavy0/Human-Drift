@echo off
echo ===================================================
echo Starting Human Drift — R&D Work Logger
echo ===================================================

echo [1/2] Installing Node.js packages...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed. Please ensure Node.js 18+ is installed.
    pause
    exit /b 1
)

echo [2/2] Building application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo ---------------------------------------------------
echo  Local browser access:    http://localhost:3000
echo ---------------------------------------------------
echo.

call npm start
pause
