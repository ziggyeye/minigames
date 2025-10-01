/**
 * APIRoutes - Handles all API endpoints with proper validation and error handling
 * Provides centralized API functionality with consistent response formats
 */
export class APIRoutes {
  constructor(redisManager, discordManager, matchmakingManager, config) {
    this.redisManager = redisManager;
    this.discordManager = discordManager;
    this.matchmakingManager = matchmakingManager;
    this.config = config;
  }

  /**
   * Setup all API routes
   * @param {Express} app - Express application instance
   */
  setupRoutes(app) {
    // Score submission endpoint
    app.post('/api/score', this.handleScoreSubmission.bind(this));
    
    // Health check endpoint
    app.get('/api/health', this.handleHealthCheck.bind(this));
    
    // High scores endpoint
    app.get('/api/highscores', this.handleGetHighScores.bind(this));
    
    // Player score endpoint
    app.get('/api/player/:playerName/score', this.handleGetPlayerScore.bind(this));
    
    // Token exchange endpoint for Discord authentication
    app.post('/api/token', this.handleTokenExchange.bind(this));
    
    // Matchmaking endpoints
    app.post('/api/matchmaking/create', this.handleCreateMatch.bind(this));
    app.get('/api/matchmaking/lobbies', this.handleGetLobbies.bind(this));
    app.post('/api/matchmaking/join', this.handleJoinMatch.bind(this));
    app.get('/api/matchmaking/matches/:matchId', this.handleGetMatchDetails.bind(this));
    app.get('/api/matchmaking/player/:playerName/matches', this.handleGetPlayerMatches.bind(this));
    app.get('/api/matchmaking/player/:playerName/stats', this.handleGetPlayerStats.bind(this));
    app.delete('/api/matchmaking/matches/:matchId', this.handleCancelMatch.bind(this));
    app.get('/api/matchmaking/stats', this.handleGetMatchmakingStats.bind(this));

    // Character management endpoints
    app.post('/api/saveCharacter', this.handleSaveCharacter.bind(this));
    app.get('/api/characters/:discordUserId', this.handleGetUserCharacters.bind(this));
    app.delete('/api/characters/delete', this.handleDeleteCharacter.bind(this));
    
    // Battle simulation endpoint
   // app.post('/api/battle/simulate', this.handleBattleSimulation.bind(this));
    
    // Battle statistics endpoints
    app.get('/api/battle/stats/:discordUserId', this.handleGetBattleStats.bind(this));
    app.get('/api/battle/stats/:discordUserId/:characterName', this.handleGetCharacterBattleStats.bind(this));
    
    // Battle gems endpoints
    app.post('/api/battleGems/add', this.handleAddBattleGems.bind(this));
    app.get('/api/battleGems/:discordUserId', this.handleGetBattleGems.bind(this));
    
    // Top characters by win rate endpoint
    //app.get('/api/topCharacters', this.handleGetTopCharacters.bind(this));
    
    // PVP battle simulation endpoint
    app.post('/api/pvp/battle/simulate', this.handlePVPBattleSimulation.bind(this));
    
    // PVP battle statistics endpoints
    app.get('/api/pvp/battle/stats/:discordUserId/:characterName', this.handleGetCharacterPVPBattleStats.bind(this));
    
    // Top PVP characters by win rate endpoint
    app.get('/api/pvp/topCharacters', this.handleGetTopPVPCharacters.bind(this));
    
    // Get available SKUs endpoint
    app.get('/api/skus', this.handleGetAvailableSKUs.bind(this));

  }

  /**
   * Handle score submission with automatic matchmaking (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleScoreSubmission(req, res) {
    try {
      const { playerName, score, level, gameType, discordUserId } = req.body;
      
      // Validate required fields
      if (!playerName || score === undefined) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: playerName and score are required');
      }

      // Validate score is a positive number
      if (typeof score !== 'number' || score < 0) {
        return this.sendErrorResponse(res, 400, 'Score must be a positive number');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `${playerName}_${score}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const idempotencyKey = `score_submission:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      console.log(`📊 Processing score submission: ${playerName} - ${score} points (${gameType || 'unknown game'})`);

      // Save score to Redis with game type
      const scoreSaved = await this.redisManager.savePlayerScore(playerName, score, level, discordUserId, gameType);
      
      // Get updated high scores
      const topScores = await this.redisManager.getTopHighScores(10);
      const playerBest = await this.redisManager.getPlayerBestScore(playerName);

      // Post to Discord with game type
      const discordResult = await this.discordManager.postScoreToDiscord(
        { playerName, score, level, gameType },
        topScores.slice(0, 5),
        discordUserId
      );
      
      // Automatic matchmaking logic
      let matchmakingResult = null;
      if (this.matchmakingManager) {
        // Try to join an existing match first
        const openLobbies = await this.matchmakingManager.getOpenLobbies(5);
        
        if (openLobbies.length > 0) {
          // Join the oldest available match
          const oldestLobby = openLobbies[0];
          console.log(`🎯 ${playerName} joining existing match: ${oldestLobby.matchId}`);
          
          matchmakingResult = await this.matchmakingManager.joinMatch(
            oldestLobby.matchId,
            playerName,
            score,
            level || 1,
            discordUserId
          );
        } else {
          // No available matches, create a new one
          console.log(`🎮 ${playerName} creating new match (no available lobbies)`);
          
          matchmakingResult = await this.matchmakingManager.createMatch(
            playerName,
            score,
            level || 1,
            discordUserId
          );
        }
      }

      // Return response with high score and matchmaking information
      const response = {
        success: true,
        message: discordResult.success ? 'Score posted to Discord' : 'Score saved locally',
        scoreSaved: scoreSaved,
        playerBest: playerBest,
        topScores: topScores.slice(0, 5),
        isNewHighScore: scoreSaved,
        discordPosted: discordResult.success,
        matchmaking: matchmakingResult
      };

      if (!discordResult.success) {
        response.discordError = discordResult.error;
      }

      // Cache the result for idempotency (expires in 1 hour)
      if (this.redisManager.isReady()) {
        await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
      }

      res.json(response);

    } catch (error) {
      console.error('❌ Error in score submission:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle health check
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  handleHealthCheck(req, res) {
    const redisStatus = this.redisManager.getStatus();
    const discordStatus = this.discordManager.getStatus();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          isConnected: redisStatus.isConnected,
          isReady: redisStatus.isReady,
          hasClient: redisStatus.hasClient
        },
        discord: {
          isReady: discordStatus.isReady,
          isConnected: discordStatus.isConnected,
          userTag: discordStatus.userTag,
          channelId: discordStatus.channelId
        }
      }
    });
  }

  /**
   * Handle get high scores (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetHighScores(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      // Validate limit
      if (limit < 1 || limit > 100) {
        return this.sendErrorResponse(res, 400, 'Limit must be between 1 and 100');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `high_scores:${limit}`;
      
      const idempotencyKey = `high_scores:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached high scores result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      const scores = await this.redisManager.getTopHighScores(limit);
      
      const response = {
        success: true,
        scores: scores,
        count: scores.length,
        limit: limit
      };

      // Cache the result for idempotency (expires in 5 minutes)
      if (this.redisManager.isReady()) {
        await this.redisManager.client.setEx(idempotencyKey, 300, JSON.stringify(response));
      }
      
      res.json(response);
    } catch (error) {
      console.error('❌ Error getting high scores:', error);
      this.sendErrorResponse(res, 500, 'Failed to get high scores', error.message);
    }
  }

  /**
   * Handle get player score
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetPlayerScore(req, res) {
    try {
      const { playerName } = req.params;
      
      // Validate player name
      if (!playerName || playerName.trim().length === 0) {
        return this.sendErrorResponse(res, 400, 'Player name is required');
      }

      const score = await this.redisManager.getPlayerBestScore(playerName.trim());
      
      if (score) {
        res.json({
          success: true,
          score: score
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Player not found',
          message: `No score found for player: ${playerName}`
        });
      }
    } catch (error) {
      console.error('❌ Error getting player score:', error);
      this.sendErrorResponse(res, 500, 'Failed to get player score', error.message);
    }
  }

  /**
   * Handle token exchange for Discord authentication
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleTokenExchange(req, res) {
    try {
      const { code, redirect_uri } = req.body;
      
      if (!code) {
        return this.sendErrorResponse(res, 400, 'Missing required field: code');
      }

      console.log('🔄 Processing Discord token exchange...');

      // Discord OAuth2 token exchange
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirect_uri || 'http://localhost:3001/api/token'
        })
      });

      const data = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('❌ Discord API error:', data);
        return this.sendErrorResponse(res, tokenResponse.status, 'Failed to exchange code for token', data);
      }

      console.log('✅ Token exchange successful');
      res.json({ access_token: data.access_token });

    } catch (error) {
      console.error('❌ Error in token exchange:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle save character (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleSaveCharacter(req, res) {
    try {
      const { characterName, description, discordUserId, stats } = req.body;
      
      // Validate required fields
      if (!characterName || !description || !discordUserId) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: characterName, description, and discordUserId are required');
      }

      // Validate character stats if provided
      if (stats) {
        const validStats = ['STR', 'DEX', 'CON', 'INT'];
        const totalPoints = Object.values(stats).reduce((sum, val) => sum + val, 0);
        
        if (totalPoints !== 10) {
          return this.sendErrorResponse(res, 400, 'Character stats must total exactly 10 points');
        }
        
        for (const [statName, value] of Object.entries(stats)) {
          if (!validStats.includes(statName)) {
            return this.sendErrorResponse(res, 400, `Invalid stat name: ${statName}. Valid stats: ${validStats.join(', ')}`);
          }
          if (typeof value !== 'number' || value < 1 || value > 10) {
            return this.sendErrorResponse(res, 400, `Invalid stat value for ${statName}: must be a number between 1 and 10`);
          }
        }
      }

      // Validate character name length
      if (characterName.trim().length === 0 || characterName.trim().length > 50) {
        return this.sendErrorResponse(res, 400, 'Character name must be between 1 and 50 characters');
      }

      // Validate description length
      if (description.trim().length === 0 || description.trim().length > 1000) {
        return this.sendErrorResponse(res, 400, 'Description must be between 1 and 1000 characters');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `save_character:${discordUserId}_${characterName}_${Date.now()}`;
      
      const idempotencyKey = `character_save:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached character save result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      console.log(`🎭 Saving character: ${characterName} for user ${discordUserId}`, stats);

      // Check if character with this name already exists for this user
      const existingCharacter = await this.redisManager.getCharacterByName(discordUserId, characterName.trim());
      if (existingCharacter) {
        console.log(`⚠️ Character "${characterName}" already exists for user ${discordUserId}`);
        return this.sendErrorResponse(res, 409, `Character "${characterName}" already exists. Please choose a different name.`);
      }

      // Save character to Redis
      const character = {
        characterName: characterName.trim(),
        description: description.trim(),
        discordUserId: discordUserId,
        stats: stats || { STR: 1, DEX: 1, CON: 1, INT: 1 }, // Default stats if not provided
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        id: `char_${discordUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      const result = await this.redisManager.saveCharacter(character);

      if (result.success) {
        // Post character creation to Discord
        // try {
        //   if (this.discordManager && this.discordManager.isBotReady()) {
        //     console.log(`📤 Posting character creation to Discord for user ${discordUserId}`);
        //     const discordResult = await this.discordManager.postCharacterCreationToDiscord(discordUserId, result.character);
        //     if (discordResult.success) {
        //       console.log('✅ Character creation posted to Discord successfully');
        //     } else {
        //       console.warn('⚠️ Failed to post character creation to Discord:', discordResult.error);
        //     }
        //   } else {
        //     console.log('ℹ️ Discord bot not available, skipping character creation post');
        //   }
        // } catch (discordError) {
        //   console.warn('⚠️ Error posting character creation to Discord (non-critical):', discordError.message);
        // }

        const response = {
          success: true,
          message: 'Character saved successfully',
          character: result.character
        };
        
        // Cache the result for idempotency (expires in 1 hour)
        if (this.redisManager.isReady()) {
          await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
        }
        
        res.json(response);
      } else {
        this.sendErrorResponse(res, 500, result.error || 'Failed to save character');
      }

    } catch (error) {
      console.error('❌ Error saving character:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle get user characters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetUserCharacters(req, res) {
    try {
      const { discordUserId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      
      // Validate Discord user ID
      if (!discordUserId || discordUserId.trim().length === 0) {
        return this.sendErrorResponse(res, 400, 'Discord user ID is required');
      }

      // Validate limit
      if (limit < 1 || limit > 100) {
        return this.sendErrorResponse(res, 400, 'Limit must be between 1 and 100');
      }

      console.log(`🎭 Getting characters for user ${discordUserId}`);

      const characters = await this.redisManager.getUserCharacters(discordUserId.trim(), limit);
      
      // Get battle cooldown status
      const cooldownStatus = await this.redisManager.checkBattleCooldown(discordUserId.trim());
      
      // Get battle gems count
      const battleGems = await this.redisManager.getBattleGems(discordUserId.trim());
      
      res.json({
        success: true,
        discordUserId: discordUserId.trim(),
        characters: characters,
        count: characters.length,
        limit: limit,
        cooldownStatus: {
          onCooldown: cooldownStatus.onCooldown,
          timeRemaining: cooldownStatus.timeRemaining,
          cooldownExpiry: cooldownStatus.cooldownExpiry ? cooldownStatus.cooldownExpiry.toISOString() : null
        },
        battleGems: battleGems
      });
    } catch (error) {
      console.error('❌ Error getting user characters:', error);
      this.sendErrorResponse(res, 500, 'Failed to get user characters', error.message);
    }
  }

  /**
   * Handle delete character
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleDeleteCharacter(req, res) {
    try {
      const { discordUserId, characterId } = req.body;
      
      // Validate required fields
      if (!discordUserId || !characterId) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: discordUserId and characterId are required');
      }

      console.log(`🗑️ Deleting character ${characterId} for user ${discordUserId}`);

      // Delete character from Redis
      const result = await this.redisManager.deleteCharacter(discordUserId.trim(), characterId.trim());

      if (result.success) {
        res.json({
          success: true,
          message: 'Character deleted successfully',
          characterId: characterId
        });
      } else {
        this.sendErrorResponse(res, 404, result.error || 'Character not found');
      }

    } catch (error) {
      console.error('❌ Error deleting character:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle battle simulation (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // async handleBattleSimulation(req, res) {
  //   try {
  //     const { playerCharacter, discordUserId, useBattleGem = false } = req.body;
      
  //     // Check battle cooldown first
  //     const cooldownStatus = await this.redisManager.checkBattleCooldown(discordUserId.trim());
      
  //     if (cooldownStatus.onCooldown) {
  //       if (useBattleGem) {
  //         // Check if user has enough battle gems
  //         const currentGems = await this.redisManager.getBattleGems(discordUserId.trim());
  //         if (currentGems < 1) {
  //           const timeRemainingSeconds = Math.ceil(cooldownStatus.timeRemaining / 1000);
  //           return this.sendErrorResponse(res, 429, `Battle cooldown active and insufficient battle gems. Please wait ${timeRemainingSeconds} seconds or obtain more battle gems.`, {
  //             cooldownExpiry: cooldownStatus.cooldownExpiry,
  //             timeRemaining: cooldownStatus.timeRemaining,
  //             battleGems: currentGems
  //           });
  //         }
          
  //         // Spend 1 battle gem to bypass cooldown
  //         const spendResult = await this.redisManager.spendBattleGems(discordUserId.trim(), 1);
  //         if (!spendResult.success) {
  //           return this.sendErrorResponse(res, 400, spendResult.message);
  //         }
          
  //         console.log(`💎 User ${discordUserId} spent 1 battle gem to bypass cooldown`);
  //       } else {
  //         const timeRemainingSeconds = Math.ceil(cooldownStatus.timeRemaining / 1000);
  //         return this.sendErrorResponse(res, 429, `Battle cooldown active. Please wait ${timeRemainingSeconds} seconds before your next battle.`, {
  //           cooldownExpiry: cooldownStatus.cooldownExpiry,
  //           timeRemaining: cooldownStatus.timeRemaining
  //         });
  //       }
  //     }

  //     // Validate required fields
  //     if (!playerCharacter || !playerCharacter.name || !playerCharacter.description) {
  //       return this.sendErrorResponse(res, 400, 'Missing required fields: playerCharacter with name and description are required');
  //     }

  //     // Generate idempotency key
  //     const requestId = req.headers['x-request-id'] || 
  //                      req.headers['x-idempotency-key'] || 
  //                      `battle_sim:${discordUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
  //     const idempotencyKey = `battle_simulation:${requestId}`;

  //     // Check if this request was already processed
  //     if (this.redisManager.isReady()) {
  //       const existingResult = await this.redisManager.client.get(idempotencyKey);
  //       if (existingResult) {
  //         console.log(`🔄 Idempotency: Returning cached battle simulation result for ${requestId}`);
  //         return res.json(JSON.parse(existingResult));
  //       }
  //     }

  //     console.log(`⚔️ Simulating battle for character: `, playerCharacter);

  //     // Generate AI opponent
  //     const aiCharacter = this.selectRandomAICharacter();
      
  //     // Simulate battle
  //     const battleResult = await this.simulateBattle(playerCharacter, aiCharacter);

  //     // Update battle statistics for this specific character
  //     const battleStats = await this.redisManager.updateBattleStats(discordUserId, battleResult, playerCharacter);

  //     // Get updated character level
  //     const characterLevel = await this.redisManager.getCharacterLevel(discordUserId, playerCharacter.name);

  //     let cooldownExpiry = null;
  //     // Set battle cooldown
  //     if (!useBattleGem)
  //     {
  //       cooldownExpiry = await this.redisManager.setBattleCooldown(discordUserId);
  //     }
  //     else {
  //       const cooldownStatus = await this.redisManager.checkBattleCooldown(discordUserId.trim());
  //       cooldownExpiry = cooldownStatus.cooldownExpiry;
  //     }

  //     // Get updated battle gems count
  //     const battleGems = await this.redisManager.getBattleGems(discordUserId);

  //     const response = {
  //       success: true,
  //       playerCharacter: playerCharacter,
  //       aiCharacter: aiCharacter,
  //       battleResult: battleResult,
  //       battleStats: battleStats,
  //       characterLevel: characterLevel,
  //       cooldownExpiry: cooldownExpiry ? cooldownExpiry.toISOString() : null,
  //       battleGems: battleGems,
  //       timestamp: new Date().toISOString()
  //     };
      
  //     // Cache the result for idempotency (expires in 1 hour)
  //     if (this.redisManager.isReady()) {
  //       await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
  //     }
      
  //     // Post battle summary to Discord (non-blocking)
  //     try {
  //      // if (this.discordManager && this.discordManager.isBotReady()) {
  //         console.log(`📤 Posting battle summary to Discord for user ${discordUserId}`);
  //         const discordResult = await this.discordManager.postBattleSummaryToDiscord(response, discordUserId);
  //         if (discordResult.success) {
  //           console.log('✅ Battle summary posted to Discord successfully');
  //         } else {
  //           console.warn('⚠️ Failed to post battle summary to Discord:', discordResult.error);
  //         }
  //       // } else {
  //       //   console.log('ℹ️ Discord bot not available, skipping battle summary post');
  //       // }
  //     } catch (discordError) {
  //       console.warn('⚠️ Error posting to Discord (non-critical):', discordError.message);
  //       // Continue with battle response even if Discord fails
  //     }
      
  //     res.json(response);

  //   } catch (error) {
  //     console.error('❌ Error in battle simulation:', error);
  //     this.sendErrorResponse(res, 500, 'Internal server error', error.message);
  //   }
  // }

  /**
   * Select a random AI character for battle
   * @returns {Object} AI character object
   */
  selectRandomAICharacter() {
    const aiCharacters = [
      {
        "name": "Shadow Blade",
        "description": "A mutant ninja warrior with the ability to teleport through shadows. Can summon a demonic fiery blade as a weapon.",
        "stats": { "STR": 2, "DEX": 4, "CON": 2, "INT": 2 }
      },
      {
        "name": "Solar Flare",
        "description": "A radiant hero who channels the power of the sun. Can unleash blinding light bursts to dazzle foes.",
        "stats": { "STR": 3, "DEX": 2, "CON": 2, "INT": 3 }
      },
      {
        "name": "Frost Fang",
        "description": "An icy villain who can freeze anything with a touch. His jagged fangs drip with eternal frost.",
        "stats": { "STR": 4, "DEX": 2, "CON": 3, "INT": 1 }
      },
      {
        "name": "Neon Viper",
        "description": "A streetwise vigilante with venom-charged whips. Strikes fast and vanishes into neon-lit alleys.",
        "stats": { "STR": 2, "DEX": 5, "CON": 2, "INT": 1 }
      },
      {
        "name": "Iron Beetle",
        "description": "A techno-hero encased in beetle-inspired armor. Wings allow short bursts of flight and defense.",
        "stats": { "STR": 3, "DEX": 2, "CON": 4, "INT": 1 }
      },
      {
        "name": "Crimson Banshee",
        "description": "A villainous spirit whose scream shatters glass and courage. Red mist trails in her wake.",
        "stats": { "STR": 1, "DEX": 3, "CON": 2, "INT": 4 }
      },
      {
        "name": "Thunder Jack",
        "description": "A cowboy hero wielding electrified lassos. His booming laugh echoes like a storm.",
        "stats": { "STR": 4, "DEX": 2, "CON": 3, "INT": 1 }
      },
      {
        "name": "Venom Duchess",
        "description": "A cunning villainess who poisons her blades. Her grace hides her deadly strikes.",
        "stats": { "STR": 2, "DEX": 3, "CON": 2, "INT": 3 }
      },
      {
        "name": "Obsidian Titan",
        "description": "A hulking warrior of living volcanic rock. Moves slow but crushes everything in reach.",
        "stats": { "STR": 5, "DEX": 1, "CON": 4, "INT": 0 }
      },
      {
        "name": "Pixel Phantom",
        "description": "A glitching trickster who phases in and out of digital space. Can scramble electronics with a touch.",
        "stats": { "STR": 1, "DEX": 3, "CON": 2, "INT": 4 }
      },
      {
        "name": "Nova Spark",
        "description": "A young hero infused with cosmic plasma. Her blasts light up the skies.",
        "stats": { "STR": 3, "DEX": 3, "CON": 2, "INT": 2 }
      },
      {
        "name": "Grim Engineer",
        "description": "A villain who builds weapons from scavenged scraps. His creations are deadly and unpredictable.",
        "stats": { "STR": 2, "DEX": 1, "CON": 3, "INT": 4 }
      },
      {
        "name": "Emerald Hornet",
        "description": "A green-armored vigilante with jet-powered stingers. Fast and relentless in combat.",
        "stats": { "STR": 2, "DEX": 5, "CON": 2, "INT": 1 }
      },
      {
        "name": "Specter Shade",
        "description": "A ghostly villain who slips through walls. Whispers lies that unsettle even the bravest.",
        "stats": { "STR": 1, "DEX": 2, "CON": 2, "INT": 5 }
      },
      {
        "name": "Titan Gale",
        "description": "A giant who commands hurricane winds. His steps shake the ground like thunder.",
        "stats": { "STR": 5, "DEX": 1, "CON": 3, "INT": 1 }
      },
      {
        "name": "Circuit Witch",
        "description": "A cyber-mage who weaves spells into wires. She drains power from machines to fuel her sorcery.",
        "stats": { "STR": 1, "DEX": 2, "CON": 2, "INT": 5 }
      },
      {
        "name": "Razor Boom",
        "description": "A chaotic villain who fights with explosive discs. Each spin leaves devastation behind.",
        "stats": { "STR": 3, "DEX": 3, "CON": 3, "INT": 1 }
      },
      {
        "name": "Silver Seraph",
        "description": "A flying heroine wrapped in shimmering wings. She heals allies with radiant light.",
        "stats": { "STR": 2, "DEX": 3, "CON": 2, "INT": 3 }
      },
      {
        "name": "Ash Vandal",
        "description": "A masked villain who turns everything he touches into cinders. His body smolders with living fire.",
        "stats": { "STR": 4, "DEX": 2, "CON": 2, "INT": 2 }
      },
      {
        "name": "Toxic Gear",
        "description": "A junkyard warlord armed with toxic sludge cannons. His breath alone can sicken foes.",
        "stats": { "STR": 3, "DEX": 1, "CON": 4, "INT": 2 }
      },
      {
        "name": "Blitz Hare",
        "description": "A hyper-fast hero with rabbit reflexes. His kicks hit like lightning strikes.",
        "stats": { "STR": 2, "DEX": 6, "CON": 1, "INT": 1 }
      },
      {
        "name": "Phantom Harlequin",
        "description": "A sinister clown spirit who toys with illusions. His laughter drives enemies mad.",
        "stats": { "STR": 1, "DEX": 3, "CON": 2, "INT": 4 }
      },
      {
        "name": "Steel Warden",
        "description": "An armored protector sworn to justice. His shield never falters under pressure.",
        "stats": { "STR": 3, "DEX": 1, "CON": 5, "INT": 1 }
      },
      {
        "name": "Lunar Whisper",
        "description": "A mystic hero who channels moonlight into silent strikes. Shadows bend to her will.",
        "stats": { "STR": 2, "DEX": 3, "CON": 2, "INT": 3 }
      },
      {
        "name": "Vortex Rex",
        "description": "A mutated dinosaur who spits miniature whirlwinds. Roars send enemies spinning.",
        "stats": { "STR": 5, "DEX": 2, "CON": 2, "INT": 1 }
      },
      {
        "name": "Gloom Dancer",
        "description": "A nimble villain who twirls through darkness. Each spin drains warmth from the air.",
        "stats": { "STR": 1, "DEX": 4, "CON": 2, "INT": 3 }
      },
      {
        "name": "Pulse Knight",
        "description": "A techno-hero wielding a pulsing energy blade. His armor hums with raw power.",
        "stats": { "STR": 4, "DEX": 2, "CON": 3, "INT": 1 }
      },
      {
        "name": "Echo Mirage",
        "description": "A villain who creates sound-based illusions. Enemies strike at shadows while he laughs.",
        "stats": { "STR": 1, "DEX": 3, "CON": 3, "INT": 3 }
      },
      {
        "name": "Solar Jackal",
        "description": "A desert hero blessed by sun gods. His golden staff burns with holy fire.",
        "stats": { "STR": 4, "DEX": 2, "CON": 2, "INT": 2 }
      },
      {
        "name": "Neuro Widow",
        "description": "A psychic villainess who tangles minds like webs. Her stare can paralyze.",
        "stats": { "STR": 1, "DEX": 2, "CON": 2, "INT": 5 }
      },
      {
        "name": "Chrome Rhino",
        "description": "A brute villain encased in unbreakable chrome armor. Charges through walls with ease.",
        "stats": { "STR": 5, "DEX": 1, "CON": 4, "INT": 0 }
      },
      {
        "name": "Starlight Nova",
        "description": "A cosmic heroine glowing with celestial energy. She inspires courage wherever she flies.",
        "stats": { "STR": 2, "DEX": 3, "CON": 2, "INT": 3 }
      },
      {
        "name": "Night Saw",
        "description": "A villain wielding spinning blades of pure shadow. His roar echoes like grinding steel.",
        "stats": { "STR": 4, "DEX": 3, "CON": 2, "INT": 1 }
      },
      {
        "name": "Pyre Monk",
        "description": "A disciplined monk who controls sacred flames. His strikes leave trails of fire.",
        "stats": { "STR": 3, "DEX": 2, "CON": 3, "INT": 2 }
      },
      {
        "name": "Glitch Raven",
        "description": "A data-corrupted villain who flies as broken pixels. His shrieks disrupt signals.",
        "stats": { "STR": 1, "DEX": 3, "CON": 3, "INT": 3 }
      },
      {
        "name": "Aether Fist",
        "description": "A mystic brawler who channels raw spirit energy. His punches ripple like waves.",
        "stats": { "STR": 4, "DEX": 2, "CON": 2, "INT": 2 }
      },
      {
        "name": "Cinder Veil",
        "description": "A villain cloaked in drifting ash. Every step leaves burning footprints.",
        "stats": { "STR": 2, "DEX": 3, "CON": 3, "INT": 2 }
      },
      {
        "name": "Galactic Tamer",
        "description": "A hero who rides a cosmic beast across the stars. Commands strange interstellar creatures.",
        "stats": { "STR": 3, "DEX": 2, "CON": 2, "INT": 3 }
      },
      {
        "name": "Talon Shade",
        "description": "A masked vigilante with shadow-forged claws. Strikes quick and vanishes in mist.",
        "stats": { "STR": 3, "DEX": 4, "CON": 2, "INT": 1 }
      },
      {
        "name": "Omega Scarab",
        "description": "A villain empowered by an ancient cursed beetle. His body is plated in obsidian armor.",
        "stats": { "STR": 4, "DEX": 1, "CON": 4, "INT": 1 }
      },
      {
        "name": "Plasma Wraith",
        "description": "A glowing phantom of pure energy. Burns through anything he phases across.",
        "stats": { "STR": 2, "DEX": 3, "CON": 2, "INT": 3 }
      },
      {
        "name": "Circuit Paladin",
        "description": "A cybernetic knight powered by neon circuits. His blade hums with radiant energy.",
        "stats": { "STR": 3, "DEX": 2, "CON": 3, "INT": 2 }
      },
      {
        "name": "Rust Widow",
        "description": "A villainess who corrodes metal with a touch. Her poisoned daggers drip iron dust.",
        "stats": { "STR": 2, "DEX": 3, "CON": 2, "INT": 3 }
      },
      {
        "name": "Hyper Vandal",
        "description": "A wild villain with rocket skates and explosive fists. Chaos follows wherever he goes.",
        "stats": { "STR": 4, "DEX": 3, "CON": 2, "INT": 1 }
      },
      {
        "name": "Solar Maiden",
        "description": "A heroine wrapped in golden light. She shields allies with radiant barriers.",
        "stats": { "STR": 2, "DEX": 2, "CON": 3, "INT": 3 }
      },
      {
        "name": "Bone Crusher",
        "description": "A hulking villain with skeletal armor. His hammer cracks stone with ease.",
        "stats": { "STR": 5, "DEX": 1, "CON": 3, "INT": 1 }
      },
      {
        "name": "Nebula Oracle",
        "description": "A cosmic seer who reads the stars. Her visions bend fate itself.",
        "stats": { "STR": 1, "DEX": 2, "CON": 2, "INT": 5 }
      }
    ];

    const selectedCharacter = aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
    
    // Return character with predefined stats
    return selectedCharacter;
  }



  /**
   * Simulate battle between player and AI character
   * @param {Object} playerCharacter - Player's character
   * @param {Object} aiCharacter - AI character
   * @returns {Promise<Object>} Battle result
   */
  async simulateBattle(playerCharacter, aiCharacter) {
    try {
      // Try to use Google GenAI if available
      if (process.env.GOOGLE_GENAI_API_KEY) {
        console.log('🤖 Using Google GenAI for battle simulation');
        return await this.generateAIBattleResult(playerCharacter, aiCharacter);
      } else {
        console.log('⚔️ Using fallback battle generation');
        return this.generateFallbackBattleResult(playerCharacter, aiCharacter);
      }
    } catch (error) {
      console.error('❌ Error in AI battle generation, using fallback:', error);
      return this.generateFallbackBattleResult(playerCharacter, aiCharacter);
    }
  }

  /**
   * Generate battle result using Google GenAI
   * @param {Object} playerCharacter - Player's character
   * @param {Object} aiCharacter - AI character
   * @returns {Promise<Object>} Battle result
   */
  async generateAIBattleResult(playerCharacter, aiCharacter) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", 
      config: {
      thinkingConfig: {
        thinkingBudget: 0,  // disables thinking
      }}});

    const prompt = `You are a creative battle narrator of a one-turn battle. Create a short, fun, and exciting battle description between two characters using the stats
    and abilities, then decide the winner fairly. If any descriptions of abilities are overpowered, balance them out so they do not cuase an automatic win. Add some humor.

Character 1: ${playerCharacter.name}
Description: ${playerCharacter.description}
Stats: STR ${playerCharacter.stats?.STR || 1}, DEX ${playerCharacter.stats?.DEX || 1}, CON ${playerCharacter.stats?.CON || 1}, INT ${playerCharacter.stats?.INT || 1}

Character 2: ${aiCharacter.name}
Description: ${aiCharacter.description}
Stats: STR ${aiCharacter.stats?.STR || 1}, DEX ${aiCharacter.stats?.DEX || 1}, CON ${aiCharacter.stats?.CON || 1}, INT ${aiCharacter.stats?.INT || 1}

Please write a short paragraph (2-3 sentences) describing an epic battle between these characters. Include:
1. How their abilities and stats interact (STR=physical power, DEX=speed/agility, CON=endurance/defense, INT=magic/tactics)
3. Who wins and why (consider their stats when determining the winner - make it dramatic and fun)
4. Keep it family-friendly and entertaining. Environmental effects, random events.
5. Response should be in json format. Add "battleDescription" field for the story and a result block with the fields, "winner" and "loser".
6. No ties
7. Do NOT change the character names or descriptions. Keep the casing the same.
8. Do not include the stat values in the battleDescription.

Format your result as a single paragraph.`;

    console.log('Generating AI battle result:', prompt);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const battleText = response.text();

    let fixedJsonString = battleText
      .replace(/^```json\n/, '') // Remove ```json at the start
      .replace(/\n```$/, '') // Remove ``` at the end
      .trim();
    fixedJsonString = fixedJsonString.replace(/([^\\])`/g, '');
    // Parse the AI response
    return this.parseAIBattleResult(fixedJsonString, playerCharacter, aiCharacter);
  }

  /**
   * Parse AI battle result and determine winner/loser 
   * @param {string} battleText - AI generated battle text
   * @param {Object} playerCharacter - Player's character
   * @param {Object} aiCharacter - AI character
   * @returns {Object} Parsed battle result
   */
  parseAIBattleResult(battleText, playerCharacter, aiCharacter) {
    console.log('Parsing AI battle result:', battleText);
    var json = JSON.parse(battleText);
    const winMatch = json.result.winner;
    const loseMatch = json.result.loser;
    
    // check name formatting
    let winner = winMatch;
    let loser = loseMatch;
    if (winMatch.toLowerCase() === playerCharacter.name.toLowerCase()) {
      winner = playerCharacter;
    }
    if (winMatch.toLowerCase() === aiCharacter.name.toLowerCase()) {
      winner = aiCharacter;
    }

    if (loseMatch.toLowerCase() === aiCharacter.name.toLowerCase()) {
      loser = aiCharacter;
    }
    if (loseMatch.toLowerCase() === playerCharacter.name.toLowerCase()) {
      loser = playerCharacter;
    }


    return {
      scenario: "AI-Generated Battle",
      winner: winner,
      loser: loser,
      description: json.battleDescription.trim(),
    };
  }

  /**
   * Generate fallback battle result when AI is not available
   * @param {Object} playerCharacter - Player's character
   * @param {Object} aiCharacter - AI character
   * @returns {Object} Battle result
   */
  generateFallbackBattleResult(playerCharacter, aiCharacter) {
    const battleScenarios = [
      "The arena crackles with energy as the two warriors face off!",
      "A fierce battle erupts in the mystical arena!",
      "The ground trembles as these powerful beings clash!",
      "Lightning and magic fill the air as the combatants engage!",
      "An epic showdown begins between these legendary fighters!"
    ];

    const scenario = battleScenarios[Math.floor(Math.random() * battleScenarios.length)];
    
    // Randomly determine winner (50/50 chance)
    const playerWins = Math.random() > 0.5;
    const winner = playerWins ? playerCharacter : aiCharacter;
    const loser = playerWins ? aiCharacter : playerCharacter;
    const result = playerWins ? 'win' : 'loss';

    const battleDescriptions = [
      `${scenario} ${winner.name} demonstrates incredible skill, using their unique abilities to gain the upper hand. After an intense exchange, ${winner.name} emerges victorious!`,
      `${scenario} The battle is fierce and evenly matched, but ${winner.name}'s unique abilities prove decisive. ${loser.name} puts up a valiant fight but ultimately falls to ${winner.name}'s superior tactics.`,
      `${scenario} ${winner.name} showcases their mastery of combat, turning the tide of battle with their extraordinary powers. ${loser.name} fights bravely but cannot overcome ${winner.name}'s overwhelming strength.`
    ];

    return {
      scenario: scenario,
      winner: winner,
      loser: loser,
      description: battleDescriptions[Math.floor(Math.random() * battleDescriptions.length)],
      result: result
    };
  }

  /**
   * Handle get battle statistics for a specific character
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetCharacterBattleStats(req, res) {
    try {
      const { discordUserId, characterName } = req.params;
      
      // Validate parameters
      if (!discordUserId) {
        return this.sendErrorResponse(res, 400, 'Missing required parameter: discordUserId');
      }
      
      if (!characterName) {
        return this.sendErrorResponse(res, 400, 'Missing required parameter: characterName');
      }

      console.log(`📊 Getting battle statistics for character: ${characterName} (user: ${discordUserId})`);

      // Get character-specific battle statistics from Redis
      const battleStats = await this.redisManager.getCharacterBattleStats(discordUserId, characterName);

      const response = {
        success: true,
        discordUserId: discordUserId,
        characterName: characterName,
        battleStats: battleStats,
        timestamp: new Date().toISOString()
      };
      
      res.json(response);

    } catch (error) {
      console.error('❌ Error getting character battle statistics:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle get battle statistics (combined for all user's characters)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetBattleStats(req, res) {
    try {
      const { discordUserId } = req.params;
      
      // Validate Discord user ID
      if (!discordUserId) {
        return this.sendErrorResponse(res, 400, 'Missing required parameter: discordUserId');
      }

      console.log(`📊 Getting combined battle statistics for user: ${discordUserId}`);

      // Get combined battle statistics from Redis
      const battleStats = await this.redisManager.getBattleStats(discordUserId);

      const response = {
        success: true,
        discordUserId: discordUserId,
        battleStats: battleStats,
        timestamp: new Date().toISOString()
      };
      
      res.json(response);

    } catch (error) {
      console.error('❌ Error getting battle statistics:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle create match (with idempotency)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleCreateMatch(req, res) {
    try {
      const { playerName, score, level, discordUserId } = req.body;
      
      // Validate required fields
      if (!playerName || score === undefined) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: playerName and score are required');
      }

      // Validate score is a positive number
      if (typeof score !== 'number' || score < 0) {
        return this.sendErrorResponse(res, 400, 'Score must be a positive number');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `create_match:${playerName}_${score}_${level || 1}`;
      
      const idempotencyKey = `match_creation:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached match creation result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      console.log(`🎮 Creating match for ${playerName} with score ${score}`);

      const result = await this.matchmakingManager.createMatch(
        playerName,
        score,
        level || 1,
        discordUserId
      );

      if (result.success) {
        const response = {
          success: true,
          match: result.match,
          message: result.message
        };
        
        // Cache the result for idempotency (expires in 1 hour)
        if (this.redisManager.isReady()) {
          await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
        }
        
        res.json(response);
      } else {
        const errorResponse = {
          success: false,
          error: result.error,
          details: result.details
        };
        
        // Cache error responses for idempotency (expires in 1 hour)
        if (this.redisManager.isReady()) {
          await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(errorResponse));
        }
        
        this.sendErrorResponse(res, 500, result.error, result.details);
      }

    } catch (error) {
      console.error('❌ Error creating match:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle get lobbies
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetLobbies(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      // Validate limit
      if (limit < 1 || limit > 50) {
        return this.sendErrorResponse(res, 400, 'Limit must be between 1 and 50');
      }

      const lobbies = await this.matchmakingManager.getOpenLobbies(limit);
      
      res.json({
        success: true,
        lobbies: lobbies,
        count: lobbies.length,
        limit: limit
      });
    } catch (error) {
      console.error('❌ Error getting lobbies:', error);
      this.sendErrorResponse(res, 500, 'Failed to get lobbies', error.message);
    }
  }

  /**
   * Handle join match (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleJoinMatch(req, res) {
    try {
      const { matchId, playerName, score, level, discordUserId } = req.body;
      
      // Validate required fields
      if (!matchId || !playerName || score === undefined) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: matchId, playerName, and score are required');
      }

      // Validate score is a positive number
      if (typeof score !== 'number' || score < 0) {
        return this.sendErrorResponse(res, 400, 'Score must be a positive number');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `join_match:${matchId}_${playerName}_${score}_${Date.now()}`;
      
      const idempotencyKey = `match_join:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached join result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      console.log(`🎯 Player ${playerName} joining match ${matchId} with score ${score}`);

      const result = await this.matchmakingManager.joinMatch(
        matchId,
        playerName,
        score,
        level || 1,
        discordUserId
      );

      if (result.success) {
        const response = {
          success: true,
          match: result.match,
          resolution: result.resolution,
          message: result.message
        };
        
        // Cache the result for idempotency (expires in 1 hour)
        if (this.redisManager.isReady()) {
          await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
        }
        
        res.json(response);
      } else {
        this.sendErrorResponse(res, 400, result.error, result.details);
      }

    } catch (error) {
      console.error('❌ Error joining match:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle get match details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetMatchDetails(req, res) {
    try {
      const { matchId } = req.params;
      
      if (!matchId) {
        return this.sendErrorResponse(res, 400, 'Match ID is required');
      }

      const match = await this.matchmakingManager.getMatchDetails(matchId);
      
      if (match) {
        res.json({
          success: true,
          match: match
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Match not found',
          message: `No match found with ID: ${matchId}`
        });
      }
    } catch (error) {
      console.error('❌ Error getting match details:', error);
      this.sendErrorResponse(res, 500, 'Failed to get match details', error.message);
    }
  }

  /**
   * Handle get player matches
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetPlayerMatches(req, res) {
    try {
      const { playerName } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      
      // Validate player name
      if (!playerName || playerName.trim().length === 0) {
        return this.sendErrorResponse(res, 400, 'Player name is required');
      }

      // Validate limit
      if (limit < 1 || limit > 50) {
        return this.sendErrorResponse(res, 400, 'Limit must be between 1 and 50');
      }

      const matches = await this.matchmakingManager.getPlayerMatches(playerName.trim(), limit);
      
      res.json({
        success: true,
        matches: matches,
        count: matches.length,
        limit: limit
      });
    } catch (error) {
      console.error('❌ Error getting player matches:', error);
      this.sendErrorResponse(res, 500, 'Failed to get player matches', error.message);
    }
  }

  /**
   * Handle get player stats (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetPlayerStats(req, res) {
    try {
      const { playerName } = req.params;
      
      // Validate player name
      if (!playerName || playerName.trim().length === 0) {
        return this.sendErrorResponse(res, 400, 'Player name is required');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `player_stats:${playerName}`;
      
      const idempotencyKey = `player_stats:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached player stats result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      const stats = await this.matchmakingManager.getPlayerStats(playerName.trim());
      const matches = await this.matchmakingManager.getPlayerMatches(playerName.trim());
      
      const response = {
        success: true,
        playerName: playerName.trim(),
        stats: stats,
        matches: matches
      };

      // Cache the result for idempotency (expires in 2 minutes)
      if (this.redisManager.isReady()) {
        await this.redisManager.client.setEx(idempotencyKey, 120, JSON.stringify(response));
      }
      
      res.json(response);
    } catch (error) {
      console.error('❌ Error getting player stats:', error);
      this.sendErrorResponse(res, 500, 'Failed to get player stats', error.message);
    }
  }

  /**
   * Handle cancel match (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleCancelMatch(req, res) {
    try {
      const { matchId } = req.params;
      const { playerName } = req.body;
      
      if (!matchId) {
        return this.sendErrorResponse(res, 400, 'Match ID is required');
      }

      if (!playerName) {
        return this.sendErrorResponse(res, 400, 'Player name is required');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `cancel_match:${matchId}_${playerName}_${Date.now()}`;
      
      const idempotencyKey = `match_cancel:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached cancel result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      console.log(`❌ Player ${playerName} cancelling match ${matchId}`);

      const result = await this.matchmakingManager.cancelMatch(matchId, playerName);

      if (result.success) {
        const response = {
          success: true,
          message: result.message
        };
        
        // Cache the result for idempotency (expires in 1 hour)
        if (this.redisManager.isReady()) {
          await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
        }
        
        res.json(response);
      } else {
        this.sendErrorResponse(res, 400, result.error, result.details);
      }

    } catch (error) {
      console.error('❌ Error cancelling match:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle get matchmaking stats
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetMatchmakingStats(req, res) {
    try {
      const stats = await this.matchmakingManager.getMatchmakingStats();
      
      res.json({
        success: true,
        stats: stats
      });
    } catch (error) {
      console.error('❌ Error getting matchmaking stats:', error);
      this.sendErrorResponse(res, 500, 'Failed to get matchmaking stats', error.message);
    }
  }

  /**
   * Send standardized error response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} error - Error message
   * @param {string} details - Additional error details (optional)
   */
  sendErrorResponse(res, statusCode, error, details = null) {
    const response = {
      success: false,
      error: error
    };

    if (details) {
      response.details = details;
    }

    res.status(statusCode).json(response);
  }

  /**
   * Handle Discord consumable SKU purchase and award battle gems
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAddBattleGems(req, res) {
    try {
      const { discordUserId, skuId, purchaseToken } = req.body;
      
      if (!discordUserId) {
        return this.sendErrorResponse(res, 400, 'Missing required field: discordUserId');
      }

      if (!skuId) {
        return this.sendErrorResponse(res, 400, 'Missing required field: skuId');
      }

      if (!purchaseToken) {
        return this.sendErrorResponse(res, 400, 'Missing required field: purchaseToken');
      }

      console.log(`💎 Processing Discord consumable purchase for user: ${discordUserId}, SKU: ${skuId}`);

      // TODO:XXX VERIFY ENTITLEMENTS
      // Validate the purchase with Discord
      //const purchaseValidation = await this.validateDiscordPurchase(discordUserId, skuId, purchaseToken);
      
      // if (!purchaseValidation.success) {
      //   return this.sendErrorResponse(res, 400, 'Invalid purchase', purchaseValidation.error);
      // }

      // Check if this purchase has already been processed (prevent duplicate rewards)
      const existingPurchase = await this.redisManager.getProcessedPurchase(purchaseToken);
      if (existingPurchase) {
        return this.sendErrorResponse(res, 409, 'Purchase already processed', {
          battleGems: existingPurchase.battleGems,
          processedAt: existingPurchase.processedAt
        });
      }

      // Determine gem amount based on SKU
      const gemAmount = this.getGemAmountFromSku(skuId);
      if (gemAmount === 0) {
        return this.sendErrorResponse(res, 400, 'Invalid SKU ID', 'Unknown consumable SKU');
      }

      // Award battle gems to user
      const result = await this.redisManager.addBattleGems(discordUserId.trim(), gemAmount);
      
      if (result.success) {
        // Consume the entitlement to prevent reuse
       // if (purchaseValidation.entitlement) {
          const consumeResult = await this.consumeDiscordEntitlement(
            this.config.getDiscordConfig().clientId,
            this.config.getDiscordConfig().token,
            purchaseToken
          );
          
          if (!consumeResult.success) {
            console.warn('⚠️ Failed to consume entitlement, but gems were awarded:', consumeResult.error);
          } else {
            console.log('✅ Entitlement consumed successfully');
          }
     //   }

        // Mark purchase as processed to prevent duplicate rewards
        await this.redisManager.markPurchaseAsProcessed(purchaseToken, {
          discordUserId: discordUserId,
          skuId: skuId,
          gemAmount: gemAmount,
          battleGems: result.newTotal,
          processedAt: new Date().toISOString()
        });

        // Post to Discord when gems are successfully added
        // try {
        //   if (this.discordManager && this.discordManager.isBotReady()) {
        //     console.log(`📤 Posting battle gems purchase to Discord for user ${discordUserId}`);
        //     const discordResult = await this.discordManager.postBattleGemsPurchasedToDiscord(discordUserId, gemAmount, result.newTotal, skuId);
        //     if (discordResult.success) {
        //       console.log('✅ Battle gems purchase posted to Discord successfully');
        //     } else {
        //       console.warn('⚠️ Failed to post battle gems purchase to Discord:', discordResult.error);
        //     }
        //   } else {
        //     console.log('ℹ️ Discord bot not available, skipping battle gems purchase post');
        //   }
        // } catch (discordError) {
        //   console.warn('⚠️ Error posting battle gems purchase to Discord (non-critical):', discordError.message);
        // }

        res.json({
          success: true,
          message: `Successfully purchased ${gemAmount} battle gems!`,
          battleGems: result.newTotal,
          added: gemAmount,
          skuId: skuId,
          purchaseToken: purchaseToken
        });
      } else {
        res.json({
          success: false,
          message: result.message,
          battleGems: result.newTotal
        });
      }

    } catch (error) {
      console.error('❌ Error processing battle gems purchase:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Validate Discord consumable purchase
   * @param {string} discordUserId - Discord user ID
   * @param {string} skuId - SKU ID
   * @param {string} purchaseToken - Purchase token from Discord
   * @returns {Promise<Object>} Validation result
   */
  async validateDiscordPurchase(discordUserId, skuId, purchaseToken) {
    try {
      if (!discordUserId || !skuId || !purchaseToken) {
        return { success: false, error: 'Missing required purchase data' };
      }

      // Validate SKU ID format (should be a valid Discord SKU)
      if (!skuId.startsWith('sku_') && !skuId.match(/^\d+_gems$/)) {
        return { success: false, error: 'Invalid SKU ID format' };
      }

      // Validate purchase token format
      if (purchaseToken.length < 20) {
        return { success: false, error: 'Invalid purchase token format' };
      }

      // Get Discord configuration
      const discordConfig = this.config.getDiscordConfig();
      if (!discordConfig.token || !discordConfig.clientId) {
        console.warn('⚠️ Discord configuration missing, skipping API validation');
        return { success: true }; // Allow in development
      }

      // Validate purchase with Discord's monetization API
      const validationResult = await this.validateWithDiscordAPI(
        discordConfig.clientId,
        discordConfig.token,
        skuId,
        purchaseToken,
        discordUserId
      );

      if (validationResult.success) {
        console.log(`✅ Discord API validation passed for user ${discordUserId}, SKU ${skuId}`);
        return { success: true, entitlement: validationResult.entitlement };
      } else {
        console.log(`❌ Discord API validation failed for user ${discordUserId}: ${validationResult.error}`);
        return { success: false, error: validationResult.error };
      }

    } catch (error) {
      console.error('❌ Error validating Discord purchase:', error);
      return { success: false, error: 'Purchase validation failed' };
    }
  }

  /**
   * Validate purchase with Discord's monetization API
   * @param {string} applicationId - Discord application ID
   * @param {string} botToken - Discord bot token
   * @param {string} skuId - SKU ID
   * @param {string} purchaseToken - Purchase token
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object>} Validation result
   */
  async validateWithDiscordAPI(applicationId, botToken, skuId, purchaseToken, userId) {
    try {
      // First, get the entitlement using the purchase token
      const entitlementResponse = await fetch(
        `https://discord.com/api/v10/applications/${applicationId}/entitlements?purchase_token=${purchaseToken}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!entitlementResponse.ok) {
        const errorText = await entitlementResponse.text();
        console.error(`❌ Discord API error: ${entitlementResponse.status} - ${errorText}`);
        return { 
          success: false, 
          error: `Discord API error: ${entitlementResponse.status}` 
        };
      }

      const entitlements = await entitlementResponse.json();
      
      if (!entitlements || entitlements.length === 0) {
        return { 
          success: false, 
          error: 'No entitlements found for this purchase token' 
        };
      }

      // Find the entitlement that matches our SKU and user
      const matchingEntitlement = entitlements.find(entitlement => 
        entitlement.sku_id === skuId && 
        entitlement.user_id === userId &&
        entitlement.type === 8 // Type 8 is consumable
      );

      if (!matchingEntitlement) {
        return { 
          success: false, 
          error: 'No matching consumable entitlement found' 
        };
      }

      // Check if the entitlement is still valid (not consumed)
      if (matchingEntitlement.consumed) {
        return { 
          success: false, 
          error: 'This consumable has already been consumed' 
        };
      }

      // Check if the entitlement is active
      if (matchingEntitlement.ends_at && new Date(matchingEntitlement.ends_at) < new Date()) {
        return { 
          success: false, 
          error: 'This entitlement has expired' 
        };
      }

      console.log(`✅ Found valid entitlement: ${matchingEntitlement.id}`);
      return { 
        success: true, 
        entitlement: matchingEntitlement 
      };

    } catch (error) {
      console.error('❌ Error calling Discord API:', error);
      return { 
        success: false, 
        error: 'Failed to validate with Discord API' 
      };
    }
  }

  /**
   * Consume a Discord entitlement
   * @param {string} applicationId - Discord application ID
   * @param {string} botToken - Discord bot token
   * @param {string} entitlementId - Entitlement ID to consume
   * @returns {Promise<Object>} Consume result
   */
  async consumeDiscordEntitlement(applicationId, botToken, entitlementId) {
    try {
      const consumeResponse = await fetch(
        `https://discord.com/api/v10/applications/${applicationId}/entitlements/${entitlementId}/consume`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!consumeResponse.ok) {
        const errorText = await consumeResponse.text();
        console.error(`❌ Discord consume API error: ${consumeResponse.status} - ${errorText}`);
        return { 
          success: false, 
          error: `Discord API error: ${consumeResponse.status}` 
        };
      }

      const result = await consumeResponse.json();
      console.log(`✅ Entitlement ${entitlementId} consumed successfully`);
      return { success: true, result: result };

    } catch (error) {
      console.error('❌ Error consuming Discord entitlement:', error);
      return { 
        success: false, 
        error: 'Failed to consume entitlement' 
      };
    }
  }

  /**
   * Handle getting available SKUs from Discord
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetAvailableSKUs(req, res) {
    try {
      console.log('🔍 Fetching available SKUs from Discord...');

      const discordConfig = this.config.getDiscordConfig();
      if (!discordConfig.token || !discordConfig.clientId) {
        return this.sendErrorResponse(res, 500, 'Discord configuration missing', 'Cannot fetch SKUs without Discord credentials');
      }

      const skus = await this.fetchDiscordSKUs(discordConfig.clientId, discordConfig.token);
      
      if (skus.success) {
        res.json({
          success: true,
          skus: skus.data,
          count: skus.data.length
        });
      } else {
        this.sendErrorResponse(res, 500, 'Failed to fetch SKUs', skus.error);
      }

    } catch (error) {
      console.error('❌ Error fetching available SKUs:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Fetch SKUs from Discord API
   * @param {string} applicationId - Discord application ID
   * @param {string} botToken - Discord bot token
   * @returns {Promise<Object>} SKUs result
   */
  async fetchDiscordSKUs(applicationId, botToken) {
    try {
      const skusResponse = await fetch(
        `https://discord.com/api/v10/applications/${applicationId}/skus`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!skusResponse.ok) {
        const errorText = await skusResponse.text();
        console.error(`❌ Discord SKUs API error: ${skusResponse.status} - ${errorText}`);
        return { 
          success: false, 
          error: `Discord API error: ${skusResponse.status}` 
        };
      }

      const skus = await skusResponse.json();
      console.log(`✅ Fetched ${skus.length} SKUs from Discord`);
      
      // Log available SKUs for debugging
      skus.forEach(sku => {
        console.log(`📦 SKU: ${sku.id} - ${sku.name} (Type: ${sku.type}, Price: ${sku.price?.amount || 'N/A'})`);
      });

      return { success: true, data: skus };

    } catch (error) {
      console.error('❌ Error calling Discord SKUs API:', error);
      return { 
        success: false, 
        error: 'Failed to fetch SKUs from Discord API' 
      };
    }
  }

  /**
   * Get gem amount from SKU ID
   * @param {string} skuId - SKU ID
   * @returns {number} Gem amount
   */
  getGemAmountFromSku(skuId) {
    // Map SKU IDs to gem amounts
    const skuToGems = {
      '10_gems': 10,      // 10 gems pack
    };

    return skuToGems[skuId] || 0;
  }

  /**
   * Handle getting battle gems for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetBattleGems(req, res) {
    try {
      const { discordUserId } = req.params;
      
      if (!discordUserId) {
        return this.sendErrorResponse(res, 400, 'Missing required field: discordUserId');
      }

      console.log(`💎 Getting battle gems for user: ${discordUserId}`);

      const battleGems = await this.redisManager.getBattleGems(discordUserId.trim());
      
      res.json({
        success: true,
        discordUserId: discordUserId.trim(),
        battleGems: battleGems
      });

    } catch (error) {
      console.error('❌ Error getting battle gems:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  // /**
  //  * Handle get top characters by win rate
  //  * @param {Object} req - Express request object
  //  * @param {Object} res - Express response object
  //  */
  // async handleGetTopCharacters(req, res) {
  //   try {
  //     const { limit = 10 } = req.query;
  //     const limitNum = parseInt(limit);
      
  //     if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
  //       return this.sendErrorResponse(res, 400, 'Invalid limit parameter. Must be between 1 and 50.');
  //     }

  //     console.log(`🏆 Getting top ${limitNum} characters by win rate`);

  //     const topCharacters = await this.redisManager.getTopCharactersByWinRate(limitNum);
      
  //     res.json({
  //       success: true,
  //       characters: topCharacters,
  //       count: topCharacters.length,
  //       limit: limitNum,
  //       timestamp: new Date().toISOString()
  //     });

  //   } catch (error) {
  //     console.error('❌ Error getting top characters:', error);
  //     this.sendErrorResponse(res, 500, 'Internal server error', error.message);
  //   }
  // }

  /**
   * Handle PVP battle simulation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handlePVPBattleSimulation(req, res) {
    try {
      const { playerCharacter, discordUserId, useBattleGem = false } = req.body;
      
      // Check battle cooldown first
      const cooldownStatus = await this.redisManager.checkBattleCooldown(discordUserId.trim());
      console.log("use battle gem: ", useBattleGem);
      //if (cooldownStatus.onCooldown) {
        if (useBattleGem) {
          // Check if user has enough battle gems
          const currentGems = await this.redisManager.getBattleGems(discordUserId.trim());
          if (currentGems < 1) {
            const timeRemainingSeconds = Math.ceil(cooldownStatus.timeRemaining / 1000);
            return this.sendErrorResponse(res, 429, `Battle cooldown active and insufficient battle gems. Please wait ${timeRemainingSeconds} seconds or obtain more battle gems.`, {
              cooldownExpiry: cooldownStatus.cooldownExpiry,
              timeRemaining: cooldownStatus.timeRemaining,
              battleGems: currentGems
            });
          }
          
          // Spend 1 battle gem to bypass cooldown
          const spendResult = await this.redisManager.spendBattleGems(discordUserId.trim(), 1);
          if (!spendResult.success) {
            return this.sendErrorResponse(res, 400, spendResult.message);
          }
          
          console.log(`💎 User ${discordUserId} spent 1 battle gem to bypass cooldown`);
        // } else {
        //   const timeRemainingSeconds = Math.ceil(cooldownStatus.timeRemaining / 1000);
        //   return this.sendErrorResponse(res, 429, `Battle cooldown active. Please wait ${timeRemainingSeconds} seconds before your next battle.`, {
        //     cooldownExpiry: cooldownStatus.cooldownExpiry,
        //     timeRemaining: cooldownStatus.timeRemaining
        //   });
        // }
        }

      // Validate required fields
      if (!playerCharacter || !playerCharacter.name || !playerCharacter.description) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: playerCharacter with name and description are required');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `pvp_battle_sim:${discordUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const idempotencyKey = `pvp_battle_simulation:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached PVP battle simulation result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      console.log(`⚔️ Simulating PVP battle for character: `, playerCharacter);

      // Get a random PVP opponent
      const pvpOpponent = await this.redisManager.getRandomPVPOpponent(discordUserId.trim(), playerCharacter.name);
      
      if (!pvpOpponent) {
        return this.sendErrorResponse(res, 404, 'No opponents available for PVP battle. Try again later!');
      }

      // Transform PVP opponent to match AI character structure
      const aiCharacter = {
        name: pvpOpponent.characterName,
        description: pvpOpponent.description,
        stats: pvpOpponent.stats
      };

      console.log('⚔️ PVP Battle:', playerCharacter.name, 'vs', aiCharacter.name);
      
      // Simulate battle
      const battleResult = await this.simulateBattle(playerCharacter, aiCharacter);

      // Update PVP battle statistics for the player
      const battleStats = await this.redisManager.updatePVPBattleStats(discordUserId, battleResult, playerCharacter);
      
      // Update PVP battle statistics for the opponent (only if it's a real player, not AI)
      if (!pvpOpponent.discordUserId.startsWith('ai_opponent_')) {
        await this.redisManager.updatePVPBattleStats(pvpOpponent.discordUserId, battleResult, pvpOpponent);
      } else {
        console.log('🤖 Skipping battle stats update for AI opponent:', pvpOpponent.characterName);
      }

      // Get updated character level
      const characterLevel = await this.redisManager.getCharacterLevel(discordUserId, playerCharacter.name);

      let cooldownExpiry = null;
      // Set battle cooldown
      if (!useBattleGem)
      {
        cooldownExpiry = await this.redisManager.setBattleCooldown(discordUserId);
      }
      else {
        const cooldownStatus = await this.redisManager.checkBattleCooldown(discordUserId.trim());
        cooldownExpiry = cooldownStatus.cooldownExpiry;
      }

      // Get updated battle gems count
      const battleGems = await this.redisManager.getBattleGems(discordUserId);

      const response = {
        success: true,
        playerCharacter: playerCharacter,
        aiCharacter: aiCharacter, // Use aiCharacter for consistency with regular battles
        pvpOpponent: pvpOpponent, // Include original PVP opponent data
        battleResult: battleResult,
        battleStats: battleStats,
        characterLevel: characterLevel,
        cooldownExpiry: cooldownExpiry ? cooldownExpiry.toISOString() : null,
        battleGems: battleGems,
        isPVP: true,
        timestamp: new Date().toISOString()
      };
      
      // Cache the result for idempotency (expires in 1 hour)
      if (this.redisManager.isReady()) {
        await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
      }
      
      // Post battle summary to Discord (non-blocking)
      try {
       // if (this.discordManager && this.discordManager.isBotReady()) {
          console.log(`📤 Posting PVP battle summary to Discord for user ${discordUserId}`);
          const discordResult = await this.discordManager.postBattleSummaryToDiscord(response, discordUserId);
          if (discordResult.success) {
            console.log('✅ PVP battle summary posted to Discord successfully');
          } else {
            console.warn('⚠️ Failed to post PVP battle summary to Discord:', discordResult.error);
          }
        // } else {
        //   console.log('ℹ️ Discord bot not available, skipping battle summary post');
        // }
      } catch (discordError) {
        console.warn('⚠️ Error posting to Discord (non-critical):', discordError.message);
        // Continue with battle response even if Discord fails
      }
      
      res.json(response);

    } catch (error) {
      console.error('❌ Error in PVP battle simulation:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle get character PVP battle statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetCharacterPVPBattleStats(req, res) {
    try {
      const { discordUserId, characterName } = req.params;
      
      if (!discordUserId) {
        return this.sendErrorResponse(res, 400, 'Missing required parameter: discordUserId');
      }
      
      if (!characterName) {
        return this.sendErrorResponse(res, 400, 'Missing required parameter: characterName');
      }

      console.log(`📊 Getting PVP battle statistics for character: ${characterName} (user: ${discordUserId})`);

      const battleStats = await this.redisManager.getCharacterPVPBattleStats(discordUserId, characterName);
      
      res.json({
        success: true,
        discordUserId: discordUserId,
        characterName: characterName,
        battleStats: battleStats,
        isPVP: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error getting character PVP battle statistics:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Handle get top PVP characters by win rate
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGetTopPVPCharacters(req, res) {
    try {
      const { limit = 10 } = req.query;
      const limitNum = parseInt(limit);
      
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        return this.sendErrorResponse(res, 400, 'Invalid limit parameter. Must be between 1 and 50.');
      }

      console.log(`🏆 Getting top ${limitNum} PVP characters by win rate`);

      const topCharacters = await this.redisManager.getTopPVPCharactersByWinRate(limitNum);
      
      res.json({
        success: true,
        characters: topCharacters,
        count: topCharacters.length,
        limit: limitNum,
        isPVP: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error getting top PVP characters:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }
}
