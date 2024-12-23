@echo off

REM Ensure we're in the right directory
cd /d "%~dp0"

REM Check if uv is installed
where uv >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing uv...
    powershell -Command "iwr https://astral.sh/uv/install.ps1 -useb | iex"
)

REM Create virtual environment if it doesn't exist
if not exist .venv (
    echo Creating virtual environment...
    uv venv
)

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
uv pip install -r requirements.txt

echo Setup complete! You can now run: python rpg_client.py start
pause 