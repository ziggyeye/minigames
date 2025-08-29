// Test script to verify environment variables
console.log('Environment Variables Test:');
console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? `${process.env.DISCORD_CLIENT_ID.substring(0, 4)}...` : 'NOT FOUND');
console.log('GOOGLE_GENAI_API_KEY:', process.env.GOOGLE_GENAI_API_KEY ? `${process.env.GOOGLE_GENAI_API_KEY.substring(0, 10)}...` : 'NOT FOUND');
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check all Discord-related env vars
const discordVars = Object.keys(process.env).filter(key => key.includes('DISCORD'));
console.log('All Discord env vars:', discordVars);
