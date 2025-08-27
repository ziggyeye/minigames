/**
 * MatchmakingManager - Handles asynchronous turn-based matchmaking system
 * Provides lobby management, match creation, and score-based resolution
 */
export class MatchmakingManager {
  constructor(redisManager, discordManager) {
    this.redisManager = redisManager;
    this.discordManager = discordManager;
    
    // Redis keys for matchmaking data
    this.LOBBIES_KEY = 'breakout:lobbies';
    this.MATCHES_KEY = 'breakout:matches';
    this.PLAYER_MATCHES_KEY = 'breakout:player_matches';
    this.PLAYER_STATS_KEY = 'breakout:player_stats';
    
    // Match states
    this.MATCH_STATES = {
      WAITING: 'waiting',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled'
    };
  }

  /**
   * Create a new lobby/match for a player
   * @param {string} playerName - Player's name
   * @param {number} score - Player's score
   * @param {number} level - Game level
   * @param {string} discordUserId - Discord user ID (optional)
   * @returns {Promise<Object>} Match information
   */
  async createMatch(playerName, score, level = 1, discordUserId = null) {
    try {
      if (!this.redisManager.isReady()) {
        return {
          success: false,
          error: 'Redis not ready'
        };
      }

      // Check if player already has a waiting match
      const playerWaitingKey = `player_waiting:${playerName}`;
      const existingWaitingMatch = await this.redisManager.client.get(playerWaitingKey);
      
      if (existingWaitingMatch) {
        const existingMatch = JSON.parse(existingWaitingMatch);
        console.log(`⚠️  Player ${playerName} already has a waiting match: ${existingMatch.id}`);
        return {
          success: false,
          error: 'Player already has a waiting match',
          existingMatch: existingMatch
        };
      }

      const matchId = this.generateMatchId();
      const timestamp = Date.now();
      
      const match = {
        id: matchId,
        player1: {
          name: playerName,
          score: score,
          level: level,
          discordUserId: discordUserId,
          submittedAt: timestamp
        },
        player2: null,
        state: this.MATCH_STATES.WAITING,
        createdAt: timestamp,
        resolvedAt: null,
        winner: null,
        totalScore: score
      };

      // Initialize player stats if they don't exist
      await this.initializePlayerStats(playerName);

      // Use Redis transaction for atomic creation
      const multi = this.redisManager.client.multi();
      
      // Save match to Redis
      multi.set(`${this.MATCHES_KEY}:${matchId}`, JSON.stringify(match));
      
      // Add to lobbies (waiting matches)
      multi.zAdd(this.LOBBIES_KEY, { score: timestamp, value: matchId });
      
      // Track player's active matches
      multi.sAdd(`${this.PLAYER_MATCHES_KEY}:${playerName}`, matchId);
      
      // Mark player as waiting
      multi.setEx(playerWaitingKey, 3600, JSON.stringify(match)); // Expires in 1 hour
      
      // Execute all operations atomically
      await multi.exec();

      console.log(`🎮 Created match ${matchId} for ${playerName} (score: ${score})`);
      
      return {
        success: true,
        match: match,
        message: 'Match created successfully'
      };

    } catch (error) {
      console.error('❌ Error creating match:', error);
      return {
        success: false,
        error: 'Failed to create match',
        details: error.message
      };
    }
  }

  /**
   * Get list of open lobbies (waiting for opponents)
   * @param {number} limit - Maximum number of lobbies to return
   * @returns {Promise<Array>} Array of open lobbies
   */
  async getOpenLobbies(limit = 10) {
    try {
      if (!this.redisManager.isReady()) {
        console.log('⚠️  Redis not ready, returning empty lobbies');
        return [];
      }

      // Get lobby IDs from sorted set (oldest first)
      const lobbyIds = await this.redisManager.client.zRange(
        this.LOBBIES_KEY,
        0,
        limit - 1
      );

      const lobbies = [];
      
      // Fetch full match data for each lobby
      for (const matchId of lobbyIds) {
        const matchData = await this.redisManager.client.get(
          `${this.MATCHES_KEY}:${matchId}`
        );
        
        if (matchData) {
          const match = JSON.parse(matchData);
          if (match.state === this.MATCH_STATES.WAITING) {
            lobbies.push({
              matchId: match.id,
              player1: match.player1.name,
              player1Score: match.player1.score,
              player1Level: match.player1.level,
              createdAt: match.createdAt,
              waitingTime: Date.now() - match.createdAt
            });
          }
        }
      }

      return lobbies;

    } catch (error) {
      console.error('❌ Error getting open lobbies:', error);
      return [];
    }
  }

  /**
   * Join an existing match as player 2 (Atomic operation with WATCH/MULTI/EXEC)
   * @param {string} matchId - Match ID to join
   * @param {string} playerName - Player's name
   * @param {number} score - Player's score
   * @param {number} level - Game level
   * @param {string} discordUserId - Discord user ID (optional)
   * @returns {Promise<Object>} Match resolution result
   */
  async joinMatch(matchId, playerName, score, level = 1, discordUserId = null) {
  try {
    if (!this.redisManager.isReady()) {
      return {
        success: false,
        error: 'Redis not ready'
      };
    }

    // Use WATCH/MULTI/EXEC for true atomicity
    const maxRetries = 10;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Watch both the match key and lobbies key for changes
        await this.redisManager.client.watch(`${this.MATCHES_KEY}:${matchId}`, this.LOBBIES_KEY);

        // Get the current match state
        const matchData = await this.redisManager.client.get(`${this.MATCHES_KEY}:${matchId}`);
        
        if (!matchData) {
          await this.redisManager.client.unwatch();
          return {
            success: false,
            error: 'Match not found'
          };
        }

        const match = JSON.parse(matchData);

        // Validate match state
        if (match.state !== this.MATCH_STATES.WAITING) {
          await this.redisManager.client.unwatch();
          return {
            success: false,
            error: 'Match is not available for joining'
          };
        }

        // Check if player is trying to join their own match
        if (match.player1.name === playerName) {
          await this.redisManager.client.unwatch();
          return {
            success: false,
            error: 'Cannot join your own match'
          };
        }

        // CRITICAL: Check if match already has a player2 (race condition prevention)
        if (match.player2) {
          await this.redisManager.client.unwatch();
          return {
            success: false,
            error: 'Match is already full'
          };
        }

        // Add a small delay to improve race condition prevention
        await new Promise(resolve => setTimeout(resolve, 10));

        // Initialize player stats if they don't exist
        await this.initializePlayerStats(playerName);

        // Add player 2 to the match
        match.player2 = {
          name: playerName,
          score: score,
          level: level,
          discordUserId: discordUserId,
          submittedAt: Date.now()
        };

        // Resolve the match
        const resolution = this.resolveMatch(match);
        match.state = this.MATCH_STATES.COMPLETED;
        match.resolvedAt = Date.now();
        match.winner = resolution.winner;
        match.totalScore = match.player1.score + match.player2.score;

        // Start transaction
        const multi = this.redisManager.client.multi();
        
        // Update match in Redis
        multi.set(`${this.MATCHES_KEY}:${matchId}`, JSON.stringify(match));
        
        // Remove from lobbies
        multi.zRem(this.LOBBIES_KEY, matchId);
        
        // Track player's completed matches
        multi.sAdd(`${this.PLAYER_MATCHES_KEY}:${playerName}`, matchId);
        multi.sAdd(`${this.PLAYER_MATCHES_KEY}:${match.player1.name}`, matchId);
        
        // Clear waiting status for both players
        multi.del(`player_waiting:${playerName}`);
        multi.del(`player_waiting:${match.player1.name}`);
        
        // Execute transaction
        const results = await multi.exec();
        
        // If transaction succeeded, update stats and notify Discord
        if (results) {
          // Update player stats atomically (outside the main transaction)
          await this.updatePlayerStatsAtomic(resolution.winner, resolution.loser);
          
          console.log(`🎯 Match ${matchId} resolved: ${resolution.winner} wins!`);

          // Notify Discord about match resolution (outside transaction)
          await this.notifyMatchResolution(match, resolution);

          return {
            success: true,
            match: match,
            resolution: resolution,
            message: 'Match joined and resolved successfully'
          };
        }
        
        // Transaction failed, retry
        retryCount++;
        console.log(`🔄 Retry ${retryCount}/${maxRetries} for match ${matchId}`);
        
      } catch (error) {
        await this.redisManager.client.unwatch();
        throw error;
      }
    }

    // Max retries exceeded
    return {
      success: false,
      error: 'Failed to join match after maximum retries',
      details: 'Match state changed during operation'
    };

  } catch (error) {
    console.error('❌ Error joining match:', error);
    return {
      success: false,
      error: 'Failed to join match',
      details: error.message
    };
  }
}

  /**
   * Resolve a match by comparing scores
   * @param {Object} match - Match object
   * @returns {Object} Resolution result
   */
  resolveMatch(match) {
    const player1Score = match.player1.score;
    const player2Score = match.player2.score;

    let winner, loser, winnerScore, loserScore;

    if (player1Score > player2Score) {
      winner = match.player1.name;
      loser = match.player2.name;
      winnerScore = player1Score;
      loserScore = player2Score;
    } else if (player2Score > player1Score) {
      winner = match.player2.name;
      loser = match.player1.name;
      winnerScore = player2Score;
      loserScore = player1Score;
    } else {
      // Tie - winner is determined by level, then by submission time
      if (match.player1.level > match.player2.level) {
        winner = match.player1.name;
        loser = match.player2.name;
        winnerScore = player1Score;
        loserScore = player2Score;
      } else if (match.player2.level > match.player1.level) {
        winner = match.player2.name;
        loser = match.player1.name;
        winnerScore = player2Score;
        loserScore = player1Score;
      } else {
        // Same level - earlier submission wins
        if (match.player1.submittedAt < match.player2.submittedAt) {
          winner = match.player1.name;
          loser = match.player2.name;
          winnerScore = player1Score;
          loserScore = player2Score;
        } else {
          winner = match.player2.name;
          loser = match.player1.name;
          winnerScore = player2Score;
          loserScore = player1Score;
        }
      }
    }

    return {
      winner: winner,
      loser: loser,
      winnerScore: winnerScore,
      loserScore: loserScore,
      isTie: player1Score === player2Score,
      totalScore: player1Score + player2Score
    };
  }

  /**
   * Get player's match history
   * @param {string} playerName - Player's name
   * @param {number} limit - Maximum number of matches to return
   * @returns {Promise<Array>} Array of player's matches
   */
  async getPlayerMatches(playerName, limit = 10) {
    try {
      if (!this.redisManager.isReady()) {
        console.log('⚠️  Redis not ready, returning empty player matches');
        return [];
      }

      // Get player's match IDs
      const matchIds = await this.redisManager.client.sMembers(
        `${this.PLAYER_MATCHES_KEY}:${playerName}`
      );

      const matches = [];
      
      // Fetch match data for each match ID
      for (const matchId of matchIds.slice(0, limit)) {
        const matchData = await this.redisManager.client.get(
          `${this.MATCHES_KEY}:${matchId}`
        );
        
        if (matchData) {
          const match = JSON.parse(matchData);
          matches.push(match);
        }
      }

      // Sort by creation date (newest first)
      matches.sort((a, b) => b.createdAt - a.createdAt);

      return matches;

    } catch (error) {
      console.error('❌ Error getting player matches:', error);
      return [];
    }
  }

  /**
   * Get match details by ID
   * @param {string} matchId - Match ID
   * @returns {Promise<Object|null>} Match details or null
   */
  async getMatchDetails(matchId) {
    try {
      if (!this.redisManager.isReady()) {
        return null;
      }

      const matchData = await this.redisManager.client.get(
        `${this.MATCHES_KEY}:${matchId}`
      );

      return matchData ? JSON.parse(matchData) : null;

    } catch (error) {
      console.error('❌ Error getting match details:', error);
      return null;
    }
  }

  /**
   * Cancel a waiting match
   * @param {string} matchId - Match ID to cancel
   * @param {string} playerName - Player requesting cancellation
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelMatch(matchId, playerName) {
    try {
      const matchData = await this.redisManager.client.get(
        `${this.MATCHES_KEY}:${matchId}`
      );

      if (!matchData) {
        return {
          success: false,
          error: 'Match not found'
        };
      }

      const match = JSON.parse(matchData);

      // Only the creator can cancel the match
      if (match.player1.name !== playerName) {
        return {
          success: false,
          error: 'Only the match creator can cancel the match'
        };
      }

      if (match.state !== this.MATCH_STATES.WAITING) {
        return {
          success: false,
          error: 'Match is no longer waiting'
        };
      }

      // Mark match as cancelled
      match.state = this.MATCH_STATES.CANCELLED;
      match.cancelledAt = Date.now();
      match.cancelledBy = playerName;

      // Update match in Redis
      await this.redisManager.client.set(
        `${this.MATCHES_KEY}:${matchId}`,
        JSON.stringify(match)
      );

      // Remove from lobbies
      await this.redisManager.client.zRem(this.LOBBIES_KEY, matchId);

      console.log(`❌ Match ${matchId} cancelled by ${playerName}`);

      return {
        success: true,
        message: 'Match cancelled successfully'
      };

    } catch (error) {
      console.error('❌ Error cancelling match:', error);
      return {
        success: false,
        error: 'Failed to cancel match',
        details: error.message
      };
    }
  }

  /**
   * Notify Discord about match resolution
   * @param {Object} match - Match object
   * @param {Object} resolution - Match resolution
   */
  async notifyMatchResolution(match, resolution) {
    try {
      if (!this.discordManager.isBotReady()) {
        console.log('⚠️  Discord bot not ready, skipping match notification');
        return;
      }

      const embed = await this.createMatchResolutionEmbed(match, resolution);
      
      // Send the match resolution embed directly to Discord
      const result = await this.discordManager.sendEmbedToDiscord(embed);

      if (result.success) {
        console.log(`📢 Match resolution posted to Discord: ${resolution.winner} vs ${resolution.loser}`);
      } else {
        console.log(`⚠️  Failed to post match resolution to Discord: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Error notifying Discord about match resolution:', error);
    }
  }

  /**
   * Create Discord embed for match resolution
   * @param {Object} match - Match object
   * @param {Object} resolution - Match resolution
   * @returns {Promise<Object>} Discord embed
   */
  async createMatchResolutionEmbed(match, resolution) {
    const winnerEmoji = '🏆';
    const loserEmoji = '🥈';
    
    // Get player stats for the embed
    const winnerStats = await this.getPlayerStats(resolution.winner);
    const loserStats = await this.getPlayerStats(resolution.loser);
    
    const winnerStatsText = winnerStats ? `(${winnerStats.wins}W/${winnerStats.losses}L - ${winnerStats.winRate.toFixed(1)}%)` : '';
    const loserStatsText = loserStats ? `(${loserStats.wins}W/${loserStats.losses}L - ${loserStats.winRate.toFixed(1)}%)` : '';
    
    return {
      color: 0x00ff00,
      title: '⚔️ Match Resolved!',
      description: `**${resolution.winner}** has won the match!`,
      fields: [
        {
          name: `${winnerEmoji} Winner`,
          value: `**${resolution.winner}** - ${resolution.winnerScore} bricks\nLevel ${match.player1.name === resolution.winner ? match.player1.level : match.player2.level} ${winnerStatsText}`,
          inline: true
        },
        {
          name: `${loserEmoji} Runner-up`,
          value: `**${resolution.loser}** - ${resolution.loserScore} bricks\nLevel ${match.player1.name === resolution.loser ? match.player1.level : match.player2.level} ${loserStatsText}`,
          inline: true
        },
        {
          name: '📊 Match Details',
          value: `Match Duration: **${Math.round((match.resolvedAt - match.createdAt) / 1000 / 60)} minutes**\nTotal Bricks: **${resolution.totalScore}**`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Breakout Matchmaking' }
    };
  }

  /**
   * Generate unique match ID
   * @returns {string} Unique match ID
   */
  generateMatchId() {
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize player stats if they don't exist
   * @param {string} playerName - Player's name
   */
  async initializePlayerStats(playerName) {
    try {
      if (!this.redisManager.isReady()) {
        return;
      }

      const statsKey = `${this.PLAYER_STATS_KEY}:${playerName}`;
      const existingStats = await this.redisManager.client.get(statsKey);
      
      if (!existingStats) {
        const initialStats = {
          playerName: playerName,
          wins: 0,
          losses: 0,
          totalMatches: 0,
          winRate: 0,
          createdAt: Date.now(),
          lastUpdated: Date.now()
        };
        
        await this.redisManager.client.set(statsKey, JSON.stringify(initialStats));
        console.log(`📊 Initialized stats for ${playerName}`);
      }
    } catch (error) {
      console.error('❌ Error initializing player stats:', error);
    }
  }

  /**
   * Update player win/loss stats after match resolution (Atomic)
   * @param {string} winner - Winner's name
   * @param {string} loser - Loser's name
   */
  async updatePlayerStats(winner, loser) {
    try {
      if (!this.redisManager.isReady()) {
        return;
      }

      // Update winner stats
      const winnerStatsKey = `${this.PLAYER_STATS_KEY}:${winner}`;
      const winnerStatsData = await this.redisManager.client.get(winnerStatsKey);
      
      if (winnerStatsData) {
        const winnerStats = JSON.parse(winnerStatsData);
        winnerStats.wins += 1;
        winnerStats.totalMatches += 1;
        winnerStats.winRate = (winnerStats.wins / winnerStats.totalMatches) * 100;
        winnerStats.lastUpdated = Date.now();
        
        await this.redisManager.client.set(winnerStatsKey, JSON.stringify(winnerStats));
        console.log(`🏆 Updated winner stats for ${winner}: ${winnerStats.wins}W/${winnerStats.losses}L (${winnerStats.winRate.toFixed(1)}%)`);
      }

      // Update loser stats
      const loserStatsKey = `${this.PLAYER_STATS_KEY}:${loser}`;
      const loserStatsData = await this.redisManager.client.get(loserStatsKey);
      
      if (loserStatsData) {
        const loserStats = JSON.parse(loserStatsData);
        loserStats.losses += 1;
        loserStats.totalMatches += 1;
        loserStats.winRate = (loserStats.wins / loserStats.totalMatches) * 100;
        loserStats.lastUpdated = Date.now();
        
        await this.redisManager.client.set(loserStatsKey, JSON.stringify(loserStats));
        console.log(`😔 Updated loser stats for ${loser}: ${loserStats.wins}W/${loserStats.losses}L (${loserStats.winRate.toFixed(1)}%)`);
      }

    } catch (error) {
      console.error('❌ Error updating player stats:', error);
    }
  }

  /**
   * Update player win/loss stats atomically using Redis transaction
   * @param {string} winner - Winner's name
   * @param {string} loser - Loser's name
   */
  async updatePlayerStatsAtomic(winner, loser) {
    try {
      if (!this.redisManager.isReady()) {
        return;
      }

      // Use WATCH/MULTI/EXEC for true atomicity
      const maxRetries = 5;
      let retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          const winnerStatsKey = `${this.PLAYER_STATS_KEY}:${winner}`;
          const loserStatsKey = `${this.PLAYER_STATS_KEY}:${loser}`;
          
          // Watch both keys for changes
          await this.redisManager.client.watch(winnerStatsKey, loserStatsKey);
          
          // Get current stats
          const winnerStatsData = await this.redisManager.client.get(winnerStatsKey);
          const loserStatsData = await this.redisManager.client.get(loserStatsKey);
          
          // Start transaction
          const multi = this.redisManager.client.multi();
          
          // Update winner stats
          if (winnerStatsData) {
            const winnerStats = JSON.parse(winnerStatsData);
            winnerStats.wins += 1;
            winnerStats.totalMatches += 1;
            winnerStats.winRate = (winnerStats.wins / winnerStats.totalMatches) * 100;
            winnerStats.lastUpdated = Date.now();
            
            multi.set(winnerStatsKey, JSON.stringify(winnerStats));
            console.log(`🏆 Updated winner stats for ${winner}: ${winnerStats.wins}W/${winnerStats.losses}L (${winnerStats.winRate.toFixed(1)}%)`);
          }

          // Update loser stats
          if (loserStatsData) {
            const loserStats = JSON.parse(loserStatsData);
            loserStats.losses += 1;
            loserStats.totalMatches += 1;
            loserStats.winRate = (loserStats.wins / loserStats.totalMatches) * 100;
            loserStats.lastUpdated = Date.now();
            
            multi.set(loserStatsKey, JSON.stringify(loserStats));
            console.log(`😔 Updated loser stats for ${loser}: ${loserStats.wins}W/${loserStats.losses}L (${loserStats.winRate.toFixed(1)}%)`);
          }

          // Execute transaction
          const results = await multi.exec();
          
          // If transaction succeeded, we're done
          if (results) {
            return;
          }
          
          // Transaction failed, retry
          retryCount++;
          console.log(`🔄 Retry ${retryCount}/${maxRetries} for stats update`);
          
        } catch (error) {
          await this.redisManager.client.unwatch();
          throw error;
        }
      }

      console.warn(`⚠️ Failed to update player stats after ${maxRetries} retries`);

    } catch (error) {
      console.error('❌ Error updating player stats atomically:', error);
    }
  }

  /**
   * Get player statistics
   * @param {string} playerName - Player's name
   * @returns {Promise<Object|null>} Player stats or null
   */
  async getPlayerStats(playerName) {
    try {
      if (!this.redisManager.isReady()) {
        return null;
      }

      const statsKey = `${this.PLAYER_STATS_KEY}:${playerName}`;
      const statsData = await this.redisManager.client.get(statsKey);
      
      return statsData ? JSON.parse(statsData) : null;
    } catch (error) {
      console.error('❌ Error getting player stats:', error);
      return null;
    }
  }

  /**
   * Get matchmaking statistics
   * @returns {Promise<Object>} Matchmaking statistics
   */
  async getMatchmakingStats() {
    try {
      if (!this.redisManager.isReady()) {
        return {
          openLobbies: 0,
          totalMatches: 0,
          activePlayers: 0
        };
      }

      const openLobbies = await this.redisManager.client.zCard(this.LOBBIES_KEY);
      
      // Count total matches (this is a simplified approach)
      const matchKeys = await this.redisManager.client.keys(`${this.MATCHES_KEY}:*`);
      const totalMatches = matchKeys.length;

      // Count active players (players with active matches)
      const playerKeys = await this.redisManager.client.keys(`${this.PLAYER_MATCHES_KEY}:*`);
      const activePlayers = playerKeys.length;

      return {
        openLobbies,
        totalMatches,
        activePlayers
      };

    } catch (error) {
      console.error('❌ Error getting matchmaking stats:', error);
      return {
        openLobbies: 0,
        totalMatches: 0,
        activePlayers: 0
      };
    }
  }
}
