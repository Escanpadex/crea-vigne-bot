// Configuration constants and variables
const API_BASE = 'https://api.crea-vigne.fr/api';

// Bot state variables
let botRunning = false;
let volumeScanInterval = null;
let tradingLoopInterval = null;
let statsInterval = null;
let pnlUpdateInterval = null;
let stopLossManagementInterval = null;
let botStartTime = null;

// Data storage
let top30Pairs = [];
let currentScanIndex = 0;
let openPositions = [];
let recentAnalysis = new Map();
let pairCooldown = new Map();
let botStats = {
    totalScans: 0,
    totalSignals: 0,
    totalPositions: 0
};

// Configuration object
let config = {
    apiKey: '',
    secretKey: '',
    passphrase: '',
    capitalPercent: 5,
    leverage: 2,
    trailingStop: 1.0,
    cooldownMinutes: 30,
    // NEW: Advanced trailing stop settings
    trailingStopSettings: {
        initialStopPercent: 1.0,        // Stop loss initial (-1%)
        trailingPercent: 1.0,           // Distance de trailing (1% sous le plus haut)
        updateFrequencySeconds: 30,     // Fréquence de mise à jour (30s)
        minProfitToTrail: 0.5,         // Profit minimum avant activation trailing (0.5%)
        aggressiveTrailing: false,     // Mode agressif (0.5% au lieu de 1%)
        breakEvenProtection: true      // Protection break-even après +2%
    }
};

// Balance information
let balance = { USDT: 0, totalEquity: 0 };

// NEW: Function to check if pair is in cooldown
function isPairInCooldown(symbol) {
    const lastPositionTime = pairCooldown.get(symbol);
    if (!lastPositionTime) return false;
    
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    const timeElapsed = Date.now() - lastPositionTime;
    
    return timeElapsed < cooldownMs;
}

// NEW: Function to add pair to cooldown
function addPairToCooldown(symbol) {
    pairCooldown.set(symbol, Date.now());
    log(`⏰ ${symbol} ajouté au cooldown (${config.cooldownMinutes} minutes)`, 'INFO');
}

// NEW: Function to check remaining cooldown time
function getRemainingCooldown(symbol) {
    const lastPositionTime = pairCooldown.get(symbol);
    if (!lastPositionTime) return 0;
    
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    const timeElapsed = Date.now() - lastPositionTime;
    const remaining = Math.max(0, cooldownMs - timeElapsed);
    
    return Math.ceil(remaining / (60 * 1000)); // Return minutes
} 