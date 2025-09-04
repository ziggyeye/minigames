import { API_ENDPOINTS } from '../../config.js';

export default class CharacterCreationScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterCreationScene' });
        this.playerCharacter = null;
        this.isLoading = false;
        
        // Character stats (10 points to allocate)
        this.characterStats = {
            STR: 1, // Strength
            DEX: 1, // Dexterity  
            CON: 1, // Constitution
            INT: 1  // Intelligence
        };
        this.totalPointsToAllocate = 10;
        this.allocatedPoints = 4; // Start with 1 in each stat
        
        // Battle statistics (will be loaded from server)
        this.battleStats = {
            totalBattles: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            winRate: 0
        };
        
        // Character level
        this.characterLevel = 0;
        
        // Battle cooldown tracking
        this.cooldownExpiry = null;
        this.cooldownTimer = null;
        
        // Battle gems tracking
        this.battleGems = 0;
    }

    preload() {
        // Load any assets needed for the character creation scene
        this.load.image('background', '/assets/background.svg');
    }

    create(data) {
        // Store data passed from CharacterSelectionScene
        this.selectedCharacter = data?.selectedCharacter || null;
        this.isNewCharacter = data?.isNewCharacter || false;
        
        console.log('🎭 CharacterCreationScene started with:', { selectedCharacter: this.selectedCharacter, isNewCharacter: this.isNewCharacter });
        
        // Create background
        this.createBackground();
        
        // Create UI elements
        this.createUI();
        
        // Initialize based on whether we have a selected character or not
        if (this.selectedCharacter && !this.isNewCharacter) {
            // Use the selected character
            this.playerCharacter = {
                name: this.selectedCharacter.characterName,
                description: this.selectedCharacter.description,
                stats: this.selectedCharacter.stats || { STR: 1, DEX: 1, CON: 1, INT: 1 }
            };
            console.log('✅ Using selected character:', this.playerCharacter);
            
            // Load character stats from selected character
            if (this.selectedCharacter.stats) {
                this.characterStats = { ...this.selectedCharacter.stats };
                this.allocatedPoints = Object.values(this.characterStats).reduce((sum, val) => sum + val, 0);
                console.log('📊 Loaded character stats from selected character:', this.characterStats);
            }
            
            // Load character level and battle stats
            this.loadCharacterLevel(this.playerCharacter.name);
            this.loadBattleStatsFromServer();
            
            // Show character creation with pre-filled data
            this.showCharacterCreation();
        } else {
            // Reset stats to default for new character
            this.characterStats = { STR: 1, DEX: 1, CON: 1, INT: 1 };
            this.allocatedPoints = 4;
            console.log('📊 Reset stats to default for new character:', this.characterStats);
            
            this.playerCharacter = null; 
            this.showCharacterCreation();
        }
        
        // Always load battle statistics
        this.loadBattleStatsFromServer();
    }

    createBackground() {
        // Create gradient background
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x2c3e50, 0x2c3e50, 0x34495e, 0x34495e, 1);
        graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        // Add some battle-themed decorative elements
        for (let i = 0; i < 25; i++) {
            const x = Phaser.Math.Between(0, this.cameras.main.width);
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            const size = Phaser.Math.Between(2, 8);
            const alpha = Phaser.Math.FloatBetween(0.1, 0.3);
            
            graphics.fillStyle(0xff6b6b, alpha);
            graphics.fillCircle(x, y, size);
        }
    }

    createUI() {
        // Title
        this.add.text(this.cameras.main.centerX, 50, '🎭 Character Creation', {
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
            this.scene.start('CharacterSelectionScene');
        });
    }

    showCharacterCreation() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const boxWidth = 600;
        const boxHeight = 800;

        // Create form background
        const formBg = this.add.graphics();
        formBg.fillStyle(0xffffff, 0.1);
        formBg.fillRoundedRect(centerX - boxWidth/2, centerY - boxHeight/2, boxWidth, boxHeight, 15);
        formBg.lineStyle(2, 0xffffff, 0.3);
        formBg.strokeRoundedRect(centerX - boxWidth/2, centerY - boxHeight/2, boxWidth, boxHeight, 15);

        let top = centerY - boxHeight/2 +40;
        // Title
        this.add.text(centerX, top, 'Create Your Character', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        top += 40;

        // Name input label
        this.add.text(centerX - 250, top, 'Character Name:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        // Name input field (simulated with text) - auto-filled if character exists
        const nameDisplayText = this.playerCharacter && this.playerCharacter.name 
            ? this.playerCharacter.name 
            : 'Enter name here...';
        const nameColor = this.playerCharacter && this.playerCharacter.name 
            ? '#ffffff' 
            : '#cccccc';
            
        top += 18;
        top += 5;

        this.nameText = this.add.text(centerX - 250, top, nameDisplayText, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: nameColor,
            backgroundColor: '#2c3e50',
            padding: { x: 10, y: 8 }
        });
        this.nameText.setInteractive();
        this.nameText.on('pointerdown', () => {
            this.showNameInput();
        });

        top += 16;
        top += 30;

        // Description input label
        this.add.text(centerX - 250, top, 'Character Description:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        // Description input field (simulated with text) - auto-filled if character exists
        const descDisplayText = this.playerCharacter && this.playerCharacter.description 
            ? this.playerCharacter.description 
            : 'Enter description here...';
        const descColor = this.playerCharacter && this.playerCharacter.description 
            ? '#ffffff' 
            : '#cccccc';

        top += 18;
        top += 5;
            
        this.descText = this.add.text(centerX - 250, top, descDisplayText, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: descColor,
            backgroundColor: '#2c3e50',
            padding: { x: 10, y: 8 },
            wordWrap: { width: 500 }
        });
        this.descText.setInteractive();
        this.descText.on('pointerdown', () => {
            this.showDescriptionInput();
        });

        top += 45;
        top += 5;

        // Character Stats section
        this.add.text(centerX - 250, top, 'Character Stats (10 points to allocate):', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });

        top += 25;
        top += 15;

        // Create stats allocation UI
        this.createStatsAllocationUI(centerX, top);

        // Create button
        const createButtonY = top + 200;
        const createButton = this.add.text(centerX, createButtonY, '✨ Create Character', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        
        createButton.setInteractive();
        createButton.on('pointerdown', () => {
            this.createCharacter();
        });

        // Add hover effects
        createButton.on('pointerover', () => {
            createButton.setBackgroundColor('#2ecc71');
        });
        createButton.on('pointerout', () => {
            createButton.setBackgroundColor('#27ae60');
        });

        // Instructions
        this.add.text(centerX, createButtonY + 50, 'Click on the input fields to enter your character details', {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.7
        }).setOrigin(0.5);

        // Character loading status
        if (this.selectedCharacter && !this.isNewCharacter) {
            this.add.text(centerX, createButtonY + 80, `✅ Editing existing character: ${this.selectedCharacter.characterName}`, {
                fontSize: '12px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#2ecc71',
                alpha: 0.8
            }).setOrigin(0.5);
        } else {
            this.add.text(centerX, createButtonY + 80, '📝 Creating new character', {
                fontSize: '12px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#f39c12',
                alpha: 0.8
            }).setOrigin(0.5);
        }
    }

    // ... (rest of the methods from BattleAIScene would go here)
    // For brevity, I'll include the key methods that are needed

    createStatsAllocationUI(centerX, startY) {
        const statNames = ['STR', 'DEX', 'CON', 'INT'];
        const statLabels = {
            'STR': 'Strength',
            'DEX': 'Dexterity', 
            'CON': 'Constitution',
            'INT': 'Intelligence'
        };
        
        // Store references to stat display texts for updates
        this.statDisplayTexts = {};
        this.statButtons = {};

        // Points remaining display
        this.pointsRemainingText = this.add.text(centerX + 200, startY - 20, `Points: ${this.totalPointsToAllocate - this.allocatedPoints}`, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#f39c12',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        statNames.forEach((stat, index) => {
            const yPos = startY + (index * 35);
            
            // Stat label
            this.add.text(centerX - 250, yPos, `${stat} (${statLabels[stat]}):`, {
                fontSize: '14px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff'
            });
            
            // Decrease button
            const decreaseBtn = this.add.text(centerX - 50, yPos, '−', {
                fontSize: '20px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                backgroundColor: '#e74c3c',
                padding: { x: 8, y: 2 }
            }).setOrigin(0.5);
            decreaseBtn.setInteractive();
            decreaseBtn.on('pointerdown', () => this.decreaseStat(stat));
            
            // Stat value display
            this.statDisplayTexts[stat] = this.add.text(centerX, yPos, this.characterStats[stat].toString(), {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                backgroundColor: '#34495e',
                padding: { x: 12, y: 4 }
            }).setOrigin(0.5);
            
            // Increase button
            const increaseBtn = this.add.text(centerX + 50, yPos, '+', {
                fontSize: '20px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                backgroundColor: '#27ae60',
                padding: { x: 8, y: 2 }
            }).setOrigin(0.5);
            increaseBtn.setInteractive();
            increaseBtn.on('pointerdown', () => this.increaseStat(stat));
            
            // Store button references
            this.statButtons[stat] = { decrease: decreaseBtn, increase: increaseBtn };
        });
    }

    increaseStat(statName) {
        if (this.allocatedPoints < this.totalPointsToAllocate && this.characterStats[statName] < 10) {
            this.characterStats[statName]++;
            this.allocatedPoints++;
            this.updateStatsDisplay();
        }
    }

    decreaseStat(statName) {
        if (this.characterStats[statName] > 1) {
            this.characterStats[statName]--;
            this.allocatedPoints--;
            this.updateStatsDisplay();
        }
    }

    updateStatsDisplay() {
        // Update stat value displays
        Object.keys(this.characterStats).forEach(stat => {
            if (this.statDisplayTexts[stat]) {
                this.statDisplayTexts[stat].setText(this.characterStats[stat].toString());
            }
        });
        
        // Update points remaining
        if (this.pointsRemainingText) {
            const pointsLeft = this.totalPointsToAllocate - this.allocatedPoints;
            this.pointsRemainingText.setText(`Points: ${pointsLeft}`);
            
            // Change color based on points remaining
            if (pointsLeft === 0) {
                this.pointsRemainingText.setColor('#2ecc71'); // Green when all points used
            } else if (pointsLeft > 0) {
                this.pointsRemainingText.setColor('#f39c12'); // Orange when points remaining
            }
        }
    }

    async startBattle() {
        if (!this.playerCharacter || !this.playerCharacter.name || !this.playerCharacter.description) {
            this.showError('Please enter both name and description for your character!');
            return;
        }

        if (this.totalPointsToAllocate - this.allocatedPoints > 0) {
            this.showError('Spend all points before battling!');
            return;
        }

        // Check cooldown
        const cooldownStatus = this.checkCooldown();
        if (cooldownStatus.onCooldown) {
            const timeRemaining = this.formatTimeRemaining(cooldownStatus.timeRemaining);
            this.showError(`Battle cooldown active. Please wait ${timeRemaining} before your next battle.`);
            return;
        }

        this.isLoading = true;
        this.showLoadingScreen();
        
        // Save character to server
        await this.saveCharacterToServer();
        
        // Start battle scene with character data
        this.scene.start('BattleAIScene', {
            playerCharacter: this.playerCharacter,
            characterStats: this.characterStats,
            battleStats: this.battleStats,
            characterLevel: this.characterLevel,
            cooldownExpiry: this.cooldownExpiry,
            battleGems: this.battleGems
        });
    }

    async createCharacter() {
        // Validate character data
        if (!this.playerCharacter || !this.playerCharacter.name || !this.playerCharacter.description) {
            this.showError('Please enter both name and description for your character!');
            return;
        }

        if (this.totalPointsToAllocate - this.allocatedPoints > 0) {
            this.showError('Spend all points before creating character!');
            return;
        }

        // Show loading
        this.isLoading = true;
        this.showLoadingScreen();

        try {
            // Get Discord user ID
            const discordUserId = this.getDiscordUserId();
            
            const characterData = {
                characterName: this.playerCharacter.name,
                description: this.playerCharacter.description,
                discordUserId: discordUserId,
                stats: this.characterStats
            };

            console.log('🎭 Creating character:', characterData);

            const response = await fetch(API_ENDPOINTS.saveCharacter, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': `save_char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                },
                body: JSON.stringify(characterData)
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Character created successfully:', result.character);
                this.showMessage('Character created successfully!');
                
                // Navigate back to character selection after a short delay
                this.time.delayedCall(1500, () => {
                    this.scene.start('CharacterSelectionScene');
                });
            } else {
                console.warn('⚠️ Character creation failed:', result.error);
                this.showError(`Failed to create character: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error creating character:', error);
            this.showError('Failed to create character. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoadingScreen();
        }
    }

    async saveCharacterToServer() {
        try {
            // Get Discord user ID
            const discordUserId = this.getDiscordUserId();
            
            const characterData = {
                characterName: this.playerCharacter.name,
                description: this.playerCharacter.description,
                discordUserId: discordUserId,
                stats: this.characterStats
            };

            console.log('🎭 Saving character to server:', characterData);

            const response = await fetch(API_ENDPOINTS.saveCharacter, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': `save_char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                },
                body: JSON.stringify(characterData)
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Character saved successfully:', result.character);
            } else {
                console.warn('⚠️ Character save failed:', result.error);
                this.showError(`Failed to save character: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Error saving character to server:', error);
            this.showError('Failed to save character. Please try again.');
        }
    }

    getDiscordUserId() {
        // Try to get Discord user ID from global DiscordManager
        if (window.globalDiscordManager && window.globalDiscordManager.isInitialized) {
            const user = window.globalDiscordManager.getCurrentUser();
            if (user && user.id && user.id !== 'manual' && user.id !== 'test') {
                return user.id;
            }
        }
        
        // Fallback to a test user ID
        return 'test_user_' + Math.random().toString(36).substr(2, 9);
    }

    // Placeholder methods for battle functionality
    checkCooldown() {
        if (!this.cooldownExpiry) {
            return { onCooldown: false, timeRemaining: 0 };
        }

        const now = new Date();
        const timeRemaining = Math.max(0, this.cooldownExpiry.getTime() - now.getTime());
        const onCooldown = timeRemaining > 0;

        return {
            onCooldown,
            timeRemaining,
            cooldownExpiry: this.cooldownExpiry
        };
    }

    formatTimeRemaining(milliseconds) {
        const seconds = Math.ceil(milliseconds / 1000);
        return `${seconds}s`;
    }

    startCooldownTimer() {
        // Implementation would go here
    }

    async addBattleGems() {
        // Implementation would go here
    }

    async startBattleWithGem() {
        // Implementation would go here
    }

    async loadBattleStatsFromServer() {
        // Implementation would go here
    }

    async loadCharacterLevel(characterName) {
        // Implementation would go here
    }

    showLoadingScreen() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create overlay
        this.loadingOverlay = this.add.graphics();
        this.loadingOverlay.fillStyle(0x000000, 0.7);
        this.loadingOverlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Loading text
        this.loadingText = this.add.text(centerX, centerY, 'Creating character...', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Loading spinner
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

    hideLoadingScreen() {
        if (this.loadingOverlay) {
            this.loadingOverlay.destroy();
            this.loadingOverlay = null;
        }
        if (this.loadingText) {
            this.loadingText.destroy();
            this.loadingText = null;
        }
        if (this.loadingSpinner) {
            this.loadingSpinner.destroy();
            this.loadingSpinner = null;
        }
    }

    showError(message) {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create overlay
        const overlay = this.add.graphics();
        overlay.setDepth(1000);
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Create modal
        const modal = this.add.graphics();
        modal.setDepth(1001);
        modal.fillStyle(0xe74c3c, 0.95);
        modal.fillRoundedRect(centerX - 250, centerY - 100, 500, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 250, centerY - 100, 500, 200, 15);

        // Title
        const errorTitle = this.add.text(centerX, centerY - 50, '❌ Error', {
            fontSize: '28px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        errorTitle.setDepth(1002);

        // Error message
        const errorMessage = this.add.text(centerX, centerY, message, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            wordWrap: { width: 450 }
        }).setOrigin(0.5);
        errorMessage.setDepth(1002);

        // OK button
        const okButton = this.add.text(centerX, centerY + 60, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setDepth(1002);
        okButton.setInteractive();
        okButton.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            errorTitle.destroy();
            errorMessage.destroy();
            okButton.destroy();
        });
    }

    showMessage(message) {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create overlay
        const overlay = this.add.graphics();
        overlay.setDepth(1000);
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Create modal
        const modal = this.add.graphics();
        modal.setDepth(1001);
        modal.fillStyle(0x27ae60, 0.95);
        modal.fillRoundedRect(centerX - 250, centerY - 100, 500, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 250, centerY - 100, 500, 200, 15);

        // Title
        const successTitle = this.add.text(centerX, centerY - 50, '✅ Success', {
            fontSize: '28px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        successTitle.setDepth(1002);

        // Success message
        const successMessage = this.add.text(centerX, centerY, message, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            wordWrap: { width: 450 }
        }).setOrigin(0.5);
        successMessage.setDepth(1002);

        // OK button
        const okButton = this.add.text(centerX, centerY + 60, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setDepth(1002);
        okButton.setInteractive();
        okButton.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            successTitle.destroy();
            successMessage.destroy();
            okButton.destroy();
        });
    }

    showNameInput() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create blocker
        const blocker = this.add.rectangle(
            this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height,
            0x000000,
            0.5
        );
        blocker.setInteractive();

        // Create overlay
        const overlay = this.add.graphics();
        overlay.setDepth(1000);
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Create modal
        const modal = this.add.graphics();
        modal.setDepth(1001);
        modal.fillStyle(0x34495e, 0.95);
        modal.fillRoundedRect(centerX - 300, centerY - 100, 600, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 300, centerY - 100, 600, 200, 15);

        // Title
        const title = this.add.text(centerX, centerY - 50, 'Enter Character Name', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        title.setDepth(1002);

        // Input field using RexUI
        const inputText = this.rexUI.add.inputText({
            x: centerX,
            y: centerY,
            width: 500,
            height: 40,
            type: 'text',
            text: this.playerCharacter && this.playerCharacter.name ? this.playerCharacter.name : '',
            placeholder: 'Enter character name...',
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#2c3e50',
            border: 2,
            borderColor: '#ffffff',
            focusBorderColor: '#3498db',
            maxLength: 50
        }).setDepth(1002);

        // OK button
        const okButton = this.add.text(centerX, centerY + 60, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setDepth(1002);
        okButton.setInteractive();
        okButton.on('pointerdown', () => {
            const name = inputText.text.trim();
            if (name) {
                if (!this.playerCharacter) {
                    this.playerCharacter = {};
                }
                this.playerCharacter.name = name;
                this.nameText.setText(name);
                this.nameText.setColor('#ffffff');
            }
            
            // Clean up
            overlay.destroy();
            modal.destroy();
            title.destroy();
            inputText.destroy();
            okButton.destroy();
            blocker.destroy();
        });
    }

    showDescriptionInput() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create blocker
        const blocker = this.add.rectangle(
            this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height,
            0x000000,
            0.5
        );
        blocker.setInteractive();

        // Create overlay
        const overlay = this.add.graphics();
        overlay.setDepth(1000);
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Create modal
        const modal = this.add.graphics();
        modal.setDepth(1001);
        modal.fillStyle(0x34495e, 0.95);
        modal.fillRoundedRect(centerX - 300, centerY - 150, 600, 300, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 300, centerY - 150, 600, 300, 15);

        // Title
        const title = this.add.text(centerX, centerY - 100, 'Enter Character Description', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        title.setDepth(1002);

        // Input field using RexUI
        const inputText = this.rexUI.add.inputText({
            x: centerX,
            y: centerY,
            width: 500,
            height: 120,
            type: 'textarea',
            text: this.playerCharacter && this.playerCharacter.description ? this.playerCharacter.description : '',
            placeholder: 'Enter character description...',
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#2c3e50',
            border: 2,
            borderColor: '#ffffff',
            focusBorderColor: '#3498db',
            maxLength: 100
        }).setDepth(1002);

        // OK button
        const okButton = this.add.text(centerX, centerY + 100, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setDepth(1002);
        okButton.setInteractive();
        okButton.on('pointerdown', () => {
            const description = inputText.text.trim();
            if (description) {
                if (!this.playerCharacter) {
                    this.playerCharacter = {};
                }
                this.playerCharacter.description = description;
                this.descText.setText(description);
                this.descText.setColor('#ffffff');
            }
            
            // Clean up
            overlay.destroy();
            modal.destroy();
            title.destroy();
            inputText.destroy();
            okButton.destroy();
            blocker.destroy();
        });
    }
}
