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
      const { characterName, description, discordUserId } = req.body;
      
      // Validate required fields
      if (!characterName || !description || !discordUserId) {
        return this.sendErrorResponse(res, 400, 'Missing required fields: characterName, description, and discordUserId are required');
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

      console.log(`🎭 Saving character: ${characterName} for user ${discordUserId}`);

      // Save character to Redis
      const character = {
        characterName: characterName.trim(),
        description: description.trim(),
        discordUserId: discordUserId,
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
      const { playerCharacter, discordUserId } = req.body;
      
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

      console.log(`⚔️ Simulating battle for character: ${playerCharacter.name}`);

      // Generate AI opponent
      const aiCharacter = this.selectRandomAICharacter();
      
      // Simulate battle
      const battleResult = await this.simulateBattle(playerCharacter, aiCharacter);

      const response = {
        success: true,
        playerCharacter: playerCharacter,
        aiCharacter: aiCharacter,
        battleResult: battleResult,
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
      {
        name: "Shadow Blade",
        description: "A mysterious ninja warrior with the ability to teleport through shadows. Master of stealth and assassination techniques. Wields dual katanas and can create shadow clones."
      },
      {
        name: "Thunder Fist",
        description: "A powerful martial artist who can channel electricity through his fists. His punches create thunderous shockwaves and can paralyze opponents. Master of lightning-fast strikes."
      },
      {
        name: "Crystal Guardian",
        description: "A mystical warrior made of living crystal. Can create impenetrable barriers and shoot crystal shards. Immune to most physical attacks and can regenerate from any damage."
      },
      {
        name: "Flame Phoenix",
        description: "A fire elemental with the ability to transform into a phoenix. Can control fire and heat, fly at incredible speeds, and resurrect from ashes. Master of fire magic."
      },
      {
        name: "Iron Titan",
        description: "A massive robot warrior with impenetrable armor. Can transform parts of its body into weapons and has superhuman strength. Immune to most conventional attacks."
      },
      {
        name: "Frost Witch",
        description: "An ice sorceress who can freeze enemies solid and create blizzards. Can walk on water by freezing it and summon ice elementals. Master of cold magic."
      },
      {
        name: "Storm Rider",
        description: "A wind elemental who can fly at supersonic speeds and create tornadoes. Can become intangible like mist and strike with hurricane-force winds."
      },
      {
        name: "Earth Shaker",
        description: "A giant stone warrior who can cause earthquakes and create rock barriers. Can merge with the ground and emerge anywhere. Master of earth magic."
      }
    ];

    return aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a creative battle narrator. Create a short, fun, and exciting battle description between two characters.

Character 1: ${playerCharacter.name}
Description: ${playerCharacter.description}

Character 2: ${aiCharacter.name}
Description: ${aiCharacter.description}

Please write a short paragraph (2-3 sentences) describing an epic battle between these characters. Include:
1. An exciting opening scene
2. How their abilities interact
3. Who wins and why (make it dramatic and fun)
4. Keep it family-friendly and entertaining
5. Resonpose should be in json format. Add "result" field and a "winner" and "loser" field.
6. No ties

Format your result as a single paragraph.`;

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
    const winMatch = json.winner;
    const loseMatch = json.loser;
    
    return {
      scenario: "AI-Generated Battle",
      winner: winMatch,
      loser: loseMatch,
      description: json.result.trim(),
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
