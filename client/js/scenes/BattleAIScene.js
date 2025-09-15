import { API_ENDPOINTS } from '../../config.js';


export default class BattleAIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleAIScene' });
        this.playerCharacter = null;
        this.aiCharacter = null;
        this.battleResult = null;
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
        
        // User characters cache
        this.userCharacters = [];
    }

    preload() {
        // Load any assets needed for the battle scene
        this.load.image('background', '/assets/background.svg');
    }

    async create(data) {
        // Store data passed from CharacterSelectionScene
        this.selectedCharacter = data?.selectedCharacter || null;
        this.isNewCharacter = data?.isNewCharacter || false;
        
        console.log('🎭 BattleAIScene started with:', { selectedCharacter: this.selectedCharacter, isNewCharacter: this.isNewCharacter });
        
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
            
            // Load character level, battle stats, and cooldown status
            this.loadCharacterLevel(this.playerCharacter.name);
            this.loadBattleStatsFromServer();
            
            // Load cooldown and gems, then show character data
            await this.loadCooldownAndGemsFromServer();
            
            // Show character data (immutable)
            this.showCharacterData();
        } else {
            // Reset stats to default for new character
            this.characterStats = { STR: 1, DEX: 1, CON: 1, INT: 1 };
            this.allocatedPoints = 4;
            console.log('📊 Reset stats to default for new character:', this.characterStats);
            
            // Load user characters for new character creation
           // this.loadUserCharacters();
           this.playerCharacter = null; 
           this.showCharacterData();
        }
        
        // Always load battle statistics
        this.loadBattleStatsFromServer();
    }





    async loadBattleStatsFromServer() {
        try {
            const discordUserId = this.getDiscordUserId();
            const characterName = this.playerCharacter?.name;
            
            if (!characterName) {
                console.log('ℹ️  No character selected, using default battle stats');
                return;
            }
            
            console.log('📊 Loading battle statistics from server for character:', characterName, 'user:', discordUserId);

            const getCharacterBattleStatsUrl = API_ENDPOINTS.characterBattleStats
                .replace(':discordUserId', discordUserId)
                .replace(':characterName', encodeURIComponent(characterName));
                
            const response = await fetch(getCharacterBattleStatsUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            
            if (result.success && result.battleStats) {
                this.battleStats = result.battleStats;
                console.log('✅ Character battle statistics loaded:', this.battleStats);
            } else {
                console.log('ℹ️  No battle statistics found for character, using defaults');
            }
        } catch (error) {
            console.error('❌ Error loading character battle statistics:', error);
            // Keep default stats on error
        }
    }

    async loadCharacterLevel(characterName) {
        try {
            const discordUserId = this.getDiscordUserId();
            console.log('📊 Loading character level for:', characterName);

            // For now, we'll set it to 0 since we don't have a direct API endpoint for character levels
            // The level will be updated after the first battle
            this.characterLevel = 0;
            console.log('📊 Character level set to:', this.characterLevel);
        } catch (error) {
            console.error('❌ Error loading character level:', error);
            this.characterLevel = 0;
        }
    }

    async loadCooldownAndGemsFromServer() {
        try {
            const discordUserId = this.getDiscordUserId();
            console.log('⏰ Loading cooldown and gems status for:', discordUserId);

            // Get user characters to get cooldown and gems info
            const getUserCharactersUrl = API_ENDPOINTS.getUserCharacters.replace(':discordUserId', discordUserId);
            const response = await fetch(`${getUserCharactersUrl}?limit=1`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            
            if (result.success) {
                // Handle cooldown status from server
                if (result.cooldownStatus) {
                    this.cooldownExpiry = result.cooldownStatus.cooldownExpiry ? new Date(result.cooldownStatus.cooldownExpiry) : null;
                    console.log('⏰ Cooldown status loaded:', result.cooldownStatus);
                    console.log('⏰ Cooldown expiry set to:', this.cooldownExpiry);
                    
                    // Check if we're currently on cooldown
                    const cooldownStatus = this.checkCooldown();
                    console.log('⏰ Current cooldown status:', cooldownStatus);
                } else {
                    console.log('⏰ No cooldown status in server response');
                    this.cooldownExpiry = null;
                }
                
                // Handle battle gems from server
                if (result.battleGems !== undefined) {
                    this.battleGems = result.battleGems;
                    console.log('💎 Battle gems loaded:', this.battleGems);
                } else {
                    console.log('💎 No battle gems in server response');
                }
            } else {
                console.log('⚠️ Failed to load cooldown and gems status:', result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Error loading cooldown and gems status:', error);
            // Keep default values on error
        }
    }

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

    async addBattleGems() {
        try {
            const discordUserId = this.getDiscordUserId();
            console.log('💎 Starting Discord consumable purchase for:', discordUserId);

            // Check if Discord SDK is available
            if (!window.DiscordSDK) {
                this.showError('Discord SDK not available. Please run this in Discord.');
                return;
            }

            const entitlements = await window.DiscordSDK.commands.getEntitlements();
            console.log('💎 Entitlements:', entitlements.entitlements);
            let bought = false;

            let purchaseResult = null;
            if (entitlements.entitlements.length > 0 && !entitlements.entitlements[0].consumed) {
                console.log('💎 Entitlement found and not consumed');
                bought = true;
                purchaseResult = entitlements.entitlements;
            }

            const skuName = '10_gems';
            if (!bought) {
            // Show loading message
                console.log('🛒 Opening Discord purchase dialog...');

                const skuId = '1415896807908835438'
                

                // Start Discord consumable purchase flow
                purchaseResult = await window.DiscordSDK.commands.startPurchase({
                    sku_id: skuId // The SKU ID for 10 gems
                });

                console.log('💳 Discord purchase result:', purchaseResult);
            }

            if (purchaseResult != null && purchaseResult.length > 0) {
                console.log("✅ User owns the SKU, unlock features now");


                const response = await fetch(API_ENDPOINTS.addBattleGems, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        discordUserId: discordUserId,
                        skuId: skuName,
                        purchaseToken: purchaseResult[0].id
                    })
                });

                const result = await response.json();
                console.log('✅ Battle gems purchase processing result:', result);
                if (result.success) {
                    this.battleGems = result.battleGems;
                    console.log('✅ Battle gems purchased:', result.message);
                    this.showMessage(`✅ ${result.message}`);
                    
                    // Refresh the character data UI to show updated gems
                    //this.showCharacterData();
                    // refresh scene
                    this.scene.restart()
                } else {
                    console.log('⚠️ Battle gems purchase processing failed:', result.message);
                    this.showError(`⚠️ ${result.message}`);
                }
              } else {
                console.log("⚠️ Purchase didn’t create entitlement (unexpected)");
              }

        } catch (error) {
            console.error('❌ Error in battle gems purchase flow:', error);
            if (error.message && error.message.includes('startPurchase')) {
                this.showError('❌ Discord purchase system not available. Please try again later.');
            } else {
                this.showError('❌ Failed to purchase battle gems. Please try again.');
            }
        }
    }

    /**
     * Get user-friendly error message for Discord purchase codes
     * @param {number} code - Discord purchase result code
     * @returns {string} Error message
     */
    getDiscordPurchaseErrorMessage(code) {
        const errorMessages = {
            1: 'Purchase was cancelled by user',
            2: 'Purchase failed due to network error',
            3: 'Purchase failed due to invalid SKU',
            4: 'Purchase failed due to insufficient funds',
            5: 'Purchase failed due to region restrictions',
            6: 'Purchase failed due to age restrictions',
            7: 'Purchase failed due to payment method issues',
            8: 'Purchase failed due to system error',
            9: 'Purchase failed due to rate limiting',
            10: 'Purchase failed due to invalid user'
        };
        
        return errorMessages[code] || `Unknown error (code: ${code})`;
    }

    startCooldownTimer() {
        // Clear existing timer
        if (this.cooldownTimer) {
            clearInterval(this.cooldownTimer);
        }
        
        // Update cooldown display every second
        this.cooldownTimer = setInterval(() => {
            this.updateCooldownDisplay();
        }, 1000);
    }

    stopCooldownTimer() {
        if (this.cooldownTimer) {
            clearInterval(this.cooldownTimer);
            this.cooldownTimer = null;
        }
    }

    updateCooldownDisplay() {
        const cooldownStatus = this.checkCooldown();
        
        // Update main battle button (in character data screen)
        if (this.pvpBattleButton) {
            if (cooldownStatus.onCooldown) {
                const timeRemaining = this.formatTimeRemaining(cooldownStatus.timeRemaining);
                //  this.battleButton.list[1].setText(`⏰ Cooldown: ${timeRemaining}`);
                //  this.battleButton.list[0].clear();
                //  this.battleButton.list[0].fillStyle(0x95a5a6, 1);
                //  this.battleButton.list[0].fillRoundedRect(0, 0, 180, 40, 12);
                //  this.battleButton.disableInteractive();
                
                 this.pvpBattleButton.list[1].setText(`⏰ Cooldown: ${timeRemaining}`);
                 this.pvpBattleButton.list[0].clear();
                 this.pvpBattleButton.list[0].fillStyle(0x95a5a6, 1);
                 this.pvpBattleButton.list[0].fillRoundedRect(0, 0, 180, 40, 12);
                 this.pvpBattleButton.disableInteractive();
                
                // Enable battle with gem button if it exists
                // if (this.battleWithGemButton) {
                //     this.battleWithGemButton.setInteractive();
                // }
                
                // Enable PVP with gem button if it exists
                if (this.pvpWithGemButton) {
                    this.pvpWithGemButton.setInteractive();
                }
            } else {
                // Cooldown expired
                 console.log('Cooldown expired');
                //  this.battleButton.list[1].setText('⚔️ PVE Battle!');
                //  this.battleButton.list[0].clear();
                //  this.battleButton.list[0].fillStyle(0x0300ff, 1);
                //  this.battleButton.list[0].fillRoundedRect(0, 0, 180, 40, 12);
                //  this.battleButton.setInteractive();
                //  this.battleButton.on('pointerdown', () => {
                //      this.startBattle();
                //  });

                 this.pvpBattleButton.list[1].setText('⚔️ Battle!');
                 this.pvpBattleButton.list[0].clear();
                 this.pvpBattleButton.list[0].fillStyle(0x9b59b6, 1);
                 this.pvpBattleButton.list[0].fillRoundedRect(0, 0, 180, 40, 12);
                 this.pvpBattleButton.setInteractive();
                 this.pvpBattleButton.on('pointerdown', () => {
                     this.startPVPBattle();
                 });

            }
        }
        
        // Stop timer if cooldown expired
        if (!cooldownStatus.onCooldown) {
            this.stopCooldownTimer();
        }
    }

    // async loadUserCharacters() {
    //     try {
    //         // Get Discord user ID
    //         const discordUserId = this.getDiscordUserId();
            
    //         console.log('🎭 Loading user characters for:', discordUserId);
    //         const getUserCharactersUrl = API_ENDPOINTS.getUserCharacters.replace(':discordUserId', discordUserId);
    //         const response = await fetch(`${getUserCharactersUrl}?limit=10`, {
    //             method: 'GET',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             }
    //         });

    //         const result = await response.json();
            
    //         if (result.success && result.characters) {
    //             this.userCharacters = result.characters;
    //             console.log(`✅ Loaded ${this.userCharacters.length} characters`, this.userCharacters);
                
    //             // Handle cooldown status from server
    //             if (result.cooldownStatus) {
    //                 this.cooldownExpiry = result.cooldownStatus.cooldownExpiry ? new Date(result.cooldownStatus.cooldownExpiry) : null;
    //                 console.log('⏰ Cooldown status:', result.cooldownStatus);
    //             }
                
    //             // Handle battle gems from server
    //             if (result.battleGems !== undefined) {
    //                 this.battleGems = result.battleGems;
    //                 console.log('💎 Battle gems loaded:', this.battleGems);
    //             }
                
    //             // Auto-fill with first character if available
    //             if (this.userCharacters.length > 0) {
    //                 const firstCharacter = this.userCharacters[0];
    //                 this.playerCharacter = {
    //                     name: firstCharacter.characterName,
    //                     description: firstCharacter.description
    //                 };
                    
    //                 // Load character stats if available
    //                 if (firstCharacter.stats) {
    //                     this.characterStats = { ...firstCharacter.stats };
    //                     this.allocatedPoints = Object.values(this.characterStats).reduce((sum, val) => sum + val, 0);
    //                     console.log('📊 Loaded character stats:', this.characterStats);
    //                 }
                    
    //                 // Load character level
    //                 await this.loadCharacterLevel(firstCharacter.characterName);
                    
    //                 console.log('🎭 Auto-filled with character:', firstCharacter.characterName);
    //             }
    //         } else {
    //             console.log('⚠️ No characters found or failed to load:', result.error || 'Unknown error');
    //             this.userCharacters = [];
    //         }
    //     } catch (error) {
    //         console.error('❌ Error loading user characters:', error);
    //         this.userCharacters = [];
    //     }
        
    //     // Initialize character creation form (with auto-filled data if available)
    //     this.showCharacterCreation();
    // }

    shutdown() {
        // Clean up timer when scene is destroyed
        this.stopCooldownTimer();
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

    createRoundedButton(x, y, w, h, text, color) {

        const fontSize = '18px';
        // Create background graphics
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(color, 1);
        buttonBg.fillRoundedRect(0, 0, w, h, 12); // draw rounded background

        // Add text on top
        let buttonText = this.add.text(w/2, h/2, text, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
        });

        buttonText.setOrigin(0.5);

        // Group them
        const button = this.add.container(x-w/2, y-h/2, [buttonBg, buttonText]);

        // Make container interactive with a rectangle hit area
        button.setSize(w, h);
        button.setInteractive();

        return button;
    }

    showBattleUI(top) {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
         // Check cooldown status
         const cooldownStatus = this.checkCooldown();
        
         // Battle button
         let battleButtonText = '⚔️ PVE Battle!';
         let battleButtonColor = 0x0300ff;
         let battleButtonEnabled = true;
         let battlePVPButtonText = '⚔️ Battle!';
         

       // this.battleWithGemButton = this.createRoundedButton(centerX-100, top + 50, 180, 40, '💎 PVE with Gem', 0x9b59b6);
        this.pvpWithGemButton = this.createRoundedButton(centerX, top + 50, 180, 40, '💎 Battle with Gem', 0x9b59b6);
         
         if (cooldownStatus.onCooldown) {
             const timeRemaining = this.formatTimeRemaining(cooldownStatus.timeRemaining);
             battleButtonText = `⏰ Cooldown: ${timeRemaining}`;
             battleButtonColor = 0x95a5a6;
             battleButtonEnabled = false;

             battlePVPButtonText =`⏰ Cooldown: ${timeRemaining}`;
         
            //   this.battleWithGemButton.setInteractive();
            //   this.battleWithGemButton.list[0].clear();
            //   this.battleWithGemButton.list[0].fillStyle(0x9b59b6, 1);
            //   this.battleWithGemButton.list[0].fillRoundedRect(0, 0, 180, 40, 12);

            // console.log('battleButtonEnabled', battleButtonEnabled);
         }
         else {
            // this.battleWithGemButton.setBackgroundColor('#95a5a6');
            //  this.battleWithGemButton.list[0].clear();
            //  this.battleWithGemButton.list[0].fillStyle(0x95a5a6, 1);
            //  this.battleWithGemButton.list[0].fillRoundedRect(0, 0, 180, 40, 12);
            //  this.battleWithGemButton.disableInteractive();
            //  console.log('NO', battleButtonEnabled);
         }

         //this.battleButton = this.createRoundedButton(centerX-100, top, 180, 40, battleButtonText, battleButtonColor);
         // PVP Battle button
         this.pvpBattleButton = this.createRoundedButton(centerX, top, 180, 40, battlePVPButtonText, battleButtonColor);

         if (battleButtonEnabled) {
            console.log('battleButtonEnabled', battleButtonEnabled);
            // this.battleButton.setInteractive();
            //  this.battleButton.on('pointerdown', () => {
            //     console.log('battleButton.onpointerdown');
            //      this.startBattle();
            //  });

             this.pvpBattleButton.setInteractive();
             this.pvpBattleButton.on('pointerdown', () => {
                 this.startPVPBattle();
             });

         }
 
         if (this.battleGems >= 1) {
            //  this.battleWithGemButton.on('pointerdown', () => {
            //      this.startBattleWithGem();
            //  });
             
             this.pvpWithGemButton.setInteractive();
             this.pvpWithGemButton.on('pointerdown', () => {
                 this.startPVPBattleWithGem();
             });
         }
         
         // Start cooldown timer if on cooldown
         if (cooldownStatus.onCooldown) {
             this.startCooldownTimer();
         }
 
         // Battle gems display and add button
         const gemsY = top + 120;
         
         // Battle gems label
         this.add.text(centerX-100, gemsY, '💎 Battle Gems:', {
             fontSize: '16px',
             fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
             color: '#f39c12',
             fontStyle: 'bold'
         });
 
         // Battle gems count
         this.add.text(centerX+30, gemsY - 4, `${this.battleGems}`, {
             fontSize: '16px',
             fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
             color: '#ffffff',
             backgroundColor: '#34495e',
             padding: { x: 10, y: 5 }
         });
 
        // Add battle gems button (disabled if at max)
        const addGemsButton = this.add.text(centerX, gemsY+50, '💎 Buy 10 Gems', {
             fontSize: '14px',
             fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
             color: '#ffffff',
             backgroundColor: '#27ae60',
             padding: { x: 15, y: 8 }
         }).setOrigin(0.5);
         
        // if (this.battleGems < 5) {
             addGemsButton.setInteractive();
             addGemsButton.on('pointerdown', () => {
                 this.addBattleGems();
             });
      //   }
 
         // Character status
         if (this.playerCharacter && this.playerCharacter.name) {
             this.add.text(centerX, gemsY + 100, `✅ Ready to battle with ${this.playerCharacter.name}`, {
                 fontSize: '12px',
                 fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                 color: '#2ecc71',
                 alpha: 0.8
             }).setOrigin(0.5);
         } else {
             this.add.text(centerX, gemsY + 100, '⚠️ No character selected - go back to select a character', {
                 fontSize: '12px',
                 fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                 color: '#f39c12',
                 alpha: 0.8
             }).setOrigin(0.5);
         }
    }

    showCharacterData() {
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

        let top = centerY - boxHeight/2 + 40;
        
        // Title
        this.add.text(centerX, top, 'Your Character', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        top += 50;

        // Character Name (read-only)
        this.add.text(centerX - 250, top, 'Character Name:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        const nameDisplayText = this.playerCharacter && this.playerCharacter.name 
            ? this.playerCharacter.name 
            : 'No character selected';
            
        top += 25;

        this.add.text(centerX - 250, top, nameDisplayText, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: this.playerCharacter && this.playerCharacter.name ? '#ffffff' : '#cccccc',
            backgroundColor: '#2c3e50',
            padding: { x: 10, y: 8 }
        });

        top += 40;

        // Character Description (read-only)
        this.add.text(centerX - 250, top, 'Character Description:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        const descDisplayText = this.playerCharacter && this.playerCharacter.description 
            ? this.playerCharacter.description 
            : 'No description available';

        top += 25;
            
        this.add.text(centerX - 250, top, descDisplayText, {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: this.playerCharacter && this.playerCharacter.description ? '#ffffff' : '#cccccc',
            backgroundColor: '#2c3e50',
            padding: { x: 10, y: 8 },
            wordWrap: { width: 500 }
        });

        top += 60;

        // Character Stats (read-only)
        this.add.text(centerX - 250, top, 'Character Stats:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });

        top += 30;

        // Display stats as read-only
        this.createReadOnlyStatsDisplay(centerX, top);

        top += 120;

        // Battle Statistics section
        this.add.text(centerX - 250, top, 'Battle Statistics:', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });

        top += 30;

        // Battle stats display
        this.createBattleStatsDisplay(centerX, top);

        top += 100;

        this.showBattleUI(top);
    }

    createReadOnlyStatsDisplay(centerX, startY) {
        const statNames = ['STR', 'DEX', 'CON', 'INT'];
        const statLabels = {
            'STR': 'Strength',
            'DEX': 'Dexterity', 
            'CON': 'Constitution',
            'INT': 'Intelligence'
        };

        statNames.forEach((stat, index) => {
            const yPos = startY + (index * 25);
            
            // Stat label
            this.add.text(centerX - 250, yPos, `${stat} (${statLabels[stat]}):`, {
                fontSize: '14px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff'
            });
            
            // Stat value display (read-only)
            this.add.text(centerX, yPos, this.characterStats[stat].toString(), {
                fontSize: '16px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                backgroundColor: '#34495e',
                padding: { x: 12, y: 4 }
            }).setOrigin(0.5);
        });
    }

    createBattleStatsDisplay(centerX, startY) {
        // Battle stats background
        const statsBg = this.add.graphics();
        statsBg.fillStyle(0xffffff, 0.1);
        statsBg.fillRoundedRect(centerX - 250, startY, 500, 60, 10);
        statsBg.lineStyle(1, 0xffffff, 0.3);
        statsBg.strokeRoundedRect(centerX - 250, startY, 500, 60, 10);

        // Stats row 1: Total Battles and Win Rate
        this.add.text(centerX - 200, startY + 15, `Total: ${this.battleStats.totalBattles}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff'
        });

        this.add.text(centerX + 50, startY + 15, `Win Rate: ${this.battleStats.winRate}%`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#2ecc71',
            fontStyle: 'bold'
        });

        // Stats row 2: Wins, Losses, Level
        this.add.text(centerX - 200, startY + 35, `W: ${this.battleStats.wins}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#2ecc71'
        });

        this.add.text(centerX - 50, startY + 35, `L: ${this.battleStats.losses}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c'
        });

        this.add.text(centerX + 50, startY + 35, `Level: ${this.characterLevel}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#f39c12',
            fontStyle: 'bold'
        });
    }

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
        
        // Reset stats button
        // const resetBtn = this.add.text(centerX + 100, startY + 140, 'Reset', {
        //     fontSize: '14px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: '#95a5a6',
        //     padding: { x: 10, y: 5 }
        // }).setOrigin(0.5);
        // resetBtn.setInteractive();
        // resetBtn.on('pointerdown', () => this.resetStats());
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

    resetStats() {
        this.characterStats = { STR: 1, DEX: 1, CON: 1, INT: 1 };
        this.allocatedPoints = 4;
        this.updateStatsDisplay();
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

        const blocker = this.add.rectangle(
            this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height,
            0x000000,
            0.5 // opacity (0 = invisible, 1 = solid black)
          );
          
          // Make it interactive so it captures all clicks
          blocker.setInteractive();

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

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

        // Create RexUI InputText with current name value
        const currentName = this.playerCharacter && this.playerCharacter.name ? this.playerCharacter.name : '';
        let inputText = this.add.rexInputText(centerX, centerY-20, 300, 40, {
            type: 'text',
            placeholder: 'Enter your character name...',
            text: currentName, // Pre-fill with current name
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            borderColor: '#3498db',
            // borderWidth: 2,
            // borderRadius: 8,
            // padding: { x: 10, y: 8 },
            maxLength: 20,
            selectAll: true
        }).setOrigin(0.5, 0.5);


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

        // Resize handler to keep elements centered
        // const updatePositions = () => {
        //     const newCenterX = this.cameras.main.width / 2;
        //     const newCenterY = this.cameras.main.height / 2;
            
        //     // Update overlay
        //     overlay.clear();
        //     overlay.fillStyle(0x000000, 0.8);
        //     overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
            
        //     // Update modal
        //     modal.clear();
        //     modal.fillStyle(0x2c3e50, 0.95);
        //     modal.fillRoundedRect(newCenterX - 200, newCenterY - 100, 400, 200, 15);
        //     modal.lineStyle(2, 0xffffff, 0.3);
        //     modal.strokeRoundedRect(newCenterX - 200, newCenterY - 100, 400, 200, 15);
            
        //     // Update text positions
        //     titleText.setPosition(newCenterX, newCenterY - 70);
        //     inputText.setPosition(newCenterX, newCenterY + 20);
        //     saveButton.setPosition(newCenterX - 60, newCenterY + 40);
        //     cancelButton.setPosition(newCenterX + 60, newCenterY + 40);
        // };

        // // Listen for resize events
        // this.scale.on('resize', updatePositions);

        // Event handlers
        const cleanup = () => {
           // this.scale.off('resize', updatePositions);
            overlay.destroy();
            modal.destroy();
            titleText.destroy();
            inputText.destroy();
            saveButton.destroy();
            cancelButton.destroy();
            blocker.destroy();
        };

        // Handle Enter key
        inputText.on('keydown-ENTER', () => {
            const name = inputText.text.trim();
            if (name) {
                this.playerCharacter = { name: name, description: this.playerCharacter == null ? '' : this.playerCharacter.description };
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
                this.playerCharacter = { name: name, description: this.playerCharacter == null ? '' : this.playerCharacter.description };
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

        const blocker = this.add.rectangle(
            this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height,
            0x000000,
            0.5 // opacity (0 = invisible, 1 = solid black)
          );
          
          // Make it interactive so it captures all clicks
          blocker.setInteractive();

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

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

        // Create RexUI InputText for multi-line description with current description value
        const currentDescription = this.playerCharacter && this.playerCharacter.description ? this.playerCharacter.description : '';
        const inputText = this.add.rexInputText(centerX, centerY, 400, 100, {
            type: 'textarea',
            placeholder: 'Enter your character description...\n\nExample: A powerful warrior with lightning magic, wielding a legendary sword and wearing enchanted armor.',
            text: currentDescription, // Pre-fill with current description
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#34495e',
            borderColor: '#3498db',
            borderWidth: 2,
            borderRadius: 8,
            padding: { x: 10, y: 8 },
            maxLength: 100,
            selectAll: true,
            wrap: {
                mode: 'word',
                width: 380
            }
        }).setOrigin(0.5, 0.5);

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

        // Resize handler to keep elements centered
        // const updatePositions = () => {
        //     const newCenterX = this.cameras.main.width / 2;
        //     const newCenterY = this.cameras.main.height / 2;
            
        //     // Update overlay
        //     overlay.clear();
        //     overlay.fillStyle(0x000000, 0.8);
        //     overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
            
        //     // Update modal
        //     modal.clear();
        //     modal.fillStyle(0x2c3e50, 0.95);
        //     modal.fillRoundedRect(newCenterX - 250, newCenterY - 150, 500, 300, 15);
        //     modal.lineStyle(2, 0xffffff, 0.3);
        //     modal.strokeRoundedRect(newCenterX - 250, newCenterY - 150, 500, 300, 15);
            
        //     // Update text positions
        //     titleText.setPosition(newCenterX, newCenterY - 120);
        //     instructionsText.setPosition(newCenterX, newCenterY - 80);
        //     inputText.setPosition(newCenterX, newCenterY + 30);
        //     saveButton.setPosition(newCenterX - 80, newCenterY + 80);
        //     cancelButton.setPosition(newCenterX + 80, newCenterY + 80);
        // };

        // // Listen for resize events
        // this.scale.on('resize', updatePositions);

        // Event handlers
        const cleanup = () => {
            //this.scale.off('resize', updatePositions);
            overlay.destroy();
            modal.destroy();
            titleText.destroy();
            instructionsText.destroy();
            inputText.destroy();
            saveButton.destroy();
            cancelButton.destroy();
            blocker.destroy();
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

    async startBattle() {
        if (!this.playerCharacter || !this.playerCharacter.name || !this.playerCharacter.description) {
            this.showError('No character selected! Please go back and select a character.');
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
        
        // Simulate battle on server
        await this.simulateBattle();
    }

    async saveCharacterToServer() {
        try {
            // Get Discord user ID (placeholder for now)
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
            }
        } catch (error) {
            console.error('❌ Error saving character to server:', error);
            // Don't block the battle if character saving fails
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

    async simulateBattle() {
        try {
            // Get Discord user ID
            const discordUserId = this.getDiscordUserId();
            
            console.log('⚔️ Requesting battle simulation from server...');

            const response = await fetch(API_ENDPOINTS.battleSimulation, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                },
                body: JSON.stringify({
                    playerCharacter: this.playerCharacter,
                    discordUserId: discordUserId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Battle simulation completed:', result);
                
                // Set the AI character from server response
                this.aiCharacter = result.aiCharacter;
                
                // Set the battle result from server response
                this.battleResult = result.battleResult;

                // Update battle statistics from server response
                if (result.battleStats) {
                    this.battleStats = result.battleStats;
                } else {
                    // Fallback to default stats if server doesn't provide them
                    this.battleStats = {
                        totalBattles: 0,
                        wins: 0,
                        losses: 0,
                        ties: 0,
                        winRate: 0
                    };
                }

                // Update character level from server response
                if (result.characterLevel !== undefined) {
                    this.characterLevel = result.characterLevel;
                }

                // Update cooldown from server response
                if (result.cooldownExpiry) {
                    this.cooldownExpiry = new Date(result.cooldownExpiry);
                    console.log('⏰ Battle cooldown set until:', this.cooldownExpiry);
                }

                // Update battle gems from server response
                if (result.battleGems !== undefined) {
                    this.battleGems = result.battleGems;
                    console.log('💎 Battle gems updated:', this.battleGems);
                }

                this.isLoading = false;
                this.showBattleResult();
            } else {
                console.error('❌ Battle simulation failed:', result.error);
                this.showError('Battle simulation failed. Please try again.');
                this.isLoading = false;
            }
        } catch (error) {
            console.error('❌ Error requesting battle simulation:', error);
            this.showError('Failed to connect to battle server. Please try again.');
            this.isLoading = false;
        }
    }



    showLoadingScreen() {
        // Clear previous content
        this.children.removeAll();
        this.createBackground();
        this.createUI();

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Loading text
        const loadingText = '🤖 Battle Analysis...';
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
        const statusText = 'Server is selecting an AI opponent and generating an epic battle...';
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
        const modalY = centerY - modalHeight / 2-100;

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
        const skullEmoji = this.battleResult.winner.name === this.playerCharacter.name    ? '🎉' : '💀';
        this.add.text(centerX, outcomeY, skullEmoji, {
            fontSize: '48px'
        }).setOrigin(0.5);

        console.log('player character:', this.playerCharacter.name);
        // Outcome text
        const outcomeText = this.battleResult.winner.name === this.playerCharacter.name ? 'Victory' : 'Defeat';
        const outcomeColor = this.battleResult.winner.name === this.playerCharacter.name ? '#2ecc71' : '#e74c3c';
        
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

        this.add.text(centerX + 50, statsY + 30, `Win Rate: ${this.battleStats.winRate}%`, {
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

        // this.add.text(centerX + 50, statsY + 50, `T: ${this.battleStats.ties}`, {
        //     fontSize: '14px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#f39c12'
        // });

        // Character level display
        this.add.text(centerX + 50, statsY + 50, `Level: ${this.characterLevel}`, {
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#f39c12',
            fontStyle: 'bold'
        });

        // Battle gems display
        // this.add.text(centerX + 150, statsY + 50, `💎 ${this.battleGems}/5`, {
        //     fontSize: '14px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#f39c12',
        //     fontStyle: 'bold'
        // });

        // Battle again button
        const buttonY = statsY + 120;
        
        // // Check cooldown status for battle again button
        // const battleAgainCooldownStatus = this.checkCooldown();
        
        // let battleAgainButtonText = '⚔️ Battle Again!';
        // let battleAgainButtonColor = '#3498db';
        // let battleAgainButtonEnabled = true;
        
        // if (battleAgainCooldownStatus.onCooldown) {
        //     const timeRemaining = this.formatTimeRemaining(battleAgainCooldownStatus.timeRemaining);
        //     battleAgainButtonText = `⏰ Cooldown: ${timeRemaining}`;
        //     battleAgainButtonColor = '#95a5a6';
        //     battleAgainButtonEnabled = false;
        // }
        
        // const battleAgainButton = this.add.text(centerX, buttonY, battleAgainButtonText, {
        //     fontSize: '20px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: battleAgainButtonColor,
        //     padding: { x: 20, y: 10 }
        // }).setOrigin(0.5);
        
        // if (battleAgainButtonEnabled) {
        //     battleAgainButton.setInteractive();
        //     battleAgainButton.on('pointerdown', () => {
        //         this.startNewBattle();
        //     });
        // }
        
        // // Store reference to battle again button for cooldown updates
        // this.battleAgainButton = battleAgainButton;

        // // Battle with Gem button (next to battle again button)
        // const battleAgainWithGemButton = this.add.text(centerX, buttonY+45, '💎 Battle with Gem', {
        //     fontSize: '18px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: this.battleGems >= 1 ? '#f39c12' : '#95a5a6',
        //     padding: { x: 15, y: 8 }
        // }).setOrigin(0.5);
        
        // if (this.battleGems >= 1) {
        //     battleAgainWithGemButton.setInteractive();
        //     battleAgainWithGemButton.on('pointerdown', () => {
        //         this.startNewBattleWithGem();
        //     });
        // }
        
        // // Store reference to battle again with gem button
        // this.battleAgainWithGemButton = battleAgainWithGemButton;

        // // PVP Battle button
        // let pvpBattleAgainButtonText = '⚔️ PVP Battle';
        // let pvpBattleAgainButtonColor = '#9b59b6';
        // let pvpBattleAgainButtonEnabled = true;
        
        // if (battleAgainCooldownStatus.onCooldown) {
        //     const timeRemaining = this.formatTimeRemaining(battleAgainCooldownStatus.timeRemaining);
        //     pvpBattleAgainButtonText = `⏰ PVP Cooldown: ${timeRemaining}`;
        //     pvpBattleAgainButtonColor = '#95a5a6';
        //     pvpBattleAgainButtonEnabled = false;
        // }
        
        // const pvpBattleAgainButton = this.add.text(centerX - 150, buttonY + 45, pvpBattleAgainButtonText, {
        //     fontSize: '18px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: pvpBattleAgainButtonColor,
        //     padding: { x: 15, y: 8 }
        // }).setOrigin(0.5);

        // if (pvpBattleAgainButtonEnabled) {
        //     pvpBattleAgainButton.setInteractive();
        //     pvpBattleAgainButton.on('pointerdown', () => {
        //         this.startPVPBattle();
        //     });
        // }

        // // PVP with Gem button
        // const pvpBattleAgainWithGemButton = this.add.text(centerX + 150, buttonY + 45, '💎 PVP with Gem', {
        //     fontSize: '16px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: this.battleGems >= 1 ? '#8e44ad' : '#95a5a6',
        //     padding: { x: 12, y: 6 }
        // }).setOrigin(0.5);

        // if (this.battleGems >= 1) {
        //     pvpBattleAgainWithGemButton.setInteractive();
        //     pvpBattleAgainWithGemButton.on('pointerdown', () => {
        //         this.startPVPBattleWithGem();
        //     });
        // }

        // // Store references to PVP buttons for cooldown updates
        // this.pvpBattleAgainButton = pvpBattleAgainButton;
        // this.pvpBattleAgainWithGemButton = pvpBattleAgainWithGemButton;

        // // Back to menu button
        // const backButton = this.add.text(centerX, buttonY + 100, '← Back', {
        //     fontSize: '16px',
        //     fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        //     color: '#ffffff',
        //     backgroundColor: '#34495e',
        //     padding: { x: 15, y: 8 }
        // }).setOrigin(0.5);
        // backButton.setInteractive();
        // backButton.on('pointerdown', () => {
        //     this.scene.start('CharacterSelectionScene');
        // });

        this.showBattleUI(buttonY);

        // If content is too tall, adjust the modal height
        const totalContentHeight = buttonY + 100; // Add bottom padding
        if (totalContentHeight > modalHeight) {
            resultBg.clear();
            resultBg.fillStyle(0x2c3e50, 0.95);
            resultBg.fillRoundedRect(modalX, modalY, modalWidth, totalContentHeight, 15);
            resultBg.lineStyle(2, 0xffffff, 0.2);
            resultBg.strokeRoundedRect(modalX, modalY, modalWidth, totalContentHeight, 15);
        }
        
        // Start cooldown timer if on cooldown
        const resultCooldownStatus = this.checkCooldown();
        if (resultCooldownStatus.onCooldown) {
            this.startCooldownTimer();
        }
    }

    showMessage(message) {

        const blocker = this.add.rectangle(
            this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height,
            0x000000,
            0.5 // opacity (0 = invisible, 1 = solid black)
          );

          blocker.setInteractive();

        // Create error modal with high depth to ensure it's on top
        const overlay = this.add.graphics();
        overlay.setDepth(1000); // High depth to be above all other UI
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const modal = this.add.graphics();
        modal.setDepth(1001); // Higher depth than overlay
        modal.fillStyle(0x010101, 0.95);
        modal.fillRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);

        const errorTitle = this.add.text(centerX, centerY - 60, 'Success', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        errorTitle.setDepth(1002); // Highest depth for text

        const errorMessage = this.add.text(centerX, centerY - 10, message, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: 350 }
        }).setOrigin(0.5);
        errorMessage.setDepth(1002); // Highest depth for text

        const okButton = this.add.text(centerX, centerY + 50, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setInteractive();
        okButton.setDepth(1002); // Highest depth for text
        okButton.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            errorTitle.destroy();
            errorMessage.destroy();
            okButton.destroy();
            blocker.destroy();
        });
    }

    showError(message) {

        const blocker = this.add.rectangle(
            this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height,
            0x000000,
            0.5 // opacity (0 = invisible, 1 = solid black)
          );

          blocker.setInteractive();
        // Create error modal with high depth to ensure it's on top
        const overlay = this.add.graphics();
        overlay.setDepth(1000); // High depth to be above all other UI
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        const modal = this.add.graphics();
        modal.setDepth(1001); // Higher depth than overlay
        modal.fillStyle(0xe74c3c, 0.95);
        modal.fillRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);
        modal.lineStyle(2, 0xffffff, 0.3);
        modal.strokeRoundedRect(centerX - 200, centerY - 100, 400, 200, 15);

        const errorTitle = this.add.text(centerX, centerY - 60, '❌ Error', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        errorTitle.setDepth(1002); // Highest depth for text

        const errorMessage = this.add.text(centerX, centerY - 10, message, {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8,
            wordWrap: { width: 350 }
        }).setOrigin(0.5);
        errorMessage.setDepth(1002); // Highest depth for text

        const okButton = this.add.text(centerX, centerY + 50, 'OK', {
            fontSize: '18px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#2c3e50',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        okButton.setInteractive();
        okButton.setDepth(1002); // Highest depth for text
        okButton.on('pointerdown', () => {
            overlay.destroy();
            modal.destroy();
            errorTitle.destroy();
            errorMessage.destroy();
            okButton.destroy();
            blocker.destroy();
        });
    }

    update() {
        // Add any update logic here if needed
    }

    restartGame() {
        this.scene.restart();
    }

    async startNewBattle() {
        // Check cooldown
        const cooldownStatus = this.checkCooldown();
        if (cooldownStatus.onCooldown) {
            const timeRemaining = this.formatTimeRemaining(cooldownStatus.timeRemaining);
            this.showError(`Battle cooldown active. Please wait ${timeRemaining} before your next battle.`);
            return;
        }

        // Keep the same player character but request a new battle from server
        this.isLoading = true;
        this.showLoadingScreen();
        
        // Simulate new battle on server
        await this.simulateBattle();
    }

    async startBattleWithGem() {
        if (!this.playerCharacter || !this.playerCharacter.name || !this.playerCharacter.description) {
            this.showError('No character selected! Please go back and select a character.');
            return;
        }

        if (this.battleGems < 1) {
            this.showError('Insufficient battle gems. You need at least 1 gem to battle during cooldown.');
            return;
        }

        // Start battle using a gem to bypass cooldown
        this.isLoading = true;
        this.showLoadingScreen();
        
        // Simulate battle on server with gem usage
        await this.simulateBattleWithGem();
    }

    async startNewBattleWithGem() {
        if (this.battleGems < 1) {
            this.showError('Insufficient battle gems. You need at least 1 gem to battle during cooldown.');
            return;
        }

        // Start new battle using a gem to bypass cooldown
        this.isLoading = true;
        this.showLoadingScreen();
        
        // Simulate battle on server with gem usage
        await this.simulateBattleWithGem();
    }

    async simulateBattleWithGem() {
        try {
            // Get Discord user ID
            const discordUserId = this.getDiscordUserId();
            
            console.log('💎 Requesting battle simulation with gem usage from server...');

            const response = await fetch(API_ENDPOINTS.battleSimulation, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': `battle_gem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                },
                body: JSON.stringify({
                    playerCharacter: this.playerCharacter,
                    discordUserId: discordUserId,
                    useBattleGem: true
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Battle simulation with gem completed:', result);
                
                // Set the AI character from server response
                this.aiCharacter = result.aiCharacter;
                
                // Set the battle result from server response
                this.battleResult = result.battleResult;

                // Update battle statistics from server response
                if (result.battleStats) {
                    this.battleStats = result.battleStats;
                } else {
                    // Fallback to default stats if server doesn't provide them
                    this.battleStats = {
                        totalBattles: 0,
                        wins: 0,
                        losses: 0,
                        ties: 0,
                        winRate: 0
                    };
                }

                // Update character level from server response
                if (result.characterLevel !== undefined) {
                    this.characterLevel = result.characterLevel;
                }

                // Update cooldown from server response
                if (result.cooldownExpiry) {
                    this.cooldownExpiry = new Date(result.cooldownExpiry);
                    console.log('⏰ Battle cooldown set until:', this.cooldownExpiry);
                }

                // Update battle gems from server response
                if (result.battleGems !== undefined) {
                    this.battleGems = result.battleGems;
                    console.log('💎 Battle gems updated:', this.battleGems);
                }

                this.isLoading = false;
                this.showBattleResult();
            } else {
                console.error('❌ Battle simulation with gem failed:', result.error);
                this.showError('Battle simulation failed. Please try again.');
                this.isLoading = false;
            }
        } catch (error) {
            console.error('❌ Error requesting battle simulation with gem:', error);
            this.showError('Failed to connect to battle server. Please try again.');
            this.isLoading = false;
        }
    }

    async startPVPBattle() {
        if (!this.playerCharacter || !this.playerCharacter.name || !this.playerCharacter.description) {
            this.showError('No character selected! Please go back and select a character.');
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
        
        // Simulate PVP battle on server
        await this.simulatePVPBattle();
    }

    async startPVPBattleWithGem() {
        if (!this.playerCharacter || !this.playerCharacter.name || !this.playerCharacter.description) {
            this.showError('No character selected! Please go back and select a character.');
            return;
        }

        if (this.battleGems < 1) {
            this.showError('Insufficient battle gems. You need at least 1 gem to battle during cooldown.');
            return;
        }

        // Start PVP battle using a gem to bypass cooldown
        this.isLoading = true;
        this.showLoadingScreen();
        
        // Simulate PVP battle on server with gem usage
        await this.simulatePVPBattleWithGem();
    }

    async simulatePVPBattle() {
        try {
            // Get Discord user ID
            const discordUserId = this.getDiscordUserId();
            
            console.log('⚔️ Requesting PVP battle simulation from server...');

            const response = await fetch(API_ENDPOINTS.pvpBattleSimulation, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': `pvp_battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                },
                body: JSON.stringify({
                    playerCharacter: this.playerCharacter,
                    discordUserId: discordUserId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ PVP Battle simulation completed:', result);
                
                // Set the opponent character from server response
                this.aiCharacter = result.aiCharacter;
                
                // Set the battle result from server response
                this.battleResult = result.battleResult;

                // Update battle statistics from server response
                if (result.battleStats) {
                    this.battleStats = result.battleStats;
                } else {
                    // Fallback to default stats if server doesn't provide them
                    this.battleStats = {
                        totalBattles: 0,
                        wins: 0,
                        losses: 0,
                        ties: 0,
                        winRate: 0
                    };
                }

                // Update character level from server response
                if (result.characterLevel !== undefined) {
                    this.characterLevel = result.characterLevel;
                }

                // Update cooldown from server response
                if (result.cooldownExpiry) {
                    this.cooldownExpiry = new Date(result.cooldownExpiry);
                    console.log('⏰ Battle cooldown set until:', this.cooldownExpiry);
                }

                // Update battle gems from server response
                if (result.battleGems !== undefined) {
                    this.battleGems = result.battleGems;
                    console.log('💎 Battle gems updated:', this.battleGems);
                }

                this.isLoading = false;
                this.showBattleResult();
            } else {
                console.error('❌ PVP Battle simulation failed:', result.error);
                this.showError('PVP Battle simulation failed. Please try again.');
                this.isLoading = false;
            }
        } catch (error) {
            console.error('❌ Error requesting PVP battle simulation:', error);
            this.showError('Failed to connect to battle server. Please try again.');
            this.isLoading = false;
        }
    }

    async simulatePVPBattleWithGem() {
        try {
            // Get Discord user ID
            const discordUserId = this.getDiscordUserId();
            
            console.log('💎 Requesting PVP battle simulation with gem usage from server...');

            const response = await fetch(API_ENDPOINTS.pvpBattleSimulation, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': `pvp_battle_gem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                },
                body: JSON.stringify({
                    playerCharacter: this.playerCharacter,
                    discordUserId: discordUserId,
                    useBattleGem: true
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ PVP Battle simulation with gem completed:', result);
                
                // Set the opponent character from server response
                this.aiCharacter = result.aiCharacter;
                
                // Set the battle result from server response
                this.battleResult = result.battleResult;

                // Update battle statistics from server response
                if (result.battleStats) {
                    this.battleStats = result.battleStats;
                } else {
                    // Fallback to default stats if server doesn't provide them
                    this.battleStats = {
                        totalBattles: 0,
                        wins: 0,
                        losses: 0,
                        ties: 0,
                        winRate: 0
                    };
                }

                // Update character level from server response
                if (result.characterLevel !== undefined) {
                    this.characterLevel = result.characterLevel;
                }

                // Update cooldown from server response
                if (result.cooldownExpiry) {
                    this.cooldownExpiry = new Date(result.cooldownExpiry);
                    console.log('⏰ Battle cooldown set until:', this.cooldownExpiry);
                }

                // Update battle gems from server response
                if (result.battleGems !== undefined) {
                    this.battleGems = result.battleGems;
                    console.log('💎 Battle gems updated:', this.battleGems);
                }

                this.isLoading = false;
                this.showBattleResult();
            } else {
                console.error('❌ PVP Battle simulation with gem failed:', result.error);
                this.showError('PVP Battle simulation failed. Please try again.');
                this.isLoading = false;
            }
        } catch (error) {
            console.error('❌ Error requesting PVP battle simulation with gem:', error);
            this.showError('Failed to connect to battle server. Please try again.');
            this.isLoading = false;
        }
    }
}
