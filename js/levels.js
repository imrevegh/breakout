// Utrecht Breakout Level Manager v3.0 (HARDCODED POSITIES)
console.log("Levels.js v3.0 geladen - HARDCODED POSITIES!");

// In deze versie gebruiken we VOLLEDIG HARDCODED posities voor de blokken
class LevelManager {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.currentLevel = 0;
        this.version = "v3.0"; // Versie voor weergave
        
        // Block types met VOLLEDIG ANDERE KLEUREN
        this.blockTypes = {
            1: { // Regular canal house type 1 - NU FEL GROEN
                color: '#4CAF50', // Fel groen
                points: 10,
                hits: 1
            },
            2: { // Regular canal house type 2
                color: '#FFEB3B', // Fel geel
                points: 15,
                hits: 1
            },
            3: { // Dom Tower (special block)
                color: '#9C27B0', // Paars
                points: 50,
                hits: 2
            }
        };
        
        console.log("LevelManager v3.0 geïnitialiseerd met hardcoded posities en nieuwe kleuren");
    }
    
    getCurrentLevel() {
        const blocks = [];
        // Instellingen
        const blockWidth = 48;
        const houseHeight = 24;
        const gevelHeight = 8;
        const blockHeight = houseHeight + gevelHeight; // 32px totaal
        const spacing = 20;
        const vSpacing = 20;
        const cols = 12;
        const rows = 7;
        const marginX = 32;
        const marginY = 48;
        // Contrasterend kleurenpalet
        const utrechtColors = [
            '#B52A00', // fel baksteenrood
            '#1A237E', // donkerblauw
            '#FFD600', // fel geel
            '#388E3C', // donkergroen
            '#F44336', // fel rood
            '#212121', // bijna zwart
            '#FF9800', // oranje
            '#1976D2', // helder blauw
            '#E91E63', // fel roze
            '#4CAF50', // helder groen
            '#FFF'     // wit
        ];
        const totalWidth = cols * blockWidth + (cols - 1) * spacing;
        // Zorg dat alles binnen het canvas past
        const maxWidth = this.gameWidth - 2 * marginX;
        const scale = totalWidth > maxWidth ? maxWidth / totalWidth : 1;
        const scaledBlockWidth = blockWidth * scale;
        const scaledSpacing = spacing * scale;
        const totalScaledWidth = cols * scaledBlockWidth + (cols - 1) * scaledSpacing;
        const startX = marginX + (this.gameWidth - 2*marginX - totalScaledWidth) / 2;
        const startY = marginY;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let type = 1;
                if (row === 0 && (col === 2 || col === cols - 3)) type = 3;
                else if (row < 2) type = 2;
                const color = utrechtColors[(col + row) % utrechtColors.length];
                const x = startX + col * (scaledBlockWidth + scaledSpacing);
                const y = startY + row * (blockHeight + vSpacing);
                blocks.push(this.createBlock(x, y, type, color, scaledBlockWidth, blockHeight, gevelHeight));
            }
        }

        return {
            blocks: blocks,
            bicycles: [],
            powerups: []
        };
    }
    
    // Helper functie om een blok te maken
    createBlock(x, y, type, color, width, height, gevelHeight) {
        return {
            x: x,
            y: y,
            width: width,
            height: height,
            gevelHeight: gevelHeight,
            type: type,
            hits: type === 3 ? 2 : 1,
            points: this.blockTypes[type].points,
            color: color
        };
    }
    
    getPointsForBlockType(type) {
        return this.blockTypes[type].points;
    }
    
    getVersion() {
        return this.version;
    }
}