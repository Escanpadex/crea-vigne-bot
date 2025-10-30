// Configuration constants and variables
console.log('📁 Loading config.js...');
const API_BASE = 'https://api.crea-vigne.fr/api';

// Bot state variables
let botRunning = false;
let currentBalance = 0; // Pour le balance tracker
let volumeScanInterval = null;
let tradingLoopInterval = null;
let statsInterval = null;
let pnlUpdateInterval = null;
let stopLossManagementInterval = null;
let positionSyncInterval = null;
let botStartTime = null;

// Data storage - ancien système TOP 30 supprimé
// let top30Pairs = [];
// let currentScanIndex = 0;
let openPositions = [];
let recentAnalysis = new Map();
let pairCooldown = new Map();
let botStats = {
    totalSignals: 0,
    totalPositions: 0,
    totalClosedPositions: 0,
    winningPositions: 0,
    losingPositions: 0,
    totalWinAmount: 0,
    totalLossAmount: 0
};

// 🚫 EXCLUSION: Actions tokenisées (stocks) disponibles sur Bitget
// Ces instruments causent des problèmes et doivent être exclus du trading automatique
// Liste complète fournie par l'utilisateur
const EXCLUDED_STOCK_TOKENS = [
    // Actions tech & cryptos
    'LINKUSDT', 'LINK',
    'NVDAXUSDT', 'NVDAX',
    'NVDAUSDT', 'NVDAon',
    'AAPLXUSDT', 'AAPLX', 'AAPLon',
    'GOOGLXUSDT', 'GOOGLX', 'GOOGLon',
    'TSLAUSDT', 'TSLAon',
    'METAXUSDT', 'METAX', 'METAon',
    'MSFTUSDT', 'MSFTon',
    'PLTRXUSDT', 'PLTRX',
    'AMDUSDT', 'AMDon',
    'OPENXUSDT', 'OPENX',
    'INTCUSDT', 'INTCon',
    'CSCOUSDT', 'CSCOon',
    'IBMUSDT', 'IBMon',
    
    // Finance & banques
    'COINXUSDT', 'COINX',
    'HOODXUSDT', 'HOODX',
    'JPMUSDT', 'JPMon',
    
    // ETFs & indices
    'SPYXUSDT', 'SPYX',
    'QQQXUSDT', 'QQQX',
    'TQQQXUSDT', 'TQQQX',
    'ITOTUSDT', 'ITOTon',
    'IWNUSDT', 'IWNon',
    'DFDVUSDT', 'DFDVx',
    'GLDXUSDT', 'GLDX',
    
    // Autres actions
    'CRCLXUSDT', 'CRCLX',
    'LMTUSDT', 'LMTon',
    'LLYUSDT', 'LLYon',
    'KOUSDT', 'KOon',
    'PFEUSDT', 'PFEon',
    'PGUSDT', 'PGon',
    'NVOUSDT', 'NVOon',
    'PEPUSDT', 'PEPon',
    'TMUSDT', 'TMon',
    'WMTUSDT', 'WMTon',
    'CVXUSDT', 'CVXon'
];

// Configuration object
let config = {
    apiKey: '',
    secretKey: '',
    passphrase: '',
    capitalPercent: 50,
    leverage: 5,
    trailingStop: 1.0,
    cooldownMinutes: 30,
    targetPnL: 0.9,                 // 🆕 NOUVEAU: Objectif PnL configurable (0.9% par défaut)
    maxBotPositions: 10,            // 🆕 NOUVEAU: Limite configurable des positions bot (10 par défaut)
    maxPositionTimeHours: 4,        // 🆕 NOUVEAU: Temps maximum d'ouverture d'une position en heures (4h par défaut)
    excludedSymbols: EXCLUDED_STOCK_TOKENS, // 🚫 NOUVEAU: Symboles à exclure (actions tokenisées)
    // 🎯 NOUVEAUX PARAMÈTRES: Affichage des positions
    displaySettings: {
        maxPositionsDisplayed: 50,      // Nombre maximum de positions affichées (défaut: 50)
        compactDisplayThreshold: 10,    // Seuil pour passer en affichage compact (défaut: 10)
        autoRefreshInterval: 1000,      // Intervalle de mise à jour de l'affichage (ms)
        showHiddenPositionsCount: true  // Afficher le nombre de positions masquées
    },
    // NEW: MACD Strategy settings (macdTimeframe supprimé - remplacé par filtrage progressif 4H→1H→15M)
    topVolumeCount: 30,             // Nombre de cryptos à analyser (TOP x)
    // Advanced trailing stop settings
    trailingStopSettings: {
        initialStopPercent: 1.0,        // Stop loss initial (-1%)
        trailingPercent: 1.0,           // Distance de trailing (1% sous le plus haut)
        updateFrequencySeconds: 30,     // Fréquence de mise à jour (30s)
        minProfitToTrail: 0.5,         // Profit minimum avant activation trailing (0.5%)
        aggressiveTrailing: false,     // Mode agressif (0.5% au lieu de 1%)
        breakEvenProtection: true      // Protection break-even après +2%
    },
    fees: {
        maker: 0.0002, // 0.02%
        taker: 0.0005  // 0.05%
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