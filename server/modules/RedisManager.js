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
    this.PVP_BATTLE_STATS_KEY = 'minigames:pvp_battle_stats';
    this.PVP_MATCHMAKING_KEY = 'minigames:pvp_matchmaking';
    this.PROCESSED_PURCHASES_KEY = 'minigames:processed_purchases';
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
      let scoresMap = scores.map(score => JSON.parse(score));

      const fakeNames = [
        "Condiment Bob",
        "DogMan",
        "Detective Paws",
        "KickBall Guy",
        "Psycho Panda",
        "Shadow Wing",
        "Cool Beans",
        "Doughboy",
        "Frozen Flake",
        "Fry Cook",
        "Ice Cream Man"
      ]

      let i = 0;
      scoresMap.forEach(score => {
        score.playerName = score.playerName.replace('undefined', fakeNames[i]);
        i++;
      });

      return scoresMap;
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
        ties: currentStats.ties + (battleResult.winner.name === battleResult.loser.name ? 1 : 0),
        lastBattleDate: new Date().toISOString()
      };
      
      // Update character level
      await this.updateCharacterLevel(discordUserId, playerCharacter.name, playerWon);
      
      // Calculate win rate
      updatedStats.winRate = updatedStats.totalBattles > 0 
        ? Math.round((updatedStats.wins / updatedStats.totalBattles) * 100) 
        : 0;
      
      // Save updated stats
      await this.client.hSet(statsKey, {
        totalBattles: updatedStats.totalBattles.toString(),
        wins: updatedStats.wins.toString(),
        losses: updatedStats.losses.toString(),
        ties: updatedStats.ties.toString(),
        winRate: updatedStats.winRate.toString(),
        lastBattleDate: updatedStats.lastBattleDate
      });
      
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
      const newTotal = currentGems + amount;
      
      // if (newTotal === currentGems) {
      //   return { 
      //     success: false, 
      //     newTotal: currentGems, 
      //     message: 'Maximum battle gems (5) already reached' 
      //   };
      // }

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
   * Get top 10 characters by win rate across all users
   * @returns {Promise<Array>} Array of character objects with battle stats
   */
  async getTopCharactersByWinRate(limit = 10) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning empty top characters list');
        return [];
      }

      console.log('🏆 Getting top characters by win rate...');

      // Get all character keys that have battle stats
      const battleStatsPattern = `${this.BATTLE_STATS_KEY}:*`;
      const battleStatsKeys = await this.client.keys(battleStatsPattern);

      if (battleStatsKeys.length === 0) {
        console.log('ℹ️  No battle stats found');
        return [];
      }

      // Get all battle stats and calculate win rates
      const characterStats = [];
      for (const statsKey of battleStatsKeys) {
        try {
          const stats = await this.client.hGetAll(statsKey);
          if (stats && Object.keys(stats).length > 0) {
            const totalBattles = parseInt(stats.totalBattles) || 0;
            const wins = parseInt(stats.wins) || 0;
            
            // Only include characters with at least 1 battle
            if (totalBattles > 0) {
              const winRate = Math.round((wins / totalBattles) * 100);
              
              // Extract discordUserId and characterName from the key
              // Key format: minigames:battle_stats:discordUserId:characterName
              const keyParts = statsKey.split(':');
              if (keyParts.length >= 4) {
                const discordUserId = keyParts[2];
                const characterName = keyParts.slice(3).join(':'); // Handle character names with colons
                
                // Get character details
                const character = await this.getCharacterByUserAndName(discordUserId, characterName);
                if (character) {
                  characterStats.push({
                    characterName: character.characterName,
                    description: character.description,
                    stats: character.stats,
                    discordUserId: discordUserId,
                    totalBattles: totalBattles,
                    wins: wins,
                    losses: parseInt(stats.losses) || 0,
                    ties: parseInt(stats.ties) || 0,
                    winRate: winRate,
                    lastBattleDate: stats.lastBattleDate || null
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ Error processing battle stats key:', statsKey, error);
        }
      }

      // Sort by win rate (descending), then by total battles (descending) as tiebreaker
      characterStats.sort((a, b) => {
        if (b.winRate !== a.winRate) {
          return b.winRate - a.winRate;
        }
        return b.totalBattles - a.totalBattles;
      });

      // Return top N characters
      const topCharacters = characterStats.slice(0, limit);
      console.log(`🏆 Retrieved top ${topCharacters.length} characters by win rate`);
      
      return topCharacters;

    } catch (error) {
      console.error('❌ Error getting top characters by win rate:', error);
      return [];
    }
  }

  /**
   * Get a character by user ID and character name
   * @param {string} discordUserId - Discord user ID
   * @param {string} characterName - Character name
   * @returns {Promise<Object|null>} Character object or null
   */
  async getCharacterByUserAndName(discordUserId, characterName) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning fake character data');
        return this.generateFakeCharacterData(discordUserId, characterName);
      }

      // Get character ID from user's character list
      const userCharactersKey = `${this.USER_CHARACTERS_KEY}:${discordUserId}`;
      const characterIds = await this.client.zRange(userCharactersKey, 0, -1);

      // Find the character with matching name
      for (const characterId of characterIds) {
        const characterKey = `${this.CHARACTERS_KEY}:${characterId}`;
        const characterData = await this.client.get(characterKey);
        if (characterData) {
          const character = JSON.parse(characterData);
          if (character.characterName === characterName) {
            return character;
          }
        }
      }

      // Character not found, return fake data
      console.log(`⚠️  Character "${characterName}" not found for user ${discordUserId}, returning fake data`);
      if (characterName == undefined) {
        return this.generateFakeCharacterData(discordUserId, "The Unknown Warrior");
      }
      return this.generateFakeCharacterData(discordUserId, characterName);
    } catch (error) {
      console.error('❌ Error getting character by user and name:', error);
      console.log('⚠️  Returning fake character data due to error');
      return this.generateFakeCharacterData(discordUserId, characterName);
    }
  }

  /**
   * Generate fake character data when real character can't be found
   * @param {string} discordUserId - Discord user ID
   * @param {string} characterName - Character name
   * @returns {Object} Fake character data
   */
  generateFakeCharacterData(discordUserId, characterName) {
    // Generate random stats (10 points total)
    const stats = this.generateRandomStats();
    
    const fakeCharacter = {
      characterId: `fake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      characterName: "Condiment Bob",
      description: `Sprays various condiments on his enemies.`,
      stats: stats,
      discordUserId: discordUserId,
      createdAt: new Date().toISOString(),
      isFake: true // Flag to indicate this is fake data
    };

    //console.log(`🎭 Generated fake character data for "${characterName}":`, fakeCharacter);
    return fakeCharacter;
  }

  /**
   * Generate random character stats (10 points total)
   * @returns {Object} Random stats object
   */
  generateRandomStats() {
    const totalPoints = 10;
    const minStat = 1;
    
    // Generate random stats that add up to totalPoints
    let remainingPoints = totalPoints - 4; // Reserve 1 point for each stat
    
    const stats = {
      STR: minStat,
      DEX: minStat,
      CON: minStat,
      INT: minStat
    };
    
    // Distribute remaining points randomly
    const statKeys = Object.keys(stats);
    while (remainingPoints > 0) {
      const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
      stats[randomStat]++;
      remainingPoints--;
    }
    
    return stats;
  }

  /**
   * Get a random opponent character for PVP (excluding user's own characters)
   * @param {string} playerDiscordUserId - The player's Discord user ID
   * @param {string} playerCharacterName - The player's character name
   * @returns {Promise<Object|null>} Random opponent character or null
   */
  async getRandomPVPOpponent(playerDiscordUserId, playerCharacterName) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, cannot get PVP opponent');
        return null;
      }

      console.log('⚔️ Finding PVP opponent for:', playerCharacterName, 'user:', playerDiscordUserId);

      // Get all battle stats keys to find characters with battle experience
      const battleStatsPattern = `${this.PVP_BATTLE_STATS_KEY}:*`;
      const battleStatsKeys = await this.client.keys(battleStatsPattern);

      if (battleStatsKeys.length === 0) {
        console.log('ℹ️  No characters with battle experience found, returning dummy AI opponent');
        return this.generateDummyAIOpponent();
      }

      // Filter out the player's own characters
      const opponentKeys = battleStatsKeys.filter(key => {
        const keyParts = key.split(':');
        if (keyParts.length >= 4) {
          const discordUserId = keyParts[2];
          const characterName = keyParts.slice(3).join(':');
          return discordUserId !== playerDiscordUserId;
        }
        return false;
      });

      if (opponentKeys.length === 0) {
        console.log('ℹ️  No other players found for PVP, returning dummy AI opponent');
        return this.generateDummyAIOpponent();
      }

      // Get a random opponent
      const randomKey = opponentKeys[Math.floor(Math.random() * opponentKeys.length)];
      const keyParts = randomKey.split(':');
      const opponentDiscordUserId = keyParts[2];
      const opponentCharacterName = keyParts.slice(3).join(':');

      // Get the opponent character details
      console.log('ℹ️  Find opponent character: ', opponentDiscordUserId, opponentCharacterName);

      const fakeNames = [
        "Condiment Bob",
        "DogMan",
        "Detective Paws",
        "KickBall Guy",
        "Psycho Panda",
        "Shadow Wing",
        "Cool Beans",
        "Doughboy",
        "Frozen Flake",
        "Fry Cook",
        "Ice Cream Man"
      ]
  
      const fakeDescriptions = [
        "Sprays various condiments on his enemies",
        "Uses powerful jaws and teeth to tear his enemies apart",
        "High intelligence and strategic thinking",
        "Kicks a metallic ball to knock his enemies off their feet",
        "Psyhic abilties to attack his enemies",
        "Flies and hieds in the shadows",
        "Farts on his enemies",
        "Made of indestructible dough",
        "sprays cereal on his enemies",
        "Attacks with a deadly fork and frying pan",
        "Gives his enemies any type of ice cream they way."
      ]

      const opponentCharacter = await this.getCharacterByUserAndName(opponentDiscordUserId, opponentCharacterName);
      
      if (opponentCharacter) {
        console.log('✅ Found PVP opponent:', opponentCharacter.characterName);

        const index = Math.floor(Math.random() * fakeNames.length);
        if (opponentCharacter.characterName == "Condiment Bob") {
          opponentCharacter.characterName = fakeNames[index];
          opponentCharacter.description = fakeDescriptions[index];
        }
        return {
          ...opponentCharacter,
          discordUserId: opponentDiscordUserId
        };
      }

      console.error('❌ Error getting random PVP none');
      return null;
    } catch (error) {
      console.error('❌ Error getting random PVP opponent:', error);
      return null;
    }
  }

  /**
   * Update PVP battle statistics for a character
   * @param {string} discordUserId - Discord user ID
   * @param {Object} battleResult - Battle result object
   * @param {Object} playerCharacter - Player character object
   * @returns {Promise<Object>} Updated battle statistics
   */
  async updatePVPBattleStats(discordUserId, battleResult, playerCharacter) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning default PVP battle stats');
        return this.getDefaultBattleStats();
      }

      const statsKey = `${this.PVP_BATTLE_STATS_KEY}:${discordUserId}:${playerCharacter.name}`;
      const currentStats = await this.getCharacterPVPBattleStats(discordUserId, playerCharacter.name);

      // Update stats based on battle result
      const updatedStats = { ...currentStats };
      updatedStats.totalBattles += 1;
      updatedStats.lastBattleDate = new Date().toISOString();

      if (battleResult.winner.name === playerCharacter.name) {
        updatedStats.wins += 1;
      } else if (battleResult.winner.name === battleResult.loser.name) {
        updatedStats.ties += 1;
      } else {
        updatedStats.losses += 1;
      }

      // Calculate win rate
      updatedStats.winRate = updatedStats.totalBattles > 0 
        ? Math.round((updatedStats.wins / updatedStats.totalBattles) * 100) 
        : 0;

      // Save to Redis
      await this.client.hSet(statsKey, {
        totalBattles: updatedStats.totalBattles.toString(),
        wins: updatedStats.wins.toString(),
        losses: updatedStats.losses.toString(),
        ties: updatedStats.ties.toString(),
        winRate: updatedStats.winRate.toString(),
        lastBattleDate: updatedStats.lastBattleDate
      });

      console.log('✅ PVP Battle stats updated for character:', playerCharacter.name, updatedStats);
      return updatedStats;

    } catch (error) {
      console.error('❌ Error updating PVP battle stats:', error);
      return this.getDefaultBattleStats();
    }
  }

  /**
   * Get PVP battle statistics for a specific character
   * @param {string} discordUserId - Discord user ID
   * @param {string} characterName - Character name
   * @returns {Promise<Object>} Character PVP battle statistics
   */
  async getCharacterPVPBattleStats(discordUserId, characterName) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning default PVP battle stats');
        return this.getDefaultBattleStats();
      }

      const statsKey = `${this.PVP_BATTLE_STATS_KEY}:${discordUserId}:${characterName}`;
      const stats = await this.client.hGetAll(statsKey);

      if (!stats || Object.keys(stats).length === 0) {
        return this.getDefaultBattleStats();
      }

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
      console.error('❌ Error getting character PVP battle stats:', error);
      return this.getDefaultBattleStats();
    }
  }

  /**
   * Get top 10 characters by PVP win rate across all users
   * @returns {Promise<Array>} Array of character objects with PVP battle stats
   */
  async getTopPVPCharactersByWinRate(limit = 10) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, returning empty top PVP characters list');
        return [];
      }

      console.log('🏆 Getting top PVP characters by win rate...');

      // Get all PVP battle stats keys
      const pvpStatsPattern = `${this.PVP_BATTLE_STATS_KEY}:*`;
      const pvpStatsKeys = await this.client.keys(pvpStatsPattern);

      if (pvpStatsKeys.length === 0) {
        console.log('ℹ️  No PVP battle stats found');
        return [];
      }

      // Get all PVP battle stats and calculate win rates
      const characterStats = [];
      for (const statsKey of pvpStatsKeys) {
        try {
          const stats = await this.client.hGetAll(statsKey);
          if (stats && Object.keys(stats).length > 0) {
            const totalBattles = parseInt(stats.totalBattles) || 0;
            const wins = parseInt(stats.wins) || 0;
            
            // Only include characters with at least 1 PVP battle
            if (totalBattles > 0) {
              const winRate = Math.round((wins / totalBattles) * 100);
              
              // Extract discordUserId and characterName from the key
              // Key format: minigames:pvp_battle_stats:discordUserId:characterName
              const keyParts = statsKey.split(':');
              if (keyParts.length >= 4) {
                const discordUserId = keyParts[2];
                const characterName = keyParts.slice(3).join(':');
                
                // Get character details
                const character = await this.getCharacterByUserAndName(discordUserId, characterName);
                if (character) {
                  characterStats.push({
                    characterName: character.characterName,
                    description: character.description,
                    stats: character.stats,
                    discordUserId: discordUserId,
                    totalBattles: totalBattles,
                    wins: wins,
                    losses: parseInt(stats.losses) || 0,
                    ties: parseInt(stats.ties) || 0,
                    winRate: winRate,
                    lastBattleDate: stats.lastBattleDate || null
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ Error processing PVP battle stats key:', statsKey, error);
        }
      }

      // Sort by win rate (descending), then by total battles (descending) as tiebreaker
      characterStats.sort((a, b) => {
        if (b.winRate !== a.winRate) {
          return b.winRate - a.winRate;
        }
        return b.totalBattles - a.totalBattles;
      });

      // Return top N characters
      let topCharacters = characterStats.slice(0, limit);
      console.log(`🏆 Retrieved top ${topCharacters.length} PVP characters by win rate`);

      const fakeNames = [
        "Condiment Bob",
        "DogMan",
        "Detective Paws",
        "KickBall Guy",
        "Psycho Panda",
        "Shadow Wing",
        "Cool Beans",
        "Doughboy",
        "Frozen Flake",
        "Fry Cook",
        "Ice Cream Man"
      ]

      let i = 0;
      topCharacters.forEach(characters => {
        characters.characterName = characters.characterName.replace('Condiment Bob', fakeNames[i]);
        i++;
      });
      
      return topCharacters;

    } catch (error) {
      console.error('❌ Error getting top PVP characters by win rate:', error);
      return [];
    }
  }

  /**
   * Ensure there are at least 20 characters available for PVP battles
   * Creates dummy characters if needed
   * @param {number} minCharacters - Minimum number of characters needed (default: 20)
   * @returns {Promise<number>} Number of characters available for PVP
   */
  async ensurePVPCharacters(minCharacters = 20) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, cannot check PVP characters');
        return 0;
      }

      console.log(`🔍 Checking for at least ${minCharacters} PVP characters...`);

      // Get all battle stats keys to count characters with battle experience
      const battleStatsPattern = `${this.PVP_BATTLE_STATS_KEY}:*`;
      const battleStatsKeys = await this.client.keys(battleStatsPattern);

      const existingCharacterCount = battleStatsKeys.length;
      console.log(`📊 Found ${existingCharacterCount} existing characters with battle experience`);

      if (existingCharacterCount >= minCharacters) {
        console.log(`✅ Sufficient PVP characters available (${existingCharacterCount}/${minCharacters})`);
        return existingCharacterCount;
      }

      const charactersNeeded = minCharacters - existingCharacterCount;
      console.log(`⚠️  Need ${charactersNeeded} more characters for PVP. Creating dummy characters...`);

      // Create dummy characters
      const dummyCharacters = this.generateDummyPVPCharacters(charactersNeeded);
      
      for (const dummyChar of dummyCharacters) {
        await this.createDummyPVPCharacter(dummyChar);
      }

      console.log(`✅ Created ${charactersNeeded} dummy PVP characters`);
      return minCharacters;

    } catch (error) {
      console.error('❌ Error ensuring PVP characters:', error);
      return 0;
    }
  }

  /**
   * Generate dummy PVP characters
   * @param {number} count - Number of dummy characters to generate
   * @returns {Array} Array of dummy character objects
   */
  generateDummyPVPCharacters(count) {
    const characterTemplates = [
      {
        name: "Thunder Strike",
        description: "A lightning-fast warrior who wields twin electric blades. Can channel storms and strike with devastating speed.",
        stats: { STR: 3, DEX: 4, CON: 2, INT: 1 }
      },
      {
        name: "Crystal Guardian",
        description: "A mystical defender who creates protective barriers of pure crystal. Masters defensive magic and healing arts.",
        stats: { STR: 2, DEX: 1, CON: 4, INT: 3 }
      },
      {
        name: "Shadow Assassin",
        description: "A deadly rogue who moves unseen through darkness. Specializes in stealth attacks and poison techniques.",
        stats: { STR: 2, DEX: 5, CON: 1, INT: 2 }
      },
      {
        name: "Flame Warlock",
        description: "A powerful mage who commands fire and destruction. Can summon infernal creatures and cast devastating spells.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Iron Berserker",
        description: "A massive warrior who enters battle rage. Gains strength through combat and can shrug off most attacks.",
        stats: { STR: 5, DEX: 1, CON: 3, INT: 1 }
      },
      {
        name: "Wind Dancer",
        description: "An agile fighter who moves like the wind. Uses acrobatic attacks and can create tornadoes of blades.",
        stats: { STR: 2, DEX: 4, CON: 2, INT: 2 }
      },
      {
        name: "Void Mage",
        description: "A mysterious spellcaster who manipulates dark energy. Can create portals and drain life force from enemies.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Stone Crusher",
        description: "A hulking fighter with rock-hard skin. Uses massive weapons and can cause earthquakes with his strikes.",
        stats: { STR: 4, DEX: 1, CON: 4, INT: 1 }
      },
      {
        name: "Ice Queen",
        description: "A regal sorceress who commands winter's fury. Can freeze enemies solid and summon blizzards.",
        stats: { STR: 1, DEX: 2, CON: 3, INT: 4 }
      },
      {
        name: "Beast Tamer",
        description: "A wild warrior who fights alongside animal companions. Can transform into beasts and command nature's creatures.",
        stats: { STR: 3, DEX: 3, CON: 2, INT: 2 }
      },
      {
        name: "Phoenix Knight",
        description: "A noble warrior who rises from ashes. Wields a flaming sword and can resurrect from near death.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Storm Caller",
        description: "A weather mage who controls the elements. Can summon lightning, rain, and hurricanes to devastate foes.",
        stats: { STR: 2, DEX: 2, CON: 2, INT: 4 }
      },
      {
        name: "Blood Reaper",
        description: "A dark warrior who feeds on life force. Each kill makes him stronger and more dangerous.",
        stats: { STR: 4, DEX: 2, CON: 2, INT: 2 }
      },
      {
        name: "Golden Paladin",
        description: "A holy warrior who fights for justice. Wields divine power and can heal allies while smiting evil.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Night Stalker",
        description: "A vampire hunter who moves in shadows. Uses silver weapons and holy magic to destroy undead.",
        stats: { STR: 2, DEX: 4, CON: 2, INT: 2 }
      },
      {
        name: "Arcane Scholar",
        description: "A wise mage who studies ancient magic. Can cast complex spells and create magical constructs.",
        stats: { STR: 1, DEX: 1, CON: 2, INT: 6 }
      },
      {
        name: "War Machine",
        description: "A mechanical warrior with built-in weapons. Can transform parts of his body into various armaments.",
        stats: { STR: 4, DEX: 2, CON: 3, INT: 1 }
      },
      {
        name: "Spirit Walker",
        description: "A shaman who communes with spirits. Can summon ancestral warriors and cast powerful totem magic.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Dragon Slayer",
        description: "A legendary warrior who has slain dragons. Wields dragon-forged weapons and wears dragon scale armor.",
        stats: { STR: 5, DEX: 2, CON: 2, INT: 1 }
      },
      {
        name: "Time Weaver",
        description: "A chronomancer who manipulates time itself. Can slow enemies, speed up allies, and glimpse the future.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      }
    ];

    const dummyCharacters = [];
    for (let i = 0; i < count; i++) {
      const template = characterTemplates[i % characterTemplates.length];
      const character = {
        ...template,
        name: template.name, // Use original name without random numbers
        discordUserId: `dummy_user_${i + 1}` // Unique dummy user ID
      };
      dummyCharacters.push(character);
    }

    return dummyCharacters;
  }

  /**
   * Create a dummy PVP character with battle stats
   * @param {Object} character - Character object to create
   */
  async createDummyPVPCharacter(character) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, cannot create dummy character');
        return;
      }

      // Generate a unique character ID
      const characterId = `dummy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create character data
      const characterData = {
        characterId: characterId,
        characterName: character.name,
        description: character.description,
        stats: character.stats,
        discordUserId: character.discordUserId,
        createdAt: new Date().toISOString(),
        isDummy: true
      };

      // Save character to Redis
      const characterKey = `${this.CHARACTERS_KEY}:${characterId}`;
      await this.client.set(characterKey, JSON.stringify(characterData));

      // Add character to user's character list
      const userCharactersKey = `${this.USER_CHARACTERS_KEY}:${character.discordUserId}`;
      await this.client.zAdd(userCharactersKey, {
        score: Date.now(),
        value: characterId
      });

      // Create initial battle stats (give them some battle experience)
      const battleStatsKey = `${this.PVP_BATTLE_STATS_KEY}:${character.discordUserId}:${character.name}`;
      const initialWins = Math.floor(Math.random() * 5) + 1; // 1-5 wins
      const initialLosses = Math.floor(Math.random() * 3); // 0-2 losses
      const totalBattles = initialWins + initialLosses;
      const winRate = Math.round((initialWins / totalBattles) * 100);

      await this.client.hSet(battleStatsKey, {
        totalBattles: totalBattles.toString(),
        wins: initialWins.toString(),
        losses: initialLosses.toString(),
        ties: '0',
        winRate: winRate.toString(),
        lastBattleDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // Random date within last week
      });

      console.log(`✅ Created dummy character: ${character.name} (${winRate}% win rate)`);

    } catch (error) {
      console.error('❌ Error creating dummy character:', error);
    }
  }

  /**
   * Get processed purchase by token
   * @param {string} purchaseToken - Purchase token
   * @returns {Promise<Object|null>} Processed purchase data or null
   */
  async getProcessedPurchase(purchaseToken) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, cannot get processed purchase');
        return null;
      }

      const purchaseKey = `${this.PROCESSED_PURCHASES_KEY}:${purchaseToken}`;
      const purchaseData = await this.client.get(purchaseKey);
      
      if (purchaseData) {
        return JSON.parse(purchaseData);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting processed purchase:', error);
      return null;
    }
  }

  /**
   * Mark purchase as processed to prevent duplicate rewards
   * @param {string} purchaseToken - Purchase token
   * @param {Object} purchaseData - Purchase data to store
   * @returns {Promise<boolean>} Success status
   */
  async markPurchaseAsProcessed(purchaseToken, purchaseData) {
    try {
      if (!this.isReady()) {
        console.log('⚠️  Redis not ready, cannot mark purchase as processed');
        return false;
      }

      const purchaseKey = `${this.PROCESSED_PURCHASES_KEY}:${purchaseToken}`;
      
      // Store purchase data with 30-day expiration (purchases should be processed quickly)
      await this.client.setEx(purchaseKey, 30 * 24 * 60 * 60, JSON.stringify(purchaseData));
      
      console.log(`✅ Marked purchase as processed: ${purchaseToken}`);
      return true;
    } catch (error) {
      console.error('❌ Error marking purchase as processed:', error);
      return false;
    }
  }

  /**
   * Generate a dummy AI opponent when no real players are available
   * @returns {Object} Dummy AI opponent character
   */
  generateDummyAIOpponent() {
    const aiCharacters = [
      {
        characterName: "Shadow Blade",
        description: "A mutant ninja warrior with the ability to teleport through shadows. Can summon a demonic fiery blade as a weapon.",
        stats: { STR: 2, DEX: 4, CON: 2, INT: 2 },
        discordUserId: "ai_opponent_1"
      },
      {
        characterName: "Solar Flare",
        description: "A cosmic warrior who harnesses the power of the sun. Can create devastating solar explosions and heal allies.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 },
        discordUserId: "ai_opponent_2"
      },
      {
        characterName: "Thunder Strike",
        description: "An electric warrior with the power to control lightning. Can summon storms and strike with electric force.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 },
        discordUserId: "ai_opponent_3"
      },
      {
        characterName: "Ice Guardian",
        description: "A frost warrior who commands the power of ice and snow. Can freeze enemies and create protective ice barriers.",
        stats: { STR: 3, DEX: 1, CON: 4, INT: 2 },
        discordUserId: "ai_opponent_4"
      },
      {
        characterName: "Wind Walker",
        description: "A swift warrior who controls the winds. Can fly and create powerful wind attacks.",
        stats: { STR: 1, DEX: 4, CON: 2, INT: 3 },
        discordUserId: "ai_opponent_5"
      }
    ];

    // Return a random AI character
    const randomIndex = Math.floor(Math.random() * aiCharacters.length);
    return aiCharacters[randomIndex];
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
