# Environment Variables Setup

This document explains how to set up environment variables for the Breakout game Discord integration.

## Required Environment Variables

### Client-Side Variables (Vite)

These variables are used by the client-side code and must be prefixed with `VITE_`:

```env
VITE_DISCORD_CLIENT_ID=xxx
```

### Server-Side Variables

These variables are used by the server and Netlify functions:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CHANNEL_ID=your_discord_channel_id_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_CLIENT_SECRET=your_discord_client_secret_here
REDIS_URL=your_redis_connection_url_here
```

## Setup Instructions

### 1. Local Development

1. Copy `example.env` to `.env` in the root directory:
   ```bash
   cp example.env .env
   ```

2. Copy `example.env` to `client/.env` for client-side variables:
   ```bash
   cp example.env client/.env
   ```

3. Update the `.env` files with your actual Discord credentials.

### 2. Railway Deployment

Set the following environment variables in your Railway dashboard:

- `DISCORD_TOKEN`
- `CHANNEL_ID`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `REDIS_URL` (automatically set when you add Redis volume)

### 3. Netlify Deployment

Set the following environment variables in your Netlify dashboard:

- `VITE_DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

## Discord Application Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Go to the "OAuth2" section
4. Copy the "Client ID" and "Client Secret"
5. Add your redirect URIs:
   - For local development: `http://localhost:5173`
   - For production: `https://your-domain.netlify.app`

## Security Notes

- Never commit `.env` files to version control
- The `VITE_` prefix makes variables available to client-side code
- Server-side variables are kept private and secure
- Use different Discord applications for development and production

## Troubleshooting

### Common Issues

1. **"DISCORD_CLIENT_ID is required"**: Make sure you've set the environment variable correctly
2. **"Invalid Origin"**: Check that your redirect URIs are configured in Discord
3. **"Client ID not found"**: Verify the client ID matches your Discord application

### Testing

You can test the Discord integration by:
1. Running the game locally with proper environment variables
2. Checking the browser console for Discord SDK messages
3. Using the test functions in `client/test-discord.js`
