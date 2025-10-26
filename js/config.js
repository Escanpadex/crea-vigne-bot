// Configuration constants and variables
// console.log('📁 Loading config.js...'); // Supprimé pour réduire les logs
const API_BASE = 'https://api.crea-vigne.fr/api';

// Bot state variables
let botRunning = false;
let volumeScanInterval = null;
let tradingLoopInterval = null;
let statsInterval = null;
let pnlUpdateInterval = null;
let stopLossManagementInterval = null;
let positionSyncInterval = null;
let botStartTime = null;

// Data storage
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

// Configuration object
let config = {
    apiKey: '',
    secretKey: '',
    passphrase: '',
    capitalPercent: 5, // 🔧 RÉDUIT: 5% au lieu de 45% pour éviter "balance exceeded"
    leverage: 5,
    trailingStop: 1.0,
    cooldownMinutes: 30,
    targetPnL: 0.90,                // 🆕 NOUVEAU: Objectif PnL configurable (0.90% par défaut)
    maxBotPositions: 12,            // 🆕 NOUVEAU: Limite configurable des positions bot (2-25)
    maxPositionTimeHours: 12,       // 🆕 NOUVEAU: Temps maximum d'ouverture d'une position en heures (3-48h, défaut: 12h)
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

// 🆕 NOUVEAU: Liste des actions tokenisées (marchés traditionnels avec horaires limités)
const TOKENIZED_STOCKS = [
    'NVDA', 'AAPL', 'GOOGL', 'GOOG', 'MSFT', 'TSLA', 'AMZN', 'META',
    'NFLX', 'AMD', 'INTC', 'BABA', 'TSM', 'V', 'MA', 'JPM', 'BAC',
    'DIS', 'COIN', 'PYPL', 'SQ', 'SNAP', 'UBER', 'LYFT', 'ABNB',
    'HOOD', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'PLTR', 'SOFI',
    'GME', 'AMC', 'BB', 'NOK', 'WISH', 'CLOV', 'SPCE', 'DKNG'
];

// 🆕 FONCTION: Vérifier si un symbole est une action tokenisée
function isTokenizedStock(symbol) {
    // Enlever "USDT" du symbole pour vérifier
    const baseSymbol = symbol.replace('USDT', '').replace('_UMCBL', '');
    return TOKENIZED_STOCKS.includes(baseSymbol);
}

// 🆕 FONCTION: Vérifier si les marchés actions sont ouverts
function areStockMarketsOpen() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Dimanche, 6 = Samedi
    const hourUTC = now.getUTCHours();
    const minuteUTC = now.getUTCMinutes();
    
    // Weekend : marchés fermés (samedi et dimanche)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
    }
    
    // Vendredi après 21:00 UTC (fermeture US) jusqu'à lundi 13:30 UTC (pré-ouverture US)
    if (dayOfWeek === 5 && hourUTC >= 21) {
        return false;
    }
    if (dayOfWeek === 1 && (hourUTC < 13 || (hourUTC === 13 && minuteUTC < 30))) {
        return false;
    }
    
    // Horaires de trading US: 13:30 - 21:00 UTC (09:30 - 17:00 EST)
    // On ajoute une marge de 30 min avant/après pour les sessions pré/post-market
    const totalMinutes = hourUTC * 60 + minuteUTC;
    const marketOpen = 13 * 60 + 30;  // 13:30 UTC
    const marketClose = 21 * 60 + 30; // 21:30 UTC (avec marge post-market)
    
    if (totalMinutes >= marketOpen && totalMinutes <= marketClose) {
        return true;
    }
    
    return false;
}

// 🆕 FONCTION: Obtenir le prochain horaire d'ouverture des marchés
function getNextMarketOpenTime() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hourUTC = now.getUTCHours();
    const minuteUTC = now.getUTCMinutes();
    
    let daysToAdd = 0;
    
    // Si on est samedi, attendre jusqu'à lundi
    if (dayOfWeek === 6) {
        daysToAdd = 2;
    }
    // Si on est dimanche, attendre jusqu'à lundi
    else if (dayOfWeek === 0) {
        daysToAdd = 1;
    }
    // Si on est vendredi après 21:00, attendre jusqu'à lundi
    else if (dayOfWeek === 5 && hourUTC >= 21) {
        daysToAdd = 3;
    }
    // Si on est avant l'ouverture du jour
    else if (hourUTC < 13 || (hourUTC === 13 && minuteUTC < 30)) {
        daysToAdd = 0; // Ouverture aujourd'hui
    }
    // Si on est après la fermeture du jour
    else if (hourUTC >= 21) {
        daysToAdd = 1; // Ouverture demain
    }
    
    const nextOpen = new Date(now);
    nextOpen.setUTCDate(nextOpen.getUTCDate() + daysToAdd);
    nextOpen.setUTCHours(13, 30, 0, 0); // 13:30 UTC
    
    return nextOpen;
}

// 🧪 FONCTION DE TEST: Diagnostiquer le statut des marchés d'actions
function testMarketStatus(symbol = null) {
    console.log('🧪 ========== TEST STATUT MARCHÉS ==========');
    console.log(`📅 Date/Heure actuelle: ${new Date().toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC`);
    console.log(`📅 Jour de la semaine: ${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getUTCDay()]}`);
    console.log('');
    
    const marketsOpen = areStockMarketsOpen();
    console.log(`🏦 Marchés actions: ${marketsOpen ? '✅ OUVERTS' : '❌ FERMÉS'}`);
    
    if (!marketsOpen) {
        const nextOpen = getNextMarketOpenTime();
        console.log(`⏰ Prochaine ouverture: ${nextOpen.toLocaleString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'UTC'
        })} UTC`);
        
        const hoursUntil = Math.floor((nextOpen - new Date()) / (1000 * 60 * 60));
        const minutesUntil = Math.floor(((nextOpen - new Date()) % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`⏳ Temps avant ouverture: ${hoursUntil}h ${minutesUntil}min`);
    }
    
    console.log('');
    console.log('📊 Actions tokenisées détectées:');
    console.log(`   Total: ${TOKENIZED_STOCKS.length} actions dans la liste`);
    
    if (symbol) {
        console.log('');
        console.log(`🔍 Test pour ${symbol}:`);
        const isStock = isTokenizedStock(symbol);
        console.log(`   Est une action tokenisée: ${isStock ? '✅ OUI' : '❌ NON'}`);
        
        if (isStock) {
            console.log(`   Peut être fermée maintenant: ${marketsOpen ? '✅ OUI' : '❌ NON (marchés fermés)'}`);
        }
    }
    
    // Tester les positions actuelles
    if (typeof openPositions !== 'undefined' && openPositions.length > 0) {
        console.log('');
        console.log('📋 Positions actuelles:');
        openPositions.forEach(pos => {
            const isStock = isTokenizedStock(pos.symbol);
            if (isStock) {
                console.log(`   🏦 ${pos.symbol}: Action tokenisée ${marketsOpen ? '(peut être fermée)' : '⚠️ (MARCHÉS FERMÉS - ne peut pas être fermée)'}`);
            }
        });
    }
    
    console.log('');
    console.log('✅ Test terminé');
}

// Exposer les fonctions globalement
window.isTokenizedStock = isTokenizedStock;
window.areStockMarketsOpen = areStockMarketsOpen;
window.getNextMarketOpenTime = getNextMarketOpenTime;
window.TOKENIZED_STOCKS = TOKENIZED_STOCKS;
window.testMarketStatus = testMarketStatus; 