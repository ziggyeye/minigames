# Breakout Game Server

A modular, object-oriented Node.js server for the Breakout game with Discord integration and Redis high score tracking.

## 🏗️ Architecture

The server follows a modular, object-oriented design with clear separation of concerns:

```
server/
├── modules/
│   ├── Config.js              # Environment configuration management
│   ├── RedisManager.js        # Redis connection and high score operations
│   ├── DiscordManager.js      # Discord bot operations and score posting
│   ├── MatchmakingManager.js  # Asynchronous turn-based matchmaking system
│   └── APIRoutes.js           # API endpoint handlers
├── server.js                  # Main server class and startup logic
├── test-matchmaking.js        # Matchmaking system test script
└── README.md                  # This file
```

## 📦 Modules

### 🔧 Config.js
**Purpose**: Environment variable validation and configuration management

**Key Features**:
- ✅ Validates all required environment variables
- ✅ Masks sensitive values in logs
- ✅ Provides typed configuration access
- ✅ Environment detection (production, Railway, etc.)

**Methods**:
- `load()` - Load and validate configuration
- `get(key)` - Get specific configuration value
- `getDiscordConfig()` - Get Discord-specific config
- `getRedisConfig()` - Get Redis-specific config
- `getServerConfig()` - Get server-specific config

### 🗄️ RedisManager.js
**Purpose**: Redis connection management and high score operations

**Key Features**:
- ✅ Robust connection handling with retry logic
- ✅ Railway-specific optimizations
- ✅ Comprehensive error handling
- ✅ High score management (personal bests + global top scores)

**Methods**:
- `initialize(redisUrl)` - Initialize Redis connection
- `savePlayerScore()` - Save player's best score only
- `getTopHighScores(limit)` - Get global top scores
- `getPlayerBestScore(playerName)` - Get player's best score
- `getStatus()` - Get connection status
- `disconnect()` - Graceful disconnection

### 🤖 DiscordManager.js
**Purpose**: Discord bot operations and score posting

**Key Features**:
- ✅ Discord bot initialization and management
- ✅ Rich embed creation for score posts
- ✅ User information fetching
- ✅ Comprehensive error handling
- ✅ Permission validation
- ✅ Discord bot commands for matchmaking
- ✅ Automatic message handling

**Methods**:
- `initialize(token, channelId, matchmakingManager)` - Initialize Discord bot
- `postScoreToDiscord()` - Post score with rich embed
- `getDiscordUser(userId)` - Fetch Discord user info
- `createScoreEmbed()` - Create rich Discord embed
- `handleMessage()` - Handle Discord commands
- `handleMatchesCommand()` - Handle !matches command
- `handleStatsCommand()` - Handle !stats command
- `handleCancelCommand()` - Handle !cancel command
- `handleHelpCommand()` - Handle !help command
- `getStatus()` - Get bot status
- `disconnect()` - Graceful disconnection

**Discord Commands**:
- `!matches <playerName>` - Get player's match history
- `!stats` - Show matchmaking statistics
- `!cancel <matchId>` - Cancel waiting match (creator only)
- `!help` - Show available commands

### 🎮 MatchmakingManager.js
**Purpose**: Asynchronous turn-based matchmaking system

**Key Features**:
- ✅ Asynchronous matchmaking (players don't need to be online simultaneously)
- ✅ Turn-based gameplay (one player submits, then another joins)
- ✅ Lobby system for open matches
- ✅ Score-based match resolution
- ✅ Discord notifications for match completion
- ✅ Match history tracking
- ✅ Match cancellation support

**Methods**:
- `createMatch()` - Create new match/lobby
- `getOpenLobbies()` - Get available matches to join
- `joinMatch()` - Join existing match and resolve
- `getPlayerMatches()` - Get player's match history
- `getMatchDetails()` - Get specific match information
- `cancelMatch()` - Cancel waiting match
- `resolveMatch()` - Determine winner based on scores
- `notifyMatchResolution()` - Post results to Discord

### 🌐 APIRoutes.js
**Purpose**: API endpoint handlers with validation and error handling

**Key Features**:
- ✅ Comprehensive input validation
- ✅ Standardized error responses
- ✅ Request logging
- ✅ Rate limiting ready

**Endpoints**:
- `POST /api/score` - Submit game score
- `GET /api/health` - Health check
- `GET /api/highscores` - Get top scores
- `GET /api/player/:name/score` - Get player score
- `POST /api/token` - Discord token exchange

**Matchmaking Endpoints**:
- `POST /api/matchmaking/create` - Create new match
- `GET /api/matchmaking/lobbies` - Get open lobbies
- `POST /api/matchmaking/join` - Join existing match
- `GET /api/matchmaking/matches/:id` - Get match details
- `GET /api/matchmaking/player/:name/matches` - Get player matches
- `DELETE /api/matchmaking/matches/:id` - Cancel match
- `GET /api/matchmaking/stats` - Get matchmaking stats

## 🚀 Main Server Class

### BreakoutServer
**Purpose**: Orchestrates all modules and manages server lifecycle

**Key Features**:
- ✅ Modular initialization
- ✅ Graceful shutdown handling
- ✅ Comprehensive error handling
- ✅ Request logging middleware
- ✅ Service health monitoring

**Methods**:
- `initialize()` - Initialize all services
- `setupMiddleware()` - Configure Express middleware
- `initializeServices()` - Initialize Redis and Discord
- `setupRoutes()` - Setup API routes
- `start()` - Start HTTP server
- `shutdown()` - Graceful shutdown

## 🔄 Server Lifecycle

1. **Configuration Loading** - Validate environment variables
2. **Middleware Setup** - Configure CORS, JSON parsing, logging
3. **Service Initialization** - Initialize Redis and Discord connections
4. **Route Setup** - Configure API endpoints
5. **Server Start** - Start HTTP server
6. **Graceful Shutdown** - Handle SIGINT/SIGTERM signals

## 🛡️ Error Handling

### Graceful Degradation
- ✅ Server continues without Redis (scores not saved)
- ✅ Server continues without Discord (no score posting)
- ✅ Comprehensive error logging with emojis
- ✅ Railway-specific troubleshooting

### Signal Handling
- ✅ SIGINT (Ctrl+C) - Graceful shutdown
- ✅ SIGTERM - Graceful shutdown
- ✅ Uncaught exceptions - Log and shutdown
- ✅ Unhandled rejections - Log and shutdown

## 📊 Logging

The server uses emoji-enhanced logging for better readability:

- 🚀 Server startup
- ✅ Success operations
- ❌ Error conditions
- ⚠️ Warnings
- 🔄 Retry operations
- 📤 Outgoing requests
- 📥 Incoming requests
- 🛑 Shutdown operations

## 🔧 Environment Variables

### Required
```bash
DISCORD_TOKEN=your_discord_bot_token
CHANNEL_ID=your_discord_channel_id
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
REDIS_URL=your_redis_connection_url
```

### Optional
```bash
PORT=3001                    # Server port (default: 3001)
NODE_ENV=production          # Environment (default: development)
RAILWAY_ENVIRONMENT=true     # Railway detection (auto-detected)
```

## 🚂 Railway Deployment

The server includes Railway-specific optimizations:

- ✅ Extended connection timeouts (30s)
- ✅ Service readiness waiting
- ✅ Railway environment detection
- ✅ Comprehensive troubleshooting logs
- ✅ Graceful service degradation

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3001/api/health
```

### Submit Score
```bash
curl -X POST http://localhost:3001/api/score \
  -H "Content-Type: application/json" \
  -d '{"playerName":"TestPlayer","score":42,"level":2}'
```

### Get High Scores
```bash
curl http://localhost:3001/api/highscores?limit=5
```

### Create Match
```bash
curl -X POST http://localhost:3001/api/matchmaking/create \
  -H "Content-Type: application/json" \
  -d '{"playerName":"Alice","score":45,"level":3}'
```

### Get Open Lobbies
```bash
curl http://localhost:3001/api/matchmaking/lobbies?limit=10
```

### Join Match
```bash
curl -X POST http://localhost:3001/api/matchmaking/join \
  -H "Content-Type: application/json" \
  -d '{"matchId":"match_1234567890_abc123","playerName":"Bob","score":52,"level":4}'
```

### Get Player Matches
```bash
curl http://localhost:3001/api/matchmaking/player/Alice/matches?limit=5
```

### Get Matchmaking Stats
```bash
curl http://localhost:3001/api/matchmaking/stats
```

## 🤖 Discord Bot Commands

The Discord bot now supports the following commands in the configured channel:

### View Player Matches
```
!matches <playerName>
```
Example: `!matches Alice`

### View System Statistics
```
!stats
```

### Cancel Waiting Match
```
!cancel <matchId>
```
Example: `!cancel match_1234567890_abc123`
*Note: Only the match creator can cancel their match*

### Show Help
```
!help
```

## 🎮 Matchmaking System

### How It Works

1. **Player submits score** - System automatically creates or joins matches
2. **Automatic matchmaking** - If lobbies exist, player joins oldest match; otherwise creates new match
3. **Match is resolved** - When second player joins, system compares scores to determine winner
4. **Discord notification** - Results are posted to Discord channel
5. **Match history** - All matches are tracked for players
6. **Discord commands** - Players can check stats, view matches, and cancel matches via Discord

### Atomicity & Idempotency Guarantees

- **Race Condition Prevention** - WATCH/MULTI/EXEC prevents double-joins
- **Duplicate Match Prevention** - Players can't create multiple waiting matches
- **Idempotent Operations** - Safe to retry requests without side effects
- **Atomic Stats Updates** - Player win/loss records updated consistently
- **Request ID Support** - Use `x-request-id` or `x-idempotency-key` headers
- **Client Integration** - Client automatically sends idempotency keys
- **Retry Logic** - Automatic retries for failed transactions
- **Cached Results** - 1-hour cache for idempotent responses

### Automatic Matchmaking Flow

1. **Player submits score** via `/api/score`
2. **System checks** for open lobbies
3. **If lobbies exist**: Player joins oldest available match
4. **If no lobbies**: Player creates new match and waits
5. **Match resolution**: When second player joins, winner is determined
6. **Discord notification**: Rich embed posted with results

### Match Resolution Logic

- **Higher score wins** - Player with more bricks destroyed wins
- **Tie breaker 1** - Higher level wins if scores are equal
- **Tie breaker 2** - Earlier submission wins if levels are equal

### Match States

- **waiting** - Match created, waiting for opponent
- **completed** - Both players submitted, match resolved
- **cancelled** - Match was cancelled by creator

## 🔄 Migration from Monolithic

The server was refactored from a monolithic structure to improve:

- ✅ **Maintainability** - Clear separation of concerns
- ✅ **Testability** - Isolated modules
- ✅ **Scalability** - Easy to extend
- ✅ **Error Handling** - Comprehensive error management
- ✅ **Logging** - Enhanced debugging capabilities
- ✅ **Configuration** - Centralized and validated
- ✅ **Documentation** - Clear module purposes

## 🎯 Best Practices Implemented

- ✅ **Single Responsibility Principle** - Each module has one purpose
- ✅ **Dependency Injection** - Modules receive dependencies
- ✅ **Error Boundaries** - Comprehensive error handling
- ✅ **Graceful Degradation** - Continue without optional services
- ✅ **Configuration Validation** - Fail fast on missing config
- ✅ **Logging Standards** - Consistent logging format
- ✅ **Resource Management** - Proper cleanup on shutdown
- ✅ **Input Validation** - Validate all inputs
- ✅ **Security** - Mask sensitive values in logs

## 🛡️ Critical Fixes Implemented

### Race Condition Prevention
- ✅ **WATCH/MULTI/EXEC Pattern** - True atomic operations in `joinMatch()`
- ✅ **Retry Logic** - Up to 10 retries for failed transactions
- ✅ **State Validation** - Verify match state before operations

### Idempotency Implementation
- ✅ **Client Integration** - `ScoreManager` automatically sends `x-request-id`
- ✅ **Server Caching** - 1-hour cache for repeated requests
- ✅ **Request Deduplication** - Prevents duplicate processing
- ✅ **Header Support** - Both `x-request-id` and `x-idempotency-key`

### Atomic Operations
- ✅ **Stats Updates** - Single transaction for read/write operations
- ✅ **Match Resolution** - All Redis operations in one transaction
- ✅ **Discord Notifications** - Outside transactions to prevent blocking

### Testing & Validation
- ✅ **Comprehensive Test Suite** - `test-atomicity-fixes.js`
- ✅ **Race Condition Tests** - Simulates concurrent operations
- ✅ **Idempotency Tests** - Verifies duplicate request handling
- ✅ **Integration Tests** - End-to-end validation