#!/bin/bash

# Discord Minigames Client Startup Script

echo "🎮 Starting Discord Minigames Client..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your backend URL"
fi

# Start the development server
echo "🚀 Starting development server..."
echo "📍 Main app: http://localhost:3000"
echo "🎪 Circus game: http://localhost:3000/circus"
echo "🏥 Health check: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
