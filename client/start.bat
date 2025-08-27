@echo off

REM Discord Minigames Client Startup Script

echo 🎮 Starting Discord Minigames Client...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚙️  Creating .env file from template...
    copy env.example .env
    echo 📝 Please edit .env file with your backend URL
)

REM Start the development server
echo 🚀 Starting development server...
echo 📍 Main app: http://localhost:3000
echo 🎪 Circus game: http://localhost:3000/circus
echo 🏥 Health check: http://localhost:3000/health
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev

pause
