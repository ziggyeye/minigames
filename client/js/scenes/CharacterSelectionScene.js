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
        const selectButton = this.add.text(x + cardWidth/2 - 20, y - 20, '▶️ Select', {
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

        // Delete character button
        const deleteButton = this.add.text(x + cardWidth/2 - 20, y + 20, '🗑️ Delete', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 12, y: 6 }
        }).setOrigin(1, 0.5);
        deleteButton.setInteractive();
        deleteButton.on('pointerdown', () => {
            this.showDeleteConfirmation(character);
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

    showDeleteConfirmation(character) {

        const blocker = this.add.rectangle(
            this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height,
            0x000000,
            0.5 // opacity (0 = invisible, 1 = solid black)
          );
          
          // Make it interactive so it captures all clicks
          blocker.setInteractive();

        console.log('🗑️ Showing delete confirmation for:', character.characterName);
        
        // Create overlay
        const overlay = this.add.graphics();
        overlay.setDepth(1000);
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create modal
        const modal = this.add.graphics();
        modal.setDepth(1001);
        modal.fillStyle(0xe74c3c, 0.95);
        modal.fillRoundedRect(centerX - 250, centerY - 120, 500, 240, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 250, centerY - 120, 500, 240, 15);

        // Title
        const title = this.add.text(centerX, centerY - 80, '🗑️ Delete Character', {
            fontSize: '28px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        title.setDepth(1002);

        // Warning message
        const warningText = this.add.text(centerX, centerY - 40, `Are you sure you want to delete "${character.characterName}"?`, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            wordWrap: { width: 450 }
        }).setOrigin(0.5);
        warningText.setDepth(1002);

        const subText = this.add.text(centerX, centerY - 10, 'This action cannot be undone!', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);
        subText.setDepth(1002);

        // Cancel button
        const cancelButton = this.add.text(centerX - 80, centerY + 50, 'Cancel', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#95a5a6',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        cancelButton.setDepth(1002);
        cancelButton.setInteractive();
        cancelButton.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            title.destroy();
            warningText.destroy();
            subText.destroy();
            cancelButton.destroy();
            deleteButton.destroy();
            blocker.destroy();
        });

        // Delete button
        const deleteButton = this.add.text(centerX + 80, centerY + 50, 'Delete', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        deleteButton.setDepth(1002);
        deleteButton.setInteractive();
        deleteButton.on('pointerdown', () => {
            this.deleteCharacter(character);
            // Clean up modal
            overlay.destroy();
            modal.destroy();
            title.destroy();
            warningText.destroy();
            subText.destroy();
            cancelButton.destroy();
            deleteButton.destroy();
            blocker.destroy();
        });
    }

    async deleteCharacter(character) {
        try {
            console.log('🗑️ Deleting character:', character.characterName);
            
            const discordUserId = this.getDiscordUserId();
            const response = await fetch(API_ENDPOINTS.deleteCharacter, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discordUserId: discordUserId,
                    characterId: character.id
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Character deleted successfully');
                this.showMessage(`Character "${character.characterName}" has been deleted.`);
                
                // Reload the character list
                this.scene.restart();
            } else {
                console.error('❌ Failed to delete character:', result.error);
                this.showErrorMessage(`Failed to delete character: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error deleting character:', error);
            this.showErrorMessage('Failed to delete character. Please try again.');
        }
    }

    showMessage(message) {
        // Create success message
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const messageText = this.add.text(centerX, centerY, message, {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#27ae60',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Auto-hide after 3 seconds
        this.time.delayedCall(3000, () => {
            if (messageText) {
                messageText.destroy();
            }
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
