# Discord Minigames Activity

A collection of fun minigames designed to work as a Discord activity. Players can compete for high scores and see their achievements posted directly to Discord channels.

## 🎮 Available Games

### Circus Game 🎪
- **Description**: Bounce on a trampoline and pop colorful balloons!
- **Objective**: Pop as many balloons as possible by bouncing and colliding with them
- **Features**: 
  - Physics-based bouncing mechanics
  - Multiple balloon colors with different bounce effects
  - Sound effects and visual feedback
  - Progressive difficulty with balloon respawning

### More Games Coming Soon! 🚧
- We're working on additional exciting minigames
- Stay tuned for updates!

## 🏗️ Architecture

### Client (Netlify)
- **Location**: `client/`
- **Technology**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **Deployment**: Netlify
- **Features**:
  - Responsive design for mobile and desktop
  - Real-time game rendering
  - Score submission to server
  - High score display

### Server (Railway)
- **Location**: `server/`
- **Technology**: Node.js, Express, Redis, Discord.js
- **Deployment**: Railway
- **Features**:
  - RESTful API for score management
  - Redis for high score storage
  - Discord bot integration
  - Matchmaking system (for future multiplayer features)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Redis (local or cloud)
- Discord Bot Token
- Discord Application (for OAuth2)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd minigames
   ```

2. **Set up environment variables**
   ```bash
   cp example.env .env
   # Edit .env with your actual values
   ```

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Serve the client**
   ```bash
   cd ../client
   # Use any static file server, e.g.:
   npx serve .
   # or
   python -m http.server 8000
   ```

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_CLIENT_SECRET=your_discord_client_secret_here
CHANNEL_ID=your_discord_channel_id_here

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# Server Configuration
PORT=3001
NODE_ENV=development
```

## 🚀 Deployment

### Server Deployment (Railway)

1. **Connect your repository to Railway**
2. **Add environment variables** in Railway dashboard
3. **Deploy automatically** on git push

### Client Deployment (Netlify)

1. **Connect your repository to Netlify**
2. **Set build settings**:
   - Build command: (leave empty)
   - Publish directory: `client`
3. **Deploy automatically** on git push

## 📡 API Endpoints

### Score Management
- `POST /api/score` - Submit a game score
- `GET /api/highscores` - Get top scores
- `GET /api/player/:name/score` - Get player's best score

### Health & Status
- `GET /api/health` - Server health check

### Discord Integration
- `POST /api/token` - Discord OAuth2 token exchange

### Matchmaking (Future)
- `POST /api/matchmaking/create` - Create a new match
- `GET /api/matchmaking/lobbies` - Get open lobbies
- `POST /api/matchmaking/join` - Join an existing match

## 🎯 Discord Integration

### Bot Setup
1. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a bot and get the token
3. Add the bot to your server with appropriate permissions
4. Get the channel ID where scores should be posted

### Bot Permissions
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands (for future features)

### Score Posting
When players complete games, scores are automatically posted to Discord with:
- Player name and score
- Game type and level
- Top 5 high scores
- Discord user information (if authenticated)

## 🎮 Game Development

### Adding New Games

1. **Create game directory** in `client/`
   ```bash
   mkdir client/newgame
   ```

2. **Add game files**:
   - `index.html` - Game interface
   - `game.js` - Game logic
   - `style.css` - Game styling
   - `assets/` - Game assets

3. **Update main index.html** to include the new game

4. **Update server** to handle the new game type

### Game Integration
- Games should use the `gameservices.js` module for score submission
- Implement proper error handling for network issues
- Support both mouse and touch controls for mobile compatibility

## 🔧 Development

### Project Structure
```
minigames/
├── client/                 # Frontend (Netlify)
│   ├── index.html         # Main game selection
│   ├── circus/            # Circus game
│   │   ├── index.html
│   │   ├── game.js
│   │   ├── style.css
│   │   └── assets/
│   └── netlify.toml       # Netlify config
├── server/                # Backend (Railway)
│   ├── server.js          # Main server file
│   ├── modules/           # Server modules
│   │   ├── Config.js
│   │   ├── RedisManager.js
│   │   ├── DiscordManager.js
│   │   ├── APIRoutes.js
│   │   └── MatchmakingManager.js
│   └── package.json
└── README.md
```

### Code Style
- Use ES6+ features
- Follow consistent naming conventions
- Add proper error handling
- Include JSDoc comments for functions

## 🐛 Troubleshooting

### Common Issues

**Redis Connection Failed**
- Check Redis URL in environment variables
- Ensure Redis is running locally or accessible
- For Railway, verify Redis service is added

**Discord Bot Not Working**
- Verify bot token is correct
- Check bot permissions in Discord server
- Ensure channel ID is correct

**Client Can't Connect to Server**
- Update server URL in client code
- Check CORS settings
- Verify server is running and accessible

### Logs
- Server logs are available in Railway dashboard
- Client errors appear in browser console
- Discord bot logs show in server console

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Happy Gaming! 🎮**
