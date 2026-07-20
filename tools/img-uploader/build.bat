@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo [2/3] Building with PyInstaller...
pip show pyinstaller >nul 2>nul || pip install pyinstaller

pyinstaller ^
    --noconfirm ^
    --clean ^
    --onefile ^
    --windowed ^
    --name "CosHubUploader" ^
    main.py
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Done! Output: dist\CosHubUploader.exe
pause
