# Environment Setup Guide

## Discord Client ID Configuration

### For Local Development:
1. Create a `.env` file in the client directory with:
```
DISCORD_CLIENT_ID=1410373492049838241
GOOGLE_GENAI_API_KEY=AIzaSyDot7PTPF5hBii9H16BpHGOx6B47FE5HyI
NODE_ENV=development
```

### For Netlify Deployment:
The environment variables are already configured in `netlify.toml`:
- `DISCORD_CLIENT_ID=1410373492049838241`
- `GOOGLE_GENAI_API_KEY=AIzaSyDot7PTPF5hBii9H16BpHGOx6B47FE5HyI`

### Alternative: Netlify Dashboard
You can also set these in your Netlify dashboard:
1. Go to Site settings > Environment variables
2. Add:
   - `DISCORD_CLIENT_ID` = `1410373492049838241`
   - `GOOGLE_GENAI_API_KEY` = `AIzaSyDot7PTPF5hBii9H16BpHGOx6B47FE5HyI`

### Verification:
After deployment, check the browser console for:
- "Discord client ID check: { clientId: '1410...', envKeys: [...] }"
- "Discord SDK initialized with client ID"

If you see "No Discord client ID found, using test mode", the environment variable is not being loaded properly.
