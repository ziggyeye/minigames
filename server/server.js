import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Import modules
import { Config } from './modules/Config.js';
import { RedisManager } from './modules/RedisManager.js';
import { DiscordManager } from './modules/DiscordManager.js';
import { MatchmakingManager } from './modules/MatchmakingManager.js';
import { APIRoutes } from './modules/APIRoutes.js';

// Load environment variables
dotenv.config();

/**
 * Discord Minigames Server
 * Handles score tracking, Discord integration, and high score management for multiple minigames
 */
class BreakoutServer {
  constructor() {
    this.app = express();
    this.config = new Config();
    this.redisManager = new RedisManager();
    this.discordManager = new DiscordManager();
    this.matchmakingManager = null;
    this.apiRoutes = null;
    this.server = null;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Breakout Game Server...');
      
      // Load configuration
      const config = this.config.load();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Initialize services
      await this.initializeServices(config);
      
      // Setup API routes
      this.setupRoutes();
      
      console.log('✅ Server initialization complete');
      
    } catch (error) {
      console.error('❌ Server initialization failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    console.log('🔧 Setting up middleware...');
    
    // Enable CORS
    this.app.use(cors());
    
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Request logging middleware
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
    
    console.log('✅ Middleware setup complete');
  }

  /**
   * Initialize Redis and Discord services
   * @param {Object} config - Configuration object
   */
  async initializeServices(config) {
    console.log('🔧 Initializing services...');
    
    // Initialize Redis
    const redisConfig = this.config.getRedisConfig();
    const redisInitialized = await this.redisManager.initialize(redisConfig.url);
    
    if (!redisInitialized) {
      console.log('⚠️  Redis initialization failed, continuing without Redis');
    } else {
      // Ensure we have enough PVP characters
      await this.redisManager.ensurePVPCharacters(20);
    }
    
          // Initialize Matchmaking first
      this.matchmakingManager = new MatchmakingManager(this.redisManager, this.discordManager);
      console.log('✅ Matchmaking system initialized');

      // Initialize Discord with matchmaking manager
      const discordConfig = this.config.getDiscordConfig();
      const discordInitialized = await this.discordManager.initialize(
        discordConfig.token,
        discordConfig.channelId,
        this.matchmakingManager
      );
      
      if (!discordInitialized) {
        console.log('⚠️  Discord initialization failed, continuing without Discord');
      }
      
      console.log('✅ Services initialization complete');
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    console.log('🔧 Setting up API routes...');
    
    this.apiRoutes = new APIRoutes(this.redisManager, this.discordManager, this.matchmakingManager);
    this.apiRoutes.setupRoutes(this.app);
    
    console.log('✅ API routes setup complete');
  }

  /**
   * Start the server
   */
  async start() {
    try {
      const serverConfig = this.config.getServerConfig();
      
      this.server = this.app.listen(serverConfig.port, () => {
        console.log('🎉 Discord Minigames Server is running!');
        console.log(`📍 Server URL: http://localhost:${serverConfig.port}`);
        console.log(`🌍 Environment: ${serverConfig.nodeEnv}`);
        console.log(`🚂 Railway: ${serverConfig.isRailway ? 'Yes' : 'No'}`);
        console.log('📊 Health check: GET /api/health');
        console.log('📝 API endpoints:');
        console.log('  - POST /api/score - Submit game score (supports multiple games)');
        console.log('  - GET /api/highscores - Get top scores');
        console.log('  - GET /api/player/:name/score - Get player score');
        console.log('  - POST /api/token - Discord token exchange');
        console.log('🎮 Matchmaking endpoints:');
        console.log('  - POST /api/matchmaking/create - Create new match');
        console.log('  - GET /api/matchmaking/lobbies - Get open lobbies');
        console.log('  - POST /api/matchmaking/join - Join existing match');
        console.log('  - GET /api/matchmaking/matches/:id - Get match details');
        console.log('  - GET /api/matchmaking/player/:name/matches - Get player matches');
        console.log('  - GET /api/matchmaking/player/:name/stats - Get player stats');
        console.log('  - DELETE /api/matchmaking/matches/:id - Cancel match');
        console.log('⚔️ Battle AI endpoints:');
        console.log('  - POST /api/battle/simulate - Simulate AI battle');
        console.log('  - POST /api/pvp/battle/simulate - Simulate PVP battle');
        console.log('  - GET /api/topCharacters - Get top AI battle characters');
        console.log('  - GET /api/pvp/topCharacters - Get top PVP battle characters');
        console.log('  - GET /api/matchmaking/stats - Get matchmaking stats');
      });
      
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown() {
    console.log('🔄 Shutting down server...');
    
    try {
      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        console.log('✅ HTTP server closed');
      }
      
      // Disconnect services
      await this.redisManager.disconnect();
      await this.discordManager.disconnect();
      
      console.log('✅ Server shutdown complete');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Server startup and shutdown handling
const server = new BreakoutServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await server.shutdown();
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await server.shutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await server.shutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await server.shutdown();
});

// Start the server
async function main() {
  try {
    await server.initialize();
    await server.start();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main();
