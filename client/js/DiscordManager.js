/**
 * DiscordManager - Handles Discord SDK integration and user management
 * Provides a clean interface for Discord functionality with proper error handling
 */
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { testDiscordSDK, testDiscordAvailability } from '../test-discord.js';

export class DiscordManager {
  constructor() {
    this.discordSdk = null;
    this.currentUser = null;
    this.isDiscord = this.detectDiscordEnvironment();
    this.setupTimeout = null;
    this.isInitialized = false;
  }

  /**
   * Detect if the app is running in Discord environment
   * @returns {boolean} True if running in Discord
   */
  detectDiscordEnvironment() {
    const indicators = {
      hasFrameId: window.location.search.includes('frame_id'),
      hasDiscord: window.location.search.includes('discord'),
      hostname: window.location.hostname.includes('discord'),
      isInFrame: window.parent !== window,
      simulateDiscord: window.location.search.includes('simulate_discord'),
      hasDiscordOrigin: window.location.origin.includes('discord.com') || window.location.origin.includes('discordapp.com')
    };

    const isDiscord = Object.values(indicators).some(Boolean);
    
    console.log("Discord detection check:", { ...indicators, isDiscord });
    return isDiscord;
  }

  /**
   * Initialize Discord SDK and user setup
   * @returns {Promise<Object>} User object
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("DiscordManager already initialized");
      return this.currentUser;
    }

    if (!this.isDiscord) {
      console.log("Running in local mode — Discord APIs disabled.");
      this.currentUser = { id: '1234', username: 'TestUser2' };
      this.discordSdk = null;
      
      // Clear global DiscordSDK when not in Discord environment
      window.DiscordSDK = null;
      
      this.isInitialized = true;
      return this.currentUser;
    }

    console.log("Running in Discord mode — initializing SDK");
    await this.setupDiscordSDK();
    this.isInitialized = true;
    return this.currentUser;
  }

  /**
   * Setup Discord SDK with error handling
   */
  async setupDiscordSDK() {
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      console.log('Discord client ID check:', { 
        clientId: clientId ? `${clientId.substring(0, 4)}...` : 'not found',
        envKeys: Object.keys(process.env).filter(key => key.includes('DISCORD'))
      });
      
      if (!clientId) {
        console.warn("No Discord client ID found, using test mode");
        console.log("Available env vars:", Object.keys(process.env).filter(key => key.includes('DISCORD')));
        this.currentUser = { id: 'no_client_id', username: 'TestUser' };
        this.discordSdk = null;
        
        // Clear global DiscordSDK when no client ID
        window.DiscordSDK = null;
        
        return;
      }
      
      this.discordSdk = new DiscordSDK(clientId);
      
      // Set global DiscordSDK for purchase flow access
      window.DiscordSDK = this.discordSdk;
      
      console.log("Discord SDK initialized with client ID");
    } catch (error) {
      console.error("Failed to initialize Discord SDK:", error);
      this.currentUser = { id: 'discord_error', username: 'TestUser' };
      this.discordSdk = null;
      
      // Clear global DiscordSDK if initialization failed
      window.DiscordSDK = null;
      
      return;
    }

    await this.setupDiscordUser();
  }

  /**
   * Setup Discord user with timeout and error handling
   */
  async setupDiscordUser() {
    this.setupTimeout = setTimeout(() => {
      console.log("Discord setup timed out, using fallback user");
      if (!this.currentUser) {
        this.currentUser = { id: 'timeout', username: 'TestUser' };
      }
    }, 3000); // Reduced timeout to 3 seconds

    try {
      await this.performDiscordSetup();
    } catch (error) {
      console.log("Discord setup failed, using fallback user:", error.message);
      if (!this.currentUser) {
        this.currentUser = { id: 'error', username: 'Guest Player' };
      }
    } finally {
      if (this.setupTimeout) {
        clearTimeout(this.setupTimeout);
      }
    }
  }

  /**
   * Perform the actual Discord user setup
   */
  async performDiscordSetup() {
    console.log("Starting Discord setup...");
    
    if (!this.discordSdk) {
      console.log("Discord SDK not available, using test user");
      this.currentUser = { id: 'test', username: 'TestUser' };
      return;
    }
    
    const isAvailable = testDiscordAvailability();
    console.log("Discord availability check:", isAvailable);
    
    if (!isAvailable) {
      console.log("Discord not available, using test user");
      this.currentUser = { id: 'test', username: 'TestUser' };
      return;
    }
    
    try {
      this.currentUser = await testDiscordSDK();
      console.log("Discord setup complete. User:", this.currentUser.username);
    } catch (error) {
      console.log("Discord setup failed, using fallback:", error.message);
      this.currentUser = { id: 'error', username: 'Guest Player' };
    }
  }

  /**
   * Get current user information
   * @returns {Object} Current user object
   */
  getCurrentUser() {
    return this.currentUser || { id: 'fallback', username: 'TestUser' };
  }

  /**
   * Get current username for display
   * @returns {string} Username to display
   */
  getCurrentUserName() {
    const user = this.getCurrentUser();
    return user && user ? user.global_name : 'Player';
  }

  /**
   * Update user display in the game UI
   * @param {Object} gameScene - Reference to the game scene
   */
  updateUserDisplay(gameScene) {
    const username = this.getCurrentUserName();
    console.log(`Welcome, ${username}!`);
    
    if (gameScene && gameScene.playerNameText) {
      gameScene.playerNameText.setText(`Player: ${username}`);
    }
    
    return username;
  }

  /**
   * Get Discord user ID for API calls
   * @returns {string|null} Discord user ID or null
   */
  getDiscordUserId() {
    const user = this.getCurrentUser();
    return user && user.id && user.id !== 'manual' ? user.id : null;
  }

  /**
   * Check if running in Discord environment
   * @returns {boolean} True if in Discord
   */
  isInDiscord() {
    return this.isDiscord;
  }

  /**
   * Get debugging functions for development
   * @returns {Object} Debug functions
   */
  getDebugFunctions() {
    return {
      getCurrentUser: () => this.currentUser,
      testDiscordSDK: testDiscordSDK,
      testDiscordAvailability: testDiscordAvailability,
      isDiscord: this.isDiscord,
      discordSdk: this.discordSdk,
      forceSetup: () => {
        console.log("Forcing Discord setup...");
        if (this.discordSdk) {
          this.performDiscordSetup().catch(console.error);
        } else {
          console.log("No Discord SDK available");
        }
      },
      setTestUser: () => {
        this.currentUser = { id: 'manual', username: 'TestUser' };
        console.log("Manually set test user:", this.currentUser);
      }
    };
  }
}

// Default export for backward compatibility
export default DiscordManager;
