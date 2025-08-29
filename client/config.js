// Configuration for different environments
const config = {
    development: {
      serverUrl: 'http://localhost:3001',
      apiEndpoint: '/api/token',
      scoreEndpoint: '/api/score'
    },
    production: {
      serverUrl: '/server',
      apiEndpoint: '/api/token',
      scoreEndpoint: '/api/score'
    }
  };
  
  //https://awbreakout-production.up.railway.app
  
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
    score: getApiUrl(currentConfig.scoreEndpoint)
  };
  
  export default currentConfig;
  