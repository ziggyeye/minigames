import { API_ENDPOINTS } from '../../config.js';

export default class HighScoreScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HighScoreScene' });
        this.topCharacters = [];
        this.isLoading = true;
    }

    preload() {
        // Load any assets needed for the high score scene
        this.load.image('background', '/assets/background.svg');
    }

    create() {
        // Create background
        this.createBackground();
        
        // Create UI elements
        this.createUI();
        
        // Load top characters from server
        this.loadTopCharacters();
    }

    createBackground() {
        // Create gradient background
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x2c3e50, 0x2c3e50, 0x34495e, 0x34495e, 1);
        graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        // Add some decorative elements
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(0, this.cameras.main.width);
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            const size = Phaser.Math.Between(2, 6);
            const alpha = Phaser.Math.FloatBetween(0.1, 0.3);
            
            graphics.fillStyle(0xffd700, alpha); // Gold color for high scores
            graphics.fillCircle(x, y, size);
        }
    }

    createUI() {
        const centerX = this.cameras.main.centerX;
        
        // Title
        this.add.text(centerX, 80, '🏆 Top Characters by Win Rate', {
            fontSize: '48px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(centerX, 130, 'The most successful battle characters!', {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);

        // Back button
        const backButton = this.add.text(16, 16, '← Back to Menu', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 10, y: 5 }
        });
        backButton.setInteractive();
        backButton.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        // Refresh button
        const refreshButton = this.add.text(this.cameras.main.width - 16, 16, '🔄 Refresh', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 10, y: 5 }
        }).setOrigin(1, 0);
        refreshButton.setInteractive();
        refreshButton.on('pointerdown', () => {
            this.scene.restart()
        });
    }

    async loadTopCharacters() {
        this.isLoading = true;
        this.showLoadingScreen();

        try {
            console.log('🏆 Loading top characters from server...');

            const response = await fetch(`${API_ENDPOINTS.topCharacters}?limit=10`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            
            if (result.success && result.characters) {
                this.topCharacters = result.characters;
                console.log('✅ Top characters loaded:', this.topCharacters);
                this.displayTopCharacters();
            } else {
                console.log('⚠️ Failed to load top characters:', result.error || 'Unknown error');
                this.showError('Failed to load top characters. Please try again.');
            }
        } catch (error) {
            console.error('❌ Error loading top characters:', error);
            this.showError('Failed to connect to server. Please check your connection.');
        }

        this.isLoading = false;
        this.clearLoading();
    }

    showLoadingScreen() {
        // Clear previous content except background and UI
        this.children.list.forEach(child => {
            if (child.text && (child.text.includes('Loading') || child.text.includes('🏆') || child.text.includes('Character'))) {
                child.destroy();
            }
        });

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Loading text
        this.add.text(centerX, centerY, '🏆 Loading Top Characters...', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Loading spinner
        this.spinner = this.add.graphics();
        this.spinner.lineStyle(4, 0xffd700, 0.8);
        this.spinner.strokeCircle(centerX, centerY + 80, 30);

        // Animate spinner
        this.loadingTween = this.tweens.add({
            targets: this.spinner,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
    }

    displayTopCharacters() {
        // Clear loading screen
        this.children.list.forEach(child => {
            if (child.text && (child.text.includes('Loading') || child.text.includes('🏆 Loading'))) {
                child.destroy();
            }
            if (child.graphics && child.graphics.lineStyle) {
                child.destroy();
            }
        });

        const centerX = this.cameras.main.centerX;
        const startY = 200;

        if (this.topCharacters.length === 0) {
            // No characters message
            this.add.text(centerX, startY + 100, 'No battle data available yet!', {
                fontSize: '24px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                alpha: 0.8
            }).setOrigin(0.5);

            this.add.text(centerX, startY + 140, 'Create a character and start battling to see rankings!', {
                fontSize: '18px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                alpha: 0.6
            }).setOrigin(0.5);
            return;
        }

        // Create leaderboard background
        const leaderboardWidth = 700;
        const leaderboardHeight = Math.min(600, this.topCharacters.length * 60 + 100);
        const leaderboardX = centerX - leaderboardWidth / 2;
        const leaderboardY = startY;

        const leaderboardBg = this.add.graphics();
        leaderboardBg.fillStyle(0xffffff, 0.1);
        leaderboardBg.fillRoundedRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight, 15);
        leaderboardBg.lineStyle(2, 0xffffff, 0.3);
        leaderboardBg.strokeRoundedRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight, 15);

        // Header
        this.add.text(leaderboardX + 20, leaderboardY + 20, 'Rank', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffd700',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 100, leaderboardY + 20, 'Character', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffd700',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 400, leaderboardY + 20, 'Win Rate', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffd700',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 500, leaderboardY + 20, 'Battles', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffd700',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 600, leaderboardY + 20, 'Wins', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffd700',
            fontStyle: 'bold'
        });

        // Display each character
        this.topCharacters.forEach((character, index) => {
            const y = leaderboardY + 60 + (index * 50);
            const rank = index + 1;
            
            // Medal emoji for top 3
            let medal = '';
            if (rank === 1) medal = '🥇';
            else if (rank === 2) medal = '🥈';
            else if (rank === 3) medal = '🥉';
            else medal = `${rank}.`;

            // Rank
            this.add.text(leaderboardX + 20, y, medal, {
                fontSize: '20px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: rank <= 3 ? '#ffd700' : '#ffffff',
                fontStyle: 'bold'
            });

            // Character name (truncated if too long)
            const characterName = character.characterName.length > 20 
                ? character.characterName.substring(0, 17) + '...' 
                : character.characterName;
            
            this.add.text(leaderboardX + 100, y, characterName, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                fontStyle: 'bold'
            });

            // Win rate with color coding
            const winRateColor = character.winRate >= 80 ? '#2ecc71' : 
                                character.winRate >= 60 ? '#f39c12' : 
                                character.winRate >= 40 ? '#e67e22' : '#e74c3c';
            
            this.add.text(leaderboardX + 400, y, `${character.winRate}%`, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: winRateColor,
                fontStyle: 'bold'
            });

            // Total battles
            this.add.text(leaderboardX + 500, y, character.totalBattles.toString(), {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff'
            });

            // Wins
            this.add.text(leaderboardX + 600, y, character.wins.toString(), {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#2ecc71',
                fontStyle: 'bold'
            });

            // Add hover effect for character details
            const characterRow = this.add.rectangle(leaderboardX + 50, y, leaderboardWidth - 100, 40, 0x000000, 0);
            characterRow.setInteractive();
            
            characterRow.on('pointerover', () => {
                this.showCharacterTooltip(character, leaderboardX + 450, y);
            });
            
            characterRow.on('pointerout', () => {
                this.hideCharacterTooltip();
            });
        });

        // Footer info
        const footerY = leaderboardY + leaderboardHeight + 20;
        this.add.text(centerX, footerY, `Showing top ${this.topCharacters.length} characters`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.6
        }).setOrigin(0.5);

        this.add.text(centerX, footerY + 25, 'Click on a character to see more details', {
            fontSize: '12px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.5
        }).setOrigin(0.5);
    }

    showCharacterTooltip(character, x, y) {
        // Create tooltip background
        this.tooltipBg = this.add.graphics();
        this.tooltipBg.fillStyle(0x2c3e50, 0.95);
        this.tooltipBg.fillRoundedRect(x - 150, y - 80, 300, 160, 10);
        this.tooltipBg.lineStyle(2, 0xffffff, 0.3);
        this.tooltipBg.strokeRoundedRect(x - 150, y - 80, 300, 160, 10);

        // Character name
        this.tooltipName = this.add.text(x, y - 60, character.characterName, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Description (truncated)
        const description = character.description.length > 100 
            ? character.description.substring(0, 97) + '...' 
            : character.description;
        
        this.tooltipDesc = this.add.text(x, y - 30, description, {
            fontSize: '12px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: 280 }
        }).setOrigin(0.5);

        // Stats
        this.tooltipStats = this.add.text(x, y + 10, `STR: ${character.stats.STR} | DEX: ${character.stats.DEX} | CON: ${character.stats.CON} | INT: ${character.stats.INT}`, {
            fontSize: '12px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#f39c12'
        }).setOrigin(0.5);

        // Battle record
        this.tooltipRecord = this.add.text(x, y + 35, `Record: ${character.wins}W-${character.losses}L-${character.ties}T`, {
            fontSize: '12px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#2ecc71'
        }).setOrigin(0.5);
    }

    hideCharacterTooltip() {
        if (this.tooltipBg) this.tooltipBg.destroy();
        if (this.tooltipName) this.tooltipName.destroy();
        if (this.tooltipDesc) this.tooltipDesc.destroy();
        if (this.tooltipStats) this.tooltipStats.destroy();
        if (this.tooltipRecord) this.tooltipRecord.destroy();
    }

    clearLoading() {
        this.children.list.forEach(child => {
            if (child.text && (child.text.includes('Loading') || child.text.includes('🏆 Loading'))) {
                child.destroy();
            }
            if (child.graphics && child.graphics.lineStyle) {
                child.destroy();
            }
        });

        if (this.spinner) {
            this.spinner.destroy();
        }

        if (this.loadingTween) {
            this.loadingTween.destroy();
        }
    }

    showError(message) {
        // Clear loading screen
        this.clearLoading();

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Error message
        this.add.text(centerX, centerY, '❌ Error', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(centerX, centerY + 50, message, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: 600 }
        }).setOrigin(0.5);

        // Retry button
        const retryButton = this.add.text(centerX, centerY + 120, '🔄 Try Again', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        retryButton.setInteractive();
        retryButton.on('pointerdown', () => {
            this.loadTopCharacters();
        });
    }

    update() {
        // Add any update logic here if needed
    }
}
