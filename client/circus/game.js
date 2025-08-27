import { sendScoreToService } from './gameservices.js';

// Game constants
const GRAVITY = 0.5;
const BOUNCE_FACTOR = 0.7;
const TRAMPOLINE_SPEED = 8;
const BALLOON_ROWS = 3;
const BALLOONS_PER_ROW = 10;
const BALLOON_SPEED = 2; // Fixed speed for all balloons
const PLAYER_BOUNCE_VELOCITY = 15;
const MAX_BOUNCE_MULTIPLIER = 1.5; // Maximum bounce multiplier for edge landings
const BALLOON_BOUNCE_BACK = 10; // Velocity applied when bouncing off resistant balloons
const BLUE_BALLOON_BOUNCE_BACK = 8; // Velocity applied when bouncing off blue balloons
const RED_BALLOON_BOUNCE_BACK = 6; // Velocity applied when bouncing off red balloons
const BALLOON_HEIGHT = 25;
const BALLOON_WIDTH = 25;

// Load game assets
let playerImage = new Image();
let trampolineImage = new Image();
let balloonImage = new Image();
let backgroundImage = new Image();

// Preload images
playerImage.src = 'assets/player.svg';
trampolineImage.src = 'assets/trampoline.svg';
balloonImage.src = 'assets/balloon.svg';
backgroundImage.src = 'assets/background.svg';

// Audio handling
let audioContext = null;
let soundEnabled = false;
let bounceSound = null;

// Game state
let gameState = {
    isStarted: true,  // Set to true by default
    isPlaying: false,
    score: 0,
    balloonsPopped: 0,
    totalBalloons: BALLOON_ROWS * BALLOONS_PER_ROW
};

// Game objects
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isJumping = false;
    }

    update(trampoline) {
        if (!gameState.isStarted || !gameState.isPlaying) return;
        // Apply gravity
        this.velocityY += GRAVITY;
        
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Check collision with trampoline
        if (this.y + this.height > trampoline.y &&
            this.x + this.width > trampoline.x &&
            this.x < trampoline.x + trampoline.width &&
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

        // Check wall collisions
        if (this.x < 0) {
            this.x = 0;
            this.velocityX *= -0.5;
        }
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
            this.velocityX *= -0.5;
        }

        // Check ceiling collision
        if (this.y < 0) {
            this.y = 0;
            this.velocityY *= -0.7; // Bounce off ceiling with some energy loss
        }

        // Check if player fell off the bottom
        if (this.y > canvas.height) {
            gameOver();
        }
    }

    draw(ctx) {
        if (playerImage.complete) {
            ctx.drawImage(playerImage, this.x, this.y, this.width, this.height);
        } else {
            // Fallback to rectangle if image not loaded
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Trampoline {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 100;
        this.height = 20;
        this.targetX = x;
        this.rotation = 0;
        this.maxRotation = 0.2;
    }

    update() {
        // Smooth movement towards target
        this.x += (this.targetX - this.x) * 0.2;
        
        // Keep trampoline within bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
        }
        
        // Gradually return to level position
        this.rotation *= 0.9;
    }

    draw(ctx) {
        if (trampolineImage.complete) {
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.rotation);
            ctx.drawImage(trampolineImage, -this.width/2, -this.height/2, this.width, this.height);
            ctx.restore();
        } else {
            // Fallback to rectangle if image not loaded
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.rotation);
            ctx.fillStyle = '#3498db';
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
            ctx.restore();
        }
    }
    
    // Calculate bounce multiplier based on landing position
    getBounceMultiplier(playerX) {
        // Calculate relative position (0 = left edge, 0.5 = center, 1 = right edge)
        const relativeX = (playerX - this.x) / this.width;
        
        // Calculate distance from center (0 = center, 1 = edge)
        const distanceFromCenter = Math.abs(relativeX - 0.5) * 2;
        
        // Calculate bounce multiplier (1 = center, MAX_BOUNCE_MULTIPLIER = edge)
        const bounceMultiplier = 1 + (distanceFromCenter * (MAX_BOUNCE_MULTIPLIER - 1));
        
        // Set rotation based on landing position
        this.rotation = (relativeX - 0.5) * this.maxRotation * 2;
        
        return bounceMultiplier;
    }
}

class Balloon {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 50;
        this.isPopped = false;
        this.speed = BALLOON_SPEED;
        this.color = color;
        
        // Set bounce back value based on color
        if (color === '#f1c40f') { // Yellow
            this.bounceBack = BALLOON_BOUNCE_BACK;
        } else if (color === '#3498db') { // Blue
            this.bounceBack = BLUE_BALLOON_BOUNCE_BACK;
        } else if (color === '#e74c3c') { // Red
            this.bounceBack = RED_BALLOON_BOUNCE_BACK;
        } else {
            this.bounceBack = 0;
        }
    }

    update() {
        if (this.isPopped) return;
        
        // Move balloon from right to left
        this.x -= this.speed;
        
        // Wrap around when balloon goes off the left side
        if (this.x + this.width < 0) {
            this.x = canvas.width;
        }
    }

    checkCollision(player) {
        if (this.isPopped) return false;
        
        return (player.x < this.x + this.width &&
                player.x + player.width > this.x &&
                player.y < this.y + this.height &&
                player.y + player.height > this.y);
    }

    draw(ctx) {
        if (this.isPopped) return;
        
        if (balloonImage.complete) {
            ctx.save();
            // Create a temporary canvas to draw the colored balloon
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.width;
            tempCanvas.height = this.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw the balloon SVG
            tempCtx.drawImage(balloonImage, 0, 0, this.width, this.height);
            
            // Apply the color
            tempCtx.globalCompositeOperation = 'source-in';
            tempCtx.fillStyle = this.color;
            tempCtx.fillRect(0, 0, this.width, this.height);
            
            // Draw the colored balloon to the main canvas
            ctx.drawImage(tempCanvas, this.x, this.y);
            ctx.restore();
        } else {
            // Fallback to circle if image not loaded
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, 
                    this.width/2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Game setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('finalScore');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');

// Set canvas size
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // Update game objects if they exist
    if (player) {
        player.x = canvas.width / 2;
        player.y = canvas.height/2;
    }
    
    if (trampoline) {
        trampoline.x = canvas.width / 2 - trampoline.width / 2;
        trampoline.y = canvas.height/2 + 100;  // Back to original position near bottom
    }
}

// Game objects
let player;
let trampoline;
let balloons = [];

// Initialize audio
async function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load the bounce sound
            const response = await fetch('assets/bounce.mp3');
            const arrayBuffer = await response.arrayBuffer();
            bounceSound = await audioContext.decodeAudioData(arrayBuffer);
            
            console.log('Audio initialized successfully');
            soundEnabled = true;
        } catch (error) {
            console.log('Audio initialization failed:', error);
            soundEnabled = false;
        }
    }
}

// Initialize game
function initGame() {
    resizeCanvas();
    
    // Load game assets
    playerImage.src = 'assets/player.svg';
    trampolineImage.src = 'assets/trampoline.svg';
    balloonImage.src = 'assets/balloon.svg';
    backgroundImage.src = 'assets/background.svg';
    
    // Initialize audio
    initAudio();
    
    // Create player
    player = new Player(canvas.width/2 - 20, canvas.height/2);
    
    // Create trampoline
    trampoline = new Trampoline(
        canvas.width / 2 - 100 / 2,
        canvas.height/2 + 100 // Back to original position near bottom
    );
    
    // Create balloons
    balloons = [];
    const balloonWidth = BALLOON_WIDTH;
    const balloonHeight = BALLOON_HEIGHT;
    const horizontalSpacing = canvas.width / (BALLOONS_PER_ROW + 1);
    const verticalSpacing = 20; // Fixed 20px vertical spacing between rows
    
    // Define colors for each row
    const rowColors = ['#e74c3c', '#3498db', '#f1c40f']; // Red, Blue, Yellow
    
    // Calculate starting y position for the first row
    const firstRowY = 50; // Start 50px from the top
    
    for (let row = 0; row < BALLOON_ROWS; row++) {
        // All rows start at the same x position
        const rowStartX = canvas.width;
        
        for (let col = 0; col < BALLOONS_PER_ROW; col++) {
            // Evenly space balloons horizontally
            const x = rowStartX + (col * horizontalSpacing);
            
            // Calculate y position with fixed vertical spacing
            const y = firstRowY + (row * (balloonHeight + verticalSpacing));
            
            balloons.push(new Balloon(
                x,
                y,
                rowColors[row] // Use the color for this row
            ));
        }
    }
    
    // Reset game state
    gameState.score = 0;
    gameState.balloonsPopped = 0;
    gameState.isStarted = true;
    gameState.isPlaying = false;
    
    // Update displays
    scoreDisplay.textContent = `Score: ${gameState.score}`;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
}

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw trampoline (always visible)
    trampoline.draw(ctx);
    
    if (!gameState.isStarted) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Update game objects
    trampoline.update();
    player.update(trampoline);
    
    // Update balloons
    balloons.forEach(balloon => balloon.update());
    
    // Check balloon collisions
    balloons.forEach(balloon => {
        if (!balloon.isPopped && balloon.checkCollision(player)) {
            // Pop the balloon
            balloon.isPopped = true;
            gameState.score += 10;
            gameState.balloonsPopped++;
            scoreDisplay.textContent = `Score: ${gameState.score}`;
            
            // Play pop sound
            playPopSound();
            
            // Check if all balloons are popped
            if (gameState.balloonsPopped === gameState.totalBalloons) {
                resetBalloons();
            }
        }
    });
    
    // Draw game objects
    balloons.forEach(balloon => balloon.draw(ctx));
    player.draw(ctx);
    
    requestAnimationFrame(gameLoop);
}

// Function to reset balloons when all are popped
function resetBalloons() {
    // Create new balloons
    balloons = [];
    const balloonWidth = BALLOON_WIDTH;
    const balloonHeight = BALLOON_HEIGHT;
    const horizontalSpacing = canvas.width / (BALLOONS_PER_ROW + 1);
    const verticalSpacing = 20; // Fixed 20px vertical spacing between rows
    
    // Define colors for each row
    const rowColors = ['#e74c3c', '#3498db', '#f1c40f']; // Red, Blue, Yellow
    
    // Calculate starting y position for the first row
    const firstRowY = 50; // Start 50px from the top
    
    for (let row = 0; row < BALLOON_ROWS; row++) {
        // All rows start at the same x position
        const rowStartX = canvas.width;
        
        for (let col = 0; col < BALLOONS_PER_ROW; col++) {
            // Evenly space balloons horizontally
            const x = rowStartX + (col * horizontalSpacing);
            
            // Calculate y position with fixed vertical spacing
            const y = firstRowY + (row * (balloonHeight + verticalSpacing));
            
            balloons.push(new Balloon(
                x,
                y,
                rowColors[row] // Use the color for this row
            ));
        }
    }
    
    // Reset balloons popped counter
    gameState.balloonsPopped = 0;
    
    // Show a message that all balloons were popped
    showMessage("All balloons popped! New balloons added!");
}

// Function to show a temporary message
function showMessage(text, duration = 2000) {
    // Create message element if it doesn't exist
    let messageElement = document.getElementById('message');
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'message';
        messageElement.style.position = 'absolute';
        messageElement.style.top = '50%';
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translate(-50%, -50%)';
        messageElement.style.color = 'white';
        messageElement.style.fontSize = '24px';
        messageElement.style.fontWeight = 'bold';
        messageElement.style.textAlign = 'center';
        messageElement.style.zIndex = '20';
        messageElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        document.getElementById('gameContainer').appendChild(messageElement);
    }
    
    // Set message text
    messageElement.textContent = text;
    
    // Hide message after specified duration
    setTimeout(() => {
        messageElement.textContent = '';
    }, duration);
}

// Event handlers
function gameOver() {
    gameState.isStarted = false;
    finalScoreDisplay.textContent = gameState.score;
    gameOverScreen.style.display = 'flex';
    if (gameState.score > 0) {
        sendScoreToService(gameState.score);
    }
}

function gameWin() {
    gameState.isStarted = false;
    finalScoreDisplay.textContent = gameState.score;
    gameOverScreen.style.display = 'flex';
}

// Mouse and touch controls
let isDragging = false;

// Mouse controls
canvas.addEventListener('mousemove', (e) => {
    
    if (!gameState.isStarted || !gameState.isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    trampoline.targetX = x - trampoline.width/2;
});

// Touch controls for mobile
canvas.addEventListener('touchstart', (e) => {

    if (!gameState.isStarted) return;

    isDragging = true;
    handleTouchMove(e);
});

canvas.addEventListener('mouseup', (e) => {
    if (!gameState.isPlaying) {
        gameState.isPlaying = true;
        return;
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (!gameState.isStarted || !gameState.isPlaying || !isDragging) return;
    handleTouchMove(e);
});

canvas.addEventListener('touchend', () => {
    if (!gameState.isPlaying) {
        gameState.isPlaying = true;
        return;
    }
    isDragging = false;
});

function handleTouchMove(e) {
    e.preventDefault(); // Prevent scrolling
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    trampoline.targetX = x - trampoline.width/2;
}

// Initialize the game
initAudio();
initGame();
gameLoop();

// Button handlers
startButton.addEventListener('click', () => {
    gameState.isPlaying = true;
});

restartButton.addEventListener('click', () => {
    // initAudio(); // Try to initialize audio on button click
     initGame();
    // gameLoop();
  
    gameState.isPlaying = true;
});

// Handle window resize
window.addEventListener('resize', () => {
    if (gameState.isStarted) {
        initGame();
    }
});

// Initial setup
resizeCanvas();

// Function to play pop sound
function playPopSound() {
    if (soundEnabled && audioContext) {
        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Configure sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            // Play sound
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.log('Sound play failed:', error);
            soundEnabled = false;
        }
    }
}

// Function to play bounce sound
function playBounceSound() {
    if (soundEnabled && audioContext && bounceSound) {
        try {
            const source = audioContext.createBufferSource();
            source.buffer = bounceSound;
            source.connect(audioContext.destination);
            source.start(0);
        } catch (error) {
            console.log('Bounce sound play failed:', error);
            soundEnabled = false;
        }
    }
}

// Start the game
// function startGame() {
//     gameState.isPlaying = true;
//     startScreen.style.display = 'none';
//     gameLoop();
// } 