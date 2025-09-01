/**
 * APIRoutes - Handles all API endpoints with proper validation and error handling
 * Provides centralized API functionality with consistent response formats
 */
export class APIRoutes {
  constructor(redisManager, discordManager, matchmakingManager) {
    this.redisManager = redisManager;
    this.discordManager = discordManager;
    this.matchmakingManager = matchmakingManager;
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
    
    // Battle simulation endpoint
    app.post('/api/battle/simulate', this.handleBattleSimulation.bind(this));
    
    // Battle statistics endpoints
    app.get('/api/battle/stats/:discordUserId', this.handleGetBattleStats.bind(this));

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
      
      res.json({
        success: true,
        discordUserId: discordUserId.trim(),
        characters: characters,
        count: characters.length,
        limit: limit
      });
    } catch (error) {
      console.error('❌ Error getting user characters:', error);
      this.sendErrorResponse(res, 500, 'Failed to get user characters', error.message);
    }
  }

  /**
   * Handle battle simulation (Idempotent)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleBattleSimulation(req, res) {
    try {
      const { clientCharacter, discordUserId } = req.body;
      const characters = await this.redisManager.getUserCharacters(discordUserId.trim(), 10);
      const firstCharacter = characters[0];

      let playerCharacter  = {
        name: firstCharacter.characterName,
        description: firstCharacter.description,
        stats: firstCharacter.stats
    };
      // Validate required fields
      if (!playerCharacter || !playerCharacter.name || !playerCharacter.description) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: playerCharacter with name and description are required');
      }

      // Generate idempotency key
      const requestId = req.headers['x-request-id'] || 
                       req.headers['x-idempotency-key'] || 
                       `battle_sim:${discordUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const idempotencyKey = `battle_simulation:${requestId}`;

      // Check if this request was already processed
      if (this.redisManager.isReady()) {
        const existingResult = await this.redisManager.client.get(idempotencyKey);
        if (existingResult) {
          console.log(`🔄 Idempotency: Returning cached battle simulation result for ${requestId}`);
          return res.json(JSON.parse(existingResult));
        }
      }

      console.log(`⚔️ Simulating battle for character: `, playerCharacter);

      // Generate AI opponent
      const aiCharacter = this.selectRandomAICharacter();
      
      // Simulate battle
      const battleResult = await this.simulateBattle(playerCharacter, aiCharacter);

      // Update battle statistics
      const battleStats = await this.redisManager.updateBattleStats(discordUserId, battleResult, playerCharacter);

      // Get updated character level
      const characterLevel = await this.redisManager.getCharacterLevel(discordUserId, playerCharacter.name);

      const response = {
        success: true,
        playerCharacter: playerCharacter,
        aiCharacter: aiCharacter,
        battleResult: battleResult,
        battleStats: battleStats,
        characterLevel: characterLevel,
        timestamp: new Date().toISOString()
      };
      
      // Cache the result for idempotency (expires in 1 hour)
      if (this.redisManager.isReady()) {
        await this.redisManager.client.setEx(idempotencyKey, 3600, JSON.stringify(response));
      }
      
      res.json(response);

    } catch (error) {
      console.error('❌ Error in battle simulation:', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
  }

  /**
   * Select a random AI character for battle
   * @returns {Object} AI character object
   */
  selectRandomAICharacter() {
    const aiCharacters = [
      // Original 8 characters
      {
        name: "Shadow Blade",
        description: "A mysterious ninja warrior with the ability to teleport through shadows. Master of stealth and assassination techniques. Wields dual katanas and can create shadow clones.",
        stats: { STR: 2, DEX: 4, CON: 2, INT: 2 }
      },
      {
        name: "Thunder Fist",
        description: "A powerful martial artist who can channel electricity through his fists. His punches create thunderous shockwaves and can paralyze opponents. Master of lightning-fast strikes.",
        stats: { STR: 3, DEX: 3, CON: 2, INT: 2 }
      },
      {
        name: "Crystal Guardian",
        description: "A mystical warrior made of living crystal. Can create impenetrable barriers and shoot crystal shards. Immune to most physical attacks and can regenerate from any damage.",
        stats: { STR: 2, DEX: 1, CON: 4, INT: 3 }
      },
      {
        name: "Flame Phoenix",
        description: "A fire elemental with the ability to transform into a phoenix. Can control fire and heat, fly at incredible speeds, and resurrect from ashes. Master of fire magic.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Iron Titan",
        description: "A massive robot warrior with impenetrable armor. Can transform parts of its body into weapons and has superhuman strength. Immune to most conventional attacks.",
        stats: { STR: 4, DEX: 1, CON: 3, INT: 2 }
      },
      {
        name: "Frost Witch",
        description: "An ice sorceress who can freeze enemies solid and create blizzards. Can walk on water by freezing it and summon ice elementals. Master of cold magic.",
        stats: { STR: 1, DEX: 2, CON: 3, INT: 4 }
      },
      {
        name: "Storm Rider",
        description: "A wind elemental who can fly at supersonic speeds and create tornadoes. Can become intangible like mist and strike with hurricane-force winds.",
        stats: { STR: 2, DEX: 4, CON: 2, INT: 2 }
      },
      {
        name: "Earth Shaker",
        description: "A giant stone warrior who can cause earthquakes and create rock barriers. Can merge with the ground and emerge anywhere. Master of earth magic.",
        stats: { STR: 3, DEX: 1, CON: 4, INT: 2 }
      },
      
      // Lawful Good Heroes
      {
        name: "Paladin of Light",
        description: "A holy warrior clad in radiant armor, wielding a blessed sword that glows with divine power. Can heal allies and smite evil with holy magic.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Guardian Angel",
        description: "A celestial being with pure white wings and a halo of light. Protects the innocent with divine shields and can banish evil with holy fire.",
        stats: { STR: 2, DEX: 3, CON: 3, INT: 2 }
      },
      {
        name: "Justice Seeker",
        description: "A noble knight who upholds the law with unwavering dedication. Wields a sword of truth that can cut through lies and deception.",
        stats: { STR: 3, DEX: 2, CON: 2, INT: 3 }
      },
      
      // Neutral Good Heroes
      {
        name: "Nature's Champion",
        description: "A druid who communes with the spirits of the forest. Can transform into animals, control plants, and harness the raw power of nature.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Wandering Healer",
        description: "A compassionate cleric who travels the land helping those in need. Masters of healing magic and protective spells.",
        stats: { STR: 1, DEX: 2, CON: 3, INT: 4 }
      },
      {
        name: "Beast Master",
        description: "A ranger who has formed deep bonds with wild animals. Fights alongside loyal companions and can communicate with all creatures.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      
      // Chaotic Good Heroes
      {
        name: "Freedom Fighter",
        description: "A rebel who fights against tyranny and oppression. Uses guerrilla tactics and can rally others to the cause of justice.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Wild Mage",
        description: "A chaotic spellcaster whose magic is unpredictable but powerful. Can cast spells with random effects that often turn the tide of battle.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Rogue Hero",
        description: "A charming thief with a heart of gold who steals from the rich to give to the poor. Master of stealth and deception.",
        stats: { STR: 2, DEX: 4, CON: 1, INT: 3 }
      },
      
      // Lawful Neutral Characters
      {
        name: "Iron Sentinel",
        description: "A mechanical guardian programmed to protect ancient ruins. Follows its protocols with unwavering precision and efficiency.",
        stats: { STR: 3, DEX: 1, CON: 4, INT: 2 }
      },
      {
        name: "Order Keeper",
        description: "A monk who maintains perfect balance and discipline. Masters of martial arts and can achieve superhuman feats through meditation.",
        stats: { STR: 2, DEX: 3, CON: 3, INT: 2 }
      },
      {
        name: "Time Watcher",
        description: "A mysterious entity that maintains the flow of time. Can slow down or speed up time around them and see into the past and future.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      
      // True Neutral Characters
      {
        name: "Elemental Spirit",
        description: "A primordial being of pure elemental energy. Can shift between fire, water, earth, and air forms at will.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Wild Shaman",
        description: "A tribal mystic who communes with spirits and nature. Can channel the raw power of the elements and speak with animals.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Balance Keeper",
        description: "A mysterious figure who maintains equilibrium in the world. Can absorb and redirect any form of energy or magic.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      
      // Chaotic Neutral Characters
      {
        name: "Mad Alchemist",
        description: "A brilliant but unstable scientist who creates explosive potions and dangerous experiments. Never knows what his concoctions will do.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Chaos Weaver",
        description: "A sorcerer who draws power from pure chaos. Can create random magical effects and bend reality in unpredictable ways.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      },
      {
        name: "Wild Berserker",
        description: "A fierce warrior who enters a battle rage that makes them unstoppable but uncontrollable. Strength increases dramatically in combat.",
        stats: { STR: 4, DEX: 2, CON: 3, INT: 1 }
      },
      
      // Lawful Evil Villains
      {
        name: "Dark Paladin",
        description: "A fallen holy warrior who serves an evil deity. Wields a corrupted sword that drains life and can command undead minions.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Tyrant King",
        description: "A ruthless ruler who maintains order through fear and oppression. Commands loyal soldiers and uses dark magic to control minds.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Inquisitor",
        description: "A fanatical enforcer who hunts down heretics and non-believers. Uses torture and fear as weapons and has no mercy.",
        stats: { STR: 3, DEX: 2, CON: 2, INT: 3 }
      },
      
      // Neutral Evil Villains
      {
        name: "Soul Harvester",
        description: "A necromancer who steals souls to power dark magic. Can raise the dead as mindless servants and drain life from the living.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Shadow Assassin",
        description: "A deadly killer who works for the highest bidder. Master of poisons, stealth, and can kill with a single strike.",
        stats: { STR: 2, DEX: 4, CON: 1, INT: 3 }
      },
      {
        name: "Corrupted Druid",
        description: "A nature priest who has been twisted by dark magic. Can control corrupted animals and spread blight and disease.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      
      // Chaotic Evil Villains
      {
        name: "Demon Lord",
        description: "A powerful demon from the depths of hell. Can summon other demons, breathe fire, and corrupt the souls of mortals.",
        stats: { STR: 4, DEX: 2, CON: 3, INT: 1 }
      },
      {
        name: "Mad Jester",
        description: "A psychotic clown who finds joy in chaos and destruction. Uses deadly toys and can drive opponents insane with laughter.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Blood Cultist",
        description: "A fanatic who worships dark gods through blood sacrifice. Can channel dark energy and summon eldritch horrors.",
        stats: { STR: 2, DEX: 2, CON: 2, INT: 4 }
      },
      
      // Unique and Exotic Characters
      {
        name: "Void Walker",
        description: "A being from beyond reality who can phase through dimensions. Can create portals and manipulate space itself.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      },
      {
        name: "Crystal Dragon",
        description: "A majestic dragon made entirely of living crystal. Can breathe crystalline fire and create beautiful but deadly constructs.",
        stats: { STR: 3, DEX: 2, CON: 4, INT: 1 }
      },
      {
        name: "Quantum Mage",
        description: "A spellcaster who understands the fundamental laws of reality. Can manipulate probability and exist in multiple places at once.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Living Storm",
        description: "A sentient storm cloud that can control lightning, rain, and wind. Can transform into pure energy and strike with thunder.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Dream Weaver",
        description: "A being who exists in the realm of dreams and can pull others into nightmare worlds. Can make dreams reality and reality dreams.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Gravity Master",
        description: "A warrior who can control the force of gravity itself. Can make opponents float helplessly or crush them with intense pressure.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Sound Bender",
        description: "A musician who can weaponize sound waves. Can create sonic booms, shatter objects with resonance, and control minds with music.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      },
      {
        name: "Mirror Knight",
        description: "A warrior clad in reflective armor who can redirect attacks and create mirror images of themselves. Can trap opponents in mirror dimensions.",
        stats: { STR: 2, DEX: 3, CON: 3, INT: 2 }
      },
      {
        name: "Life Giver",
        description: "A being who can create life from nothing and heal any wound. Can animate objects and bring the dead back to life.",
        stats: { STR: 1, DEX: 2, CON: 3, INT: 4 }
      },
      {
        name: "Death Reaper",
        description: "A spectral figure who harvests souls and can see the moment of death for all living things. Can drain life force and command spirits.",
        stats: { STR: 2, DEX: 2, CON: 2, INT: 4 }
      },
      {
        name: "Mind Controller",
        description: "A psychic who can read thoughts and control minds. Can make opponents fight each other or turn them into loyal servants.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Time Traveler",
        description: "A mysterious figure who can move through time at will. Can age opponents rapidly or reverse their own injuries by going back in time.",
        stats: { STR: 2, DEX: 2, CON: 2, INT: 4 }
      },
      {
        name: "Reality Shaper",
        description: "A being who can alter the fundamental laws of physics. Can create impossible objects and bend space and time to their will.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Elemental Fusion",
        description: "A being made of all four elements combined. Can create devastating combinations like steam explosions or lightning storms.",
        stats: { STR: 2, DEX: 3, CON: 3, INT: 2 }
      },
      {
        name: "Soul Forge",
        description: "A blacksmith who can craft weapons from pure soul energy. Can create weapons that grow stronger with each battle.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Memory Thief",
        description: "A being who can steal memories and knowledge from others. Can use stolen skills and erase opponents' combat experience.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      },
      {
        name: "Dimension Walker",
        description: "A traveler who can step between different realities. Can bring objects and creatures from other dimensions into battle.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Cosmic Guardian",
        description: "A being who protects the balance of the universe. Can call upon the power of stars and manipulate cosmic energy.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Shadow Puppeteer",
        description: "A master who can control shadows as if they were living beings. Can create shadow armies and trap opponents in darkness.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      },
      {
        name: "Life Force Vampire",
        description: "A being who feeds on the life energy of others. Can drain strength, speed, and vitality from opponents to empower themselves.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Echo Warrior",
        description: "A fighter who can create perfect copies of themselves. Each echo can fight independently and share the same consciousness.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Fate Weaver",
        description: "A being who can see and manipulate the threads of destiny. Can change the outcome of battles by altering probability.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Void Knight",
        description: "A warrior who draws power from the emptiness between worlds. Can create weapons from pure nothingness and phase through attacks.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Soul Binder",
        description: "A being who can capture and control the souls of the dead. Can summon powerful spirits and use their abilities.",
        stats: { STR: 1, DEX: 2, CON: 3, INT: 4 }
      },
      {
        name: "Reality Mirror",
        description: "A being who can reflect and amplify any attack back at the attacker. Can copy opponents' abilities and turn them against them.",
        stats: { STR: 2, DEX: 3, CON: 3, INT: 2 }
      },
      {
        name: "Dream Knight",
        description: "A warrior who fights in the realm of dreams. Can make nightmares real and turn dreams into weapons.",
        stats: { STR: 3, DEX: 2, CON: 2, INT: 3 }
      },
      {
        name: "Soul Smith",
        description: "A craftsman who forges weapons from pure soul energy. Can create weapons that grow stronger with each soul they claim.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Void Caller",
        description: "A being who can summon creatures from the void between worlds. Can call forth eldritch horrors and void beasts.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Reality Anchor",
        description: "A being who can stabilize and control the fabric of reality. Can prevent teleportation and lock opponents in place.",
        stats: { STR: 2, DEX: 2, CON: 4, INT: 2 }
      },
      {
        name: "Soul Storm",
        description: "A being made of pure soul energy that can take any form. Can possess opponents and control their bodies.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Dream Walker",
        description: "A being who can enter and control the dreams of others. Can trap opponents in endless nightmares.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Void Master",
        description: "A being who has mastered the emptiness between worlds. Can create portals, teleport, and manipulate space itself.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      },
      {
        name: "Reality Bender",
        description: "A being who can change the fundamental laws of physics. Can make the impossible possible and the possible impossible.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Soul Guardian",
        description: "A being who protects the souls of the innocent. Can create barriers of pure soul energy and banish evil spirits.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Dream Master",
        description: "A being who can control the realm of dreams and nightmares. Can make dreams reality and trap opponents in endless loops.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Void Knight",
        description: "A warrior who draws power from the void between worlds. Can create weapons from pure nothingness and phase through reality.",
        stats: { STR: 3, DEX: 2, CON: 3, INT: 2 }
      },
      {
        name: "Reality Shifter",
        description: "A being who can shift between different versions of reality. Can bring objects and creatures from parallel worlds.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Soul Harvester",
        description: "A being who collects and uses the energy of souls. Can drain life force and use it to power devastating attacks.",
        stats: { STR: 2, DEX: 2, CON: 2, INT: 4 }
      },
      {
        name: "Dream Phantom",
        description: "A being who exists in the realm between dreams and reality. Can make nightmares real and turn dreams into weapons.",
        stats: { STR: 1, DEX: 3, CON: 2, INT: 4 }
      },
      {
        name: "Void Phantom",
        description: "A being made of pure void energy that can take any form. Can phase through reality and exist in multiple places at once.",
        stats: { STR: 2, DEX: 3, CON: 2, INT: 3 }
      },
      {
        name: "Reality Phantom",
        description: "A being who can phase between different realities. Can bring the impossible into existence and make the real unreal.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Soul Phantom",
        description: "A being who can manipulate and control soul energy. Can drain life force and use it to create powerful constructs.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Cosmic Storm",
        description: "A being who channels the raw power of space itself. Can create black holes, manipulate gravity, and summon cosmic energy.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Mind Breaker",
        description: "A psychic who can shatter minds and drive opponents insane. Can create illusions so real they cause physical harm.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Life Force Master",
        description: "A being who can manipulate the essence of life itself. Can drain vitality from opponents and transfer it to allies.",
        stats: { STR: 2, DEX: 2, CON: 3, INT: 3 }
      },
      {
        name: "Death Walker",
        description: "A being who exists between life and death. Can see the moment of death for all living things and manipulate it.",
        stats: { STR: 2, DEX: 2, CON: 2, INT: 4 }
      },
      {
        name: "Reality Architect",
        description: "A being who can design and build new realities. Can create pocket dimensions and trap opponents in impossible worlds.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Soul Architect",
        description: "A being who can design and reshape souls. Can create new beings from pure soul energy and modify existing ones.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Dream Architect",
        description: "A being who can design and build dream worlds. Can create elaborate nightmares and trap opponents in endless loops.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Void Architect",
        description: "A being who can design and build structures from pure void energy. Can create impossible geometries and void constructs.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Reality Engineer",
        description: "A being who can engineer and modify the fabric of reality. Can create impossible machines and bend the laws of physics.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Soul Engineer",
        description: "A being who can engineer and modify souls. Can create soul-powered machines and modify the essence of life.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Dream Engineer",
        description: "A being who can engineer and modify dreams. Can create dream machines and trap opponents in engineered nightmares.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
      },
      {
        name: "Void Engineer",
        description: "A being who can engineer and modify void energy. Can create void machines and manipulate the emptiness between worlds.",
        stats: { STR: 1, DEX: 2, CON: 2, INT: 5 }
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a creative battle narrator. Create a short, fun, and exciting battle description between two characters.

Character 1: ${playerCharacter.name}
Description: ${playerCharacter.description}
Stats: STR ${playerCharacter.stats?.STR || 1}, DEX ${playerCharacter.stats?.DEX || 1}, CON ${playerCharacter.stats?.CON || 1}, INT ${playerCharacter.stats?.INT || 1}

Character 2: ${aiCharacter.name}
Description: ${aiCharacter.description}
Stats: STR ${aiCharacter.stats?.STR || 1}, DEX ${aiCharacter.stats?.DEX || 1}, CON ${aiCharacter.stats?.CON || 1}, INT ${aiCharacter.stats?.INT || 1}

Please write a short paragraph (2-3 sentences) describing an epic battle between these characters. Include:
1. An exciting opening scene
2. How their abilities and stats interact (STR=physical power, DEX=speed/agility, CON=endurance/defense, INT=magic/tactics)
3. Who wins and why (consider their stats when determining the winner - make it dramatic and fun)
4. Keep it family-friendly and entertaining
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
   * Handle get battle statistics
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

      console.log(`📊 Getting battle statistics for user: ${discordUserId}`);

      // Get battle statistics from Redis
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
}
