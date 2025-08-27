import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

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
});
