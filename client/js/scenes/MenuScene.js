import { DiscordManager } from '../DiscordManager.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        // Load any assets needed for the menu
        this.load.image('background', '/assets/background.svg');
    }

    create() {

        this.initDiscord();

        // Create background
        this.createBackground();
        
        // Create title
        this.createTitle();
        
        // Create game cards
        this.createGameCards();
        
        // Create high scores section
        //this.createHighScores();
        
        // Add interactive elements
        this.addInteractivity();
    }

    async initDiscord() {
        try {
            this.discordManager = new DiscordManager();
            await this.discordManager.initialize();

            const playerName = this.discordManager.getCurrentUserName();
            console.log('Player name:', playerName);
            
            // Display the username in the menu
            this.displayUserName(playerName);
            
            // Set up periodic checks for Discord user updates
            this.setupDiscordUserUpdates();
        } catch (error) {
            console.error('Error initializing Discord:', error);
            // Fallback to default user
            this.displayUserName('Player');
        }
    }

    setupDiscordUserUpdates() {
        // Check for Discord user updates every 5 seconds
        this.discordUpdateTimer = this.time.addEvent({
            delay: 5000,
            callback: this.checkDiscordUserUpdate,
            callbackScope: this,
            loop: true
        });
    }

    checkDiscordUserUpdate() {
        if (this.discordManager) {
            const currentUser = this.discordManager.getCurrentUser();
            const currentName = this.discordManager.getCurrentUserName();
            
            // Update display if user changed
            if (this.lastKnownUser !== currentUser.id) {
                this.lastKnownUser = currentUser.id;
                this.updateUserName(currentName);
                console.log('Discord user updated:', currentName);
            }
        }
    }

    displayUserName(username) {
        const centerX = this.cameras.main.centerX;
        const userY = this.cameras.main.height-100; // Position below the title

        // User welcome text
        this.userNameText = this.add.text(centerX, userY, `Welcome, ${username}!`, {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Add a subtle animation
        this.tweens.add({
            targets: this.userNameText,
            alpha: 0.8,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Display user status (Discord vs Local)
        const isDiscord = this.discordManager ? this.discordManager.isInDiscord() : false;
        const statusText = isDiscord ? '🟢 Connected to Discord' : '🟡 Local Mode';
        const statusColor = isDiscord ? '#2ecc71' : '#f39c12';
        
        this.userStatusText = this.add.text(centerX, userY + 35, statusText, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: statusColor,
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    updateUserName(newUsername) {
        if (this.userNameText) {
            this.userNameText.setText(`Welcome, ${newUsername}!`);
        }
    }

    createBackground() {
        // Create gradient background
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x667eea, 0x667eea, 0x764ba2, 0x764ba2, 1);
        graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        // Add some decorative elements
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(0, this.cameras.main.width);
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            const size = Phaser.Math.Between(2, 6);
            const alpha = Phaser.Math.FloatBetween(0.1, 0.3);
            
            graphics.fillStyle(0xffffff, alpha);
            graphics.fillCircle(x, y, size);
        }
    }

    createTitle() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY - 550;

        // Main title
        this.add.text(centerX, centerY, '🎮 Discord Minigames', {
            fontSize: '48px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(centerX, centerY + 60, 'Choose a game to play with your friends!', {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);
    }

    createGameCards() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Circus Game Card
        // this.createGameCard(centerX - 200, centerY, '🎪', 'Circus Game', 
        //     'Bounce on the trampoline and pop colorful balloons!', 'circus');

        // Battle AI Card
        this.createGameCard(centerX, 300, '⚔️', 'Battle AI', 
            'Create a character and battle against AI opponents!', 'battle-ai');

        // Coming Soon Card
        this.createGameCard(centerX, 500, '🚧', 'More Games Coming!', 
            'We\'re working on more exciting minigames!', 'coming-soon');
    }

    createGameCard(x, y, icon, title, description, gameType) {
        const cardWidth = 280;
        const cardHeight = 180;
        
        // Card background
        const card = this.add.graphics();
        card.fillStyle(0xffffff, 0.1);
        card.fillRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
        card.lineStyle(2, 0xffffff, 0.2);
        card.strokeRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
        
        // Icon
        this.add.text(x, y - 50, icon, {
            fontSize: '48px'
        }).setOrigin(0.5);
        
        // Title
        this.add.text(x, y - 10, title, {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Description
        const descText = this.add.text(x, y + 20, description, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: cardWidth - 20 }
        }).setOrigin(0.5);
        
        // Make card interactive
        card.setInteractive(new Phaser.Geom.Rectangle(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);
        
        // Store game type for click handling
        card.gameType = gameType;
        
        // Add hover effects
        // card.on('pointerover', () => {
        //     card.clear();
        //     card.fillStyle(0xffffff, 0.2);
        //     card.fillRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
        //     card.lineStyle(2, 0xffffff, 0.4);
        //     card.strokeRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
            
        //     // Add subtle animation
        //     this.tweens.add({
        //         targets: [card, descText],
        //         y: y - 5,
        //         duration: 200,
        //         ease: 'Power2'
        //     });
        // });
        
        // card.on('pointerout', () => {
        //     card.clear();
        //     card.fillStyle(0xffffff, 0.1);
        //     card.fillRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
        //     card.lineStyle(2, 0xffffff, 0.2);
        //     card.strokeRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
            
        //     // Reset position
        //     this.tweens.add({
        //         targets: [card, descText],
        //         y: y,
        //         duration: 200,
        //         ease: 'Power2'
        //     });
        // });
        
        card.on('pointerdown', () => {
            this.handleGameSelection(card.gameType);
        });
    }

    createHighScores() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY + 150;
        
        // High scores background
        const scoresBg = this.add.graphics();
        scoresBg.fillStyle(0xffffff, 0.1);
        scoresBg.fillRoundedRect(centerX - 200, centerY - 80, 400, 160, 15);
        scoresBg.lineStyle(2, 0xffffff, 0.2);
        scoresBg.strokeRoundedRect(centerX - 200, centerY - 80, 400, 160, 15);
        
        // Title
        this.add.text(centerX, centerY - 60, '🏆 Demo High Scores', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Demo scores
        const scores = [
            { name: 'Player1', score: 150 },
            { name: 'Player2', score: 120 },
            { name: 'Player3', score: 95 }
        ];
        
        scores.forEach((score, index) => {
            const y = centerY - 20 + (index * 25);
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            
            this.add.text(centerX - 150, y, `${medal} ${score.name}`, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff'
            });
            
            this.add.text(centerX + 150, y, `${score.score} points`, {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff'
            }).setOrigin(1, 0);
        });
        
        // Info text
        this.add.text(centerX, centerY + 170, '🎮 Ready to play! Click on a game above to get started.', {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);
    }

    addInteractivity() {
        // Add keyboard support
        // this.input.keyboard.on('keydown-C', () => {
        //     this.handleGameSelection('circus');
        // });
        
        // this.input.keyboard.on('keydown-ESC', () => {
        //     // Could be used for settings or exit
        //     console.log('ESC pressed');
        // });
    }

    handleGameSelection(gameType) {
        console.log(`Game selected: ${gameType}`);
        
        switch (gameType) {
            case 'circus':
                this.scene.start('CircusScene');
                break;
            case 'battle-ai':
                this.scene.start('BattleAIScene');
                break;
            case 'coming-soon':
                // Show coming soon message
                this.showComingSoonMessage();
                break;
            default:
                console.log(`Unknown game type: ${gameType}`);
        }
    }

    showComingSoonMessage() {
        // Create a modal-like message
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        const modal = this.add.graphics();
        modal.fillStyle(0x34495e, 0.95);
        modal.fillRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);
        
        this.add.text(centerX, centerY - 60, '🚧 Coming Soon!', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(centerX, centerY - 10, 'We\'re working on more exciting minigames!', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);
        
        this.add.text(centerX, centerY + 20, 'Stay tuned for updates!', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.6
        }).setOrigin(0.5);
        
        // Make overlay clickable to dismiss
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.cameras.main.width, this.cameras.main.height), Phaser.Geom.Rectangle.Contains);
        overlay.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            this.children.removeAll();
            this.create();
        });
    }

    update() {
        // Add any update logic here if needed
    }
}
