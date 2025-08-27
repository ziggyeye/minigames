# Discord Integration Setup

This minigames has been configured to run as a Discord Activity with user authentication.

## Features

- **Discord SDK Integration**: The game automatically detects when running in Discord
- **User Authentication**: Gets the current user's Discord username
- **Fallback Mode**: Works in local development without Discord
- **User Display**: Shows the player's name on the start screen

## Setup Instructions

### 1. Environment Variables

For detailed environment variable setup, see [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md).

Create a `.env` file in the root directory with your Discord application credentials:

```env
VITE_DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
```

### 2. Discord Application Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or use an existing one
3. Get your Client ID and Client Secret
4. Add the redirect URI: `http://localhost:3001/api/token` (for development)

### 3. Running the Game

#### Development Mode
```bash
# Terminal 1: Start the server
cd server
npm install
npm start

# Terminal 2: Start the client
cd client
npm install
npm run dev
```

#### Discord Activity Mode
When running as a Discord Activity, the game will:
- Automatically authenticate the user
- Display their Discord username
- Use Discord's embedded app SDK

## How It Works

### Discord Detection
The game checks if it's running in Discord by looking for `frame_id` in the URL:
```javascript
const isDiscord = window.location.search.includes('frame_id');
```

### User Authentication Flow
1. **SDK Initialization**: Creates DiscordSDK instance with your app ID
2. **User Authentication**: Calls `discordSdk.commands.authenticate()`
3. **Token Exchange**: Sends auth code to your server
4. **User Info**: Fetches user details from Discord API

### Fallback Mode
When not running in Discord:
- Uses a test user: "TestUser"
- All game functionality works normally
- No authentication required

## API Endpoints

### Server Endpoint
- **POST** `/api/token` - Exchanges Discord auth code for access token

## Functions Available

### `getCurrentUserName()`
Returns the current user's Discord username or "Player" as fallback.

### `testDiscordSDK()`
Test function to verify Discord SDK integration.

## Testing

You can test the Discord integration by:

1. **Local Testing**: Run in development mode to see fallback behavior
2. **Discord Testing**: Deploy to Discord and test as an Activity
3. **Console Logs**: Check browser console for authentication status

## Troubleshooting

### Common Issues

1. **"Error loading user"**: Check your Discord credentials in `.env`
2. **CORS errors**: Ensure server is running on correct port
3. **Authentication fails**: Verify Discord app settings and redirect URIs

### Debug Mode
Enable debug logging by checking the browser console for:
- "Discord SDK ready"
- "User authenticated" 
- "Logged in as: [username]"

## Security Notes

- Never expose your Discord Client Secret in client-side code
- Always use environment variables for sensitive data
- The server handles token exchange securely
- User data is only used for display purposes
