import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS with Discord-specific settings
app.use(cors({
    origin: [
        'https://discord.com',
        'https://discordapp.com',
        'https://*.discordsays.com',
        'https://*.discord.com',
        'http://localhost:3000',
        'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Add Discord-compatible headers
app.use((req, res, next) => {
    // Allow embedding in Discord iframes
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    // Set Content Security Policy for Discord
    res.setHeader('Content-Security-Policy', 
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "frame-ancestors 'self' https://discord.com https://discordapp.com https://*.discordsays.com https://*.discord.com; " +
        "img-src 'self' data: blob: https:; " +
        "media-src 'self' data: blob: https:; " +
        "connect-src 'self' https: ws: wss:;"
    );
    
    // Additional headers for Discord compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    next();
});

// Serve static files
app.use(express.static(__dirname));

// Serve circus game assets
app.use('/circus/assets', express.static(path.join(__dirname, 'circus/assets')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/circus', (req, res) => {
    res.sendFile(path.join(__dirname, 'circus/index.html'));
});

// API proxy to backend server
app.use('/api', async (req, res) => {
    try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}${req.url}`, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                ...req.headers
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('API proxy error:', error);
        res.status(500).json({ error: 'Failed to connect to backend server' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'discord-minigames-client'
    });
});

// Handle 404 - serve index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎮 Discord Minigames Client running on http://localhost:${PORT}`);
    console.log(`🎪 Circus Game: http://localhost:${PORT}/circus`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔧 Discord iframe embedding enabled`);
});
