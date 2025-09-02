let GRAVITY = 0.5;

export default class CircusScene extends Phaser.Scene {

    constructor() {
        super({ key: 'CircusScene' });
        this.score = 0;
        this.isPlaying = false;
        this.gameOver = false;
    }

    preload() {
        // Load game assets
        this.load.image('player', '/assets/player.svg');
        this.load.image('trampoline', '/assets/trampoline.svg');
        this.load.image('balloon', '/assets/balloon.svg');
        this.load.image('background', '/assets/background.svg');
        this.load.audio('bounce', '/assets/bounce.mp3');
    }

    create() {
        // Turn off global gravity for this scene
        this.physics.world.gravity.y = 0;
        
        // Create background
        this.createBackground();
        
        // Create game objects
        this.createPlayer();
        this.createTrampoline();
        this.createBalloons();
        
        // Create UI
        this.createUI();
        
        // Set up physics
        this.setupPhysics();
        
        // Add input handlers
        this.addInputHandlers();
        
        // Start game loop
        this.startGame();
    }

    createBackground() {
        // Create gradient background
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x34495e, 0x34495e, 0x2c3e50, 0x2c3e50, 1);
        graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        // Add some circus-themed decorative elements
        for (let i = 0; i < 15; i++) {
            const x = Phaser.Math.Between(0, this.cameras.main.width);
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            const size = Phaser.Math.Between(3, 8);
            const alpha = Phaser.Math.FloatBetween(0.1, 0.2);
            
            graphics.fillStyle(0xffffff, alpha);
            graphics.fillCircle(x, y, size);
        }
    }

    createPlayer() {
        // Create player sprite
        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player.setScale(0.8);
        this.player.setCollideWorldBounds(true);

        this.velocityX = 0;
        this.velocityY = 0;

        //this.player.setBounce(0.7);
        //this.player.setGravityY(800); // Set gravity specifically for player
        
        // Add player animation
        this.tweens.add({
            targets: this.player,
            angle: 360,
            duration: 2000,
            repeat: -1,
            ease: 'Linear'
        });
    }

    createTrampoline() {
        // Create trampoline sprite
        this.trampoline = this.physics.add.sprite(400, 550, 'trampoline');
        this.trampoline.setScale(1.2);
        this.trampoline.setImmovable(true);
        this.trampoline.setCollideWorldBounds(true);
       // this.trampoline.setGravityY(0); // Turn off gravity for trampoline
        //this.trampoline.body.setGravityY(0); // Ensure gravity is off at body level
        
        // Add trampoline bounce effect
        this.trampoline.setBounce(1.2);
        
        // Store target position for smooth movement
        this.trampolineTargetX = 400;
    }

    createBalloons() {
        this.balloons = []; // Use regular array instead of physics group
        
        const balloonColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0xe67e22];
        const rows = 3;
        const cols = 8;
        const startX = 100;
        const startY = 80;
        const spacingX = 80;
        const spacingY = 60;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + (col * spacingX);
                const y = startY + (row * spacingY);
                const color = balloonColors[row % balloonColors.length];
                
                // Create balloon graphics
                const balloon = this.add.graphics();
                balloon.fillStyle(color, 0.8);
                balloon.fillCircle(x, y, 20);
                balloon.lineStyle(2, 0xffffff, 0.5);
                balloon.strokeCircle(x, y, 20);
                
                // Add string
                balloon.lineStyle(1, 0xffffff, 0.3);
                balloon.lineBetween(x, y + 20, x, y + 40);
                
                // Make balloon interactive
                balloon.setInteractive(new Phaser.Geom.Circle(x, y, 20), Phaser.Geom.Circle.Contains);
                balloon.on('pointerdown', () => {
                    this.popBalloon(balloon, x, y);
                });
                
                // Store balloon data
                balloon.isPopped = false;
                balloon.x = x;
                balloon.y = y;
                
                this.balloons.push(balloon);
            }
        }
    }

    createUI() {
        // Score text
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '32px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        
        // Instructions
        this.add.text(16, 60, 'Use mouse/touch to move trampoline', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        });
        
        this.add.text(16, 80, 'Click balloons to pop them!', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            alpha: 0.8
        });
        
        // Back button
        const backButton = this.add.text(16, this.cameras.main.height - 40, '← Back to Menu', {
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
        const privacyLink = this.add.text(this.cameras.main.width - 16, this.cameras.main.height - 40, '🔒 Privacy', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#667eea',
            padding: { x: 10, y: 5 }
        }).setOrigin(1, 0);
        privacyLink.setInteractive();
        privacyLink.on('pointerdown', () => {
            window.open('/privacy-policy.html', '_blank');
        });

        // Terms of service link
        const termsLink = this.add.text(this.cameras.main.width - 16, this.cameras.main.height - 80, '📜 Terms', {
            fontSize: '16px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#764ba2',
            padding: { x: 10, y: 5 }
        }).setOrigin(1, 0);
        termsLink.setInteractive();
        termsLink.on('pointerdown', () => {
            window.open('/terms-of-service.html', '_blank');
        });
        
        // Game over text (hidden initially)
        this.gameOverText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, 'GAME OVER!', {
            fontSize: '48px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#e74c3c',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setVisible(false);
        
        // Final score text (hidden initially)
        this.finalScoreText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '', {
            fontSize: '24px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setVisible(false);
        
        // Restart button (hidden initially)
        this.restartButton = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 50, 'Click to Restart', {
            fontSize: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setVisible(false);
        this.restartButton.setInteractive();
        this.restartButton.on('pointerdown', () => {
            this.restartGame();
        });
    }

    setupPhysics() {
        // Add collision between player and trampoline
        this.physics.add.collider(this.player, this.trampoline, this.handleTrampolineBounce, null, this);
        
        // Add collision between player and world bounds
        this.physics.add.collider(this.player, this.physics.world.bounds, this.handleWorldCollision, null, this);
    }

    addInputHandlers() {
        // Mouse/touch input for trampoline movement
        this.input.on('pointermove', (pointer) => {
            if (this.isPlaying && !this.gameOver) {
                this.trampolineTargetX = Phaser.Math.Clamp(pointer.x, 50, this.cameras.main.width - 50);
            }
        });
        
        // Click to start game
        this.input.on('pointerdown', () => {
            if (!this.isPlaying && !this.gameOver) {
                this.startGame();
            }
        });
        
        // Keyboard controls
        this.input.keyboard.on('keydown-LEFT', () => {
            if (this.isPlaying && !this.gameOver) {
                this.trampolineTargetX = Math.max(50, this.trampolineTargetX - 50);
            }
        });
        
        this.input.keyboard.on('keydown-RIGHT', () => {
            if (this.isPlaying && !this.gameOver) {
                this.trampolineTargetX = Math.min(this.cameras.main.width - 50, this.trampolineTargetX + 50);
            }
        });
        
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('MenuScene');
        });
    }

    startGame() {
        this.isPlaying = true;
        this.gameOver = false;
        this.score = 0;
        this.updateScore();
        
        // Reset player position
        this.player.setPosition(720/2, 1280/2);
        this.player.setVelocity(0, 0);
        
        // Reset trampoline position
        this.trampoline.setPosition(720 / 2 - 100 / 2, 1280/2 + 100);
        this.trampolineTargetX = 400;
        
        // Reset balloons
        this.resetBalloons();
        
        // Hide game over UI
        this.gameOverText.setVisible(false);
        this.finalScoreText.setVisible(false);
        this.restartButton.setVisible(false);
    }

    resetBalloons() {
        this.balloons.forEach(balloon => {
            balloon.isPopped = false;
            balloon.setVisible(true);
            balloon.clear();
            
            const color = balloon.isPopped ? 0x666666 : 0xe74c3c;
            balloon.fillStyle(color, 0.8);
            balloon.fillCircle(balloon.x, balloon.y, 20);
            balloon.lineStyle(2, 0xffffff, 0.5);
            balloon.strokeCircle(balloon.x, balloon.y, 20);
            balloon.lineStyle(1, 0xffffff, 0.3);
            balloon.lineBetween(balloon.x, balloon.y + 20, balloon.x, balloon.y + 40);
        });
    }

    handleTrampolineBounce(player, trampoline) {
        if (player.body.velocity.y > 0) {
            // Bounce the player up
            player.setVelocityY(-600);
            
            // Add some horizontal velocity based on where the player hit the trampoline
            const hitPoint = player.x - trampoline.x;
            player.setVelocityX(hitPoint * 2);
            
            // Play bounce sound if available
            if (this.sound.get('bounce')) {
                this.sound.play('bounce');
            }
            
            // Add bounce effect to trampoline
            this.tweens.add({
                targets: trampoline,
                scaleY: 0.8,
                duration: 100,
                yoyo: true,
                ease: 'Power2'
            });
        }
    }

    handleWorldCollision(player, bounds) {
        // Check if player fell off the bottom
        if (player.y > this.cameras.main.height + 50) {
            this.endGame();
        }
    }

    popBalloon(balloon, x, y) {
        if (balloon.isPopped) return;
        
        balloon.isPopped = true;
        this.score += 10;
        this.updateScore();
        
        // Create pop effect
        const popEffect = this.add.graphics();
        popEffect.fillStyle(0xffffff, 0.8);
        popEffect.fillCircle(x, y, 30);
        
        // Animate pop effect
        this.tweens.add({
            targets: popEffect,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                popEffect.destroy();
            }
        });
        
        // Hide balloon
        balloon.setVisible(false);
        
        // Check if all balloons are popped
        const remainingBalloons = this.balloons.filter(b => !b.isPopped).length;
        if (remainingBalloons === 0) {
            this.score += 100; // Bonus for clearing all balloons
            this.updateScore();
            this.endGame();
        }
    }

    updateScore() {
        this.scoreText.setText(`Score: ${this.score}`);
    }

    endGame() {
        this.isPlaying = false;
        this.gameOver = true;
        
        // Show game over UI
        this.gameOverText.setVisible(true);
        this.finalScoreText.setText(`Final Score: ${this.score}`);
        this.finalScoreText.setVisible(true);
        this.restartButton.setVisible(true);
        
        // Stop player movement
        this.player.setVelocity(0, 0);
        this.player.setGravityY(0);
    }

    restartGame() {
        this.scene.restart();
    }

    update() {
        if (this.isPlaying && !this.gameOver) {
            // Smooth trampoline movement
            const currentX = this.trampoline.x;
            const targetX = this.trampolineTargetX;
            this.trampoline.x = Phaser.Math.Linear(currentX, targetX, 0.1);
            
            // Keep trampoline within bounds
            this.trampoline.x = Phaser.Math.Clamp(this.trampoline.x, 50, this.cameras.main.width - 50);

            this.updatePlayer();
        }
    }

    updatePlayer() {

        let PLAYER_WIDTH = 40;
        let PLAYER_HEIGHT = 40;
        this.velocityY += GRAVITY;
        
        // Update position
        this.player.x += this.velocityX;
        this.player.y += this.velocityY;

        // Check collision with trampoline
        if (this.player.y + PLAYER_WIDTH > trampoline.y &&
            this.player.x + PLAYER_HEIGHT > trampoline.x &&
            this.player.x < trampoline.x + trampoline.width &&
            this.velocityY > 0) {
            
            // Calculate bounce multiplier based on landing position
            const bounceMultiplier = trampoline.getBounceMultiplier(this.x + this.width/2);
            
            this.y = trampoline.y - this.height;
            this.velocityY = -PLAYER_BOUNCE_VELOCITY * bounceMultiplier;
            this.velocityX = (this.x - (trampoline.x + trampoline.width/2)) * 0.2;
            this.isJumping = true;
            
            // Play bounce sound
            playBounceSound();
        }

        // // Check wall collisions
        // if (this.x < 0) {
        //     this.x = 0;
        //     this.velocityX *= -0.5;
        // }
        // if (this.x + this.width > canvas.width) {
        //     this.x = canvas.width - this.width;
        //     this.velocityX *= -0.5;
        // }

        // // Check ceiling collision
        // if (this.y < 0) {
        //     this.y = 0;
        //     this.velocityY *= -0.7; // Bounce off ceiling with some energy loss
        // }

        // // Check if player fell off the bottom
        // if (this.y > canvas.height) {
        //     gameOver();
        // }

    }
}
