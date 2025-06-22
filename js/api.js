// API Functions for Bitget Trading Bot
console.log('📁 Loading api.js...');

// Auto-connection flag pour éviter les reconnexions multiples
let autoConnectionAttempted = false;

async function makeRequest(endpoint, options = {}) {
    try {
        const timestamp = Date.now().toString();
        const headers = {
            'Content-Type': 'application/json',
            'apikey': config.apiKey,
            'secretkey': config.secretKey,
            'passphrase': config.passphrase,
            'timestamp': timestamp,
            ...options.headers
        };
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        return await response.json();
    } catch (error) {
        log(`Erreur API: ${error.message}`, 'ERROR');
        return null;
    }
}

async function testConnection() {
    config.apiKey = document.getElementById('apiKey').value;
    config.secretKey = document.getElementById('secretKey').value;
    config.passphrase = document.getElementById('passphrase').value;
    
    if (!config.apiKey || !config.secretKey || !config.passphrase) {
        alert('Veuillez remplir tous les champs API');
        return;
    }
    
    log('🔄 Test de connexion à Bitget Futures...');
    
    const result = await makeRequest('/bitget/api/v2/mix/account/accounts?productType=USDT-FUTURES');
    
    if (result && result.code === '00000') {
        document.getElementById('connectionStatus').classList.add('online');
        document.getElementById('connectionText').textContent = 'Connecté (Futures)';
        log('✅ Connexion réussie à Bitget Futures!', 'SUCCESS');
        await refreshBalance();
        
        // 🚀 AUTOMATISATION pour la nouvelle stratégie MACD multi-timeframes
        log('🤖 Préparation de la stratégie MACD multi-timeframes...', 'SUCCESS');
        
        // 1. Test de récupération des paires disponibles
        log('🔄 Test de récupération des paires disponibles...', 'INFO');
        const testPairs = await getAllAvailablePairs();
        if (testPairs.length > 0) {
            log(`✅ ${testPairs.length} paires disponibles - Stratégie MACD prête`, 'SUCCESS');
        } else {
            log('⚠️ Aucune paire disponible trouvée', 'WARNING');
        }
        
        // 4. Démarrer la synchronisation automatique des positions
        startAutoSyncPositions();
        
        // 5. Rafraîchissement automatique du solde
        if (typeof startAutoBalanceRefresh === 'function') {
            startAutoBalanceRefresh();
        }
        
        log('🎉 Stratégie MACD multi-timeframes activée: Analyse complète + Positions + Balance', 'SUCCESS');
        return true;
    } else {
        log('❌ Échec de la connexion. Vérifiez vos clés API Futures.', 'ERROR');
        return false;
    }
}

// 🆕 FONCTION: Connexion automatique au chargement de la page - DÉSACTIVÉE
// Cette fonction n'est plus appelée automatiquement
async function autoConnectOnLoad() {
    // Fonction désactivée - la connexion se fait uniquement sur clic du bouton API
    log('ℹ️ Connexion manuelle requise - Cliquez sur le bouton 🔗 API pour vous connecter', 'INFO');
    return false;
}

async function refreshBalance() {
    const result = await makeRequest('/bitget/api/v2/mix/account/accounts?productType=USDT-FUTURES');
    
    if (result && result.data && result.data.length > 0) {
        const account = result.data[0];
        balance.USDT = parseFloat(account.available || 0);
        balance.totalEquity = parseFloat(account.usdtEquity || account.equity || 0);
        
        document.getElementById('usdtBalance').textContent = balance.USDT.toFixed(2);
        document.getElementById('totalEquity').textContent = balance.totalEquity.toFixed(2);
        
        const usedCapital = openPositions.reduce((sum, pos) => sum + pos.size, 0);
        const availableCapital = balance.totalEquity * (config.capitalPercent / 100) * config.leverage - usedCapital;
        
        document.getElementById('usedCapital').textContent = usedCapital.toFixed(2);
        document.getElementById('availableCapital').textContent = Math.max(0, availableCapital).toFixed(2);
        
        log('💰 Balance mise à jour', 'INFO');
    } else {
        log('⚠️ Impossible de récupérer la balance', 'WARNING');
    }
}

async function scanTop30Volume() {
    try {
        const topCount = config.topVolumeCount || 30;
        log(`🔍 Scan des volumes TOP ${topCount} en cours...`, 'INFO');
        
        const response = await fetch(`${API_BASE}/bitget/api/v2/mix/market/tickers?productType=usdt-futures`);
        const data = await response.json();
        
        if (data.code === '00000' && data.data) {
            const validPairs = data.data
                .filter(pair => {
                    const volume = parseFloat(pair.usdtVolume || 0);
                    return volume > 10000000 && pair.symbol.endsWith('USDT');
                })
                .sort((a, b) => parseFloat(b.usdtVolume) - parseFloat(a.usdtVolume))
                .slice(0, topCount);
            
            // Ancien système TOP 30 désactivé - utiliser getAllAvailablePairs() à la place
            // top30Pairs = validPairs;
            // window.top30Pairs = validPairs;
            // currentScanIndex = 0;
            
            const totalVolume = validPairs.reduce((sum, pair) => sum + parseFloat(pair.usdtVolume), 0);
            log(`✅ TOP ${topCount} mis à jour: ${validPairs.length} paires, Volume total: ${formatNumber(totalVolume)}`, 'SUCCESS');
            
            validPairs.slice(0, Math.min(5, topCount)).forEach((pair, index) => {
                log(`#${index + 1} ${pair.symbol}: ${formatNumber(pair.usdtVolume)} vol`, 'INFO');
            });
            
            // Ancien système d'affichage désactivé
            // document.getElementById('lastScanTime').textContent = new Date().toLocaleTimeString();
            return true;
        } else {
            log('❌ Erreur lors du scan des volumes', 'ERROR');
            return false;
        }
    } catch (error) {
        log(`❌ Erreur scanner: ${error.message}`, 'ERROR');
        return false;
    }
}

// 🔄 NOUVELLE FONCTION: Synchronisation automatique des positions
function startAutoSyncPositions() {
    log('🔄 Démarrage de la synchronisation automatique des positions (toutes les 2 minutes)', 'INFO');
    
    // Arrêter l'ancien intervalle s'il existe
    if (window.autoSyncInterval) {
        clearInterval(window.autoSyncInterval);
    }
    
    // Synchroniser immédiatement
    checkPositionsStatus();
    
    // Programmer la synchronisation toutes les 2 minutes
    window.autoSyncInterval = setInterval(() => {
        if (openPositions.length > 0) {
            log('🔄 Synchronisation automatique des positions...', 'DEBUG');
            checkPositionsStatus();
        }
    }, 2 * 60 * 1000); // 2 minutes
}

// Fonction updateTop30Display supprimée - remplacée par updateMacdAnalysisDisplay
// L'affichage des données est maintenant géré par la nouvelle interface MACD

// Cette fonction n'est plus utilisée avec la nouvelle stratégie
function updateTop30Display() {
    // Fonction désactivée - utiliser updateMacdAnalysisDisplay à la place
    return;
}

async function setLeverage(symbol, leverage) {
    log(`⚡ Configuration du levier ${leverage}x pour ${symbol}...`, 'INFO');
    
    const leverageData = {
        symbol: symbol,
        productType: "USDT-FUTURES",
        marginCoin: "USDT",
        leverage: leverage.toString()
    };
    
    const result = await makeRequest('/bitget/api/v2/mix/account/set-leverage', {
        method: 'POST',
        body: JSON.stringify(leverageData)
    });
    
    if (result && result.code === '00000') {
        log(`✅ Levier ${leverage}x configuré avec succès pour ${symbol}!`, 'SUCCESS');
        return true;
    } else {
        log(`⚠️ Échec config levier ${symbol}: ${result?.msg || 'Erreur'}`, 'WARNING');
        return false;
    }
}

async function getAllAvailablePairs() {
    try {
        log('🔍 Récupération de toutes les paires disponibles sur Bitget...', 'INFO');
        
        const response = await fetch(`${API_BASE}/bitget/api/v2/mix/market/tickers?productType=usdt-futures`);
        const data = await response.json();
        
        if (data.code === '00000' && data.data) {
            const allPairs = data.data
                .filter(pair => {
                    const volume = parseFloat(pair.usdtVolume || 0);
                    return volume > 1000000 && pair.symbol.endsWith('USDT'); // Volume minimum 1M
                })
                .map(pair => ({
                    symbol: pair.symbol,
                    volume: parseFloat(pair.usdtVolume),
                    price: parseFloat(pair.lastPr)
                }))
                .sort((a, b) => b.volume - a.volume);
            
            log(`✅ ${allPairs.length} paires récupérées pour l'analyse MACD`, 'SUCCESS');
            return allPairs;
        } else {
            log('❌ Erreur lors de la récupération des paires', 'ERROR');
            return [];
        }
    } catch (error) {
        log(`❌ Erreur getAllAvailablePairs: ${error.message}`, 'ERROR');
        return [];
    }
}

async function getKlineData(symbol, limit = 50, timeframe = '5m') {
    try {
        const response = await fetch(`${API_BASE}/bitget/api/v2/mix/market/candles?symbol=${symbol}&productType=usdt-futures&granularity=${timeframe}&limit=${limit}`);
        const data = await response.json();
        
        if (data.code === '00000' && data.data) {
            const klines = data.data.map(candle => ({
                timestamp: parseInt(candle[0]),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            })).reverse();
            
            log(`📊 ${symbol}: ${klines.length} bougies ${timeframe} récupérées`, 'DEBUG');
            return klines;
        }
    } catch (error) {
        console.error(`Erreur klines ${symbol}:`, error);
    }
    return [];
}

async function fetchActivePositionsFromAPI() {
    try {
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            return result.data.filter(pos => parseFloat(pos.total) > 0);
        }
        return [];
    } catch (error) {
        console.error('Erreur récupération positions API:', error);
        return [];
    }
}

async function getCurrentPrice(symbol) {
    try {
        const response = await fetch(`${API_BASE}/bitget/api/v2/mix/market/ticker?symbol=${symbol}&productType=usdt-futures`);
        const data = await response.json();
        
        if (data.code === '00000' && data.data) {
            return parseFloat(data.data.lastPr);
        }
        return null;
    } catch (error) {
        console.error(`Erreur prix ${symbol}:`, error);
        return null;
    }
}

async function modifyStopLoss(symbol, stopLossId, newStopPrice, quantity) {
    try {
        const modifyData = {
            symbol: symbol,
            productType: "USDT-FUTURES",
            marginCoin: "USDT",
            orderId: stopLossId,
            triggerPrice: newStopPrice.toString(),
            size: quantity
        };
        
        const result = await makeRequest('/bitget/api/v2/mix/order/modify-plan-order', {
            method: 'POST',
            body: JSON.stringify(modifyData)
        });
        
        if (result && result.code === '00000') {
            log(`🔄 Stop Loss ajusté: ${symbol} → ${newStopPrice.toFixed(4)}`, 'SUCCESS');
            return true;
        } else {
            log(`❌ Échec modification stop loss ${symbol}: ${result?.msg}`, 'ERROR');
            return false;
        }
    } catch (error) {
        log(`❌ Erreur modification stop loss ${symbol}: ${error.message}`, 'ERROR');
        return false;
    }
} 