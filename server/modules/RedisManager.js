import { createClient } from 'redis';

/**
 * RedisManager - Handles Redis connection and high score operations
 * Provides centralized Redis functionality with proper error handling
 */
export class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.HIGH_SCORES_KEY = 'minigames:high_scores';
    this.PLAYER_SCORES_KEY = 'minigames:player_scores';
  }

  /**
   * Initialize Redis connection
   * @param {string} redisUrl - Redis connection URL
   * @returns {Promise<boolean>} True if connection successful
   */
  async initialize(redisUrl) {
    try {
      console.log('🔄 Initializing Redis connection...');
      
      this.client = createClient({
        url: redisUrl || 'redis://127.0.0.1:6379',
        socket: {
          connectTimeout: 30000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.log('❌ Too many Redis reconnection attempts, giving up');
              return false;
            }
            const delay = Math.min(retries * 1000, 5000);
            console.log(`🔄 Redis reconnection attempt ${retries} in ${delay}ms`);
            return delay;
          }
        }
      });

      this.setupEventHandlers();
      await this.connect();
      
      return this.isConnected;
    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error.message);
      return false;
    }
  }

  /**
   * Setup Redis event handlers
   */
  setupEventHandlers() {
    this.client.on('error', (err) => {
      console.log('❌ Redis Client Error:', err.message);
      if (err.code === 'ECONNREFUSED') {
        console.log('💡 Redis connection refused. Make sure Redis is running.');
      }
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('🔗 Redis Client Connected');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis Client Ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      console.log('🔌 Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   * @returns {Promise<boolean>} True if connection successful
   */
  async connect() {
    try {
      if (process.env.REDIS_URL) {
        console.log('📍 Using Railway Redis URL');
        console.log('Redis URL format:', process.env.REDIS_URL.substring(0, 20) + '...');
      } else {
        console.log('📍 Using localhost Redis (for development)');
      }
      
      // Wait a bit for Railway services to be ready
      if (process.env.RAILWAY_ENVIRONMENT) {
        console.log('🚂 Railway environment detected, waiting for services...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      await this.client.connect();
      console.log('✅ Successfully connected to Redis');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message);
      console.log('Error details:', {
        code: error.code,
        address: error.address,
        port: error.port,
        syscall: error.syscall
      });
      
      if (process.env.RAILWAY_ENVIRONMENT) {
        console.log('🚂 Railway troubleshooting:');
        console.log('1. Check if Redis volume is added to your project');
        console.log('2. Verify REDIS_URL is set in Railway variables');
        console.log('3. Check Railway logs for Redis service status');
      }
      
      console.log('⚠️  The server will continue without Redis functionality');
      console.log('⚠️  High scores will not be saved until Redis is available');
      return false;
    }
  }

  /**
   * Check if Redis is ready for operations
   * @returns {boolean} True if Redis is ready
   */
  isReady() {
    return this.client && this.client.isReady && this.isConnected;
  }

  /**
   * Save a player's score to Redis (only saves if it's their best)
   * @param {string} playerName - Player's name
   * @param {number} score - Player's score
   * @param {number} level - Game level
   * @param {string} discordUserId - Discord user ID
   * @param {string} gameType - Type of game (e.g., 'circus', 'breakout')
   * @returns {Promise<boolean>} True if score was saved (new personal best)
   */
  async savePlayerScore(playerName, score, level = 1, discordUserId = null, gameType = 'unknown') {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, skipping score save');
        return false;
      }

      // Check if Redis is actually connected
      if (!this.client.isOpen) {
        console.log('🔄 Redis connection not open, attempting to reconnect...');
        try {
          await this.client.connect();
        } catch (reconnectError) {
          console.log('❌ Failed to reconnect to Redis:', reconnectError.message);
          return false;
        }
      }

      const scoreData = {
        playerName,
        score,
        level,
        gameType,
        discordUserId,
        timestamp: Date.now()
      };

      // Save individual player's best score (only if it's higher)
      const playerKey = `${this.PLAYER_SCORES_KEY}:${playerName}`;
      const existingScore = await this.client.get(playerKey);
      
      if (!existingScore || score > JSON.parse(existingScore).score) {
        await this.client.set(playerKey, JSON.stringify(scoreData));
        console.log(`🏆 New high score for ${playerName}: ${score} points (${gameType})`);
        
        // Only add to global high scores if it's a new personal best
        await this.client.zAdd(this.HIGH_SCORES_KEY, {
          score: score,
          value: JSON.stringify(scoreData)
        });

        // Keep only top 10 scores
        await this.client.zRemRangeByRank(this.HIGH_SCORES_KEY, 0, -11);
        
        return true; // New high score saved
      } else {
        console.log(`⏭️  ${playerName}'s score ${score} is not higher than existing ${JSON.parse(existingScore).score}`);
        return false; // No new high score
      }

    } catch (error) {
      console.error('❌ Error saving player score:', error);
      return false;
    }
  }

  /**
   * Get top high scores from Redis
   * @param {number} limit - Number of scores to retrieve
   * @returns {Promise<Array>} Array of high scores
   */
  async getTopHighScores(limit = 10) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning empty high scores');
        return [];
      }

      const scores = await this.client.zRange(this.HIGH_SCORES_KEY, 0, limit - 1, { REV: true });
      return scores.map(score => JSON.parse(score));
    } catch (error) {
      console.error('❌ Error getting high scores:', error);
      return [];
    }
  }

  /**
   * Get a specific player's best score
   * @param {string} playerName - Player's name
   * @returns {Promise<Object|null>} Player's best score or null
   */
  async getPlayerBestScore(playerName) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning null for player score');
        return null;
      }

      const playerKey = `${this.PLAYER_SCORES_KEY}:${playerName}`;
      const scoreData = await this.client.get(playerKey);
      return scoreData ? JSON.parse(scoreData) : null;
    } catch (error) {
      console.error('❌ Error getting player score:', error);
      return null;
    }
  }

  /**
   * Get Redis connection status
   * @returns {Object} Connection status information
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isReady: this.isReady(),
      hasClient: !!this.client
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client && this.client.isOpen) {
      await this.client.disconnect();
      console.log('🔌 Redis disconnected');
    }
  }
}
