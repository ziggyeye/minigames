import { API_ENDPOINTS } from '../../config.js';

export default class CharacterSelectionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterSelectionScene' });
        this.userCharacters = [];
        this.isLoading = false;
    }

    preload() {
        // Load any assets needed for the character selection scene
        this.load.image('background', '/assets/background.svg');
    }

    create() {
        // Create background
        this.createBackground();
        
        // Create UI elements
        this.createUI();
        
        // Load user characters
        this.loadUserCharacters();
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
            
            graphics.fillStyle(0x667eea, alpha);
            graphics.fillCircle(x, y, size);
        }
    }

    createUI() {
        // Title
        this.add.text(this.cameras.main.centerX, 50, '🎭 Character Selection', {
            fontSize: '48px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Back button
        const backButton = this.add.text(16, 16, '← Back', {
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

        // Privacy policy link
        // const privacyLink = this.add.text(this.cameras.main.width - 16, 16, '🔒 Privacy', {
        //     fontSize: '16px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: '#667eea',
        //     padding: { x: 10, y: 5 }
        // }).setOrigin(1, 0);
        // privacyLink.setInteractive();
        // privacyLink.on('pointerdown', () => {
        //     window.open('/privacy-policy.html', '_blank');
        // });

        // // Terms of service link
        // const termsLink = this.add.text(this.cameras.main.width - 16, 50, '📜 Terms', {
        //     fontSize: '16px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: '#764ba2',
        //     padding: { x: 10, y: 5 }
        // }).setOrigin(1, 0);
        // termsLink.setInteractive();
        // termsLink.on('pointerdown', () => {
        //     window.open('/terms-of-service.html', '_blank');
        // });
    }

    createNewCharacterButton() {
        const centerX = this.cameras.main.centerX;
        const buttonY = this.cameras.main.height - 100;

        // Create New Character button
        const newCharacterButton = this.add.text(centerX, buttonY, '✨ Create New Character', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 12 }
        }).setOrigin(0.5);
        newCharacterButton.setInteractive();
        newCharacterButton.on('pointerdown', () => {
            this.createNewCharacter();
        });

        // Add hover effects
        newCharacterButton.on('pointerover', () => {
            newCharacterButton.setBackgroundColor('#2ecc71');
        });
        newCharacterButton.on('pointerout', () => {
            newCharacterButton.setBackgroundColor('#27ae60');
        });
    }

    async loadUserCharacters() {
        try {
            this.isLoading = true;
            this.showLoadingMessage();

            const discordUserId = this.getDiscordUserId();
            console.log('🎭 Loading user characters for:', discordUserId);

            const response = await fetch(API_ENDPOINTS.getUserCharacters.replace(':discordUserId', discordUserId), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            
            if (result.success && result.characters) {
                this.userCharacters = result.characters;
                console.log('✅ User characters loaded:', this.userCharacters);
                this.hideLoadingMessage();
                this.displayCharacters();

                if (this.userCharacters.length < 5-1) {
                    // Create New Character button
                    this.createNewCharacterButton();
                }

            } else {
                console.log('ℹ️ No characters found, user will create their first character');
                this.hideLoadingMessage();
                this.displayNoCharactersMessage();
                // Create New Character button
                this.createNewCharacterButton();
            }
        } catch (error) {
            console.error('❌ Error loading user characters:', error);
            this.hideLoadingMessage();
            this.showErrorMessage('Failed to load characters. Please try again.');
        } finally {
            this.isLoading = false;
        }
    }

    displayCharacters() {
        if (this.userCharacters.length === 0) {
            this.displayNoCharactersMessage();
            return;
        }

        const centerX = this.cameras.main.centerX;
        const startY = 250;
        const cardHeight = 120;
        const cardSpacing = 20;

        // Title for existing characters
        // this.add.text(centerX, startY - 30, 'Your Characters:', {
        //     fontSize: '28px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     fontStyle: 'bold',
        //     stroke: '#000000',
        //     strokeThickness: 2
        // }).setOrigin(0.5);

        // Display each character as a card
        this.userCharacters.forEach((character, index) => {
            if (index < 5)
            {
            const cardY = startY + (index * (cardHeight + cardSpacing));
            this.createCharacterCard(character, centerX, cardY);
            }
        });
    }

    createCharacterCard(character, x, y) {
        const cardWidth = 500;
        const cardHeight = 120;

        // Card background
        const card = this.add.graphics();
        card.fillStyle(0xffffff, 0.1);
        card.fillRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
        card.lineStyle(2, 0xffffff, 0.3);
        card.strokeRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);

        // Character name
        this.add.text(x - cardWidth/2 + 20, y - cardHeight/2 + 20, character.characterName, {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });

        // Character description
        const descText = this.add.text(x - cardWidth/2 + 20, y - cardHeight/2 + 50, character.description, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.9,
            wordWrap: { width: cardWidth - 100 }
        });

        // Character stats
        if (character.stats) {
            const statsText = Object.entries(character.stats)
                .map(([stat, value]) => `${stat}: ${value}`)
                .join(' | ');
            
            this.add.text(x - cardWidth/2 + 20, y - cardHeight/2 + 80, statsText, {
                fontSize: '14px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#667eea',
                alpha: 0.8
            });
        }

        // Select character button
        const selectButton = this.add.text(x + cardWidth/2 - 20, y, '▶️ Select', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 15, y: 8 }
        }).setOrigin(1, 0.5);
        selectButton.setInteractive();
        selectButton.on('pointerdown', () => {
            this.selectCharacter(character);
        });

        // Add hover effects to the card
        card.setInteractive(new Phaser.Geom.Rectangle(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);
        
        card.on('pointerover', () => {
            card.clear();
            card.fillStyle(0xffffff, 0.2);
            card.fillRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
            card.lineStyle(2, 0xffffff, 0.5);
            card.strokeRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
        });
        
        card.on('pointerout', () => {
            card.clear();
            card.fillStyle(0xffffff, 0.1);
            card.fillRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
            card.lineStyle(2, 0xffffff, 0.3);
            card.strokeRoundedRect(x - cardWidth/2, y - cardHeight/2, cardWidth, cardHeight, 15);
        });
    }

    displayNoCharactersMessage() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // No characters message
        this.add.text(centerX, centerY - 50, 'No Characters Found', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.add.text(centerX, centerY, 'You haven\'t created any characters yet.', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);

        this.add.text(centerX, centerY + 30, 'Click "Create New Character" to get started!', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#667eea',
            alpha: 0.9
        }).setOrigin(0.5);
    }

    selectCharacter(character) {
        console.log('🎭 Character selected:', character);
        
        // Start Battle AI scene with the selected character
        this.scene.start('BattleAIScene', {
            selectedCharacter: character,
            isNewCharacter: false
        });
    }

    createNewCharacter() {
        console.log('✨ Creating new character');
        
        // Start Battle AI scene for new character creation
        this.scene.start('BattleAIScene', {
            selectedCharacter: null,
            isNewCharacter: true
        });
    }

    showLoadingMessage() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        this.loadingText = this.add.text(centerX, centerY, 'Loading characters...', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);

        // Add loading spinner
        this.loadingSpinner = this.add.text(centerX, centerY + 40, '⏳', {
            fontSize: '32px'
        }).setOrigin(0.5);

        // Animate spinner
        this.tweens.add({
            targets: this.loadingSpinner,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
    }

    hideLoadingMessage() {
        if (this.loadingText) {
            this.loadingText.destroy();
            this.loadingText = null;
        }
        if (this.loadingSpinner) {
            this.loadingSpinner.destroy();
            this.loadingSpinner = null;
        }
    }

    showErrorMessage(message) {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        this.add.text(centerX, centerY, message, {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    getDiscordUserId() {
        // Get Discord user ID from the global Discord manager
        if (window.globalDiscordManager && window.globalDiscordManager.getCurrentUser) {
            const user = window.globalDiscordManager.getCurrentUser();
            return user ? user.id : null;
        }
        return null;
    }

    update() {
        // Add any update logic here if needed
    }
}
