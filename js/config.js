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
    trailingStop: 1.0
};

// Balance information
let balance = { USDT: 0, totalEquity: 0 }; 
