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
    cooldownMinutes: 30
};

// API Configuration - Serveur proxy VPS existant
const API_BASE = 'https://api.crea-vigne.fr/api';

// Global variables
let top30Pairs = [];
let currentScanIndex = 0;
let openPositions = [];
let balance = { usdtBalance: 0, totalEquity: 0 };
let botStats = { totalScans: 0, totalSignals: 0, totalPositions: 0 };

// Bot state variables
let botRunning = false;
let volumeScanInterval = null;
let tradingLoopInterval = null;
let statsInterval = null;
let pnlUpdateInterval = null;
let stopLossManagementInterval = null;
let positionSyncInterval = null;
let botStartTime = null;

// Système de cooldown pour éviter les positions multiples
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