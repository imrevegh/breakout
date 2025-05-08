// Game logica voor Utrecht Breakout Challenge
console.log("Game.js loaded");

// Start het spel als de pagina volledig geladen is
window.onload = function() {
    console.log("Window loaded");
    
    // Game elementen
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const messageDiv = document.getElementById('game-message');
    const messageText = document.getElementById('message-text');
    const messageButton = document.getElementById('message-button');
    const scoreDisplay = document.getElementById('score');
    const livesDisplay = document.getElementById('lives');
    const muteButton = document.getElementById('mute-button');
    const themeToggle = document.getElementById('theme-toggle');
    
    // Log welke elementen gevonden zijn
    console.log("Game elements check:");
    console.log("Canvas:", !!canvas);
    console.log("Start button:", !!startButton);
    console.log("Restart button:", !!restartButton);
    console.log("Message div:", !!messageDiv);
    
    // Game constanten
    const GAME_WIDTH = 800;
    const GAME_HEIGHT = 600;
    const PADDLE_WIDTH = 100;
    const PADDLE_HEIGHT = 15;
    const PADDLE_MARGIN_BOTTOM = 30;
    const BALL_RADIUS = 30;
    const BALL_SPEED = 5;
    const BICYCLE_SPEED = 3;
    const POWERUP_SPEED = 2;
    const POWERUP_DURATION = 10000; // 10 seconden
    
    // Stel canvas dimensies in
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    
    // Game state
    let gameRunning = false;
    let score = 0;
    let lives = 3;
    let ballOnPaddle = true;
    let bicycleSpawnTimer = 0;
    let powerupActive = false;
    let powerupTimer = 0;
    let animationFrameId = null;
    
    // Game objects
    let paddle = {
        x: GAME_WIDTH / 2 - PADDLE_WIDTH / 2,
        y: GAME_HEIGHT - PADDLE_MARGIN_BOTTOM - PADDLE_HEIGHT,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        dx: 0,
        originalWidth: PADDLE_WIDTH
    };
    
    let ball = {
        x: GAME_WIDTH / 2,
        y: paddle.y - BALL_RADIUS,
        radius: BALL_RADIUS,
        speed: BALL_SPEED,
        dx: 0,
        dy: 0,
        image: null
    };
    
    // Gebruik nu de LevelManager class
    const levelManager = new LevelManager(GAME_WIDTH, GAME_HEIGHT);
    let currentLevel = { blocks: [], bicycles: [], powerups: [] };
    
    // Dummy sound manager (geen externe bestanden nodig)
    const soundManager = {
        muted: false,
        
        play: function(sound) {
            if (this.muted) return;
            console.log("Playing sound:", sound);
        },
        
        toggleMute: function() {
            this.muted = !this.muted;
            console.log("Sound muted:", this.muted);
            return this.muted;
        }
    };
    
    // Plaatje van de Domtoren als Image-object (eenmalig laden)
    let domtorenImg = null;
    function loadDomtorenImage(callback) {
        if (domtorenImg) {
            callback && callback();
            return;
        }
        domtorenImg = new Image();
        domtorenImg.onload = function() { callback && callback(); };
        domtorenImg.src = 'images/domtoren.svg';
    }
    
    // Helper: maak wit transparant in een image
    function makeWhiteTransparent(img, callback) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tctx = tempCanvas.getContext('2d');
        tctx.drawImage(img, 0, 0);
        const imgData = tctx.getImageData(0, 0, img.width, img.height);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const r = imgData.data[i];
            const g = imgData.data[i+1];
            const b = imgData.data[i+2];
            // Simpele drempel: alles dat bijna wit is wordt transparant
            if (r > 240 && g > 240 && b > 240) {
                imgData.data[i+3] = 0;
            }
        }
        tctx.putImageData(imgData, 0, 0);
        const newImg = new Image();
        newImg.onload = function() { callback(newImg); };
        newImg.src = tempCanvas.toDataURL();
    }
    
    // Laad bal image (met wit transparant)
    function loadBallImage() {
        ball.image = new Image();
        ball.image.src = 'images/head.png';
        ball.image.onload = function() {
            makeWhiteTransparent(ball.image, function(transImg) {
                ball.image = transImg;
            });
        };
        // Fallback naar een standaard bal als de afbeelding niet laadt
        ball.image.onerror = () => {
            console.log('Ball image could not be loaded. Using default ball.');
            ball.image = null;
        };
    }
    
    // Achtergrondfoto Utrecht
    let cityBgImg = null;
    function loadCityBgImage(callback) {
        if (cityBgImg) {
            callback && callback();
            return;
        }
        cityBgImg = new Image();
        cityBgImg.onload = function() { callback && callback(); };
        cityBgImg.src = 'images/utrecht-bg.jpg';
    }
    
    // Event listeners
    function updatePaddlePosition(clientX) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;  // Schaal factor voor correcte positie
        const relativeX = (clientX - rect.left) * scaleX;
        
        // Bereken nieuwe paddle positie
        let newX = relativeX - paddle.width / 2;
        
        // Houd paddle binnen canvas grenzen
        newX = Math.max(0, Math.min(GAME_WIDTH - paddle.width, newX));
        
        // Vloeiende beweging
        paddle.x = newX;
        
        // Verplaats bal met paddle als het op de paddle is
        if (ballOnPaddle) {
            ball.x = paddle.x + paddle.width / 2;
        }
    }

    // Mouse events
    canvas.addEventListener('mousemove', (e) => {
        updatePaddlePosition(e.clientX);
    });

    // Touch events
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Voorkom scrollen
        if (e.touches.length > 0) {
            updatePaddlePosition(e.touches[0].clientX);
        }
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Voorkom scrollen
        if (e.touches.length > 0) {
            updatePaddlePosition(e.touches[0].clientX);
            // Start het spel als de bal op de paddle staat
            if (ballOnPaddle && gameRunning) {
                launchBall();
            }
        }
    }, { passive: false });

    // Voeg click event toe voor het starten van het spel (alleen voor desktop)
    canvas.addEventListener('click', (e) => {
        if (ballOnPaddle && gameRunning) {
            launchBall();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && gameRunning && ballOnPaddle) {
            launchBall();
        }
    });
    
    // DIRECT event handlers toevoegen
    if (startButton) {
        startButton.onclick = function() {
            console.log("Start button clicked");
            startGame();
        };
    }
    
    if (restartButton) {
        restartButton.onclick = function() {
            console.log("Restart button clicked");
            restartGame();
        };
    }
    
    if (messageButton) {
        messageButton.onclick = function() {
            console.log("Message button clicked");
            restartGame();
        };
    }
    
    if (muteButton) {
        muteButton.onclick = function() {
            console.log("Mute button clicked");
            const isMuted = soundManager.toggleMute();
            muteButton.textContent = isMuted ? '🔇' : '🔊';
        };
    }
    
    if (themeToggle) {
        themeToggle.onchange = function() {
            console.log("Theme toggle changed");
            document.body.classList.toggle('dark-mode');
        };
    }
    
    // Game functies
    function startGame() {
        console.log("Starting game...");
        loadBallImage();
        currentLevel = levelManager.getCurrentLevel();
        gameRunning = true;
        
        if (startButton) startButton.classList.add('hidden');
        if (restartButton) restartButton.classList.add('hidden');
        if (messageDiv) messageDiv.classList.add('hidden');
        
        resetGame();
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        gameLoop();
    }
    
    function restartGame() {
        console.log("Restarting game...");
        score = 0;
        lives = 3;
        
        if (scoreDisplay) scoreDisplay.textContent = score;
        if (livesDisplay) livesDisplay.textContent = lives;
        
        resetGame();
        
        if (messageDiv) messageDiv.classList.add('hidden');
        gameRunning = true;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        gameLoop();
        
        if (restartButton) restartButton.classList.add('hidden');
    }
    
    function resetGame() {
        console.log("Resetting game...");
        currentLevel = levelManager.getCurrentLevel();
        
        // Reset paddle
        paddle.width = paddle.originalWidth;
        paddle.x = GAME_WIDTH / 2 - paddle.width / 2;
        
        // Reset ball
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius;
        ball.dx = 0;
        ball.dy = 0;
        ballOnPaddle = true;
        
        // Reset powerup state
        powerupActive = false;
        powerupTimer = 0;
    }
    
    function launchBall() {
        if (ballOnPaddle) {
            console.log("Launching ball...");
            ballOnPaddle = false;
            ball.dx = ball.speed * (Math.random() - 0.5);
            ball.dy = -ball.speed;
            soundManager.play('hit');
        }
    }
    
    function gameLoop() {
        if (!gameRunning) return;
        
        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    function update() {
        // Move paddle
        paddle.x += paddle.dx;
        
        // Keep paddle within bounds
        if (paddle.x < 0) {
            paddle.x = 0;
        } else if (paddle.x + paddle.width > GAME_WIDTH) {
            paddle.x = GAME_WIDTH - paddle.width;
        }
        
        // If ball is on paddle, it moves with the paddle
        if (ballOnPaddle) {
            ball.x = paddle.x + paddle.width / 2;
            return;
        }
        
        // Move ball
        ball.x += ball.dx;
        ball.y += ball.dy;
        
        // Ball collision with walls
        if (ball.x - ball.radius < 0 || ball.x + ball.radius > GAME_WIDTH) {
            ball.dx = -ball.dx;
            soundManager.play('hit');
        }
        
        if (ball.y - ball.radius < 0) {
            ball.dy = -ball.dy;
            soundManager.play('hit');
        }
        
        // Ball lost (bottom of screen)
        if (ball.y + ball.radius > GAME_HEIGHT) {
            lives--;
            if (livesDisplay) livesDisplay.textContent = lives;
            soundManager.play('lose');
            
            if (lives <= 0) {
                gameOver(false);
            } else {
                ballOnPaddle = true;
                ball.x = paddle.x + paddle.width / 2;
                ball.y = paddle.y - ball.radius;
                ball.dx = 0;
                ball.dy = 0;
            }
        }
        
        // Ball collision with paddle
        if (
            ball.y + ball.radius > paddle.y &&
            ball.y - ball.radius < paddle.y + paddle.height &&
            ball.x > paddle.x &&
            ball.x < paddle.x + paddle.width
        ) {
            // Calculate ball direction based on where it hit the paddle
            const hitPosition = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
            const angle = hitPosition * Math.PI / 3; // Max 60 degrees
            
            ball.dx = ball.speed * Math.sin(angle);
            ball.dy = -ball.speed * Math.cos(angle);
            
            soundManager.play('hit');
        }
        
        // Ball collision with blocks
        for (let i = 0; i < currentLevel.blocks.length; i++) {
            const block = currentLevel.blocks[i];
            
            if (
                ball.x + ball.radius > block.x &&
                ball.x - ball.radius < block.x + block.width &&
                ball.y + ball.radius > block.y &&
                ball.y - ball.radius < block.y + block.height
            ) {
                // Determine collision direction
                const overlapLeft = ball.x + ball.radius - block.x;
                const overlapRight = block.x + block.width - (ball.x - ball.radius);
                const overlapTop = ball.y + ball.radius - block.y;
                const overlapBottom = block.y + block.height - (ball.y - ball.radius);
                
                // Find the smallest overlap
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                
                // Adjust ball direction based on collision side
                if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                    ball.dx = -ball.dx;
                } else {
                    ball.dy = -ball.dy;
                }
                
                // Reduce block hits
                block.hits--;
                
                // If block is destroyed
                if (block.hits <= 0) {
                    // Add points
                    score += block.points;
                    if (scoreDisplay) scoreDisplay.textContent = score;
                    
                    // Remove block
                    currentLevel.blocks.splice(i, 1);
                    
                    // Special behavior for Dom Tower
                    if (block.type === 3) {
                        // More points already handled above
                        soundManager.play('powerup');
                    } else {
                        soundManager.play('hit');
                    }
                    
                    // Random chance to spawn a powerup
                    if (Math.random() < 0.2) {
                        spawnPowerup(block.x + block.width / 2, block.y + block.height / 2);
                    }
                } else {
                    soundManager.play('hit');
                }
                
                // Only handle one collision per frame
                break;
            }
        }
        
        // Check for level completion
        if (currentLevel.blocks.length === 0) {
            gameOver(true);
        }
        
        // Update bicycles
        bicycleSpawnTimer++;
        if (bicycleSpawnTimer > 300) { // Spawn every ~5 seconds
            spawnBicycle();
            bicycleSpawnTimer = 0;
        }
        
        for (let i = 0; i < currentLevel.bicycles.length; i++) {
            const bicycle = currentLevel.bicycles[i];
            bicycle.x += bicycle.dx;
            
            // Remove bicycle when it goes off screen
            if ((bicycle.dx > 0 && bicycle.x > GAME_WIDTH) || 
                (bicycle.dx < 0 && bicycle.x + bicycle.width < 0)) {
                currentLevel.bicycles.splice(i, 1);
                i--;
                continue;
            }
            
            // Ball collision with bicycle
            if (
                ball.x + ball.radius > bicycle.x &&
                ball.x - ball.radius < bicycle.x + bicycle.width &&
                ball.y + ball.radius > bicycle.y &&
                ball.y - ball.radius < bicycle.y + bicycle.height
            ) {
                // Change ball direction
                ball.dy = -ball.dy;
                soundManager.play('hit');
                
                // Remove bicycle
                currentLevel.bicycles.splice(i, 1);
                i--;
            }
        }
        
        // Update powerups
        for (let i = 0; i < currentLevel.powerups.length; i++) {
            const powerup = currentLevel.powerups[i];
            powerup.y += powerup.dy;
            
            // Remove powerup when it goes off screen
            if (powerup.y > GAME_HEIGHT) {
                currentLevel.powerups.splice(i, 1);
                i--;
                continue;
            }
            
            // Powerup collision with paddle
            if (
                powerup.x + powerup.width > paddle.x &&
                powerup.x < paddle.x + paddle.width &&
                powerup.y + powerup.height > paddle.y &&
                powerup.y < paddle.y + paddle.height
            ) {
                // Activate powerup
                activatePowerup(powerup.type);
                
                // Remove powerup
                currentLevel.powerups.splice(i, 1);
                i--;
            }
        }
        
        // Handle active powerup timer
        if (powerupActive) {
            powerupTimer++;
            
            if (powerupTimer >= POWERUP_DURATION / (1000 / 60)) { // Convert ms to frames
                // Deactivate powerup
                deactivatePowerup();
            }
        }
    }
    
    function spawnBicycle() {
        const bicycleHeight = 30;
        const bicycleWidth = 60;
        // Fietsen moeten onder de blokkenrijen rijden
        // Bepaal de onderkant van de blokken
        const rows = 5;
        const blockHeight = 30;
        const vSpacing = 30;
        const marginY = 40;
        const blocksBottom = marginY + rows * (blockHeight + vSpacing) - vSpacing;
        // Laat de fiets net onder de blokkenrijen rijden
        const y = blocksBottom + 10;
        // Randomly decide direction
        const fromLeft = Math.random() < 0.5;
        const bicycle = {
            x: fromLeft ? -bicycleWidth : GAME_WIDTH,
            y: y,
            width: bicycleWidth,
            height: bicycleHeight,
            dx: fromLeft ? BICYCLE_SPEED : -BICYCLE_SPEED,
            color: '#2c3e50'
        };
        currentLevel.bicycles.push(bicycle);
    }
    
    function spawnPowerup(x, y) {
        const powerupWidth = 30;
        const powerupHeight = 30;
        
        const powerup = {
            x: x - powerupWidth / 2,
            y: y - powerupHeight / 2,
            width: powerupWidth,
            height: powerupHeight,
            dy: POWERUP_SPEED,
            type: 'stroopwafel',
            color: '#e67e22'
        };
        
        currentLevel.powerups.push(powerup);
    }
    
    function activatePowerup(type) {
        soundManager.play('powerup');
        
        if (type === 'stroopwafel') {
            // Enlarge paddle
            paddle.width = paddle.originalWidth * 1.5;
            paddle.x = Math.min(paddle.x, GAME_WIDTH - paddle.width); // Keep in bounds
            powerupActive = true;
            powerupTimer = 0;
        }
    }
    
    function deactivatePowerup() {
        // Reset paddle size
        paddle.width = paddle.originalWidth;
        paddle.x = Math.min(paddle.x, GAME_WIDTH - paddle.width); // Keep in bounds
        powerupActive = false;
    }
    
    function gameOver(win) {
        gameRunning = false;
        
        if (messageDiv) {
            messageDiv.classList.remove('hidden');
            if (restartButton) restartButton.classList.remove('hidden');
            
            if (messageText) {
                if (win) {
                    messageText.textContent = 'Je hebt gewonnen! Score: ' + score;
                    soundManager.play('win');
                } else {
                    messageText.textContent = 'Game Over! Score: ' + score;
                    soundManager.play('lose');
                }
            }
        }
    }
    
    // Maak een statische achtergrond eenmalig
    let backgroundCanvas;
    function createBackground() {
        if (backgroundCanvas) return backgroundCanvas;
        backgroundCanvas = document.createElement('canvas');
        backgroundCanvas.width = GAME_WIDTH;
        backgroundCanvas.height = GAME_HEIGHT;
        const bgCtx = backgroundCanvas.getContext('2d');
        
        // Laad en teken de foto als achtergrond
        loadCityBgImage(function() {
            // Optioneel: blur toepassen als ondersteund
            if (bgCtx.filter !== undefined) {
                bgCtx.filter = 'blur(6px)';
            }
            bgCtx.drawImage(cityBgImg, 0, 0, GAME_WIDTH, GAME_HEIGHT);
            bgCtx.filter = 'none';
            // Leg een semi-transparant wit vlak over de afbeelding
            bgCtx.fillStyle = 'rgba(255,255,255,0.65)';
        bgCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        });
        
        return backgroundCanvas;
    }
    
    function draw() {
        // Clear canvas
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Teken de vooraf gemaakte achtergrond
        ctx.drawImage(createBackground(), 0, 0);
        
        // DEBUG: Teken hulplijnen om te controleren of de uitlijning correct is
        const showDebugLines = false; // Debug lijnen UIT
        
        // Draw paddle
        ctx.fillStyle = powerupActive ? '#f39c12' : '#c61f3e'; // Utrecht red, or yellow when powerup active
        ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
        
        // Draw ball
        if (ball.image && ball.image.complete && ball.image.naturalHeight !== 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(
                ball.image,
                ball.x - ball.radius,
                ball.y - ball.radius,
                ball.radius * 2,
                ball.radius * 2
            );
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#c61f3e'; // Utrecht red
            ctx.fill();
            ctx.closePath();
        }
        
        // Draw blocks
        for (const block of currentLevel.blocks) {
            const gevelTypes = ['trap', 'klok', 'lijst', 'tuit'];
            const gevelType = gevelTypes[(block.x / (block.width + 10)) % gevelTypes.length | 0];
            if (block.type === 3) {
                drawDomtoren(ctx, block.x, block.y, block.width, block.height * 2);
            } else {
                drawGrachtenpand(ctx, block.x, block.y, block.width, block.height, gevelType, block.color, block.gevelHeight);
            }
        }
        
        // Draw bicycles
        for (const bicycle of currentLevel.bicycles) {
            // Simple bicycle representation
            ctx.fillStyle = bicycle.color || '#2c3e50';
            
            // Draw wheels
            ctx.beginPath();
            ctx.arc(bicycle.x + 15, bicycle.y + 15, 8, 0, Math.PI * 2);
            ctx.arc(bicycle.x + bicycle.width - 15, bicycle.y + 15, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw frame
            ctx.beginPath();
            ctx.moveTo(bicycle.x + 15, bicycle.y + 15);
            ctx.lineTo(bicycle.x + bicycle.width / 2, bicycle.y + 5);
            ctx.lineTo(bicycle.x + bicycle.width - 15, bicycle.y + 15);
            ctx.lineTo(bicycle.x + bicycle.width / 2, bicycle.y + 15);
            ctx.lineTo(bicycle.x + 15, bicycle.y + 15);
            ctx.stroke();
        }
        
        // Draw powerups
        for (const powerup of currentLevel.powerups) {
            // Simple stroopwafel representation
            ctx.fillStyle = powerup.color || '#e67e22';
            ctx.beginPath();
            ctx.arc(powerup.x + powerup.width / 2, powerup.y + powerup.height / 2, 
                     powerup.width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Grid pattern
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(powerup.x, powerup.y + powerup.height / 2);
            ctx.lineTo(powerup.x + powerup.width, powerup.y + powerup.height / 2);
            ctx.moveTo(powerup.x + powerup.width / 2, powerup.y);
            ctx.lineTo(powerup.x + powerup.width / 2, powerup.y + powerup.height);
            ctx.stroke();
        }
        
        // If ball is on paddle, show launch instruction
        if (ballOnPaddle && gameRunning) {
            // Pokemon-style text effect
            ctx.save();
            
            // Position text below blocks with extra margin
            const rows = 7;
            const blockHeight = 24;
            const vSpacing = 20;
            const marginY = 48;
            const blocksBottom = marginY + rows * (blockHeight + vSpacing) - vSpacing;
            const textY = blocksBottom + 80;
            
            // Check if device is mobile
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const instructionText = isMobile ? 
                'TIK OP HET VELD OM TE BEGINNEN!' : 
                'DRUK OP SPATIE OM TE BEGINNEN!';
            
            // Draw background
            ctx.font = 'bold 28px "Fredoka One", Arial Rounded MT Bold, Arial, sans-serif';
            const textWidth = ctx.measureText(instructionText).width;
            const padding = 20;
            
            // Draw semi-transparent background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeStyle = '#c61f3e';
            ctx.lineWidth = 3;
            
            // Rounded rectangle background
            const x = GAME_WIDTH / 2 - textWidth / 2 - padding;
            const y = textY - 35;
            const width = textWidth + padding * 2;
            const height = 50;
            const radius = 10;
            
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            
            ctx.fill();
            ctx.stroke();
            
            // Glow effect
            ctx.shadowColor = '#c61f3e';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Main text
            ctx.fillStyle = '#003366';
            ctx.textAlign = 'center';
            
            // Draw text with outline
            ctx.strokeStyle = '#c61f3e';
            ctx.lineWidth = 4;
            ctx.strokeText(instructionText, GAME_WIDTH / 2, textY);
            ctx.fillText(instructionText, GAME_WIDTH / 2, textY);
            
            ctx.restore();
        }
    }
    
    // Teken een startscherm
    function drawStartScreen() {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Achtergrond
        const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        bgGradient.addColorStop(0, '#f5f5f5');
        bgGradient.addColorStop(1, '#e0e0e0');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Titel
        ctx.fillStyle = '#c61f3e'; // Utrecht rood
        ctx.font = 'bold 40px "Fredoka One", Arial Rounded MT Bold, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Utrecht Breakout Challenge', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
        
        // Instructies
        ctx.fillStyle = '#003366'; // Utrecht blauw
        ctx.font = '20px "Fredoka One", Arial Rounded MT Bold, Arial, sans-serif';
        ctx.fillText('Klik op Start Spel om te beginnen', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
        ctx.fillText('Gebruik de muis om de paddle te bewegen', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
        ctx.fillText('Druk op spatiebalk om de bal te lanceren', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80);
    }
    
    // Teken het startscherm direct
    drawStartScreen();
    
    // Maak belangrijke functies direct globaal beschikbaar
    window.utrechtBreakout = {
        startGame: startGame,
        restartGame: restartGame
    };
    
    console.log("Game initialization complete");
};

function drawGrachtenpand(ctx, x, y, w, h, gevelType, color, gevelHeight) {
    // h = totale blokhoogte (gevel + huisje), gevelHeight = hoogte van de gevel
    const houseY = y + gevelHeight;
    const houseH = h - gevelHeight;
    ctx.save();
    // Basis pand
    ctx.fillStyle = color;
    ctx.fillRect(x, houseY, w, houseH);
    // Gevel
    ctx.fillStyle = shadeColor(color, -20);
    switch (gevelType) {
        case 'trap':
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(x + w/2 - w/6 + i*2, y + gevelHeight - (i+1)*(gevelHeight/5), w/3 - i*4, gevelHeight/5);
            }
            break;
        case 'klok':
            ctx.beginPath();
            ctx.moveTo(x, y + gevelHeight);
            ctx.lineTo(x + w*0.15, y);
            ctx.lineTo(x + w*0.85, y);
            ctx.lineTo(x + w, y + gevelHeight);
            ctx.closePath();
            ctx.fill();
            break;
        case 'lijst':
            ctx.fillRect(x, y, w, gevelHeight/1.5);
            break;
        case 'tuit':
            ctx.beginPath();
            ctx.moveTo(x + w/2, y);
            ctx.lineTo(x, y + gevelHeight);
            ctx.lineTo(x + w, y + gevelHeight);
            ctx.closePath();
            ctx.fill();
            break;
    }
    // Ramen
    ctx.fillStyle = '#e0e6f8';
    ctx.fillRect(x + w*0.15, houseY + houseH*0.15, w*0.2, houseH*0.2);
    ctx.fillRect(x + w*0.65, houseY + houseH*0.15, w*0.2, houseH*0.2);
    ctx.fillRect(x + w*0.15, houseY + houseH*0.55, w*0.2, houseH*0.2);
    ctx.fillRect(x + w*0.65, houseY + houseH*0.55, w*0.2, houseH*0.2);
    // Deur
    ctx.fillStyle = '#a67c52';
    ctx.fillRect(x + w*0.4, houseY + houseH*0.7, w*0.2, houseH*0.3);
    ctx.restore();
}

function drawDomtoren(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#888';
    ctx.fillRect(x + w*0.3, y, w*0.4, h); // Torenlichaam
    ctx.fillStyle = '#aaa';
    ctx.fillRect(x + w*0.4, y - h*0.2, w*0.2, h*0.2); // Spits
    // Ramen
    ctx.fillStyle = '#e0e6f8';
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + w*0.45, y + h*0.15 + i*h*0.18, w*0.1, h*0.1);
    }
    ctx.restore();
}

function shadeColor(color, percent) {
    // Simpele kleurshading voor gevels
    let f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}