// Configuration for different environments
const config = {
    development: {
      serverUrl: 'http://localhost:3001',
      apiEndpoint: '/api/token',
      scoreEndpoint: '/api/score',
      saveCharacterEndpoint: '/api/saveCharacter',
      getUserCharactersEndpoint: '/api/characters/:discordUserId',
      deleteCharacterEndpoint: '/api/characters/delete',
      battleSimulationEndpoint: '/api/battle/simulate',
      battleStatsEndpoint: '/api/battle/stats/:discordUserId',
      characterBattleStatsEndpoint: '/api/battle/stats/:discordUserId/:characterName',
      addBattleGemsEndpoint: '/api/battleGems/add',
      getBattleGemsEndpoint: '/api/battleGems/:discordUserId'
    },
    production: {
      serverUrl: '/server',
      apiEndpoint: '/api/token',
      scoreEndpoint: '/api/score',
      saveCharacterEndpoint: '/api/saveCharacter',
      getUserCharactersEndpoint: '/api/characters/:discordUserId',
      deleteCharacterEndpoint: '/api/characters/delete',
      battleSimulationEndpoint: '/api/battle/simulate',
      battleStatsEndpoint: '/api/battle/stats/:discordUserId',
      characterBattleStatsEndpoint: '/api/battle/stats/:discordUserId/:characterName',
      addBattleGemsEndpoint: '/api/battleGems/add',
      getBattleGemsEndpoint: '/api/battleGems/:discordUserId'
    }
  };

  // Determine current environment
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
  
  const currentConfig = isDevelopment ? config.development : config.production;
  
  // Build the full API URL
  export const getApiUrl = (endpoint) => {
    return `${currentConfig.serverUrl}${endpoint}`;
  };
  
  export const API_ENDPOINTS = {
    token: getApiUrl(currentConfig.apiEndpoint),
    score: getApiUrl(currentConfig.scoreEndpoint),
    saveCharacter: getApiUrl(currentConfig.saveCharacterEndpoint),
    getUserCharacters: getApiUrl(currentConfig.getUserCharactersEndpoint),
    deleteCharacter: getApiUrl(currentConfig.deleteCharacterEndpoint),
    battleSimulation: getApiUrl(currentConfig.battleSimulationEndpoint),
    battleStats: getApiUrl(currentConfig.battleStatsEndpoint),
    characterBattleStats: getApiUrl(currentConfig.characterBattleStatsEndpoint),
    addBattleGems: getApiUrl(currentConfig.addBattleGemsEndpoint),
    getBattleGems: getApiUrl(currentConfig.getBattleGemsEndpoint)
  };
  
  export default currentConfig;
  