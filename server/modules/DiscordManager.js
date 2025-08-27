import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

/**
 * DiscordManager - Handles Discord bot operations and score posting
 * Provides centralized Discord functionality with proper error handling
 */
export class DiscordManager {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.channelId = null;
    this.matchmakingManager = null;
  }

  /**
   * Initialize Discord bot
   * @param {string} token - Discord bot token
   * @param {string} channelId - Discord channel ID for posting scores
   * @param {MatchmakingManager} matchmakingManager - Matchmaking manager instance
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize(token, channelId, matchmakingManager = null) {
    try {
      console.log('🤖 Initializing Discord bot...');
      
      this.channelId = channelId;
      this.matchmakingManager = matchmakingManager;
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });

      this.setupEventHandlers();
      await this.login(token);
      
      return this.isReady;
    } catch (error) {
      console.error('❌ Failed to initialize Discord bot:', error.message);
      return false;
    }
  }

  /**
   * Setup Discord event handlers
   */
  setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`✅ Discord bot logged in as ${this.client.user.tag}`);
      this.isReady = true;
    });

    this.client.on('error', (error) => {
      console.error('❌ Discord bot error:', error);
      this.isReady = false;
    });

    this.client.on('disconnect', () => {
      console.log('🔌 Discord bot disconnected');
      this.isReady = false;
    });

    // Handle message commands
    this.client.on('messageCreate', this.handleMessage.bind(this));
  }

  /**
   * Handle incoming Discord messages for commands
   * @param {Object} message - Discord message object
   */
  async handleMessage(message) {
    // Ignore bot messages and messages not in the target channel
    if (message.author.bot || message.channelId !== this.channelId) {
      return;
    }

    const content = message.content.toLowerCase().trim();
    
    // Command: !matches <playerName> - Get player's match history
    if (content.startsWith('!matches ')) {
      const playerName = message.content.substring(9).trim();
      if (playerName) {
        await this.handleMatchesCommand(message, playerName);
      } else {
        await message.reply('❌ Please provide a player name: `!matches <playerName>`');
      }
      return;
    }

    // Command: !stats - Get matchmaking statistics
    if (content === '!stats') {
      await this.handleStatsCommand(message);
      return;
    }

    // Command: !cancel <matchId> - Cancel a match
    if (content.startsWith('!cancel ')) {
      const matchId = message.content.substring(9).trim();
      if (matchId) {
        await this.handleCancelCommand(message, matchId);
      } else {
        await message.reply('❌ Please provide a match ID: `!cancel <matchId>`');
      }
      return;
    }

    // Command: !help - Show available commands
    if (content === '!help') {
      await this.handleHelpCommand(message);
      return;
    }
  }

  /**
   * Handle !matches command
   * @param {Object} message - Discord message object
   * @param {string} playerName - Player name to get matches for
   */
  async handleMatchesCommand(message, playerName) {
    try {
      if (!this.matchmakingManager) {
        await message.reply('❌ Matchmaking system not available');
        return;
      }

      const matches = await this.matchmakingManager.getPlayerMatches(playerName, 10);
      const playerStats = await this.matchmakingManager.getPlayerStats(playerName);
      
      if (matches.length === 0) {
        await message.reply(`📭 No matches found for **${playerName}**`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🎮 Match History for ${playerName}`)
        .setDescription(`Found ${matches.length} matches`)
        .setTimestamp()
        .setFooter({ text: 'Breakout Matchmaking' });

      // Add player stats if available
      if (playerStats) {
        embed.addFields({
          name: '📊 Player Statistics',
          value: `**Wins:** ${playerStats.wins}\n**Losses:** ${playerStats.losses}\n**Total Matches:** ${playerStats.totalMatches}\n**Win Rate:** ${playerStats.winRate.toFixed(1)}%`,
          inline: false
        });
      }

      // Add match fields (limit to 10 due to Discord embed limits)
      matches.slice(0, 10).forEach((match, index) => {
        const status = match.state === 'completed' ? '✅' : match.state === 'waiting' ? '⏳' : '❌';
        const matchId = match.id.substring(0, 8) + '...';
        
        let fieldValue = `**Status:** ${status} ${match.state}\n`;
        fieldValue += `**Player 1:** ${match.player1.name} (${match.player1.score} bricks, Level ${match.player1.level})\n`;
        
        if (match.player2) {
          fieldValue += `**Player 2:** ${match.player2.name} (${match.player2.score} bricks, Level ${match.player2.level})\n`;
          if (match.winner) {
            fieldValue += `**Winner:** ${match.winner}\n`;
          }
        } else {
          fieldValue += `**Waiting for opponent...**\n`;
        }
        
        fieldValue += `**Created:** ${new Date(match.createdAt).toLocaleDateString()}`;
        
        embed.addFields({
          name: `Match ${index + 1} (${matchId})`,
          value: fieldValue,
          inline: false
        });
      });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Error handling matches command:', error);
      await message.reply('❌ Failed to get match history');
    }
  }

  /**
   * Handle !stats command
   * @param {Object} message - Discord message object
   */
  async handleStatsCommand(message) {
    try {
      if (!this.matchmakingManager) {
        await message.reply('❌ Matchmaking system not available');
        return;
      }

      const stats = await this.matchmakingManager.getMatchmakingStats();
      
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📊 Breakout Matchmaking Statistics')
        .setDescription('Current system status and activity')
        .addFields(
          { name: '🎮 Open Lobbies', value: stats.openLobbies.toString(), inline: true },
          { name: '📈 Total Matches', value: stats.totalMatches.toString(), inline: true },
          { name: '👥 Active Players', value: stats.activePlayers.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Breakout Matchmaking' });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Error handling stats command:', error);
      await message.reply('❌ Failed to get matchmaking statistics');
    }
  }

  /**
   * Handle !cancel command
   * @param {Object} message - Discord message object
   * @param {string} matchId - Match ID to cancel
   */
  async handleCancelCommand(message, matchId) {
    try {
      if (!this.matchmakingManager) {
        await message.reply('❌ Matchmaking system not available');
        return;
      }

      // Get match details first to check ownership
      const match = await this.matchmakingManager.getMatchDetails(matchId);
      
      if (!match) {
        await message.reply('❌ Match not found');
        return;
      }

      if (match.state !== 'waiting') {
        await message.reply('❌ Can only cancel waiting matches');
        return;
      }

      // Check if the user is the match creator
      const discordUserId = message.author.id;
      const isCreator = match.player1.discordUserId === discordUserId;
      
      if (!isCreator) {
        await message.reply('❌ You can only cancel your own matches');
        return;
      }

      const result = await this.matchmakingManager.cancelMatch(matchId, match.player1.name);
      
      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Match Cancelled')
          .setDescription(`Match **${matchId.substring(0, 8)}...** has been cancelled`)
          .addFields(
            { name: 'Cancelled by', value: match.player1.name, inline: true },
            { name: 'Match ID', value: matchId.substring(0, 8) + '...', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Breakout Matchmaking' });

        await message.reply({ embeds: [embed] });
      } else {
        await message.reply(`❌ Failed to cancel match: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Error handling cancel command:', error);
      await message.reply('❌ Failed to cancel match');
    }
  }

  /**
   * Handle !help command
   * @param {Object} message - Discord message object
   */
  async handleHelpCommand(message) {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🎮 Breakout Matchmaking Commands')
      .setDescription('Available Discord bot commands')
      .addFields(
        { 
          name: '!matches <playerName>', 
          value: 'Get match history for a player', 
          inline: false 
        },
        { 
          name: '!stats', 
          value: 'Show matchmaking system statistics', 
          inline: false 
        },
        { 
          name: '!cancel <matchId>', 
          value: 'Cancel your waiting match (match creator only)', 
          inline: false 
        },
        { 
          name: '!help', 
          value: 'Show this help message', 
          inline: false 
        }
      )
      .addFields({
        name: '📝 How to Play',
        value: '1. Play Breakout and submit your score\n2. System automatically creates or joins matches\n3. Wait for opponents to join your matches\n4. Check your match history with `!matches <yourName>`',
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: 'Breakout Matchmaking' });

    await message.reply({ embeds: [embed] });
  }

  /**
   * Login to Discord
   * @param {string} token - Discord bot token
   * @returns {Promise<boolean>} True if login successful
   */
  async login(token) {
    try {
      await this.client.login(token);
      return true;
    } catch (error) {
      console.error('❌ Failed to login to Discord:', error.message);
      return false;
    }
  }

  /**
   * Check if Discord bot is ready
   * @returns {boolean} True if bot is ready
   */
  isBotReady() {
    return this.client && this.isReady;
  }

  /**
   * Get Discord user information
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object|null>} Discord user object or null
   */
  async getDiscordUser(userId) {
    try {
      if (!this.isBotReady()) {
        console.log('⚠️  Discord bot not ready, cannot fetch user');
        return null;
      }

      const user = await this.client.users.fetch(userId);
      console.log(`✅ Found Discord user: ${user.tag}`);
      return user;
    } catch (error) {
      console.log(`⚠️  Could not fetch Discord user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Create Discord embed for score posting
   * @param {Object} scoreData - Score data object
   * @param {Array} topScores - Top 5 high scores
   * @param {Object} discordUser - Discord user object (optional)
   * @returns {EmbedBuilder} Discord embed
   */
  createScoreEmbed(scoreData, topScores = [], discordUser = null) {
    const { playerName, score, level, gameType } = scoreData;

    // Determine game-specific details
    let gameTitle, gameEmoji, scoreField, footerText;
    
    switch (gameType) {
      case 'circus':
        gameTitle = '🎪 Circus Game Score!';
        gameEmoji = '🎈';
        scoreField = '🎈 Balloons Popped';
        footerText = 'Circus Game';
        break;
      case 'breakout':
        gameTitle = '🎮 Breakout Score!';
        gameEmoji = '🧱';
        scoreField = '🧱 Bricks Destroyed';
        footerText = 'Breakout Game';
        break;
      default:
        gameTitle = '🎮 Game Score!';
        gameEmoji = '🏆';
        scoreField = 'Score';
        footerText = 'Minigames';
    }

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle(gameTitle)
      .setDescription(`**${playerName}** just completed a game!`)
      .addFields(
        { name: scoreField, value: score.toString(), inline: true },
        { name: 'Level', value: level ? level.toString() : 'N/A', inline: true },
      )
      .setTimestamp()
      .setFooter({ text: footerText });

    // Add Discord username if available
    if (discordUser) {
      embed.addFields({ 
        name: 'Discord User', 
        value: `${discordUser.tag}`, 
        inline: false 
      });
      
      // Set user avatar if available
      if (discordUser.avatarURL()) {
        embed.setThumbnail(discordUser.avatarURL());
      }
    }

    // Add top 5 scores to the embed
    if (topScores.length > 0) {
      let topScoresText = '';
      topScores.forEach((scoreData, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        const scoreText = gameType === 'circus' ? 'balloons' : 'bricks';
        topScoresText += `${medal} **${scoreData.playerName}**: ${scoreData.score} ${scoreText} (Level ${scoreData.level})\n`;
      });
      
      embed.addFields({
        name: `🏆 Top 5 ${gameType === 'circus' ? 'Balloon Poppers' : 'Brick Destroyers'}`,
        value: topScoresText,
        inline: false
      });
    }

    return embed;
  }

  /**
   * Send a custom embed to Discord channel
   * @param {Object} embed - Discord embed object
   * @returns {Promise<Object>} Result object
   */
  async sendEmbedToDiscord(embed) {
    try {
      if (!this.isBotReady()) {
        return { success: false, error: 'Discord bot not ready' };
      }

      console.log(`📤 Attempting to send embed to channel: ${this.channelId}`);

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        return { success: false, error: 'Discord channel not found' };
      }

      if (!channel.isTextBased()) {
        return { success: false, error: 'Channel is not a text channel' };
      }

      // Check if bot has permission to send messages
      const permissions = channel.permissionsFor(this.client.user);
      if (!permissions.has('SendMessages')) {
        return { success: false, error: 'Bot lacks permission to send messages' };
      }

      await channel.send({ embeds: [embed] });
      console.log(`✅ Custom embed sent to Discord successfully`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error sending embed to Discord:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post score to Discord channel
   * @param {Object} scoreData - Score data object
   * @param {Array} topScores - Top 5 high scores
   * @param {string} discordUserId - Discord user ID (optional)
   * @returns {Promise<Object>} Result object with success status and message
   */
  async postScoreToDiscord(scoreData, topScores = [], discordUserId = null) {
    try {
      if (!this.isBotReady()) {
        return {
          success: false,
          error: 'Discord bot is not ready'
        };
      }

      console.log(`📤 Attempting to post score to channel: ${this.channelId}`);

      // Get Discord user information if provided
      let discordUser = null;
      if (discordUserId) {
        discordUser = await this.getDiscordUser(discordUserId);
      }

      // Create embed
      const embed = this.createScoreEmbed(scoreData, topScores, discordUser);

      // Get Discord channel
      const channel = await this.client.channels.fetch(this.channelId);
      
      if (!channel) {
        return {
          success: false,
          error: 'Discord channel not found'
        };
      }

      if (!channel.isTextBased()) {
        return {
          success: false,
          error: 'Channel is not a text channel'
        };
      }

      // Check bot permissions
      const permissions = channel.permissionsFor(this.client.user);
      if (!permissions.has('SendMessages')) {
        return {
          success: false,
          error: 'Bot lacks permission to send messages'
        };
      }

      // Send the embed
      await channel.send({ embeds: [embed] });
      
      const userTag = discordUser ? ` (${discordUser.tag})` : '';
      console.log(`✅ Score posted to Discord: ${scoreData.playerName} - ${scoreData.score}${userTag}`);
      
      return {
        success: true,
        message: 'Score posted to Discord successfully'
      };

    } catch (error) {
      console.error('❌ Error posting score to Discord:', error);
      
      if (error.code === 10003) {
        return {
          success: false,
          error: 'Invalid channel ID or bot lacks access to channel',
          details: 'Make sure the channel ID is correct and the bot is in the server'
        };
      }
      
      return {
        success: false,
        error: 'Failed to post score to Discord',
        details: error.message
      };
    }
  }

  /**
   * Get Discord bot status
   * @returns {Object} Bot status information
   */
  getStatus() {
    return {
      isReady: this.isReady,
      isConnected: this.client ? this.client.isReady() : false,
      userTag: this.client?.user?.tag || null,
      channelId: this.channelId
    };
  }

  /**
   * Disconnect Discord bot
   */
  async disconnect() {
    if (this.client) {
      this.client.destroy();
      console.log('🔌 Discord bot disconnected');
    }
  }
}
