// Configuration globale du bot
const config = {
    // ATTENTION SÉCURITÉ : Clés API en dur dans le code !
    // Ne jamais partager ce fichier ou le publier en ligne !
    apiKey: 'bg_a6cefdfb426b44f00fa74ac0203a5049',
    secretKey: '0bddf82631180ae2d38d9e0ad6470480a71382e53166944b40b0223b7e65dbcc',
    passphrase: 'Charmant16320Charmant16320',
    
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

// API Configuration
const API_BASE = 'http://localhost:3000';

// Global variables
let top30Pairs = [];
let currentScanIndex = 0;
let openPositions = [];
let balance = { usdtBalance: 0, totalEquity: 0 };
let botStats = { totalScans: 0, totalSignals: 0, totalPositions: 0 };

// NEW: Système de cooldown pour éviter les positions multiples
let pairCooldowns = {}; // { symbol: timestamp }
const COOLDOWN_MINUTES = 30;

// Cooldown functions
function addPairToCooldown(symbol) {
    const expirationTime = Date.now() + (COOLDOWN_MINUTES * 60 * 1000);
    pairCooldowns[symbol] = expirationTime;
    log(`⏰ ${symbol} ajouté au cooldown pour ${COOLDOWN_MINUTES} minutes`, 'INFO');
}

function isPairInCooldown(symbol) {
    if (!pairCooldowns[symbol]) return false;
    
    const now = Date.now();
    if (now > pairCooldowns[symbol]) {
        delete pairCooldowns[symbol];
        return false;
    }
    
    return true;
}

function getRemainingCooldown(symbol) {
    if (!pairCooldowns[symbol]) return 0;
    
    const remaining = pairCooldowns[symbol] - Date.now();
    return Math.ceil(remaining / (60 * 1000)); // Minutes restantes
}

// Bot state variables
let botRunning = false;
let volumeScanInterval = null;
let tradingLoopInterval = null;
let statsInterval = null;
let pnlUpdateInterval = null;
let stopLossManagementInterval = null;
let botStartTime = null;

// Data storage
let recentAnalysis = new Map();
let pairCooldown = new Map();

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