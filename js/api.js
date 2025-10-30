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
        
        const responseClone = response.clone();
        let data = null;
        try {
            data = await responseClone.json();
        } catch (parseError) {
            log(`Erreur API: Réponse non JSON (${parseError.message})`, 'ERROR');
        }

        if (!response.ok) {
            const statusInfo = `${response.status} ${response.statusText}`;
            const errorMessage = data?.msg || JSON.stringify(data) || 'No response body';
            log(`Erreur API (${statusInfo}): ${errorMessage}`, 'ERROR');
        }

        return data;
    } catch (error) {
        log(`Erreur API: ${error.message}`, 'ERROR');
        return null;
    }
}

async function testConnection(isAutoRefresh = false) {
    config.apiKey = document.getElementById('apiKey').value.trim();
    config.secretKey = document.getElementById('secretKey').value.trim();
    config.passphrase = document.getElementById('passphrase').value.trim();
    
    if (!config.apiKey || !config.secretKey || !config.passphrase) {
        if (!isAutoRefresh) alert('Veuillez remplir tous les champs API');
        return;
    }
    
    if (!isAutoRefresh) log('🔄 Test de connexion à Bitget Futures...');
    
    const result = await makeRequest('/bitget/api/v2/mix/account/accounts?productType=USDT-FUTURES');
    
    if (result && result.code === '00000') {
        document.getElementById('connectionStatus').classList.add('online');
        // 🛡️ SÉCURITÉ: Vérifier que l'élément existe
        const connectionTextEl = document.getElementById('connectionText');
        if (connectionTextEl) connectionTextEl.textContent = 'Connecté (Futures)';
        if (!isAutoRefresh) log('✅ Connexion réussie à Bitget Futures!', 'SUCCESS');
        await refreshBalance();
        
        // 🚀 AUTOMATISATION pour la nouvelle stratégie MACD multi-timeframes (silencieux en auto-refresh)
        if (!isAutoRefresh) {
            log('🤖 Préparation de la stratégie MACD multi-timeframes...', 'SUCCESS');
            
            // 1. Test de récupération des paires disponibles
            log('🔄 Test de récupération des paires disponibles...', 'INFO');
            const testPairs = await getAllAvailablePairs();
            if (testPairs.length > 0) {
                log(`✅ ${testPairs.length} paires disponibles - Stratégie MACD prête`, 'SUCCESS');
            } else {
                log('⚠️ Aucune paire disponible trouvée', 'WARNING');
            }
        }
        
        // 4. 🔧 NOUVEAU: Importer les positions existantes dès la connexion
        if (!isAutoRefresh) log('📥 Importation des positions existantes...', 'INFO');
        try {
            if (typeof window.importExistingPositions === 'function') {
                await window.importExistingPositions();
                if (!isAutoRefresh) log(`✅ Import terminé: ${openPositions ? openPositions.length : 0} position(s) détectée(s)`, 'SUCCESS');
                
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
        log('🚀 Lancement de la synchronisation automatique des positions...', 'INFO');
        startAutoSyncPositions();
        
        // Vérifier que l'intervalle est bien créé
        setTimeout(() => {
            if (window.autoSyncInterval) {
                log('✅ Synchronisation automatique des positions ACTIVE', 'SUCCESS');
                log('🔄 Les positions se mettront à jour toutes les 4 secondes', 'INFO');
            } else {
                log('❌ Échec du démarrage de la synchronisation automatique', 'ERROR');
            }
        }, 1000);
        
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
        
        // 🔧 CORRECTION: Afficher le total des actifs au lieu du USDT disponible
        if (usdtBalanceEl) usdtBalanceEl.textContent = balance.totalEquity.toFixed(2);
        if (totalEquityEl) totalEquityEl.textContent = balance.totalEquity.toFixed(2);
        
        // 📊 NOUVEAU: Mettre à jour le solde pour le balance tracker
        if (typeof currentBalance !== 'undefined') {
            currentBalance = balance.totalEquity;
        }
        if (typeof window.currentBalance !== 'undefined') {
            window.currentBalance = balance.totalEquity;
        }
        
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
    if (typeof window.syncAndCheckPositions === 'function') {
        window.syncAndCheckPositions();
    }
    if (typeof window.updatePositionsPnL === 'function') {
        window.updatePositionsPnL(true); // Mode verbose pour le debug initial
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
                if (typeof window.syncAndCheckPositions === 'function') {
                    await window.syncAndCheckPositions();
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

// 🔍 FONCTION DE DIAGNOSTIC: Vérifier l'état de la synchronisation automatique
window.checkAutoSyncStatus = function() {
    console.log('🔍 DIAGNOSTIC - État de la synchronisation automatique:');
    
    if (window.autoSyncInterval) {
        console.log('✅ Intervalle de synchronisation: ACTIF');
        console.log('⏰ Fréquence: Toutes les 4 secondes');
        console.log('🎯 Fonction updatePositionsPnL:', typeof window.updatePositionsPnL);
        console.log('🎯 Fonction syncAndCheckPositions:', typeof window.syncAndCheckPositions);
        console.log(`📊 Positions à synchroniser: ${openPositions?.length || 0}`);
        
        if (openPositions?.length > 0) {
            console.log('📈 Prochaine mise à jour dans maximum 4 secondes...');
            // Test de mise à jour immédiate
            if (typeof window.updatePositionsPnL === 'function') {
                console.log('🔄 Test de mise à jour immédiate...');
                window.updatePositionsPnL(true).then(() => {
                    console.log('✅ Test de mise à jour terminé - vérifiez si l\'affichage a changé');
                }).catch(err => {
                    console.error('❌ Erreur lors du test:', err);
                });
            }
        } else {
            console.log('ℹ️ Aucune position à synchroniser');
        }
    } else {
        console.log('❌ Intervalle de synchronisation: INACTIF');
        console.log('💡 Solution: Cliquez sur "Connecter" pour le relancer');
    }
};

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
                    const hasVolume = volume > 1000000;
                    const isUSDT = pair.symbol.endsWith('USDT');
                    // 🚫 EXCLUSION: Actions tokenisées (stocks)
                    const isNotExcluded = !config.excludedSymbols || !config.excludedSymbols.includes(pair.symbol);
                    return hasVolume && isUSDT && isNotExcluded; // Volume minimum 1M + pas d'actions
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

// 🆕 FONCTION: Récupérer l'historique des fills avec PnL réel et frais
async function getOrderFills(symbol, orderId) {
    try {
        const params = new URLSearchParams({
            symbol: symbol,
            productType: 'USDT-FUTURES'
        });
        
        if (orderId) {
            params.append('orderId', orderId);
        }
        
        const result = await makeRequest(`/bitget/api/v2/mix/order/fills?${params.toString()}`);
        
        if (result && result.code === '00000' && result.data) {
            return result.data;
        }
        
        return [];
    } catch (error) {
        console.error(`❌ Erreur récupération fills ${symbol}:`, error);
        return [];
    }
}

async function getCurrentPrice(symbol) {
    try {
        // 🔧 CORRECTION: Utiliser la même URL que pour les autres appels API
        const response = await fetch(`${API_BASE}/bitget/api/v2/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`);
        const data = await response.json();
        
        // 🔧 DEBUG: Log pour diagnostiquer les problèmes
        if (data.code !== '00000') {
            console.log(`⚠️ Prix ${symbol} - Code erreur: ${data.code}, Message: ${data.msg}`);
        }
        
        if (data.code === '00000' && data.data) {
            // 🔧 CORRECTION: L'API retourne un Array, pas un objet
            let tickerData = data.data;
            
            // Si c'est un array, prendre le premier élément
            if (Array.isArray(tickerData) && tickerData.length > 0) {
                tickerData = tickerData[0];
                console.log(`🔍 Données ticker ${symbol}:`, tickerData);
            } else if (!Array.isArray(tickerData)) {
                console.log(`🔍 Données ticker ${symbol} (objet direct):`, tickerData);
            } else {
                console.log(`❌ Array vide pour ${symbol}:`, data.data);
                return null;
            }
            
            // Tenter plusieurs champs possibles pour le prix
            let price = null;
            const priceFields = ['lastPr', 'last', 'close', 'price', 'closePrice', 'lastPrice'];
            
            for (const field of priceFields) {
                if (tickerData[field] && !isNaN(parseFloat(tickerData[field]))) {
                    price = parseFloat(tickerData[field]);
                    console.log(`✅ Prix trouvé dans le champ '${field}': ${price}`);
                    break;
                }
            }
            
            if (price && price > 0) {
                console.log(`✅ Prix ${symbol} trouvé: ${price}`);
                return price;
            } else {
                console.log(`⚠️ Prix ${symbol} invalide dans:`, tickerData);
                console.log(`   lastPr: ${tickerData.lastPr}`);
                console.log(`   last: ${tickerData.last}`);
                console.log(`   close: ${tickerData.close}`);
                console.log(`   price: ${tickerData.price}`);
            }
        }
        return null;
    } catch (error) {
        console.error(`❌ Erreur prix ${symbol}:`, error);
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

// 🔧 FONCTION DE TEST: Vérifier les paramètres d'ordre et API
window.testOrderParameters = async function() {
    console.log('🔍 DIAGNOSTIC: Vérification paramètres d\'ordre...');
    console.log('='.repeat(50));
    
    try {
        // 1. Vérifier la connexion API
        console.log('1️⃣ Test connexion API...');
        const accountTest = await makeRequest('/bitget/api/v2/mix/account/accounts?productType=USDT-FUTURES');
        
        if (accountTest && accountTest.code === '00000') {
            console.log('✅ API connectée');
            console.log(`   Balance: ${accountTest.data?.[0]?.available || 'N/A'} USDT`);
        } else {
            console.log('❌ Problème connexion API');
            console.log('   Code:', accountTest?.code);
            console.log('   Message:', accountTest?.msg);
            return;
        }
        
        // 2. Tester les symboles disponibles
        console.log('\n2️⃣ Test symboles disponibles...');
        const symbolsTest = await makeRequest('/bitget/api/v2/mix/market/contracts?productType=USDT-FUTURES');
        
        if (symbolsTest && symbolsTest.code === '00000') {
            const totalSymbols = symbolsTest.data?.length || 0;
            console.log(`✅ ${totalSymbols} symboles disponibles`);
            
            // Vérifier quelques symboles populaires
            const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
            testSymbols.forEach(symbol => {
                const found = symbolsTest.data?.find(s => s.symbol === symbol);
                console.log(`   ${symbol}: ${found ? '✅' : '❌'}`);
            });
        } else {
            console.log('❌ Impossible de récupérer les symboles');
        }
        
        // 3. Tester la structure d'un ordre type
        console.log('\n3️⃣ Structure ordre recommandée...');
        
        const sampleOrder = {
            symbol: 'BTCUSDT',
            productType: 'USDT-FUTURES',
            marginMode: 'isolated',
            marginCoin: 'USDT',
            size: '0.001000',  // String avec 6 décimales
            side: 'buy',
            tradeSide: 'open',
            orderType: 'market',
            clientOid: `test_${Date.now()}`
        };
        
        console.log('📋 Exemple ordre valide:');
        console.log(JSON.stringify(sampleOrder, null, 2));
        
        // 4. Points de vérification critiques
        console.log('\n4️⃣ Points critiques à vérifier:');
        console.log('   • size: Doit être string avec format décimal');
        console.log('   • symbol: Doit exister sur Bitget');
        console.log('   • marginMode: isolated ou cross');
        console.log('   • productType: USDT-FUTURES (majuscules)');
        console.log('   • clientOid: Unique pour chaque ordre');
        
        console.log('\n✅ Diagnostic terminé');
        
    } catch (error) {
        console.error('❌ Erreur diagnostic:', error);
    }
};

// 🔧 FONCTION DE TEST: Tester getCurrentPrice avec diagnostic
window.testGetCurrentPrice = async function(symbol = 'BTCUSDT') {
    console.log(`🧪 Test de getCurrentPrice pour ${symbol}...`);
    
    try {
        const price = await getCurrentPrice(symbol);
        if (price) {
            console.log(`✅ Prix récupéré: ${symbol} = ${price}`);
            console.log(`🎯 getCurrentPrice() fonctionne maintenant !`);
            return price;
        } else {
            console.log(`❌ Échec récupération prix ${symbol}`);
            
            // Test manuel de l'URL pour debug
            console.log('🔍 Test manuel de l\'URL...');
            const testUrl = `${API_BASE}/bitget/api/v2/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`;
            console.log(`URL: ${testUrl}`);
            
            const response = await fetch(testUrl);
            const data = await response.json();
            console.log('Réponse API complète:', data);
            
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                console.log('Premier élément du tableau:', data.data[0]);
                console.log('Clés disponibles:', Object.keys(data.data[0]));
                
                // Tester tous les champs possibles
                const ticker = data.data[0];
                console.log('Tests de champs prix:');
                console.log(`  lastPr: ${ticker.lastPr} (${typeof ticker.lastPr})`);
                console.log(`  last: ${ticker.last} (${typeof ticker.last})`);
                console.log(`  close: ${ticker.close} (${typeof ticker.close})`);
                console.log(`  price: ${ticker.price} (${typeof ticker.price})`);
                console.log(`  closePrice: ${ticker.closePrice} (${typeof ticker.closePrice})`);
                console.log(`  lastPrice: ${ticker.lastPrice} (${typeof ticker.lastPrice})`);
            } else {
                console.log('Structure data inattendue:', data.data);
            }
            
            return null;
        }
    } catch (error) {
        console.error('❌ Erreur test getCurrentPrice:', error);
        return null;
    }
};

// 🧪 FONCTION DE TEST: Tester getOrderFills
window.testGetOrderFills = async function(symbol = null) {
    console.log('🧪 Test de getOrderFills - Récupération historique avec frais réels...');
    
    try {
        const fills = await getOrderFills(symbol || 'BTCUSDT', null);
        
        if (fills && fills.length > 0) {
            console.log(`✅ ${fills.length} fills récupérés`);
            console.log('\n📊 Exemple de fill (dernier):');
            const lastFill = fills[0];
            console.log('Détails complets:', lastFill);
            console.log('\n🔑 Champs disponibles:');
            console.log(`  orderId: ${lastFill.orderId}`);
            console.log(`  symbol: ${lastFill.symbol}`);
            console.log(`  side: ${lastFill.side}`);
            console.log(`  fillPrice: ${lastFill.fillPrice}`);
            console.log(`  baseVolume: ${lastFill.baseVolume}`);
            console.log(`  quoteVolume: ${lastFill.quoteVolume || lastFill.fillTotalAmount}`);
            console.log(`  fee: ${lastFill.fee} ${lastFill.feeCcy}`);
            console.log(`  profit: ${lastFill.profit || 'N/A'}`);
            console.log(`  cTime: ${new Date(parseInt(lastFill.cTime)).toLocaleString()}`);
            
            return fills;
        } else {
            console.log('⚠️ Aucun fill trouvé');
            console.log('💡 Astuce: Fermez une position manuellement et réessayez');
            return [];
        }
    } catch (error) {
        console.error('❌ Erreur test getOrderFills:', error);
        return null;
    }
};

// Rendre les fonctions accessibles globalement
window.testMacd4hAPI = testMacd4hAPI;
window.testSpecificPairMacd = testSpecificPairMacd;
window.getCurrentPrice = getCurrentPrice; // 🔧 AJOUT: Export pour la surveillance PnL
window.getOrderFills = getOrderFills; // 🆕 AJOUT: Export pour récupérer les fills avec frais réels 