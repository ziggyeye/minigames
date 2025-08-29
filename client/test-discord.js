// Test file for Discord SDK integration
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { API_ENDPOINTS } from './config.js';

// Test function to check Discord SDK
export async function testDiscordSDK() {
  console.log("testDiscordSDK called");
  
  // Check if we're simulating Discord mode
  const isSimulatingDiscord = window.location.search.includes('simulate_discord');
  const isDiscord = window.location.search.includes('frame_id') || isSimulatingDiscord;
  
  console.log("Discord check:", { isDiscord, isSimulatingDiscord });
  
  if (!isDiscord) {
    console.log("Not running in Discord - using test mode");
    return { username: 'TestUser', id: '123' };
  }
  
  if (isSimulatingDiscord) {
    console.log("Simulating Discord mode - using test user");
    return { username: 'TestUser', id: '123' };
  }
  
  // For local testing, try a simpler approach first
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log("Running on localhost - using test user for development");
    return { username: 'TestUser', id: '123' };
  }
  
  try {
    console.log("Initializing Discord SDK...");
    const clientId = process.env.DISCORD_CLIENT_ID;
    
    if (!clientId) {
      console.log("No Discord client ID found, using test user");
      return { username: 'TestUser', id: '123' };
    }
    
    const discordSdk = new DiscordSDK(clientId);
    
    console.log("Discord SDK instance created, waiting for ready...");
    
    // Add a timeout for the ready() call
    const readyPromise = discordSdk.ready();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Discord SDK ready() timed out")), 3000);
    });
    
    await Promise.race([readyPromise, timeoutPromise]);
    console.log("Discord SDK ready");
    
    console.log("Authenticating user...");
   // const { code } = await discordSdk.commands.authenticate();
   const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });
    console.log("User authenticated, got code:", code ? "YES" : "NO");
    
    console.log("Exchanging code for token...");

         // Exchange code for access token via configured endpoint
     const tokenResponse = await fetch(API_ENDPOINTS.token, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ code }),
     });
    const { access_token } = await tokenResponse.json();

    // Authenticate with received token
    const auth = await discordSdk.commands.authenticate({
      access_token,
    });
    

    console.log("Fetching user info...");
    const user = auth.user;
    
    console.log("User info retrieved:", user);
    return user;
    
  } catch (error) {
    console.log("Discord SDK test failed:", error.message);
    
    // Check for specific Discord SDK errors
    if (error.message.includes("timed out")) {
      console.log("Discord SDK timed out - this is expected when not running in Discord");
    } else if (error.message.includes("Invalid Origin")) {
      console.log("Invalid Origin error - expected when not in Discord environment");
    } else if (error.message.includes("frame_id")) {
      console.log("Missing frame_id - expected when not in Discord environment");
    }
    
    return { username: 'Guest Player', id: 'error' };
  }
}

// Make it available globally for testing
window.testDiscordSDK = testDiscordSDK;

// Add a simple test function that doesn't require Discord SDK
export function testDiscordAvailability() {
  console.log("Testing Discord SDK availability...");
  
  try {
    // Check if DiscordSDK is available
    if (typeof DiscordSDK === 'undefined') {
      console.log("DiscordSDK is not available");
      return false;
    }
    
    console.log("DiscordSDK is available");
    
    // Check if we're in a Discord-like environment
    const hasFrameId = window.location.search.includes('frame_id');
    const isInFrame = window.parent !== window;
    const hasDiscordHostname = window.location.hostname.includes('discord');
    
    console.log("Environment check:", { hasFrameId, isInFrame, hasDiscordHostname });
    
    return hasFrameId || isInFrame || hasDiscordHostname;
    
  } catch (error) {
    console.error("Error testing Discord availability:", error);
    return false;
  }
}

// Make it available globally
window.testDiscordAvailability = testDiscordAvailability;
