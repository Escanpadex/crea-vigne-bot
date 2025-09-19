// API Functions for Bitget Trading Bot
console.log('📁 Loading api.js...');
console.log('🔧 API.JS VERSION: 4H-FIX-v2 - Timeframe mapping corrigé');

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
        // 🛡️ SÉCURITÉ: Vérifier que l'élément existe
        const connectionTextEl = document.getElementById('connectionText');
        if (connectionTextEl) connectionTextEl.textContent = 'Connecté (Futures)';
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
        
        // 4. 🔧 NOUVEAU: Importer les positions existantes dès la connexion
        log('📥 Importation des positions existantes...', 'INFO');
        try {
            if (typeof window.importExistingPositions === 'function') {
                await window.importExistingPositions();
                log(`✅ Import terminé: ${openPositions ? openPositions.length : 0} position(s) détectée(s)`, 'SUCCESS');
                
                // Forcer la mise à jour des données temps réel après import
                if (typeof window.updatePositionsPnL === 'function') {
                    await window.updatePositionsPnL();
                    log('📊 Données temps réel mises à jour après import', 'SUCCESS');
                }

                // Forcer la mise à jour de l'affichage après import
                if (typeof updatePositionsDisplay === 'function') {
                    updatePositionsDisplay();
                    log('🔄 Affichage des positions mis à jour après import', 'SUCCESS');
                }
            } else {
                log('⚠️ Fonction importExistingPositions non disponible - Retry dans 2s...', 'WARNING');
                // Retry après un délai pour laisser le temps aux scripts de se charger
                setTimeout(async () => {
                    if (typeof window.importExistingPositions === 'function') {
                        await window.importExistingPositions();

                        // Mise à jour des données temps réel
                        if (typeof window.updatePositionsPnL === 'function') {
                            await window.updatePositionsPnL();
                        }

                        if (typeof updatePositionsDisplay === 'function') {
                            updatePositionsDisplay();
                        }
                        log(`✅ Import différé réussi: ${openPositions ? openPositions.length : 0} position(s)`, 'SUCCESS');
                    } else {
                        log('❌ Fonction importExistingPositions toujours indisponible', 'ERROR');
                    }
                }, 2000);
            }
        } catch (error) {
            log(`❌ Erreur lors de l'import des positions: ${error.message}`, 'ERROR');
        }
        
        // 5. Démarrer la synchronisation automatique des positions
        startAutoSyncPositions();
        
        // 6. Rafraîchissement automatique du solde
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
        
        // 🛡️ SÉCURITÉ: Vérifier que les éléments existent avant de les modifier
        const usdtBalanceEl = document.getElementById('usdtBalance');
        const totalEquityEl = document.getElementById('totalEquity');
        const usedCapitalEl = document.getElementById('usedCapital');
        const availableCapitalEl = document.getElementById('availableCapital');
        
        if (usdtBalanceEl) usdtBalanceEl.textContent = balance.USDT.toFixed(2);
        if (totalEquityEl) totalEquityEl.textContent = balance.totalEquity.toFixed(2);
        
        const usedCapital = openPositions.reduce((sum, pos) => sum + pos.size, 0);
        const availableCapital = balance.totalEquity * (config.capitalPercent / 100) * config.leverage - usedCapital;
        
        if (usedCapitalEl) usedCapitalEl.textContent = usedCapital.toFixed(2);
        if (availableCapitalEl) availableCapitalEl.textContent = Math.max(0, availableCapital).toFixed(2);
        
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
    log('🔄 Démarrage de la synchronisation automatique des positions (toutes les 4 secondes)', 'INFO');
    
    // Arrêter l'ancien intervalle s'il existe
    if (window.autoSyncInterval) {
        clearInterval(window.autoSyncInterval);
    }
    
    // 🔧 CORRECTION: Mise à jour immédiate des données temps réel
    if (typeof syncAndCheckPositions === 'function') {
        syncAndCheckPositions();
    }
    if (typeof window.updatePositionsPnL === 'function') {
        window.updatePositionsPnL();
    }
    
    let syncCounter = 0;
    
    // Programmer la synchronisation toutes les 4 secondes
    window.autoSyncInterval = setInterval(async () => {
        if (openPositions.length > 0) {
            syncCounter++;
            
            // Mise à jour des données temps réel (prix/PnL) à chaque fois
            if (typeof window.updatePositionsPnL === 'function') {
                await window.updatePositionsPnL();
            }
            
            // Synchronisation complète (vérification fermetures) toutes les 15 fois (1 minute)
            if (syncCounter % 15 === 0) {
                log('🔄 Synchronisation complète des positions...', 'DEBUG');
                if (typeof syncAndCheckPositions === 'function') {
                    await syncAndCheckPositions();
                }
            }
        }
    }, 4 * 1000); // 4 secondes
}

// 🛑 FONCTION: Arrêter la synchronisation automatique des positions
function stopAutoSyncPositions() {
    if (window.autoSyncInterval) {
        clearInterval(window.autoSyncInterval);
        window.autoSyncInterval = null;
        log('🛑 Synchronisation automatique des positions arrêtée', 'INFO');
        return true;
    }
    return false;
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
        marginMode: "isolated", // 🔧 CORRECTION: Ajouter marginMode requis
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
            
            // Stocker les paires globalement pour le backtesting
            window.allPairs = allPairs;
            
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

// Exposer la fonction globalement pour le backtesting
window.getAllAvailablePairs = getAllAvailablePairs;

async function getKlineData(symbol, limit = 50, timeframe = '15m') {
    try {
        // 🔧 Limiter le nombre de bougies selon les limites de l'API Bitget
        const maxLimit = 1000; // Limite maximale de l'API Bitget
        if (limit > maxLimit) {
            console.warn(`⚠️ Limite ${limit} trop élevée pour ${symbol} ${timeframe}, réduction à ${maxLimit}`);
            limit = maxLimit;
        }
        
        // 🔧 Validation et conversion du timeframe pour l'API Bitget
        const originalTimeframe = timeframe; // Sauvegarder l'original pour les logs
        const timeframeMapping = {
            '1min': '1m',      // 🔧 CORRECTION: 1min → 1m
            // 5min supprimé - Plus utilisé dans la stratégie optimisée  
            '15min': '15m',    // 🔧 CORRECTION: 15min → 15m
            '30min': '30m',    // 🔧 CORRECTION: 30min → 30m
            '1h': '1H',        // API Bitget utilise H majuscule
            '4h': '4H',        // 🔧 CORRECTION: 4h → 4H
            '6h': '6H',        // API Bitget utilise H majuscule
            '12h': '12H',      // API Bitget utilise H majuscule
            '1day': '1D',
            '3day': '3D',
            '1week': '1W',
            '1M': '1M'
        };
        
        if (!timeframeMapping[timeframe]) {
                    console.error(`❌ Timeframe invalide: ${timeframe}. Utilisation de 15m par défaut.`);
        timeframe = '15m';
        } else {
            timeframe = timeframeMapping[timeframe]; // Conversion pour l'API
        }
        
        const url = `${API_BASE}/bitget/api/v2/mix/market/candles?symbol=${symbol}&productType=usdt-futures&granularity=${timeframe}&limit=${limit}`;
        
        // 🔧 DEBUG: Log de l'URL générée pour vérifier le timeframe
        if (originalTimeframe === '4h') {
            console.log(`🔍 DEBUG URL 4H pour ${symbol}:`, url);
            console.log(`🔍 Original timeframe: ${originalTimeframe} → Converted: ${timeframe}`);
        }
        
        const response = await fetch(url);
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
            
            // 🔧 Log de debug spécial pour 4h
            if (originalTimeframe === '4h' && window.klineDebugCount < 3) {
                if (!window.klineDebugCount) window.klineDebugCount = 0;
                window.klineDebugCount++;
                console.log(`🔍 DEBUG KLINES 4H ${symbol}:`);
                console.log(`   URL: ${API_BASE}/bitget/api/v2/mix/market/candles?symbol=${symbol}&productType=usdt-futures&granularity=${timeframe}&limit=${limit}`);
                console.log(`   Réponse API: code=${data.code}, data.length=${data.data?.length || 0}`);
                console.log(`   Klines traitées: ${klines.length}`);
                if (klines.length > 0) {
                    console.log(`   Dernière bougie: open=${klines[klines.length-1].open}, close=${klines[klines.length-1].close}`);
                }
            }
            
            // log(`📊 ${symbol}: ${klines.length} bougies ${timeframe} récupérées`, 'DEBUG'); // Supprimé pour réduire le spam
            return klines;
        } else {
            // 🔧 Log d'erreur détaillé pour le debug
            console.error(`❌ Erreur API klines ${symbol} (${originalTimeframe}→${timeframe}):`, {
                code: data.code,
                msg: data.msg,
                data: data.data,
                url: url
            });
            log(`❌ Erreur récupération klines ${symbol} (${originalTimeframe}→${timeframe}): ${data.msg || 'Erreur API'}`, 'ERROR');
        }
    } catch (error) {
        console.error(`❌ Erreur klines ${symbol} (${originalTimeframe}→${timeframe}):`, error);
        log(`❌ Erreur réseau klines ${symbol} (${originalTimeframe}→${timeframe}): ${error.message}`, 'ERROR');
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

// 🔧 FONCTION DE TEST: Tester manuellement l'API 4H (à appeler depuis la console)
async function testMacd4hAPI() {
    console.log('🧪 Test de l\'API MACD 4H...');
    
    const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    
    for (const symbol of testSymbols) {
        console.log(`\n🔍 Test ${symbol}:`);
        
        // Test récupération klines 4h
        const klines = await getKlineData(symbol, 50, '4h');
        console.log(`   Klines 4h récupérées: ${klines.length}`);
        
        if (klines.length > 0) {
            // Test calcul MACD
            const closePrices = klines.map(k => k.close);
            const macdData = calculateMACD(closePrices);
            
            console.log(`   MACD calculé: ${macdData.macd?.toFixed(6) || 'null'}`);
            console.log(`   Signal: ${macdData.signal?.toFixed(6) || 'null'}`);
            console.log(`   Histogram: ${macdData.histogram?.toFixed(6) || 'null'}`);
            
            // Test analyse complète
            const analysis = await analyzePairMACD(symbol, '4h');
            console.log(`   Signal final: ${analysis.signal}`);
            console.log(`   Raison: ${analysis.reason}`);
        } else {
            console.log(`   ❌ Aucune donnée klines pour ${symbol}`);
        }
        
        // Petit délai entre les tests
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n✅ Test terminé. Vérifiez les résultats ci-dessus.');
}

// 🆕 FONCTION DE DIAGNOSTIC : Analyser une paire spécifique sur tous les timeframes
async function testSpecificPairMacd(symbol) {
    console.log(`🔍 DIAGNOSTIC COMPLET MACD pour ${symbol}:`);
    console.log('=' .repeat(60));
    
    const timeframes = ['4h', '1h', '15m'];
    
    for (const tf of timeframes) {
        console.log(`\n📊 ${tf.toUpperCase()}:`);
        
        try {
            const analysis = await analyzePairMACD(symbol, tf);
            
            console.log(`   Signal: ${analysis.signal}`);
            console.log(`   Raison: ${analysis.reason}`);
            console.log(`   MACD: ${analysis.macd?.toFixed(6) || 'null'}`);
            console.log(`   Signal Line: ${analysis.macdSignal?.toFixed(6) || 'null'}`);
            console.log(`   Histogram: ${analysis.histogram?.toFixed(6) || 'null'}`);
            console.log(`   Crossover: ${analysis.crossover}`);
            
            if (analysis.debugData) {
                console.log(`   Previous Histogram: ${analysis.debugData.previousHistogram?.toFixed(6) || 'null'}`);
                console.log(`   Previous Histogram2: ${analysis.debugData.previousHistogram2?.toFixed(6) || 'null'}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Diagnostic terminé');
}

// Rendre les fonctions accessibles globalement
window.testMacd4hAPI = testMacd4hAPI;
window.testSpecificPairMacd = testSpecificPairMacd; 