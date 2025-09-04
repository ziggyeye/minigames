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
    this.CHARACTERS_KEY = 'minigames:characters';
    this.USER_CHARACTERS_KEY = 'minigames:user_characters';
    this.BATTLE_STATS_KEY = 'minigames:battle_stats';
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
   * Save a character to Redis
   * @param {Object} character - Character object
   * @returns {Promise<Object>} Result object with success status
   */
  async saveCharacter(character) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, skipping character save');
        return { success: false, error: 'Redis not available' };
      }

      // Check if Redis is actually connected
      if (!this.client.isOpen) {
        console.log('🔄 Redis connection not open, attempting to reconnect...');
        try {
          await this.client.connect();
        } catch (reconnectError) {
          console.log('❌ Failed to reconnect to Redis:', reconnectError.message);
          return { success: false, error: 'Redis connection failed' };
        }
      }

      // Save character data
      const characterKey = `${this.CHARACTERS_KEY}:${character.id}`;
      await this.client.set(characterKey, JSON.stringify(character));
      
      // Add to user's character list (sorted set by creation time)
      const userCharactersKey = `${this.USER_CHARACTERS_KEY}:${character.discordUserId}`;
      await this.client.zAdd(userCharactersKey, {
        score: Date.now(),
        value: character.id
      });

      // Keep only the latest 50 characters per user
      await this.client.zRemRangeByRank(userCharactersKey, 0, -51);

      console.log(`🎭 Character saved: ${character.characterName} for user ${character.discordUserId}`);
      return { success: true, character: character };

    } catch (error) {
      console.error('❌ Error saving character:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all characters for a specific Discord user
   * @param {string} discordUserId - Discord user ID
   * @param {number} limit - Maximum number of characters to retrieve
   * @returns {Promise<Array>} Array of character objects
   */
  async getUserCharacters(discordUserId, limit = 50) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning empty characters list');
        return [];
      }

      // Get character IDs for the user (most recent first)
      const userCharactersKey = `${this.USER_CHARACTERS_KEY}:${discordUserId}`;
      const characterIds = await this.client.zRange(userCharactersKey, 0, limit - 1, { REV: true });

      if (characterIds.length === 0) {
        return [];
      }

      // Get full character data
      const characters = [];
      for (const characterId of characterIds) {
        const characterKey = `${this.CHARACTERS_KEY}:${characterId}`;
        const characterData = await this.client.get(characterKey);
        if (characterData) {
          characters.push(JSON.parse(characterData));
        }
      }

      console.log(`🎭 Retrieved ${characters.length} characters for user ${discordUserId}`);
      return characters;

    } catch (error) {
      console.error('❌ Error getting user characters:', error);
      return [];
    }
  }

  /**
   * Get a specific character by ID
   * @param {string} characterId - Character ID
   * @returns {Promise<Object|null>} Character object or null
   */
  async getCharacterById(characterId) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning null for character');
        return null;
      }

      const characterKey = `${this.CHARACTERS_KEY}:${characterId}`;
      const characterData = await this.client.get(characterKey);
      return characterData ? JSON.parse(characterData) : null;
    } catch (error) {
      console.error('❌ Error getting character:', error);
      return null;
    }
  }

  /**
   * Check if a character with the given name already exists for a user
   * @param {string} discordUserId - Discord user ID
   * @param {string} characterName - Character name to check
   * @returns {Promise<Object|null>} Existing character object or null
   */
  async getCharacterByName(discordUserId, characterName) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning null for character check');
        return null;
      }

      // Get all characters for the user
      const characters = await this.getUserCharacters(discordUserId, 100);
      
      // Check if any character has the same name (case-insensitive)
      const existingCharacter = characters.find(char => 
        char.characterName.toLowerCase() === characterName.toLowerCase()
      );
      
      return existingCharacter || null;
    } catch (error) {
      console.error('❌ Error checking character by name:', error);
      return null;
    }
  }

  /**
   * Delete a character
   * @param {string} discordUserId - Discord user ID (for verification)
   * @param {string} characterId - Character ID
   * @returns {Promise<Object>} Result object with success status
   */
  async deleteCharacter(discordUserId, characterId) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, skipping character deletion');
        return { success: false, error: 'Redis not available' };
      }

      // Get character to verify ownership
      const character = await this.getCharacterById(characterId);
      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      if (character.discordUserId !== discordUserId) {
        return { success: false, error: 'Unauthorized to delete this character' };
      }

      // Delete character data
      const characterKey = `${this.CHARACTERS_KEY}:${characterId}`;
      await this.client.del(characterKey);
      
      // Remove from user's character list
      const userCharactersKey = `${this.USER_CHARACTERS_KEY}:${discordUserId}`;
      await this.client.zRem(userCharactersKey, characterId);

      console.log(`🗑️  Character deleted: ${character.characterName} for user ${discordUserId}`);
      return { success: true, message: 'Character deleted successfully' };

    } catch (error) {
      console.error('❌ Error deleting character:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update battle statistics for a character
   * @param {string} discordUserId - Discord user ID
   * @param battleResult
   * @param {Object} playerCharacter - Player character object
   * @returns {Promise<Object>} Updated battle statistics
   */
  async updateBattleStats(discordUserId, battleResult, playerCharacter) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, skipping battle stats update');
        return this.getDefaultBattleStats();
      }

      // Use character-specific key instead of user-specific key
      const statsKey = `${this.BATTLE_STATS_KEY}:${discordUserId}:${playerCharacter.name}`;
      
      // Get current stats or initialize
      const currentStats = await this.getCharacterBattleStats(discordUserId, playerCharacter.name);
      
      // Update stats based on battle result
      const playerWon = battleResult.winner.name === playerCharacter.name;
      const updatedStats = {
        totalBattles: currentStats.totalBattles + 1,
        wins: currentStats.wins + (playerWon ? 1 : 0),
        losses: currentStats.losses + (playerWon ? 0 : 1),
        ties: currentStats.ties + (battleResult === 'tie' ? 1 : 0),
        lastBattleDate: new Date().toISOString()
      };
      
      // Update character level
      await this.updateCharacterLevel(discordUserId, playerCharacter.name, playerWon);
      
      // Calculate win rate
      updatedStats.winRate = updatedStats.totalBattles > 0 
        ? Math.round((updatedStats.wins / updatedStats.totalBattles) * 100) 
        : 0;
      
      // Save updated stats
      await this.client.hSet(statsKey, updatedStats);
      
      console.log(`📊 Battle stats updated for character ${playerCharacter.name} (${discordUserId}): ${updatedStats.wins}W/${updatedStats.losses}L (${updatedStats.winRate}%)`);
      
      return updatedStats;

    } catch (error) {
      console.error('❌ Error updating battle stats:', error);
      return this.getDefaultBattleStats();
    }
  }

  /**
   * Update character level based on battle result
   * @param {string} discordUserId - Discord user ID
   * @param {string} characterName - Character name
   * @param {boolean} won - Whether the character won the battle
   * @returns {Promise<number>} New character level
   */
  async updateCharacterLevel(discordUserId, characterName, won) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, skipping character level update');
        return 0;
      }

      const levelKey = `minigames:character_levels:${discordUserId}:${characterName}`;
      
      if (won) {
        // Increment level on win
        const newLevel = await this.client.incr(levelKey);
        console.log(`📈 Character ${characterName} leveled up to ${newLevel}`);
        return newLevel;
      } else {
        // Reset to 0 on loss
        await this.client.set(levelKey, 0);
        console.log(`📉 Character ${characterName} level reset to 0 after loss`);
        return 0;
      }

    } catch (error) {
      console.error('❌ Error updating character level:', error);
      return 0;
    }
  }

  /**
   * Get character level
   * @param {string} discordUserId - Discord user ID
   * @param {string} characterName - Character name
   * @returns {Promise<number>} Character level
   */
  async getCharacterLevel(discordUserId, characterName) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, returning default character level');
        return 0;
      }

      const levelKey = `minigames:character_levels:${discordUserId}:${characterName}`;
      const level = await this.client.get(levelKey);
      
      return level ? parseInt(level) : 0;

    } catch (error) {
      console.error('❌ Error getting character level:', error);
      return 0;
    }
  }

  /**
   * Set battle cooldown for a user
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<Date>} Cooldown expiration time
   */
  async setBattleCooldown(discordUserId) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, skipping battle cooldown set');
        return new Date(Date.now() + 60000); // 60 seconds from now
      }

      const cooldownKey = `minigames:battle_cooldown:${discordUserId}`;
      const cooldownExpiry = new Date(Date.now() + 60000); // 60 seconds
      
      // Set cooldown with 60 second expiration
      await this.client.setEx(cooldownKey, 60, cooldownExpiry.toISOString());
      
      console.log(`⏰ Battle cooldown set for ${discordUserId} until ${cooldownExpiry.toISOString()}`);
      return cooldownExpiry;

    } catch (error) {
      console.error('❌ Error setting battle cooldown:', error);
      return new Date(Date.now() + 60000);
    }
  }

  /**
   * Get battle cooldown for a user
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<Date|null>} Cooldown expiration time or null if no cooldown
   */
  async getBattleCooldown(discordUserId) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, returning no cooldown');
        return null;
      }

      const cooldownKey = `minigames:battle_cooldown:${discordUserId}`;
      const cooldownExpiry = await this.client.get(cooldownKey);
      
      if (cooldownExpiry) {
        const expiryDate = new Date(cooldownExpiry);
        console.log(`⏰ Battle cooldown active for ${discordUserId} until ${expiryDate.toISOString()}`);
        return expiryDate;
      }
      
      return null;

    } catch (error) {
      console.error('❌ Error getting battle cooldown:', error);
      return null;
    }
  }

  /**
   * Check if user is on battle cooldown
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<{onCooldown: boolean, timeRemaining: number, cooldownExpiry: Date|null}>}
   */
  async checkBattleCooldown(discordUserId) {
    try {
      const cooldownExpiry = await this.getBattleCooldown(discordUserId);
      
      if (!cooldownExpiry) {
        return {
          onCooldown: false,
          timeRemaining: 0,
          cooldownExpiry: null
        };
      }

      const now = new Date();
      const timeRemaining = Math.max(0, cooldownExpiry.getTime() - now.getTime());
      const onCooldown = timeRemaining > 0;

      return {
        onCooldown,
        timeRemaining,
        cooldownExpiry
      };

    } catch (error) {
      console.error('❌ Error checking battle cooldown:', error);
      return {
        onCooldown: false,
        timeRemaining: 0,
        cooldownExpiry: null
      };
    }
  }

  /**
   * Get battle gems for a user
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<number>} Number of battle gems
   */
  async getBattleGems(discordUserId) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, returning default battle gems');
        return 0;
      }

      const gemsKey = `minigames:battle_gems:${discordUserId}`;
      const gems = await this.client.get(gemsKey);
      
      return gems ? parseInt(gems) : 0;

    } catch (error) {
      console.error('❌ Error getting battle gems:', error);
      return 0;
    }
  }

  /**
   * Add battle gems to a user (with max limit enforcement)
   * @param {string} discordUserId - Discord user ID
   * @param {number} amount - Amount to add
   * @returns {Promise<{success: boolean, newTotal: number, message: string}>}
   */
  async addBattleGems(discordUserId, amount) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, skipping battle gems addition');
        return { success: false, newTotal: 0, message: 'Redis not available' };
      }

      const gemsKey = `minigames:battle_gems:${discordUserId}`;
      const currentGems = await this.getBattleGems(discordUserId);
      const newTotal = Math.min(currentGems + amount, 5); // Max 5 gems
      
      if (newTotal === currentGems) {
        return { 
          success: false, 
          newTotal: currentGems, 
          message: 'Maximum battle gems (5) already reached' 
        };
      }

      await this.client.set(gemsKey, newTotal);
      console.log(`💎 Added ${amount} battle gems to ${discordUserId}. New total: ${newTotal}`);
      
      return { 
        success: true, 
        newTotal: newTotal, 
        message: `Added ${amount} battle gems. New total: ${newTotal}` 
      };

    } catch (error) {
      console.error('❌ Error adding battle gems:', error);
      return { success: false, newTotal: 0, message: 'Failed to add battle gems' };
    }
  }

  /**
   * Spend battle gems for a user
   * @param {string} discordUserId - Discord user ID
   * @param {number} amount - Amount to spend
   * @returns {Promise<{success: boolean, newTotal: number, message: string}>}
   */
  async spendBattleGems(discordUserId, amount) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, skipping battle gems spending');
        return { success: false, newTotal: 0, message: 'Redis not available' };
      }

      const gemsKey = `minigames:battle_gems:${discordUserId}`;
      const currentGems = await this.getBattleGems(discordUserId);
      
      if (currentGems < amount) {
        return { 
          success: false, 
          newTotal: currentGems, 
          message: `Insufficient battle gems. You have ${currentGems}, need ${amount}` 
        };
      }

      const newTotal = currentGems - amount;
      await this.client.set(gemsKey, newTotal);
      console.log(`💎 Spent ${amount} battle gems from ${discordUserId}. New total: ${newTotal}`);
      
      return { 
        success: true, 
        newTotal: newTotal, 
        message: `Spent ${amount} battle gems. New total: ${newTotal}` 
      };

    } catch (error) {
      console.error('❌ Error spending battle gems:', error);
      return { success: false, newTotal: 0, message: 'Failed to spend battle gems' };
    }
  }

  /**
   * Get battle statistics for a specific character
   * @param {string} discordUserId - Discord user ID
   * @param {string} characterName - Character name
   * @returns {Promise<Object>} Battle statistics
   */
  async getCharacterBattleStats(discordUserId, characterName) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, returning default battle stats');
        return this.getDefaultBattleStats();
      }

      const statsKey = `${this.BATTLE_STATS_KEY}:${discordUserId}:${characterName}`;
      const stats = await this.client.hGetAll(statsKey);
      
      if (!stats || Object.keys(stats).length === 0) {
        return this.getDefaultBattleStats();
      }
      
      // Convert string values to numbers and calculate win rate
      const battleStats = {
        totalBattles: parseInt(stats.totalBattles) || 0,
        wins: parseInt(stats.wins) || 0,
        losses: parseInt(stats.losses) || 0,
        ties: parseInt(stats.ties) || 0,
        lastBattleDate: stats.lastBattleDate || null
      };
      
      battleStats.winRate = battleStats.totalBattles > 0 
        ? Math.round((battleStats.wins / battleStats.totalBattles) * 100) 
        : 0;
      
      return battleStats;

    } catch (error) {
      console.error('❌ Error getting character battle stats:', error);
      return this.getDefaultBattleStats();
    }
  }

  /**
   * Get battle statistics for a user (legacy method - now returns combined stats for all characters)
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<Object>} Combined battle statistics for all user's characters
   */
  async getBattleStats(discordUserId) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, returning default battle stats');
        return this.getDefaultBattleStats();
      }

      // Get all characters for the user
      const characters = await this.getUserCharacters(discordUserId, 100);
      
      if (characters.length === 0) {
        return this.getDefaultBattleStats();
      }

      // Combine stats from all characters
      let combinedStats = this.getDefaultBattleStats();
      
      for (const character of characters) {
        const characterStats = await this.getCharacterBattleStats(discordUserId, character.characterName);
        combinedStats.totalBattles += characterStats.totalBattles;
        combinedStats.wins += characterStats.wins;
        combinedStats.losses += characterStats.losses;
        combinedStats.ties += characterStats.ties;
      }
      
      // Calculate combined win rate
      combinedStats.winRate = combinedStats.totalBattles > 0 
        ? Math.round((combinedStats.wins / combinedStats.totalBattles) * 100) 
        : 0;
      
      return combinedStats;

    } catch (error) {
      console.error('❌ Error getting combined battle stats:', error);
      return this.getDefaultBattleStats();
    }
  }

  /**
   * Get default battle statistics
   * @returns {Object} Default battle stats
   */
  getDefaultBattleStats() {
    return {
      totalBattles: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winRate: 0,
      lastBattleDate: null
    };
  }

  /**
   * Reset battle statistics for a user (for testing/admin purposes)
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<boolean>} True if reset successful
   */
  async resetBattleStats(discordUserId) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️  Redis not ready, cannot reset battle stats');
        return false;
      }

      const statsKey = `${this.BATTLE_STATS_KEY}:${discordUserId}`;
      await this.client.del(statsKey);
      
      console.log(`🔄 Battle stats reset for user ${discordUserId}`);
      return true;

    } catch (error) {
      console.error('❌ Error resetting battle stats:', error);
      return false;
    }
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
