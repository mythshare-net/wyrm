// Wyrm - A Celtic Serpent Game

// Polyfill for roundRect (for older browser compatibility)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: radius, bl: radius };
        }
        this.moveTo(x + radius.tl, y);
        this.lineTo(x + width - radius.tr, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.lineTo(x + width, y + height - radius.br);
        this.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.lineTo(x + radius.bl, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.lineTo(x, y + radius.tl);
        this.quadraticCurveTo(x, y, x + radius.tl, y);
        this.closePath();
    };
}

// Game constants
const GRID_SIZE = 20;
const GAME_SPEED = 150; // milliseconds between moves

// Food types with Celtic theme
const FOOD_TYPES = {
    APPLE: { emoji: '🍎', points: 1, name: 'Avalon Apple' },
    SHAMROCK: { emoji: '☘️', points: 2, name: 'Lucky Shamrock' },
    MISTLETOE: { emoji: '🌿', points: 3, name: "Druid's Mistletoe" }
};

// Game state
let canvas, ctx;
let wyrm = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let score = 0;
let gameLoop = null;
let isGameRunning = false;

// Touch control state
let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 30; // minimum distance for swipe

// Initialize the game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Set up event listeners
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.addEventListener('keydown', handleKeyPress);
    
    // Touch controls for swipe gestures
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // On-screen button controls
    setupOnScreenControls();
    
    // Draw initial state
    drawGrid();
}

// Start the game
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    resetGame();
    isGameRunning = true;
    gameLoop = setInterval(gameStep, GAME_SPEED);
}

// Restart the game
function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    resetGame();
    isGameRunning = true;
    gameLoop = setInterval(gameStep, GAME_SPEED);
}

// Reset game state
function resetGame() {
    // Initialize wyrm slightly left of center to give more room
    const startX = Math.floor(canvas.width / GRID_SIZE / 4);
    const centerY = Math.floor(canvas.height / GRID_SIZE / 2);
    
    wyrm = [
        { x: startX, y: centerY },
        { x: startX - 1, y: centerY },
        { x: startX - 2, y: centerY }
    ];
    
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    updateScore();
    spawnFood();
}

// Handle keyboard input
function handleKeyPress(event) {
    if (!isGameRunning) return;
    
    const key = event.key.toLowerCase();
    
    // Prevent reversing direction
    switch (key) {
        case 'arrowup':
        case 'w':
            if (direction.y !== 1) {
                nextDirection = { x: 0, y: -1 };
            }
            event.preventDefault();
            break;
        case 'arrowdown':
        case 's':
            if (direction.y !== -1) {
                nextDirection = { x: 0, y: 1 };
            }
            event.preventDefault();
            break;
        case 'arrowleft':
        case 'a':
            if (direction.x !== 1) {
                nextDirection = { x: -1, y: 0 };
            }
            event.preventDefault();
            break;
        case 'arrowright':
        case 'd':
            if (direction.x !== -1) {
                nextDirection = { x: 1, y: 0 };
            }
            event.preventDefault();
            break;
    }
}

// Main game loop step
function gameStep() {
    direction = { ...nextDirection };
    
    // Calculate new head position
    const head = wyrm[0];
    const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y
    };
    
    // Check for collisions
    if (checkCollision(newHead)) {
        gameOver();
        return;
    }
    
    // Add new head
    wyrm.unshift(newHead);
    
    // Check if food is eaten
    if (food && newHead.x === food.x && newHead.y === food.y) {
        score += food.type.points;
        updateScore();
        spawnFood();
        // Wyrm grows by not removing the tail
    } else {
        // Remove tail
        wyrm.pop();
    }
    
    // Render
    render();
}

// Check for collisions with walls or self
function checkCollision(position) {
    const gridWidth = canvas.width / GRID_SIZE;
    const gridHeight = canvas.height / GRID_SIZE;
    
    // Wall collision
    if (position.x < 0 || position.x >= gridWidth ||
        position.y < 0 || position.y >= gridHeight) {
        return true;
    }
    
    // Self collision
    for (const segment of wyrm) {
        if (position.x === segment.x && position.y === segment.y) {
            return true;
        }
    }
    
    return false;
}

// Spawn food at random position
function spawnFood() {
    const gridWidth = canvas.width / GRID_SIZE;
    const gridHeight = canvas.height / GRID_SIZE;
    
    // Choose random food type with weighted probability
    const rand = Math.random();
    let foodType;
    if (rand < 0.6) {
        foodType = FOOD_TYPES.APPLE;
    } else if (rand < 0.85) {
        foodType = FOOD_TYPES.SHAMROCK;
    } else {
        foodType = FOOD_TYPES.MISTLETOE;
    }
    
    // Find empty position
    let newFood;
    let attempts = 0;
    do {
        newFood = {
            x: Math.floor(Math.random() * gridWidth),
            y: Math.floor(Math.random() * gridHeight),
            type: foodType
        };
        attempts++;
    } while (isPositionOccupied(newFood) && attempts < 100);
    
    food = newFood;
}

// Check if position is occupied by wyrm
function isPositionOccupied(position) {
    for (const segment of wyrm) {
        if (position.x === segment.x && position.y === segment.y) {
            return true;
        }
    }
    return false;
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = score;
}

// Game over
function gameOver() {
    isGameRunning = false;
    clearInterval(gameLoop);
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// Render the game
function render() {
    // Clear canvas
    ctx.fillStyle = '#0d1f0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid pattern (subtle)
    drawGrid();
    
    // Draw food
    if (food) {
        drawFood(food);
    }
    
    // Draw wyrm
    drawWyrm();
}

// Draw subtle grid pattern
function drawGrid() {
    ctx.strokeStyle = 'rgba(45, 90, 39, 0.2)';
    ctx.lineWidth = 1;
    
    const gridWidth = canvas.width / GRID_SIZE;
    const gridHeight = canvas.height / GRID_SIZE;
    
    for (let x = 0; x <= gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * GRID_SIZE, 0);
        ctx.lineTo(x * GRID_SIZE, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y <= gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * GRID_SIZE);
        ctx.lineTo(canvas.width, y * GRID_SIZE);
        ctx.stroke();
    }
}

// Draw the wyrm with Celtic styling
function drawWyrm() {
    wyrm.forEach((segment, index) => {
        const x = segment.x * GRID_SIZE;
        const y = segment.y * GRID_SIZE;
        const isHead = index === 0;
        
        // Create gradient for each segment
        const gradient = ctx.createRadialGradient(
            x + GRID_SIZE / 2, y + GRID_SIZE / 2, 0,
            x + GRID_SIZE / 2, y + GRID_SIZE / 2, GRID_SIZE / 2
        );
        
        if (isHead) {
            // Golden head
            gradient.addColorStop(0, '#ffd700');
            gradient.addColorStop(0.5, '#d4af37');
            gradient.addColorStop(1, '#8b6914');
        } else {
            // Green body with gold tint
            const colorIntensity = 1 - (index / wyrm.length) * 0.4;
            gradient.addColorStop(0, `rgba(74, 130, 52, ${colorIntensity})`);
            gradient.addColorStop(0.7, `rgba(45, 90, 39, ${colorIntensity})`);
            gradient.addColorStop(1, `rgba(30, 61, 26, ${colorIntensity})`);
        }
        
        // Draw segment with rounded appearance
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, GRID_SIZE - 2, GRID_SIZE - 2, 4);
        ctx.fill();
        
        // Add scale-like pattern
        ctx.strokeStyle = isHead ? 'rgba(255, 215, 0, 0.5)' : 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw eyes on head
        if (isHead) {
            drawEyes(x, y);
        }
    });
}

// Draw wyrm eyes
function drawEyes(x, y) {
    const eyeSize = 3;
    const eyeOffsetX = 5;
    const eyeOffsetY = 6;
    
    // Position eyes based on direction
    let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
    
    if (direction.x === 1) { // Moving right
        leftEyeX = x + GRID_SIZE - eyeOffsetX;
        leftEyeY = y + eyeOffsetY;
        rightEyeX = x + GRID_SIZE - eyeOffsetX;
        rightEyeY = y + GRID_SIZE - eyeOffsetY;
    } else if (direction.x === -1) { // Moving left
        leftEyeX = x + eyeOffsetX;
        leftEyeY = y + eyeOffsetY;
        rightEyeX = x + eyeOffsetX;
        rightEyeY = y + GRID_SIZE - eyeOffsetY;
    } else if (direction.y === -1) { // Moving up
        leftEyeX = x + eyeOffsetY;
        leftEyeY = y + eyeOffsetX;
        rightEyeX = x + GRID_SIZE - eyeOffsetY;
        rightEyeY = y + eyeOffsetX;
    } else { // Moving down
        leftEyeX = x + eyeOffsetY;
        leftEyeY = y + GRID_SIZE - eyeOffsetX;
        rightEyeX = x + GRID_SIZE - eyeOffsetY;
        rightEyeY = y + GRID_SIZE - eyeOffsetX;
    }
    
    // Draw eyes
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(leftEyeX - 1, leftEyeY - 1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX - 1, rightEyeY - 1, 1, 0, Math.PI * 2);
    ctx.fill();
}

// Draw food with emoji
function drawFood(food) {
    const x = food.x * GRID_SIZE;
    const y = food.y * GRID_SIZE;
    
    // Draw glow effect
    const glowGradient = ctx.createRadialGradient(
        x + GRID_SIZE / 2, y + GRID_SIZE / 2, 0,
        x + GRID_SIZE / 2, y + GRID_SIZE / 2, GRID_SIZE
    );
    glowGradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
    glowGradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(x - GRID_SIZE / 2, y - GRID_SIZE / 2, GRID_SIZE * 2, GRID_SIZE * 2);
    
    // Draw emoji
    ctx.font = `${GRID_SIZE - 4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(food.type.emoji, x + GRID_SIZE / 2, y + GRID_SIZE / 2 + 1);
}

// Touch event handlers for swipe gestures
function handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

function handleTouchMove(event) {
    event.preventDefault(); // Prevent scrolling
}

function handleTouchEnd(event) {
    event.preventDefault();
    if (!isGameRunning) return;
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
            if (deltaX > 0 && direction.x !== -1) {
                // Swipe right
                nextDirection = { x: 1, y: 0 };
            } else if (deltaX < 0 && direction.x !== 1) {
                // Swipe left
                nextDirection = { x: -1, y: 0 };
            }
        }
    } else {
        // Vertical swipe
        if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
            if (deltaY > 0 && direction.y !== -1) {
                // Swipe down
                nextDirection = { x: 0, y: 1 };
            } else if (deltaY < 0 && direction.y !== 1) {
                // Swipe up
                nextDirection = { x: 0, y: -1 };
            }
        }
    }
}

// Set up on-screen control buttons
function setupOnScreenControls() {
    const controls = document.querySelectorAll('.control-btn');
    controls.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isGameRunning) return;
            
            const dir = button.dataset.direction;
            switch(dir) {
                case 'up':
                    if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
                    break;
                case 'down':
                    if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
                    break;
                case 'left':
                    if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
                    break;
                case 'right':
                    if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
                    break;
            }
        });
        
        // Prevent touch delay on mobile
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.click();
        });
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
