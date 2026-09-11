@echo off
echo ===================================================
echo Starting Human Drift - Train Performance Study
echo ===================================================

echo [1/3] Checking and installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies. Please ensure Python 3.10+ is installed and added to PATH.
    pause
    exit /b 1
)

echo [2/3] Installing Node.js packages and building frontend...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed. Please ensure Node.js 18+ is installed.
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)

echo [3/3] Launching Human Drift unified server...
echo.
echo ---------------------------------------------------
echo  Local browser access:    http://localhost:8000
echo  Phone access (same Wi-Fi): Find your PC IP with 'ipconfig' (e.g. http://192.168.1.X:8000)
echo ---------------------------------------------------
echo.

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause
