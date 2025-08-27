// import './style.css'
// import javascriptLogo from './javascript.svg'
// import viteLogo from '/vite.svg'
// import { setupCounter } from './counter.js'

// const canvas = document.getElementById('gameCanvas');
// const ctx = canvas.getContext('2d');

// // Removed references to the start game button and title screen
// const startScreen = null;
// const startButton = null;

// const gameOverScreen = document.getElementById('game-over-screen');
// const restartButton = document.getElementById('restart-button');
// const finalScore = document.getElementById('final-score');

// let gameRunning = false;
// let score = 0;
// let balloons = [];
// let trampoline = { x: 150, y: 600, width: 100, height: 10 };
// let character = { x: 180, y: 580, radius: 10, dx: 2, dy: -5 };

// // Adjust canvas to maintain a 9:16 aspect ratio and scale it 25% smaller
// function resizeCanvas() {
//   const rect = canvas.getBoundingClientRect();
//   const aspectRatio = 9 / 16;
//   canvas.width = window.innerWidth * 0.9 * 0.75; // 90% of the screen width, scaled 25% smaller
//   canvas.height = canvas.width / aspectRatio; // Maintain 9:16 aspect ratio

//   if (canvas.height > window.innerHeight * 0.9 * 0.75) {
//     canvas.height = window.innerHeight * 0.9 * 0.75;
//     canvas.width = canvas.height * aspectRatio;
//   }

//   trampoline.y = canvas.height - 40; // Adjust trampoline position

//   // Center the canvas on the page
//   canvas.style.margin = 'auto';
//   canvas.style.display = 'block';
// }

// // Removed start screen centering logic
// function centerStartScreen() {
//   // No longer needed
// }

// // Initialize the game with the character stuck on the trampoline
// function initGame() {
//   balloons = Array.from({ length: 10 }, (_, i) => ({ x: i * 30 + 50, y: 50, popped: false }));
//   score = 0;
//   character.x = trampoline.x + trampoline.width / 2; // Center character on trampoline
//   character.y = trampoline.y - character.radius; // Place character on top of trampoline
//   character.dx = 0;
//   character.dy = 0; // No initial velocity
//   gameRunning = false; // Game starts paused

//   canvas.style.display = 'block';
//   gameOverScreen.style.display = 'none';

//   // Reset trampoline position
//   trampoline.x = (canvas.width - trampoline.width) / 2;
// }

// function endGame() {
//   gameRunning = false;
//   canvas.style.display = 'none';
//   gameOverScreen.style.display = 'block';
//   finalScore.textContent = `Your Score: ${score}`;
// }

// function drawTrampoline() {
//   ctx.fillStyle = 'blue';
//   ctx.fillRect(trampoline.x, trampoline.y, trampoline.width, trampoline.height);
// }

// function drawCharacter() {
//   ctx.beginPath();
//   ctx.arc(character.x, character.y, character.radius, 0, Math.PI * 2);
//   ctx.fillStyle = 'red';
//   ctx.fill();
//   ctx.closePath();
// }

// function drawBalloons() {
//   balloons.forEach(balloon => {
//     if (!balloon.popped) {
//       ctx.beginPath();
//       ctx.arc(balloon.x, balloon.y, 10, 0, Math.PI * 2);
//       ctx.fillStyle = 'green';
//       ctx.fill();
//       ctx.closePath();
//     }
//   });
// }

// // Render the initial state of the game when the website loads
// function renderInitialState() {
//   ctx.clearRect(0, 0, canvas.width, canvas.height);
//   drawTrampoline();
//   drawCharacter();
//   drawBalloons();
// }

// // Cap the maximum velocity to ensure the character reaches the top of the screen as the peak
// function updateCharacter() {
//   character.x += character.dx;
//   character.y += character.dy;
//   character.dy += 0.3; // gravity

//   // Cap the maximum upward velocity
//   if (character.dy < -15) character.dy = -15;

//   if (character.x < 0 || character.x > canvas.width) character.dx *= -1;
//   if (character.y < 0) character.dy *= -1;

//   if (
//     character.y + character.radius > trampoline.y &&
//     character.x > trampoline.x &&
//     character.x < trampoline.x + trampoline.width
//   ) {
//     character.dy = -Math.abs(character.dy) * 1.8; // Higher bounce multiplier
//     character.dx += (Math.random() - 0.5) * 2; // Add slight horizontal randomness
//   }

//   balloons.forEach(balloon => {
//     if (!balloon.popped && Math.hypot(character.x - balloon.x, character.y - balloon.y) < 10 + character.radius) {
//       balloon.popped = true;
//       score += 10;
//     }
//   });

//   if (character.y > canvas.height) endGame();
// }

// function gameLoop() {
//   if (!gameRunning) return;

//   ctx.clearRect(0, 0, canvas.width, canvas.height);
//   drawTrampoline();
//   drawCharacter();
//   drawBalloons();
//   updateCharacter();

//   if (balloons.every(balloon => balloon.popped)) {
//     endGame();
//   } else {
//     requestAnimationFrame(gameLoop);
//   }
// }

// canvas.addEventListener('mousemove', e => {
//   const rect = canvas.getBoundingClientRect();
//   trampoline.x = e.clientX - rect.left - trampoline.width / 2;
// });

// // Start the game on canvas click
// canvas.addEventListener('click', () => {
//   if (!gameRunning) {
//     character.dy = -10; // Initial bounce velocity
//     gameRunning = true;
//     requestAnimationFrame(gameLoop);
//   }
// });

// startButton.addEventListener('click', initGame);
// restartButton.addEventListener('click', initGame);

// // Call resizeCanvas on window resize
// window.addEventListener('resize', resizeCanvas);
// resizeCanvas();

// // Call renderInitialState after initializing the game
// initGame();
// renderInitialState();
