/**
 * Config - Handles environment variable validation and configuration management
 * Provides centralized configuration with proper validation and error handling
 */
export class Config {
  constructor() {
    this.requiredEnvVars = [
      'DISCORD_TOKEN',
      'CHANNEL_ID', 
      'DISCORD_CLIENT_ID',
      'DISCORD_CLIENT_SECRET',
      'REDIS_URL'
    ];
    
    this.config = {};
  }

  /**
   * Load and validate configuration from environment variables
   * @returns {Object} Configuration object
   * @throws {Error} If required environment variables are missing
   */
  load() {
    console.log('⚙️  Loading configuration...');
    
    // Load all required environment variables
    for (const envVar of this.requiredEnvVars) {
      const value = process.env[envVar];
      
      if (!value) {
        const error = `${envVar} is required in environment variables`;
        console.error(`❌ Configuration error: ${error}`);
        throw new Error(error);
      }
      
      this.config[envVar] = value;
      console.log(`✅ ${envVar}: ${this.maskSensitiveValue(envVar, value)}`);
    }

    // Load optional configuration
    this.config.PORT = process.env.PORT || 3001;
    this.config.NODE_ENV = process.env.NODE_ENV || 'development';
    this.config.RAILWAY_ENVIRONMENT = !!process.env.RAILWAY_ENVIRONMENT;

    console.log(`✅ PORT: ${this.config.PORT}`);
    console.log(`✅ NODE_ENV: ${this.config.NODE_ENV}`);
    console.log(`✅ Railway Environment: ${this.config.RAILWAY_ENVIRONMENT ? 'Yes' : 'No'}`);
    
    console.log('✅ Configuration loaded successfully');
    return this.config;
  }

  /**
   * Mask sensitive values for logging
   * @param {string} key - Configuration key
   * @param {string} value - Configuration value
   * @returns {string} Masked value
   */
  maskSensitiveValue(key, value) {
    if (key.includes('TOKEN') || key.includes('SECRET')) {
      return value.substring(0, 8) + '...';
    }
    if (key === 'REDIS_URL') {
      return value.substring(0, 20) + '...';
    }
    return value;
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @returns {string} Configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Get all configuration
   * @returns {Object} Configuration object
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Check if running in production
   * @returns {boolean} True if in production
   */
  isProduction() {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Check if running in Railway
   * @returns {boolean} True if in Railway environment
   */
  isRailway() {
    return this.config.RAILWAY_ENVIRONMENT;
  }

  /**
   * Validate Discord configuration
   * @returns {Object} Discord configuration object
   */
  getDiscordConfig() {
    return {
      token: this.config.DISCORD_TOKEN,
      channelId: this.config.CHANNEL_ID,
      clientId: this.config.DISCORD_CLIENT_ID,
      clientSecret: this.config.DISCORD_CLIENT_SECRET
    };
  }

  /**
   * Get Redis configuration
   * @returns {Object} Redis configuration object
   */
  getRedisConfig() {
    return {
      url: this.config.REDIS_URL
    };
  }

  /**
   * Get server configuration
   * @returns {Object} Server configuration object
   */
  getServerConfig() {
    return {
      port: this.config.PORT,
      nodeEnv: this.config.NODE_ENV,
      isRailway: this.config.RAILWAY_ENVIRONMENT
    };
  }
}
