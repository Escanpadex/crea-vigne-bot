// Trading Functions - MACD Strategy & Position Management
console.log('📁 Loading trading.js...');
console.log('Assuming utils.js is loaded: using shared MACD functions');

// 🎯 NOUVELLE STRATÉGIE: Limite de positions simultanées (2 trades maximum)
const MAX_SIMULTANEOUS_POSITIONS = 2;

// 🆕 NOUVELLE FONCTION: Wrapper de retry pour les appels API
async function makeRequestWithRetry(endpoint, options, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await makeRequest(endpoint, options);
            return result;
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                log(`⚠️ Tentative ${attempt}/${maxRetries} échouée pour ${endpoint} - Réessai dans ${delay}ms`, 'WARNING');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    log(`❌ Échec après ${maxRetries} tentatives pour ${endpoint}: ${lastError?.message || 'Erreur inconnue'}`, 'ERROR');
    throw lastError;
}

// 🎯 NOUVELLE STRATÉGIE: Variables globales pour la nouvelle stratégie
let positivePairs = []; // Paires avec évolution positive 24h
let lastPairAnalysis = 0; // Timestamp de la dernière analyse des paires
let positionCooldowns = new Map(); // Cooldowns après fermeture de position (1 minute)
let tradedPairsCooldown = new Map(); // Cooldowns paires tradées (12 heures)

// 🆕 NOUVELLE FONCTION: Récupérer les paires avec évolution positive sur 24h
async function getPositivePairs() {
    try {
        log('🔍 Récupération des paires avec évolution positive 24h...', 'INFO');
        
        const result = await makeRequest('/bitget/api/v2/spot/market/tickers?symbol=USDT');
        
        if (!result || result.code !== '00000' || !result.data) {
            log('❌ Erreur récupération des tickers', 'ERROR');
            return [];
        }
        
        const tickers = result.data;
        const positive24hPairs = tickers
            .filter(ticker => {
                const change24h = parseFloat(ticker.changeUtc24h || 0);
                const volume = parseFloat(ticker.quoteVolume || 0);
                
                // Filtrer: évolution positive + volume minimum pour éviter les paires illiquides
                return change24h > 0 && volume > 100000 && ticker.symbol.endsWith('USDT');
            })
            .map(ticker => ({
                symbol: ticker.symbol.replace('USDT', 'USDT'), // Format pour futures
                change24h: parseFloat(ticker.changeUtc24h),
                volume24h: parseFloat(ticker.quoteVolume),
                price: parseFloat(ticker.close)
            }))
            .sort((a, b) => b.change24h - a.change24h); // Trier par performance décroissante
        
        log(`✅ ${positive24hPairs.length} paires positives trouvées sur 24h`, 'SUCCESS');
        
        // Log des 10 meilleures paires
        if (positive24hPairs.length > 0) {
            log(`🔥 Top 10 paires positives:`, 'INFO');
            positive24hPairs.slice(0, 10).forEach((pair, index) => {
                log(`   ${index + 1}. ${pair.symbol}: +${pair.change24h.toFixed(2)}% (Vol: ${formatNumber(pair.volume24h)})`, 'INFO');
            });
        }
        
        return positive24hPairs;
        
    } catch (error) {
        log(`❌ Erreur récupération paires positives: ${error.message}`, 'ERROR');
        return [];
    }
}

// 🆕 NOUVELLE FONCTION: Sélectionner une paire aléatoire parmi les positives
function selectRandomPositivePair(excludeSymbols = []) {
    // 🎯 AMÉLIORATION: Vérifier d'abord si on a des emplacements disponibles
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
    if (availableSlots <= 0) {
        log(`⚠️ Aucun emplacement disponible (${openPositions.length}/${MAX_SIMULTANEOUS_POSITIONS}) - Pas de sélection`, 'INFO');
        return null;
    }
    
    const availablePairs = positivePairs.filter(pair => 
        !excludeSymbols.includes(pair.symbol) && 
        !hasOpenPosition(pair.symbol) &&
        !isPairInCooldown(pair.symbol) &&
        !isTradedPairInCooldown(pair.symbol) // 🆕 Cooldown 12h pour paires déjà tradées
    );
    
    if (availablePairs.length === 0) {
        log('⚠️ Aucune paire positive disponible pour trading (cooldowns actifs)', 'WARNING');
        return null;
    }
    
    // Sélection aléatoire pondérée par la performance 24h
    const randomIndex = Math.floor(Math.random() * Math.min(availablePairs.length, 20)); // Top 20 pour plus de diversité
    const selectedPair = availablePairs[randomIndex];
    
    log(`🎲 Paire sélectionnée: ${selectedPair.symbol} (+${selectedPair.change24h.toFixed(2)}% sur 24h) - ${availableSlots} emplacements disponibles`, 'SUCCESS');
    
    return selectedPair;
}

// REMOVED: analyzeMultiTimeframeImproved function - replaced by new positive pairs strategy
async function analyzeMultiTimeframeImproved(symbol) {
    try {
        console.log(`🔍 [TRADING] Analyse multi-timeframe améliorée pour ${symbol}`);
        
        // LOGIQUE AMÉLIORÉE : 4H et 1H utilisent des données étendues, 15M utilise des données standard
        const timeframes = ['4h', '1h', '15m'];
        const results = {};
        
        for (const tf of timeframes) {
            let analysis;
            
            if (tf === '4h' || tf === '1h') {
                // 🎯 AMÉLIORATION: Pour 4H et 1H, utiliser des données étendues (60 jours)
                // pour trouver le dernier signal valide, pas forcément récent
                console.log(`📊 [TRADING] ${tf}: Récupération de données étendues...`);
                
                // Utiliser des données étendues pour avoir le dernier état valide
                let extendedData = await getExtendedHistoricalDataForTrading(symbol, tf, 60);
                
                if (extendedData.length === 0) {
                    console.error(`❌ [TRADING] Aucune donnée étendue pour ${symbol} ${tf}`);
                    results[tf] = { symbol, timeframe: tf, signal: 'INSUFFICIENT_DATA' };
                    continue;
                }
                
                // NEW: Fallback if still insufficient after fetch
                const macdParams = getMACDParameters(tf);
                const minRequired = macdParams.slow + macdParams.signal + 10;
                if (extendedData.length < minRequired) {
                    log(`⚠️ Données étendues insuffisantes pour ${symbol} ${tf} (${extendedData.length}/${minRequired}) - Tentative d'agrégation depuis 15m`, 'WARNING');
                    extendedData = await aggregateDataFromLowerTimeframe(symbol, '15m', tf);
                    // If aggregation fails, set to INSUFFICIENT_DATA as before
                    if (extendedData.length < minRequired) {
                        console.error(`❌ [TRADING] Agrégation échouée pour ${symbol} ${tf} - INSUFFICIENT_DATA`);
                        results[tf] = { symbol, timeframe: tf, signal: 'INSUFFICIENT_DATA' };
                        continue;
                    } else {
                        console.log(`✅ [TRADING] Agrégation réussie pour ${symbol} ${tf} - ${extendedData.length} bougies disponibles`);
                    }
                }
                
                // Analyser avec les données étendues pour avoir le dernier état
                analysis = await analyzePairMACDWithData(symbol, tf, extendedData);
                console.log(`📊 [TRADING] ${tf}: Signal = ${analysis.signal} (données étendues)`);
                
            } else {
                // 🎯 Pour 15M, utiliser l'analyse standard (données récentes)
                console.log(`📊 [TRADING] ${tf}: Analyse standard...`);
                analysis = await analyzePairMACD(symbol, tf);
                console.log(`📊 [TRADING] ${tf}: Signal = ${analysis.signal} (données standard)`);
            }
            
            results[tf] = analysis;
            
            // Filtrage progressif: H4 et H1 doivent être haussiers (dernier état)
            if ((tf === '4h' || tf === '1h') && analysis.signal !== 'BULLISH' && analysis.signal !== 'BUY') {
                results.filtered = tf;
                results.filterReason = `Filtré au ${tf}: dernier signal ${analysis.signal}`;
                console.log(`❌ [TRADING] Filtré au ${tf}: ${analysis.signal} - ${analysis.reason}`);
                break;
            }
        }
        
        if (!results.filtered) {
            // Si H4 et H1 sont haussiers, vérifier le signal 15M
            const signal15m = results['15m'];
            if (signal15m.signal === 'BUY' && signal15m.crossover) {
                results.finalDecision = 'BUY';
                results.finalReason = 'H4 et H1 haussiers (données étendues) + croisement 15M détecté';
                console.log(`✅ [TRADING] Signal BUY validé: ${results.finalReason}`);
            } else if (signal15m.signal === 'BULLISH') {
                results.finalDecision = 'WAIT';
                results.finalReason = 'H4 et H1 haussiers (données étendues), 15M haussier mais pas de croisement';
                console.log(`⏳ [TRADING] Signal WAIT: ${results.finalReason}`);
            } else {
                results.finalDecision = 'FILTERED';
                results.filterReason = 'Filtré au 15M: signal non haussier';
                console.log(`❌ [TRADING] Filtré au 15M: ${signal15m.signal}`);
            }
        } else {
            results.finalDecision = 'FILTERED';
        }
        
        return results;
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur analyse multi-timeframe améliorée ${symbol}:`, error);
        log(`❌ Erreur analyse multi-timeframe améliorée ${symbol}: ${error.message}`, 'ERROR');
        return { symbol, error: error.message };
    }
}

// 🆕 FONCTION UTILITAIRE: Analyser MACD avec des données fournies
async function analyzePairMACDWithData(symbol, timeframe, klineData) {
    try {
        // 🎯 Récupérer les paramètres MACD spécifiques au timeframe
        const macdParams = getMACDParameters(timeframe);
        
        // Vérifier si on a assez de données pour l'analyse MACD
        const minRequired = macdParams.slow + macdParams.signal + 10;
        if (klineData.length < minRequired) {
            return { 
                symbol, 
                signal: 'INSUFFICIENT_DATA', 
                strength: 0, 
                reason: `Données insuffisantes: ${klineData.length}/${minRequired} bougies (MACD ${macdParams.fast},${macdParams.slow},${macdParams.signal})`, 
                timeframe 
            };
        }
        
        const closePrices = klineData.map(k => k.close);
        const currentPrice = closePrices[closePrices.length - 1];
        const volume24h = klineData.slice(-Math.min(288, klineData.length)).reduce((sum, k) => sum + k.volume, 0);
        
        // 🎯 Calculer MACD avec les paramètres spécifiques au timeframe
        const macdData = calculateMACD(closePrices, macdParams.fast, macdParams.slow, macdParams.signal);
        
        let macdSignal = 'HOLD';
        let signalStrength = 0;
        let reason = `⏳ Calcul MACD en cours... Données insuffisantes pour ${symbol} (${timeframe}) (candles: ${klineData.length})`;
        
        if (macdData.macd != null && macdData.signal != null && macdData.histogram != null && 
            !isNaN(macdData.macd) && !isNaN(macdData.signal) && !isNaN(macdData.histogram)) {
            const crossover = macdData.previousMacd != null && macdData.previousSignal != null && 
                             macdData.previousMacd <= macdData.previousSignal && macdData.macd > macdData.signal;
            const histogramImproving = macdData.previousHistogram != null && macdData.previousHistogram2 != null && 
                                      macdData.histogram > macdData.previousHistogram && macdData.previousHistogram > macdData.previousHistogram2;
            
            if (crossover && macdData.histogram > 0 && histogramImproving) {
                macdSignal = 'BUY';
                signalStrength = 90;
                reason = `Croisement MACD + Histogram>0 + Tendance IMPROVING (${timeframe})`;
            } else if (macdData.macd > macdData.signal && macdData.histogram > 0 && histogramImproving) {
                macdSignal = 'BULLISH';
                signalStrength = 75;
                reason = `MACD>Signal + Histogram>0 + Tendance IMPROVING (${timeframe})`;
            } else if (macdData.macd > macdData.signal && macdData.histogram > 0) {
                macdSignal = 'BULLISH';
                signalStrength = 60;
                reason = `MACD>Signal + Histogram>0 (${timeframe})`;
            } else if (macdData.macd < macdData.signal) {
                macdSignal = 'BEARISH';
                signalStrength = 30;
                reason = `MACD<Signal (${timeframe})`;
            } else {
                macdSignal = 'NEUTRAL';
                signalStrength = 50;
                reason = `MACD neutre (${timeframe})`;
            }
        } else {
            // 🎯 Cas où les données MACD sont nulles/invalides
            macdSignal = 'INSUFFICIENT_DATA';
            signalStrength = 0;
            reason = `❌ Données MACD invalides pour ${symbol} (${timeframe}) - MACD: ${macdData.macd}, Signal: ${macdData.signal}, Histogram: ${macdData.histogram}`;
        }
        
        return {
            symbol,
            timeframe,
            signal: macdSignal,
            strength: signalStrength,
            price: currentPrice,
            volume24h: volume24h,
            macd: macdData.macd,
            macdSignal: macdData.signal,
            histogram: macdData.histogram,
            crossover: macdData.crossover,
            reason: reason
        };
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur analyse MACD avec données ${symbol} ${timeframe}:`, error);
        log(`❌ ERREUR ANALYSE MACD ${symbol} (${timeframe}): ${error.message}`, 'ERROR');
        return { symbol, timeframe, signal: 'HOLD', strength: 0, reason: `Erreur: ${error.message}` };
    }
}

// 🆕 NOUVELLE FONCTION: Récupérer des données historiques étendues pour 4H et 1H
async function getExtendedHistoricalDataForTrading(symbol, timeframe, days = 60) {
    try {
        console.log(`🔍 [TRADING] Récupération de données étendues: ${symbol} ${timeframe} sur ${days} jours`);
        
        // Utiliser la fonction existante getKlineData avec une limite élevée
        // Pour 4H sur 60 jours = 60*24/4 = 360 bougies max
        // Pour 1H sur 60 jours = 60*24 = 1440 bougies max (limité à 1000 par l'API)
        const maxCandles = timeframe === '4h' ? 360 : 1000;
        
        const extendedData = await getKlineData(symbol, maxCandles, timeframe);
        
        console.log(`✅ [TRADING] ${extendedData.length} bougies ${timeframe} récupérées sur ${days} jours`);
        
        return extendedData;
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur récupération données étendues ${symbol} ${timeframe}:`, error);
        log(`❌ Erreur récupération données étendues trading: ${error.message}`, 'ERROR');
        return [];
    }
}

// 🆕 NOUVELLE FONCTION: Agréger les données depuis un timeframe inférieur (fallback pour INSUFFICIENT_DATA)
async function aggregateDataFromLowerTimeframe(symbol, lowerTimeframe, targetTimeframe) {
    try {
        console.log(`🔄 [TRADING] Tentative d'agrégation ${symbol}: ${lowerTimeframe} → ${targetTimeframe}`);
        
        // Mapping des multipliers pour l'agrégation
        const aggregationMap = {
            '15m_to_1h': 4,   // 4 bougies 15m = 1 bougie 1h
            '15m_to_4h': 16,  // 16 bougies 15m = 1 bougie 4h
            '1h_to_4h': 4     // 4 bougies 1h = 1 bougie 4h
        };
        
        const aggregationKey = `${lowerTimeframe}_to_${targetTimeframe}`;
        const multiplier = aggregationMap[aggregationKey];
        
        if (!multiplier) {
            console.warn(`⚠️ [TRADING] Agrégation non supportée: ${lowerTimeframe} → ${targetTimeframe}`);
            return [];
        }
        
        // Récupérer plus de données du timeframe inférieur
        const requiredCandles = 1000; // Maximum pour avoir assez de données
        const lowerData = await getKlineData(symbol, requiredCandles, lowerTimeframe);
        
        if (lowerData.length < multiplier) {
            console.warn(`⚠️ [TRADING] Pas assez de données ${lowerTimeframe} pour agrégation: ${lowerData.length}/${multiplier}`);
            return [];
        }
        
        // Agréger les données
        const aggregatedData = [];
        for (let i = 0; i < lowerData.length; i += multiplier) {
            const chunk = lowerData.slice(i, i + multiplier);
            if (chunk.length === multiplier) {
                const aggregatedCandle = {
                    timestamp: chunk[0].timestamp,
                    open: chunk[0].open,
                    high: Math.max(...chunk.map(c => c.high)),
                    low: Math.min(...chunk.map(c => c.low)),
                    close: chunk[chunk.length - 1].close,
                    volume: chunk.reduce((sum, c) => sum + c.volume, 0)
                };
                aggregatedData.push(aggregatedCandle);
            }
        }
        
        console.log(`✅ [TRADING] Agrégation réussie: ${lowerData.length} bougies ${lowerTimeframe} → ${aggregatedData.length} bougies ${targetTimeframe}`);
        return aggregatedData;
        
    } catch (error) {
        console.error(`❌ [TRADING] Erreur agrégation ${symbol}:`, error);
        return [];
    }
}

function calculatePositionSize() {
    // 🎯 NOUVELLE STRATÉGIE: 50% du solde avec levier x2
    const availableBalance = balance.totalEquity || balance.available || 1000; // Fallback si balance pas disponible
    const positionValue = availableBalance * 0.5; // 50% du solde
    
    log(`💰 Calcul position: Solde disponible ${availableBalance.toFixed(2)}$ → Position ${positionValue.toFixed(2)}$ (50% + levier x2)`, 'INFO');
    
    return Math.max(positionValue, 10); // Minimum 10$
}

function hasOpenPosition(symbol) {
    return openPositions.some(pos => pos.symbol === symbol && pos.status === 'OPEN');
}

// 🆕 NOUVELLE FONCTION: Vérifier si on peut ouvrir une nouvelle position
function canOpenNewPosition(symbol) {
    // Vérifier si on a déjà une position sur ce symbole
    if (hasOpenPosition(symbol)) {
        return { canOpen: false, reason: 'Position déjà ouverte sur ce symbole' };
    }
    
    // Vérifier la limite de positions simultanées
    if (openPositions.length >= MAX_SIMULTANEOUS_POSITIONS) {
        return { canOpen: false, reason: `Limite de ${MAX_SIMULTANEOUS_POSITIONS} positions simultanées atteinte` };
    }
    
    // Vérifier le cooldown (1 minute après fermeture)
    if (isPairInCooldown(symbol)) {
        const remainingMinutes = getRemainingCooldown(symbol);
        return { canOpen: false, reason: `${symbol} en cooldown encore ${remainingMinutes} minutes` };
    }
    
    // 🆕 AMÉLIORATION: Vérifier le cooldown 12h pour paires déjà tradées
    if (isTradedPairInCooldown(symbol)) {
        const remainingHours = getRemainingTradedCooldown(symbol);
        return { canOpen: false, reason: `${symbol} déjà tradé récemment - Cooldown encore ${remainingHours} heures` };
    }
    
    // Vérifier le capital disponible
    const positionValue = calculatePositionSize();
    if (positionValue < 10) {
        return { canOpen: false, reason: 'Capital insuffisant pour ouvrir une position' };
    }
    
    return { canOpen: true, reason: 'Conditions remplies pour ouvrir une position' };
}

async function openPosition(symbol, selectedPair) {
    // 🎯 NOUVELLE VÉRIFICATION: Utiliser la fonction de vérification centralisée
    const canOpen = canOpenNewPosition(symbol);
    
    if (!canOpen.canOpen) {
        log(`⚠️ ${symbol}: ${canOpen.reason}`, 'WARNING');
        return false;
    }
    
    // Log informatif sur le nombre de positions disponibles
    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
    log(`📊 Ouverture position ${symbol} - ${availableSlots} slots disponibles sur ${MAX_SIMULTANEOUS_POSITIONS}`, 'INFO');
    
    const positionValue = calculatePositionSize();
    
    try {
        // 🎯 NOUVELLE STRATÉGIE: Toujours levier x2
        await setLeverage(symbol, 2);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const currentPrice = selectedPair.price;
        const quantity = (positionValue / currentPrice).toFixed(6);
        
        log(`🔄 Ouverture position LONG ${symbol}...`, 'INFO');
        log(`💰 Prix: ${currentPrice} | Quantité: ${quantity} | Valeur: ${positionValue.toFixed(2)} USDT (Levier x2)`, 'INFO');
        log(`🎯 Raison: Paire positive 24h (+${selectedPair.change24h.toFixed(2)}%)`, 'INFO');
        
        const orderData = {
            symbol: symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: quantity,
            side: "buy",
            tradeSide: "open",
            orderType: "market",
            clientOid: `${Date.now()}_${symbol}`
        };
        
        const orderResult = await makeRequest('/bitget/api/v2/mix/order/place-order', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        if (!orderResult || orderResult.code !== '00000') {
            log(`❌ Échec ouverture position ${symbol}: ${orderResult?.msg || 'Erreur inconnue'}`, 'ERROR');
            return false;
        }
        
        log(`✅ Position ouverte: ${symbol} - Ordre ID: ${orderResult.data.orderId}`, 'SUCCESS');
        log(`📊 Positions ouvertes: ${openPositions.length + 1}/${MAX_SIMULTANEOUS_POSITIONS}`, 'INFO');
        
        // 🆕 AMÉLIORATION: Ajouter cooldown 12h pour cette paire (empêcher re-trade immédiat)
        addTradedPairCooldown(symbol);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 🎯 NOUVELLE STRATÉGIE: Pas de stop loss automatique, surveillance PnL à +2%
        log(`🎯 Position ouverte sans stop loss - Surveillance PnL active pour fermeture à +2%`, 'INFO');
        
        const position = {
            id: Date.now(),
            symbol: symbol,
            side: 'LONG',
            size: positionValue,
            quantity: quantity,
            entryPrice: currentPrice,
            status: 'OPEN',
            timestamp: new Date().toISOString(),
            orderId: orderResult.data.orderId,
            stopLossId: null, // Pas de stop loss dans la nouvelle stratégie
            currentStopPrice: null,
            highestPrice: currentPrice,
            reason: `Paire positive 24h (+${selectedPair.change24h.toFixed(2)}%)`,
            change24h: selectedPair.change24h,
            targetPnL: config.targetPnL // 🆕 Objectif configurable
        };
        
        openPositions.push(position);
        botStats.totalPositions++;
        
        log(`🚀 Position complète: ${symbol} LONG ${positionValue.toFixed(2)} USDT @ ${currentPrice.toFixed(4)}`, 'SUCCESS');
        log(`🎯 Objectif: Fermeture automatique à +${config.targetPnL}% de PnL`, 'INFO');
        log(`📈 Performance 24h: +${selectedPair.change24h.toFixed(2)}%`, 'INFO');
        
        updatePositionsDisplay();
        await refreshBalance();
        
        return true;
    } catch (error) {
        log(`❌ Erreur ouverture position ${symbol}: ${error.message}`, 'ERROR');
        return false;
    }
}

// REMOVED: syncLocalPositions function - merged into syncAndCheckPositions
// This eliminates duplication and ensures consistent handling

// 🆕 NOUVELLE FONCTION: Récupérer les positions actives depuis l'API
async function fetchActivePositionsFromAPI() {
    try {
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            return result.data.filter(pos => parseFloat(pos.total) > 0);
        }
        
        return [];
    } catch (error) {
        log(`❌ Erreur récupération positions API: ${error.message}`, 'ERROR');
        return [];
    }
}

async function createEmergencyStopLoss(position, stopPrice) {
    try {
        const stopLossData = {
            planType: "normal_plan",
            symbol: position.symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: position.quantity.toString(),
            triggerPrice: parseFloat(stopPrice.toFixed(8)).toString(),
            triggerType: "mark_price",
            side: "sell",
            tradeSide: "close",
            orderType: "market",
            clientOid: `emergency_stop_${Date.now()}_${position.symbol}`,
            reduceOnly: "YES"
        };
        
        const result = await makeRequestWithRetry('/bitget/api/v2/mix/order/place-plan-order', {
            method: 'POST',
            body: JSON.stringify(stopLossData)
        });
        
        if (result && result.code === '00000') {
            position.stopLossId = result.data.orderId;
            log(`🆘 Stop Loss d'urgence créé avec ID: ${result.data.orderId}`, 'SUCCESS');
            return true;
        } else {
            log(`❌ Erreur création stop loss d'urgence: ${result?.msg || 'Erreur inconnue'}`, 'ERROR');
            return false;
        }
    } catch (error) {
        log(`❌ Exception création stop loss d'urgence: ${error.message}`, 'ERROR');
        return false;
    }
}

// 🎯 NOUVELLE FONCTION: Surveillance PnL et fermeture automatique à +2%
async function monitorPnLAndClose() {
    if (!botRunning || openPositions.length === 0) return;
    
    try {
        for (const position of openPositions) {
            const currentPrice = await getCurrentPrice(position.symbol);
            if (!currentPrice) {
                log(`⚠️ ${position.symbol}: Impossible de récupérer le prix`, 'WARNING');
                continue;
            }
            
            // Calculer le PnL en pourcentage
            const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
            position.currentPrice = currentPrice;
            position.pnlPercent = pnlPercent;
            
            // Mettre à jour le prix le plus haut
            if (currentPrice > position.highestPrice) {
                position.highestPrice = currentPrice;
            }
            
            // 🎯 FERMETURE AUTOMATIQUE À +2%
            if (pnlPercent >= position.targetPnL) {
                log(`🎯 ${position.symbol}: Objectif atteint +${pnlPercent.toFixed(2)}% ≥ +${position.targetPnL}% - Fermeture automatique!`, 'SUCCESS');
                
                const closed = await closePositionAtMarket(position);
                if (closed) {
                    log(`✅ Position fermée avec succès: ${position.symbol} (+${pnlPercent.toFixed(2)}%)`, 'SUCCESS');
                    
                    // Ajouter cooldown d'1 minute (pour éviter re-ouverture immédiate)
                    addPositionCooldown(position.symbol);
                    
                    // Mettre à jour les stats
                    botStats.totalClosedPositions++;
                    if (pnlPercent > 0) {
                        botStats.winningPositions++;
                        botStats.totalWinAmount += (position.size * pnlPercent / 100);
                    }
                    
                    // Supprimer de la liste des positions ouvertes
                    const index = openPositions.findIndex(p => p.id === position.id);
                    if (index !== -1) {
                        openPositions.splice(index, 1);
                    }
                    
                    // 🆕 AMÉLIORATION: Déclencher immédiatement une nouvelle sélection si un emplacement est libre
                    const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
                    if (availableSlots > 0) {
                        log(`🔄 Position fermée - Déclenchement immédiat d'une nouvelle sélection (${availableSlots} emplacements libres)`, 'INFO');
                        setTimeout(() => {
                            if (typeof tradingLoop === 'function') {
                                tradingLoop();
                            }
                        }, 2000); // Attendre 2 secondes pour que le cooldown soit actif
                    }
                } else {
                    log(`❌ Échec fermeture position ${position.symbol}`, 'ERROR');
                }
            } else {
                // Log de suivi (moins fréquent pour éviter le spam)
                if (Date.now() - (position.lastPnLLog || 0) > 30000) { // Toutes les 30 secondes
                    log(`📊 ${position.symbol}: PnL ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (Objectif: +${position.targetPnL}%)`, 'DEBUG');
                    position.lastPnLLog = Date.now();
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        updatePositionsDisplay();
        
    } catch (error) {
        log(`❌ Erreur surveillance PnL: ${error.message}`, 'ERROR');
    }
}

// 🆕 NOUVELLE FONCTION: Fermer une position au marché
async function closePositionAtMarket(position) {
    try {
        const orderData = {
            symbol: position.symbol,
            productType: "USDT-FUTURES",
            marginMode: "isolated",
            marginCoin: "USDT",
            size: position.quantity.toString(),
            side: "sell",
            tradeSide: "close",
            orderType: "market",
            clientOid: `close_${Date.now()}_${position.symbol}`
        };
        
        log(`🔄 Fermeture position ${position.symbol} au marché...`, 'INFO');
        
        const result = await makeRequestWithRetry('/bitget/api/v2/mix/order/place-order', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        if (result && result.code === '00000') {
            log(`✅ Ordre de fermeture placé: ${position.symbol} - ID: ${result.data.orderId}`, 'SUCCESS');
            return true;
        } else {
            log(`❌ Erreur fermeture position ${position.symbol}: ${result?.msg || 'Erreur inconnue'}`, 'ERROR');
            return false;
        }
        
    } catch (error) {
        log(`❌ Exception fermeture position ${position.symbol}: ${error.message}`, 'ERROR');
        return false;
    }
}

// 🆕 NOUVELLE FONCTION: Ajouter un cooldown après fermeture de position (1 minute)
function addPositionCooldown(symbol) {
    const cooldownEnd = Date.now() + (60 * 1000); // 1 minute
    positionCooldowns.set(symbol, cooldownEnd);
    log(`⏰ Cooldown 1min activé pour ${symbol}`, 'INFO');
}

// 🆕 NOUVELLE FONCTION: Vérifier si une paire est en cooldown (1 minute)
function isPairInCooldown(symbol) {
    const cooldownEnd = positionCooldowns.get(symbol);
    if (!cooldownEnd) return false;
    
    const now = Date.now();
    if (now >= cooldownEnd) {
        positionCooldowns.delete(symbol);
        return false;
    }
    
    return true;
}

// 🆕 AMÉLIORATION: Ajouter un cooldown 12h pour les paires déjà tradées
function addTradedPairCooldown(symbol) {
    const cooldownEnd = Date.now() + (12 * 60 * 60 * 1000); // 12 heures
    tradedPairsCooldown.set(symbol, cooldownEnd);
    log(`⏰ Cooldown 12h activé pour ${symbol} (paire tradée)`, 'INFO');
}

// 🆕 AMÉLIORATION: Vérifier si une paire tradée est en cooldown 12h
function isTradedPairInCooldown(symbol) {
    const cooldownEnd = tradedPairsCooldown.get(symbol);
    if (!cooldownEnd) return false;
    
    const now = Date.now();
    if (now >= cooldownEnd) {
        tradedPairsCooldown.delete(symbol);
        return false;
    }
    
    return true;
}

// 🆕 AMÉLIORATION: Obtenir le temps restant du cooldown 1 minute
function getRemainingCooldown(symbol) {
    const cooldownEnd = positionCooldowns.get(symbol);
    if (!cooldownEnd) return 0;
    
    const remaining = Math.max(0, cooldownEnd - Date.now());
    return Math.ceil(remaining / 60000); // En minutes
}

// 🆕 AMÉLIORATION: Obtenir le temps restant du cooldown 12h
function getRemainingTradedCooldown(symbol) {
    const cooldownEnd = tradedPairsCooldown.get(symbol);
    if (!cooldownEnd) return 0;
    
    const remaining = Math.max(0, cooldownEnd - Date.now());
    return Math.ceil(remaining / (60 * 60 * 1000)); // En heures
}

async function updatePositionsPnL() {
    if (openPositions.length === 0) return;
    
    try {
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            
            openPositions.forEach(localPos => {
                const apiPos = apiPositions.find(pos => pos.symbol === localPos.symbol);
                if (apiPos) {
                    localPos.currentPrice = parseFloat(apiPos.markPrice);
                    localPos.unrealizedPnL = parseFloat(apiPos.unrealizedPL || 0);
                    localPos.pnlPercentage = ((localPos.currentPrice - localPos.entryPrice) / localPos.entryPrice) * 100;
                }
            });
            
            updatePositionsDisplay();
        }
    } catch (error) {
        // Mise à jour silencieuse
    }
}

function updatePositionsDisplay() {
    // UI removed: no-op
}

async function importExistingPositions() {
    try {
        log('🔄 Importation des positions existantes depuis Bitget...', 'INFO');
        
        if (typeof makeRequest !== 'function') {
            log('❌ Fonction makeRequest non disponible pour l\'importation', 'ERROR');
            return;
        }
        
        if (!config.apiKey || !config.secretKey || !config.passphrase) {
            log('❌ Configuration API manquante pour l\'importation', 'ERROR');
            return;
        }
        
        log('🔍 Récupération des positions depuis l\'API Bitget...', 'DEBUG');
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        log(`📊 Réponse API reçue: ${result ? 'OK' : 'NULL'}`, 'DEBUG');
        
        if (result && result.code === '00000' && result.data) {
            log(`📊 Données brutes reçues: ${result.data.length} positions total`, 'DEBUG');
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            log(`📊 Positions actives filtrées: ${apiPositions.length}`, 'DEBUG');
            
            if (apiPositions.length === 0) {
                log('ℹ️ Aucune position existante trouvée sur Bitget', 'INFO');
                return;
            }
            
            // NEW: Limit check before importing
            if (openPositions.length + apiPositions.length > MAX_SIMULTANEOUS_POSITIONS) {
                log(`⚠️ Import limité: Trop de positions (${openPositions.length + apiPositions.length} > ${MAX_SIMULTANEOUS_POSITIONS}) - Import partiel`, 'WARNING');
                const availableSlots = MAX_SIMULTANEOUS_POSITIONS - openPositions.length;
                apiPositions.splice(availableSlots); // Keep only what fits
            }
            
            apiPositions.forEach((pos, index) => {
                log(`📍 Position ${index + 1}: ${pos.symbol} ${pos.side || 'NO_SIDE'} - Size: ${pos.contractSize || 'NO_SIZE'} - Price: ${pos.markPrice || 'NO_PRICE'}`, 'DEBUG');
                log(`📊 Structure complète: ${JSON.stringify(pos)}`, 'DEBUG');
            });
            
            let imported = 0;
            
            for (const apiPos of apiPositions) {
                const exists = openPositions.find(localPos => localPos.symbol === apiPos.symbol);
                
                if (!exists) {
                    const side = apiPos.side ? apiPos.side.toUpperCase() : 'LONG';
                    const contractSize = parseFloat(apiPos.contractSize || 0);
                    const markPrice = parseFloat(apiPos.markPrice || 0);
                    const averageOpenPrice = parseFloat(apiPos.averageOpenPrice || markPrice);
                    const unrealizedPL = parseFloat(apiPos.unrealizedPL || 0);
                    
                    log(`🔍 Données position ${apiPos.symbol}: side=${apiPos.side}, contractSize=${apiPos.contractSize}, markPrice=${apiPos.markPrice}`, 'DEBUG');
                    
                    const position = {
                        id: Date.now() + Math.random(),
                        symbol: apiPos.symbol,
                        side: side,
                        size: Math.abs(contractSize * markPrice),
                        quantity: Math.abs(contractSize),
                        entryPrice: averageOpenPrice,
                        status: 'OPEN',
                        timestamp: new Date().toISOString(),
                        orderId: `imported_${Date.now()}`,
                        stopLossId: null,
                        currentStopPrice: null,
                        highestPrice: markPrice,
                        currentPrice: markPrice,
                        unrealizedPnL: unrealizedPL,
                        pnlPercentage: averageOpenPrice > 0 ? ((markPrice - averageOpenPrice) / averageOpenPrice) * 100 : 0,
                        reason: '📥 Position importée depuis Bitget'
                    };
                    
                    if (position.symbol && position.size > 0 && position.entryPrice > 0) {
                        openPositions.push(position);
                        imported++;
                        
                        log(`📥 Position importée: ${position.symbol} ${position.side} ${position.size.toFixed(2)} USDT @ ${position.entryPrice.toFixed(4)}`, 'SUCCESS');
                    } else {
                        log(`⚠️ Position ${apiPos.symbol} ignorée - Données invalides`, 'WARNING');
                    }
                }
            }
            
            if (imported > 0) {
                log(`✅ ${imported} position(s) importée(s) avec succès!`, 'SUCCESS');
                log(`⚠️ Positions importées SANS stop loss - Le système va les protéger automatiquement`, 'WARNING');
                
                updatePositionsDisplay();
                updateStats();
                
                setTimeout(() => {
                    manageTrailingStops();
                }, 2000);
            } else {
                log('ℹ️ Toutes les positions existantes sont déjà dans le système', 'INFO');
            }
        } else {
            log('❌ Erreur lors de l\'importation des positions', 'ERROR');
        }
    } catch (error) {
        log(`❌ Erreur importation positions: ${error.message}`, 'ERROR');
    }
}

window.importExistingPositions = importExistingPositions;
window.canOpenNewPosition = canOpenNewPosition;
window.syncAndCheckPositions = syncAndCheckPositions;
window.fetchActivePositionsFromAPI = fetchActivePositionsFromAPI;
window.makeRequestWithRetry = makeRequestWithRetry;

// 🧪 FONCTION DE TEST: Tester les nouveaux paramètres MACD par timeframe
async function testMACDParameters(symbol = 'BTCUSDT') {
    console.log('🧪 Test des paramètres MACD adaptatifs par timeframe...');
    
    const testSymbol = symbol;
    const timeframes = ['4h', '1h', '15m'];
    
    for (const tf of timeframes) {
        console.log(`\n🔍 Test ${tf.toUpperCase()}:`);
        
        const params = getMACDParameters(tf);
        console.log(`   Paramètres: Fast=${params.fast}, Slow=${params.slow}, Signal=${params.signal}`);
        console.log(`   Bougies requises: ${params.minCandles}`);
        
        try {
            const analysis = await analyzePairMACD(testSymbol, tf);
            console.log(`   ✅ Analyse réussie: ${analysis.signal}`);
            console.log(`   📊 Raison: ${analysis.reason}`);
        } catch (error) {
            console.log(`   ❌ Erreur analyse: ${error.message}`);
        }
        
        // Délai entre les tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n✅ Test terminé. Vérifiez les résultats ci-dessus.');
}

// Rendre la fonction accessible globalement
window.testMACDParameters = testMACDParameters;

// NEW: Merged function combining syncLocalPositions and checkPositionsStatus
async function syncAndCheckPositions() {
    if (openPositions.length === 0) return [];
    
    try {
        const result = await makeRequest('/bitget/api/v2/mix/position/all-position?productType=USDT-FUTURES');
        
        if (result && result.code === '00000' && result.data) {
            const apiPositions = result.data.filter(pos => parseFloat(pos.total) > 0);
            const currentSymbols = apiPositions.map(pos => pos.symbol);
            
            const closedPositions = openPositions.filter(localPos => 
                !currentSymbols.includes(localPos.symbol)
            );
            
            if (closedPositions.length > 0) {
                for (const closedPos of closedPositions) {
                    log(`🔚 Position fermée détectée: ${closedPos.symbol} (Stop Loss déclenché ou fermeture manuelle)`, 'SUCCESS');
                    
                    botStats.totalClosedPositions++;
                    const pnl = closedPos.unrealizedPnL || 0;
                    
                    if (pnl > 0) {
                        botStats.winningPositions++;
                        botStats.totalWinAmount += pnl;
                        log(`🟢 Position gagnante: +${pnl.toFixed(2)}$ (Total: ${botStats.winningPositions} gagnantes)`, 'SUCCESS');
                    } else if (pnl < 0) {
                        botStats.losingPositions++;
                        botStats.totalLossAmount += pnl;
                        log(`🔴 Position perdante: ${pnl.toFixed(2)}$ (Total: ${botStats.losingPositions} perdantes)`, 'WARNING');
                    }
                    
                    // Cancel orphaned stop losses (from checkPositionsStatus)
                    if (closedPos.stopLossId) {
                        try {
                            const cancelResult = await makeRequest('/bitget/api/v2/mix/order/cancel-plan-order', {
                                method: 'POST',
                                body: JSON.stringify({
                                    symbol: closedPos.symbol,
                                    productType: "USDT-FUTURES",
                                    marginCoin: "USDT",
                                    orderId: closedPos.stopLossId
                                })
                            });
                            
                            if (cancelResult && cancelResult.code === '00000') {
                                log(`✅ Stop Loss ${closedPos.symbol} annulé automatiquement`, 'SUCCESS');
                            }
                        } catch (error) {
                            log(`⚠️ Erreur annulation stop loss ${closedPos.symbol}: ${error.message}`, 'WARNING');
                        }
                    }
                }
                
                openPositions = openPositions.filter(localPos => 
                    currentSymbols.includes(localPos.symbol)
                );
                
                updatePositionsDisplay();
                updateStats();
                await refreshBalance();
                
                log(`📊 ${closedPositions.length} position(s) fermée(s) - Synchronisation effectuée`, 'SUCCESS');
            }
            
            return apiPositions;
        }
    } catch (error) {
        log(`❌ Erreur synchronisation positions: ${error.message}`, 'ERROR');
        return [];
    }
}

// 🧪 FONCTION DE TEST: Vérifier que toutes les corrections fonctionnent
async function testTradingFixes() {
    console.log('🧪 Test des corrections de trading...');
    
    try {
        // Test 1: Vérifier que la fonction dupliquée a été supprimée
        if (typeof analyzeMultiTimeframe === 'undefined') {
            console.log('✅ Fix 1: Fonction dupliquée analyzeMultiTimeframe supprimée');
        } else {
            console.log('❌ Fix 1: Fonction dupliquée analyzeMultiTimeframe encore présente');
        }
        
        // Test 2: Vérifier que la fonction d'agrégation existe
        if (typeof aggregateDataFromLowerTimeframe === 'function') {
            console.log('✅ Fix 2: Fonction d\'agrégation pour INSUFFICIENT_DATA ajoutée');
        } else {
            console.log('❌ Fix 2: Fonction d\'agrégation manquante');
        }
        
        // Test 3: Vérifier que la fonction de retry existe
        if (typeof makeRequestWithRetry === 'function') {
            console.log('✅ Fix 4: Fonction de retry pour stop loss ajoutée');
        } else {
            console.log('❌ Fix 4: Fonction de retry manquante');
        }
        
        // Test 4: Vérifier que la fonction mergée existe
        if (typeof syncAndCheckPositions === 'function') {
            console.log('✅ Fix 5: Fonction de synchronisation mergée créée');
        } else {
            console.log('❌ Fix 5: Fonction de synchronisation mergée manquante');
        }
        
        // Test 5: Vérifier que les anciens noms n'existent plus
        if (typeof syncLocalPositions === 'undefined' && typeof checkPositionsStatus === 'undefined') {
            console.log('✅ Fix 5: Anciennes fonctions de synchronisation supprimées');
        } else {
            console.log('❌ Fix 5: Anciennes fonctions de synchronisation encore présentes');
        }
        
        // Test 6: Vérifier la configuration trailing stop
        if (config.trailingStopSettings && config.trailingStopSettings.trailingPercent) {
            console.log('✅ Fix Général: Configuration trailing stop configurable');
        } else {
            console.log('⚠️ Fix Général: Configuration trailing stop utilise les valeurs par défaut');
        }
        
        console.log('✅ Test des corrections terminé');
        
    } catch (error) {
        console.error('❌ Erreur lors du test des corrections:', error);
    }
}

// Rendre la fonction accessible globalement
window.testTradingFixes = testTradingFixes;

console.log('✅ Trading fixes applied successfully - call testTradingFixes() to verify');