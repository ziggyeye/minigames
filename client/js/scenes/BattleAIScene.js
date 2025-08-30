import { GoogleGenerativeAI } from "@google/generative-ai";

export default class BattleAIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleAIScene' });
        this.playerCharacter = null;
        this.aiCharacter = null;
        this.battleResult = null;
        this.isLoading = false;
        this.genAI = null;
        this.model = null;
        
        // Battle statistics
        this.battleStats = {
            totalBattles: 0,
            wins: 0,
            losses: 0,
            ties: 0
        };
        
        // Load stats from localStorage
        this.loadBattleStats();
    }

    preload() {
        // Load any assets needed for the battle scene
        this.load.image('background', '/assets/background.svg');
    }

    create() {


        // Initialize Google GenAI
        this.initializeGenAI();
        
        // Create background
        this.createBackground();
        
        // Create UI elements
        this.createUI();
        
        // Initialize character creation
        this.showCharacterCreation();
    }

    initializeGenAI() {
        try {
            // Initialize Google GenAI with API key
            const apiKey = this.getAPIKey();
            if (apiKey) {
                this.genAI = new GoogleGenerativeAI(apiKey);
                this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                console.log('Google GenAI initialized successfully');
            } else {
                console.warn('Google GenAI API key not found, using fallback battle generation');
            }
        } catch (error) {
            console.error('Failed to initialize Google GenAI:', error);
        }
    }

    getAPIKey() {
        // Debug logging
        console.log('Environment check:', {
            processEnv: process.env.GOOGLE_GENAI_API_KEY,
            localStorage: localStorage.getItem('GOOGLE_GENAI_API_KEY'),
            hasProcessEnv: !!process.env.GOOGLE_GENAI_API_KEY,
            hasLocalStorage: !!localStorage.getItem('GOOGLE_GENAI_API_KEY')
        });
        
        // Try to get API key from environment variables first, then localStorage as fallback
        // const apiKey = process.env.GOOGLE_GENAI_API_KEY || 
        //               localStorage.getItem('GOOGLE_GENAI_API_KEY') || 
        //               null;
        const apiKey = null;

        console.log('Final API key result:', apiKey ? 'Found' : 'Not found');
        return apiKey;
    }

    loadBattleStats() {
        try {
            const savedStats = localStorage.getItem('battleStats');
            if (savedStats) {
                this.battleStats = JSON.parse(savedStats);
            }
        } catch (error) {
            console.error('Error loading battle stats:', error);
        }
    }

    saveBattleStats() {
        try {
            localStorage.setItem('battleStats', JSON.stringify(this.battleStats));
        } catch (error) {
            console.error('Error saving battle stats:', error);
        }
    }

    updateBattleStats(result) {
        this.battleStats.totalBattles++;
        
        if (result === 'win') {
            this.battleStats.wins++;
        } else if (result === 'loss') {
            this.battleStats.losses++;
        } else if (result === 'tie') {
            this.battleStats.ties++;
        }
        
        this.saveBattleStats();
    }

    getWinRate() {
        if (this.battleStats.totalBattles === 0) return 0;
        return Math.round((this.battleStats.wins / this.battleStats.totalBattles) * 100);
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
        this.add.text(this.cameras.main.centerX, 50, '⚔️ Battle AI Arena', {
            fontSize: '48px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
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
    }

    showCharacterCreation() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create form background
        const formBg = this.add.graphics();
        formBg.fillStyle(0xffffff, 0.1);
        formBg.fillRoundedRect(centerX - 300, centerY - 200, 600, 400, 15);
        formBg.lineStyle(2, 0xffffff, 0.3);
        formBg.strokeRoundedRect(centerX - 300, centerY - 200, 600, 400, 15);

        // Title
        this.add.text(centerX, centerY - 150, 'Create Your Character', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // API Key button (if not set)
        // if (!this.getAPIKey()) {
        //     const apiKeyButton = this.add.text(centerX + 200, centerY - 150, '🔑 Set API Key', {
        //         fontSize: '14px',
        //         fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //         color: '#ffffff',
        //         backgroundColor: '#f39c12',
        //         padding: { x: 8, y: 4 }
        //     });
        //     apiKeyButton.setInteractive();
        //     apiKeyButton.on('pointerdown', () => {
        //         this.showAPIKeyInput();
        //     });
        // }

        // Name input label
        this.add.text(centerX - 250, centerY - 80, 'Character Name:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        // Name input field (simulated with text)
        this.nameText = this.add.text(centerX - 250, centerY - 50, 'Enter name here...', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#cccccc',
            backgroundColor: '#2c3e50',
            padding: { x: 10, y: 8 }
        });
        this.nameText.setInteractive();
        this.nameText.on('pointerdown', () => {
            this.showNameInput();
        });

        // Description input label
        this.add.text(centerX - 250, centerY, 'Character Description:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        // Description input field (simulated with text)
        this.descText = this.add.text(centerX - 250, centerY + 30, 'Enter description here...', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#cccccc',
            backgroundColor: '#2c3e50',
            padding: { x: 10, y: 8 },
            wordWrap: { width: 500 }
        });
        this.descText.setInteractive();
        this.descText.on('pointerdown', () => {
            this.showDescriptionInput();
        });

        // Battle button
        const battleButton = this.add.text(centerX, centerY + 120, '⚔️ Start Battle!', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        battleButton.setInteractive();
        battleButton.on('pointerdown', () => {
            this.startBattle();
        });

        // Instructions
        this.add.text(centerX, centerY + 180, 'Click on the input fields to enter your character details', {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.7
        }).setOrigin(0.5);
    }

    showAPIKeyInput() {
        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create modal background
        const modal = this.add.graphics();
        modal.fillStyle(0x2c3e50, 0.95);
        modal.fillRoundedRect(centerX - 250, centerY - 150, 500, 300, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 250, centerY - 150, 500, 300, 15);

        // Title
        const titleText = this.add.text(centerX, centerY - 120, '🔑 Enter Google GenAI API Key', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Instructions
        const instructionsText = this.add.text(centerX, centerY - 80, 'Get your API key from: https://makersuite.google.com/app/apikey', {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);

        // Create RexUI InputText
        const inputText = this.add.rexInputText(centerX - 200, centerY - 30, 400, 40, {
            type: 'text',
            placeholder: 'Enter your API key here...',
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            borderColor: '#3498db',
            borderWidth: 2,
            borderRadius: 8,
            padding: { x: 10, y: 8 },
            maxLength: 100,
            selectAll: true,
            useDom: false
        });

        // Buttons
        const saveButton = this.add.text(centerX - 80, centerY + 50, 'Save', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        saveButton.setInteractive();

        const cancelButton = this.add.text(centerX + 80, centerY + 50, 'Cancel', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        cancelButton.setInteractive();

        // Event handlers
        const cleanup = () => {
            overlay.destroy();
            modal.destroy();
            titleText.destroy();
            instructionsText.destroy();
            inputText.destroy();
            saveButton.destroy();
            cancelButton.destroy();
        };

        // Handle Enter key
        inputText.on('keydown-ENTER', () => {
            const apiKey = inputText.text.trim();
            if (apiKey) {
                localStorage.setItem('GOOGLE_GENAI_API_KEY', apiKey);
                this.initializeGenAI();
                this.showSuccess('API Key saved! AI battles will now use Google GenAI.');
            }
            cleanup();
        });

        // Handle Escape key
        inputText.on('keydown-ESC', cleanup);

        saveButton.on('pointerdown', () => {
            const apiKey = inputText.text.trim();
            if (apiKey) {
                localStorage.setItem('GOOGLE_GENAI_API_KEY', apiKey);
                this.initializeGenAI();
                this.showSuccess('API Key saved! AI battles will now use Google GenAI.');
            }
            cleanup();
        });

        cancelButton.on('pointerdown', cleanup);

        // Focus the input by clicking on it
        inputText.setInteractive();
        inputText.on('pointerdown', () => {
            inputText.setActive(true);
        });
        
        // Auto-focus after a short delay
        this.time.delayedCall(100, () => {
            inputText.setActive(true);
        });
    }

    showSuccess(message) {
        // Create success modal
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const modal = this.add.graphics();
        modal.fillStyle(0x27ae60, 0.95);
        modal.fillRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);

        this.add.text(centerX, centerY - 60, '✅ Success', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(centerX, centerY - 10, message, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: 350 }
        }).setOrigin(0.5);

        const okButton = this.add.text(centerX, centerY + 50, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setInteractive();
        okButton.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            okButton.destroy();
        });
    }

    showNameInput() {
        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create modal background
        const modal = this.add.graphics();
        modal.fillStyle(0x2c3e50, 0.95);
        modal.fillRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);

        // Title
        const titleText = this.add.text(centerX, centerY - 70, '👤 Enter Character Name', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Create RexUI InputText
        const inputText = this.add.rexInputText(centerX - 150, centerY - 20, 300, 40, {
            type: 'text',
            placeholder: 'Enter your character name...',
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            borderColor: '#3498db',
            borderWidth: 2,
            borderRadius: 8,
            padding: { x: 10, y: 8 },
            maxLength: 20,
            selectAll: true,
            useDom: false
        });

        // Buttons
        const saveButton = this.add.text(centerX - 60, centerY + 40, 'Save', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        saveButton.setInteractive();

        const cancelButton = this.add.text(centerX + 60, centerY + 40, 'Cancel', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        cancelButton.setInteractive();

        // Event handlers
        const cleanup = () => {
            overlay.destroy();
            modal.destroy();
            titleText.destroy();
            inputText.destroy();
            saveButton.destroy();
            cancelButton.destroy();
        };

        // Handle Enter key
        inputText.on('keydown-ENTER', () => {
            const name = inputText.text.trim();
            if (name) {
                this.playerCharacter = { name: name, description: '' };
                this.nameText.setText(name);
                this.nameText.setColor('#ffffff');
            }
            cleanup();
        });

        // Handle Escape key
        inputText.on('keydown-ESC', cleanup);

        saveButton.on('pointerdown', () => {
            const name = inputText.text.trim();
            if (name) {
                this.playerCharacter = { name: name, description: '' };
                this.nameText.setText(name);
                this.nameText.setColor('#ffffff');
            }
            cleanup();
        });

        cancelButton.on('pointerdown', cleanup);

        // Focus the input by clicking on it
        inputText.setInteractive();
        inputText.on('pointerdown', () => {
            inputText.setActive(true);
        });
        
        // Auto-focus after a short delay
        this.time.delayedCall(100, () => {
            inputText.setActive(true);
        });
    }

    showDescriptionInput() {
        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create modal background
        const modal = this.add.graphics();
        modal.fillStyle(0x2c3e50, 0.95);
        modal.fillRoundedRect(centerX - 250, centerY - 150, 500, 300, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 250, centerY - 150, 500, 300, 15);

        // Title
        const titleText = this.add.text(centerX, centerY - 120, '📝 Enter Character Description', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Instructions
        const instructionsText = this.add.text(centerX, centerY - 80, 'Describe your character\'s powers, abilities, weapons, etc.', {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        }).setOrigin(0.5);

        // Create RexUI InputText for multi-line description
        const inputText = this.add.rexInputText(centerX - 200, centerY - 30, 400, 100, {
            type: 'textarea',
            placeholder: 'Enter your character description...\n\nExample: A powerful warrior with lightning magic, wielding a legendary sword and wearing enchanted armor.',
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            borderColor: '#3498db',
            borderWidth: 2,
            borderRadius: 8,
            padding: { x: 10, y: 8 },
            maxLength: 500,
            selectAll: true,
            wrap: {
                mode: 'word',
                width: 380
            }
        });

        // Buttons
        const saveButton = this.add.text(centerX - 80, centerY + 80, 'Save', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        saveButton.setInteractive();

        const cancelButton = this.add.text(centerX + 80, centerY + 80, 'Cancel', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        cancelButton.setInteractive();

        // Event handlers
        const cleanup = () => {
            overlay.destroy();
            modal.destroy();
            titleText.destroy();
            instructionsText.destroy();
            inputText.destroy();
            saveButton.destroy();
            cancelButton.destroy();
        };

        // Handle Ctrl+Enter key
        inputText.on('keydown-CTRL+ENTER', () => {
            const description = inputText.text.trim();
            if (description) {
                if (!this.playerCharacter) {
                    this.playerCharacter = { name: '', description: '' };
                }
                this.playerCharacter.description = description;
                this.descText.setText(description);
                this.descText.setColor('#ffffff');
            }
            cleanup();
        });

        // Handle Escape key
        inputText.on('keydown-ESC', cleanup);

        saveButton.on('pointerdown', () => {
            const description = inputText.text.trim();
            if (description) {
                if (!this.playerCharacter) {
                    this.playerCharacter = { name: '', description: '' };
                }
                this.playerCharacter.description = description;
                this.descText.setText(description);
                this.descText.setColor('#ffffff');
            }
            cleanup();
        });

        cancelButton.on('pointerdown', cleanup);

        // Focus the input by clicking on it
        inputText.setInteractive();
        inputText.on('pointerdown', () => {
            inputText.setActive(true);
        });
        
        // Auto-focus after a short delay
        this.time.delayedCall(100, () => {
            inputText.setActive(true);
        });
    }

    startBattle() {
        if (!this.playerCharacter || !this.playerCharacter.name || !this.playerCharacter.description) {
            this.showError('Please enter both name and description for your character!');
            return;
        }

        this.isLoading = true;
        this.showLoadingScreen();
        
        // Generate AI opponent
        this.generateAIOpponent();
    }

    generateAIOpponent() {
        const aiCharacters = [
            {
                name: "Shadow Blade",
                description: "A mysterious ninja warrior with the ability to teleport through shadows. Master of stealth and assassination techniques. Wields dual katanas and can create shadow clones."
            },
            {
                name: "Thunder Fist",
                description: "A powerful martial artist who can channel electricity through his fists. His punches create thunderous shockwaves and can paralyze opponents. Master of lightning-fast strikes."
            },
            {
                name: "Crystal Guardian",
                description: "A mystical warrior made of living crystal. Can create impenetrable barriers and shoot crystal shards. Immune to most physical attacks and can regenerate from any damage."
            },
            {
                name: "Flame Phoenix",
                description: "A fire elemental with the ability to transform into a phoenix. Can control fire and heat, fly at incredible speeds, and resurrect from ashes. Master of fire magic."
            },
            {
                name: "Iron Titan",
                description: "A massive robot warrior with impenetrable armor. Can transform parts of its body into weapons and has superhuman strength. Immune to most conventional attacks."
            }
        ];

        this.aiCharacter = aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
        
        // Simulate battle with AI
        this.simulateBattle();
    }

    simulateBattle() {
        if (this.model) {
            // Use Google GenAI to generate battle result
            this.generateAIBattleResult();
        } else {
            // Fallback to local generation
            setTimeout(() => {
                this.generateBattleResult();
            }, 2000);
        }
    }

    async generateAIBattleResult() {
        try {
            const prompt = this.createBattlePrompt();
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const battleText = response.text();
            console.log(battleText);
            // Parse the AI response
            this.parseAIBattleResult(battleText);
            
        } catch (error) {
            console.error('Error generating AI battle result:', error);
            // Fallback to local generation
            this.generateBattleResult();
        }
    }

    createBattlePrompt() {
        return `You are a creative battle narrator. Create a short, fun, and exciting battle description between two characters.

Character 1: ${this.playerCharacter.name}
Description: ${this.playerCharacter.description}

Character 2: ${this.aiCharacter.name}
Description: ${this.aiCharacter.description}

Please write a short paragraph (2-3 sentences) describing an epic battle between these characters. Include:
1. An exciting opening scene
2. How their abilities interact
3. Who wins and why (make it dramatic and fun)
4. Keep it family-friendly and entertaining
5. Put winner [WIN:{NAME}] and loser [LOSE:{NAME}] in the text

Format your response as a single paragraph.`;
    }

    parseAIBattleResult(battleText) {
        console.log('Parsing AI battle result:', battleText);
        
        // Parse winner and loser from the text using [WIN:{NAME}] and [LOSE:{NAME}] format
        const winMatch = battleText.match(/\[WIN:([^\]]+)\]/);
        const loseMatch = battleText.match(/\[LOSE:([^\]]+)\]/);
        
        let winner, loser;
        
        if (winMatch && loseMatch) {
            // Both winner and loser are specified in the text
            const winnerName = winMatch[1].trim();
            const loserName = loseMatch[1].trim();
            
            // Determine which character matches the winner name
            if (winnerName.toLowerCase() === this.playerCharacter.name.toLowerCase()) {
                winner = this.playerCharacter;
                loser = this.aiCharacter;
            } else if (winnerName.toLowerCase() === this.aiCharacter.name.toLowerCase()) {
                winner = this.aiCharacter;
                loser = this.playerCharacter;
            } else {
                // Fallback: winner name doesn't match either character
                console.warn('Winner name from AI does not match any character, using fallback logic');
                winner = this.playerCharacter;
                loser = this.aiCharacter;
            }
        } else {
            // Fallback: no clear winner/loser markers, use keyword detection
            console.warn('No clear winner/loser markers found, using keyword detection');
            const playerWins = battleText.toLowerCase().includes(this.playerCharacter.name.toLowerCase()) && 
                              (battleText.toLowerCase().includes('win') || 
                               battleText.toLowerCase().includes('victory') || 
                               battleText.toLowerCase().includes('defeat') ||
                               battleText.toLowerCase().includes('triumph'));
            
            winner = playerWins ? this.playerCharacter : this.aiCharacter;
            loser = playerWins ? this.aiCharacter : this.playerCharacter;
        }

        this.battleResult = {
            scenario: "AI-Generated Battle",
            winner: winner,
            loser: loser,
            description: battleText.trim()
        };

        // Update battle statistics
        const result = winner === this.playerCharacter ? 'win' : 'loss';
        this.updateBattleStats(result);

        console.log('Parsed battle result:', {
            winner: winner.name,
            loser: loser.name,
            description: battleText.trim(),
            result: result
        });

        this.isLoading = false;
        this.showBattleResult();
    }

    generateBattleResult() {
        // Fallback battle generation when AI is not available
        const battleScenarios = [
            "The arena crackles with energy as the two warriors face off!",
            "A fierce battle erupts in the mystical arena!",
            "The ground trembles as these powerful beings clash!",
            "Lightning and magic fill the air as the combatants engage!",
            "An epic showdown begins between these legendary fighters!"
        ];

        const scenario = battleScenarios[Math.floor(Math.random() * battleScenarios.length)];
        
        // Randomly determine winner (50/50 chance)
        const playerWins = Math.random() > 0.5;
        const winner = playerWins ? this.playerCharacter : this.aiCharacter;
        const loser = playerWins ? this.aiCharacter : this.playerCharacter;

        const battleDescriptions = [
            `${scenario} ${winner.name} demonstrates incredible skill, using ${winner.description.toLowerCase().split(' ').slice(0, 5).join(' ')} to gain the upper hand. After an intense exchange, ${winner.name} emerges victorious!`,
            `${scenario} The battle is fierce and evenly matched, but ${winner.name}'s unique abilities prove decisive. ${loser.name} puts up a valiant fight but ultimately falls to ${winner.name}'s superior tactics.`,
            `${scenario} ${winner.name} showcases their mastery of combat, turning the tide of battle with their extraordinary powers. ${loser.name} fights bravely but cannot overcome ${winner.name}'s overwhelming strength.`
        ];

        this.battleResult = {
            scenario: scenario,
            winner: winner,
            loser: loser,
            description: battleDescriptions[Math.floor(Math.random() * battleDescriptions.length)]
        };

        // Update battle statistics
        const result = winner === this.playerCharacter ? 'win' : 'loss';
        this.updateBattleStats(result);

        this.isLoading = false;
        this.showBattleResult();
    }

    showLoadingScreen() {
        // Clear previous content
        this.children.removeAll();
        this.createBackground();
        this.createUI();

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Loading text
        const loadingText = this.model ? '🤖 AI Battle Analysis...' : '⚔️ Preparing Battle...';
        this.add.text(centerX, centerY - 50, loadingText, {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Loading spinner
        const spinner = this.add.graphics();
        spinner.lineStyle(4, 0xffffff, 0.8);
        spinner.strokeCircle(centerX, centerY + 50, 30);

        // Animate spinner
        this.tweens.add({
            targets: spinner,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });

        // Loading text
        const statusText = this.model ? 
            'Google GenAI is analyzing the combatants and generating an epic battle...' : 
            'Generating battle scenario...';
        this.add.text(centerX, centerY + 100, statusText, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: 600 }
        }).setOrigin(0.5);
    }

    showBattleResult() {
        // Clear previous content
        this.children.removeAll();
        this.createBackground();
        this.createUI();

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Create battle result background with fixed dimensions
        const modalWidth = 600;
        const modalHeight = 700;
        const modalX = centerX - modalWidth / 2;
        const modalY = centerY - modalHeight / 2;

        const resultBg = this.add.graphics();
        resultBg.fillStyle(0x2c3e50, 0.95); // Dark grey background
        resultBg.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        resultBg.lineStyle(2, 0xffffff, 0.2);
        resultBg.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);

        // Header - "Recent Battle Result"
        this.add.text(modalX + 30, modalY + 30, 'Recent Battle Result', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });

        // Combatants VS display
        const vsY = modalY + 100;
        
        // Player character name (left)
        // this.add.text(modalX + 100, vsY, this.playerCharacter.name, {
        //     fontSize: '32px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     fontStyle: 'bold'
        // });

        // VS separator (center)
        this.add.text(centerX, vsY, this.playerCharacter.name + ' VS ' + this.aiCharacter.name, {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#00ff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // AI character name (right)
        // this.add.text(modalX + modalWidth - 100, vsY, this.aiCharacter.name, {
        //     fontSize: '32px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     fontStyle: 'bold'
        // }).setOrigin(1, 0);

        // Battle description
        const descY = vsY + 80;
        const descText = this.add.text(modalX + 50, descY, this.battleResult.description, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            wordWrap: { width: modalWidth - 100 },
            lineSpacing: 8
        });

        // Battle outcome section
        const outcomeY = descY + descText.height + 60;
        
        // Skull emoji for defeat
        const skullEmoji = this.battleResult.winner === this.playerCharacter ? '🎉' : '💀';
        this.add.text(centerX, outcomeY, skullEmoji, {
            fontSize: '48px'
        }).setOrigin(0.5);

        // Outcome text
        const outcomeText = this.battleResult.winner === this.playerCharacter ? 'Victory' : 'Defeat';
        const outcomeColor = this.battleResult.winner === this.playerCharacter ? '#2ecc71' : '#e74c3c';
        
        this.add.text(centerX, outcomeY + 60, outcomeText, {
            fontSize: '36px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: outcomeColor,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Battle statistics section
        const statsY = outcomeY + 120;
        
        // Stats background
        const statsBg = this.add.graphics();
        statsBg.fillStyle(0xffffff, 0.1);
        statsBg.fillRoundedRect(centerX - 200, statsY, 400, 80, 10);
        statsBg.lineStyle(1, 0xffffff, 0.3);
        statsBg.strokeRoundedRect(centerX - 200, statsY, 400, 80, 10);

        // Stats title
        this.add.text(centerX, statsY + 10, 'Battle Statistics', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Stats row 1: Total Battles and Win Rate
        this.add.text(centerX - 150, statsY + 30, `Total: ${this.battleStats.totalBattles}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        this.add.text(centerX + 50, statsY + 30, `Win Rate: ${this.getWinRate()}%`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#2ecc71',
            fontStyle: 'bold'
        });

        // Stats row 2: Wins, Losses, Ties
        this.add.text(centerX - 150, statsY + 50, `W: ${this.battleStats.wins}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#2ecc71'
        });

        this.add.text(centerX - 50, statsY + 50, `L: ${this.battleStats.losses}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c'
        });

        this.add.text(centerX + 50, statsY + 50, `T: ${this.battleStats.ties}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#f39c12'
        });

        // Battle again button
        const buttonY = statsY + 100;
        const battleAgainButton = this.add.text(centerX, buttonY, '⚔️ Battle Again!', {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        battleAgainButton.setInteractive();
        battleAgainButton.on('pointerdown', () => {
            this.startNewBattle();
        });

        // Back to menu button
        const backButton = this.add.text(centerX, buttonY + 50, '← Back to Menu', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5);
        backButton.setInteractive();
        backButton.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        // If content is too tall, adjust the modal height
        const totalContentHeight = buttonY + 100; // Add bottom padding
        if (totalContentHeight > modalHeight) {
            resultBg.clear();
            resultBg.fillStyle(0x2c3e50, 0.95);
            resultBg.fillRoundedRect(modalX, modalY, modalWidth, totalContentHeight, 15);
            resultBg.lineStyle(2, 0xffffff, 0.2);
            resultBg.strokeRoundedRect(modalX, modalY, modalWidth, totalContentHeight, 15);
        }
    }

    showError(message) {
        // Create error modal
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const modal = this.add.graphics();
        modal.fillStyle(0xe74c3c, 0.95);
        modal.fillRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);

        this.add.text(centerX, centerY - 60, '❌ Error', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(centerX, centerY - 10, message, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: 350 }
        }).setOrigin(0.5);

        const okButton = this.add.text(centerX, centerY + 50, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setInteractive();
        okButton.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            okButton.destroy();
        });
    }

    update() {
        // Add any update logic here if needed
    }

    restartGame() {
        this.scene.restart();
    }

    startNewBattle() {
        // Keep the same player character but generate a new AI opponent
        this.isLoading = true;
        this.showLoadingScreen();
        
        // Generate new AI opponent
        this.generateAIOpponent();
    }
}
