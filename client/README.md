# Discord Minigames Client

This is the client-side application for the Discord Minigames Activity. It serves the game interfaces and provides a Node.js server for development and deployment.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Backend server running (see server README)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your backend URL
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   - Main app: http://localhost:3000
   - Circus game: http://localhost:3000/circus

## 📁 Project Structure

```
client/
├── server.js              # Node.js server
├── package.json           # Dependencies and scripts
├── index.html            # Main game selection
├── circus/               # Circus game
│   ├── index.html        # Circus game interface
│   ├── game.js           # Circus game logic
│   ├── style.css         # Circus game styles
│   ├── gameservices.js   # Score submission
│   └── assets/           # Game assets
├── nodemon.json          # Development configuration
└── env.example           # Environment variables template
```

## 🎮 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-restart
- `npm run build` - Build step (no-op for static files)
- `npm run preview` - Preview the application

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```env
# Client Configuration
PORT=3000
BACKEND_URL=http://localhost:3001

# Development settings
NODE_ENV=development
```

### Backend Connection

The client connects to the backend server for:
- Score submission
- High score retrieval
- Game statistics

Make sure your backend server is running and accessible at the `BACKEND_URL`.

## 🎯 Features

### Game Selection Interface
- Beautiful, responsive design
- Game cards with descriptions
- High score display
- Real-time score updates

### Circus Game
- Physics-based bouncing mechanics
- Multiple balloon colors
- Sound effects and visual feedback
- Score tracking and submission

### API Integration
- Automatic score submission
- High score retrieval
- Error handling and fallbacks
- Discord activity integration

## 🛠️ Development

### Adding New Games

1. **Create game directory**
   ```bash
   mkdir client/newgame
   ```

2. **Add game files**
   - `index.html` - Game interface
   - `game.js` - Game logic
   - `style.css` - Game styling
   - `assets/` - Game assets

3. **Update main index.html** to include the new game

4. **Add route in server.js**
   ```javascript
   app.get('/newgame', (req, res) => {
       res.sendFile(path.join(__dirname, 'newgame/index.html'));
   });
   ```

### Development Tips

- Use `nodemon` for auto-restart during development
- Check browser console for errors
- Test on both desktop and mobile
- Verify backend connectivity

## 🚀 Deployment

### Netlify (Static)
- Build command: (leave empty)
- Publish directory: `.`
- Environment variables: Set `BACKEND_URL`

### Railway/Heroku (Node.js)
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: Set `PORT` and `BACKEND_URL`

### Vercel
- Framework preset: Other
- Build command: `npm install`
- Output directory: `.`
- Install command: `npm install`

## 🐛 Troubleshooting

### Common Issues

**Backend Connection Failed**
- Check `BACKEND_URL` in environment variables
- Ensure backend server is running
- Verify CORS settings on backend

**Assets Not Loading**
- Check file paths in game files
- Verify assets directory structure
- Check server static file serving

**Game Not Working**
- Check browser console for errors
- Verify JavaScript modules are loading
- Test in different browsers

### Logs
- Server logs appear in terminal
- Client errors in browser console
- Network errors in browser dev tools

## 📝 API Endpoints

The client proxies these endpoints to the backend:

- `GET /api/highscores` - Get top scores
- `POST /api/score` - Submit game score
- `GET /api/health` - Backend health check

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Happy Gaming! 🎮**
