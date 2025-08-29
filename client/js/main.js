import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import CircusScene from './scenes/CircusScene.js';
import BattleAIScene from './scenes/BattleAIScene.js';

// Check if we're in Discord iframe
const isDiscord = window.location.href.includes('discord.com') || 
                 window.parent !== window || 
                 window.location.href.includes('discordapp.com');

// Game configuration
const config = {
    type: Phaser.AUTO,
    parent: 'gameContainer',
    width: 720,
    height: 1280,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720,
        height: 1280,
        min: {
        width: 360,
        height: 640
        },
        max: {
        width: 1440,
        height: 2560
        }
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: [MenuScene, CircusScene, BattleAIScene],
    backgroundColor: '#34495e',
    pixelArt: false,
    roundPixels: false
};

// Initialize the game
class DiscordMinigames {
    constructor() {
        this.game = null;
        this.init();
    }

    init() {
        try {
            // Hide loading screen
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }

            // Create the game instance
            this.game = new Phaser.Game(config);

            // Handle Discord iframe specific issues
            if (isDiscord) {
                console.log('Running in Discord environment');
                this.handleDiscordEnvironment();
            }

            console.log('Discord Minigames initialized with Phaser 3');
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError('Failed to load game. Please refresh the page.');
        }
    }

    handleDiscordEnvironment() {
        // Force a repaint to ensure content is visible in Discord
        setTimeout(() => {
            if (this.game && this.game.canvas) {
                this.game.canvas.style.display = 'none';
                this.game.canvas.offsetHeight; // Trigger reflow
                this.game.canvas.style.display = 'block';
            }
        }, 100);

        // Handle Discord iframe focus issues
        window.addEventListener('focus', () => {
            if (this.game && this.game.scene.isActive('MenuScene')) {
                this.game.scene.getScene('MenuScene').resume();
            }
        });

        window.addEventListener('blur', () => {
            if (this.game && this.game.scene.isActive('MenuScene')) {
                this.game.scene.getScene('MenuScene').pause();
            }
        });
    }

    showError(message) {
        const gameContainer = document.getElementById('gameContainer');
        gameContainer.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                font-family: 'Segoe UI', sans-serif;
            ">
                <div>
                    <h1>🎮 Discord Minigames</h1>
                    <p style="margin: 20px 0; font-size: 18px;">${message}</p>
                    <button onclick="location.reload()" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    ">Retry</button>
                </div>
            </div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DiscordMinigames();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.discordMinigames && window.discordMinigames.game) {
        window.discordMinigames.game.scale.refresh();
    }
});

// Export for global access
window.discordMinigames = null;
