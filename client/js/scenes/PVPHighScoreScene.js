import { API_ENDPOINTS } from '../../config.js';

export default class PVPHighScoreScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PVPHighScoreScene' });
        this.highScores = [];
        this.loadingText = null;
        this.spinner = null;
        this.tooltip = null;
    }

    preload() {
        this.load.image('background', '/assets/background.svg');
    }

    create() {
        this.createBackground();
        this.createTitle();
        this.createBackButton();
        this.loadHighScores();
    }

    createBackground() {
        const { width, height } = this.cameras.main;
        const background = this.add.image(width / 2, height / 2, 'background');
        background.setDisplaySize(width, height);
        background.setTint(0x2c3e50); // Darker tint for PVP theme
    }

    createTitle() {
        const centerX = this.cameras.main.centerX;
        const titleY = 80;

        // PVP High Scores title with special styling
        this.add.text(centerX, titleY, '⚔️ PVP High Scores', {
            fontSize: '48px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(centerX, titleY + 50, 'Top Players vs Players', {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ecf0f1',
            fontStyle: 'italic',
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
    }

    createBackButton() {
        const backButton = this.add.text(50, 50, '← Back', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            padding: { x: 15, y: 8 },
            stroke: '#000000',
            strokeThickness: 1
        });

        backButton.setInteractive();
        backButton.on('pointerover', () => {
            backButton.setBackgroundColor('#2c3e50');
        });
        backButton.on('pointerout', () => {
            backButton.setBackgroundColor('#34495e');
        });
        backButton.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }

    async loadHighScores() {
        this.showLoadingScreen();
        try {
            const response = await fetch(API_ENDPOINTS.topPVPCharacters);
            const result = await response.json();

            if (result.success && result.characters) {
                this.highScores = result.characters;
                this.displayHighScores(this.highScores);
            } else {
                this.showError(result.error || 'Failed to load PVP high scores.');
            }
        } catch (error) {
            console.error('Error fetching PVP high scores:', error);
            this.showError('Failed to connect to server. Please try again.');
        } finally {
            this.hideLoadingScreen();
        }
    }

    showLoadingScreen() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Loading text
        this.loadingText = this.add.text(centerX, centerY, '⚔️ Loading PVP Champions...', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Loading spinner
        this.spinner = this.add.graphics();
        this.spinner.lineStyle(4, 0xe74c3c, 0.8); // Red color for PVP theme
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

    hideLoadingScreen() {
        if (this.loadingText) {
            this.loadingText.destroy();
            this.loadingText = null;
        }
        if (this.spinner) {
            this.spinner.destroy();
            this.spinner = null;
        }
        if (this.loadingTween) {
            this.loadingTween.destroy();
            this.loadingTween = null;
        }
    }

    displayHighScores(characters) {
        const centerX = this.cameras.main.centerX;
        const startY = 200;

        if (characters.length === 0) {
            this.add.text(centerX, startY, 'No PVP battles recorded yet!', {
                fontSize: '24px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ecf0f1',
                stroke: '#000000',
                strokeThickness: 1
            }).setOrigin(0.5);
            return;
        }

        // Create leaderboard background
        const leaderboardWidth = 700;
        const leaderboardHeight = Math.min(600, characters.length * 60 + 100);
        const leaderboardX = centerX - leaderboardWidth / 2;
        const leaderboardY = startY;

        // Leaderboard background with PVP theme
        const leaderboardBg = this.add.graphics();
        leaderboardBg.fillStyle(0x2c3e50, 0.9);
        leaderboardBg.fillRoundedRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight, 15);
        leaderboardBg.lineStyle(3, 0xe74c3c, 0.8); // Red border for PVP theme
        leaderboardBg.strokeRoundedRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight, 15);

        // Header
        this.add.text(leaderboardX + 50, leaderboardY + 20, 'Rank', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 150, leaderboardY + 20, 'Character', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 350, leaderboardY + 20, 'Win Rate', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 450, leaderboardY + 20, 'Battles', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        });

        this.add.text(leaderboardX + 550, leaderboardY + 20, 'Record', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        });

        // Display each character
        characters.forEach((character, index) => {
            const y = leaderboardY + 60 + (index * 50);
            const rank = index + 1;

            // Medal for top 3
            let medal = '';
            if (rank === 1) medal = '🥇';
            else if (rank === 2) medal = '🥈';
            else if (rank === 3) medal = '🥉';

            // Rank
            this.add.text(leaderboardX + 50, y, `${medal} ${rank}`, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                fontStyle: rank <= 3 ? 'bold' : 'normal'
            });

            // Character name (truncated if too long)
            const characterName = character.characterName.length > 15 
                ? character.characterName.substring(0, 15) + '...' 
                : character.characterName;
            
            this.add.text(leaderboardX + 150, y, characterName, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff'
            });

            // Win rate with color coding
            const winRateColor = this.formatWinRateColor(character.winRate);
            this.add.text(leaderboardX + 350, y, `${character.winRate}%`, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: winRateColor,
                fontStyle: 'bold'
            });

            // Total battles
            this.add.text(leaderboardX + 450, y, character.totalBattles.toString(), {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff'
            });

            // Win-Loss-Tie record
            this.add.text(leaderboardX + 550, y, `${character.wins}-${character.losses}-${character.ties}`, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ecf0f1'
            });

            // Make character row interactive for tooltip
            const characterRow = this.add.rectangle(leaderboardX + leaderboardWidth/2, y, leaderboardWidth, 40, 0x000000, 0);
            characterRow.setInteractive();
            
            characterRow.on('pointerover', () => {
                this.showCharacterTooltip(character, leaderboardX + 450, y);
            });
            
            characterRow.on('pointerout', () => {
                this.hideCharacterTooltip();
            });
        });

        // Refresh button
        const refreshButton = this.add.text(centerX, leaderboardY + leaderboardHeight + 40, '🔄 Refresh', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            padding: { x: 15, y: 8 },
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);

        refreshButton.setInteractive();
        refreshButton.on('pointerover', () => {
            refreshButton.setBackgroundColor('#2c3e50');
        });
        refreshButton.on('pointerout', () => {
            refreshButton.setBackgroundColor('#34495e');
        });
        refreshButton.on('pointerdown', () => {
            this.scene.restart();
        });
    }

    showCharacterTooltip(character, x, y) {
        if (this.tooltip) {
            this.tooltip.destroy();
        }

        // Create tooltip background
        const tooltipBg = this.add.graphics();
        tooltipBg.fillStyle(0x2c3e50, 0.95);
        tooltipBg.fillRoundedRect(x - 150, y - 80, 300, 160, 10);
        tooltipBg.lineStyle(2, 0xe74c3c, 0.8);
        tooltipBg.strokeRoundedRect(x - 150, y - 80, 300, 160, 10);

        // Character details
        this.tooltip = this.add.container(x, y);
        this.tooltip.add(tooltipBg);

        // Character name
        this.tooltip.add(this.add.text(0, -60, character.characterName, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        }).setOrigin(0.5));

        // Description
        const description = character.description.length > 100 
            ? character.description.substring(0, 100) + '...' 
            : character.description;
        this.tooltip.add(this.add.text(0, -35, description, {
            fontSize: '12px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ecf0f1',
            wordWrap: { width: 280 }
        }).setOrigin(0.5));

        // Stats
        this.tooltip.add(this.add.text(0, -5, `STR: ${character.stats.STR} | DEX: ${character.stats.DEX} | CON: ${character.stats.CON} | INT: ${character.stats.INT}`, {
            fontSize: '12px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#f39c12'
        }).setOrigin(0.5));

        // Battle record
        this.tooltip.add(this.add.text(0, 20, `PVP Record: ${character.wins}W-${character.losses}L-${character.ties}T (${character.winRate}%)`, {
            fontSize: '12px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#27ae60',
            fontStyle: 'bold'
        }).setOrigin(0.5));

        // Last battle date
        if (character.lastBattleDate) {
            const lastBattle = new Date(character.lastBattleDate);
            this.tooltip.add(this.add.text(0, 45, `Last Battle: ${lastBattle.toLocaleDateString()}`, {
                fontSize: '10px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#95a5a6'
            }).setOrigin(0.5));
        }
    }

    hideCharacterTooltip() {
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }

    formatWinRateColor(winRate) {
        if (winRate >= 80) return '#27ae60'; // Green
        if (winRate >= 60) return '#f39c12'; // Orange
        if (winRate >= 40) return '#e67e22'; // Dark orange
        return '#e74c3c'; // Red
    }

    showError(message) {
        // Clear loading screen
        this.hideLoadingScreen();

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Error message
        this.add.text(centerX, centerY, message, {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: 600 }
        }).setOrigin(0.5);

        // Retry button
        const retryButton = this.add.text(centerX, centerY + 60, '🔄 Retry', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 15, y: 8 },
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);

        retryButton.setInteractive();
        retryButton.on('pointerover', () => {
            retryButton.setBackgroundColor('#c0392b');
        });
        retryButton.on('pointerout', () => {
            retryButton.setBackgroundColor('#e74c3c');
        });
        retryButton.on('pointerdown', () => {
            this.scene.restart();
        });
    }
}
